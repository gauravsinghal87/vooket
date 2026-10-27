<?php

namespace App\Services\Maps;

use App\Models\Zone;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;

/**
 * Zone resolution and serviceability engine.
 *
 * A zone owns an optional polygon boundary (GeoJSON [longitude, latitude]
 * order) plus a circular radius fallback around its centre. Point-in-polygon
 * is the authoritative check; when a zone has no polygon the radius fallback
 * is used. Overlapping zones are resolved deterministically by priority
 * (higher number wins), then by id.
 *
 * Neither the frontend nor the customer SDK is ever authoritative for
 * serviceability — backend resolution always decides.
 */
class ZoneService
{
    /**
     * Cache key holding a monotonic counter that changes whenever an admin
     * edits a zone's boundary, services, radius or cross-zone flags. Customer
     * clients echo it back so cached listings expired against old zone rules
     * cannot keep serving a stale service area.
     */
    public const CONFIG_VERSION_KEY = 'zones.config_version';

    public const SERVICE_FOOD = 'food';

    public const SERVICE_GROCERY = 'grocery';

    public const SERVICE_RIDE = 'ride';

    public const REASON_OUTSIDE_SERVICE_AREA = 'OUTSIDE_SERVICE_AREA';

    public const REASON_ZONE_DISABLED = 'ZONE_DISABLED';

    public const REASON_SERVICE_DISABLED = 'SERVICE_NOT_AVAILABLE_IN_ZONE';

    public const REASON_NO_ZONE = 'NO_ZONE_DEFINED';

    public const REASON_INVALID_COORDINATES = 'INVALID_COORDINATES';

    public function services(): array
    {
        return [self::SERVICE_FOOD, self::SERVICE_GROCERY, self::SERVICE_RIDE];
    }

    /**
     * Resolve the best active zone for a coordinate and service type, or null
     * when the point is outside every zone that offers the service.
     */
    public function resolve(?float $latitude, ?float $longitude, string $service): ?Zone
    {
        if (! $this->validCoordinates($latitude, $longitude)) {
            return null;
        }

        return $this->activeServiceZones($service)
            ->first(fn (Zone $zone): bool => $this->contains($zone, $latitude, $longitude));
    }

    /**
     * Authoritative serviceability result for a coordinate + service pair.
     *
     * Strict semantics: missing/invalid coordinates, no active zone for the
     * service, or a coordinate outside every zone that offers the service all
     * resolve to `serviceable = false` with a machine-readable reason. There is
     * no "bootstrap grace" fallback — an unresolved location is never treated
     * as serviceable.
     *
     * @return array{serviceable: bool, zone: array{id: int, name: string}|null, model: Zone|null, service: string, reason: string|null}
     */
    public function isServiceable(?float $latitude, ?float $longitude, string $service): array
    {
        if (! $this->validCoordinates($latitude, $longitude)) {
            return $this->result(false, null, $service, self::REASON_INVALID_COORDINATES);
        }

        if ($this->activeServiceZones($service)->isEmpty()) {
            return $this->result(false, null, $service, self::REASON_NO_ZONE);
        }

        $zone = $this->resolve($latitude, $longitude, $service);

        if ($zone !== null) {
            return $this->result(true, $zone, $service, null);
        }

        if ($this->candidateZones($latitude, $longitude)->isNotEmpty()) {
            return $this->result(false, null, $service, self::REASON_SERVICE_DISABLED);
        }

        return $this->result(false, null, $service, self::REASON_OUTSIDE_SERVICE_AREA);
    }

    /**
     * Monotonic counter that changes whenever an admin edits a zone's boundary,
     * services, radius or cross-zone flags. Customer clients can echo it back so
     * listings cached against old zone rules are expired instead of reused.
     */
    public function configurationVersion(): int
    {
        return (int) Cache::get(self::CONFIG_VERSION_KEY, 1);
    }

    public function bumpConfigurationVersion(): int
    {
        if (! Cache::has(self::CONFIG_VERSION_KEY)) {
            Cache::forever(self::CONFIG_VERSION_KEY, 1);
        }

        return (int) Cache::increment(self::CONFIG_VERSION_KEY);
    }

    /**
     * Active zones that enable the requested service, sorted by priority desc,
     * id asc (deterministic overlap resolution).
     *
     * @return Collection<int, Zone>
     */
    public function activeServiceZones(string $service): Collection
    {
        $column = $this->serviceColumn($service);

        if ($column === null) {
            return collect();
        }

        return Zone::query()
            ->where('is_active', true)
            ->where($column, true)
            ->orderByDesc('priority')
            ->orderBy('id')
            ->get();
    }

    /**
     * @return array{serviceable: bool, zone: array{id: int, name: string}|null, model: Zone|null, service: string, reason: string|null}
     */
    protected function result(bool $serviceable, ?Zone $zone, string $service, ?string $reason): array
    {
        return [
            'serviceable' => $serviceable,
            'zone' => $zone ? ['id' => $zone->id, 'name' => $zone->name] : null,
            'model' => $zone,
            'service' => $service,
            'reason' => $reason,
        ];
    }

    protected function serviceColumn(string $service): ?string
    {
        return match ($service) {
            self::SERVICE_FOOD => 'food_enabled',
            self::SERVICE_GROCERY => 'grocery_enabled',
            self::SERVICE_RIDE => 'ride_enabled',
            default => null,
        };
    }

