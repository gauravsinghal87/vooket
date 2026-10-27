<?php

namespace App\Providers;

use App\Infrastructure\Interfaces\AiProviderInterface;
use App\Infrastructure\Interfaces\AnalyticsProviderInterface;
use App\Infrastructure\Interfaces\CaptchaProviderInterface;
use App\Infrastructure\Interfaces\FaceVerificationProviderInterface;
use App\Infrastructure\Interfaces\KycProviderInterface;
use App\Infrastructure\Interfaces\MapProviderInterface;
use App\Infrastructure\Interfaces\NotificationProviderInterface;
use App\Infrastructure\Interfaces\PaymentGatewayInterface;
use App\Infrastructure\Interfaces\RealtimeProviderInterface;
use App\Infrastructure\Interfaces\SearchProviderInterface;
use App\Infrastructure\Interfaces\SettlementProviderInterface;
use App\Infrastructure\Interfaces\SmsProviderInterface;
use App\Infrastructure\Interfaces\StorageProviderInterface;
use App\Infrastructure\Interfaces\WebhookProviderInterface;
use App\Services\Integration\IntegrationConfigResolver;
use App\Services\Integration\IntegrationManager;
use Illuminate\Support\ServiceProvider;

/**
 * Binds infrastructure interfaces to providers selected by the
 * IntegrationConfigResolver / IntegrationManager (DB settings > env > mock).
 */
class SuperAppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(IntegrationManager::class, fn ($app) => new IntegrationManager($app->make(IntegrationConfigResolver::class)));

        $this->app->bind(PaymentGatewayInterface::class, fn ($app) => $app->make(IntegrationManager::class)->payments());
        $this->app->bind(MapProviderInterface::class, fn ($app) => $app->make(IntegrationManager::class)->maps());
        $this->app->bind(SmsProviderInterface::class, fn ($app) => $app->make(IntegrationManager::class)->otp());
        $this->app->bind(StorageProviderInterface::class, fn ($app) => $app->make(IntegrationManager::class)->media());
        $this->app->bind(AiProviderInterface::class, fn ($app) => $app->make(IntegrationManager::class)->ai());
        $this->app->bind(KycProviderInterface::class, fn ($app) => $app->make(IntegrationManager::class)->kyc());
        $this->app->bind(NotificationProviderInterface::class, fn ($app) => $app->make(IntegrationManager::class)->notifications());
        $this->app->bind(SearchProviderInterface::class, fn ($app) => $app->make(IntegrationManager::class)->search());

        $this->app->bind(SettlementProviderInterface::class, fn ($app) => $app->make(IntegrationManager::class)->settlements());
        $this->app->bind(RealtimeProviderInterface::class, fn ($app) => $app->make(IntegrationManager::class)->realtime());
        $this->app->bind(WebhookProviderInterface::class, fn ($app) => $app->make(IntegrationManager::class)->webhook());
        $this->app->bind(CaptchaProviderInterface::class, fn ($app) => $app->make(IntegrationManager::class)->captcha());
        $this->app->bind(AnalyticsProviderInterface::class, fn ($app) => $app->make(IntegrationManager::class)->analytics());
        $this->app->bind(FaceVerificationProviderInterface::class, fn ($app) => $app->make(IntegrationManager::class)->face());
    }

    public function boot(): void {}
}
