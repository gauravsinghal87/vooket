<?php

namespace App\Infrastructure\Providers\Otp;

use App\Infrastructure\Interfaces\SmsProviderInterface;
use App\Infrastructure\Providers\AbstractIntegrationProvider;
use App\Jobs\SyncOtpRequest;

/**
 * Mock OTP/SMS provider. OTPs are never issued to a real network; instead they
 * are logged, exposing them to tests and QA (devices using mock mode).
 */
class MockOtpProvider extends AbstractIntegrationProvider implements SmsProviderInterface
{
    public function sendOtp(string $phoneNumber, string $otp): bool
    {
        SyncOtpRequest::dispatch('mock', [$phoneNumber], $otp, 60);

        return true;
    }

    public function send(string $phoneNumber, string $message, array $options = []): bool
    {
        SyncOtpRequest::dispatch('mock', [$phoneNumber], '', 60, ['url' => null, 'message' => $message]);

        return true;
    }
}
