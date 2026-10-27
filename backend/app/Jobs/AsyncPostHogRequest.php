<?php

namespace App\Jobs;

class AsyncPostHogRequest extends BaseRequest
{
    public string $service = 'analytics';

    public string $operation = 'capture';

    public function __construct(public string $provider, array $http = [])
    {
        $this->http = $http;
        $this->mock = $provider === 'mock';
    }

    public function handle(): void
    {
        if ($this->mock) {
            $this->runMock('ANALYTICS', ['payload' => $this->http['json'] ?? []]);

            return;
        }

        $this->send($this->http, false, 'POSTHOG');
    }

    public function getRateKey(): string
    {
        return 'analytics:'.md5((string) ($this->http['url'] ?? 'capture'));
    }

    public function getRateAttempts(): int
    {
        return 200;
    }
}
