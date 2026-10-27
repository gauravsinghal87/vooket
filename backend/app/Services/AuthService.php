<?php

namespace App\Services;

use App\Exceptions\AccountAlreadyExistsException;
use App\Exceptions\GoogleTokenException;
use App\Exceptions\OtpCooldownException;
use App\Infrastructure\Interfaces\SmsProviderInterface;
use App\Models\OtpCode;
use App\Models\User;
use App\Models\UserDevice;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class AuthService
{
    /**
     * Safe, generic message used whenever a registration collides with an
     * existing account. Never reveals which identifier matched.
     */
    public const ACCOUNT_ALREADY_EXISTS_MESSAGE = 'An account already exists with these credentials. Please sign in or contact support.';

    public function __construct(
        private SmsProviderInterface $smsProvider,
        private WalletService $walletService,
    ) {}

    public function sendOtp(string $phone, string $countryCode = '+91', string $purpose = 'login'): array
    {
        $cooldown = (int) config('auth.otp.resend_cooldown_seconds', 60);
        $ttlMinutes = (int) config('auth.otp.ttl_minutes', 10);

        $recent = OtpCode::where('phone', $phone)
            ->where('purpose', $purpose)
            ->whereNull('used_at')
            ->where('expires_at', '>', now())
            ->latest('id')
            ->first();

        if ($recent && $cooldown > 0 && abs($recent->created_at->diffInSeconds(now())) < $cooldown) {
            throw new OtpCooldownException('Please wait before requesting a new OTP.');
        }

        $otp = (string) random_int(100000, 999999);
        $token = Str::random(64);

        OtpCode::where('phone', $phone)->where('purpose', $purpose)->delete();

        OtpCode::create([
            'phone' => $phone,
            'otp' => bcrypt($otp),
            'purpose' => $purpose,
            'token' => $token,
            'expires_at' => now()->addMinutes($ttlMinutes),
        ]);

        $this->smsProvider->sendOtp($phone, $otp);

        return [
            'token' => $token,
            'expires_at' => now()->addMinutes($ttlMinutes)->toISOString(),
        ];
    }

    public function verifyOtp(string $phone, string $otp, string $token, string $countryCode = '+91'): array
    {
        $maxAttempts = (int) config('auth.otp.max_attempts', 5);
        $failure = null;

        $result = DB::transaction(function () use ($phone, $otp, $token, $countryCode, $maxAttempts, &$failure) {
            $record = OtpCode::lockForUpdate()
                ->where('phone', $phone)
                ->where('token', $token)
                ->where('purpose', 'login')
                ->where('expires_at', '>', now())
                ->whereNull('used_at')
                ->first();

            if (! $record || ! $record->expires_at->isFuture()) {
                $failure = 'Invalid or expired OTP';

                return null;
            }

            if ($record->attempts >= $maxAttempts) {
                $record->delete();
                $failure = 'Invalid or expired OTP';

                return null;
            }

            if (! password_verify($otp, $record->otp)) {
                $record->increment('attempts');

                if ($record->attempts >= $maxAttempts) {
                    $record->delete();
                    $failure = 'Too many attempts. Please request a new OTP.';
                } else {
                    $failure = 'Invalid OTP';
                }

                return null;
            }

            // A failed verification must persist (attempts counter / invalidation)
            // even though verifyOtp reports the error to the caller, so the
            // increment and delete above run inside this committed transaction.

            $user = User::withTrashed()->where('phone', $phone)->first();

            if ($user && ($user->trashed() || ! $user->isActive())) {
                $failure = 'Account is not active';

                return null;
            }

            if (! $user) {
                $user = $this->createUserWithPhone($phone, $countryCode);
            }

            $record->update([
                'attempts' => $record->attempts + 1,
                'used_at' => now(),
            ]);

            $user->update([
                'phone_verified_at' => $user->phone_verified_at ?? now(),
                'is_verified' => true,
            ]);

            return $this->createSession($user);
        });

        if ($failure) {
            throw new \Exception($failure);
        }

        return $result;
    }

    public function register(array $data): array
    {
        return DB::transaction(function () use ($data) {
            if (empty($data['phone']) || empty($data['name'])) {
                throw new \Exception('Phone and name are required');
            }

            $this->assertCredentialsAvailable($data['phone'], $data['email'] ?? null);

            $user = User::create([
                'name' => $data['name'],
                'phone' => $data['phone'],
                'email' => $data['email'] ?? null,
                'password' => $data['password'] ?? null,
                'auth_provider' => 'password',
                'country_code' => $data['country_code'] ?? '+91',
                'referral_code' => $this->generateReferralCode(),
                'user_type' => 'customer',
                'is_active' => true,
            ]);

            $this->walletService->ensureWallet($user, 'customer');
            $this->walletService->ensureWallet($user, 'platform');

            if (! empty($data['referral_code'])) {
                $this->processReferral($user, $data['referral_code']);
            }

            return $this->createSession($user);
        });
    }

    /**
     * Reject a registration when either the phone or the email already belongs
     * to an account, including soft-deleted accounts. Never returns whether a
     * specific identifier is taken.
     */
    public static function assertCredentialsAvailable(string $phone, ?string $email = null): void
    {
        $phoneExists = User::withTrashed()->where('phone', $phone)->exists();
        $emailExists = ! empty($email) && User::withTrashed()->where('email', $email)->exists();

        if ($phoneExists || $emailExists) {
            throw new AccountAlreadyExistsException(self::ACCOUNT_ALREADY_EXISTS_MESSAGE);
        }
    }

    /**
     * Find or create a customer from verified Google ID token claims, then
     * issue the same Sanctum session as every other customer login.
     *
     * Linking rules, in order:
     *  1. A stored Google `sub` is the strongest match — log that user in.
     *  2. Otherwise an account holding the same email is linked rather than
     *     duplicated, but only when Google asserts the email is verified and
     *     only for customer accounts. An unverified Google email never links
     *     and never takes over an existing account.
     *  3. Otherwise a new customer is created.
     *
     * @param  array{sub:string,email:string,email_verified:bool,name:?string,picture:?string}  $claims
     */
    public function loginWithGoogleClaims(array $claims): array
    {
        return DB::transaction(function () use ($claims) {
            $sub = (string) $claims['sub'];
            $email = strtolower((string) $claims['email']);
            $emailVerified = (bool) $claims['email_verified'];

            $linked = User::where('google_sub', $sub)->first();

            if ($linked) {
                $this->assertGoogleAccountUsable($linked);

                return $this->createSession($linked);
            }

            $existing = User::withTrashed()->where('email', $email)->first();

            if ($existing) {
                return $this->linkGoogleToExistingAccount($existing, $claims);
            }

            if (! $emailVerified) {
                throw new GoogleTokenException('Google has not verified this email address. Please use your password to sign in.');
            }

            return $this->createSession($this->createUserWithGoogle($claims));
        });
    }

    /**
     * Attach a verified Google identity to an account that already exists,
     * refusing every case where the link could hand over someone else's
     * account or a non-customer account.
     *
     * @param  array{sub:string,email:string,email_verified:bool,name:?string,picture:?string}  $claims
     */
    private function linkGoogleToExistingAccount(User $existing, array $claims): array
    {
        $emailVerified = (bool) $claims['email_verified'];

        if (! $emailVerified) {
            throw new GoogleTokenException(
                'An account already exists with this email. Please sign in with your password to continue.'
            );
        }

        if ($existing->trashed() || ! $existing->isActive()) {
            throw new GoogleTokenException(
                'An account with this email is not active. Please sign in with your password or contact support.'
            );
        }

        if ($existing->user_type !== 'customer') {
            throw new GoogleTokenException(
                'This email is already in use by a non-customer account. Google sign-in is only available for customer accounts.'
            );
        }

        if ($existing->google_sub && $existing->google_sub !== $claims['sub']) {
            throw new GoogleTokenException(
                'A different Google account is already linked to this profile. Please sign in with your password to continue.'
            );
        }

        $existing->update([
            'google_sub' => $claims['sub'],
            'google_linked_at' => $existing->google_linked_at ?? now(),
            'email_verified_at' => $existing->email_verified_at ?? now(),
            'is_verified' => true,
        ]);

        return $this->createSession($existing);
    }

    /**
     * Create a customer from verified Google claims. Google does not supply a
     * phone number, so the account starts without one and can be completed
     * later from the profile screen.
     *
     * @param  array{sub:string,email:string,email_verified:bool,name:?string,picture:?string}  $claims
     */
    private function createUserWithGoogle(array $claims): User
    {
        $email = strtolower((string) $claims['email']);
        $name = $claims['name'] ?: strstr($email, '@', true) ?: 'Customer';

        $user = User::create([
            'name' => $name,
            'email' => $email,
            'phone' => null,
            'google_sub' => $claims['sub'],
            'auth_provider' => 'google',
            'google_linked_at' => now(),
            'avatar' => $this->safeAvatarUrl($claims['picture'] ?? null),
            'referral_code' => $this->generateReferralCode(),
            'user_type' => 'customer',
            'is_active' => true,
            'is_verified' => true,
            'email_verified_at' => now(),
        ]);

        $this->walletService->ensureWallet($user, 'customer');
        $this->walletService->ensureWallet($user, 'platform');

        return $user;
    }

    /**
     * Only accept an https avatar URL supplied by Google.
     */
    private function safeAvatarUrl(?string $picture): ?string
    {
        if (! is_string($picture) || $picture === '' || mb_strlen($picture) > 2048) {
            return null;
        }

        $scheme = strtolower((string) parse_url($picture, PHP_URL_SCHEME));

        return $scheme === 'https' ? $picture : null;
    }

    private function assertGoogleAccountUsable(User $user): void
    {
        if ($user->trashed() || ! $user->isActive()) {
            throw new GoogleTokenException('Account is not active');
        }

        if ($user->user_type !== 'customer') {
            throw new GoogleTokenException('Google sign-in is only available for customer accounts.');
        }
    }

    public function loginWithEmail(string $email, string $password): array
    {
        $user = User::where('email', $email)->first();

        if (! $user || ! password_verify($password, $user->password)) {
            throw new \Exception('Invalid credentials');
        }

        if (! $user->isActive()) {
            throw new \Exception('Account is not active');
        }

        return $this->createSession($user);
    }

    public function loginByPhone(string $phone, string $password, string $countryCode = '+91'): array
    {
        $user = User::where('phone', $phone)->first();

        if (! $user || ! password_verify($password, $user->password)) {
            throw new \Exception('Invalid credentials');
        }

        if (! $user->isActive()) {
            throw new \Exception('Account is not active');
        }

        return $this->createSession($user);
    }

    public function createSession(User $user): array
    {
        $user->update([
            'last_login_at' => now(),
            'last_login_ip' => request()->ip(),
        ]);

        $token = $user->createToken('auth_'.Str::random(8))->plainTextToken;

        $this->walletService->ensureWallet($user, 'customer');

        return [
            'user' => $user->load('roles'),
            'token' => $token,
        ];
    }

    public function logout(User $user, ?string $deviceId = null): void
    {
        if ($deviceId) {
            $user->devices()->where('device_token', $deviceId)->delete();

            return;
        }

        // Revoke ONLY the access token used for the current request. Never
        // delete a different token (previously the token id was compared
        // against auth()->id(), which erased the wrong row).
        $user->currentAccessToken()?->delete();
    }

    public function registerDevice(User $user, array $data): UserDevice
    {
        return UserDevice::updateOrCreate(
            ['user_id' => $user->id, 'device_token' => $data['device_token']],
            [
                'device_type' => $data['device_type'] ?? 'web',
                'device_name' => $data['device_name'] ?? null,
                'platform' => $data['platform'] ?? null,
                'app_version' => $data['app_version'] ?? null,
                'is_active' => true,
                'last_seen_at' => now(),
            ]
        );
    }

    private function createUserWithPhone(string $phone, string $countryCode = '+91', ?string $name = null): User
    {
        return User::create([
            'name' => $name ?? 'User '.substr($phone, -4),
            'phone' => $phone,
            'auth_provider' => 'otp',
            'country_code' => $countryCode,
            'referral_code' => $this->generateReferralCode(),
            'user_type' => 'customer',
            'is_active' => true,
        ]);
    }

    private function generateReferralCode(): string
    {
        do {
            $code = strtoupper(Str::random(6));
        } while (User::where('referral_code', $code)->exists());

        return $code;
    }

    private function processReferral(User $user, string $referralCode): void
    {
        $referrer = User::where('referral_code', $referralCode)->first();

        if ($referrer && $referrer->id !== $user->id) {
            $user->update(['referred_by' => $referrer->id]);
        }
    }
}
