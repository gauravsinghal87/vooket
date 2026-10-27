<?php

namespace App\Infrastructure\Interfaces;

interface RealtimeProviderInterface
{
    /**
     * Broadcast a superset payload to a channel. Channels must be
     * authorized per role before events are delivered.
     */
    public function broadcast(string $channel, string $event, array $payload): bool;
}
