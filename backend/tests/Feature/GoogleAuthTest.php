<?php

namespace Tests\Feature;

use App\Models\IntegrationSetting;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use App\Services\Integration\GoogleIdTokenVerifier;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class GoogleAuthTest extends TestCase
{
    use RefreshDatabase;

    private const CLIENT_ID = '123456789-abcdefghij.apps.googleusercontent.com';

    private const CLIENT_SECRET = 'GOCSPX-SuperSecretValueDoNotLeak';

    private const KID = 'test-signing-key-1';

    private string $privateKey = '';

    protected function setUp(): void
    {
        parent::setUp();

        config(['integrations.mode' => 'test']);
        Cache::flush();

        $key = openssl_pkey_new([
            'private_key_bits' => 2048,
            'private_key_type' => OPENSSL_KEYTYPE_RSA,
        ]);
        $details = openssl_pkey_get_details($key);
        openssl_pkey_export($key, $this->privateKey);

        $this->fakeJwks($this->jwkFromDetails($details, self::KID));
    }

    // ---------------------------------------------------------------- helpers

    private function jwkFromDetails(array $details, string $kid): array
    {
        return [
            'kty' => 'RSA',
            'alg' => 'RS256',
            'use' => 'sig',
            'kid' => $kid,
            'n' => self::b64u($details['rsa']['n']),
            'e' => self::b64u($details['rsa']['e']),
        ];
    }

    private function fakeJwks(array $jwk): void
    {
        Http::fake([
            GoogleIdTokenVerifier::JWKS_URL => Http::response(['keys' => [$jwk]]),
        ]);
    }

    private function claims(array $overrides = []): array
    {
        return array_merge([
            'iss' => 'https://accounts.google.com',
            'aud' => self::CLIENT_ID,
            'sub' => 'google-sub-123',
            'email' => 'customer@example.com',
            'email_verified' => true,
            'name' => 'Google Customer',
            'picture' => 'https://lh3.googleusercontent.com/a/avatar',
            'iat' => time() - 10,
            'exp' => time() + 3600,
        ], $overrides);
    }

    private function signJwt(array $claims, array $headerOverrides = [], ?string $privateKey = null): string
    {
        $header = array_merge([
            'alg' => 'RS256',
            'typ' => 'JWT',
            'kid' => self::KID,
        ], $headerOverrides);

        $signingInput = self::b64u((string) json_encode($header, JSON_UNESCAPED_SLASHES))
            .'.'.self::b64u((string) json_encode($claims, JSON_UNESCAPED_SLASHES));

        $signature = '';
        openssl_sign($signingInput, $signature, $privateKey ?? $this->privateKey, OPENSSL_ALGO_SHA256);

        return $signingInput.'.'.self::b64u($signature);
    }

    private function enableGoogle(array $credentials = [], bool $isEnabled = true): void
    {
        IntegrationSetting::create([
            'service' => 'google_oauth',
            'provider' => 'google',
            'environment' => 'test',
            'is_enabled' => $isEnabled,
            'credentials' => array_merge([
                'client_id' => self::CLIENT_ID,
                'client_secret' => self::CLIENT_SECRET,
            ], $credentials),
        ]);

        Cache::flush();
    }

    private function postCredential(string $credential)
    {
        return $this->postJson('/api/v1/auth/google', ['credential' => $credential]);
    }

    private static function b64u(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    private function superAdminHeaders(): array
    {
        $role = Role::updateOrCreate(['slug' => 'super_admin'], ['name' => 'Super Admin', 'is_system' => true]);
        foreach (['integrations.view', 'integrations.update'] as $slug) {
            Permission::updateOrCreate(['slug' => $slug], ['name' => ucfirst($slug), 'module' => 'integrations']);
        }
        $role->permissions()->sync(Permission::pluck('id'));

        $admin = User::create([
            'name' => 'Integration Admin',
            'email' => 'admin@example.com',
            'phone' => '9999999999',
            'password' => Hash::make('secret'),
            'user_type' => 'super_admin',
            'is_active' => true,
        ]);
        $admin->roles()->sync([$role->id]);

        return ['Authorization' => 'Bearer '.$admin->createToken('test')->plainTextToken];
    }

    // ------------------------------------------------------- happy path flows

    public function test_new_google_customer_is_created_and_authenticated(): void
    {
        $this->enableGoogle();

        $res = $this->postCredential($this->signJwt($this->claims()));

        $res->assertOk()->assertJsonPath('success', true);

        $this->assertNotEmpty($res->json('data.token'));
        $this->assertSame('customer@example.com', $res->json('data.user.email'));
        $this->assertSame('Google Customer', $res->json('data.user.name'));
        $this->assertSame('customer', $res->json('data.user.user_type'));

        $user = User::where('email', 'customer@example.com')->firstOrFail();
        $this->assertSame('google-sub-123', $user->google_sub);
        $this->assertSame('google', $user->auth_provider);
        $this->assertNotNull($user->email_verified_at);
        $this->assertTrue($user->is_verified);
        $this->assertNull($user->password, 'Google accounts must not be given a password.');

        $this->assertDatabaseHas('wallets', [
            'user_id' => $user->id,
            'wallet_type' => 'customer',
        ]);
    }

    public function test_auth_response_never_leaks_the_client_secret(): void
    {
        $this->enableGoogle();

        $res = $this->postCredential($this->signJwt($this->claims()));

        $res->assertOk();
        $this->assertStringNotContainsString(self::CLIENT_SECRET, (string) $res->getContent());
        $this->assertStringNotContainsString(self::CLIENT_SECRET, (string) json_encode($res->json('data.user')));
    }

    public function test_existing_google_customer_logs_in_without_creating_a_duplicate(): void
    {
        $this->enableGoogle();

        $first = $this->postCredential($this->signJwt($this->claims()));
        $first->assertOk();
        $firstId = $first->json('data.user.id');

        $second = $this->postCredential($this->signJwt($this->claims()));
        $second->assertOk();

        $this->assertSame($firstId, $second->json('data.user.id'));
        $this->assertSame(1, User::where('google_sub', 'google-sub-123')->count());
    }

    public function test_existing_google_customer_links_to_password_account_with_verified_email(): void
    {
        $this->enableGoogle();

        $existing = User::create([
            'name' => 'Password Customer',
            'email' => 'customer@example.com',
            'phone' => '9000000001',
            'password' => Hash::make('secret123'),
            'auth_provider' => 'password',
            'user_type' => 'customer',
            'is_active' => true,
        ]);

        $res = $this->postCredential($this->signJwt($this->claims()));

        $res->assertOk();
        $this->assertSame($existing->id, $res->json('data.user.id'));
        $this->assertSame(1, User::where('email', 'customer@example.com')->count());

        $existing->refresh();
        $this->assertSame('google-sub-123', $existing->google_sub);
        $this->assertSame('password', $existing->auth_provider, 'Linking must not rewrite the original sign-up method.');
        $this->assertNotNull($existing->password, 'The existing password must be left intact.');
    }

    public function test_a_google_linked_password_account_can_still_use_password_login(): void
    {
        $this->enableGoogle();

        $existing = User::create([
            'name' => 'Password Customer',
            'email' => 'customer@example.com',
            'phone' => '9000000001',
            'password' => Hash::make('secret123'),
            'auth_provider' => 'password',
            'user_type' => 'customer',
            'is_active' => true,
        ]);

        $this->postCredential($this->signJwt($this->claims()))->assertOk();

        $this->postJson('/api/v1/auth/login/email', [
            'email' => 'customer@example.com',
            'password' => 'secret123',
        ])->assertOk()->assertJsonPath('data.user.id', $existing->id);
    }

    public function test_a_google_only_account_cannot_log_in_with_a_password(): void
    {
        $this->enableGoogle();

        $this->postCredential($this->signJwt($this->claims()))->assertOk();

        $this->postJson('/api/v1/auth/login/email', [
            'email' => 'customer@example.com',
            'password' => 'secret123',
        ])->assertStatus(401);
    }

    // --------------------------------------------------------- token rejection

    public function test_token_audience_must_match_the_configured_client_id(): void
    {
        $this->enableGoogle();

        $this->postCredential($this->signJwt($this->claims(['aud' => 'someone-else.apps.googleusercontent.com'])))
            ->assertStatus(401);
    }

    public function test_token_from_an_untrusted_issuer_is_rejected(): void
    {
        $this->enableGoogle();

        $this->postCredential($this->signJwt($this->claims(['iss' => 'https://evil.example.com'])))
            ->assertStatus(401);
    }

    public function test_expired_token_is_rejected(): void
    {
        $this->enableGoogle();

        $res = $this->postCredential($this->signJwt($this->claims([
            'iat' => time() - 7200,
            'exp' => time() - 3600,
        ])));

        $res->assertStatus(401)->assertJsonPath('message', 'Your Google session has expired. Please sign in again.');
    }

    public function test_token_signed_by_a_different_key_is_rejected(): void
    {
        $this->enableGoogle();

        $attacker = openssl_pkey_new([
            'private_key_bits' => 2048,
            'private_key_type' => OPENSSL_KEYTYPE_RSA,
        ]);
        $attackerPem = '';
        openssl_pkey_export($attacker, $attackerPem);

        $this->postCredential($this->signJwt($this->claims(), [], $attackerPem))
            ->assertStatus(401);
    }

    public function test_unsigned_algorithm_none_token_is_rejected(): void
    {
        $this->enableGoogle();

        $res = $this->postCredential($this->signJwt($this->claims(), ['alg' => 'none']));

        $res->assertStatus(401);
        $this->assertDatabaseCount('users', 0);
    }

    public function test_browser_supplied_profile_fields_without_a_valid_token_are_ignored(): void
    {
        $this->enableGoogle();

        // A forged body claiming an identity, with no real credential.
        $this->postJson('/api/v1/auth/google', [
            'email' => 'victim@example.com',
            'sub' => 'attacker-sub',
            'name' => 'Attacker',
        ])->assertStatus(422);

        $this->assertDatabaseMissing('users', ['email' => 'victim@example.com']);
    }

    public function test_credential_is_required(): void
    {
        $this->enableGoogle();

        $this->postJson('/api/v1/auth/google', [])
            ->assertStatus(422)
            ->assertJsonPath('errors.credential.0', 'The credential field is required.');
    }

    // ----------------------------------------------------- account-linking rules

    public function test_unverified_google_email_cannot_take_over_an_existing_account(): void
    {
        $this->enableGoogle();

        $existing = User::create([
            'name' => 'Victim',
            'email' => 'customer@example.com',
            'phone' => '9000000002',
            'password' => Hash::make('secret123'),
            'user_type' => 'customer',
            'is_active' => true,
        ]);

        $res = $this->postCredential($this->signJwt($this->claims(['email_verified' => false])));

        $res->assertStatus(401);
        $this->assertNull($existing->fresh()->google_sub, 'An unverified email must never link an identity.');
        $this->assertSame(1, User::where('email', 'customer@example.com')->count());
    }

    public function test_unverified_google_email_cannot_create_a_new_account(): void
    {
        $this->enableGoogle();

        $this->postCredential($this->signJwt($this->claims(['email_verified' => false])))
            ->assertStatus(401);

        $this->assertDatabaseMissing('users', ['email' => 'customer@example.com']);
    }

    public function test_google_sign_in_never_links_to_a_non_customer_account(): void
    {
        $this->enableGoogle();

        $vendor = User::create([
            'name' => 'Vendor Owner',
            'email' => 'owner@example.com',
            'phone' => '9000000003',
            'password' => Hash::make('secret123'),
            'user_type' => 'vendor',
            'is_active' => true,
        ]);

        $res = $this->postCredential($this->signJwt($this->claims(['email' => 'owner@example.com'])));

        $res->assertStatus(401)
            ->assertJsonPath('message', 'This email is already in use by a non-customer account. Google sign-in is only available for customer accounts.');

        $this->assertNull($vendor->fresh()->google_sub);
    }

    public function test_a_second_google_account_cannot_reclaim_a_linked_email(): void
    {
        $this->enableGoogle();

        $this->postCredential($this->signJwt($this->claims()))->assertOk();

        $res = $this->postCredential($this->signJwt($this->claims(['sub' => 'different-google-sub'])));

        $res->assertStatus(401)
            ->assertJsonPath('message', 'A different Google account is already linked to this profile. Please sign in with your password to continue.');

        $this->assertSame(1, User::where('email', 'customer@example.com')->count());
    }

    public function test_banned_account_cannot_sign_in_with_google(): void
    {
        $this->enableGoogle();

        User::create([
            'name' => 'Banned',
            'email' => 'banned@example.com',
            'google_sub' => 'google-sub-123',
            'user_type' => 'customer',
            'is_active' => false,
            'banned_at' => now(),
        ]);

        $this->postCredential($this->signJwt($this->claims(['email' => 'banned@example.com'])))
            ->assertStatus(401)
            ->assertJsonPath('message', 'Account is not active');
    }

    // ------------------------------------------------------ enable/disable/config

    public function test_google_sign_in_is_rejected_when_the_integration_is_disabled(): void
    {
        $this->enableGoogle(isEnabled: false);

        $res = $this->postCredential($this->signJwt($this->claims()));

        $res->assertStatus(401)->assertJsonPath('message', 'Google sign-in is not available right now.');
        $this->assertDatabaseCount('users', 0);
    }

    public function test_google_sign_in_is_rejected_when_the_client_id_is_missing(): void
    {
        $this->enableGoogle(['client_id' => '']);

        $res = $this->postCredential($this->signJwt($this->claims()));

        $res->assertStatus(401)->assertJsonPath('message', 'Google sign-in is not available right now.');
    }

    public function test_google_sign_in_fails_gracefully_when_never_configured(): void
    {
        $res = $this->postCredential($this->signJwt($this->claims()));

        $res->assertStatus(401)->assertJsonPath('success', false);
        $this->assertStringNotContainsString('googleapis', (string) $res->getContent());
        $this->assertStringNotContainsString('openssl', strtolower((string) $res->getContent()));
    }

    public function test_app_config_exposes_the_client_id_but_never_the_client_secret(): void
    {
        $this->enableGoogle();

        $res = $this->getJson('/api/v1/app-config');

        $res->assertOk();
        $this->assertTrue($res->json('data.google.enabled'));
        $this->assertSame('google', $res->json('data.google.provider'));
        $this->assertSame(self::CLIENT_ID, $res->json('data.google.client_id'));

        $body = (string) $res->getContent();
        $this->assertStringNotContainsString(self::CLIENT_SECRET, $body);
        $this->assertStringNotContainsString('client_secret', $body);
    }

    public function test_app_config_disables_google_when_the_integration_is_off(): void
    {
        $this->enableGoogle(isEnabled: false);

        $res = $this->getJson('/api/v1/app-config');

        $res->assertOk();
        $this->assertFalse($res->json('data.google.enabled'));
        $this->assertNull($res->json('data.google.client_id'));
    }

    public function test_admin_can_save_google_credentials_and_the_secret_is_masked(): void
    {
        $headers = $this->superAdminHeaders();

        $res = $this->putJson('/api/v1/admin/integrations/google_oauth', [
            'provider' => 'google',
            'environment' => 'test',
            'is_enabled' => true,
            'client_id' => self::CLIENT_ID,
            'client_secret' => self::CLIENT_SECRET,
        ], $headers);

        $res->assertOk()->assertJsonPath('success', true);

        $row = IntegrationSetting::where('service', 'google_oauth')->firstOrFail();
        $this->assertSame(self::CLIENT_ID, $row->credentials['client_id']);
        $this->assertSame(self::CLIENT_SECRET, $row->credentials['client_secret']);

        $body = (string) $res->getContent();
        $this->assertStringNotContainsString(self::CLIENT_SECRET, $body);
        $this->assertStringContainsString('****', $res->json('data.credentials.client_secret.masked'));
    }

    public function test_admin_resubmitting_the_mask_keeps_the_stored_secret(): void
    {
        $headers = $this->superAdminHeaders();
        $this->enableGoogle();

        $res = $this->putJson('/api/v1/admin/integrations/google_oauth', [
            'is_enabled' => true,
            'client_secret' => '****',
        ], $headers);

        $res->assertOk();
        $this->assertSame(
            self::CLIENT_SECRET,
            IntegrationSetting::where('service', 'google_oauth')->firstOrFail()->credentials['client_secret']
        );
    }

    public function test_client_secret_is_encrypted_at_rest(): void
    {
        $this->enableGoogle();

        $raw = DB::table('integration_settings')
            ->where('service', 'google_oauth')
            ->value('credentials');

        $this->assertIsString($raw);
        $this->assertStringNotContainsString(self::CLIENT_SECRET, $raw);
    }

    public function test_admin_connection_test_does_not_claim_a_sign_in_was_verified(): void
    {
        $headers = $this->superAdminHeaders();
        $this->enableGoogle();

        $res = $this->postJson('/api/v1/admin/integrations/google_oauth/test', [], $headers);

        $res->assertOk()->assertJsonPath('success', true);
        $this->assertStringContainsString('Configuration saved', $res->json('data.message'));
        $this->assertStringNotContainsString(self::CLIENT_SECRET, (string) $res->getContent());
    }

    public function test_admin_connection_test_reports_missing_client_id(): void
    {
        $headers = $this->superAdminHeaders();
        $this->enableGoogle(['client_id' => '']);

        $res = $this->postJson('/api/v1/admin/integrations/google_oauth/test', [], $headers);

        $res->assertStatus(422)->assertJsonPath('success', false);
    }

    public function test_admin_connection_test_reports_the_http_status_when_signing_keys_are_blocked(): void
    {
        $headers = $this->superAdminHeaders();
        $this->enableGoogle();

        // A filtering proxy in front of googleapis.com answers 403. The admin
        // must be told the status instead of a vague "unreachable". A distinct
        // host is used because an already-registered Http stub cannot be
        // overridden within the same test.
        config(['integrations.credentials.google_jwks.url' => 'https://blocked-proxy.test/certs']);
        Http::fake(['https://blocked-proxy.test/certs' => Http::response('Error 403 (Forbidden)', 403)]);
        Cache::flush();

        $res = $this->postJson('/api/v1/admin/integrations/google_oauth/test', [], $headers);

        $res->assertStatus(422)->assertJsonPath('success', false);
        $message = (string) $res->json('message');
        $this->assertStringContainsString('403', $message);
        $this->assertStringContainsString('GOOGLE_JWKS_BYPASS_PROXY', $message);
        $this->assertStringNotContainsString(self::CLIENT_SECRET, $message);
    }

    public function test_the_default_jwks_url_matches_google_discovery(): void
    {
        $this->assertSame(
            'https://www.googleapis.com/oauth2/v3/certs',
            GoogleIdTokenVerifier::JWKS_URL,
            'The default JWKS URL must match the value Google advertises in its OpenID discovery document.'
        );
    }

    public function test_signing_key_fetch_uses_the_configured_key_endpoint(): void
    {
        config([
            'integrations.credentials.google_jwks.url' => 'https://mirror.test/certs',
            'integrations.credentials.google_jwks.bypass_proxy' => true,
        ]);
        Http::fake(['https://mirror.test/certs' => Http::response(['keys' => []])]);
        Cache::flush();

        $diagnostic = app()->make(GoogleIdTokenVerifier::class)->signingKeyDiagnostic();

        $this->assertFalse($diagnostic['ok']);
        Http::assertSent(fn ($request) => $request->url() === 'https://mirror.test/certs');
    }

    public function test_a_key_response_without_usable_keys_is_reported(): void
    {
        config(['integrations.credentials.google_jwks.url' => 'https://empty-keys.test/certs']);
        Http::fake(['https://empty-keys.test/certs' => Http::response(['keys' => []])]);
        Cache::flush();

        $diagnostic = app()->make(GoogleIdTokenVerifier::class)->signingKeyDiagnostic();

        $this->assertFalse($diagnostic['ok']);
        $this->assertStringContainsString('without any usable keys', (string) $diagnostic['error']);
    }

    public function test_verification_fails_closed_when_signing_keys_cannot_be_retrieved(): void
    {
        $this->enableGoogle();

        config(['integrations.credentials.google_jwks.url' => 'https://blocked-proxy.test/certs']);
        Http::fake(['https://blocked-proxy.test/certs' => Http::response('Error 403 (Forbidden)', 403)]);
        Cache::flush();

        $token = $this->signJwt($this->claims(['sub' => 'google-abc-123']));

        $this->postCredential($token)
            ->assertStatus(401)
            ->assertJsonPath('message', GoogleIdTokenVerifier::FAILURE_MESSAGE);
    }
}
