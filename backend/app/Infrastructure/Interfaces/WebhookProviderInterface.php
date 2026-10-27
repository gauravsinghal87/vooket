<?php

namespace App\Infrastructure\Interfaces;

interface WebhookProviderInterface
{
    /**
     * Deliver a signed JSON payload to a merchant/partner webhook URL.
     */
    public function dispatch(string $url, string $event, array $payload, array $headers = []): array;

    /**
     * Deliver an event to every matching subscription, optionally constrained by filters.
     *
     * @param  array  $filters  ['owners' => [user_id,...], 'client_id' => int]
     */
    public function dispatchAll(string $event, array $payload, array $filters = []): array;
}
