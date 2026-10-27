<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Resend, Postmark, AWS, and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'payment' => [
        'provider' => env('PAYMENT_PROVIDER', 'log'),
    ],

    'maps' => [
        'provider' => env('MAPS_PROVIDER', 'google'),
    ],

    'sms' => [
        'provider' => env('SMS_PROVIDER', 'log'),
        // Dev-only escape hatch: when true, the development SMS providers log
        // the plaintext OTP so QA can read it locally. MUST stay false in
        // production; providers redact OTPs whenever this is false.
        'log_otp_plaintext' => (bool) env('SMS_LOG_OTP_PLAINTEXT', false),
    ],

    'storage' => [
        'provider' => env('STORAGE_PROVIDER', 'local'),
    ],

    'ai' => [
        'provider' => env('AI_PROVIDER', 'log'),
        'model' => env('AI_OPENAI_MODEL', 'gpt-4o-mini'),
    ],

    'kyc' => [
        'provider' => env('KYC_PROVIDER', 'log'),
    ],

    'search' => [
        'provider' => env('SEARCH_PROVIDER', 'mysql'),
    ],

    'razorpay' => [
        'key_id' => env('RAZORPAY_KEY_ID'),
        'key_secret' => env('RAZORPAY_KEY_SECRET'),
        'webhook_secret' => env('RAZORPAY_WEBHOOK_SECRET'),
    ],

    'cashfree' => [
        'app_id' => env('CASHFREE_APP_ID'),
        'secret_key' => env('CASHFREE_SECRET_KEY'),
        'webhook_secret' => env('CASHFREE_WEBHOOK_SECRET'),
    ],

    'google_maps' => [
        'api_key' => env('GOOGLE_MAPS_API_KEY'),
    ],

    'twilio' => [
        'sid' => env('SMS_TWILIO_SID'),
        'token' => env('SMS_TWILIO_TOKEN'),
        'from' => env('SMS_TWILIO_FROM'),
    ],

    'fcm' => [
        'server_key' => env('FCM_SERVER_KEY'),
        'sender_id' => env('FCM_SENDER_ID'),
    ],

    'geocoding' => [
        'enabled' => env('GEOCODING_ENABLED', true),

        // A real contact email used in the Nominatim User-Agent. Nominatim
        // rejects requests whose User-Agent contains an obviously fake address
        // (e.g. *@example.com) with a 403.
        'nominatim_email' => env('GEOCODING_NOMINATIM_EMAIL'),
    ],

];
