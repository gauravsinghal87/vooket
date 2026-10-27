<?php

namespace Tests\Feature;

use App\Models\DeliveryPartner;
use App\Models\Driver;
use App\Models\OtpCode;
use App\Models\Role;
use App\Models\User;
use App\Models\VehicleType;
use App\Models\Vendor;
use App\Models\Zone;
use App\Services\AuthService;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class IdentitySecurityHardeningTest extends TestCase
{
    use RefreshDatabase;

    private const OTP = '123456';

    protected function setUp(): void
    {
        parent::setUp();

        Role::firstOrCreate(['slug' => 'customer'], ['name' => 'Customer']);
        Role::firstOrCreate(['slug' => 'driver'], ['name' => 'Driver']);
        Role::firstOrCreate(['slug' => 'delivery_partner'], ['name' => 'Delivery Partner']);
        Role::firstOrCreate(['slug' => 'vendor'], ['name' => 'Vendor']);
        Role::firstOrCreate(['slug' => 'super_admin'], ['name' => 'Super Admin']);
    }

    public function test_register_requires_a_password(): void
    {
        $response = $this->postJson('/api/v1/auth/register', [
            'name' => 'Passwordless Customer',
            'phone' => '9000000901',
            'email' => 'passwordless.customer@example.com',
        ]);

        $response->assertStatus(422)->assertJsonValidationErrors('password');
        $this->assertSame(0, User::where('phone', '9000000901')->count());
    }

    public function test_register_rejects_mismatched_password_confirmation(): void
    {
        $response = $this->postJson('/api/v1/auth/register', [
            'name' => 'Mismatched Confirmation',
            'phone' => '9000000902',
            'email' => 'mismatch.customer@example.com',
            'password' => 'secret123',
            'password_confirmation' => 'different123',
        ]);

        $response->assertStatus(422)->assertJsonValidationErrors('password');
        $this->assertSame(0, User::where('phone', '9000000902')->count());
    }

    public function test_register_rejects_password_shorter_than_eight_characters(): void
    {
        $response = $this->postJson('/api/v1/auth/register', [
            'name' => 'Short Password',
            'phone' => '9000000903',
            'email' => 'short.password@example.com',
            'password' => 'short',
            'password_confirmation' => 'short',
        ]);

        $response->assertStatus(422)->assertJsonValidationErrors('password');
        $this->assertSame(0, User::where('phone', '9000000903')->count());
    }

    public function test_register_stores_password_hashed_and_never_returns_it(): void
    {
        $response = $this->postJson('/api/v1/auth/register', [
            'name' => 'Hashed Customer',
            'phone' => '9000000904',
            'email' => 'hashed.customer@example.com',
            'password' => 'secret123',
            'password_confirmation' => 'secret123',
        ]);

        $response->assertCreated();
        $response->assertJsonMissingPath('data.user.password');

        $user = User::where('phone', '9000000904')->firstOrFail();

        $this->assertNotSame('secret123', $user->password);
        $this->assertTrue(Hash::check('secret123', $user->password));
    }

    public function test_newly_registered_customer_can_log_in_with_that_password(): void
    {
        $this->postJson('/api/v1/auth/register', [
            'name' => 'Round Trip Customer',
            'phone' => '9000000905',
            'email' => 'round.trip@example.com',
            'password' => 'secret123',
            'password_confirmation' => 'secret123',
        ])->assertCreated();

        $this->postJson('/api/v1/auth/login', [
            'phone' => '9000000905',
            'password' => 'secret123',
        ])->assertOk()->assertJsonStructure(['data' => ['token', 'user']]);

        $this->postJson('/api/v1/auth/login/email', [
            'email' => 'round.trip@example.com',
            'password' => 'secret123',
        ])->assertOk()->assertJsonStructure(['data' => ['token', 'user']]);
    }

    public function test_customer_register_cannot_overwrite_existing_phone_account(): void
    {
        $existing = User::factory()->create(['name' => 'Original Owner', 'phone' => '9000000201', 'email' => 'original.customer@example.com', 'user_type' => 'customer']);

        $response = $this->postJson('/api/v1/auth/register', [
            'name' => 'Intruder',
            'phone' => $existing->phone,
            'email' => 'intruder.customer@example.com',
            'password' => 'secret123',
            'password_confirmation' => 'secret123',
        ]);

        $response->assertStatus(422)->assertJsonPath('message', AuthService::ACCOUNT_ALREADY_EXISTS_MESSAGE);

        $fresh = $existing->fresh();
        $this->assertSame('Original Owner', $fresh->name);
        $this->assertSame('9000000201', $fresh->phone);
        $this->assertSame(1, User::where('phone', '9000000201')->count());
    }

    public function test_customer_register_cannot_overwrite_existing_email_account(): void
    {
        $existing = User::factory()->create(['name' => 'Original Owner', 'phone' => '9000000202', 'email' => 'shared.customer@example.com', 'user_type' => 'customer']);

        $response = $this->postJson('/api/v1/auth/register', [
            'name' => 'Intruder',
            'phone' => '9000000203',
            'email' => $existing->email,
            'password' => 'secret123',
            'password_confirmation' => 'secret123',
        ]);

        $response->assertStatus(422)->assertJsonPath('message', AuthService::ACCOUNT_ALREADY_EXISTS_MESSAGE);

        $fresh = $existing->fresh();
        $this->assertSame('Original Owner', $fresh->name);
        $this->assertSame(1, User::where('email', 'shared.customer@example.com')->count());
    }

    public function test_partner_register_cannot_overwrite_existing_phone_account(): void
    {
        $existing = User::factory()->create(['name' => 'Original Owner', 'phone' => '9000000301', 'email' => 'original.partner@example.com', 'user_type' => 'customer']);

        $response = $this->postJson('/api/v1/auth/partner/register', $this->partnerPayload('delivery_partner', [
            'phone' => $existing->phone,
            'email' => 'fresh.partner.token@example.com',
        ]));

        $response->assertStatus(422)->assertJsonPath('message', AuthService::ACCOUNT_ALREADY_EXISTS_MESSAGE);

        $fresh = $existing->fresh();
        $this->assertSame('Original Owner', $fresh->name);
        $this->assertSame(0, Driver::where('user_id', $existing->id)->count());
        $this->assertSame(0, DeliveryPartner::where('user_id', $existing->id)->count());
        $this->assertSame(1, User::where('phone', '9000000301')->count());
        $this->assertFalse($fresh->hasRole('delivery_partner'));
    }

    public function test_partner_register_cannot_overwrite_existing_email_account(): void
    {
        $existing = User::factory()->create(['name' => 'Original Owner', 'phone' => '9000000302', 'email' => 'taken.partner@example.com', 'user_type' => 'customer']);

        $response = $this->postJson('/api/v1/auth/partner/register', $this->partnerPayload('delivery_partner', [
            'phone' => '9000000303',
            'email' => $existing->email,
        ]));

        $response->assertStatus(422);
        $this->assertSame('Original Owner', $existing->fresh()->name);
        $this->assertSame(1, User::where('email', 'taken.partner@example.com')->count());
        $this->assertSame(0, DeliveryPartner::where('user_id', $existing->id)->count());
    }

    public function test_vendor_register_cannot_overwrite_existing_phone_account(): void
    {
        $existing = User::factory()->create(['name' => 'Original Owner', 'phone' => '9000000401', 'email' => 'original.vendor@example.com', 'user_type' => 'customer']);

        $response = $this->postJson('/api/v1/auth/vendor/register', $this->vendorPayload([
            'phone' => $existing->phone,
            'email' => 'fresh.vendor.token@example.com',
        ]));

        $response->assertStatus(422)->assertJsonPath('message', AuthService::ACCOUNT_ALREADY_EXISTS_MESSAGE);

        $fresh = $existing->fresh();
        $this->assertSame('Original Owner', $fresh->name);
        $this->assertSame(0, Vendor::where('user_id', $existing->id)->count());
        $this->assertSame(1, User::where('phone', '9000000401')->count());
        $this->assertFalse($fresh->hasRole('vendor'));
    }

    public function test_vendor_register_cannot_overwrite_existing_email_account(): void
    {
        $existing = User::factory()->create(['name' => 'Original Owner', 'phone' => '9000000402', 'email' => 'taken.vendor@example.com', 'user_type' => 'customer']);

        $response = $this->postJson('/api/v1/auth/vendor/register', $this->vendorPayload([
            'phone' => '9000000403',
            'email' => $existing->email,
        ]));

        $response->assertStatus(422);
        $this->assertSame('Original Owner', $existing->fresh()->name);
        $this->assertSame(1, User::where('email', 'taken.vendor@example.com')->count());
        $this->assertSame(0, Vendor::where('user_id', $existing->id)->count());
    }

    public function test_register_creates_account_only_when_both_credentials_are_unused(): void
    {
        $response = $this->postJson('/api/v1/auth/register', [
            'name' => 'Brand New Customer',
            'phone' => '9000000501',
            'email' => 'brand.new@example.com',
            'password' => 'secret123',
            'password_confirmation' => 'secret123',
        ]);

        $response->assertCreated()->assertJsonPath('data.user.phone', '9000000501');

        $user = User::where('phone', '9000000501')->first();
        $this->assertNotNull($user);
        $this->assertTrue($user->is_active);
        $this->assertSame('customer', $user->user_type);
    }

    public function test_duplicate_registration_creates_only_one_account(): void
    {
        $payload = [
            'name' => 'Duplicate Hunter',
            'phone' => '9000000601',
            'email' => 'duplicate.hunter@example.com',
            'password' => 'secret123',
            'password_confirmation' => 'secret123',
        ];

        $this->postJson('/api/v1/auth/register', $payload)->assertCreated();

        $second = $this->postJson('/api/v1/auth/register', $payload);

        $second->assertStatus(422)->assertJsonPath('message', AuthService::ACCOUNT_ALREADY_EXISTS_MESSAGE);
        $this->assertSame(1, User::where('phone', '9000000601')->count());
        $this->assertSame(1, User::where('email', 'duplicate.hunter@example.com')->count());
    }

    public function test_otp_takes_max_wrong_attempts_to_invalidate(): void
    {
        $this->createOtp('9000000701', self::OTP, attempts: 3, token: 'otp-token-max');

        $first = $this->postJson('/api/v1/auth/otp/verify', [
            'phone' => '9000000701',
            'otp' => '999999',
            'token' => 'otp-token-max',
        ]);

        $first->assertStatus(401)->assertJsonPath('message', 'Invalid OTP');
        $this->assertSame(4, OtpCode::where('token', 'otp-token-max')->first()->attempts);

        $second = $this->postJson('/api/v1/auth/otp/verify', [
            'phone' => '9000000701',
            'otp' => '999999',
            'token' => 'otp-token-max',
        ]);

        $second->assertStatus(401)->assertJsonPath('message', 'Too many attempts. Please request a new OTP.');
        $this->assertDatabaseMissing('otp_codes', ['token' => 'otp-token-max']);
    }

    public function test_otp_cannot_be_replayed_after_successful_verification(): void
    {
        $this->createOtp('9000000702', self::OTP, token: 'otp-token-replay');

        $first = $this->postJson('/api/v1/auth/otp/verify', [
            'phone' => '9000000702',
            'otp' => self::OTP,
            'token' => 'otp-token-replay',
        ]);

        $first->assertOk()->assertJsonPath('success', true);
        $this->assertNotNull(OtpCode::where('token', 'otp-token-replay')->first()->used_at);

        $replay = $this->postJson('/api/v1/auth/otp/verify', [
            'phone' => '9000000702',
            'otp' => self::OTP,
            'token' => 'otp-token-replay',
        ]);

        $replay->assertStatus(401)->assertJsonPath('message', 'Invalid or expired OTP');
    }

    public function test_concurrent_otp_verification_has_only_one_winner(): void
    {
        $this->createOtp('9000000703', self::OTP, token: 'otp-token-race');

        $this->postJson('/api/v1/auth/otp/verify', [
            'phone' => '9000000703',
            'otp' => self::OTP,
            'token' => 'otp-token-race',
        ])->assertOk();

        $loser = $this->postJson('/api/v1/auth/otp/verify', [
            'phone' => '9000000703',
            'otp' => self::OTP,
            'token' => 'otp-token-race',
        ]);

        $loser->assertStatus(401);
        $this->assertSame(1, OtpCode::where('token', 'otp-token-race')->whereNotNull('used_at')->count());
    }

    public function test_otp_stored_as_hash_not_plaintext(): void
    {
        $this->postJson('/api/v1/auth/otp/send', ['phone' => '9000000700'])->assertOk();

        $record = OtpCode::where('phone', '9000000700')->first();
        $this->assertNotNull($record);
        $this->assertStringStartsWith('$2', $record->otp);
        $this->assertDoesNotMatchRegularExpression('/^\d{6}$/', $record->otp);
        $this->assertTrue(Hash::isHashed($record->otp));
    }

    public function test_resend_otp_respects_cooldown(): void
    {
        $this->postJson('/api/v1/auth/otp/send', ['phone' => '9000000704'])->assertOk();

        $resend = $this->postJson('/api/v1/auth/otp/send', ['phone' => '9000000704']);

        $resend->assertStatus(429)->assertJsonPath('message', 'Please wait before requesting a new OTP.');
    }

    public function test_otp_send_endpoint_is_rate_limited(): void
    {
        $this->postJson('/api/v1/auth/otp/send', ['phone' => '9000000705'])->assertOk();

        foreach (range(1, 4) as $i) {
            $this->postJson('/api/v1/auth/otp/send', ['phone' => '9000000705']);
        }

        $blocked = $this->postJson('/api/v1/auth/otp/send', ['phone' => '9000000705']);

        $blocked->assertStatus(429);
    }

    public function test_otp_verify_endpoint_is_rate_limited(): void
    {
        foreach (range(1, 10) as $i) {
            $this->postJson('/api/v1/auth/otp/verify', [
                'phone' => '9000000706',
                'otp' => '000000',
                'token' => 'never-exists-'.$i,
            ])->assertStatus(401);
        }

        $blocked = $this->postJson('/api/v1/auth/otp/verify', [
            'phone' => '9000000706',
            'otp' => '000000',
            'token' => 'never-exists-11',
        ]);

        $blocked->assertStatus(429);
    }

    public function test_login_endpoint_is_rate_limited(): void
    {
        foreach (range(1, 10) as $i) {
            $this->postJson('/api/v1/auth/login', [
                'phone' => '9000000801',
                'password' => 'wrong-password',
            ])->assertStatus(401);
        }

        $blocked = $this->postJson('/api/v1/auth/login', [
            'phone' => '9000000801',
            'password' => 'wrong-password',
        ]);

        $blocked->assertStatus(429);
    }

    public function test_partner_register_endpoint_is_rate_limited(): void
    {
        foreach (range(1, 5) as $i) {
            $this->postJson('/api/v1/auth/partner/register', [
                'role' => 'delivery_partner',
                'phone' => '9000000802',
            ])->assertStatus(422);
        }

        $blocked = $this->postJson('/api/v1/auth/partner/register', [
            'role' => 'delivery_partner',
            'phone' => '9000000802',
        ]);

        $blocked->assertStatus(429);
    }

    public function test_vendor_register_endpoint_is_rate_limited(): void
    {
        foreach (range(1, 5) as $i) {
            $this->postJson('/api/v1/auth/vendor/register', [
                'vendor_type' => 'restaurant',
                'phone' => '9000000803',
            ])->assertStatus(422);
        }

        $blocked = $this->postJson('/api/v1/auth/vendor/register', [
            'vendor_type' => 'restaurant',
            'phone' => '9000000803',
        ]);

        $blocked->assertStatus(429);
    }

    public function test_logout_revokes_only_the_current_token(): void
    {
        $user = User::factory()->create(['phone' => '9000000901', 'email' => 'session.cut@example.com', 'user_type' => 'customer']);

        $firstToken = $user->createToken('first')->plainTextToken;
        $secondToken = $user->createToken('second')->plainTextToken;

        $this->withToken($firstToken)->postJson('/api/v1/auth/logout')->assertOk();

        $this->assertSame(1, $user->tokens()->count());

        $secondPlain = (string) Str::of($secondToken)->after('|');
        $this->assertTrue($user->tokens()->where('token', hash('sha256', $secondPlain))->exists());

        $firstPlain = (string) Str::of($firstToken)->after('|');
        $this->assertTrue($user->tokens()->where('token', hash('sha256', $firstPlain))->doesntExist());
    }

    public function test_driver_endpoints_reject_non_driver_roles(): void
    {
        $this->getJson('/api/v1/driver/profile')->assertStatus(401);

        $customer = User::factory()->create(['phone' => '9000001001', 'email' => 'role.customer@example.com', 'user_type' => 'customer']);
        $customer->roles()->attach(Role::where('slug', 'customer')->first());
        $this->assertRoleDenied($customer, '/api/v1/driver/profile');

        $vendor = User::factory()->create(['phone' => '9000001002', 'email' => 'role.vendor@example.com', 'user_type' => 'vendor']);
        $vendor->roles()->attach(Role::where('slug', 'vendor')->first());
        $this->assertRoleDenied($vendor, '/api/v1/driver/profile');

        $driver = User::factory()->create(['phone' => '9000001003', 'email' => 'role.driver@example.com', 'user_type' => 'driver']);
        $driver->roles()->attach(Role::where('slug', 'driver')->first());
        Driver::create(['user_id' => $driver->id, 'status' => 'approved']);

        Sanctum::actingAs($driver, ['*']);
        $this->getJson('/api/v1/driver/profile')->assertOk();
    }

    public function test_delivery_partner_endpoints_reject_other_roles(): void
    {
        $customer = User::factory()->create(['phone' => '9000001101', 'email' => 'partner.role.customer@example.com', 'user_type' => 'customer']);
        $customer->roles()->attach(Role::where('slug', 'customer')->first());
        $this->assertRoleDenied($customer, '/api/v1/delivery-partner/profile');

        $vendor = User::factory()->create(['phone' => '9000001102', 'email' => 'partner.role.vendor@example.com', 'user_type' => 'vendor']);
        $vendor->roles()->attach(Role::where('slug', 'vendor')->first());
        $this->assertRoleDenied($vendor, '/api/v1/delivery-partner/profile');

        $driver = User::factory()->create(['phone' => '9000001103', 'email' => 'partner.role.driver@example.com', 'user_type' => 'driver']);
        $driver->roles()->attach(Role::where('slug', 'driver')->first());
        $this->assertRoleDenied($driver, '/api/v1/delivery-partner/profile');

        $partner = User::factory()->create(['phone' => '9000001104', 'email' => 'partner.role.partner@example.com', 'user_type' => 'delivery_partner']);
        $partner->roles()->attach(Role::where('slug', 'delivery_partner')->first());
        DeliveryPartner::create(['user_id' => $partner->id, 'status' => 'approved', 'service_type' => 'food']);

        Sanctum::actingAs($partner, ['*']);
        $this->getJson('/api/v1/delivery-partner/profile')->assertOk();
    }

    public function test_phone_and_password_login_succeeds(): void
    {
        User::factory()->create([
            'name' => 'Password User',
            'phone' => '9000001201',
            'email' => 'password.login@example.com',
            'user_type' => 'customer',
            'password' => 'secret123',
        ]);

        $response = $this->postJson('/api/v1/auth/login', [
            'phone' => '9000001201',
            'password' => 'secret123',
        ]);

        $response->assertOk()->assertJsonPath('success', true);
        $response->assertJsonStructure(['data' => ['token', 'user' => ['id']]]);
        $this->assertNotEmpty($response->json('data.token'));
        $this->assertSame(1, User::where('phone', '9000001201')->first()->id);
    }

    public function test_disabled_account_cannot_login(): void
    {
        User::factory()->create([
            'phone' => '9000001301',
            'email' => 'disabled.login@example.com',
            'user_type' => 'customer',
            'password' => 'secret123',
            'is_active' => false,
        ]);

        $response = $this->postJson('/api/v1/auth/login', [
            'phone' => '9000001301',
            'password' => 'secret123',
        ]);

        $response->assertStatus(401)->assertJsonPath('message', 'Account is not active');
    }

    public function test_banned_account_cannot_login(): void
    {
        User::factory()->create([
            'phone' => '9000001302',
            'email' => 'banned.login@example.com',
            'user_type' => 'customer',
            'password' => 'secret123',
            'is_active' => true,
            'banned_at' => now(),
        ]);

        $response = $this->postJson('/api/v1/auth/login', [
            'phone' => '9000001302',
            'password' => 'secret123',
        ]);

        $response->assertStatus(401)->assertJsonPath('message', 'Account is not active');
    }

    public function test_soft_deleted_account_blocks_registration(): void
    {
        $deleted = User::factory()->create(['name' => 'Gone', 'phone' => '9000001401', 'email' => 'ghost@example.com', 'user_type' => 'customer']);
        $deleted->delete();

        $response = $this->postJson('/api/v1/auth/register', [
            'name' => 'Reviver',
            'phone' => $deleted->phone,
            'email' => 'reviver@example.com',
            'password' => 'secret123',
            'password_confirmation' => 'secret123',
        ]);

        $response->assertStatus(422)->assertJsonPath('message', AuthService::ACCOUNT_ALREADY_EXISTS_MESSAGE);
        $this->assertSame(1, User::withTrashed()->where('phone', '9000001401')->count());
    }

    public function test_database_rejects_a_second_profile_for_the_same_user(): void
    {
        $user = User::factory()->create(['phone' => '9000001501', 'email' => 'backstop@example.com', 'user_type' => 'vendor']);

        Vendor::create([
            'user_id' => $user->id,
            'business_name' => 'First Business',
            'vendor_type' => 'restaurant',
            'owner_name' => 'Owner',
            'phone' => '9000001501',
            'email' => 'backstop@example.com',
            'status' => 'pending',
        ]);

        $this->expectException(QueryException::class);

        DB::table('vendors')->insert([
            'user_id' => $user->id,
            'business_name' => 'Second Business',
            'vendor_type' => 'restaurant',
            'owner_name' => 'Owner',
            'phone' => '9000001501',
            'email' => 'backstop@example.com',
            'status' => 'pending',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function assertRoleDenied(User $user, string $path): void
    {
        Sanctum::actingAs($user, ['*']);

        $this->getJson($path)->assertStatus(403)->assertJsonPath('message', 'You do not have permission to perform this action.');
    }

    private function createOtp(
        string $phone,
        string $plainOtp = self::OTP,
        int $attempts = 0,
        string $token = 'test-token'
    ): OtpCode {
        return OtpCode::create([
            'phone' => $phone,
            'otp' => bcrypt($plainOtp),
            'purpose' => 'login',
            'token' => $token,
            'attempts' => $attempts,
            'expires_at' => now()->addMinutes(10),
        ]);
    }

    private function partnerPayload(string $role, array $overrides = []): array
    {
        if ($role === 'driver' && VehicleType::doesntExist()) {
            VehicleType::create(['name' => 'Cab (Mini)', 'code' => 'cab_mini']);
        }

        $payload = [
            'role' => $role,
            'name' => 'Applicant Name',
            'email' => 'applicant.'.Str::random(6).'@example.com',
            'phone' => '9090909090',
            'password' => 'secret123',
            'vehicle_number' => 'KA-01-AB-1234',
            'license_number' => 'DL-99999999',
            'license_expiry' => now()->addYear()->toDateString(),
            'aadhar_number' => '111122223333',
        ];

        if ($role === 'driver') {
            $payload['vehicle_type_id'] = VehicleType::first()->id;
        } else {
            $payload['vehicle_type'] = 'bike';
            $payload['service_type'] = 'food';
            $payload['zone_id'] = Zone::firstOrCreate(
                ['code' => 'IDENTITY-ZONE'],
                [
                    'name' => 'Identity Zone',
                    'type' => 'multi',
                    'city' => 'Bengaluru',
                    'country' => 'IN',
                    'food_enabled' => true,
                    'grocery_enabled' => true,
                    'ride_enabled' => true,
                    'priority' => 10,
                    'is_active' => true,
                ]
            )->id;
        }

        return array_merge($payload, $overrides);
    }

    private function vendorPayload(array $overrides = []): array
    {
        return array_merge([
            'vendor_type' => 'restaurant',
            'business_name' => 'Bonus Bites',
            'owner_name' => 'Owner Name',
            'email' => 'vendor.'.Str::random(6).'@example.com',
            'phone' => '9191919191',
            'password' => 'secret123',
            'fssai_number' => '11223344556678',
            'avg_prep_time_min' => 20,
            'opens_at' => '09:00',
            'closes_at' => '22:00',
        ], $overrides);
    }
}
