<?php

namespace App\Services\Integration;

use App\Models\AppSetting;
use App\Models\IntegrationSetting;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Schema;

class IntegrationConfigResolver
{
    /**
     * Central service definitions. Key = canonical service slug.
     */
    public array $definitions = [
        'maps' => [
            'label' => 'Google Maps',
            'env_provider' => 'MAPS_PROVIDER',
            'default_provider' => 'google',
            'mock_provider' => 'mock',
            'allowed_providers' => ['google', 'mock'],
            'env_map' => [
                'server_key' => 'GOOGLE_MAPS_API_KEY',
                'browser_key' => 'GOOGLE_MAPS_BROWSER_KEY',
            ],
            'labels' => ['server_key' => 'Server/backend API key', 'browser_key' => 'Browser (public) key'],
            'public_keys' => ['browser_key'],
            'required' => ['test' => ['server_key'], 'live' => ['server_key']],
        ],
        'payments' => [
            'label' => 'Razorpay',
            'env_provider' => 'PAYMENT_PROVIDER',
            'default_provider' => 'razorpay',
            'mock_provider' => 'mock',
            'allowed_providers' => ['razorpay', 'mock'],
            'env_map' => [
                'key_id' => 'RAZORPAY_KEY_ID',
                'key_secret' => 'RAZORPAY_KEY_SECRET',
                'webhook_secret' => 'RAZORPAY_WEBHOOK_SECRET',
            ],
            'labels' => ['key_id' => 'Key ID', 'key_secret' => 'Key Secret', 'webhook_secret' => 'Webhook Secret'],
            'public_keys' => ['key_id'],
            'required' => ['test' => ['key_id', 'key_secret'], 'live' => ['key_id', 'key_secret', 'webhook_secret']],
        ],
        'settlements' => [
            'label' => 'Marketplace Settlements',
            'env_provider' => 'SETTLEMENT_PROVIDER',
            'default_provider' => 'razorpay_route',
            'mock_provider' => 'mock',
            'allowed_providers' => ['razorpay_route', 'mock'],
            'env_map' => [
                'routing_account' => 'RAZORPAY_ROUTING_ACCOUNT',
                'account_number' => 'RAZORPAY_ROUTING_ACCOUNT_NUMBER',
            ],
            'labels' => ['routing_account' => 'Route routing account ID', 'account_number' => 'Route virtual account number'],
            'public_keys' => [],
            'required' => ['test' => ['routing_account'], 'live' => ['routing_account']],
        ],
        'otp' => [
            'label' => 'MSG91 OTP / SMS',
            'env_provider' => 'OTP_PROVIDER',
            'default_provider' => 'mock',
            'mock_provider' => 'mock',
            'allowed_providers' => ['msg91', 'mock'],
            'env_map' => [
                'auth_key' => 'MSG91_AUTH_KEY',
                'sender_id' => 'MSG91_SENDER_ID',
                'otp_template_id' => 'MSG91_TEMPLATE_ID',
            ],
            'labels' => ['auth_key' => 'Auth Key', 'sender_id' => 'Sender ID', 'otp_template_id' => 'OTP Template ID'],
            'public_keys' => [],
            'required' => ['test' => ['auth_key', 'otp_template_id'], 'live' => ['auth_key', 'otp_template_id']],
        ],
        'push' => [
            'label' => 'Push Notifications',
            'env_provider' => 'PUSH_PROVIDER',
            'default_provider' => 'mock',
            'mock_provider' => 'mock',
            'allowed_providers' => ['firebase', 'mock'],
            'env_map' => [
                'project_id' => 'FIREBASE_PROJECT_ID',
                'client_email' => 'FIREBASE_CLIENT_EMAIL',
                'private_key' => 'FIREBASE_PRIVATE_KEY',
                'messaging_sender_id' => 'FIREBASE_MESSAGING_SENDER_ID',
                'app_id' => 'FIREBASE_APP_ID',
                'api_key' => 'FIREBASE_API_KEY',
            ],
            'labels' => ['project_id' => 'Project ID', 'client_email' => 'Service account email', 'private_key' => 'Service account private key'],
            'public_keys' => ['messaging_sender_id', 'app_id', 'api_key'],
            'required' => ['test' => ['api_key'], 'live' => ['api_key']],
        ],
        'email' => [
            'label' => 'Transactional Email',
            'env_provider' => 'EMAIL_PROVIDER',
            'default_provider' => 'mock',
            'mock_provider' => 'mock',
            'allowed_providers' => ['brevo', 'laravel_mail', 'mock'],
            'env_map' => [
                'api_key' => 'BREVO_API_KEY',
                'sender_name' => 'BREVO_SENDER_NAME',
                'sender_email' => 'BREVO_SENDER_EMAIL',
                'reply_to' => 'BREVO_REPLY_TO',
            ],
            'labels' => ['api_key' => 'API Key', 'sender_email' => 'Sender Email'],
            'public_keys' => [],
            'required' => ['test' => ['api_key'], 'live' => ['api_key']],
        ],
        'ai' => [
            'label' => 'Gemini AI',
            'env_provider' => 'AI_PROVIDER',
            'default_provider' => 'mock',
            'mock_provider' => 'mock',
            'allowed_providers' => ['gemini', 'mock'],
            'env_map' => ['api_key' => 'GEMINI_API_KEY'],
            'labels' => ['api_key' => 'API Key'],
            'public_keys' => [],
            'required' => ['test' => ['api_key'], 'live' => ['api_key']],
        ],
        'media' => [
            'label' => 'Media Storage',
            'env_provider' => 'MEDIA_PROVIDER',
            'default_provider' => 'local',
            'mock_provider' => 'local',
            'allowed_providers' => ['cloudinary', 'local'],
            'env_map' => [
                'cloud_name' => 'CLOUDINARY_CLOUD_NAME',
                'api_key' => 'CLOUDINARY_API_KEY',
                'api_secret' => 'CLOUDINARY_API_SECRET',
            ],
            'labels' => ['cloud_name' => 'Cloud Name', 'api_key' => 'API Key', 'api_secret' => 'API Secret'],
            'public_keys' => ['cloud_name'],
            'required' => ['test' => ['cloud_name', 'api_key', 'api_secret'], 'live' => ['cloud_name', 'api_key', 'api_secret']],
        ],
        'captcha' => [
            'label' => 'Cloudflare Turnstile',
            'env_provider' => 'CAPTCHA_PROVIDER',
            'default_provider' => 'null',
            'mock_provider' => 'null',
            'allowed_providers' => ['turnstile', 'null'],
            'env_map' => ['site_key' => 'TURNSTILE_SITE_KEY', 'secret_key' => 'TURNSTILE_SECRET_KEY'],
            'labels' => ['site_key' => 'Site Key', 'secret_key' => 'Secret Key'],
            'public_keys' => ['site_key'],
            'required' => ['test' => ['site_key', 'secret_key'], 'live' => ['site_key', 'secret_key']],
        ],
        'analytics' => [
            'label' => 'Analytics',
            'env_provider' => 'ANALYTICS_PROVIDER',
            'default_provider' => 'null',
            'mock_provider' => 'null',
            'allowed_providers' => ['posthog', 'null'],
            'env_map' => ['key' => 'POSTHOG_KEY', 'host' => 'POSTHOG_HOST'],
            'labels' => ['key' => 'Project / API key'],
            'public_keys' => ['key'],
            'required' => ['test' => ['key', 'host'], 'live' => ['key', 'host']],
        ],
        'identity' => [
            'label' => 'Identity / KYC',
            'env_provider' => 'IDENTITY_PROVIDER',
            'default_provider' => 'mock',
            'mock_provider' => 'mock',
            'allowed_providers' => ['mock'],
            'env_map' => [],
            'labels' => [],
            'public_keys' => [],
            'required' => [],
        ],
        'face' => [
            'label' => 'Face Verification',
            'env_provider' => 'FACE_VERIFICATION_PROVIDER',
            'default_provider' => 'mock',
            'mock_provider' => 'mock',
            'allowed_providers' => ['mock'],
            'env_map' => [],
            'labels' => [],
            'public_keys' => [],
            'required' => [],
        ],
        'realtime' => [
            'label' => 'Realtime (Laravel Reverb)',
            'env_provider' => 'REALTIME_PROVIDER',
            'default_provider' => 'reverb',
            'mock_provider' => 'reverb',
            'allowed_providers' => ['reverb'],
            'env_map' => [],
            'labels' => [],
            'public_keys' => ['key', 'host', 'port', 'scheme', 'cluster'],
            'required' => [],
        ],
        'search' => [
            'label' => 'Search',
            'env_provider' => 'SEARCH_PROVIDER',
            'default_provider' => 'mysql',
            'mock_provider' => 'mysql',
            'allowed_providers' => ['mysql', 'mock'],
            'env_map' => [],
            'labels' => [],
            'public_keys' => [],
            'required' => [],
        ],
        'webhook' => [
            'label' => 'Outbound Webhooks',
            'env_provider' => 'WEBHOOK_PROVIDER',
            'default_provider' => 'outbound',
            'mock_provider' => 'outbound',
            'allowed_providers' => ['outbound'],
            'env_map' => [],
            'labels' => [],
            'public_keys' => [],
            'required' => [],
        ],
        'google_oauth' => [
            'label' => 'Google OAuth',
            'env_provider' => 'GOOGLE_OAUTH_PROVIDER',
            'default_provider' => 'google',
            'mock_provider' => 'mock',
            'allowed_providers' => ['google', 'mock'],
            'env_map' => [
                'client_id' => 'GOOGLE_OAUTH_CLIENT_ID',
                'client_secret' => 'GOOGLE_OAUTH_CLIENT_SECRET',
            ],
            'labels' => ['client_id' => 'Client ID', 'client_secret' => 'Client Secret'],
            'public_keys' => ['client_id'],
            // The Google Identity Services ID-token flow authenticates with the
            // Client ID alone; the client secret is stored but never required.
            'required' => ['test' => ['client_id'], 'live' => ['client_id']],
        ],
        'smtp' => [
            'label' => 'SMTP / Email',
            'env_provider' => 'SMTP_PROVIDER',
            'default_provider' => 'smtp',
            'mock_provider' => 'mock',
            'allowed_providers' => ['smtp', 'mock'],
            'env_map' => [
                'host' => 'SMTP_HOST',
                'port' => 'SMTP_PORT',
                'encryption' => 'SMTP_ENCRYPTION',
                'username' => 'SMTP_USERNAME',
                'password' => 'SMTP_PASSWORD',
                'from_email' => 'SMTP_FROM_EMAIL',
                'from_name' => 'SMTP_FROM_NAME',
            ],
            'labels' => [
                'host' => 'SMTP Host',
                'port' => 'SMTP Port',
                'encryption' => 'Encryption',
                'username' => 'SMTP Username',
                'password' => 'SMTP Password',
                'from_email' => 'From Email',
                'from_name' => 'From Name',
            ],
            // No SMTP value is ever public: credentials must not reach the browser.
            'public_keys' => [],
            'required' => [
                'test' => ['host', 'port', 'from_email', 'from_name'],
                'live' => ['host', 'port', 'username', 'password', 'from_email', 'from_name'],
            ],
        ],
    ];

