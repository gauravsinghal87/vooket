<?php

namespace App\Services\Ride;

use App\Models\Driver;
use App\Models\Ride;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

/**
 * Defines which drivers may receive a ride offer.
 *
 * A driver is eligible when they:
 *  - are approved (not pending/rejected/suspended),
 *  - are verified and currently online and available (not busy),
 *  - own a vehicle that matches the ride's requested vehicle type,
 *  - have a live geographic location (freshness window is optional).
 */
class DriverEligibilityService
{
    private const UNAVAILABLE_STATUSES = ['pending', 'rejected', 'suspended'];

    public function eligibleQuery(Ride $ride): Builder
    {
        $query = Driver::query()
            ->where('vehicle_type_id', $ride->vehicle_type_id)
            ->whereNotIn('status', self::UNAVAILABLE_STATUSES)
            ->where('is_online', true)
            ->where('is_busy', false)
            ->where('is_verified', true)
            ->whereNotNull('latitude')
            ->whereNotNull('longitude');

        if ($ride->pickup_zone_id !== null) {
            $query->where('current_zone_id', $ride->pickup_zone_id);
        }

        $freshnessMinutes = config('ride.location_freshness_minutes');

        if ($freshnessMinutes !== null) {
            $query->where('last_location_at', '>=', now()->subMinutes((int) $freshnessMinutes));
        }

        return $query;
    }

    /**
     * Fetch every driver eligible for the ride's vehicle type.
     *
     * @return Collection<int, Driver>
     */
    public function eligibleCandidates(Ride $ride): Collection
    {
        return $this->eligibleQuery($ride)->get();
    }

    public function isEligible(Driver $driver, Ride $ride): bool
    {
        if ((int) $driver->vehicle_type_id !== (int) $ride->vehicle_type_id) {
            return false;
        }

        if (in_array($driver->status, self::UNAVAILABLE_STATUSES, true)) {
            return false;
        }

        if (! $driver->is_online || $driver->is_busy) {
            return false;
        }

        if (! $driver->is_verified) {
            return false;
        }

        if ($ride->pickup_zone_id !== null && (int) $driver->current_zone_id !== (int) $ride->pickup_zone_id) {
            return false;
        }

        $freshnessMinutes = config('ride.location_freshness_minutes');

        if ($freshnessMinutes !== null && $driver->last_location_at !== null
            && $driver->last_location_at->lt(now()->subMinutes((int) $freshnessMinutes))) {
            return false;
        }

        return $driver->latitude !== null && $driver->longitude !== null;
    }
}
