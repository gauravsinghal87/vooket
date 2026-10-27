<?php

namespace App\Services\Ride;

use App\Infrastructure\Interfaces\RealtimeProviderInterface;
use App\Models\Driver;
use App\Models\Ride;
use App\Models\RideRequest;
use App\Models\RideStatusHistory;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Offers unassigned rides to eligible drivers via RideRequest offers.
 *
 * Offers are created sequentially:
 *   - the nearest eligible driver receives a "pending" (active) offer,
 *   - the remaining candidates are queued as "sent" and promoted one by one
 *     as each active offer is declined or expires.
 *
 * The flow is idempotent: re-dispatching a ride never duplicates an existing
 * active offer chain. Promotion lives behind a ride-level row lock so
 * concurrent polls (customer polling, driver polling and the requeue
 * command) can only ever promote one next candidate.
 */
class RideDispatchService
{
    public function __construct(private DriverEligibilityService $eligibility) {}

    /**
     * Create driver offers for a ride, unless one already exists.
     *
     * @return array{status: string, offer?: RideRequest, offers?: int|string}
     */
    public function dispatchForRide(Ride $ride): array
    {
        $ride = $ride->fresh() ?? $ride;

        if ($ride->driver_id) {
            return ['status' => 'already_assigned'];
        }

        if (! in_array($ride->status, [Ride::STATUS_REQUESTING, Ride::STATUS_NO_DRIVER_FOUND], true)) {
            return ['status' => 'not_dispatchable', 'ride_status' => $ride->status];
        }

        $active = $this->activeOffer($ride);
        if ($active) {
            return ['status' => 'already_offering', 'offer' => $active];
        }

        $hasQueuedCandidates = RideRequest::where('ride_id', $ride->id)
            ->where('status', RideRequest::STATUS_SENT)
            ->exists();

        if ($hasQueuedCandidates) {
            $promoted = $this->promoteNext($ride);

            if ($promoted) {
                return ['status' => 'promoted', 'offer' => $promoted];
            }
        }

        return $this->createOfferBatch($ride);
    }

    /**
     * Expire stale "pending" offers for the ride whose timeout has elapsed.
     */
    public function expirePendingOffers(Ride $ride): int
    {
        return RideRequest::where('ride_id', $ride->id)
            ->where('status', RideRequest::STATUS_PENDING)
            ->where('expires_at', '<', now())
            ->update(['status' => RideRequest::STATUS_EXPIRED]);
    }

    /**
     * Promote the next queued ("sent") candidate to a "pending" offer.
     * Ineligible drivers are skipped and their offer is marked expired.
     *
     * Runs inside a transaction that locks the ride row so concurrent
     * promotion attempts cannot produce two active offers.
     */
    public function promoteNext(Ride $ride): ?RideRequest
    {
        return DB::transaction(function () use ($ride) {
            $ride = Ride::query()->lockForUpdate()->find($ride->id);

            if (! $ride || $ride->driver_id) {
                return null;
            }

            if (in_array($ride->status, [Ride::STATUS_COMPLETED, Ride::STATUS_CANCELLED, Ride::STATUS_IN_PROGRESS], true)) {
                return null;
            }

            $this->expirePendingOffers($ride);

            while ($next = RideRequest::where('ride_id', $ride->id)
                ->where('status', RideRequest::STATUS_SENT)
                ->orderBy('id')
                ->first()) {
                $driver = $next->driver;

                if (! $driver || ! $this->eligibility->isEligible($driver, $ride)) {
                    $meta = (array) $next->meta;
                    $meta['expired_reason'] = 'driver_unavailable';
                    $next->update(['status' => RideRequest::STATUS_EXPIRED, 'meta' => $meta]);

                    continue;
                }

                $next->update([
                    'status' => RideRequest::STATUS_PENDING,
                    'expires_at' => now()->addSeconds($this->offerTimeout()),
                ]);
                $this->notifyDriverOffer($next);

                return $next;
            }

            $this->markNoDriverFound($ride);

            return null;
        });
    }

    public function isOfferExpired(RideRequest $offer): bool
    {
        return $offer->expires_at !== null && $offer->expires_at->isPast();
    }

    public function isEligibleDriver(Driver $driver, Ride $ride): bool
    {
        return $this->eligibility->isEligible($driver, $ride);
    }

