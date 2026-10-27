<?php

namespace Tests\Unit;

use App\Infrastructure\Interfaces\PaymentGatewayInterface;
use App\Infrastructure\Interfaces\SmsProviderInterface;
use App\Infrastructure\Providers\Ai\MockAiProvider;
use App\Infrastructure\Providers\Maps\MockMapsProvider;
use App\Infrastructure\Providers\Otp\MockOtpProvider;
use App\Infrastructure\Providers\Payments\MockPaymentProvider;
use App\Infrastructure\Providers\Payments\RazorpayProvider;
use App\Models\IntegrationSetting;
use App\Services\Integration\IntegrationConfigResolver;
use App\Services\Integration\IntegrationManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class IntegrationManagerTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config(['integrations.mode' => 'mock']);
    }

    public function test_mock_mode_returns_mock_provider_instances(): void
    {
        $manager = app(IntegrationManager::class);

        $this->assertInstanceOf(MockPaymentProvider::class, $manager->payments());
        $this->assertInstanceOf(MockMapsProvider::class, $manager->maps());
        $this->assertInstanceOf(MockOtpProvider::class, $manager->otp());
        $this->assertInstanceOf(MockAiProvider::class, $manager->ai());
        $this->assertInstanceOf(PaymentGatewayInterface::class, $manager->payments());
        $this->assertInstanceOf(SmsProviderInterface::class, $manager->otp());
    }

    public function test_real_provider_is_wired_when_configured_with_credentials(): void
    {
        config(['integrations.mode' => 'test']);
        config(['integrations.provider.payments' => 'razorpay']);

        IntegrationSetting::create([
            'service' => 'payments',
            'provider' => 'razorpay',
            'environment' => 'test',
            'is_enabled' => true,
            'credentials' => ['key_id' => 'rzp_test_ID', 'key_secret' => 'secret'],
        ]);

        $manager = app(IntegrationManager::class);

        $this->assertInstanceOf(RazorpayProvider::class, $manager->payments());
    }

    public function test_resolver_cache_is_invalidated_on_change(): void
    {
        $resolver = app(IntegrationConfigResolver::class);

        config(['integrations.mode' => 'mock']);
        config(['integrations.provider.otp' => 'msg91']);

        $this->assertSame('mock', $resolver->provider('otp'));

        config(['integrations.mode' => 'test']);
        config([
            'integrations.credentials.otp' => [
                'auth_key' => 'k',
                'otp_template_id' => 't',
            ],
        ]);
        $resolver->clear('otp');

        $this->assertSame('msg91', $resolver->provider('otp'));
    }
}
