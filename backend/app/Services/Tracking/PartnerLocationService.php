<?php

namespace App\Services\Tracking;

use App\Models\DeliveryPartner;
use App\Services\Maps\ZoneService;

/**
 * Authoritative partner position service. Persists heading/speed/accuracy
 * updates with a plausible-movement guard and exposes freshness/location
 * snapshots used by dispatch, the tracking endpoint and realtime pushes.
 */
class PartnerLocationService
{
    public function __construct(protected ZoneService $zoneService) {}

    /**
     * Apply a validated location update. Rejects any single ping that would
     * require the partner to travel further than the configured maximum in a
     * single heartbeat (guards against garbage coordinates entering the feed).
     *
     * @param  array{latitude: float, longitude: float, heading: float|null, speed: float|null, accuracy: float|null}  $data
     *
     * @throws \InvalidArgumentException when the ping implies an implausible jump
     */
    public function update(DeliveryPartner $partner, array $data): DeliveryPartner
    {
        $latitude = (float) $data['latitude'];
        $longitude = (float) $data['longitude'];

        $this->assertWithinMinimumInterval($partner);

        if ($partner->latitude !== null && $partner->longitude !== null) {
            $jump = $this->haversineKm(
                (float) $partner->latitude,
                (float) $partner->longitude,
                $latitude,
                $longitude
            );

            if ($jump > (float) config('tracking.max_location_jump_km', 1.5)) {
                throw new \InvalidArgumentException(
                    sprintf('Location jump of %.2f km exceeds the maximum allowed', $jump)
                );
            }
        }

        $partner->update([
            'latitude' => $latitude,
            'longitude' => $longitude,
            'heading' => $this->clampNullable($data['heading'] ?? null, 0, 360),
            'speed' => $this->clampNullable($data['speed'] ?? null, 0, 180),
            'accuracy' => $this->clampNullable($data['accuracy'] ?? null, 0, 5000),
            'current_zone_id' => $this->zoneService->resolve(
                $latitude,
                $longitude,
                (string) $partner->service_type
            )?->id,
            'last_location_at' => now(),
        ]);

        return $partner->fresh();
    }

    public function isStale(DeliveryPartner $partner): bool
    {
        $recordedAt = $partner->last_location_at;

        return $recordedAt === null || $recordedAt->lt(now()->subSeconds((int) config('tracking.location_freshness_seconds', 30)));
    }

    /**
     * Snapshot matching the tracking-payload `location` contract.
     *
     * @return array<string, mixed>
     */
    public function location(DeliveryPartner $partner): array
    {
        return [
            'lat' => $partner->latitude !== null ? (float) $partner->latitude : null,
            'lng' => $partner->longitude !== null ? (float) $partner->longitude : null,
            'heading' => $partner->heading !== null ? (float) $partner->heading : null,
            'speed' => $partner->speed !== null ? (float) $partner->speed : null,
            'accuracy' => $partner->accuracy !== null ? (float) $partner->accuracy : null,
            'recorded_at' => $partner->last_location_at?->toISOString(),
            'is_stale' => $this->isStale($partner),
        ];
    }

    private function clampNullable(mixed $value, float $min, float $max): ?float
    {
        if ($value === null || $value === '') {
            return null;
        }

        return max($min, min($max, (float) $value));
    }

    /**
     * Reject pings arriving faster than the configured minimum interval,
     * using the server-side accepted timestamp only (never a client clock).
     *
     * @throws \InvalidArgumentException when the ping violates the cooldown
     */
    private function assertWithinMinimumInterval(DeliveryPartner $partner): void
    {
        $minInterval = (int) config('tracking.location_min_interval_seconds', 0);
        $lastAccepted = $partner->last_location_at;

        if ($minInterval > 0 && $lastAccepted !== null
            && $lastAccepted->copy()->addSeconds($minInterval)->gt(now())) {
            throw new \InvalidArgumentException(
                'Location update too frequent; wait before sending another update'
            );
        }
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
}
