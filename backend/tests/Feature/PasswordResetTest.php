<?php

namespace Tests\Feature;

use App\Mail\SmtpTestMail;
use App\Models\IntegrationSetting;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use App\Notifications\ResetPasswordNotification;
use App\Services\PasswordResetService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;
use Tests\TestCase;

class PasswordResetTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config(['integrations.mode' => 'test']);
        Cache::flush();
    }

    /**
     * Store a usable SMTP configuration so the mail path is "enabled". The
     * array mailer is used, so nothing is actually delivered.
     */
    protected function enableSmtp(): void
    {
        IntegrationSetting::query()->updateOrCreate(['service' => 'smtp'], [
            'provider' => 'smtp',
            'environment' => 'test',
            'is_enabled' => true,
            'credentials' => [
                'host' => 'smtp.example.com',
                'port' => '587',
                'encryption' => 'tls',
                'username' => 'mailer@example.com',
                'password' => 'super-secret-password',
                'from_email' => 'no-reply@example.com',
                'from_name' => 'Super App',
            ],
        ]);

        Cache::flush();
    }

    public function test_forgot_password_returns_the_same_generic_message_for_known_and_unknown_emails(): void
    {
        Mail::fake();
        $this->enableSmtp();

        User::factory()->create(['email' => 'known@example.com', 'password' => Hash::make('OldPassw0rd!')]);

        $known = $this->postJson('/api/v1/auth/forgot-password', ['email' => 'known@example.com']);
        $unknown = $this->postJson('/api/v1/auth/forgot-password', ['email' => 'nobody@example.com']);

        $known->assertOk();
        $unknown->assertOk();

        // Byte-identical: the response cannot be used to enumerate accounts.
        $this->assertSame($known->json('message'), $unknown->json('message'));
        $this->assertSame(PasswordResetService::GENERIC_MESSAGE, $known->json('message'));
    }

    public function test_forgot_password_does_not_mail_google_only_or_otp_only_accounts(): void
    {
        Mail::fake();
        $this->enableSmtp();

        User::factory()->create([
            'email' => 'google-only@example.com',
            'password' => null,
            'auth_provider' => 'google',
            'google_sub' => 'google-sub-123',
        ]);

        $response = $this->postJson('/api/v1/auth/forgot-password', ['email' => 'google-only@example.com']);

        // Still the generic message, but no reset token is ever created.
        $response->assertOk();
        $this->assertSame(PasswordResetService::GENERIC_MESSAGE, $response->json('message'));
        $this->assertDatabaseCount('password_reset_tokens', 0);
    }

    public function test_forgot_password_reports_service_unavailable_when_smtp_is_disabled(): void
    {
        Mail::fake();

        // No SMTP row at all -> the integration falls back to its mock provider.
        $response = $this->postJson('/api/v1/auth/forgot-password', ['email' => 'someone@example.com']);

        $response->assertStatus(503);
        $this->assertStringContainsString('unavailable', $response->json('message'));
    }

    public function test_forgot_password_stores_only_a_hashed_token(): void
    {
        Notification::fake();
        $this->enableSmtp();

        User::factory()->create(['email' => 'hashed@example.com', 'password' => Hash::make('OldPassw0rd!')]);

        $this->postJson('/api/v1/auth/forgot-password', ['email' => 'hashed@example.com'])->assertOk();

        $row = DB::table('password_reset_tokens')->where('email', 'hashed@example.com')->first();
        $this->assertNotNull($row);

        // Recover the raw token from the notification the broker was asked to send.
        $rawToken = null;
        Notification::assertSentTo(
            User::where('email', 'hashed@example.com')->first(),
            ResetPasswordNotification::class,
            function ($notification) use (&$rawToken) {
                $rawToken = $notification->token;

                return true;
            }
        );

        $this->assertNotNull($rawToken);

        // The raw token is never persisted; only a one-way hash of it is.
        $this->assertNotSame($rawToken, $row->token);
        $this->assertTrue(Hash::check($rawToken, $row->token));
    }

    public function test_reset_password_updates_credentials_and_invalidates_sessions(): void
    {
        Notification::fake();
        $this->enableSmtp();

        $user = User::factory()->create([
            'email' => 'reset@example.com',
            'password' => Hash::make('OldPassw0rd!'),
        ]);
        $user->createToken('device-a')->plainTextToken;
        $user->createToken('device-b')->plainTextToken;

        $this->assertSame(2, $user->tokens()->count());

        $token = Password::broker()->createToken($user);

        $response = $this->postJson('/api/v1/auth/reset-password', [
            'token' => $token,
            'email' => 'reset@example.com',
            'password' => 'BrandNewPassw0rd!',
            'password_confirmation' => 'BrandNewPassw0rd!',
        ]);

        $response->assertOk();

        $user->refresh();

        // Securely hashed, and the new password works for login.
        $this->assertNotSame('BrandNewPassw0rd!', $user->password);
        $this->assertTrue(Hash::check('BrandNewPassw0rd!', $user->password));

        // Existing sessions revoked.
        $this->assertSame(0, $user->tokens()->count());

        // Token is single-use.
        $this->assertDatabaseCount('password_reset_tokens', 0);

        $this->postJson('/api/v1/auth/reset-password', [
            'token' => $token,
            'email' => 'reset@example.com',
            'password' => 'AnotherPassw0rd!',
            'password_confirmation' => 'AnotherPassw0rd!',
        ])->assertStatus(422);
    }

    public function test_login_works_with_the_new_password_after_reset(): void
    {
        Notification::fake();
        $this->enableSmtp();

        $user = User::factory()->create([
            'email' => 'relogin@example.com',
            'password' => Hash::make('OldPassw0rd!'),
        ]);

        $token = Password::broker()->createToken($user);

        $this->postJson('/api/v1/auth/reset-password', [
            'token' => $token,
            'email' => 'relogin@example.com',
            'password' => 'BrandNewPassw0rd!',
            'password_confirmation' => 'BrandNewPassw0rd!',
        ])->assertOk();

        $login = $this->postJson('/api/v1/auth/login/email', [
            'email' => 'relogin@example.com',
            'password' => 'BrandNewPassw0rd!',
        ]);

        $login->assertOk();
        $this->assertNotEmpty($login->json('data.token'));
    }

    public function test_reset_rejects_invalid_and_mismatched_input(): void
    {
        Notification::fake();
        $this->enableSmtp();

        $user = User::factory()->create(['email' => 'strict@example.com', 'password' => Hash::make('OldPassw0rd!')]);

        // Unknown token.
        $this->postJson('/api/v1/auth/reset-password', [
            'token' => 'not-a-real-token',
            'email' => 'strict@example.com',
            'password' => 'BrandNewPassw0rd!',
            'password_confirmation' => 'BrandNewPassw0rd!',
        ])->assertStatus(422);

        // Confirmation mismatch.
        $this->postJson('/api/v1/auth/reset-password', [
            'token' => Password::broker()->createToken($user),
            'email' => 'strict@example.com',
            'password' => 'BrandNewPassw0rd!',
            'password_confirmation' => 'DifferentPassw0rd!',
        ])->assertStatus(422);

        // Below the application minimum length.
        $this->postJson('/api/v1/auth/reset-password', [
            'token' => Password::broker()->createToken($user),
            'email' => 'strict@example.com',
            'password' => 'short',
            'password_confirmation' => 'short',
        ])->assertStatus(422);

        $this->assertTrue(Hash::check('OldPassw0rd!', $user->fresh()->password));
    }

    public function test_smtp_password_is_never_exposed_to_any_client(): void
    {
        $this->enableSmtp();
        $admin = $this->actingAsSuperAdmin();

        $detail = $this->actingAs($admin, 'sanctum')
            ->getJson('/api/v1/admin/integrations/smtp')
            ->assertOk()
            ->json('data');

        // The admin UI receives only a masked hint, never the secret itself.
        $this->assertTrue($detail['credentials']['password']['configured']);
        $this->assertStringNotContainsString(
            'super-secret-password',
            json_encode($detail)
        );
        $this->assertNotSame('super-secret-password', $detail['credentials']['password']['masked'] ?? null);

        // public_keys is an allow-list and SMTP declares none of its fields.
        $this->assertSame([], $detail['public_keys']);

        // The public app-config must never carry SMTP data at all.
        $appConfig = $this->getJson('/api/v1/app-config')->assertOk()->json('data');
        $this->assertArrayNotHasKey('smtp', $appConfig);
        $this->assertStringNotContainsString('super-secret-password', json_encode($appConfig));
    }

    public function test_smtp_test_email_is_addressed_to_the_supplied_recipient(): void
    {
        Mail::fake();
        $this->enableSmtp();
        $admin = $this->actingAsSuperAdmin();

        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/v1/admin/integrations/smtp/test', [
                'email' => 'cgauravsinghal@gmail.com',
            ])
            ->assertOk()
            ->assertJsonPath('data.recipient', 'cgauravsinghal@gmail.com')
            ->assertJsonPath('message', 'Test email sent successfully.');

        // A mailable without a To header throws "An email must have a To, Cc
        // or Bcc header", which is what made the admin test fail while the
        // customer reset email worked.
        Mail::assertSent(SmtpTestMail::class, function (SmtpTestMail $mail): bool {
            $envelope = $mail->envelope();

            return $mail->hasTo('cgauravsinghal@gmail.com')
                && $envelope->subject === 'SMTP Test Email'
                // Exactly one addressee: a bare Address object passed to
                // Envelope::to would be spread into a null second recipient.
                && count($envelope->to) === 1
                && $envelope->cc === []
                && $envelope->bcc === [];
        });
    }

    public function test_smtp_test_email_requires_a_recipient(): void
    {
        Mail::fake();
        $this->enableSmtp();
        $admin = $this->actingAsSuperAdmin();

        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/v1/admin/integrations/smtp/test', [])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['email']);

        Mail::assertNothingSent();
    }

    public function test_smtp_test_email_response_never_contains_credentials(): void
    {
        Mail::fake();
        $this->enableSmtp();
        $admin = $this->actingAsSuperAdmin();

        $response = $this->actingAs($admin, 'sanctum')
            ->postJson('/api/v1/admin/integrations/smtp/test', [
                'email' => 'ops@example.com',
            ])
            ->assertOk();

        $body = $response->getContent();
        $this->assertStringNotContainsString('super-secret-password', (string) $body);
        $this->assertStringNotContainsString('mailer@example.com', (string) $body);
    }

    public function test_smtp_settings_require_admin_access(): void
    {
        $this->enableSmtp();

        $customer = User::factory()->create(['user_type' => 'customer']);

        $this->actingAs($customer, 'sanctum')
            ->getJson('/api/v1/admin/integrations/smtp')
            ->assertForbidden();
    }

    public function test_smtp_password_is_encrypted_at_rest(): void
    {
        $this->enableSmtp();

        $raw = DB::table('integration_settings')->where('service', 'smtp')->value('credentials');

        $this->assertStringNotContainsString('super-secret-password', (string) $raw);
    }

    public function test_smtp_save_requires_host_and_port_when_enabled(): void
    {
        $admin = $this->actingAsSuperAdmin();

        $this->actingAs($admin, 'sanctum')
            ->putJson('/api/v1/admin/integrations/smtp', [
                'is_enabled' => true,
                'environment' => 'test',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['host', 'port', 'from_email', 'from_name']);
    }

    public function test_smtp_password_can_be_kept_when_editing(): void
    {
        $this->enableSmtp();
        $admin = $this->actingAsSuperAdmin();

        // Omitting the password must preserve the stored secret.
        $this->actingAs($admin, 'sanctum')
            ->putJson('/api/v1/admin/integrations/smtp', [
                'is_enabled' => true,
                'environment' => 'live',
                'host' => 'smtp.newhost.com',
            ])
            ->assertOk();

        $credentials = IntegrationSetting::query()->where('service', 'smtp')->first()->credentials;

        $this->assertSame('smtp.newhost.com', $credentials['host']);
        $this->assertSame('super-secret-password', $credentials['password']);
    }

    public function test_encryption_must_be_a_supported_value(): void
    {
        $this->enableSmtp();
        $admin = $this->actingAsSuperAdmin();

        $this->actingAs($admin, 'sanctum')
            ->putJson('/api/v1/admin/integrations/smtp', [
                'is_enabled' => true,
                'encryption' => 'rot13',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['encryption']);
    }

    protected function actingAsSuperAdmin(): User
    {
        $role = Role::query()->firstOrCreate(
            ['slug' => 'super_admin'],
            ['name' => 'Super Admin', 'is_system' => true]
        );

        $permissions = [
            'integrations.view', 'integrations.update',
        ];
        foreach ($permissions as $slug) {
            $permission = Permission::query()->firstOrCreate(
                ['slug' => $slug],
                ['name' => $slug, 'module' => 'integrations']
            );
            $role->permissions()->syncWithoutDetaching([$permission->id]);
        }

        $admin = User::factory()->create(['user_type' => 'admin', 'email' => 'admin@example.com']);
        $admin->roles()->syncWithoutDetaching([$role->id]);

        return $admin->fresh();
    }
}