    /**
     * Lazily advance offer chains for any ride the driver was queued for.
     * Called when the driver polls their incoming requests so an expired
     * active offer is replaced by the next candidate.
     */
    public function refreshOffersForDriver(Driver $driver): void
    {
        $rideIds = RideRequest::where('driver_id', $driver->id)
            ->whereIn('status', [RideRequest::STATUS_PENDING, RideRequest::STATUS_SENT])
            ->pluck('ride_id')
            ->unique();

        foreach ($rideIds as $rideId) {
            $ride = Ride::find($rideId);

            if (! $ride || $ride->driver_id) {
                continue;
            }

            $this->promoteNextIfNeeded($ride);
        }
    }

    /**
     * Promote for a ride only when it has no unexpired active offer.
     */
    public function promoteNextIfNeeded(Ride $ride): ?RideRequest
    {
        if (in_array($ride->status, [Ride::STATUS_COMPLETED, Ride::STATUS_CANCELLED, Ride::STATUS_IN_PROGRESS], true)) {
            return null;
        }

        if ($ride->driver_id) {
            return null;
        }

        if ($this->activeOffer($ride)) {
            return null;
        }

        return $this->promoteNext($ride);
    }

    /**
     * Re-attempt dispatch for rides near a driver that are still waiting for
     * a driver (e.g. none were online when the ride was created). Runs when a
     * driver comes online or updates their location, so offers appear the
     * moment a driver is available nearby.
     */
    public function dispatchForArea(Driver $driver): int
    {
        if ($driver->latitude === null || $driver->longitude === null || $driver->is_busy) {
            return 0;
        }

        if (! $this->eligibility->isEligible($driver, new Ride([
            'vehicle_type_id' => $driver->vehicle_type_id,
            'status' => Ride::STATUS_REQUESTING,
        ]))) {
            return 0;
        }

        $maxRadius = (float) config('ride.max_radius_km', 10);

        $rides = Ride::where('vehicle_type_id', $driver->vehicle_type_id)
            ->whereNull('driver_id')
            ->whereIn('status', [Ride::STATUS_REQUESTING, Ride::STATUS_NO_DRIVER_FOUND])
            ->whereDoesntHave('rideRequests', fn ($query) => $query->whereIn('status', [RideRequest::STATUS_PENDING, RideRequest::STATUS_SENT]))
            ->get()
            ->filter(function (Ride $ride) use ($driver, $maxRadius) {
                return $this->haversineKm(
                    (float) $driver->latitude,
                    (float) $driver->longitude,
                    (float) $ride->pickup_latitude,
                    (float) $ride->pickup_longitude
                ) <= $maxRadius;
            });

        $dispatched = 0;

        foreach ($rides as $ride) {
            $result = $this->dispatchForRide($ride);

            if (in_array($result['status'] ?? '', ['offered', 'promoted', 'already_offering'], true)) {
                $dispatched++;
            }
        }

        return $dispatched;
    }

    /**
     * Build a normalized offer batch for the ride. The nearest eligible
     * driver becomes the active ("pending") offer; the rest are queued.
     *
     * @return array{status: string, offer?: RideRequest, offers?: int}
     */
    private function createOfferBatch(Ride $ride): array
    {
        $candidates = $this->rankedCandidates($ride);

        if ($candidates->isEmpty()) {
            $this->markNoDriverFound($ride);

            return ['status' => 'no_driver_available'];
        }

        $timeout = $this->offerTimeout();
        $offers = [];

        foreach ($candidates->values() as $index => $candidate) {
            $isActive = $index === 0;
            $offer = RideRequest::create([
                'ride_id' => $ride->id,
                'driver_id' => $candidate['driver']->id,
                'distance_km' => $candidate['distance_km'],
                'status' => $isActive ? RideRequest::STATUS_PENDING : RideRequest::STATUS_SENT,
                'sent_at' => now(),
                'expires_at' => $isActive ? now()->addSeconds($timeout) : null,
                'attempt' => $this->nextAttempt($ride),
            ]);

            if ($isActive) {
                $this->notifyDriverOffer($offer);
            }

            $offers[] = $offer;
        }

        $this->markSearching($ride);

        return ['status' => 'offered', 'offer' => $offers[0], 'offers' => count($offers)];
    }

    /**
     * @return Collection<int, array{driver: Driver, distance_km: float}>
     */
    private function rankedCandidates(Ride $ride): Collection
    {
        $alreadyOffered = RideRequest::where('ride_id', $ride->id)
            ->whereIn('status', [
                RideRequest::STATUS_PENDING,
                RideRequest::STATUS_SENT,
                RideRequest::STATUS_ACCEPTED,
                RideRequest::STATUS_REJECTED,
            ])
            ->pluck('driver_id')
            ->all();
        $maxRadius = (float) config('ride.max_radius_km', 10);
        $maxCandidates = (int) config('ride.max_candidates', 8);

        return $this->eligibility->eligibleCandidates($ride)
            ->map(fn (Driver $driver) => [
                'driver' => $driver,
                'distance_km' => $this->haversineKm(
                    (float) $ride->pickup_latitude,
                    (float) $ride->pickup_longitude,
                    (float) $driver->latitude,
                    (float) $driver->longitude
                ),
            ])
            ->reject(fn (array $candidate) => $candidate['distance_km'] > $maxRadius)
            ->reject(fn (array $candidate) => in_array($candidate['driver']->id, $alreadyOffered, true))
            ->sortBy('distance_km')
            ->take($maxCandidates);
    }

