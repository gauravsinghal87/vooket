<?php

namespace App\Infrastructure\Interfaces;

interface SmsProviderInterface
{
    public function send(string $phoneNumber, string $message, array $options = []): bool;

    public function sendOtp(string $phoneNumber, string $otp): bool;
}
