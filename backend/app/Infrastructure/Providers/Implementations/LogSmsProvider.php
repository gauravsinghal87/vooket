<?php

namespace App\Infrastructure\Providers\Implementations;

use App\Infrastructure\Interfaces\SmsProviderInterface;
use Illuminate\Support\Facades\Log;

class LogSmsProvider implements SmsProviderInterface
{
    public function send(string $phoneNumber, string $message, array $options = []): bool
    {
        Log::info('[SMS] Sending SMS', ['to' => $phoneNumber, 'message' => $message]);

        return true;
    }

    public function sendOtp(string $phoneNumber, string $otp): bool
    {
        return $this->send($phoneNumber, 'Your OTP is: '.$this->displayOtp($otp));
    }

    /**
     * OTPs are never written to logs unless the dev-only
     * services.sms.log_otp_plaintext flag is explicitly enabled.
     */
    private function displayOtp(string $otp): string
    {
        if ((bool) config('services.sms.log_otp_plaintext', false)) {
            return $otp;
        }

        return '******'.substr($otp, -2);
    }
}
