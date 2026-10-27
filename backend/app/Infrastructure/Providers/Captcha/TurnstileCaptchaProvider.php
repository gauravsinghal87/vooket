<?php

namespace App\Infrastructure\Providers\Captcha;

use App\Infrastructure\Interfaces\CaptchaProviderInterface;
use App\Infrastructure\Interfaces\TestableProvider;
use App\Infrastructure\Providers\AbstractIntegrationProvider;
use Illuminate\Support\Facades\Http;

class TurnstileCaptchaProvider extends AbstractIntegrationProvider implements CaptchaProviderInterface, TestableProvider
{
    public function verify(string $token): array
    {
        $res = Http::connectTimeout(10)->timeout(20)->asForm()->post(
            'https://challenges.cloudflare.com/turnstile/v0/siteverify',
            [
                'secret' => $this->cred('secret_key'),
                'response' => $token,
                'remoteip' => request()->ip(),
            ]
        );

        $json = $res->json() ?: [];

        return [
            'success' => (bool) ($json['success'] ?? false),
            'error_codes' => $json['error-codes'] ?? [],
        ];
    }

    public function testConnection(): array
    {
        return [
            'success' => (bool) $this->cred('site_key') && (bool) $this->cred('secret_key'),
            'message' => 'Turnstile keys present.',
        ];
    }
}
