<?php

namespace App\Infrastructure\Providers\Implementations;

use App\Infrastructure\Interfaces\MapProviderInterface;
use App\Infrastructure\Interfaces\TestableProvider;
use App\Infrastructure\Providers\AbstractIntegrationProvider;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class GoogleMapsProvider extends AbstractIntegrationProvider implements MapProviderInterface, TestableProvider
{
    private const LEGACY_GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

    private const PLACES_API_NEW_URL = 'https://places.googleapis.com/v1';

    /**
     * Service methods that talk to the legacy Geocoding API.
     */
    private const GEOCODE_ENDPOINT = 'geocode';

    /**
     * @return array{status: string, results: array, error?: mixed}
     */
    public function geocode(string $address): array
    {
        try {
            $res = Http::timeout(6)->get(self::LEGACY_GEOCODE_URL, [
                'address' => $address,
                'key' => $this->serverKey(),
            ]);

            return $this->geocodeResponse($res->json(), 'geocode');
        } catch (\Throwable $e) {
            Log::warning('[MAPS] geocode failed', ['error' => $this->redact($e->getMessage())]);

            return ['status' => 'ERROR', 'results' => [], 'error' => $this->redact($e->getMessage())];
        }
    }

    /**
     * @return array{status: string, results: array, error?: mixed}
     */
    public function reverseGeocode(float $latitude, float $longitude): array
    {
        try {
            $res = Http::timeout(6)->get(self::LEGACY_GEOCODE_URL, [
                'latlng' => "{$latitude},{$longitude}",
                'key' => $this->serverKey(),
            ]);

            return $this->geocodeResponse($res->json(), 'reverseGeocode');
        } catch (\Throwable $e) {
            Log::warning('[MAPS] reverseGeocode failed', ['error' => $this->redact($e->getMessage())]);

            return ['status' => 'ERROR', 'results' => [], 'error' => $this->redact($e->getMessage())];
        }
    }

    /**
     * Places Autocomplete via the Places API (New) so every result ships with
     * coordinates and a stable place id in a single call.
     *
     * @return array{predictions: array, status: string, http_status?: int, status_message?: ?string, error?: mixed}
     */
    public function placesAutocomplete(string $query, array $options = []): array
    {
        try {
            $body = array_filter([
                'textQuery' => $query,
                'pageSize' => (int) ($options['limit'] ?? 5),
                'regionCode' => isset($options['country']) && ! blank($options['country'])
                    ? strtoupper((string) $options['country'])
                    : null,
            ]);

            $res = Http::timeout(6)
                ->withHeaders($this->placesNewHeaders(self::AUTOCOMPLETE_FIELDS))
                ->post(self::PLACES_API_NEW_URL.'/places:searchText', $body);

            $httpStatus = $res->status();
            $payload = $res->json();

            if (! is_array($payload)) {
                return $this->placesNewHttpError($res->body(), $httpStatus, 'places:searchText');
            }

            if (($payload['error']['status'] ?? null) !== null) {
                return $this->placesNewError($payload['error'], $httpStatus);
            }

            if (empty($payload['places']) || ($payload['places'] ?? null) === null) {
                return ['status' => 'ZERO_RESULTS', 'predictions' => [], 'http_status' => $res->status()];
            }

            return [
                'status' => 'OK',
                'predictions' => $this->predictionsFromPlacesNew($payload['places']),
                'http_status' => $httpStatus,
            ];
        } catch (\Throwable $e) {
            Log::warning('[MAPS] placesAutocomplete failed', ['error' => $this->redact($e->getMessage())]);

            return ['status' => 'ERROR', 'predictions' => [], 'error' => $this->redact($e->getMessage())];
        }
    }

    /**
     * Place Details via the Places API (New).
     *
     * @return array{status: string, place?: array, http_status?: int, status_message?: ?string, error?: mixed}
     */
    public function placeDetails(string $placeId, array $options = []): array
    {
        try {
            $res = Http::timeout(6)
                ->withHeaders($this->placesNewHeaders(self::PLACE_DETAILS_FIELDS))
                ->get(self::PLACES_API_NEW_URL.'/places/'.rawurlencode($placeId));

            $httpStatus = $res->status();
            $payload = $res->json();

            if (! is_array($payload)) {
                return $this->placesNewHttpError($res->body(), $httpStatus, 'places/{id}');
            }

            if (($payload['error']['status'] ?? null) !== null) {
                return $this->placesNewError($payload['error'], $httpStatus);
            }

            $place = $this->predictionFromPlace($payload);

            if ($place['place_id'] === null) {
                return ['status' => 'NOT_FOUND', 'place' => null, 'http_status' => $httpStatus];
            }

            return ['status' => 'OK', 'place' => $place, 'http_status' => $httpStatus];
        } catch (\Throwable $e) {
            Log::warning('[MAPS] placeDetails failed', ['error' => $this->redact($e->getMessage())]);

            return ['status' => 'ERROR', 'place' => null, 'error' => $this->redact($e->getMessage())];
        }
    }

    public function distanceMatrix(array $origins, array $destinations): array
    {
        try {
            $res = Http::timeout(6)->get('https://maps.googleapis.com/maps/api/distancematrix/json', [
                'origins' => $this->formatLatLngList($origins),
                'destinations' => $this->formatLatLngList($destinations),
                'key' => $this->serverKey(),
            ]);

            return $res->json() ?? ['status' => 'ERROR', 'rows' => []];
        } catch (\Throwable $e) {
            Log::warning('[MAPS] distanceMatrix failed', ['error' => $this->redact($e->getMessage())]);

            return ['status' => 'ERROR', 'rows' => [], 'error' => $this->redact($e->getMessage())];
        }
    }

    public function directions(array $origin, array $destination, array $options = []): array
    {
        try {
            $res = Http::timeout(6)->get('https://maps.googleapis.com/maps/api/directions/json', [
                'origin' => $this->formatLatLng($origin),
                'destination' => $this->formatLatLng($destination),
                'mode' => $options['mode'] ?? 'driving',
                'key' => $this->serverKey(),
            ]);

            return $res->json() ?? ['status' => 'ERROR', 'routes' => []];
        } catch (\Throwable $e) {
            Log::warning('[MAPS] directions failed', ['error' => $this->redact($e->getMessage())]);

            return ['status' => 'ERROR', 'routes' => [], 'error' => $this->redact($e->getMessage())];
        }
    }

    public function calculateDistanceAndTime(array $origin, array $destination): array
    {
        $matrix = $this->distanceMatrix([$origin], [$destination]);
        $element = $matrix['rows'][0]['elements'][0] ?? null;

        if (($element['status'] ?? '') !== 'OK') {
            return ['distance_km' => 0.0, 'duration_min' => 0];
        }

        return [
            'distance_km' => round(($element['distance']['value'] ?? 0) / 1000, 2),
            'duration_min' => (int) round(($element['duration']['value'] ?? 0) / 60),
        ];
    }

    public function validateAddress(array $latLng): array
    {
        $result = $this->reverseGeocode((float) $latLng['latitude'], (float) $latLng['longitude']);

        return [
            'valid' => ($result['status'] ?? '') === 'OK',
            'address' => $result['results'][0]['formatted_address'] ?? null,
        ];
    }

    public function testConnection(): array
    {
        try {
            $key = $this->serverKey();
            if (blank($key)) {
                return ['success' => false, 'message' => 'Server/backend API key is not configured.'];
            }

            $geocoding = $this->testGeocoding($key);
            $routes = $this->testRoutes($key);
            $places = $this->testPlacesSearch($key);
            $details = $this->testPlaceDetails($key);
            $billingBlocked = ($geocoding['ok'] === false && $geocoding['status'] === 'REQUEST_DENIED')
                || ($routes['ok'] === false && $routes['status'] === 'REQUEST_DENIED')
                || ($places['ok'] === false && $places['status'] === 'REQUEST_DENIED')
                || ($details['ok'] === false && $details['status'] === 'REQUEST_DENIED');

            $lines = [];
            $lines[] = 'Geocoding: '.$this->capLine($geocoding);
            $lines[] = 'Routes: '.$this->capLine($routes);
            $lines[] = 'Places Search: '.$this->capLine($places);
            $lines[] = 'Place Details: '.$this->capLine($details);

            $message = implode('  ', $lines);
            $success = $geocoding['ok'] && $routes['ok'] && $places['ok'] && $details['ok'];

            if ($billingBlocked) {
                $message .= '  Enable Billing and the Geocoding + Places APIs on the Google Cloud project for this key.';
            }

            return [
                'success' => $success,
                'message' => $message,
                'diagnostics' => [
                    'google_status' => $geocoding['status'],
                    'google_error' => $geocoding['message'],
                    'capabilities' => [
                        'geocoding' => $geocoding,
                        'routes' => $routes,
                        'places_search' => $places,
                        'place_details' => $details,
                    ],
                ],
            ];
        } catch (\Throwable $e) {
            Log::warning('[MAPS] testConnection failed', ['error' => $this->redact($e->getMessage())]);

            return ['success' => false, 'message' => 'Google Maps connection failed: '.$this->redact($e->getMessage())];
        }
    }

    protected function capLine(array $cap): string
    {
        if ($cap['ok']) {
            return 'OK';
        }

        return ($cap['status'] ?? 'ERROR').' ('.($cap['message'] ?? 'failed').')';
    }

    protected function testGeocoding(string $key): array
    {
        try {
            $res = Http::connectTimeout(8)->timeout(12)->get(self::LEGACY_GEOCODE_URL, [
                'address' => '1 test street',
                'key' => $key,
            ]);

            $payload = $res->json() ?? [];
            $status = $payload['status'] ?? 'UNKNOWN';
            $errorMessage = $payload['error_message'] ?? $payload['error']['message'] ?? null;

            if ($res->successful() && $status === 'OK') {
                return ['ok' => true, 'status' => 'OK', 'message' => 'reachable'];
            }

            return ['ok' => false, 'status' => (string) $status, 'message' => (string) ($errorMessage ?? $status)];
        } catch (\Throwable $e) {
            Log::warning('[MAPS] geocoding test failed', ['error' => $this->redact($e->getMessage())]);

            return ['ok' => false, 'status' => 'ERROR', 'message' => $this->redact($e->getMessage())];
        }
    }

    protected function testRoutes(string $key): array
    {
        try {
            $res = Http::connectTimeout(8)->timeout(12)->get('https://maps.googleapis.com/maps/api/directions/json', [
                'origin' => '12.97,77.59',
                'destination' => '12.98,77.60',
                'mode' => 'driving',
                'key' => $key,
            ]);

            $payload = $res->json() ?? [];
            $status = $payload['status'] ?? 'UNKNOWN';
            $errorMessage = $payload['error_message'] ?? $payload['error']['message'] ?? null;

            if ($res->successful() && $status === 'OK') {
                return ['ok' => true, 'status' => 'OK', 'message' => 'reachable'];
            }

            return ['ok' => false, 'status' => (string) $status, 'message' => (string) ($errorMessage ?? $status)];
        } catch (\Throwable $e) {
            Log::warning('[MAPS] routes test failed', ['error' => $this->redact($e->getMessage())]);

            return ['ok' => false, 'status' => 'ERROR', 'message' => $this->redact($e->getMessage())];
        }
    }

    protected function testPlacesSearch(string $key): array
    {
        try {
            $res = Http::connectTimeout(8)->timeout(12)
                ->withHeaders($this->placesNewHeaders(self::AUTOCOMPLETE_FIELDS))
                ->post(self::PLACES_API_NEW_URL.'/places:searchText', [
                    'textQuery' => 'test',
                    'pageSize' => 1,
                ]);

            $httpStatus = $res->status();
            $payload = $res->json();

            if (is_array($payload) && isset($payload['places'])) {
                return ['ok' => true, 'status' => 'OK', 'message' => 'reachable'];
            }

            if (is_array($payload) && isset($payload['error']['message'])) {
                return [
                    'ok' => false,
                    'status' => (string) ($payload['error']['status'] ?? 'ERROR'),
                    'message' => (string) $payload['error']['message'],
                ];
            }

            return ['ok' => false, 'status' => 'REQUEST_DENIED', 'message' => 'Billing/Places API (New) likely disabled (HTTP '.$httpStatus.')'];
        } catch (\Throwable $e) {
            Log::warning('[MAPS] places search test failed', ['error' => $this->redact($e->getMessage())]);

            return ['ok' => false, 'status' => 'ERROR', 'message' => $this->redact($e->getMessage())];
        }
    }

    protected function testPlaceDetails(string $key): array
    {
        try {
            $res = Http::connectTimeout(8)->timeout(12)
                ->withHeaders($this->placesNewHeaders(self::PLACE_DETAILS_FIELDS))
                ->get(self::PLACES_API_NEW_URL.'/places/ChIJLbU9hxX3rToRzVx1mzqM5QQ');

            $httpStatus = $res->status();
            $payload = $res->json();

            if (is_array($payload) && isset($payload['id'])) {
                return ['ok' => true, 'status' => 'OK', 'message' => 'reachable'];
            }

            if (is_array($payload) && isset($payload['error']['message'])) {
                return [
                    'ok' => false,
                    'status' => (string) ($payload['error']['status'] ?? 'ERROR'),
                    'message' => (string) $payload['error']['message'],
                ];
            }

            return ['ok' => false, 'status' => 'REQUEST_DENIED', 'message' => 'Billing/Places API (New) likely disabled (HTTP '.$httpStatus.')'];
        } catch (\Throwable $e) {
            Log::warning('[MAPS] place details test failed', ['error' => $this->redact($e->getMessage())]);

            return ['ok' => false, 'status' => 'ERROR', 'message' => $this->redact($e->getMessage())];
        }
    }

    private const AUTOCOMPLETE_FIELDS = 'places.id,places.displayName.text,places.formattedAddress,places.location,places.addressComponents,places.types';

    private const PLACE_DETAILS_FIELDS = 'id,displayName,formattedAddress,location,addressComponents,types';

    /**
     * Requests that use the legacy Geocoding API map to structured failures
     * (REQUEST_DENIED is only ever surfaced for these endpoints today).
     */
    protected function geocodeResponse(mixed $json, string $operation): array
    {
        if (! is_array($json)) {
            return ['status' => 'ERROR', 'results' => []];
        }

        if (($json['status'] ?? '') !== 'OK') {
            Log::warning('[MAPS] geocode API rejected the request', [
                'operation' => $operation,
                'google_status' => $json['status'] ?? null,
                'google_error' => $json['error_message'] ?? $json['error']['message'] ?? null,
            ]);
        }

        return $json;
    }

    /**
     * @return array{status: string, predictions: array, http_status: int, status_message: ?string}
     */
    protected function placesNewHttpError(string $body, int $httpStatus, string $endpoint): array
    {
        $googleStatus = 'REQUEST_DENIED';
        $message = 'Google Places API returned a non-JSON response (HTTP '.$httpStatus.'). '
            .'This usually means Billing is not enabled or the Places API is not enabled for the key. '
            .'Enable Billing and the Places API on the Google Cloud project.';

        Log::warning('[MAPS] Places API (New) rejected the request', [
            'endpoint' => $endpoint,
            'http_status' => $httpStatus,
            'google_status' => $googleStatus,
            'google_error' => 'Non-JSON response (billing/Places API likely disabled).',
            'body_snippet' => $this->redact(mb_substr(trim($body), 0, 200)),
        ]);

        return [
            'status' => $googleStatus,
            'predictions' => [],
            'http_status' => $httpStatus,
            'status_message' => $message,
            'error' => ['status' => $googleStatus, 'message' => $message],
            'raw_body' => mb_substr($body, 0, 300),
        ];
    }

    /**
     * @return array{status: string, predictions: array, http_status: int, status_message: ?string}
     */
    protected function placesNewError(array $error, int $httpStatus): array
    {
        $status = $error['status'] ?? 'ERROR';
        $message = isset($error['message']) ? $this->redact((string) $error['message']) : null;

        Log::warning('[MAPS] Places API (New) rejected the request', [
            'endpoint' => $status === 'REQUEST_DENIED' ? 'place:searchText' : 'places/{id}',
            'http_status' => $httpStatus,
            'google_status' => $status,
            'google_error' => $message,
        ]);

        return [
            'status' => $status,
            'predictions' => [],
            'http_status' => $httpStatus,
            'status_message' => $message,
            'error' => ['status' => $status, 'message' => $message],
        ];
    }

    /**
     * @return array<int, array{place_id: string, name: string, formatted_address: string, latitude: float, longitude: float, address_components: array}>
     */
    protected function predictionsFromPlacesNew(array $places): array
    {
        return array_values(array_map(
            fn (array $place): array => $this->predictionFromPlace($place),
            $places
        ));
    }

    /**
     * Map a Places API (New) place object to a uniform prediction shape that the
     * GeocodingService (and mock provider) can consume.
     *
     * @return array{place_id: ?string, name: ?string, formatted_address: ?string, latitude: ?float, longitude: ?float, address_components: array}
     */
    protected function predictionFromPlace(array $place): array
    {
        return [
            'place_id' => $place['id'] ?? null,
            'name' => $place['displayName']['text'] ?? ($place['display_name'] ?? null),
            'formatted_address' => $place['formattedAddress'] ?? ($place['formatted_address'] ?? null),
            'latitude' => isset($place['location']['latitude']) ? (float) $place['location']['latitude'] : null,
            'longitude' => isset($place['location']['longitude']) ? (float) $place['location']['longitude'] : null,
            'address_components' => $place['addressComponents'] ?? ($place['address_components'] ?? []),
        ];
    }

    /**
     * @return array<string, string>
     */
    protected function placesNewHeaders(string $fieldMask): array
    {
        return [
            'Content-Type' => 'application/json',
            'X-Goog-Api-Key' => $this->serverKey(),
            'X-Goog-FieldMask' => $fieldMask,
        ];
    }

    protected function serverKey(): string
    {
        return (string) ($this->cred('server_key') ?? config('services.google_maps.api_key', ''));
    }

    /**
     * Strip credentials from a diagnostic string before it is logged or shown
     * to an operator. Guzzle embeds the full request URL (including ?key=...) in
     * connection exception messages, so this prevents the Google API key from
     * being written to logs or surfaced through the admin test tools.
     */
    protected function redact(string $message): string
    {
        $message = preg_replace('/([?&])(key|api_key|apikey|auth_key)=[^&\s]+/i', '$1$2=***', $message) ?? $message;
        $message = preg_replace('/\bAIza[0-9A-Za-z_\-]{10,}\b/', 'AIza***', $message) ?? $message;
        $message = preg_replace('/(X-Goog-Api-Key\s*[:=]\s*)[^\s,}"\']+/i', '$1***', $message) ?? $message;

        return $message;
    }

    protected function formatLatLng(array $points): string
    {
        if (isset($points['latitude'], $points['longitude'])) {
            return $points['latitude'].','.$points['longitude'];
        }

        if (isset($points['lat'], $points['lng'])) {
            return $points['lat'].','.$points['lng'];
        }

        return implode(',', $points);
    }

    /**
     * Format a list of coordinate points into the pipe-separated syntax used
     * by the Distance Matrix API.
     */
    protected function formatLatLngList(array $points): string
    {
        return implode('|', array_map(fn ($point) => $this->formatLatLng($point), $points));
    }
}
