<?php

namespace App\Services\Delivery;

use App\Infrastructure\Interfaces\MapProviderInterface;
use App\Services\Integration\IntegrationConfigResolver;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

/**
 * Measures driving legs for the food delivery ETA.
 *
 * A "leg" is {@see travel()} between two coordinate pairs. Live Google legs go
 * through {@see MapProviderInterface} (the same provider the ride/grocery
 * flows use) and are cached per rounded coordinate pair; the cache is what
 * keeps a restaurant listing from issuing one Google request per card on
 * every render. If Google fails we serve the last known good leg from a
 * longer-lived stale entry rather than inventing a duration.
 *
 * When the configured maps provider is not a live routing provider (mock /
 * development) a straight-line leg is used and flagged `approximate`, so the
 * API never claims a straight line is a driving route.
 */
class FoodEtaRouteResolver
{
    public function __construct(private IntegrationConfigResolver $integrations) {}

    /**
     * Whether a live routing provider (Google) is currently configured.
     */
    public function live(): bool
    {
        return $this->integrations->provider('maps') === 'google';
    }

    /**
     * Driving estimate for one origin → destination pair.
     *
     * @return array{minutes: float, distance_km: float, source: string, approximate: bool}|null
     *                                                                                           null only when a live provider cannot be reached and no
     *                                                                                           previously measured leg is available.
     */
    public function travel(float $fromLat, float $fromLng, float $toLat, float $toLng): ?array
    {
        $key = $this->cacheKey($fromLat, $fromLng, $toLat, $toLng);

        if (is_array($cached = Cache::get($key))) {
            return $cached + ['source' => 'cache'];
        }

        if (! $this->live()) {
            return $this->approximate($fromLat, $fromLng, $toLat, $toLng);
        }

        $leg = $this->measure($fromLat, $fromLng, $toLat, $toLng);

        if ($leg !== null) {
            $this->remember($key, $leg);

            return $leg + ['source' => 'google'];
        }

        if (is_array($stale = Cache::get($key.':stale'))) {
            return $stale + ['source' => 'cache_stale', 'approximate' => true];
        }

        return null;
    }

    /**
     * Driving estimates for many origins to one destination, measured with a
     * single batched Distance Matrix call per chunk of misses.
     *
     * @param  array<int, array{latitude: float, longitude: float}>  $origins
     * @param  array{latitude: float, longitude: float}  $destination
     * @return array<int, array{minutes: float, distance_km: float, source: string, approximate: bool}>
     */
    public function travelMany(array $origins, array $destination): array
    {
        $results = [];
        $misses = [];

        foreach ($origins as $index => $origin) {
            $key = $this->cacheKey($origin['latitude'], $origin['longitude'], $destination['latitude'], $destination['longitude']);

            if (is_array($cached = Cache::get($key))) {
                $results[$index] = $cached + ['source' => 'cache'];

                continue;
            }

            if (! $this->live() && ! config('delivery_eta.allow_approx_routes', true)) {
                continue;
            }

            $misses[$index] = $origin;
        }

        if ($misses === []) {
            return $results;
        }

        if (! $this->live()) {
            foreach ($misses as $index => $origin) {
                $results[$index] = $this->approximate($origin['latitude'], $origin['longitude'], $destination['latitude'], $destination['longitude']);
            }

            return $results;
        }

        $maps = app(MapProviderInterface::class);

        foreach (array_chunk($misses, (int) config('delivery_eta.matrix_chunk_size', 25), true) as $chunk) {
            $measured = $this->measureBatch($maps, array_values($chunk), $destination);

            foreach (array_keys($chunk) as $offset => $index) {
                $origin = $chunk[$index];
                $leg = $measured[$offset] ?? null;
                $key = $this->cacheKey($origin['latitude'], $origin['longitude'], $destination['latitude'], $destination['longitude']);

                if ($leg !== null) {
                    $this->remember($key, $leg);
                    $results[$index] = $leg + ['source' => 'google'];

                    continue;
                }

                if (is_array($stale = Cache::get($key.':stale'))) {
                    $results[$index] = $stale + ['source' => 'cache_stale', 'approximate' => true];
                }
            }
        }

        return $results;
    }