    public const CACHE_TTL = 300;

    public static function cacheKey(string $service): string
    {
        return "integration:config:{$service}";
    }

    /**
     * Resolve effective configuration for a service.
     * Precedence: DB integration_settings > env fallback > defaults.
     */
    public function resolve(string $service): array
    {
        return Cache::remember(self::cacheKey($service), self::CACHE_TTL, function () use ($service) {
            return $this->resolveFromSources($service);
        });
    }

    /**
     * Invalidate cache for one service (or all when null).
     */
    public function clear(?string $service = null): void
    {
        if ($service) {
            Cache::forget(self::cacheKey($service));

            return;
        }
        foreach (array_keys($this->definitions) as $s) {
            Cache::forget(self::cacheKey($s));
        }
    }

    public function definition(string $service): array
    {
        return $this->definitions[$service] ?? throw new \InvalidArgumentException("Unknown integration service: {$service}");
    }

    public function provider(string $service): string
    {
        return $this->resolve($service)['provider'];
    }

    public function enabled(string $service): bool
    {
        return (bool) $this->resolve($service)['enabled'];
    }

    public function credentials(string $service): array
    {
        return $this->resolve($service)['credentials'];
    }

    public function environment(string $service): string
    {
        return $this->resolve($service)['environment'];
    }

