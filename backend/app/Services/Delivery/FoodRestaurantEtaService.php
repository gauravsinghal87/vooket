<?php

namespace App\Services\Delivery;

use App\Models\DeliveryPartner;
use App\Models\Restaurant;
use App\Services\RestaurantOperatingHoursService;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

/**
 * Estimated delivery time (ETA) for a food restaurant, computed from real
 * restaurant data for a specific customer location.
 *
 *     ETA = max(preparation_minutes, rider_arrival_minutes)   // they overlap
 *           + restaurant_to_customer_minutes
 *           + operational_buffer_minutes
 *
 * This is the *browsing* estimate shown on restaurant cards. It is separate
 * from the order-tracking ETA, which is recomputed from an assigned partner
 * and the live route once an order exists.
 *
 * The estimate degrades honestly: closed restaurants and restaurants for
 * which the customer location or the restaurant coordinates are missing get
 * `status = closed|unavailable` with null minute boundaries, never a number
 * that looks like a promise.
 */
class FoodRestaurantEtaService
{
    public const STATUS_ESTIMATED = 'estimated';

    public const STATUS_UNAVAILABLE = 'unavailable';

    public const STATUS_CLOSED = 'closed';

    private const RIDER_UNAVAILABLE_STATUSES = ['pending', 'rejected', 'suspended'];

    public function __construct(
        private FoodEtaRouteResolver $routes,
    ) {}

    /**
     * The customer location sent with a discovery request, if any. Used only
     * to compute the browsing ETA — never persisted and never logged.
     *
     * @return array{latitude: float, longitude: float}|null
     */
    public static function destinationFrom(Request $request): ?array
    {
        if (! $request->filled('latitude') || ! $request->filled('longitude')) {
            return null;
        }

        return [
            'latitude' => (float) $request->input('latitude'),
            'longitude' => (float) $request->input('longitude'),
        ];
    }

    /**
     * Attach a `delivery_eta` payload to every restaurant in the collection.
     *
     * @param  Collection<int, Restaurant>|array<int, Restaurant>  $restaurants
     * @param  array{latitude: float|int, longitude: float|int}|null  $destination
     */
    public function attach(Collection|array $restaurants, ?array $destination = null): void
    {
        $restaurants = collect($restaurants)->filter(fn ($restaurant) => $restaurant instanceof Restaurant)->values();

        if ($restaurants->isEmpty()) {
            return;
        }

        $destination = $this->point($destination);
        $partners = $destination === null ? collect() : $this->availablePartners();

        // Measure every restaurant → customer leg in one batched distance-matrix
        // call instead of one routing request per card.
        $legs = [];

        if ($destination !== null) {
            $origins = [];

            foreach ($restaurants as $index => $restaurant) {
                $origin = $this->point([
                    'latitude' => $restaurant->latitude,
                    'longitude' => $restaurant->longitude,
                ]);

                if ($restaurant->is_open_now && $origin !== null) {
                    $origins[$index] = $origin;
                }
            }

            if ($origins !== []) {
                $legs = $this->routes->travelMany($origins, $destination);
            }
        }

        foreach ($restaurants as $index => $restaurant) {
            $restaurant->setAttribute('delivery_eta', $this->estimate(
                $restaurant,
                $destination,
                $partners,
                $legs[$index] ?? null,
                true,
            ));
        }
    }

    /**
     * @param  array{latitude: float|int, longitude: float|int}|null  $destination
     * @param  Collection<int, DeliveryPartner>|null  $partners
     * @param  array{minutes: float, distance_km: float, source: string, approximate: bool}|null  $travel
     * @return array<string, mixed>
     */
    public function estimate(
        Restaurant $restaurant,
        ?array $destination = null,
        ?Collection $partners = null,
        ?array $travel = null,
        bool $travelResolved = false,
    ): array {
        $destination = $this->point($destination);
        $preparation = $this->preparationMinutes($restaurant);
        $buffer = (int) config('delivery_eta.buffer_minutes', 5);

        $base = [
            'status' => self::STATUS_UNAVAILABLE,
            'min_minutes' => null,
            'max_minutes' => null,
            'preparation_minutes' => $preparation,
            'pickup_minutes' => null,
            'pickup_source' => 'fallback',
            'travel_minutes' => null,
            'travel_distance_km' => null,
            'route_source' => null,
            'buffer_minutes' => $buffer,
            'approximate' => false,
            'reason' => null,
            'computed_at' => now()->toIso8601String(),
        ];

        if (! $restaurant->is_open_now) {
            return array_replace($base, ['status' => self::STATUS_CLOSED, 'reason' => 'closed']);
        }

        $origin = $this->point([
            'latitude' => $restaurant->latitude,
            'longitude' => $restaurant->longitude,
        ]);

        if ($origin === null) {
            return array_replace($base, ['reason' => 'restaurant_location_missing']);
        }

        if ($destination === null) {
            return array_replace($base, ['reason' => 'customer_location_missing']);
        }

        if (! $travelResolved) {
            $travel = $this->routes->travel(
                $origin['latitude'],
                $origin['longitude'],
                $destination['latitude'],
                $destination['longitude'],
            );
        }

        if ($travel === null) {
            return array_replace($base, ['reason' => 'route_unavailable']);
        }

        $pickup = $this->pickupPhase($restaurant, $partners);

        // Preparation and rider arrival overlap.
        $wait = max($preparation, $pickup['minutes']);
        $total = $wait + (float) $travel['minutes'] + $buffer;

        $min = max(1, (int) round($total));
        $spread = max(0, (int) config('delivery_eta.range_spread_minutes', 5));

        return array_replace($base, [
            'status' => self::STATUS_ESTIMATED,
            'min_minutes' => $min,
            'max_minutes' => $min + $spread,
            'pickup_minutes' => (int) round($pickup['minutes']),
            'pickup_source' => $pickup['source'],
            'travel_minutes' => (int) round($travel['minutes']),
            'travel_distance_km' => $travel['distance_km'],
            'route_source' => $travel['source'],
            'approximate' => (bool) $travel['approximate'],
            'reason' => null,
        ]);
    }

