<?php

namespace App\Jobs;

class SyncBrevoEmailRequest extends BaseRequest
{
    public string $service = 'email';

    public string $operation = 'sendTransactionalEmail';

    public function __construct(public string $provider, array $http = [])
    {
        $this->http = $http;
        $this->mock = $provider === 'mock';
    }

    public function handle(): void
    {
        if ($this->mock) {
            $this->runMock('EMAIL', array_merge(['url' => $this->http['url'] ?? null], ['json' => $this->http['json'] ?? null]));

            return;
        }

        $this->send($this->http, false, 'BREVO');
    }

    public function getRateKey(): string
    {
        return 'email:'.md5($this->http['url'] ?? 'generic');
    }

    public function getRateAttempts(): int
    {
        return 60;
    }
}
