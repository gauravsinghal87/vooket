<?php

namespace App\Infrastructure\Providers\Webhook;

use App\Infrastructure\Interfaces\WebhookProviderInterface;
use App\Infrastructure\Providers\AbstractIntegrationProvider;
use App\Jobs\WebhookDeliverRequest;
use App\Models\WebhookDelivery;
use App\Models\WebhookSubscription;

/**
 * Outbound webhook dispatcher. Deliveries are queued and retried with an
 * HMAC signature so merchants can verify authenticity.
 */
class OutboundWebhookProvider extends AbstractIntegrationProvider implements WebhookProviderInterface
{
    public function dispatch(string $url, string $event, array $payload, array $headers = []): array
    {
        $subscriptions = WebhookSubscription::query()
            ->where('status', true)
            ->where(function ($q) use ($event) {
                $q->whereJsonContains('events', $event)
                    ->orWhereJsonContains('events', '*');
            })
            ->where('target_url', $url)
            ->get();

        $sent = 0;
        foreach ($subscriptions as $subscription) {
            $signature = $subscription->secret
                ? hash_hmac('sha256', json_encode($payload), $subscription->secret)
                : null;

            $delivery = WebhookDelivery::create([
                'webhook_event_id' => null,
                'subscription_id' => $subscription->id,
                'url' => $url,
                'event' => $event,
                'payload' => $payload,
                'headers' => array_merge($headers, $signature ? ['X-SuperApp-Signature' => $signature, 'X-SuperApp-Event' => $event] : ['X-SuperApp-Event' => $event]),
            ]);

            WebhookDeliverRequest::dispatch($delivery->id);
            $sent++;
        }

        return ['dispatched' => $sent];
    }

    public function dispatchAll(string $event, array $payload, array $filters = []): array
    {
        $subscriptions = WebhookSubscription::query()
            ->where('status', true)
            ->where(function ($q) use ($event) {
                $q->whereJsonContains('events', $event)
                    ->orWhereJsonContains('events', '*');
            })
            ->get();

        $matched = 0;
        foreach ($subscriptions as $subscription) {
            if ($filters && ! $this->matchesFilters($filters, $subscription)) {
                continue;
            }
            $this->dispatch($subscription->target_url, $event, $payload);
            $matched++;
        }

        return ['matched' => $matched];
    }

    protected function matchesFilters(array $filters, WebhookSubscription $subscription): bool
    {
        if (isset($filters['owners']) && is_array($filters['owners']) && $filters['owners'] !== []) {
            if (! in_array((int) $subscription->user_id, array_map('intval', $filters['owners']), true)) {
                return false;
            }
        }

        if (! ($filters['client_id'] ?? null)) {
            return true;
        }

        return $subscription->client_id === (int) $filters['client_id'];
    }
}
