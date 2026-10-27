<?php

namespace App\Infrastructure\Providers\Otp;

use App\Infrastructure\Interfaces\SmsProviderInterface;
use App\Infrastructure\Providers\AbstractIntegrationProvider;
use App\Jobs\SyncOtpRequest;

/**
 * MSG91 v5 OTP + SMS provider. Sends are queued through SyncOtpRequest which
 * applies per-phone rate limiting and auto-retries.
 */
class Msg91OtpProvider extends AbstractIntegrationProvider implements SmsProviderInterface
{
    protected string $baseUrl = 'https://control.msg91.com';

    public function sendOtp(string $phoneNumber, string $otp): bool
    {
        $job = new SyncOtpRequest(
            'msg91',
            [$phoneNumber],
            $otp,
            60,
            [
                'url' => "{$this->baseUrl}/api/v5/otp",
                'method' => 'POST',
                'headers' => [
                    'Content-Type' => 'application/json',
                    'Accept' => 'application/json',
                ],
                'json' => [
                    'authkey' => $this->cred('auth_key'),
                    'mobile' => ltrim($phoneNumber, '+'),
                    'otp' => $otp,
                    'template_id' => $this->cred('otp_template_id'),
                    'otp_expiry' => 10,
                ],
            ]
        );

        dispatch($job);

        return true;
    }

    public function send(string $phoneNumber, string $message, array $options = []): bool
    {
        $job = new SyncOtpRequest(
            'msg91',
            [$phoneNumber],
            '',
            60,
            [
                'url' => "{$this->baseUrl}/api/v5/flow/",
                'method' => 'POST',
                'headers' => [
                    'Content-Type' => 'application/json',
                    'Accept' => 'application/json',
                    'authkey' => (string) $this->cred('auth_key'),
                ],
                'json' => [
                    'flow_id' => $options['flow_id'] ?? null,
                    'sender' => $this->cred('sender_id'),
                    'mobiles' => ltrim($phoneNumber, '+'),
                    'VAR1' => $message,
                ],
            ]
        );

        dispatch($job);

        return true;
    }
}
