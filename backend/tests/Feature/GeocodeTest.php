<?php

namespace Tests\Feature;

use App\Models\IntegrationSetting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Tests\TestCase;

class GeocodeTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;

    protected function setUp(): void
    {
        parent::setUp();

        config(['services.geocoding.enabled' => true]);
        config(['services.geocoding.nominatim_email' => 'admin@superapp.com']);
        config(['app.name' => 'SuperApp']);
        Cache::flush();

        $this->user = User::create([
            'name' => 'Geocode Tester',
            'email' => 'geocode@example.com',
            'phone' => '7777777777',
            'password' => Hash::make('secret'),
            'user_type' => 'customer',
            'is_active' => true,
        ]);
    }

    private function authHeaders(): array
    {
        return ['Authorization' => 'Bearer '.$this->user->createToken('test')->plainTextToken];
    }

    private function useGoogleMaps(): void
    {
        config(['integrations.mode' => 'live']);
        config(['integrations.provider.maps' => 'google']);
        config(['integrations.credentials.maps.server_key' => 'test-key']);
        Cache::flush();
    }

    private function googleSearchTextResponse(): array
    {
        return [
            'places' => [[
                'id' => 'ChIJ-ABC123',
                'displayName' => ['text' => 'MG Road'],
                'formattedAddress' => 'MG Road, Bengaluru, Karnataka 560001, India',
                'location' => ['latitude' => 12.971599, 'longitude' => 77.594563],
                'addressComponents' => [
                    ['types' => ['route'], 'longText' => 'MG Road'],
                    ['types' => ['locality'], 'longText' => 'Bengaluru'],
                    ['types' => ['administrative_area_level_1'], 'longText' => 'Karnataka'],
                    ['types' => ['postal_code'], 'longText' => '560001'],
                    ['types' => ['country'], 'longText' => 'India'],
                ],
            ]],
        ];
    }

    public function test_google_autocomplete_returns_predictions_with_coordinates(): void
    {
        $this->useGoogleMaps();

        Http::fake([
            'places.googleapis.com/*' => Http::response($this->googleSearchTextResponse()),
        ]);

        $res = $this->getJson('/api/v1/geocode/search?q=mg+road', $this->authHeaders());

        $res->assertOk()->assertJsonPath('data.results.0.id', 'ChIJ-ABC123');
        $res->assertJsonPath('data.results.0.place_id', 'ChIJ-ABC123');
        $res->assertJsonPath('data.results.0.main', 'MG Road');
        $res->assertJsonPath('data.results.0.latitude', 12.971599);
        $res->assertJsonPath('data.results.0.longitude', 77.594563);
        $res->assertJsonPath('data.results.0.formatted_address', 'MG Road, Bengaluru, Karnataka 560001, India');
        $res->assertJsonPath('data.results.0.city', 'Bengaluru');
        $res->assertJsonPath('data.results.0.provider', 'google');

        $this->assertSame('google', $res->json('data.provider'));
        $this->assertFalse($res->json('data.fallback'));
        $this->assertNotEmpty($res->json('data.correlation_id'));

        Http::assertSent(function (Request $request): bool {
            return $request->url() === 'https://places.googleapis.com/v1/places:searchText'
                && str_contains($request->header('X-Goog-FieldMask')[0] ?? '', 'places.id');
        });
    }

    public function test_google_place_details_returns_coordinates_and_parts(): void
    {
        $this->useGoogleMaps();

        Http::fake([
            'places.googleapis.com/*' => Http::response($this->googleSearchTextResponse()['places'][0]),
        ]);

        $res = $this->getJson('/api/v1/geocode/details?place_id=ChIJ-ABC123', $this->authHeaders());

        $res->assertOk();
        $this->assertSame(12.971599, $res->json('data.latitude'));
        $this->assertSame(77.594563, $res->json('data.longitude'));
        $this->assertSame('ChIJ-ABC123', $res->json('data.place_id'));
        $this->assertSame('MG Road, Bengaluru, Karnataka 560001, India', $res->json('data.formatted_address'));
        $this->assertSame('google', $res->json('data.provider'));

        Http::assertSent(function (Request $request): bool {
            return str_starts_with($request->url(), 'https://places.googleapis.com/v1/places/')
                && str_contains($request->header('X-Goog-FieldMask')[0] ?? '', 'id,displayName');
        });
    }

    public function test_google_reverse_returns_address_parts(): void
    {
        $this->useGoogleMaps();

        Http::fake([
            'maps.googleapis.com/maps/api/geocode/json*' => Http::response([
                'status' => 'OK',
                'results' => [[
                    'formatted_address' => 'MG Road, Bengaluru, Karnataka 560001, India',
                    'geometry' => ['location' => ['lat' => 12.971599, 'lng' => 77.594563]],
                    'address_components' => [
                        ['types' => ['route'], 'long_name' => 'MG Road'],
                        ['types' => ['locality'], 'long_name' => 'Bengaluru'],
                        ['types' => ['administrative_area_level_1'], 'long_name' => 'Karnataka'],
                        ['types' => ['postal_code'], 'long_name' => '560001'],
                        ['types' => ['country'], 'long_name' => 'India'],
                    ],
                ]],
            ]),
        ]);

        $res = $this->getJson('/api/v1/geocode/reverse?lat=12.971599&lng=77.594563', $this->authHeaders());

        $res->assertOk();
        $this->assertSame('MG Road', $res->json('data.street'));
        $this->assertSame('Bengaluru', $res->json('data.city'));
        $this->assertSame('Karnataka', $res->json('data.state'));
        $this->assertSame('560001', $res->json('data.postal_code'));
        $this->assertSame('India', $res->json('data.country'));
        $this->assertSame('google', $res->json('data.provider'));
    }

    public function test_google_failure_falls_back_to_nominatim(): void
    {
        $this->useGoogleMaps();

        Http::fake([
            'places.googleapis.com/*' => Http::response([
                'error' => [
                    'code' => 403,
                    'status' => 'REQUEST_DENIED',
                    'message' => 'You must enable Billing on the Google Cloud Project.',
                ],
            ], 403),
            'nominatim.openstreetmap.org/search*' => Http::response([[
                'place_id' => 1,
                'osm_type' => 'way',
                'osm_id' => 777,
                'display_name' => 'MG Road, Bengaluru, Karnataka, India',
                'name' => 'MG Road',
                'lat' => '12.971599',
                'lon' => '77.594563',
                'address' => ['city' => 'Bengaluru', 'state' => 'Karnataka', 'country' => 'India'],
            ]]),
        ]);

        $res = $this->getJson('/api/v1/geocode/search?q=mg+road', $this->authHeaders());

        $res->assertOk()->assertJsonPath('data.results.0.id', 'nominatim:way:777');
        $this->assertSame(12.971599, $res->json('data.results.0.latitude'));
        $this->assertSame('nominatim', $res->json('data.provider'));
        $this->assertTrue($res->json('data.fallback'));
    }

    public function test_request_denied_is_logged_without_the_api_key(): void
    {
        Log::spy();
        $this->useGoogleMaps();

        Http::fake([
            'places.googleapis.com/*' => Http::response([
                'error' => [
                    'code' => 403,
                    'status' => 'REQUEST_DENIED',
                    'message' => 'You must enable Billing on the Google Cloud Project.',
                ],
            ], 403),
            'nominatim.openstreetmap.org/search*' => Http::response([]),
        ]);

        $this->getJson('/api/v1/geocode/search?q=mg+road', $this->authHeaders());

        Log::shouldHaveReceived('warning')
            ->withArgs(function (string $message, array $context): bool {
                return str_contains($message, 'falling back to Nominatim')
                    && ($context['google_status'] ?? null) === 'REQUEST_DENIED'
                    && ($context['operation'] ?? null) === 'autocomplete'
                    && ! str_contains(print_r($context, true), 'test-key');
            })
            ->once();

        Log::shouldHaveReceived('warning')
            ->withArgs(fn (string $message) => str_contains($message, 'Places API (New) rejected'))
            ->once();
    }

    public function test_nominatim_fallback_uses_contact_email_in_user_agent(): void
    {
        $this->useGoogleMaps();

        Http::fake([
            'places.googleapis.com/*' => Http::response([
                'error' => ['status' => 'REQUEST_DENIED', 'message' => 'denied'],
            ], 403),
            'nominatim.openstreetmap.org/search*' => Http::response([[
                'place_id' => 1,
                'osm_type' => 'way',
                'osm_id' => 123,
                'display_name' => 'MG Road, Bengaluru, Karnataka, India',
                'name' => 'MG Road',
                'lat' => '12.971599',
                'lon' => '77.594563',
                'address' => ['city' => 'Bengaluru', 'state' => 'Karnataka', 'country' => 'India'],
            ]]),
        ]);

        $this->getJson('/api/v1/geocode/search?q=mg+road', $this->authHeaders());

        Http::assertSent(function (Request $request): bool {
            if ($request->url() !== 'https://nominatim.openstreetmap.org/search') {
                return true;
            }

            $userAgent = $request->header('User-Agent')[0] ?? '';

            return str_starts_with($userAgent, 'SuperApp Geocoding <')
                && ! str_contains($userAgent, 'example.com')
                && $request->hasHeader('Referer');
        });
    }

    public function test_nominatim_failure_is_logged_and_returns_empty_results(): void
    {
        Log::spy();
        $this->useGoogleMaps();

        Http::fake([
            'places.googleapis.com/*' => Http::response([
                'error' => ['status' => 'REQUEST_DENIED', 'message' => 'denied'],
            ], 403),
            'nominatim.openstreetmap.org/search*' => Http::response('Access denied.', 403),
        ]);

        $res = $this->getJson('/api/v1/geocode/search?q=mg+road', $this->authHeaders());

        $res->assertOk()->assertJsonPath('data.results', []);
        $this->assertSame('nominatim', $res->json('data.provider'));
        $this->assertTrue($res->json('data.fallback'));

        Log::shouldHaveReceived('warning')
            ->withArgs(fn (string $message) => str_contains($message, 'Nominatim search response failed'))
            ->once();
    }

    public function test_mock_mode_is_deterministic_and_never_calls_out(): void
    {
        Http::preventStrayRequests();

        $res = $this->getJson('/api/v1/geocode/search?q=mg+road', $this->authHeaders());

        $res->assertOk();
        $this->assertStringStartsWith('place_mock_', $res->json('data.results.0.place_id'));
        $this->assertSame('mock', $res->json('data.provider'));
        $this->assertFalse($res->json('data.fallback'));
    }

    public function test_mock_reverse_resolves_known_city_coordinates(): void
    {
        Http::preventStrayRequests();

        $res = $this->getJson('/api/v1/geocode/reverse?lat=26.9124&lng=75.7873', $this->authHeaders());

        $res->assertOk();
        $this->assertSame(26.9124, $res->json('data.latitude'));
        $this->assertSame(75.7873, $res->json('data.longitude'));
        $this->assertSame('Jaipur, Rajasthan, India', $res->json('data.address'));
        $this->assertSame('Jaipur', $res->json('data.city'));
        $this->assertSame('Rajasthan', $res->json('data.state'));
        $this->assertSame('302001', $res->json('data.postal_code'));
        $this->assertSame('India', $res->json('data.country'));
        $this->assertSame('mock', $res->json('data.provider'));
    }

    public function test_mock_reverse_falls_back_to_coordinates_outside_known_cities(): void
    {
        Http::preventStrayRequests();

        $res = $this->getJson('/api/v1/geocode/reverse?lat=30.9&lng=75.8', $this->authHeaders());

        $res->assertOk();
        $this->assertSame('India', $res->json('data.country'));
        $this->assertNull($res->json('data.city'));
        $this->assertNull($res->json('data.state'));
        $this->assertNull($res->json('data.postal_code'));
        $this->assertStringContainsString('30.9', $res->json('data.address'));
    }

    public function test_mock_reverse_outside_india_returns_coordinates_without_components(): void
    {
        Http::preventStrayRequests();

        $res = $this->getJson('/api/v1/geocode/reverse?lat=51.5074&lng=-0.1278', $this->authHeaders());

        $res->assertOk();
        $this->assertNull($res->json('data.country'));
        $this->assertNull($res->json('data.city'));
        $this->assertNull($res->json('data.state'));
        $this->assertSame('51.5074, -0.1278', $res->json('data.address'));
    }

    public function test_google_is_used_when_configured_even_in_mock_mode(): void
    {
        IntegrationSetting::create([
            'service' => 'maps',
            'provider' => 'google',
            'environment' => 'test',
            'is_enabled' => true,
            'credentials' => ['server_key' => 'mock-mode-server-key', 'browser_key' => 'mock-mode-browser-key'],
        ]);
        Cache::flush();

        Http::fake([
            'places.googleapis.com/*' => Http::response([
                'places' => [[
                    'id' => 'ChIJ-GOOGLE-MOCK',
                    'displayName' => ['text' => 'MG Road'],
                    'formattedAddress' => 'MG Road, Bengaluru, Karnataka, India',
                    'location' => ['latitude' => 12.971599, 'longitude' => 77.594563],
                ]],
            ]),
        ]);

        $res = $this->getJson('/api/v1/geocode/search?q=mg+road', $this->authHeaders());

        $res->assertOk()->assertJsonPath('data.results.0.id', 'ChIJ-GOOGLE-MOCK');
        $this->assertSame('google', $res->json('data.provider'));
    }

    public function test_geocoding_disabled_returns_empty_results(): void
    {
        config(['services.geocoding.enabled' => false]);

        $res = $this->getJson('/api/v1/geocode/search?q=mg+road', $this->authHeaders());

        $res->assertOk()->assertJsonPath('data.results', []);
    }

    public function test_google_empty_result_does_not_fallback_to_nominatim(): void
    {
        Log::spy();
        $this->useGoogleMaps();

        Http::fake([
            'places.googleapis.com/*' => Http::response(['places' => []], 200),
            'nominatim.openstreetmap.org/*' => Http::response([]),
        ]);

        $res = $this->getJson('/api/v1/geocode/search?q=zzz+does+not+exist', $this->authHeaders());

        $res->assertOk()
            ->assertJsonPath('data.results', [])
            ->assertJsonPath('data.provider', 'google')
            ->assertJsonPath('data.fallback', false);

        Log::shouldNotHaveReceived('warning');
        Http::assertNotSent(fn (Request $request) => str_contains($request->url(), 'nominatim.openstreetmap.org'));
    }

    public function test_google_html_403_is_reported_as_request_denied_instead_of_non_json(): void
    {
        Log::spy();
        $this->useGoogleMaps();

        Http::fake([
            'places.googleapis.com/*' => Http::response(
                '<html><body>Error 403 (Forbidden)</body></html>',
                403,
                ['Content-Type' => 'text/html']
            ),
            'nominatim.openstreetmap.org/search*' => Http::response([]),
        ]);

        $res = $this->getJson('/api/v1/geocode/search?q=mg+road', $this->authHeaders());

        $res->assertOk()
            ->assertJsonPath('data.provider', 'nominatim')
            ->assertJsonPath('data.fallback', true);

        Log::shouldHaveReceived('warning')
            ->withArgs(function (string $message, array $context): bool {
                return str_contains($message, 'Places API (New) rejected')
                    && ($context['http_status'] ?? null) === 403
                    && ($context['google_status'] ?? null) === 'REQUEST_DENIED'
                    && ! str_contains(print_r($context, true), 'test-key');
            })
            ->once();
    }

    public function test_connection_error_is_logged_without_the_api_key(): void
    {
        Log::spy();
        Http::preventStrayRequests();
        $this->useGoogleMaps();

        Http::fake([
            'maps.googleapis.com/maps/api/geocode/json*' => Http::failedConnection(
                'cURL error 28: Operation timed out after 6002 milliseconds for https://maps.googleapis.com/maps/api/geocode/json?latlng=12.971599,77.594563&key=AIzaSyFAKE0000000000000000000000000000'
            ),
            'nominatim.openstreetmap.org/*' => Http::response([
                'display_name' => 'MG Road, Bengaluru, Karnataka, India',
                'address' => ['road' => 'MG Road', 'city' => 'Bengaluru', 'state' => 'Karnataka', 'country' => 'India'],
            ]),
        ]);

        $this->getJson('/api/v1/geocode/reverse?lat=12.971599&lng=77.594563', $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('data.provider', 'nominatim');

        Log::shouldHaveReceived('warning')
            ->withArgs(function (string $message, array $context): bool {
                $error = (string) ($context['error'] ?? '');

                return str_contains($message, 'reverseGeocode failed')
                    && str_contains($error, '&key=***')
                    && ! str_contains($error, 'AIzaSyFAKE');
            })
            ->once();
    }

    public function test_non_json_403_logs_a_redacted_body_snippet(): void
    {
        Log::spy();
        Http::preventStrayRequests();
        $this->useGoogleMaps();

        Http::fake([
            'places.googleapis.com/*' => Http::response(
                '<html><body>403 Forbidden by local proxy for https://places.googleapis.com/v1/places:searchText?key=AIzaSyFAKE0000000000000000000000000000</body></html>',
                403,
                ['Content-Type' => 'text/html']
            ),
            'nominatim.openstreetmap.org/*' => Http::response([]),
        ]);

        $this->getJson('/api/v1/geocode/search?q=mg+road', $this->authHeaders())->assertOk();

        Log::shouldHaveReceived('warning')
            ->withArgs(function (string $message, array $context): bool {
                return str_contains($message, 'Places API (New) rejected')
                    && str_contains((string) ($context['body_snippet'] ?? ''), '403 Forbidden by local proxy')
                    && ! str_contains((string) ($context['body_snippet'] ?? ''), 'AIzaSyFAKE');
            })
            ->once();
    }

    public function test_search_requires_query(): void
    {
        $res = $this->getJson('/api/v1/geocode/search', $this->authHeaders());

        $res->assertStatus(422);
        $this->assertArrayHasKey('q', $res->json('errors'));
    }

    public function test_reverse_rejects_out_of_bounds_coordinates(): void
    {
        $res = $this->getJson('/api/v1/geocode/reverse?lat=200&lng=500', $this->authHeaders());

        $res->assertStatus(422);
        $this->assertArrayHasKey('lat', $res->json('errors'));
    }
}
