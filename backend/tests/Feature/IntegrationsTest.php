<?php

namespace Tests\Feature;

use App\Models\IntegrationSetting;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class IntegrationsTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        config(['integrations.mode' => 'mock']);

        $role = Role::updateOrCreate(['slug' => 'super_admin'], ['name' => 'Super Admin', 'is_system' => true]);
        foreach (['integrations.view', 'integrations.update'] as $slug) {
            Permission::updateOrCreate(['slug' => $slug], ['name' => ucfirst($slug), 'module' => 'integrations']);
        }
        $role->permissions()->sync(Permission::pluck('id'));

        $this->admin = User::create([
            'name' => 'Integration Admin',
            'email' => 'integration@example.com',
            'phone' => '9999999999',
            'password' => Hash::make('secret'),
            'user_type' => 'super_admin',
            'is_active' => true,
        ]);
        $this->admin->roles()->sync([$role->id]);
    }

    private function authHeaders(): array
    {
        return ['Authorization' => 'Bearer '.$this->admin->createToken('test')->plainTextToken];
    }

    public function test_admin_can_list_services(): void
    {
        $res = $this->getJson('/api/v1/admin/integrations', $this->authHeaders());

        $res->assertOk()
            ->assertJsonPath('success', true);

        $services = collect($res->json('data'))->pluck('service');
        $this->assertContains('payments', $services);
        $this->assertContains('otp', $services);
        $this->assertContains('maps', $services);
        $this->assertContains('ai', $services);
    }

    public function test_admin_can_update_and_masking_hides_secrets(): void
    {
        $payload = [
            'provider' => 'razorpay',
            'environment' => 'test',
            'is_enabled' => true,
            'key_id' => 'rzp_test_AbCdEf123',
            'key_secret' => 'rzp_secret_SuperSecretValue',
        ];

        $res = $this->putJson('/api/v1/admin/integrations/payments', $payload, $this->authHeaders());

        $res->assertOk()->assertJsonPath('success', true);

        $row = IntegrationSetting::where('service', 'payments')->first();
        $this->assertNotNull($row);
        $this->assertSame('razorpay', $row->provider);
        $this->assertSame('rzp_test_AbCdEf123', $row->credentials['key_id']);

        $responseBody = $res->json('data');
        $this->assertStringNotContainsString('SuperSecretValue', json_encode($responseBody));
        $this->assertStringContainsString('****', $responseBody['credentials']['key_secret']['masked']);
    }

    public function test_keep_secret_placeholder_does_not_clear_value(): void
    {
        IntegrationSetting::create([
            'service' => 'payments',
            'provider' => 'razorpay',
            'environment' => 'test',
            'is_enabled' => true,
            'credentials' => ['key_id' => 'rzp_test_A', 'key_secret' => 'existing-secret'],
        ]);

        $res = $this->putJson('/api/v1/admin/integrations/payments', [
            'provider' => 'razorpay',
            'key_secret' => '****',
        ], $this->authHeaders());

        $res->assertOk();

        $row = IntegrationSetting::where('service', 'payments')->first();
        $this->assertSame('existing-secret', $row->credentials['key_secret']);
    }

    public function test_admin_can_reset_service_to_defaults(): void
    {
        IntegrationSetting::create([
            'service' => 'payments',
            'provider' => 'razorpay',
            'environment' => 'test',
            'is_enabled' => true,
            'credentials' => ['key_id' => 'rzp_test_A'],
        ]);

        $res = $this->deleteJson('/api/v1/admin/integrations/payments', [], $this->authHeaders());

        $res->assertOk();
        $this->assertDatabaseMissing('integration_settings', ['service' => 'payments']);
    }

    public function test_public_app_config_exposes_only_safe_keys(): void
    {
        IntegrationSetting::create([
            'service' => 'payments',
            'provider' => 'razorpay',
            'environment' => 'test',
            'is_enabled' => true,
            'credentials' => ['key_id' => 'rzp_test_KeyId', 'key_secret' => 'super-secret-key'],
        ]);
        config(['integrations.mode' => 'test']);

        $res = $this->getJson('/api/v1/app-config');

        $res->assertOk();
        $payload = json_encode($res->json('data'));
        $this->assertSame('rzp_test_KeyId', $res->json('data.payments.key_id'));
        $this->assertStringNotContainsString('super-secret-key', $payload);
    }

    public function test_maps_connection_test_succeeds_with_valid_key(): void
    {
        IntegrationSetting::create([
            'service' => 'maps',
            'provider' => 'google',
            'environment' => 'test',
            'is_enabled' => true,
            'credentials' => ['server_key' => 'valid-key', 'browser_key' => 'browser-key'],
        ]);
        config(['integrations.mode' => 'test']);

        Http::fake([
            'maps.googleapis.com/maps/api/geocode/json*' => Http::response([
                'status' => 'OK',
                'results' => [['geometry' => ['location' => ['lat' => 1.0, 'lng' => 2.0]]]],
            ]),
            'maps.googleapis.com/maps/api/directions/json*' => Http::response([
                'status' => 'OK',
                'routes' => [['legs' => [['distance' => ['value' => 100], 'duration' => ['value' => 60]]]]],
            ]),
            'places.googleapis.com/v1/places:searchText*' => Http::response([
                'places' => [['id' => 'ChIJ-ABC', 'displayName' => ['text' => 'Test']]],
            ]),
            'places.googleapis.com/v1/places/ChIJLbU9hxX3rToRzVx1mzqM5QQ' => Http::response([
                'id' => 'ChIJ-LbU9hxX3rToRzVx1mzqM5QQ',
                'displayName' => ['text' => 'Test Place'],
            ]),
        ]);

        $res = $this->postJson('/api/v1/admin/integrations/maps/test', [], $this->authHeaders());

        $res->assertOk()->assertJsonPath('success', true);
        $this->assertDatabaseHas('integration_settings', [
            'service' => 'maps',
            'last_test_status' => 'ok',
        ]);
    }

    public function test_maps_connection_test_reports_api_error(): void
    {
        IntegrationSetting::create([
            'service' => 'maps',
            'provider' => 'google',
            'environment' => 'test',
            'is_enabled' => true,
            'credentials' => ['server_key' => 'bad-key', 'browser_key' => 'browser-key'],
        ]);
        config(['integrations.mode' => 'test']);
        Cache::flush();

        Http::fake([
            'maps.googleapis.com/maps/api/geocode/json*' => Http::response([
                'status' => 'REQUEST_DENIED',
                'results' => [],
                'error_message' => 'This API project is not authorized to use this API.',
            ]),
            'maps.googleapis.com/maps/api/directions/json*' => Http::response([
                'status' => 'REQUEST_DENIED',
                'routes' => [],
                'error_message' => 'This API project is not authorized to use this API.',
            ]),
        ]);

        $res = $this->postJson('/api/v1/admin/integrations/maps/test', [], $this->authHeaders());

        $res->assertStatus(422)->assertJsonPath('success', false);
        $this->assertDatabaseHas('integration_settings', [
            'service' => 'maps',
            'last_test_status' => 'error',
        ]);
    }

    public function test_maps_connection_test_works_in_mock_mode(): void
    {
        IntegrationSetting::create([
            'service' => 'maps',
            'provider' => 'google',
            'environment' => 'test',
            'is_enabled' => true,
            'credentials' => ['server_key' => 'abc', 'browser_key' => 'xyz'],
        ]);

        $res = $this->postJson('/api/v1/admin/integrations/maps/test', [], $this->authHeaders());

        $res->assertOk()->assertJsonPath('success', true);
        $this->assertDatabaseHas('integration_settings', [
            'service' => 'maps',
            'last_test_status' => 'ok',
        ]);
    }

    public function test_maps_connection_test_reports_missing_keys_in_mock_mode(): void
    {
        $res = $this->postJson('/api/v1/admin/integrations/maps/test', [], $this->authHeaders());

        $res->assertStatus(422)->assertJsonPath('success', false);
        $this->assertDatabaseHas('integration_settings', [
            'service' => 'maps',
            'last_test_status' => 'error',
        ]);
    }

    public function test_payments_connection_test_reports_tls_error_without_leaking_secrets(): void
    {
        IntegrationSetting::create([
            'service' => 'payments',
            'provider' => 'razorpay',
            'environment' => 'test',
            'is_enabled' => true,
            'credentials' => ['key_id' => 'rzp_test_PublicKeyId', 'key_secret' => 'rzp_test_SecretKey'],
        ]);
        config(['integrations.mode' => 'test']);
        config(['http.ca_bundle' => '/etc/ssl/certs/ca-certificates.crt']);
        Cache::flush();

        Http::fake(function () {
            throw new ConnectionException(
                'cURL error 60: SSL certificate problem: self-signed certificate in certificate chain for https://api.razorpay.com/v1/orders?count=1'
            );
        });

        $res = $this->postJson('/api/v1/admin/integrations/payments/test', [], $this->authHeaders());

        $res->assertStatus(422)
            ->assertJsonPath('success', false)
            ->assertJsonPath('message', fn (string $m) => str_contains($m, 'cURL error 60')
                && str_contains($m, 'php.ini')
                && str_contains($m, 'HTTP_CA_BUNDLE'));

        $payload = json_encode($res->json());
        $this->assertStringNotContainsString('rzp_test_SecretKey', $payload);
        $this->assertStringNotContainsString('rzp_test_PublicKeyId', $payload);

        $this->assertDatabaseHas('integration_settings', [
            'service' => 'payments',
            'last_test_status' => 'error',
        ]);
    }

    public function test_payments_connection_test_succeeds_when_razorpay_responds(): void
    {
        IntegrationSetting::create([
            'service' => 'payments',
            'provider' => 'razorpay',
            'environment' => 'test',
            'is_enabled' => true,
            'credentials' => ['key_id' => 'rzp_test_PublicKeyId', 'key_secret' => 'rzp_test_SecretKey'],
        ]);
        config(['integrations.mode' => 'test']);
        Cache::flush();

        Http::fake([
            'api.razorpay.com/*' => Http::response(['count' => 1, 'items' => []], 200),
        ]);

        $res = $this->postJson('/api/v1/admin/integrations/payments/test', [], $this->authHeaders());

        $res->assertOk()->assertJsonPath('success', true);
        $this->assertDatabaseHas('integration_settings', [
            'service' => 'payments',
            'last_test_status' => 'ok',
        ]);
    }

    public function test_public_app_config_exposes_safe_maps_browser_key_in_mock_mode(): void
    {
        IntegrationSetting::create([
            'service' => 'maps',
            'provider' => 'google',
            'environment' => 'test',
            'is_enabled' => true,
            'credentials' => ['server_key' => 'super-secret-server', 'browser_key' => 'public-browser-key'],
        ]);
        Cache::flush();

        $res = $this->getJson('/api/v1/app-config');

        $res->assertOk();
        $this->assertTrue($res->json('data.maps.enabled'));
        $this->assertSame('google', $res->json('data.maps.provider'));
        $this->assertSame('public-browser-key', $res->json('data.maps.public_key'));

        $payload = json_encode($res->json('data'));
        $this->assertStringNotContainsString('super-secret-server', $payload);
    }

    public function test_public_app_config_hides_maps_when_no_browser_key(): void
    {
        Cache::flush();

        $res = $this->getJson('/api/v1/app-config');

        $res->assertOk();
        $this->assertFalse($res->json('data.maps.enabled'));
        $this->assertNull($res->json('data.maps.public_key'));
    }

    public function test_permission_is_enforced(): void
    {
        $viewer = User::create([
            'name' => 'Viewer',
            'phone' => '8888888888',
            'user_type' => 'super_admin',
            'is_active' => true,
        ]);
        $role = Role::where('slug', 'super_admin')->first();
        Permission::updateOrCreate(['slug' => 'integrations.view'], ['name' => 'Integrations View', 'module' => 'integrations']);
        $role->permissions()->sync([Permission::where('slug', 'integrations.view')->first()->id]);
        $viewer->roles()->sync([$role->id]);

        $res = $this->putJson('/api/v1/admin/integrations/payments', [], ['Authorization' => 'Bearer '.$viewer->createToken('test')->plainTextToken]);

        $res->assertStatus(403);
    }
}
