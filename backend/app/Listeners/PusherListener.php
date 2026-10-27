<?php

namespace App\Listeners;

use App\Infrastructure\Realtime\SimplePusher;
use Illuminate\Support\Facades\Broadcast;

/**
 * Generic realtime listener: push domain events onto role-scoped channels.
 */
class PusherListener
{
    use SimplePusher;

    /**
     * Dispatch a domain event to its channel.
     */
    public function handle(object $event, ?string $channel = null): void
    {
        if (! method_exists($event, 'getChannelName')) {
            return;
        }

        $channel = $channel ?: $event->getChannelName();
        $this->simplePush($channel, method_exists($event, 'getEventName') ? $event->getEventName() : class_basename($event), $event->getPayload());
    }

    protected function simplePushRaw(string $channel, string $event, array $payload): bool
    {
        try {
            Broadcast::socket(null)->on($channel)->send($event, $payload);

            return true;
        } catch (\Throwable $e) {
            report($e);

            return false;
        }
    }
}
