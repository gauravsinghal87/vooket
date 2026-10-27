<?php

/*
|--------------------------------------------------------------------------
| Third-party integrations
|--------------------------------------------------------------------------
|
| Provider selectors and credential fallbacks. Values are loaded from the
| environment here, and are overridden at runtime by rows in the
| integration_settings table (admin integration hub) — see
| App\Services\Integration\IntegrationConfigResolver.
|
| THIRD_PARTY_MODE control:
|   mock  — no external HTTP calls; every provider is its mock implementation
|   test  — real providers, use test credentials
|   live  — real providers, use live credentials
|
*/

return [
    'mode' => env('THIRD_PARTY_MODE', 'mock'),

    'provider' => [
        'maps' => env('MAPS_PROVIDER', 'google'),
        'search' => env('SEARCH_PROVIDER', 'mysql'),
        'payments' => env('PAYMENT_PROVIDER', 'razorpay'),
        'settlements' => env('SETTLEMENT_PROVIDER', 'razorpay_route'),
        'otp' => env('OTP_PROVIDER', 'msg91'),
        'push' => env('PUSH_PROVIDER', 'firebase'),
        'email' => env('EMAIL_PROVIDER', 'brevo'),
        'ai' => env('AI_PROVIDER', 'gemini'),
        'media' => env('MEDIA_PROVIDER', 'cloudinary'),
        'identity' => env('IDENTITY_PROVIDER', 'mock'),
        'face' => env('FACE_VERIFICATION_PROVIDER', 'mock'),
        'captcha' => env('CAPTCHA_PROVIDER', 'turnstile'),
        'analytics' => env('ANALYTICS_PROVIDER', 'posthog'),
        'realtime' => env('REALTIME_PROVIDER', 'reverb'),
        'webhook' => env('WEBHOOK_PROVIDER', 'outbound'),
        'google_oauth' => env('GOOGLE_OAUTH_PROVIDER', 'google'),
        'smtp' => env('SMTP_PROVIDER', 'smtp'),
    ],

    // Wallet top-up limits (server-enforced, in major currency units)
    'wallet' => [
        'topup' => [
            'min_amount' => (float) env('WALLET_TOPUP_MIN_AMOUNT', 10),
            'max_amount' => (float) env('WALLET_TOPUP_MAX_AMOUNT', 50000),
        ],
    ],

    'credentials' => [
        'maps' => [
            'server_key' => env('GOOGLE_MAPS_API_KEY'),
            'browser_key' => env('GOOGLE_MAPS_BROWSER_KEY'),
        ],
        'payments' => [
            'key_id' => env('RAZORPAY_KEY_ID'),
            'key_secret' => env('RAZORPAY_KEY_SECRET'),
            'webhook_secret' => env('RAZORPAY_WEBHOOK_SECRET'),
        ],
        'settlements' => [
            'routing_account' => env('RAZORPAY_ROUTING_ACCOUNT'),
            'account_number' => env('RAZORPAY_ROUTING_ACCOUNT_NUMBER'),
        ],
        'otp' => [
            'auth_key' => env('MSG91_AUTH_KEY'),
            'sender_id' => env('MSG91_SENDER_ID'),
            'otp_template_id' => env('MSG91_TEMPLATE_ID'),
        ],
        'push' => [
            'project_id' => env('FIREBASE_PROJECT_ID'),
            'client_email' => env('FIREBASE_CLIENT_EMAIL'),
            'private_key' => env('FIREBASE_PRIVATE_KEY'),
            'messaging_sender_id' => env('FIREBASE_MESSAGING_SENDER_ID'),
            'app_id' => env('FIREBASE_APP_ID'),
            'api_key' => env('FIREBASE_API_KEY'),
        ],
        'email' => [
            'api_key' => env('BREVO_API_KEY'),
            'sender_name' => env('BREVO_SENDER_NAME'),
            'sender_email' => env('BREVO_SENDER_EMAIL'),
            'reply_to' => env('BREVO_REPLY_TO'),
        ],
        'ai' => [
            'api_key' => env('GEMINI_API_KEY'),
        ],
        'media' => [
            'cloud_name' => env('CLOUDINARY_CLOUD_NAME'),
            'api_key' => env('CLOUDINARY_API_KEY'),
            'api_secret' => env('CLOUDINARY_API_SECRET'),
        ],
        'captcha' => [
            'site_key' => env('TURNSTILE_SITE_KEY'),
            'secret_key' => env('TURNSTILE_SECRET_KEY'),
        ],
        'analytics' => [
            'key' => env('POSTHOG_KEY'),
            'host' => env('POSTHOG_HOST'),
        ],
        'google_oauth' => [
            'client_id' => env('GOOGLE_OAUTH_CLIENT_ID'),
            'client_secret' => env('GOOGLE_OAUTH_CLIENT_SECRET'),
        ],
        // Google's published signing keys (JWKS). The default is the value
        // Google advertises in its own OpenID discovery document; it is
        // configurable only so the key endpoint can be pointed at an
        // operator-controlled mirror when Google is unreachable.
        'google_jwks' => [
            'url' => env('GOOGLE_JWKS_URL', 'https://www.googleapis.com/oauth2/v3/certs'),
            // Set true when an outbound filtering proxy blocks the JWKS host.
            // TLS verification is never relaxed; this only stops the request
            // being routed through HTTP_PROXY/HTTPS_PROXY.
            'bypass_proxy' => filter_var(env('GOOGLE_JWKS_BYPASS_PROXY', false), FILTER_VALIDATE_BOOL),
        ],
        'smtp' => [
            'host' => env('SMTP_HOST'),
            'port' => env('SMTP_PORT'),
            'encryption' => env('SMTP_ENCRYPTION'),
            'username' => env('SMTP_USERNAME'),
            'password' => env('SMTP_PASSWORD'),
            'from_email' => env('SMTP_FROM_EMAIL'),
            'from_name' => env('SMTP_FROM_NAME'),
        ],
    ],
];
