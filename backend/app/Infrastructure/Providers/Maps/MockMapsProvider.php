<?php

namespace App\Infrastructure\Providers\Maps;

use App\Infrastructure\Interfaces\MapProviderInterface;
use App\Infrastructure\Interfaces\TestableProvider;
use App\Infrastructure\Providers\AbstractIntegrationProvider;

/**
 * In-memory/deterministic maps provider used in mock mode.
 *
 * Geocoding-facing methods (geocode, reverseGeocode, placesAutocomplete,
 * placeDetails) return the same shapes as GoogleMapsProvider so the
 * GeocodingService can normalise them through one code path.
 */
class MockMapsProvider extends AbstractIntegrationProvider implements MapProviderInterface, TestableProvider
{
    private const MOCK_STREET = 'MG Road';

    private const MOCK_CITY = 'Mumbai';

    private const MOCK_STATE = 'Maharashtra';

    private const MOCK_POSTAL = '400001';

    private const MOCK_COUNTRY = 'India';

    /**
     * Deterministic reverse-geocode lookup for common Indian cities so the
     * "use my location" flow in mock mode resolves to the user's real city
     * instead of a fixed fixture. Bounds are approximate (lat/lng ranges).
     *
     * @var array<int, array{city: string, state: string, postal_code: string, lat_min: float, lng_min: float, lat_max: float, lng_max: float}>
     */
    private const INDIA_CITIES = [
        ['city' => 'Mumbai', 'state' => 'Maharashtra', 'postal_code' => '400001', 'lat_min' => 18.90, 'lng_min' => 72.70, 'lat_max' => 19.30, 'lng_max' => 73.00],
        ['city' => 'Pune', 'state' => 'Maharashtra', 'postal_code' => '411001', 'lat_min' => 18.40, 'lng_min' => 73.70, 'lat_max' => 18.70, 'lng_max' => 74.00],
        ['city' => 'Jaipur', 'state' => 'Rajasthan', 'postal_code' => '302001', 'lat_min' => 26.80, 'lng_min' => 75.60, 'lat_max' => 27.00, 'lng_max' => 75.90],
        ['city' => 'Delhi', 'state' => 'Delhi', 'postal_code' => '110001', 'lat_min' => 28.40, 'lng_min' => 76.80, 'lat_max' => 28.90, 'lng_max' => 77.40],
        ['city' => 'Bengaluru', 'state' => 'Karnataka', 'postal_code' => '560001', 'lat_min' => 12.80, 'lng_min' => 77.40, 'lat_max' => 13.20, 'lng_max' => 77.80],
        ['city' => 'Hyderabad', 'state' => 'Telangana', 'postal_code' => '500001', 'lat_min' => 17.20, 'lng_min' => 78.30, 'lat_max' => 17.60, 'lng_max' => 78.60],
        ['city' => 'Chennai', 'state' => 'Tamil Nadu', 'postal_code' => '600001', 'lat_min' => 12.90, 'lng_min' => 80.10, 'lat_max' => 13.20, 'lng_max' => 80.35],
        ['city' => 'Kolkata', 'state' => 'West Bengal', 'postal_code' => '700001', 'lat_min' => 22.40, 'lng_min' => 88.20, 'lat_max' => 22.70, 'lng_max' => 88.50],
        ['city' => 'Ahmedabad', 'state' => 'Gujarat', 'postal_code' => '380001', 'lat_min' => 22.90, 'lng_min' => 72.40, 'lat_max' => 23.10, 'lng_max' => 72.70],
        ['city' => 'Lucknow', 'state' => 'Uttar Pradesh', 'postal_code' => '226001', 'lat_min' => 26.70, 'lng_min' => 80.80, 'lat_max' => 26.90, 'lng_max' => 81.00],
    ];

    /**
     * Approximate continental India bounding box used to tag country for
     * unknown-in-mock coordinates.
     *
     * @var array{lat_min: float, lat_max: float, lng_min: float, lng_max: float}
     */
    private const INDIA_BOUNDS = ['lat_min' => 6.0, 'lat_max' => 37.5, 'lng_min' => 68.0, 'lng_max' => 97.5];

