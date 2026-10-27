<?php

namespace App\Services;

use App\Infrastructure\Interfaces\MapProviderInterface;
use App\Infrastructure\Providers\Implementations\GoogleMapsProvider;
use App\Infrastructure\Providers\Implementations\NominatimProvider;
use App\Infrastructure\Providers\Maps\MockMapsProvider;
use App\Services\Integration\IntegrationConfigResolver;
use App\Services\Integration\IntegrationManager;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class GeocodingService
{
    public function __construct(
        protected IntegrationConfigResolver $resolver,
        protected IntegrationManager $manager,
    ) {}

    /**
     * Geocoding attempts are best-effort: any failure returns null so the
     * caller can persist the address without coordinates rather than erroring.
     */
    public function enabled(): bool
    {
        return (bool) config('services.geocoding.enabled');
    }

    public function correlationId(): string
    {
        return substr((string) Str::uuid(), 0, 8);
    }

    /**
     * Choose the active lane.
     *
     * - google: the configured provider is Google AND a real server key exists
     *   (this is honoured even in THIRD_PARTY_MODE=mock, matching integration
     *   hub behaviour where stored keys are meant to be used).
     * - mock: every other case. Deterministic and offline; never calls out.
     *
     * Nominatim is never a primary lane — it is only used as a fallback when
     * the Google request fails.
     *
     * @return array{provider: string}
     */
    protected function lane(): array
    {
        $resolved = $this->resolver->resolve('maps');
        $serverKey = $resolved['credentials']['server_key'] ?? null;
        $configured = (string) ($resolved['configured_provider'] ?? $resolved['provider'] ?? 'mock');

        if ($configured === 'google' && ! blank($serverKey)) {
            return ['provider' => 'google'];
        }

        return ['provider' => 'mock'];
    }

    /**
     * @return array{latitude: float, longitude: float, address: string, formatted_address: string, provider: string, place_id: ?string, street: ?string, city: ?string, state: ?string, postal_code: ?string, country: ?string, locality: ?string, area: ?string}|null
     */
    public function geocode(string $query): ?array
    {
        if (! $this->enabled() || trim($query) === '') {
            return null;
        }

        $correlationId = $this->correlationId();

        if ($this->lane()['provider'] === 'google') {
            $raw = $this->google()->geocode($query);

            if (($raw['status'] ?? '') === 'OK' && ! empty($raw['results'][0])) {
                return $this->fromGeocodeResult($raw['results'][0], 'google');
            }

            $this->logFallback('geocode', $raw, $correlationId);

            return $this->nominatimGeocode($query);
        }

        $raw = $this->mock()->geocode($query);

        if (($raw['status'] ?? '') === 'OK' && ! empty($raw['results'][0])) {
            return $this->fromGeocodeResult($raw['results'][0], 'mock');
        }

        return null;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function autocomplete(string $query, ?string $country = null): array
    {
        return $this->autocompletePayload($query, $country)['results'];
    }

    /**
     * Search results plus provider metadata so callers can tell whether Google
     * served the request or Nominatim was used as a fallback.
     *
     * @return array{results: array<int, array<string, mixed>>, provider: ?string, fallback: bool, correlation_id: ?string}
     */
    public function autocompletePayload(string $query, ?string $country = null): array
    {
        if (! $this->enabled() || trim($query) === '') {
            return ['results' => [], 'provider' => null, 'fallback' => false, 'correlation_id' => null];
        }

        $correlationId = $this->correlationId();

        if ($this->lane()['provider'] === 'google') {
            $raw = $this->google()->placesAutocomplete($query, ['country' => $country]);

            if (($raw['status'] ?? '') === 'OK') {
                return [
                    'results' => $this->fromPredictions($raw['predictions'] ?? [], 'google'),
                    'provider' => 'google',
                    'fallback' => false,
                    'correlation_id' => $correlationId,
                ];
            }

            if (($raw['status'] ?? '') === 'ZERO_RESULTS') {
                return [
                    'results' => [],
                    'provider' => 'google',
                    'fallback' => false,
                    'correlation_id' => $correlationId,
                ];
            }

            $this->logFallback('autocomplete', $raw, $correlationId);

            return [
                'results' => $this->nominatimAutocomplete($query, $country),
                'provider' => 'nominatim',
                'fallback' => true,
                'correlation_id' => $correlationId,
            ];
        }

        $raw = $this->mock()->placesAutocomplete($query, ['country' => $country]);

        if (($raw['status'] ?? '') === 'OK') {
            return [
                'results' => $this->fromPredictions($raw['predictions'] ?? [], 'mock'),
                'provider' => 'mock',
                'fallback' => false,
                'correlation_id' => $correlationId,
            ];
        }

        return ['results' => [], 'provider' => 'mock', 'fallback' => false, 'correlation_id' => $correlationId];
    }

    /**
     * @return array<string, mixed>|null
     */
    public function details(string $placeId): ?array
    {
        if (! $this->enabled()) {
            return null;
        }

        $correlationId = $this->correlationId();

        if ($this->lane()['provider'] === 'google') {
            $raw = $this->google()->placeDetails($placeId);

            if (($raw['status'] ?? '') === 'OK' && isset($raw['place'])) {
                return $this->fromPredictions([$raw['place']], 'google')[0] ?? null;
            }

            $this->logFallback('details', $raw, $correlationId);

            return null;
        }

        $raw = $this->mock()->placeDetails($placeId);

        if (($raw['status'] ?? '') === 'OK' && isset($raw['place'])) {
            return $this->fromPredictions([$raw['place']], 'mock')[0] ?? null;
        }

        return null;
    }

    /**
     * @return array{latitude: float, longitude: float, address: string, formatted_address: string, provider: string, place_id: ?string, street: ?string, city: ?string, state: ?string, postal_code: ?string, country: ?string, locality: ?string, area: ?string}|null
     */
    public function reverse(float $latitude, float $longitude): ?array
    {
        if (! $this->enabled()) {
            return null;
        }

        $correlationId = $this->correlationId();

        if ($this->lane()['provider'] === 'google') {
            $raw = $this->google()->reverseGeocode($latitude, $longitude);

            if (($raw['status'] ?? '') === 'OK' && ! empty($raw['results'][0])) {
                return $this->fromGeocodeResult($raw['results'][0], 'google');
            }

            $this->logFallback('reverse', $raw, $correlationId);

            return $this->nominatimReverse($latitude, $longitude);
        }

        $raw = $this->mock()->reverseGeocode($latitude, $longitude);

        if (($raw['status'] ?? '') === 'OK' && ! empty($raw['results'][0])) {
            return $this->fromGeocodeResult($raw['results'][0], 'mock');
        }

        return null;
    }

    public function queryFor(array $data): string
    {
        return implode(', ', array_filter(
            [
                $data['address_line_1'] ?? null,
                $data['address_line_2'] ?? null,
                $data['landmark'] ?? null,
                $data['city'] ?? null,
                $data['state'] ?? null,
                $data['postal_code'] ?? null,
                $data['country'] ?? null,
            ],
            fn ($part) => ! blank($part)
        ));
    }

    protected function google(): GoogleMapsProvider
    {
        return $this->manager->providerFor('maps', 'google', MapProviderInterface::class);
    }

    protected function mock(): MockMapsProvider
    {
        return $this->manager->providerFor('maps', 'mock', MapProviderInterface::class);
    }

    protected function nominatim(): NominatimProvider
    {
        return new NominatimProvider;
    }

    /**
     * Build a place contract from a uniform prediction/place (Google Places API
     * New or the mock equivalent), preserving legacy aliases for the frontend.
     *
     * @return array<string, mixed>
     */
    protected function fromPredictions(array $predictions, string $provider): array
    {
        return array_values(array_map(
            fn (array $prediction) => $this->placeFromPrediction($prediction, $provider),
            $predictions
        ));
    }

    /**
     * @return array<string, mixed>
     */
    protected function placeFromPrediction(array $prediction, string $provider): array
    {
        $components = $this->placesNewComponentMap($prediction['address_components'] ?? []);
        $placeId = $prediction['place_id'] ?? null;
        $formatted = $prediction['formatted_address'] ?? null;

        return [
            'provider' => $provider,
            'place_id' => $placeId,
            'id' => $placeId,
            'name' => $prediction['name'] ?? null,
            'main' => $prediction['name'] ?? $formatted ?? 'Address',
            'formatted_address' => $formatted,
            'address' => $formatted,
            'text' => $formatted ?? '',
            'secondary' => $this->secondaryLine($components),
            'latitude' => isset($prediction['latitude']) ? (float) $prediction['latitude'] : null,
            'longitude' => isset($prediction['longitude']) ? (float) $prediction['longitude'] : null,
            'city' => $components['city'] ?? null,
            'state' => $components['state'] ?? null,
            'postal_code' => $components['postal_code'] ?? null,
            'country' => $components['country'] ?? null,
            'locality' => $components['locality'] ?? $components['area'] ?? null,
            'area' => $components['area'] ?? $components['suburb'] ?? null,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    protected function fromGeocodeResult(array $result, string $provider): array
    {
        $components = $this->componentMap($result['address_components'] ?? []);
        $location = $result['geometry']['location'] ?? [];

        $latitude = isset($location['lat']) ? (float) $location['lat'] : (isset($location['latitude']) ? (float) $location['latitude'] : null);
        $longitude = isset($location['lng']) ? (float) $location['lng'] : (isset($location['longitude']) ? (float) $location['longitude'] : null);

        return $this->reverseContract(
            $latitude,
            $longitude,
            $result['formatted_address'] ?? null,
            $components,
            $provider,
            $result['place_id'] ?? null,
        );
    }

    /**
     * @return array{latitude: float, longitude: float, address: string, formatted_address: string, provider: string, place_id: ?string, street: ?string, city: ?string, state: ?string, postal_code: ?string, country: ?string, locality: ?string, area: ?string}
     */
    protected function reverseContract(float|int|null $latitude, float|int|null $longitude, ?string $address, array $components, string $provider, ?string $placeId = null): array
    {
        return [
            'provider' => $provider,
            'place_id' => $placeId,
            'latitude' => $latitude !== null ? (float) $latitude : 0.0,
            'longitude' => $longitude !== null ? (float) $longitude : 0.0,
            'address' => $address ?? '',
            'formatted_address' => $address ?? '',
            'street' => $components['route'] ?? $components['road'] ?? $components['neighbourhood'] ?? $components['suburb'] ?? null,
            'city' => $components['city'] ?? $components['locality'] ?? $components['town'] ?? $components['village'] ?? $components['county'] ?? null,
            'state' => $components['state'] ?? $components['administrative_area_level_1'] ?? null,
            'postal_code' => $components['postal_code'] ?? $components['postcode'] ?? null,
            'country' => $components['country'] ?? null,
            'locality' => $components['locality'] ?? $components['neighborhood'] ?? $components['sublocality_level_1'] ?? $components['sublocality'] ?? null,
            'area' => $components['neighborhood'] ?? $components['sublocality_level_1'] ?? $components['sublocality'] ?? $components['suburb'] ?? null,
        ];
    }

    /**
     * @return array{street: ?string, city: ?string, state: ?string, postal_code: ?string, country: ?string, locality: ?string, area: ?string, suburb: ?string}
     */
    protected function placesNewComponentMap(array $components): array
    {
        $value = function (array $types) use ($components): ?string {
            foreach ($components as $component) {
                $labels = $component['types'] ?? [];
                if (array_intersect($types, $labels) !== []) {
                    return $component['long_text']
                        ?? $component['longText']
                        ?? $component['short_text']
                        ?? $component['shortText']
                        ?? $component['long_name']
                        ?? null;
                }
            }

            return null;
        };

        return [
            'street' => $value(['route', 'road']),
            'city' => $value(['locality', 'postal_town', 'administrative_area_level_2']),
            'state' => $value(['administrative_area_level_1']),
            'postal_code' => $value(['postal_code']),
            'country' => $value(['country']),
            'locality' => $value(['sublocality', 'sublocality_level_1', 'neighborhood']),
            'area' => $value(['neighborhood', 'sublocality', 'sublocality_level_1']),
            'suburb' => $value(['suburb']),
        ];
    }

    /**
     * @return array<string, string>
     */
    protected function componentMap(array $components): array
    {
        $map = [];
        foreach ($components as $component) {
            $type = $component['types'][0] ?? null;
            if ($type !== null) {
                $map[$type] = $component['long_name'] ?? $component['short_name'] ?? '';
            }
        }

        return $map;
    }

    protected function secondaryLine(array $components): ?string
    {
        $parts = array_filter([
            $components['city'] ?? null,
            $components['state'] ?? null,
            $components['country'] ?? null,
        ], fn ($value) => ! blank($value));

        return $parts === [] ? null : implode(', ', $parts);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    protected function nominatimAutocomplete(string $query, ?string $country): array
    {
        $results = $this->nominatim()->search($query, 5, $country);

        return array_values(array_map(
            fn (array $item) => $this->placeFromNominatimItem($item),
            $results
        ));
    }

    /**
     * @return array<string, mixed>
     */
    protected function placeFromNominatimItem(array $item): array
    {
        $address = $item['address'] ?? [];
        $placeId = "nominatim:{$item['osm_type']}:{$item['osm_id']}";

        return [
            'provider' => 'nominatim',
            'place_id' => $placeId,
            'id' => $placeId,
            'name' => $item['name'] ?? null,
            'main' => $item['name'] ?? $item['display_name'] ?? 'Address',
            'formatted_address' => $item['display_name'] ?? null,
            'address' => $item['display_name'] ?? null,
            'text' => $item['display_name'] ?? '',
            'secondary' => trim(implode(', ', array_filter([
                $address['city'] ?? null,
                $address['state'] ?? null,
                $address['country'] ?? null,
            ], fn ($value) => ! blank($value)))),
            'latitude' => isset($item['lat']) ? (float) $item['lat'] : null,
            'longitude' => isset($item['lon']) ? (float) $item['lon'] : null,
            'city' => $address['city'] ?? $address['town'] ?? $address['village'] ?? $address['county'] ?? null,
            'state' => $address['state'] ?? null,
            'postal_code' => $address['postcode'] ?? null,
            'country' => $address['country'] ?? null,
            'locality' => $address['suburb'] ?? $address['neighbourhood'] ?? null,
            'area' => $address['neighbourhood'] ?? $address['suburb'] ?? null,
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    protected function nominatimGeocode(string $query): ?array
    {
        $results = $this->nominatim()->search($query, 1);

        if (blank($results[0]['lat'] ?? null) || blank($results[0]['lon'] ?? null)) {
            return null;
        }

        $item = $results[0];
        $address = $item['address'] ?? [];

        return $this->reverseContract(
            (float) $item['lat'],
            (float) $item['lon'],
            $item['display_name'] ?? null,
            $this->nominatimAddressMap($address),
            'nominatim',
            "nominatim:{$item['osm_type']}:{$item['osm_id']}",
        );
    }

    /**
     * @return array<string, mixed>|null
     */
    protected function nominatimReverse(float $latitude, float $longitude): ?array
    {
        $data = $this->nominatim()->reverse($latitude, $longitude);

        if ($data === null) {
            return null;
        }

        return $this->reverseContract(
            $latitude,
            $longitude,
            $data['display_name'] ?? null,
            $this->nominatimAddressMap($data['address'] ?? []),
            'nominatim',
        );
    }

    /**
     * @return array{street: ?string, city: ?string, state: ?string, postal_code: ?string, country: ?string, locality: ?string, area: ?string, suburb: ?string}
     */
    protected function nominatimAddressMap(array $address): array
    {
        return [
            'street' => $address['road'] ?? $address['pedestrian'] ?? null,
            'city' => $address['city'] ?? $address['locality'] ?? $address['postal_town'] ?? $address['town'] ?? $address['village'] ?? $address['county'] ?? null,
            'state' => $address['state'] ?? null,
            'postal_code' => $address['postcode'] ?? null,
            'country' => $address['country'] ?? null,
            'locality' => $address['locality'] ?? $address['town'] ?? $address['village'] ?? null,
            'area' => $address['neighbourhood'] ?? $address['suburb'] ?? null,
            'suburb' => $address['suburb'] ?? null,
        ];
    }

    protected function logFallback(string $operation, array $raw, string $correlationId): void
    {
        Log::warning('Google Maps request failed; falling back to Nominatim', [
            'provider' => 'google',
            'fallback' => 'nominatim',
            'operation' => $operation,
            'http_status' => $raw['http_status'] ?? null,
            'google_status' => $raw['status'] ?? null,
            'google_error' => $raw['error']['message'] ?? $raw['status_message'] ?? $raw['error_message'] ?? $raw['error'] ?? null,
            'correlation_id' => $correlationId,
        ]);
    }
}
