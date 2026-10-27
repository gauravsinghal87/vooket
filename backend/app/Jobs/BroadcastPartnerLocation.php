<?php

namespace App\Jobs;

use App\Models\DeliveryPartner;
use App\Services\Integration\OrderTrackingBroadcaster;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;

/**
 * Delivers the partner-location tracking fan-out off the request path.
 *
 * Location pings are frequent and low-value to the writer: the partner's
 * live position is broadcast to the customer's tracking channel, but a slow
 * websocket server must never slow the partner's own app. Failures are
 * logged and swallowed — realtime is a convenience channel, not a record.
 */
class BroadcastPartnerLocation implements ShouldQueue
{
    use Queueable;

    public int $tries = 1;

    public int $timeout = 15;

    public function __construct(public int $partnerId) {}

    public function handle(OrderTrackingBroadcaster $broadcaster): void
    {
        $partner = DeliveryPartner::find($this->partnerId);

        if (! $partner) {
            return;
        }

        try {
            $broadcaster->partnerLocationUpdated($partner);
        } catch (\Throwable $e) {
            Log::warning('Partner location broadcast failed', [
                'partner_id' => $partner->id,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
