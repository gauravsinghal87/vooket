<?php

namespace App\Console\Commands;

use App\Models\Ride;
use App\Models\RideRequest;
use App\Services\Ride\RideDispatchService;
use Illuminate\Console\Command;

/**
 * Re-attempt ride dispatch for unassigned rides that exhausted their offer
 * queue (every candidate rejected or expired without anyone accepting).
 *
 * Runs on a schedule; rides with a fresh dispatch attempt within the retry
 * interval are skipped so the command never churns a live offer chain.
 */
class RequeueRideDispatchCommand extends Command
{
    protected $signature = 'rides:dispatch-requeue';

    protected $description = 'Re-attempt ride dispatch for unassigned rides with no active offers.';

    public function handle(RideDispatchService $dispatch): int
    {
        $intervalSeconds = (int) config('ride.requeue_interval_seconds', 180);

        $rides = Ride::query()
            ->whereNull('driver_id')
            ->whereIn('status', [Ride::STATUS_REQUESTING, Ride::STATUS_NO_DRIVER_FOUND])
            ->whereDoesntHave('rideRequests', fn ($query) => $query->whereIn('status', [RideRequest::STATUS_PENDING, RideRequest::STATUS_SENT]))
            ->get();

        $requeued = 0;

        foreach ($rides as $ride) {
            $recentAttempt = RideRequest::query()
                ->where('ride_id', $ride->id)
                ->where('created_at', '>=', now()->subSeconds($intervalSeconds))
                ->exists();

            if ($recentAttempt) {
                continue;
            }

            $freshRide = $ride->fresh() ?? $ride;

            $result = $dispatch->dispatchForRide($freshRide);

            if (in_array($result['status'] ?? '', ['offered', 'promoted'], true)) {
                $requeued++;
            }
        }

        $this->info("Requeued {$requeued} ride(s).");

        return self::SUCCESS;
    }
}
