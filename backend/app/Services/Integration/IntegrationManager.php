<?php

namespace App\Services\Integration;

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
use App\Infrastructure\Providers\Ai\GeminiAiProvider;
use App\Infrastructure\Providers\Ai\MockAiProvider;
use App\Infrastructure\Providers\Analytics\NullAnalyticsProvider;
use App\Infrastructure\Providers\Analytics\PostHogAnalyticsProvider;
use App\Infrastructure\Providers\Captcha\NullCaptchaProvider;
use App\Infrastructure\Providers\Captcha\TurnstileCaptchaProvider;
use App\Infrastructure\Providers\Email\BrevoEmailProvider;
use App\Infrastructure\Providers\Email\LaravelMailProvider;
use App\Infrastructure\Providers\Email\MockEmailProvider;
use App\Infrastructure\Providers\Email\MockSmtpProvider;
use App\Infrastructure\Providers\Email\SmtpProvider;
use App\Infrastructure\Providers\Implementations\GoogleMapsProvider;
use App\Infrastructure\Providers\Implementations\HyperVergeKycProvider;
use App\Infrastructure\Providers\Implementations\LocalStorageProvider;
use App\Infrastructure\Providers\Implementations\MySqlSearchProvider;
use App\Infrastructure\Providers\Kyc\MockFaceVerificationProvider;
use App\Infrastructure\Providers\Kyc\MockKycProvider;
use App\Infrastructure\Providers\Maps\MockMapsProvider;
use App\Infrastructure\Providers\Media\CloudinaryStorageProvider;
use App\Infrastructure\Providers\Oauth\GoogleOAuthProvider;
use App\Infrastructure\Providers\Oauth\MockGoogleOAuthProvider;
use App\Infrastructure\Providers\Otp\MockOtpProvider;
use App\Infrastructure\Providers\Otp\Msg91OtpProvider;
use App\Infrastructure\Providers\Payments\MockPaymentProvider;
use App\Infrastructure\Providers\Payments\MockSettlementProvider;
use App\Infrastructure\Providers\Payments\RazorpayProvider;
use App\Infrastructure\Providers\Payments\RazorpayRouteProvider;
use App\Infrastructure\Providers\Push\FirebasePushProvider;
use App\Infrastructure\Providers\Push\MockPushProvider;
use App\Infrastructure\Providers\Realtime\ReverbRealtimeProvider;
use App\Infrastructure\Providers\Webhook\OutboundWebhookProvider;

class IntegrationManager
{
    /**
     * service => [provider_key => FQCN]
     */
    public const TABLE = [
        'maps' => [
            'google' => GoogleMapsProvider::class,
            'mock' => MockMapsProvider::class,
        ],
        'search' => [
            'mysql' => MySqlSearchProvider::class,
            'mock' => MySqlSearchProvider::class,
        ],
        'payments' => [
            'razorpay' => RazorpayProvider::class,
            'mock' => MockPaymentProvider::class,
        ],
        'settlements' => [
            'razorpay_route' => RazorpayRouteProvider::class,
            'mock' => MockSettlementProvider::class,
        ],
        'otp' => [
            'msg91' => Msg91OtpProvider::class,
            'mock' => MockOtpProvider::class,
        ],
        'push' => [
            'firebase' => FirebasePushProvider::class,
            'mock' => MockPushProvider::class,
        ],
        'email' => [
            'brevo' => BrevoEmailProvider::class,
            'laravel_mail' => LaravelMailProvider::class,
            'mock' => MockEmailProvider::class,
        ],
        'ai' => [
            'gemini' => GeminiAiProvider::class,
            'mock' => MockAiProvider::class,
        ],
        'media' => [
            'cloudinary' => CloudinaryStorageProvider::class,
            'local' => LocalStorageProvider::class,
        ],
        'identity' => [
            'hyperverge' => HyperVergeKycProvider::class,
            'mock' => MockKycProvider::class,
        ],
        'face' => [
            'mock' => MockFaceVerificationProvider::class,
        ],
        'captcha' => [
            'turnstile' => TurnstileCaptchaProvider::class,
            'null' => NullCaptchaProvider::class,
        ],
        'analytics' => [
            'posthog' => PostHogAnalyticsProvider::class,
            'null' => NullAnalyticsProvider::class,
        ],
        'realtime' => [
            'reverb' => ReverbRealtimeProvider::class,
        ],
        'webhook' => [
            'outbound' => OutboundWebhookProvider::class,
        ],
        'google_oauth' => [
            'google' => GoogleOAuthProvider::class,
            'mock' => MockGoogleOAuthProvider::class,
        ],
        'smtp' => [
            'smtp' => SmtpProvider::class,
            'mock' => MockSmtpProvider::class,
        ],
    ];

    public function __construct(
        protected IntegrationConfigResolver $resolver,
    ) {}

    /**
     * @template T
     *
     * @param  class-string<T>  $interface
     * @return T
     */
    public function providerFor(string $service, ?string $provider = null, string $interface = \stdClass::class): object
    {
        $resolved = $this->resolver->resolve($service);
        $provider = $provider ?? $resolved['provider'];

        $class = self::TABLE[$service][$provider]
            ?? throw new \InvalidArgumentException("No provider '{$provider}' registered for service '{$service}'.");

        return app()->make($class, ['config' => $resolved]);
    }

    public function maps(): MapProviderInterface
    {
        return $this->providerFor('maps', interface: MapProviderInterface::class);
    }

    public function search(): SearchProviderInterface
    {
        return $this->providerFor('search', interface: SearchProviderInterface::class);
    }

    public function payments(): PaymentGatewayInterface
    {
        return $this->providerFor('payments', interface: PaymentGatewayInterface::class);
    }

    public function settlements(): SettlementProviderInterface
    {
        return $this->providerFor('settlements', interface: SettlementProviderInterface::class);
    }

    public function otp(): SmsProviderInterface
    {
        return $this->providerFor('otp', interface: SmsProviderInterface::class);
    }

    public function notifications(): NotificationProviderInterface
    {
        return $this->providerFor('push', interface: NotificationProviderInterface::class);
    }

    public function email(): NotificationProviderInterface
    {
        return $this->providerFor('email', interface: NotificationProviderInterface::class);
    }

    public function ai(): AiProviderInterface
    {
        return $this->providerFor('ai', interface: AiProviderInterface::class);
    }

    public function media(): StorageProviderInterface
    {
        return $this->providerFor('media', interface: StorageProviderInterface::class);
    }

    public function kyc(): KycProviderInterface
    {
        return $this->providerFor('identity', interface: KycProviderInterface::class);
    }

    public function face(): FaceVerificationProviderInterface
    {
        return $this->providerFor('face', interface: FaceVerificationProviderInterface::class);
    }

    public function captcha(): CaptchaProviderInterface
    {
        return $this->providerFor('captcha', interface: CaptchaProviderInterface::class);
    }

    public function analytics(): AnalyticsProviderInterface
    {
        return $this->providerFor('analytics', interface: AnalyticsProviderInterface::class);
    }

    public function realtime(): RealtimeProviderInterface
    {
        return $this->providerFor('realtime', interface: RealtimeProviderInterface::class);
    }

    public function webhook(): WebhookProviderInterface
    {
        return $this->providerFor('webhook', interface: WebhookProviderInterface::class);
    }

    public function googleOAuth(): GoogleOAuthProvider|MockGoogleOAuthProvider
    {
        return $this->providerFor('google_oauth');
    }

    public function smtp(): SmtpProvider|MockSmtpProvider
    {
        return $this->providerFor('smtp');
    }
}
