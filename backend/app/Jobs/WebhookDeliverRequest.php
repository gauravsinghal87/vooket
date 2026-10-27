<?php

namespace App\Jobs;

use App\Models\WebhookDelivery;

class WebhookDeliverRequest extends BaseRequest
{
    public string $service = 'webhook';

    public string $operation = 'deliver';

    public int $deliveryId;

    public function __construct(int $deliveryId)
    {
        $this->deliveryId = $deliveryId;
    }

    public function handle(): void
    {
        $delivery = WebhookDelivery::query()->find($this->deliveryId);

        if (! $delivery || $delivery->status === 'delivered') {
            return;
        }

        try {
            $this->send([
                'url' => $delivery->url,
                'method' => 'POST',
                'headers' => array_merge(is_array($delivery->headers) ? $delivery->headers : (json_decode((string) $delivery->headers, true) ?: []), ['Content-Type' => 'application/json', 'Accept' => 'application/json']),
                'json' => is_array($delivery->payload) ? $delivery->payload : (json_decode((string) $delivery->payload, true) ?: []),
            ], false, 'WEBHOOK');
            $delivery->update(['status' => 'delivered', 'delivered_at' => now()]);
        } catch (\Throwable $e) {
            $delivery->update([
                'status' => 'failed',
                'last_error' => mb_substr($e->getMessage(), 0, 500),
                'attempts' => $delivery->attempts + 1,
            ]);
            $this->release(2 * $this->attempts());
        }
    }

    public function getRateKey(): string
    {
        return "webhook:{$this->deliveryId}";
    }

    public function getRateAttempts(): int
    {
        return 10;
    }
}