    public function geocode(string $address): array
    {
        return [
            'status' => 'OK',
            'results' => [$this->mockResult($address)],
            'mock' => true,
        ];
    }

    public function reverseGeocode(float $latitude, float $longitude): array
    {
        $city = $this->findCity($latitude, $longitude);

        $address = $city !== null
            ? $city['city'].', '.$city['state'].', '.self::MOCK_COUNTRY
            : $this->coordinatesAddress($latitude, $longitude);

        return [
            'status' => 'OK',
            'results' => [$this->reverseResult($latitude, $longitude, $address, $city)],
            'mock' => true,
        ];
    }

    /**
     * @return array{city: string, state: string, postal_code: string, lat_min: float, lng_min: float, lat_max: float, lng_max: float}|null
     */
    protected function findCity(float $latitude, float $longitude): ?array
    {
        foreach (self::INDIA_CITIES as $city) {
            if (
                $latitude >= $city['lat_min'] && $latitude <= $city['lat_max']
                && $longitude >= $city['lng_min'] && $longitude <= $city['lng_max']
            ) {
                return $city;
            }
        }

        return null;
    }

    protected function isWithinIndia(float $latitude, float $longitude): bool
    {
        return $latitude >= self::INDIA_BOUNDS['lat_min']
            && $latitude <= self::INDIA_BOUNDS['lat_max']
            && $longitude >= self::INDIA_BOUNDS['lng_min']
            && $longitude <= self::INDIA_BOUNDS['lng_max'];
    }

    protected function coordinatesAddress(float $latitude, float $longitude): string
    {
        return $this->isWithinIndia($latitude, $longitude)
            ? sprintf('%s, %s, %s', $latitude, $longitude, self::MOCK_COUNTRY)
            : sprintf('%s, %s', $latitude, $longitude);
    }

    /**
     * @return array{formatted_address: string, geometry: array, address_components: array}
     */
    protected function reverseResult(float $latitude, float $longitude, string $address, ?array $city): array
    {
        $components = [
            ['types' => ['route'], 'long_name' => self::MOCK_STREET],
        ];

        if ($city !== null) {
            $components[] = ['types' => ['locality'], 'long_name' => $city['city']];
            $components[] = ['types' => ['administrative_area_level_1'], 'long_name' => $city['state']];
            $components[] = ['types' => ['postal_code'], 'long_name' => $city['postal_code']];
        }

        if ($city !== null || $this->isWithinIndia($latitude, $longitude)) {
            $components[] = ['types' => ['country'], 'long_name' => self::MOCK_COUNTRY];
        }

        return [
            'formatted_address' => $address,
            'geometry' => ['location' => ['lat' => $latitude, 'lng' => $longitude]],
            'address_components' => $components,
        ];
    }

    /**
     * Alternate spellings/aliases so common Indian city searches still resolve
     * even when they don't match the canonical city name used in INDIA_CITIES.
     *
     * @var array<string, string> alias => canonical city name
     */
    private const CITY_ALIASES = [
        'bangalore' => 'Bengaluru',
        'bombay' => 'Mumbai',
        'new delhi' => 'Delhi',
        'ncr' => 'Delhi',
        'bengaluru' => 'Bengaluru',
        'madras' => 'Chennai',
        'calcutta' => 'Kolkata',
    ];

