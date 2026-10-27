<?php

namespace App\Infrastructure\Providers\Captcha;

use App\Infrastructure\Interfaces\CaptchaProviderInterface;
use App\Infrastructure\Providers\AbstractIntegrationProvider;

/**
 * Disabled captcha: always passes (used when provider is not configured).
 */
class NullCaptchaProvider extends AbstractIntegrationProvider implements CaptchaProviderInterface
{
    public function verify(string $token): array
    {
        return ['success' => true];
    }
}
