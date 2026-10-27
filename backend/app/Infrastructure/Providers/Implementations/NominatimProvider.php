<?php

namespace App\Infrastructure\Providers\Implementations;

use App\Infrastructure\Interfaces\MapProviderInterface;
use App\Infrastructure\Interfaces\TestableProvider;
use App\Infrastructure\Providers\AbstractIntegrationProvider;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * OpenStreetMap Nominatim.
 *
 * Used exclusively as a no-key fallback when the configured Google provider
 * fails (or is unreachable). Never logs API keys; the Nominatim email is read
 * from config, not from the maps integration payload.
 */
class NominatimProvider extends AbstractIntegrationProvider implements MapProviderInterface, TestableProvider
{
    private const SEARCH_URL = 'https://nominatim.openstreetmap.org/search';

    private const REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse';

    public function __construct(array $config = [])
    {
        $config['service'] = 'maps';
        $config['provider'] = 'nominatim';
        parent::__construct($config);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function search(string $query, int $limit = 5, ?string $country = null): array
    {
        $response = Http::timeout(6)
            ->withHeaders($this->nominatimHeaders())
            ->get(self::SEARCH_URL, array_filter([
                'q' => $query,
                'countrycodes' => $country ? strtolower($country) : null,
                'format' => 'jsonv2',
                'limit' => $limit,
                'addressdetails' => 1,
            ]));

        if ($response->failed()) {
            Log::warning('Nominatim search response failed', [
                'query' => $query,
                'status' => $response->status(),
                'body' => mb_substr($response->body(), 0, 300),
            ]);

            return [];
        }

        $payload = $response->json();

        if (! is_array($payload)) {
            Log::warning('Nominatim search returned a non-JSON response', [
                'query' => $query,
                'status' => $response->status(),
                'body' => mb_substr($response->body(), 0, 300),
            ]);

            return [];
        }

        return $payload;
    }

    /**
     * @return array<mixed>|null
     */
    public function reverse(float $latitude, float $longitude): ?array
    {
        $response = Http::timeout(6)
            ->withHeaders($this->nominatimHeaders())
            ->get(self::REVERSE_URL, [
                'lat' => $latitude,
                'lon' => $longitude,
                'format' => 'jsonv2',
                'addressdetails' => 1,
            ]);

        if ($response->failed()) {
            Log::warning('Nominatim reverse response failed', [
                'status' => $response->status(),
                'body' => mb_substr($response->body(), 0, 300),
            ]);

            return null;
        }

        $payload = $response->json();

        if (! is_array($payload) || blank($payload['display_name'] ?? null)) {
            Log::warning('Nominatim reverse returned no address', [
                'status' => $response->status(),
                'body' => mb_substr($response->body(), 0, 300),
            ]);

            return null;
        }

        return $payload;
    }

    public function geocode(string $address): array
    {
        $results = $this->search($address, 1);

        return ['status' => $results === [] ? 'ZERO_RESULTS' : 'OK', 'results' => $results];
    }

    public function reverseGeocode(float $latitude, float $longitude): array
    {
        $result = $this->reverse($latitude, $longitude);

        return ['status' => $result === null ? 'ZERO_RESULTS' : 'OK', 'results' => $result === null ? [] : [$result]];
    }

    public function placesAutocomplete(string $query, array $options = []): array
    {
        return $this->geocode($query);
    }

    /**
     * Nominatim has no stable place ids, so details are not resolvable here.
     */
    public function placeDetails(string $placeId, array $options = []): array
    {
        return ['status' => 'NOT_SUPPORTED', 'place' => null];
    }

    public function distanceMatrix(array $origins, array $destinations): array
    {
        return ['status' => 'NOT_SUPPORTED', 'rows' => []];
    }

    public function directions(array $origin, array $destination, array $options = []): array
    {
        return ['status' => 'NOT_SUPPORTED', 'routes' => []];
    }

    public function calculateDistanceAndTime(array $origin, array $destination): array
    {
        return ['status' => 'NOT_SUPPORTED', 'distance_km' => 0.0, 'duration_min' => 0];
    }

    public function validateAddress(array $latLng): array
    {
        return ['valid' => false, 'address' => null];
    }

    public function testConnection(): array
    {
        $email = config('services.geocoding.nominatim_email');

        return [
            'success' => true,
            'message' => ($email !== null && $email !== '' ? 'Nominatim fallback ready (contact '.$email.'). ' : 'Nominatim fallback ready. ')
                .'No key required; used when Google is unavailable.',
        ];
    }

    /**
     * @return array<string, string>
     */
    protected function nominatimHeaders(): array
    {
        $email = config('services.geocoding.nominatim_email');

        $userAgent = $email
            ? config('app.name').' Geocoding <'.$email.'>'
            : config('app.name').' Geocoding';

        return ['User-Agent' => $userAgent, 'Referer' => config('app.url')];
    }
}