    /**
     * All zones that geometrically contain the point, sorted by priority desc,
     * id asc (deterministic overlap resolution).
     *
     * @return Collection<int, Zone>
     */
    public function candidateZones(float $latitude, float $longitude): Collection
    {
        return Zone::query()
            ->where('is_active', true)
            ->orderByDesc('priority')
            ->orderBy('id')
            ->get()
            ->filter(fn (Zone $zone) => $this->contains($zone, $latitude, $longitude))
            ->values();
    }

    /**
     * Does the zone contain the point using its polygon (preferred) or radius?
     */
    public function contains(Zone $zone, float $latitude, float $longitude): bool
    {
        $boundary = $zone->getBoundaryAttribute();

        if ($boundary !== []) {
            return $this->pointInPolygon($latitude, $longitude, $boundary);
        }

        if ($zone->radius_km === null || $zone->center_latitude === null || $zone->center_longitude === null) {
            return false;
        }

        return $this->distanceKm(
            $latitude,
            $longitude,
            (float) $zone->center_latitude,
            (float) $zone->center_longitude
        ) <= (float) $zone->radius_km;
    }

    /**
     * Ray-casting point-in-polygon on GeoJSON [longitude, latitude] tuples.
     *
     * @param  array<int, array{longitude: float, latitude: float}>  $boundary
     */
    public function pointInPolygon(float $latitude, float $longitude, array $boundary): bool
    {
        $vertices = array_values($boundary);
        $count = count($vertices);

        if ($count < 3) {
            return false;
        }

        $inside = false;

        for ($i = 0, $j = $count - 1; $i < $count; $j = $i++) {
            $vi = $vertices[$i];
            $vj = $vertices[$j];
            $intersects = (($vi['longitude'] > $longitude) !== ($vj['longitude'] > $longitude))
                && ($latitude < (($vj['latitude'] - $vi['latitude']) * ($longitude - $vi['longitude'])) / ($vj['longitude'] - $vi['longitude']) + $vi['latitude']);

            if ($intersects) {
                $inside = ! $inside;
            }
        }

        return $inside;
    }

    /**
     * Approximate geodesic distance between two coordinates (km).
     */
    public function distanceKm(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $earthRadius = 6371;
        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);
        $a = sin($dLat / 2) * sin($dLat / 2) + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) * sin($dLng / 2);

        return round($earthRadius * 2 * atan2(sqrt($a), sqrt(1 - $a)), 2);
    }

    /**
     * Validate an admin-provided polygon boundary before persistence.
     *
     * @return array{valid: bool, errors: array<int, string>}
     */
    public function validatePolygon(array $polygon): array
    {
        $errors = [];

        if (count($polygon) < 3) {
            $errors[] = 'A zone boundary must contain at least 3 vertices.';
        }

        foreach ($polygon as $index => $point) {
            $latitude = $this->pointValue($point, 'lat', 'latitude');
            $longitude = $this->pointValue($point, 'lng', 'longitude') ?? $this->pointValue($point, 'lon');

            if (! is_numeric($latitude) || ! is_numeric($longitude)) {
                $errors[] = "Vertex #{$index} has missing or invalid coordinates.";

                continue;
            }

            if ((float) $latitude < -90 || (float) $latitude > 90 || (float) $longitude < -180 || (float) $longitude > 180) {
                $errors[] = "Vertex #{$index} is outside valid coordinate bounds.";
            }
        }

        // Reject self-crossing/closed rings that don't enclose meaningful area.
        if (empty($errors) && $this->polygonAreaSquareKm($polygon) < 0.001) {
            $errors[] = 'The polygon encloses less than ~0.001 km² of area.';
        }

        return ['valid' => $errors === [], 'errors' => $errors];
    }

    /**
     * Normalise a bound array of map-editor vertices into GeoJSON
     * [longitude, latitude] order for persistent storage.
     *
     * @return array<int, array{longitude: float, latitude: float}>
     */
    public function normalizePolygon(array $polygon): array
    {
        return array_values(array_map(function (array $point): array {
            $latitude = (float) ($this->pointValue($point, 'lat') ?? $this->pointValue($point, 'latitude') ?? 0);
            $longitude = (float) ($this->pointValue($point, 'lng') ?? $this->pointValue($point, 'longitude') ?? $this->pointValue($point, 'lon') ?? 0);

            return ['longitude' => $longitude, 'latitude' => $latitude];
        }, $polygon));
    }

    protected function validCoordinates(?float $latitude, ?float $longitude): bool
    {
        return $latitude !== null && $longitude !== null
            && $latitude >= -90 && $latitude <= 90
            && $longitude >= -180 && $longitude <= 180;
    }

    protected function pointValue(array $point, string ...$keys): mixed
    {
        foreach ($keys as $key) {
            if (array_key_exists($key, $point)) {
                return $point[$key];
            }
        }

        return null;
    }

    /**
     * Approximate polygon area in square kilometres for sanity validation.
     * Uses the shoelace formula on a simple equirectangular projection —
     * precise enough to reject degenerate/miniscule rings.
     */
    protected function polygonAreaSquareKm(array $polygon): float
    {
        $points = $this->normalizePolygon($polygon);
        $count = count($points);

        if ($count < 3) {
            return 0;
        }

        $sum = 0.0;
        $radPerDegLat = deg2rad(1);

        for ($i = 0; $i < $count; $i++) {
            $current = $points[$i];
            $next = $points[($i + 1) % $count];
            $sum += deg2rad($current['longitude']) * deg2rad($next['latitude'])
                - deg2rad($next['longitude']) * deg2rad($current['latitude']);
        }

        $area = abs($sum / 2);

        return round($area * (111.32 * 111.32), 4);
    }
}
