<?php

namespace App\Jobs;

class SyncOtpRequest extends BaseRequest
{
    public string $service = 'otp';

    public string $operation = 'send';

    public array $mobile;

    public string $otp;

    public int $expiresIn;

    public function __construct(public string $provider, array $mobile, string $otp, int $expiresIn = 60, ?array $http = null)
    {
        $this->mobile = $mobile;
        $this->otp = $otp;
        $this->expiresIn = $expiresIn;
        $this->mock = $provider === 'mock';
        $this->http = $http ?? [];
    }

    public function handle(): void
    {
        if ($this->mock) {
            $this->runMock('OTP', ['mobile' => $this->mobile, 'otp' => $this->otp, 'expires_in' => $this->expiresIn]);

            return;
        }

        $this->send($this->http, false, 'MSG91');
    }

    public function getRateKey(): string
    {
        return 'otp:'.implode('', $this->mobile);
    }

    public function getRateAttempts(): int
    {
        return 5;
    }
}
