<?php

namespace App\Services\Tracking;

use App\Models\Driver;
use App\Models\Ride;
use App\Models\User;
use App\Services\RideService;
use Illuminate\Support\Facades\Cache;

/**
 * Server-authoritative customer/driver/admin ride tracking payload.
 *
 * Ownership checks happen in the controller; this service only assembles
 * data that is safe to expose (never phone numbers, bank/KYC data or internal
 * dispatch details).
 */
class RideTrackingService
{
    /**
     * Statuses during which the driver is actively moving on a live map.
     */
    public const ACTIVE_TRACKING_STATUSES = [
        Ride::STATUS_DRIVER_ASSIGNED,
        Ride::STATUS_DRIVER_ARRIVING,
        Ride::STATUS_DRIVER_ARRIVED,
        Ride::STATUS_IN_PROGRESS,
    ];

    private const TERMINAL_STATUSES = [
        Ride::STATUS_COMPLETED,
        Ride::STATUS_CANCELLED,
        Ride::STATUS_NO_DRIVER_FOUND,
    ];

    private const STAGE_PICKUP = 'to_pickup';

    private const STAGE_DESTINATION = 'to_destination';

    public function __construct(private RideService $rideService) {}

    /**
     * Backend ownership policy for ride tracking access: the customer who
     * booked, an admin/super-admin, or the assigned driver.
     */
    public function canTrack(User $user, Ride $ride): bool
    {
        if ((int) $ride->user_id === (int) $user->id) {
            return true;
        }

        if (in_array($user->user_type, ['admin', 'super_admin'], true)) {
            return true;
        }

        if ($user->user_type === 'driver' && $ride->driver_id) {
            $driver = Driver::where('user_id', $user->id)->first();

            return $driver !== null && (int) $driver->id === (int) $ride->driver_id;
        }

        return false;
    }

    /**
     * Full safe tracking snapshot.
     *
     * @return array<string, mixed>
     */
    public function payload(Ride $ride): array
    {
        $ride = $ride->loadMissing(['driver.user', 'driver.vehicleType', 'vehicleType']);
        $driver = $ride->driver;

        $location = $driver ? $this->locationFor($driver) : null;
        $route = $this->routeFor($ride);
        $eta = $this->etaFor($ride, $route);

        return [
            'ride' => $this->rideSummary($ride),
            'driver' => $driver ? $this->driverSafe($driver) : null,
            'location' => $location,
            'route' => $route,
            'eta' => $eta,
            'tracking' => [
                'enabled' => ! in_array($ride->status, self::TERMINAL_STATUSES, true),
                'in_progress' => in_array($ride->status, self::ACTIVE_TRACKING_STATUSES, true),
                'stage' => $this->stage($ride),
                'source' => $this->realtimeConfigured() ? 'realtime' : 'polling',
                'last_updated_at' => $driver?->last_location_at?->toISOString(),
                'location_stale' => (bool) ($location['is_stale'] ?? false),
            ],
        ];
    }

    /**
     * Safe ride summary used by the tracking response.
     *
     * @return array<string, mixed>
     */
    public function rideSummary(Ride $ride): array
    {
        $timestamps = [];
        foreach ([
            'driver_assigned_at', 'driver_arriving_at', 'driver_arrived_at',
            'trip_started_at', 'trip_completed_at', 'cancelled_at',
        ] as $field) {
            if ($ride->{$field} !== null) {
                $timestamps[$field] = $ride->{$field}->toISOString();
            }
        }

        return [
            'id' => $ride->id,
            'ride_number' => $ride->ride_number,
            'status' => $ride->status,
            'pickup' => $this->pickupFor($ride),
            'destination' => $this->destinationFor($ride),
            'timestamps' => $timestamps,
            'cancel_reason' => $ride->status === Ride::STATUS_CANCELLED ? $ride->cancel_reason : null,
        ];
    }

    /**
     * Privacy-safe driver profile (no phone, bank or KYC data).
     *
     * @return array<string, mixed>
     */
    public function driverSafe(Driver $driver): array
    {
        $user = $driver->user;

        return [
            'id' => $driver->id,
            'name' => $user?->name ?: 'Driver',
            'photo' => $user?->avatar,
            'vehicle_type' => $driver->vehicleType?->name,
            'vehicle_number' => $this->maskVehicleNumber($driver->vehicle_number),
            'vehicle_model' => $driver->vehicle_model,
            'vehicle_color' => $driver->vehicle_color,
            'rating' => $driver->rating !== null ? (float) $driver->rating : null,
        ];
    }

    /**
     * Latest driver position with explicit freshness. Stale positions keep
     * their last-known coordinates but are flagged so clients never present
     * them as live.
     *
     * @return array<string, mixed>
     */
    public function locationFor(Driver $driver): array
    {
        $freshness = (int) config('tracking.location_freshness_seconds', 30);
        $recordedAt = $driver->last_location_at;
        $isStale = $recordedAt === null || $recordedAt->lt(now()->subSeconds($freshness));

        return [
            'lat' => $driver->latitude !== null ? (float) $driver->latitude : null,
            'lng' => $driver->longitude !== null ? (float) $driver->longitude : null,
            'heading' => $driver->heading !== null ? (float) $driver->heading : null,
            'speed' => $driver->speed !== null ? (float) $driver->speed : null,
            'accuracy' => $driver->accuracy !== null ? (float) $driver->accuracy : null,
            'recorded_at' => $recordedAt?->toISOString(),
            'is_stale' => $isStale,
        ];
    }

