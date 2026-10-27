<?php

namespace App\Infrastructure\Providers\Analytics;

use App\Infrastructure\Interfaces\AnalyticsProviderInterface;
use App\Infrastructure\Providers\AbstractIntegrationProvider;
use App\Jobs\AsyncPostHogRequest;

class PostHogAnalyticsProvider extends AbstractIntegrationProvider implements AnalyticsProviderInterface
{
    public function capture(string $event, array $properties = [], ?string $distinctId = null): bool
    {
        $host = rtrim((string) $this->cred('host'), '/');

        dispatch(new AsyncPostHogRequest('posthog', [
            'url' => $host.'/batch/',
            'method' => 'POST',
            'headers' => ['Content-Type' => 'application/json'],
            'json' => [
                'api_key' => $this->cred('key'),
                'batch' => [[
                    'event' => $event,
                    'properties' => array_merge([
                        'distinct_id' => $distinctId ?? 'anonymous',
                        '$lib' => 'superapp-backend',
                    ], $properties),
                ]],
            ],
        ]));

        return true;
    }
}