    public function services(): array
    {
        return array_keys($this->definitions);
    }

    /**
     * Resolve every service (used by admin health / list endpoints).
     */
    public function resolveAll(): array
    {
        $out = [];
        foreach ($this->definitions as $service => $def) {
            $out[$service] = $this->resolve($service);
        }

        return $out;
    }

    /**
     * Provider-specific validation. Returns errors for the admin UI.
     */
    public function validate(string $service): array
    {
        $resolved = $this->resolve($service);
        $def = $this->definition($service);
        $errors = [];

        if ($resolved['provider'] === $def['mock_provider']) {
            foreach (($def['required'][$resolved['environment']] ?? $def['required']['test'] ?? []) as $key) {
                if (blank($resolved['credentials'][$key] ?? null)) {
                    $errors[] = ($def['labels'][$key] ?? $key).' is missing.';
                }
            }

            return ['valid' => $errors === [], 'errors' => $errors, 'resolved' => $resolved];
        }

        return ['valid' => true, 'errors' => $errors, 'resolved' => $resolved];
    }

    /**
     * Safe client-visible configuration (public app-config endpoint).
     */
    public function clientSafe(): array
    {
        $maps = $this->resolve('maps');
        $captcha = $this->resolve('captcha');
        $pay = $this->resolve('payments');
        $analytics = $this->resolve('analytics');
        $media = $this->resolve('media');
        $realtime = $this->resolve('realtime');
        $google = $this->resolve('google_oauth');

        return [
            'maps' => [
                'enabled' => (bool) $maps['enabled'] && ! blank($maps['credentials']['browser_key'] ?? null),
                'provider' => $maps['provider'] !== 'mock' || ! blank($maps['credentials']['browser_key'] ?? null) ? 'google' : null,
                'public_key' => ! blank($maps['credentials']['browser_key'] ?? null) ? $maps['credentials']['browser_key'] : null,
                'map_id' => $maps['settings']['map_id'] ?? config('maps.map_id'),
                'default_center' => [
                    'latitude' => (float) ($maps['settings']['default_center']['latitude'] ?? config('maps.default_center.latitude', 26.9124)),
                    'longitude' => (float) ($maps['settings']['default_center']['longitude'] ?? config('maps.default_center.longitude', 75.7873)),
                ],
                'default_zoom' => (int) ($maps['settings']['default_zoom'] ?? config('maps.default_zoom', 13)),
            ],
            'captcha' => [
                'enabled' => (bool) $captcha['enabled'] && $captcha['provider'] === 'turnstile',
                'provider' => $captcha['enabled'] && $captcha['provider'] === 'turnstile' ? 'turnstile' : null,
                'site_key' => $captcha['provider'] === 'turnstile' ? ($captcha['credentials']['site_key'] ?? null) : null,
            ],
            'payments' => [
                'enabled' => (bool) $pay['enabled'],
                'provider' => $pay['provider'],
                'mode' => $pay['environment'],
                'key_id' => $pay['provider'] === 'razorpay' ? ($pay['credentials']['key_id'] ?? null) : null,
            ],
            'analytics' => [
                'enabled' => $analytics['provider'] === 'posthog' && (bool) $analytics['enabled'],
                'provider' => $analytics['provider'] === 'posthog' ? 'posthog' : null,
                'key' => $analytics['provider'] === 'posthog' ? ($analytics['credentials']['key'] ?? null) : null,
                'host' => $analytics['provider'] === 'posthog' ? ($analytics['credentials']['host'] ?? null) : null,
            ],
            'media' => [
                'enabled' => (bool) $media['enabled'],
                'provider' => $media['provider'],
                'cloud_name' => $media['provider'] === 'cloudinary' ? ($media['credentials']['cloud_name'] ?? null) : null,
                'secure' => (bool) ($media['settings']['secure'] ?? true),
                'default_folder' => $media['settings']['default_folder'] ?? 'superapp',
            ],
            'realtime' => [
                'enabled' => true,
                'provider' => 'reverb',
                'key' => $this->envValue('REVERB_APP_KEY'),
                'host' => $this->envValue('REVERB_HOST', '127.0.0.1'),
                'port' => (int) ($this->envValue('REVERB_PORT', '8080') ?: 8080),
                'scheme' => $this->envValue('REVERB_SCHEME', 'http'),
            ],
            'ai' => [
                'enabled' => (bool) $this->resolve('ai')['enabled'] && $this->resolve('ai')['provider'] !== 'mock',
            ],
            'otp' => [
                'enabled' => (bool) $this->resolve('otp')['enabled'],
            ],
            'google' => [
                'enabled' => (bool) $google['enabled'] && $google['provider'] === 'google',
                'provider' => $google['provider'] === 'google' ? 'google' : null,
                'client_id' => $google['provider'] === 'google' ? ($google['credentials']['client_id'] ?? null) : null,
            ],
            'delivery' => $this->clientDeliverySettings(),
            'branding' => $this->clientBrandingSettings(),
        ];
    }

