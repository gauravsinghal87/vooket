<?php

namespace App\Jobs;

use App\Jobs\Middleware\RateLimited;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Base outbound provider request. HTTP is built dynamically as an array so
 * subclass constructor signatures are stable and jobs remain serializable.
 */
abstract class BaseRequest implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public int $tries = 3;

    public int $backoff = 10;

    public array $http = [];

    public bool $mock = false;

    protected function runMock(string $marker, array $context = []): void
    {
        Log::info("MOCK {$marker}", $this->redactSensitive($context));
    }

    /**
     * Never write secrets (OTP/code/password/token/secret) to logs unless the
     * dev-only services.sms.log_otp_plaintext flag is explicitly enabled.
     */
    protected function redactSensitive(array $context): array
    {
        $plaintext = (bool) config('services.sms.log_otp_plaintext', false);

        return array_map(function ($value, $key) use ($plaintext) {
            if (! is_string($value)) {
                return $value;
            }

            if (preg_match('/^(otp|code|password|secret|token|auth_key)$/i', (string) $key)) {
                return $plaintext ? $value : '******'.substr($value, -2);
            }

            return $value;
        }, $context, array_keys($context));
    }

    protected function send(array $http, bool $mock = false, string $marker = 'THIRD_PARTY'): void
    {
        if ($mock) {
            $this->runMock($marker, $http);

            return;
        }

        $this->guardHttp($http);

        $client = Http::connectTimeout(10)
            ->timeout(30)
            ->withOptions(['debug' => (bool) env('HTTP_DEBUG', false)])
            ->withHeaders($http['headers'] ?? []);

        if (isset($http['query'])) {
            $client = $client->withQuery($http['query']);
        }

        if (isset($http['json'])) {
            $client = $client->asJson()->withBody(json_encode($http['json']), 'application/json');
        } elseif (isset($http['form_params'])) {
            $client = $client->asForm();
        }

        $response = strtoupper($http['method'] ?? 'GET') === 'GET'
            ? $client->get($http['url'])
            : $client->{strtolower($http['method'] ?? 'post')}($http['url'], $http['json'] ?? $http['form_params'] ?? []);

        Log::info("{$marker} {$this->service}:{$this->operation}", [
            'url' => $http['url'],
            'status' => $response->status(),
            'response' => $response->ok() ? null : mb_substr($response->body(), 0, 400),
        ]);

        if ($response->failed()) {
            throw new \RuntimeException(
                "{$marker} {$this->service}:{$this->operation} failed with status {$response->status()}",
                (int) $response->status(),
            );
        }
    }

    protected function guardHttp(array $http): void
    {
        if (blank($http['url'] ?? null)) {
            throw new \InvalidArgumentException('Outbound request requires a URL.');
        }

        $raw = strtolower($http['url'] ?? '');
        if (preg_match('/(?:key|secret|token|authorization|password|api_key)=[^&\s]+/i', $raw)) {
            throw new \InvalidArgumentException('Outbound URL must not contain credentials as query parameters.');
        }
    }

    public function middleware(): array
    {
        return [new RateLimited];
    }
}
