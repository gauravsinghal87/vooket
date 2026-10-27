<?php

namespace App\Services;

use App\Exceptions\PasswordResetUnavailableException;
use App\Models\User;
use App\Services\Mail\MailConfigurationException;
use App\Services\Mail\MailConfigurationService;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;

/**
 * Password reset orchestration.
 *
 * Reuses Laravel's stock password broker (hashed, expiring, single-use tokens
 * stored in `password_reset_tokens`) and the application's own auth rules. No
 * custom token format or cryptography is introduced.
 */
class PasswordResetService
{
    /**
     * Identical response for every input so the endpoint can never be used to
     * enumerate which email addresses have an account, nor which of them use
     * password authentication.
     */
    public const GENERIC_MESSAGE = 'If an account exists for this email and uses a password, a password reset link has been sent. Please check your inbox. If you signed up with Google or phone OTP, continue with that method instead.';

    public function __construct(
        private MailConfigurationService $mail,
    ) {}

    /**
     * Issue a reset link for $email when it belongs to an eligible account.
     *
     * The return value is intentionally not used to build the HTTP response:
     * callers must always answer with self::GENERIC_MESSAGE.
     */
    public function sendResetLink(string $email): void
    {
        $email = strtolower(trim($email));

        // Availability is checked before the account lookup so a disabled SMTP
        // service cannot be used as an existence oracle either.
        if (! $this->mail->isConfigured()) {
            throw PasswordResetUnavailableException::make();
        }

        $user = User::query()
            ->where('email', $email)
            ->whereNotNull('email')
            ->first();

        // Only accounts that actually authenticate with a local password are
        // eligible. Google-only and OTP-only accounts keep their existing
        // authentication method and are never issued a password.
        if (! $user || ! $user->usesPasswordAuth() || ! $user->isActive()) {
            return;
        }

        $status = $this->dispatchResetLink($user);

        if ($status !== Password::RESET_LINK_SENT) {
            // Throttled or otherwise not delivered. Still answered generically.
            return;
        }
    }

    /**
     * Ask the broker to create a token and deliver the notification.
     *
     * Any transport failure is converted into a safe "service unavailable"
     * error. The underlying SMTP detail is logged by MailConfigurationService
     * without credentials and is never returned to the caller.
     */
    protected function dispatchResetLink(User $user): string
    {
        try {
            return Password::broker()->sendResetLink(['email' => $user->email]);
        } catch (MailConfigurationException $e) {
            throw PasswordResetUnavailableException::make();
        }
    }

    /**
     * Complete a password reset using Laravel's broker.
     *
     * @return array{status: string, user: ?User}
     */
    public function reset(string $email, #[\SensitiveParameter] string $token, #[\SensitiveParameter] string $password): array
    {
        $email = strtolower(trim($email));

        $user = null;

        $status = Password::broker()->reset(
            [
                'email' => $email,
                'token' => $token,
                'password' => $password,
                'password_confirmation' => $password,
            ],
            function (User $resetUser, #[\SensitiveParameter] $newPassword) use (&$user) {
                // The broker hands over the PLAINTEXT password; the model's
                // `hashed` cast performs the bcrypt hashing on assignment.
                $resetUser->forceFill([
                    'password' => $newPassword,
                    'remember_token' => Str::random(60),
                ])->save();

                // A reset means the previous credentials are compromised: drop
                // every issued Sanctum token so other devices must sign in again.
                $resetUser->tokens()->delete();

                // The broker already deleted the token row; clear any cached
                // permission/role state tied to the old session.
                event(new PasswordReset($resetUser));

                $user = $resetUser;
            }
        );

        return ['status' => $status, 'user' => $user];
    }
}
