<?php

namespace Tests\Unit;

use App\Models\IntegrationSetting;
use App\Services\Integration\IntegrationConfigResolver;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class IntegrationConfigResolverTest extends TestCase
{
    use RefreshDatabase;

    protected IntegrationConfigResolver $resolver;

    protected function setUp(): void
    {
        parent::setUp();

        $this->resolver = new IntegrationConfigResolver;
        config(['integrations.mode' => 'mock']);
    }

    public function test_mock_mode_resolves_every_service_to_its_mock_provider(): void
    {
        config(['integrations.mode' => 'mock']);

        $this->assertSame('mock', $this->resolver->provider('payments'));
        $this->assertSame('mock', $this->resolver->provider('otp'));
        $this->assertSame('mock', $this->resolver->provider('maps'));
        $this->assertSame('mock', $this->resolver->provider('push'));
        $this->assertSame('local', $this->resolver->provider('media'));
        $this->assertSame('null', $this->resolver->provider('captcha'));
    }

    public function test_database_settings_override_environment_fallbacks(): void
    {
        config(['integrations.mode' => 'test']);
        config(['integrations.provider.payments' => 'razorpay']);

        IntegrationSetting::create([
            'service' => 'payments',
            'provider' => 'razorpay',
            'environment' => 'test',
            'is_enabled' => true,
            'credentials' => [
                'key_id' => 'rzp_test_ID',
                'key_secret' => 'secret-value',
            ],
        ]);

        $resolved = $this->resolver->resolve('payments');

        $this->assertSame('razorpay', $resolved['provider']);
        $this->assertSame('test', $resolved['environment']);
        $this->assertTrue($resolved['is_configured']);
        $this->assertSame('database', $resolved['from']);
        $this->assertSame('rzp_test_ID', $resolved['credentials']['key_id']);
    }

    public function test_disabled_integration_falls_back_to_mock(): void
    {
        config(['integrations.mode' => 'test']);
        config(['integrations.provider.payments' => 'razorpay']);

        IntegrationSetting::create([
            'service' => 'payments',
            'provider' => 'razorpay',
            'environment' => 'test',
            'is_enabled' => false,
            'credentials' => ['key_id' => 'rzp_test_ID', 'key_secret' => 'secret-value'],
        ]);

        $this->assertSame('mock', $this->resolver->provider('payments'));
    }

    public function test_missing_required_credentials_downgrade_provider(): void
    {
        config(['integrations.mode' => 'test']);
        config(['integrations.provider.payments' => 'razorpay']);

        IntegrationSetting::create([
            'service' => 'payments',
            'provider' => 'razorpay',
            'environment' => 'test',
            'is_enabled' => true,
            'credentials' => [],
        ]);

        $resolved = $this->resolver->resolve('payments');

        $this->assertSame('mock', $resolved['provider']);
        $this->assertNotEmpty($resolved['reasons']);
    }

    public function test_environment_variables_are_fallbacks_when_no_database_row(): void
    {
        config(['integrations.mode' => 'test']);
        config(['integrations.provider.otp' => 'msg91']);
        config([
            'integrations.credentials.otp' => [
                'auth_key' => 'ab12cd',
                'otp_template_id' => 'tpl_1',
            ],
        ]);

        $resolved = $this->resolver->resolve('otp');

        $this->assertSame('msg91', $resolved['provider']);
        $this->assertSame('ab12cd', $resolved['credentials']['auth_key']);
        $this->assertSame('env', $resolved['from']);
    }

    public function test_client_safe_payload_never_exposes_secrets(): void
    {
        config(['integrations.mode' => 'test']);
        config(['integrations.provider.payments' => 'razorpay']);

        IntegrationSetting::create([
            'service' => 'payments',
            'provider' => 'razorpay',
            'environment' => 'test',
            'is_enabled' => true,
            'credentials' => ['key_id' => 'rzp_test_ID', 'key_secret' => 'top-secret'],
        ]);

        $safe = $this->resolver->clientSafe()['payments'];

        $this->assertSame('rzp_test_ID', $safe['key_id']);
        $payload = json_encode($safe);
        $this->assertStringNotContainsString('top-secret', $payload);
    }
}