    private function activeOffer(Ride $ride): ?RideRequest
    {
        return RideRequest::where('ride_id', $ride->id)
            ->where('status', RideRequest::STATUS_PENDING)
            ->where(fn ($query) => $query->whereNull('expires_at')->orWhere('expires_at', '>=', now()))
            ->orderBy('id', 'desc')
            ->first();
    }

    private function nextAttempt(Ride $ride): int
    {
        return (int) RideRequest::where('ride_id', $ride->id)->max('attempt') + 1;
    }

    private function offerTimeout(): int
    {
        return (int) config('ride.offer_timeout_seconds', 45);
    }

    private function markSearching(Ride $ride): void
    {
        $meta = $ride->meta ?? [];
        $dispatch = $meta['dispatch'] ?? [];
        $dispatch['status'] = 'searching';
        $dispatch['updated_at'] = now()->toISOString();
        $meta['dispatch'] = $dispatch;

        $updates = ['meta' => $meta];

        if (($ride->fresh()->status ?? $ride->status) === Ride::STATUS_NO_DRIVER_FOUND) {
            $updates['status'] = Ride::STATUS_REQUESTING;
        }

        $ride->update($updates);
    }

    /**
     * Record that no candidate is available. The ride moves to
     * NO_DRIVER_FOUND so the customer UI can surface it, but stays
     * dispatchable again the moment a driver comes online.
     */
    private function markNoDriverFound(Ride $ride): void
    {
        $hasPending = RideRequest::where('ride_id', $ride->id)
            ->whereIn('status', [RideRequest::STATUS_PENDING, RideRequest::STATUS_SENT])
            ->exists();

        if ($hasPending) {
            return;
        }

        $meta = $ride->meta ?? [];
        $dispatch = $meta['dispatch'] ?? [];
        $dispatch['status'] = 'no_driver_available';
        $dispatch['updated_at'] = now()->toISOString();
        $meta['dispatch'] = $dispatch;

        $ride->update([
            'status' => Ride::STATUS_NO_DRIVER_FOUND,
            'meta' => $meta,
        ]);

        RideStatusHistory::where('ride_id', $ride->id)->where('status', Ride::STATUS_NO_DRIVER_FOUND)->exists()
            ?: RideStatusHistory::create([
                'ride_id' => $ride->id,
                'status' => Ride::STATUS_NO_DRIVER_FOUND,
                'notes' => 'No driver available nearby.',
                'changed_by' => null,
            ]);
    }

    private function haversineKm(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $earthRadius = 6371;
        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);
        $a = sin($dLat / 2) * sin($dLat / 2) + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) * sin($dLng / 2);
        $c = 2 * atan2(sqrt($a), sqrt(1 - $a));

        return round($earthRadius * $c, 2);
    }

    private function notifyDriverOffer(RideRequest $offer): void
    {
        try {
            $driver = $offer->driver;
            $ride = $offer->ride;

            if (! $driver || ! $ride) {
                return;
            }

            $payload = [
                'ride_request_id' => $offer->id,
                'ride_id' => $offer->ride_id,
                'distance_km' => $offer->distance_km,
                'expires_at' => $offer->expires_at?->toISOString(),
                'pickup' => [
                    'latitude' => (float) $ride->pickup_latitude,
                    'longitude' => (float) $ride->pickup_longitude,
                    'address' => $ride->pickup_address,
                ],
                'drop' => [
                    'latitude' => (float) $ride->destination_latitude,
                    'longitude' => (float) $ride->destination_longitude,
                    'address' => $ride->destination_address,
                ],
                'estimated_fare' => (float) $ride->estimated_fare,
                'distance_trip_km' => (float) $ride->distance_km,
            ];

            if (app()->bound(RealtimeProviderInterface::class)) {
                app(RealtimeProviderInterface::class)->broadcast(
                    "private-driver.{$driver->id}",
                    'driver.ride-offer-created',
                    $payload
                );
            }
        } catch (\Throwable $e) {
            report($e);
        }
    }
}