    /**
     * Route appropriate to the ride stage, computed from authoritative
     * pickup/destination coordinates and the driver's current position.
     *
     *   before trip start -> driver -> pickup
     *   during trip       -> driver -> destination
     *
     * Route/ETA are cached so a small marker movement never triggers a
     * provider route recalculation.
     *
     * @return array{polyline: string|null, distance_km: float|null, duration_min: int|null, source: string|null, status: string}
     */
    public function routeFor(Ride $ride): array
    {
        $idle = ['polyline' => null, 'distance_km' => null, 'duration_min' => null, 'source' => null, 'status' => 'idle'];

        $ride->loadMissing('driver');
        $driver = $ride->driver;

        if (! $driver || $driver->latitude === null || $driver->longitude === null) {
            return $idle;
        }

        if (in_array($ride->status, self::TERMINAL_STATUSES, true)) {
            return $idle;
        }

        $destination = $this->destinationFor($ride);

        if (! $destination) {
            return $idle;
        }

        $origin = ['latitude' => (float) $driver->latitude, 'longitude' => (float) $driver->longitude];
        $key = 'tracking:ride:route:'.$ride->id.':'.($this->stage($ride) ?? 'idle');
        $ttl = (int) config('tracking.route_recalc_interval_seconds', 30);

        try {
            return Cache::remember($key, $ttl, function () use ($origin, $destination) {
                $route = $this->rideService->directionsForRoute($origin, $destination);

                return [
                    'polyline' => $route['polyline'] ?? null,
                    'distance_km' => isset($route['distance_km']) ? (float) $route['distance_km'] : null,
                    'duration_min' => isset($route['duration_min']) ? (int) $route['duration_min'] : null,
                    'source' => $route['source'] ?? null,
                    'status' => $route['status'] ?? 'OK',
                ];
            });
        } catch (\Throwable $e) {
            report($e);

            return $idle;
        }
    }

    /**
     * Backend-authoritative ETA. Uses the provider route duration when
     * available, otherwise a simple distance/speed heuristic. Returns null when
     * no ETA is meaningful (completed, cancelled, no driver yet).
     */
    public function etaFor(Ride $ride, array $route): ?int
    {
        if (in_array($ride->status, self::TERMINAL_STATUSES, true)) {
            return null;
        }

        if ($ride->status === Ride::STATUS_DRIVER_ARRIVED) {
            return 0;
        }

        $durationMin = $route['duration_min'] ?? null;
        if ($durationMin !== null && $durationMin >= 0) {
            return max(1, (int) $durationMin);
        }

        $ride->loadMissing('driver');
        $driver = $ride->driver;
        $destination = $this->destinationFor($ride);

        if (! $driver || $driver->latitude === null || $driver->longitude === null || ! $destination) {
            return null;
        }

        $speedKmh = (float) config('tracking.eta_average_speed_kmh', 25);
        $km = $this->haversineKm(
            (float) $driver->latitude,
            (float) $driver->longitude,
            $destination['latitude'],
            $destination['longitude']
        );

        return max(1, (int) round($km / max(1, $speedKmh) * 60));
    }

    public function realtimeConfigured(): bool
    {
        $default = config('broadcasting.default');

        return ! blank($default)
            && isset(config('broadcasting.connections')[$default])
            && $default !== 'null'
            && $default !== 'log';
    }

    /**
     * @return array{latitude: float, longitude: float, address: string|null}|null
     */
    private function pickupFor(Ride $ride): ?array
    {
        if ($ride->pickup_latitude === null || $ride->pickup_longitude === null) {
            return null;
        }

        return [
            'latitude' => (float) $ride->pickup_latitude,
            'longitude' => (float) $ride->pickup_longitude,
            'address' => $ride->pickup_address,
        ];
    }

    /**
     * @return array{latitude: float, longitude: float, address: string|null}|null
     */
    private function destinationFor(Ride $ride): ?array
    {
        if ($this->stage($ride) === self::STAGE_DESTINATION) {
            if ($ride->destination_latitude === null || $ride->destination_longitude === null) {
                return null;
            }

            return [
                'latitude' => (float) $ride->destination_latitude,
                'longitude' => (float) $ride->destination_longitude,
                'address' => $ride->destination_address,
            ];
        }

        return $this->pickupFor($ride);
    }

    private function stage(Ride $ride): ?string
    {
        if (in_array($ride->status, self::TERMINAL_STATUSES, true)) {
            return null;
        }

        return $ride->status === Ride::STATUS_IN_PROGRESS
            ? self::STAGE_DESTINATION
            : self::STAGE_PICKUP;
    }

    private function maskVehicleNumber(?string $number): ?string
    {
        if (blank($number)) {
            return null;
        }

        if (strlen($number) <= 4) {
            return $number;
        }

        return str_repeat('*', strlen($number) - 4).substr($number, -4);
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
