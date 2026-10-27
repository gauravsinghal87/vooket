<?php

namespace App\Jobs;

class AsyncFirebaseRequest extends BaseRequest
{
    public string $service = 'push';

    public string $operation = 'send';

    /** @var array<int,string> */
    public array $tokens = [];

    public array $payload = [];

    public function __construct(public string $provider, array $tokens, array $payload, ?array $http = null)
    {
        $this->tokens = $tokens;
        $this->payload = $payload;
        $this->mock = $provider === 'mock';
        $this->http = $http ?? [];
    }

    public function handle(): void
    {
        if ($this->mock) {
            $this->runMock('PUSH', ['tokens' => count($this->tokens), 'payload' => $this->payload]);

            return;
        }

        $this->send($this->http, false, 'FCM');
    }

    public function getRateKey(): string
    {
        return 'push:'.md5(implode('|', $this->tokens));
    }

    public function getRateAttempts(): int
    {
        return 120;
    }
}