    /**
     * Client-safe platform branding sourced from the General app_settings.
     *
     * These are the same values the admin Settings page edits: the platform
     * name, an absolute public URL to the uploaded logo (or null), and the
     * currency / support contact details. The logo value may hold a relative
     * `storage/...` path if it was entered manually, so it is normalised into a
     * reachable absolute URL before it is published.
     *
     * @return array{name: string, logo: string|null, currency: string, support_phone: string|null, support_email: string|null}
     */
    protected function clientBrandingSettings(): array
    {
        $values = AppSetting::query()->whereIn('key', [
            'platform_name',
            'platform_logo',
            'currency',
            'support_phone',
            'support_email',
        ])->pluck('value', 'key');

        $logo = $values['platform_logo'] ?? null;
        if (is_string($logo) && $logo !== '') {
            if (str_starts_with($logo, 'storage/')) {
                $logo = rtrim(config('app.url'), '/').'/'.$logo;
            } elseif (str_starts_with($logo, '/storage/')) {
                $logo = rtrim(config('app.url'), '/').$logo;
            } elseif (str_starts_with($logo, 'branding/')) {
                $logo = rtrim(config('app.url'), '/').'/storage/'.$logo;
            }
        } else {
            $logo = null;
        }

        return [
            'name' => (string) ($values['platform_name'] ?? 'SuperApp'),
            'logo' => $logo,
            'currency' => (string) ($values['currency'] ?? 'INR'),
            'support_phone' => ($values['support_phone'] ?? null) !== '' ? ($values['support_phone'] ?? null) : null,
            'support_email' => ($values['support_email'] ?? null) !== '' ? ($values['support_email'] ?? null) : null,
        ];
    }

