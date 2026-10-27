<?php

namespace App\Infrastructure\Providers\Realtime;

use App\Infrastructure\Interfaces\RealtimeProviderInterface;
use App\Infrastructure\Providers\AbstractIntegrationProvider;
use Illuminate\Support\Facades\Broadcast;

class ReverbRealtimeProvider extends AbstractIntegrationProvider implements RealtimeProviderInterface
{
    public function broadcast(string $channel, string $event, array $payload): bool
    {
        try {
            Broadcast::connection()->broadcast([$channel], $event, $payload);

            return true;
        } catch (\Throwable $e) {
            report($e);

            return false;
        }
    }
}
