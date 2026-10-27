<?php

namespace App\Services\Delivery;

use App\Models\Restaurant;
use App\Services\Maps\ZoneService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

/**
 * Food discovery serviceability.
 *
 * Resolves the customer's active Food zone with the shared {@see ZoneService}
 * (polygon preferred, radius fallback, highest priority wins) and narrows a
 * restaurant query to the outlets that can actually deliver to that location:
 *
 *  - the restaurant must lie within the resolved zone's food search radius
 *    (`food_partner_search_radius_km`, falling back to the zone radius); and
 *  - the restaurant must belong to the resolved zone (its vendor's `zone_id`),
 *    unless that zone allows cross-zone food delivery.
 *
 * A restaurant whose vendor has no zone is only listed when cross-zone food
 * delivery is enabled, so an unzoned outlet can never leak into every zone's
 * listing. When the location cannot be resolved to an eligible zone the query
 * matches nothing — the backend never falls back to "all restaurants".
 */
class FoodServiceabilityService
{
    public const REASON_LOCATION_REQUIRED = 'LOCATION_REQUIRED';

    /**
     * Haversine great-circle distance in kilometres, computed in SQL against
     * the `restaurants` table so the radius filter never loads rows it drops.
     *
     * The radius parameter is compared as `? + 0` rather than a bare `?`: PDO
     * can hand the bound radius to SQLite as a TEXT value, and SQLite sorts any
     * TEXT after every REAL, which would make the radius check silently pass
     * for every row. `+ 0` forces a numeric comparison on both SQLite and
     * MySQL without changing the result.
     */
    private const HAVERSINE_KM_SQL = '(6371 * 2 * ASIN(SQRT(POWER(SIN(RADIANS(restaurants.latitude - ?) / 2), 2) + COS(RADIANS(?)) * COS(RADIANS(restaurants.latitude)) * POWER(SIN(RADIANS(restaurants.longitude - ?) / 2), 2))))';

    public function __construct(private ZoneService $zones) {}

    /**
     * Resolve the serviceability of a customer coordinate for Food.
     *
     * @return array<string, mixed> `serviceable` plus the resolved zone details,
     *                              or `serviceable = false` with a `reason`.
     */
    public function resolve(?float $latitude, ?float $longitude): array
    {
        if ($latitude === null || $longitude === null) {
            return $this->unavailable(self::REASON_LOCATION_REQUIRED);
        }

        $check = $this->zones->isServiceable($latitude, $longitude, ZoneService::SERVICE_FOOD);

        if (! $check['serviceable']) {
            return $this->unavailable($check['reason'] ?? ZoneService::REASON_OUTSIDE_SERVICE_AREA);
        }

        $zone = $check['model'];

        if ($zone === null) {
            return $this->unavailable(ZoneService::REASON_OUTSIDE_SERVICE_AREA);
        }

        return [
            'serviceable' => true,
            'reason' => null,
            'zone' => $zone,
            'zone_id' => $zone->id,
            'zone_name' => $zone->name,
            'service' => ZoneService::SERVICE_FOOD,
            'search_radius_km' => $zone->searchRadiusKm(ZoneService::SERVICE_FOOD),
            'allows_cross_zone_food_delivery' => (bool) $zone->allow_cross_zone_food_delivery,
            'latitude' => $latitude,
            'longitude' => $longitude,
        ];
    }

    /**
     * Convenience wrapper that reads the coordinate pair off a request.
     *
     * @return array<string, mixed>
     */
    public function resolveFromRequest(Request $request): array
    {
        return $this->resolve(
            $this->coordinate($request->input('latitude')),
            $this->coordinate($request->input('longitude')),
        );
    }

    /**
     * Public, client-facing serviceability envelope (never exposes internals).
     *
     * @param  array<string, mixed>  $resolved
     * @return array<string, mixed>
     */
    public function payload(array $resolved): array
    {
        return [
            'is_serviceable' => (bool) ($resolved['serviceable'] ?? false),
            'reason' => $resolved['reason'] ?? null,
            'service' => ZoneService::SERVICE_FOOD,
            'zone_id' => $resolved['zone_id'] ?? null,
            'zone_name' => $resolved['zone_name'] ?? null,
            'search_radius_km' => $resolved['search_radius_km'] ?? null,
            'allows_cross_zone_food_delivery' => (bool) ($resolved['allows_cross_zone_food_delivery'] ?? false),
            'zone_version' => $this->zones->configurationVersion(),
        ];
    }

    /**
     * Apply the resolved zone rules to a restaurant query. An unresolvable
     * location collapses the query to an empty result set on purpose.
     *
     * @param  array<string, mixed>  $resolved
     */
    public function constrain(Builder $query, array $resolved): Builder
    {
        if (! ($resolved['serviceable'] ?? false)) {
            return $query->whereRaw('1 = 0');
        }

        $query->whereNotNull('restaurants.latitude')->whereNotNull('restaurants.longitude');

        $radius = $resolved['search_radius_km'] ?? null;

        if ($radius !== null) {
            $query->whereRaw(self::HAVERSINE_KM_SQL.' <= (? + 0)', [
                $resolved['latitude'],
                $resolved['latitude'],
                $resolved['longitude'],
                $radius,
            ]);
        }

        if (! ($resolved['allows_cross_zone_food_delivery'] ?? false)) {
            $query->whereHas('vendor', fn ($vendor) => $vendor->where('zone_id', $resolved['zone_id']));
        }

        return $query;
    }

    /**
     * Whether one restaurant (already loaded) is serviceable for the resolved
     * location. Mirrors {@see constrain()} for search results that come from a
     * provider instead of an Eloquent query.
     *
     * @param  array<string, mixed>  $resolved
     */
    public function restaurantIsServiceable(Restaurant $restaurant, array $resolved): bool
    {
        if (! ($resolved['serviceable'] ?? false)) {
            return false;
        }

        $latitude = $restaurant->latitude;
        $longitude = $restaurant->longitude;

        if ($latitude === null || $longitude === null) {
            return false;
        }

        $radius = $resolved['search_radius_km'] ?? null;

        if ($radius !== null && $this->zones->distanceKm(
            $resolved['latitude'],
            $resolved['longitude'],
            (float) $latitude,
            (float) $longitude,
        ) > $radius) {
            return false;
        }

        if (! ($resolved['allows_cross_zone_food_delivery'] ?? false)) {
            return (int) $restaurant->vendor?->zone_id === (int) $resolved['zone_id'];
        }

        return true;
    }

    /**
     * @return array<string, mixed>
     */
    private function unavailable(string $reason): array
    {
        return [
            'serviceable' => false,
            'reason' => $reason,
            'zone' => null,
            'zone_id' => null,
            'zone_name' => null,
            'service' => ZoneService::SERVICE_FOOD,
            'search_radius_km' => null,
            'allows_cross_zone_food_delivery' => false,
            'latitude' => null,
            'longitude' => null,
        ];
    }

    private function coordinate(mixed $value): ?float
    {
        if ($value === null || $value === '' || ! is_numeric($value)) {
            return null;
        }

        return (float) $value;
    }
}