    /**
     * Client-safe delivery pricing settings sourced from the food-specific
     * app_settings keys.
     *
     * Display-only: the authoritative customer delivery fee is always computed
     * server-side by DeliveryFeeService, so no base fee is published. The
     * frontend must never derive a fee from these values.
     *
     * @return array{per_km_fee: float, free_delivery_above: float|null, free_delivery_km: float|null}
     */
    protected function clientDeliverySettings(): array
    {
        $values = AppSetting::query()->whereIn('key', [
            'food_delivery_fee_per_km',
            'food_free_delivery_above',
            'food_free_delivery_km',
        ])->pluck('value', 'key');

        $freeAbove = $values['food_free_delivery_above'] ?? null;
        $freeKm = $values['food_free_delivery_km'] ?? null;

        return [
            'per_km_fee' => (float) ($values['food_delivery_fee_per_km'] ?? 5),
            'free_delivery_above' => $freeAbove !== null && $freeAbove !== '' ? (float) $freeAbove : null,
            'free_delivery_km' => $freeKm !== null && $freeKm !== '' ? (float) $freeKm : null,
        ];
    }

    protected function resolveFromSources(string $service): array
    {
        $def = $this->definition($service);
        $mode = strtolower((string) config('integrations.mode', 'mock'));

        $db = Schema::hasTable('integration_settings')
            ? IntegrationSetting::query()->where('service', $service)->first()
            : null;

        $configured = $db?->provider ?: ((string) config("integrations.provider.{$service}", $def['default_provider']));
        $configured = $this->normalize($service, $configured);

        $enabled = $db ? (bool) $db->is_enabled : true;
        $dbCredentials = $db?->credentials ?? [];
        $dbSettings = $db?->settings ?? [];
        $dbEnvironment = $db?->environment ?? 'test';

        $envCredentials = [];
        foreach ($def['env_map'] as $key => $envName) {
            $value = config("integrations.credentials.{$service}.{$key}", $this->envValue($envName));
            if ($value !== null && $value !== '' && $value !== 'null') {
                $envCredentials[$key] = $value;
            }
        }

        $credentials = array_merge($envCredentials, $dbCredentials ?? []);
        $settings = array_merge([], $dbSettings ?? []);

        $provider = $configured;
        $reasons = [];

        if ($mode === 'mock') {
            $provider = $def['mock_provider'];
            $reasons[] = 'THIRD_PARTY_MODE=mock — real providers are currently suppressed.';
        } else {
            if (! in_array($provider, $def['allowed_providers'], true)) {
                $reasons[] = "Provider '{$configured}' is not available for {$service}.";
                $provider = $def['mock_provider'];
            } elseif ($provider !== $def['mock_provider']) {
                $required = $def['required'][$dbEnvironment] ?? $def['required']['test'] ?? [];
                foreach ($required as $key) {
                    if (blank($credentials[$key] ?? null)) {
                        $provider = $def['mock_provider'];
                        $reasons[] = ($def['labels'][$key] ?? $key).' is not configured.';
                        break;
                    }
                }
            }
        }

        if (! $enabled) {
            $provider = $def['mock_provider'];
            $reasons[] = 'Integration is disabled in settings.';
        }

        $environment = $provider === $def['mock_provider'] ? 'mock' : ($dbEnvironment ?? 'test');

        $hasCredentials = collect($def['required'][$environment] ?? $def['required']['test'] ?? [])
            ->filter(fn ($key) => blank($credentials[$key] ?? null))
            ->isEmpty();

        return [
            'service' => $service,
            'label' => $def['label'],
            'provider' => $provider,
            'configured_provider' => $configured,
            'environment' => $environment,
            'mode' => $mode,
            'enabled' => $enabled,
            'is_configured' => $provider !== $def['mock_provider'] && $hasCredentials,
            'credentials' => $credentials,
            'settings' => $settings,
            'public_keys' => $def['public_keys'],
            'reasons' => $reasons,
            'from' => $db ? 'database' : 'env',
        ];
    }

    protected function normalize(string $service, string $provider): string
    {
        return match ($provider) {
            'log', 'demo' => 'mock',
            'openai' => 'mock',
            'hyperverge', 'digio', 'signzy', 'cashfree_identity' => 'mock',
            's3', 'r2' => 'local',
            default => $provider,
        };
    }

    protected function envValue(string $key, string $default = ''): string|false
    {
        $value = getenv($key);

        return $value === false || $value === '' || $value === 'null'
            ? $default
            : $value;
    }
}