    public function placesAutocomplete(string $query, array $options = []): array
    {
        $needle = $this->normaliseQuery($query);

        if ($needle === '') {
            return [
                'status' => 'ZERO_RESULTS',
                'predictions' => [],
                'mock' => true,
            ];
        }

        foreach (self::INDIA_CITIES as $city) {
            if ($this->cityMatchesQuery($city, $needle)) {
                $predictions[] = $this->predictionFor($query, $city);
            }
        }

        $predictions ??= [];

        // Soft current-location bias: rank matched cities by proximity to the
        // supplied location, nearest first. This only reorders results and
        // never restricts which predictions are returned.
        if (isset($options['latitude'], $options['longitude'])) {
            $currentLat = (float) $options['latitude'];
            $currentLng = (float) $options['longitude'];

            usort($predictions, function (array $a, array $b) use ($currentLat, $currentLng): int {
                $aDistance = $this->squaredDistance($currentLat, $currentLng, (float) $a['latitude'], (float) $a['longitude']);
                $bDistance = $this->squaredDistance($currentLat, $currentLng, (float) $b['latitude'], (float) $b['longitude']);

                return $aDistance <=> $bDistance;
            });
        }

        // No known city token matched: surface every Indian city as a
        // prediction so search reflects the query across the whole country
        // instead of collapsing to one fixed/nearest city. Each prediction
        // keeps the typed text in its formatted address; ordering is handled by
        // the proximity bias below (reorder only, never restricts).
        if ($predictions === []) {
            foreach (self::INDIA_CITIES as $city) {
                $predictions[] = $this->predictionFor($query, $city);
            }
        }

        return [
            'status' => 'OK',
            'predictions' => $predictions,
            'mock' => true,
        ];
    }

    /**
     * Lowercase, trim and strip non-alphanumerics so city matching tolerates
     * suffixes such as "railway station" or "airport".
     */
    protected function normaliseQuery(string $query): string
    {
        return preg_replace('/[^a-z0-9]/', '', mb_strtolower(trim($query))) ?? '';
    }

    /**
     * @param  array{city: string, state: string}  $city
     */
    protected function cityMatchesQuery(array $city, string $needle): bool
    {
        $cityName = $this->normaliseQuery($city['city']);
        $stateName = $this->normaliseQuery($city['state']);
        $alias = strtr($cityName, $this->aliasMapKeys());

        return $needle !== ''
            && (
                str_contains($needle, $cityName)
                || str_contains($needle, $alias)
                || str_contains($needle, $stateName)
            );
    }

    /**
     * @return array<string, string>
     */
    protected function aliasMapKeys(): array
    {
        return array_fill_keys(array_keys(self::CITY_ALIASES), '');
    }

    /**
     * @param  array{city: string, state: string, postal_code: string}  $city
     * @return array{place_id: string, name: string, formatted_address: string, latitude: float, longitude: float, address_components: array}
     */
    protected function predictionFor(string $query, array $city): array
    {
        $latitude = (($city['lat_min'] ?? 0.0) + ($city['lat_max'] ?? 0.0)) / 2;
        $longitude = (($city['lng_min'] ?? 0.0) + ($city['lng_max'] ?? 0.0)) / 2;

        return [
            'place_id' => 'place_mock_'.md5($query.'|'.$city['city']),
            'name' => $city['city'],
            'formatted_address' => sprintf('%s, %s, %s, %s', $query, $city['city'], $city['state'], self::MOCK_COUNTRY),
            'latitude' => $latitude,
            'longitude' => $longitude,
            'address_components' => [
                ['types' => ['locality'], 'long_text' => $city['city'], 'short_text' => $city['city']],
                ['types' => ['administrative_area_level_1'], 'long_text' => $city['state'], 'short_text' => $city['state']],
                ['types' => ['postal_code'], 'long_text' => $city['postal_code'], 'short_text' => $city['postal_code']],
                ['types' => ['country'], 'long_text' => self::MOCK_COUNTRY, 'short_text' => 'IN'],
            ],
        ];
    }

    /**
     * @param  array<string, mixed>  $options
     * @return array{latitude: float, longitude: float, city: string, state: string, postal_code: string}
     */
    protected function fallbackLocation(array $options): array
    {
        $latitude = isset($options['latitude']) ? (float) $options['latitude'] : \INF;
        $longitude = isset($options['longitude']) ? (float) $options['longitude'] : \INF;

        $nearest = self::INDIA_CITIES[0];
        $nearestDistance = \INF;

        foreach (self::INDIA_CITIES as $city) {
            $cityLat = ((float) $city['lat_min'] + (float) $city['lat_max']) / 2;
            $cityLng = ((float) $city['lng_min'] + (float) $city['lng_max']) / 2;

            if ($latitude !== \INF && $longitude !== \INF) {
                $distance = $this->squaredDistance($latitude, $longitude, $cityLat, $cityLng);
            } else {
                $distance = \INF;
            }

            if ($distance < $nearestDistance) {
                $nearestDistance = $distance;
                $nearest = $city;
            }
        }

        return $nearest;
    }

