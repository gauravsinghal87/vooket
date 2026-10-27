<?php

namespace App\Infrastructure\Realtime;

trait SimplePusher
{
    /**
     * Push an event to a role-scoped channel with a guard.
     *
     * Channel shape: private-<app>.<channel>.<guard-id>
     * The payload is wrapped so clients can read protocol.version=2.
     */
    protected function simplePush(string $channel, string $event, array $payload): bool
    {
        $appKey = (string) config('app.key', 'superapp');

        return $this->simplePushRaw(
            "private-{$appKey}.{$channel}",
            $event,
            array_merge($payload, ['protocol' => ['version' => 2, 'channel' => $channel]])
        );
    }

    abstract protected function simplePushRaw(string $channel, string $event, array $payload): bool;
}