    /**
     * How long until a partner can reach the restaurant.
     *
     * Uses the nearest available, online partner with a live location when one
     * exists; otherwise the configured conservative fallback. Never invents a
     * partner.
     *
     * @param  Collection<int, DeliveryPartner>|null  $partners
     * @return array{minutes: float, source: string}
     */
    private function pickupPhase(Restaurant $restaurant, ?Collection $partners): array
    {
        $fallback = (float) config('delivery_eta.fallback_pickup_minutes', 12);
        $radius = (float) config('delivery_eta.rider_radius_km', 4);

        $origin = $this->point([
            'latitude' => $restaurant->latitude,
            'longitude' => $restaurant->longitude,
        ]);

        if ($origin === null || $partners === null || $partners->isEmpty()) {
            return ['minutes' => $fallback, 'source' => 'fallback'];
        }

        [$partner, $distanceKm] = $this->nearestPartner($origin, $partners, $radius);

        if ($partner === null || $distanceKm === null) {
            return ['minutes' => $fallback, 'source' => 'fallback'];
        }

        $leg = $this->routes->travel(
            (float) $partner->latitude,
            (float) $partner->longitude,
            $origin['latitude'],
            $origin['longitude'],
        );

        if ($leg === null) {
            return ['minutes' => $fallback, 'source' => 'fallback'];
        }

        return ['minutes' => max(1.0, (float) $leg['minutes']), 'source' => 'partner'];
    }

    /**
     * @param  array{latitude: float, longitude: float}  $origin
     * @param  Collection<int, DeliveryPartner>  $partners
     * @return array{0: DeliveryPartner|null, 1: float|null}
     */
    private function nearestPartner(array $origin, Collection $partners, float $radiusKm): array
    {
        $best = null;
        $bestDistance = null;

        foreach ($partners as $partner) {
            if ($partner->latitude === null || $partner->longitude === null) {
                continue;
            }

            $distance = $this->distanceKm(
                $origin['latitude'],
                $origin['longitude'],
                (float) $partner->latitude,
                (float) $partner->longitude
            );

            if ($distance === null || $distance > $radiusKm) {
                continue;
            }

            if ($bestDistance === null || $distance < $bestDistance) {
                $best = $partner;
                $bestDistance = $distance;
            }
        }

        return [$best, $bestDistance];
    }

    /**
     * Available, online, fresh food partners — the browsing equivalent of the
     * dispatch eligibility query. (A browsing estimate cannot know the
     * eventual order's zone, so zone is not applied here.)
     *
     * @return Collection<int, DeliveryPartner>
     */
    private function availablePartners(): Collection
    {
        $query = DeliveryPartner::query()
            ->where('service_type', 'food')
            ->whereNotIn('status', self::RIDER_UNAVAILABLE_STATUSES)
            ->where('is_online', true)
            ->whereNotNull('latitude')
            ->whereNotNull('longitude');

        $freshnessMinutes = config('dispatch.location_freshness_minutes');

        if ($freshnessMinutes !== null) {
            $query->where('last_location_at', '>=', now()->subMinutes((int) $freshnessMinutes));
        }

        return $query
            ->limit((int) config('delivery_eta.rider_candidate_limit', 500))
            ->get(['id', 'latitude', 'longitude', 'current_zone_id', 'last_location_at']);
    }

    private function preparationMinutes(Restaurant $restaurant): int
    {
        $value = $restaurant->avg_prep_time_min;

        if ($value === null || $value === '') {
            return (int) RestaurantOperatingHoursService::DEFAULT_PREPARATION_TIME_MIN;
        }

        return max(1, (int) round((float) $value));
    }

    /**
     * @param  array{latitude: float|int, longitude: float|int}|null  $point
     * @return array{latitude: float, longitude: float}|null
     */
    private function point(?array $point): ?array
    {
        if ($point === null || ! isset($point['latitude'], $point['longitude'])) {
            return null;
        }

        $latitude = (float) $point['latitude'];
        $longitude = (float) $point['longitude'];

        if ($latitude == 0.0 && $longitude == 0.0) {
            return null;
        }

        if (abs($latitude) > 90 || abs($longitude) > 180) {
            return null;
        }

        return ['latitude' => $latitude, 'longitude' => $longitude];
    }

    private function distanceKm(float $lat1, float $lng1, float $lat2, float $lng2): ?float
    {
        if (abs($lat1) > 90 || abs($lat2) > 90 || abs($lng1) > 180 || abs($lng2) > 180) {
            return null;
        }

        $earthRadius = 6371.0;
        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);

        $a = sin($dLat / 2) ** 2
            + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;

        return 2 * $earthRadius * asin(min(1.0, sqrt($a)));
    }
}