    protected function squaredDistance(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $dLat = $lat2 - $lat1;
        $dLng = $lng2 - $lng1;

        return ($dLat * $dLat) + ($dLng * $dLng);
    }

    public function placeDetails(string $placeId, array $options = []): array
    {
        $query = str_replace('place_mock_', '', (string) $placeId);

        return [
            'status' => 'OK',
            'place' => $this->mockPrediction($query),
            'mock' => true,
        ];
    }

    public function distanceMatrix(array $origins, array $destinations): array
    {
        return [
            'rows' => [
                'origin' => $origins,
                'destination' => $destinations,
                'distance_km' => 5.0,
                'duration_mins' => 20,
            ],
            'mock' => true,
        ];
    }

    public function directions(array $origin, array $destination, array $options = []): array
    {
        return [
            'origin' => $origin,
            'destination' => $destination,
            'polyline' => 'mock_polyline',
            'distance_km' => 5.0,
            'duration_mins' => 20,
            'mock' => true,
        ];
    }

    public function calculateDistanceAndTime(array $origin, array $destination): array
    {
        return [
            'distance_km' => 5.0,
            'duration_mins' => 20,
            'duration_text' => '20 mins',
            'mock' => true,
        ];
    }

    public function validateAddress(array $latLng): array
    {
        return [
            'is_valid' => true,
            'latitude' => $latLng['latitude'] ?? null,
            'longitude' => $latLng['longitude'] ?? null,
            'mock' => true,
        ];
    }

    public function testConnection(): array
    {
        $serverKey = $this->cred('server_key');
        $browserKey = $this->cred('browser_key');

        if (blank($serverKey) && blank($browserKey)) {
            return ['success' => false, 'message' => 'Add a Google Maps server and/or browser key to enable maps.'];
        }

        return [
            'success' => true,
            'message' => 'Mock maps provider ready'
                .(blank($serverKey) ? '' : ' (server key set)')
                .(blank($browserKey) ? '' : ' (browser key set)')
                .'. Switch THIRD_PARTY_MODE to test/live to verify the keys against Google.',
        ];
    }

    /**
     * @return array{formatted_address: string, geometry: array, address_components: array}
     */
    protected function mockResult(string $address): array
    {
        return [
            'formatted_address' => $address,
            'geometry' => [
                'location' => ['lat' => 19.076, 'lng' => 72.8777],
            ],
            'address_components' => [
                ['types' => ['route'], 'long_name' => self::MOCK_STREET],
                ['types' => ['locality'], 'long_name' => self::MOCK_CITY],
                ['types' => ['administrative_area_level_1'], 'long_name' => self::MOCK_STATE],
                ['types' => ['postal_code'], 'long_name' => self::MOCK_POSTAL],
                ['types' => ['country'], 'long_name' => self::MOCK_COUNTRY],
            ],
        ];
    }

    /**
     * @return array{place_id: string, name: string, formatted_address: string, latitude: float, longitude: float, address_components: array}
     */
    protected function mockPrediction(string $query): array
    {
        return [
            'place_id' => 'place_mock_'.md5($query),
            'name' => $query,
            'formatted_address' => trim($query.', '.self::MOCK_CITY.', '.self::MOCK_STATE.', '.self::MOCK_COUNTRY),
            'latitude' => 19.076,
            'longitude' => 72.8777,
            'address_components' => [
                ['types' => ['locality'], 'long_text' => self::MOCK_CITY, 'short_text' => self::MOCK_CITY],
                ['types' => ['administrative_area_level_1'], 'long_text' => self::MOCK_STATE, 'short_text' => self::MOCK_STATE],
                ['types' => ['postal_code'], 'long_text' => self::MOCK_POSTAL, 'short_text' => self::MOCK_POSTAL],
                ['types' => ['country'], 'long_text' => self::MOCK_COUNTRY, 'short_text' => 'IN'],
            ],
        ];
    }
}
