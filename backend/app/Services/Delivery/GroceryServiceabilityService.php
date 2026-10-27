<?php

namespace App\Services\Delivery;

use App\Models\Product;
use App\Models\Store;
use App\Services\Maps\ZoneService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

/**
 * Grocery discovery serviceability.
 *
 * Grocery mirror of {@see FoodServiceabilityService}: the customer's active
 * Grocery zone is resolved with the shared {@see ZoneService} (polygon
 * preferred, radius fallback, highest priority wins) and every store-facing
 * query is narrowed to the stores that can actually deliver there:
 *
 *  - the store must lie within the resolved zone's grocery search radius
 *    (`grocery_partner_search_radius_km`, falling back to the zone radius); and
 *  - the store must belong to the resolved zone (its vendor's `zone_id`),
 *    unless that zone allows cross-zone grocery delivery.
 *
 * A store whose vendor has no zone is only listed when cross-zone grocery
 * delivery is enabled, so an unzoned outlet can never leak into every zone's
 * listing. Product queries are scoped through the owning store, which is why a
 * product belonging to an ineligible store cannot be reached by calling a
 * different endpoint directly.
 *
 * The zone's own `grocery_enabled` flag is enforced by {@see ZoneService}
 * itself: a zone that has Grocery switched off is never returned as the
 * resolved zone, so the reason code comes back as
 * `SERVICE_NOT_AVAILABLE_IN_ZONE` (covered by a Grocery-disabled zone) or
 * `OUTSIDE_SERVICE_AREA` / `NO_ZONE_DEFINED`.
 *
 * When the location cannot be resolved to an eligible zone every query matches
 * nothing — the backend never falls back to "all stores".
 */
class GroceryServiceabilityService
{
    public const REASON_LOCATION_REQUIRED = 'LOCATION_REQUIRED';

    /**
     * Haversine great-circle distance in kilometres, computed in SQL against
     * the `stores` table so the radius filter never loads rows it drops.
     *
     * The radius parameter is compared as `? + 0` rather than a bare `?`: PDO
     * can hand the bound radius to SQLite as a TEXT value, and SQLite sorts any
     * TEXT after every REAL, which would make the radius check silently pass
     * for every row. `+ 0` forces a numeric comparison on both SQLite and
     * MySQL without changing the result.
     */
    private const HAVERSINE_KM_SQL = '(6371 * 2 * ASIN(SQRT(POWER(SIN(RADIANS(stores.latitude - ?) / 2), 2) + COS(RADIANS(?)) * COS(RADIANS(stores.latitude)) * POWER(SIN(RADIANS(stores.longitude - ?) / 2), 2))))';

    public function __construct(private ZoneService $zones) {}

    /**
     * Resolve the serviceability of a customer coordinate for Grocery.
     *
     * @return array<string, mixed> `serviceable` plus the resolved zone details,
     *                              or `serviceable = false` with a `reason`.
     */
    public function resolve(?float $latitude, ?float $longitude): array
    {
        if ($latitude === null || $longitude === null) {
            return $this->unavailable(self::REASON_LOCATION_REQUIRED);
        }

        $check = $this->zones->isServiceable($latitude, $longitude, ZoneService::SERVICE_GROCERY);

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
            'service' => ZoneService::SERVICE_GROCERY,
            'search_radius_km' => $zone->searchRadiusKm(ZoneService::SERVICE_GROCERY),
            'allows_cross_zone_grocery_delivery' => (bool) $zone->allow_cross_zone_grocery_delivery,
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
            'service' => ZoneService::SERVICE_GROCERY,
            'zone_id' => $resolved['zone_id'] ?? null,
            'zone_name' => $resolved['zone_name'] ?? null,
            'search_radius_km' => $resolved['search_radius_km'] ?? null,
            'allows_cross_zone_grocery_delivery' => (bool) ($resolved['allows_cross_zone_grocery_delivery'] ?? false),
            'zone_version' => $this->zones->configurationVersion(),
        ];
    }

    /**
     * Apply the resolved zone rules to a store query. An unresolvable location
     * collapses the query to an empty result set on purpose.
     *
     * @param  array<string, mixed>  $resolved
     */
    public function constrainStores(Builder $query, array $resolved): Builder
    {
        if (! ($resolved['serviceable'] ?? false)) {
            return $query->whereRaw('1 = 0');
        }

        $query->whereNotNull('stores.latitude')->whereNotNull('stores.longitude');

        $radius = $resolved['search_radius_km'] ?? null;

        if ($radius !== null) {
            $query->whereRaw(self::HAVERSINE_KM_SQL.' <= (? + 0)', [
                $resolved['latitude'],
                $resolved['latitude'],
                $resolved['longitude'],
                $radius,
            ]);
        }

        if (! ($resolved['allows_cross_zone_grocery_delivery'] ?? false)) {
            $query->whereHas('vendor', fn ($vendor) => $vendor->where('zone_id', $resolved['zone_id']));
        }

        return $query;
    }

    /**
     * Apply the resolved zone rules to a product query by scoping through the
     * owning store, so products of an ineligible store disappear from the
     * catalogue endpoints as well. Products without a store (restaurant dishes)
     * are not part of the grocery catalogue and are dropped by the same rule.
     *
     * @param  array<string, mixed>  $resolved
     */
    public function constrainProducts(Builder $query, array $resolved): Builder
    {
        if (! ($resolved['serviceable'] ?? false)) {
            return $query->whereRaw('1 = 0');
        }

        return $query->whereHas('store', fn (Builder $store) => $this->constrainStores($store, $resolved));
    }

    /**
     * Whether one store (already loaded) is serviceable for the resolved
     * location. Mirrors {@see constrainStores()} for results that come from a
     * provider instead of an Eloquent query.
     *
     * @param  array<string, mixed>  $resolved
     */
    public function storeIsServiceable(Store $store, array $resolved): bool
    {
        if (! ($resolved['serviceable'] ?? false)) {
            return false;
        }

        $latitude = $store->latitude;
        $longitude = $store->longitude;

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

        if (! ($resolved['allows_cross_zone_grocery_delivery'] ?? false)) {
            return (int) $store->vendor?->zone_id === (int) $resolved['zone_id'];
        }

        return true;
    }

    /**
     * Whether one product (already loaded) may be shown for the resolved
     * location. Non-grocery products are food-side data and are left to the
     * Food rules; every grocery product must belong to an eligible store.
     *
     * @param  array<string, mixed>  $resolved
     */
    public function productIsServiceable(Product $product, array $resolved): bool
    {
        if ($product->type !== 'grocery') {
            return true;
        }

        if (! ($resolved['serviceable'] ?? false)) {
            return false;
        }

        $store = $product->store;

        if (! $store instanceof Store) {
            return false;
        }

        return $this->storeIsServiceable($store, $resolved);
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
            'service' => ZoneService::SERVICE_GROCERY,
            'search_radius_km' => null,
            'allows_cross_zone_grocery_delivery' => false,
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
