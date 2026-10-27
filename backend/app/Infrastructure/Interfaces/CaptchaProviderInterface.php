<?php

namespace App\Infrastructure\Interfaces;

interface CaptchaProviderInterface
{
    /**
     * Verify a frontend challenge token.
     *
     * @return array{success: bool, error_codes?: string[]}
     */
    public function verify(string $token): array;
}