    /**
     * One live measurement; null when the provider did not return usable data.
     *
     * @return array{minutes: float, distance_km: float, approximate: bool}|null
     */
    private function measure(float $fromLat, float $fromLng, float $toLat, float $toLng): ?array
    {
        try {
            $result = app(MapProviderInterface::class)->calculateDistanceAndTime(
                ['latitude' => $fromLat, 'longitude' => $fromLng],
                ['latitude' => $toLat, 'longitude' => $toLng],
            );

            return $this->legFrom($result);
        } catch (\Throwable $e) {
            Log::warning('[ETA] route lookup failed', ['error' => $e->getMessage()]);

            return null;
        }
    }

    /**
     * @param  array<int, array{latitude: float, longitude: float}>  $origins
     * @return array<int, array{minutes: float, distance_km: float, approximate: bool}|null>
     */
    private function measureBatch(MapProviderInterface $maps, array $origins, array $destination): array
    {
        try {
            $matrix = $maps->distanceMatrix($origins, [$destination]);
        } catch (\Throwable $e) {
            Log::warning('[ETA] distance matrix failed', ['error' => $e->getMessage()]);

            return [];
        }

        $rows = $matrix['rows'] ?? [];

        if (! is_array($rows) || $rows === []) {
            return [];
        }

        $legs = [];

        foreach (array_values($rows) as $offset => $row) {
            if (! is_array($row)) {
                continue;
            }

            $element = $row['elements'][0] ?? null;
            $leg = $this->legFromElement($element);

            if ($leg !== null) {
                $legs[$offset] = $leg;
            }
        }

        return $legs;
    }

    /**
     * Normalise a single-provider response. Google returns `duration_min`;
     * the mock provider returns `duration_mins`.
     *
     * @return array{minutes: float, distance_km: float, approximate: bool}|null
     */
    private function legFrom(mixed $result): ?array
    {
        if (! is_array($result)) {
            return null;
        }

        $distance = isset($result['distance_km']) ? (float) $result['distance_km'] : null;
        $duration = $result['duration_min'] ?? $result['duration_mins'] ?? null;

        if ($distance === null || $distance <= 0.0 || $duration === null || (float) $duration <= 0) {
            return null;
        }

        return [
            'minutes' => round((float) $duration, 1),
            'distance_km' => round($distance, 2),
            'approximate' => (bool) ($result['approximate'] ?? false),
        ];
    }

    /**
     * @return array{minutes: float, distance_km: float, approximate: bool}|null
     */
    private function legFromElement(mixed $element): ?array
    {
        if (! is_array($element) || ($element['status'] ?? '') !== 'OK') {
            return null;
        }

        $distanceKm = ((float) ($element['distance']['value'] ?? 0)) / 1000;
        $durationMin = ((float) ($element['duration']['value'] ?? 0)) / 60;

        if ($distanceKm <= 0.0 || $durationMin <= 0.0) {
            return null;
        }

        return [
            'minutes' => round($durationMin, 1),
            'distance_km' => round($distanceKm, 2),
            'approximate' => false,
        ];
    }

    /**
     * @return array{minutes: float, distance_km: float, source: string, approximate: bool}|null
     */
    private function approximate(float $fromLat, float $fromLng, float $toLat, float $toLng): ?array
    {
        if (! config('delivery_eta.allow_approx_routes', true)) {
            return null;
        }

        $distanceKm = $this->haversineKm($fromLat, $fromLng, $toLat, $toLng);

        if ($distanceKm === null) {
            return null;
        }

        $speedKmh = max(1.0, (float) config('delivery_eta.approx_speed_kmh', 22));

        return [
            'minutes' => round(max(1.0, $distanceKm / $speedKmh * 60), 1),
            'distance_km' => round($distanceKm, 2),
            'source' => 'fallback',
            'approximate' => true,
        ];
    }

    private function remember(string $key, array $leg): void
    {
        Cache::put($key, $leg, (int) config('delivery_eta.cache_ttl_seconds', 900));
        Cache::put($key.':stale', $leg, (int) config('delivery_eta.stale_cache_ttl_seconds', 86400));
    }

    private function cacheKey(float $fromLat, float $fromLng, float $toLat, float $toLng): string
    {
        $precision = max(1, (int) config('delivery_eta.coordinate_precision', 4));

        return sprintf(
            'food_eta:route:%s:%s',
            $this->round($fromLat, $precision).','.$this->round($fromLng, $precision),
            $this->round($toLat, $precision).','.$this->round($toLng, $precision)
        );
    }

    private function round(float $value, int $precision): string
    {
        return number_format($value, $precision, '.', '');
    }

    private function haversineKm(float $lat1, float $lng1, float $lat2, float $lng2): ?float
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
