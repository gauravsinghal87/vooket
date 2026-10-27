<?php

namespace Tests\Feature;

use App\Models\DeliveryPartner;
use App\Models\Restaurant;
use App\Models\User;
use App\Models\Vendor;
use App\Models\Zone;
use App\Services\Delivery\FoodRestaurantEtaService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Tests\TestCase;

class FoodDeliveryEtaTest extends TestCase
{
    use RefreshDatabase;

    /**
     * A fixed local wall-clock time (Asia/Kolkata) so schedule-dependent tests
     * never depend on when the suite runs.
     */
    private function travelToLocalNoon(string $time = '12:00'): void
    {
        [$hours, $minutes] = explode(':', $time);

        $this->travelTo(Carbon::create(2026, 10, 19, (int) $hours, (int) $minutes, 0, 'Asia/Kolkata'));
    }

    /**
     * Food zone covering the Bangalore coordinates these tests use, so the
     * zone-gated listing endpoints can resolve a serviceable location.
     */
    private function foodZone(): Zone
    {
        return Zone::create([
            'name' => 'ETA Test Zone',
            'code' => 'ETA-TEST-'.Str::upper(Str::random(6)),
            'type' => 'multi',
            'country' => 'IN',
            'food_enabled' => true,
            'grocery_enabled' => true,
            'ride_enabled' => true,
            'priority' => 10,
            'center_latitude' => 12.9800,
            'center_longitude' => 77.6000,
            'radius_km' => 20,
            'is_active' => true,
        ]);
    }

    private function makeRestaurant(array $overrides = [], ?Zone $zone = null): Restaurant
    {
        $vendor = Vendor::create([
            'user_id' => User::factory()->create(['user_type' => 'vendor', 'is_active' => true])->id,
            'business_name' => 'Spice Villa',
            'owner_name' => 'Rahul Sharma',
            'phone' => '9898989898',
            'vendor_type' => 'restaurant',
            'status' => 'approved',
            'is_active' => true,
            'latitude' => 12.9716,
            'longitude' => 77.5946,
            'zone_id' => $zone?->id,
        ]);

        return Restaurant::create(array_merge([
            'vendor_id' => $vendor->id,
            'name' => 'Spice Villa',
            'slug' => 'spice-villa-'.Str::random(6),
            'latitude' => 12.9716,
            'longitude' => 77.5946,
            'is_open' => true,
            'avg_prep_time_min' => 20,
            'opens_at' => '00:00',
            'closes_at' => '23:59',
        ], $overrides));
    }

    private function makeAvailablePartner(float $latitude = 12.9720, float $longitude = 77.5950): DeliveryPartner
    {
        $user = User::factory()->create(['user_type' => 'delivery_partner', 'is_active' => true]);

        return DeliveryPartner::create([
            'user_id' => $user->id,
            'status' => 'approved',
            'service_type' => 'food',
            'is_online' => true,
            'is_busy' => false,
            'latitude' => $latitude,
            'longitude' => $longitude,
            'last_location_at' => now(),
        ]);
    }

    private function useGoogleMaps(): void
    {
        config(['integrations.mode' => 'live']);
        config(['integrations.provider.maps' => 'google']);
        config(['integrations.credentials.maps.server_key' => 'test-key']);
        Cache::flush();
    }

    /**
     * A valid single-leg Distance Matrix payload (5.2 km / 16 min).
     *
     * @return array<string, mixed>
     */
    private function matrixResponse(int $rows = 1): array
    {
        return [
            'status' => 'OK',
            'rows' => array_fill(0, $rows, [
                'elements' => [[
                    'status' => 'OK',
                    'distance' => ['value' => 5200, 'text' => '5.2 km'],
                    'duration' => ['value' => 960, 'text' => '16 mins'],
                ]],
            ]),
        ];
    }

    private function destination(): array
    {
        return ['latitude' => 12.9800, 'longitude' => 77.6000];
    }

    private function etaService(): FoodRestaurantEtaService
    {
        return app(FoodRestaurantEtaService::class);
    }

    public function test_open_restaurant_returns_estimated_eta_for_customer_location(): void
    {
        $this->travelToLocalNoon();
        $restaurant = $this->makeRestaurant();

        $eta = $this->etaService()->estimate($restaurant, $this->destination());

        $this->assertSame(FoodRestaurantEtaService::STATUS_ESTIMATED, $eta['status']);
        $this->assertGreaterThan(0, $eta['min_minutes']);
        $this->assertSame($eta['min_minutes'] + (int) config('delivery_eta.range_spread_minutes'), $eta['max_minutes']);
        $this->assertGreaterThan(0, $eta['travel_distance_km']);
        $this->assertNotNull($eta['travel_minutes']);
    }

    public function test_preparation_and_rider_arrival_overlap_instead_of_summing(): void
    {
        $this->travelToLocalNoon();
        $restaurant = $this->makeRestaurant(['avg_prep_time_min' => 40]);

        $eta = $this->etaService()->estimate($restaurant, $this->destination());

        $buffer = (int) config('delivery_eta.buffer_minutes');
        $pickup = (int) config('delivery_eta.fallback_pickup_minutes');

        // The pickup clock is max(prep, rider), never prep + rider.
        $this->assertLessThan(40 + $pickup + $eta['travel_minutes'] + $buffer, $eta['min_minutes']);
        $this->assertSame(40 + $eta['travel_minutes'] + $buffer, $eta['min_minutes']);
        $this->assertSame(40, $eta['preparation_minutes']);
    }

    public function test_missing_available_partner_uses_conservative_pickup_fallback(): void
    {
        $this->travelToLocalNoon();
        $restaurant = $this->makeRestaurant();

        $eta = $this->etaService()->estimate($restaurant, $this->destination());

        $this->assertSame('fallback', $eta['pickup_source']);
        $this->assertSame((int) config('delivery_eta.fallback_pickup_minutes'), $eta['pickup_minutes']);
    }

    public function test_nearby_available_partner_is_used_for_pickup(): void
    {
        $this->travelToLocalNoon();
        $restaurant = $this->makeRestaurant(['avg_prep_time_min' => 5]);
        $this->makeAvailablePartner();

        $eta = $this->etaService()->estimate($restaurant, $this->destination(), DeliveryPartner::all());

        $this->assertSame('partner', $eta['pickup_source']);
        $this->assertLessThanOrEqual(2, $eta['pickup_minutes']);
    }

    public function test_closed_restaurant_returns_closed_status_without_minutes(): void
    {
        $this->travelToLocalNoon();
        $restaurant = $this->makeRestaurant(['opens_at' => '18:00', 'closes_at' => '22:00']);

        $eta = $this->etaService()->estimate($restaurant, $this->destination());

        $this->assertSame(FoodRestaurantEtaService::STATUS_CLOSED, $eta['status']);
        $this->assertNull($eta['min_minutes']);
        $this->assertNull($eta['max_minutes']);
    }

    public function test_overnight_schedule_is_treated_as_open(): void
    {
        $this->travelToLocalNoon('23:00');
        $restaurant = $this->makeRestaurant(['opens_at' => '18:00', 'closes_at' => '02:00']);

        $eta = $this->etaService()->estimate($restaurant, $this->destination());

        $this->assertSame(FoodRestaurantEtaService::STATUS_ESTIMATED, $eta['status']);
    }

    public function test_restaurant_without_coordinates_returns_unavailable(): void
    {
        $this->travelToLocalNoon();
        $restaurant = $this->makeRestaurant(['latitude' => null, 'longitude' => null]);

        $eta = $this->etaService()->estimate($restaurant, $this->destination());

        $this->assertSame(FoodRestaurantEtaService::STATUS_UNAVAILABLE, $eta['status']);
        $this->assertSame('restaurant_location_missing', $eta['reason']);
        $this->assertNull($eta['min_minutes']);
    }

    public function test_request_without_customer_location_returns_unavailable(): void
    {
        $this->travelToLocalNoon();
        $restaurant = $this->makeRestaurant();

        $eta = $this->etaService()->estimate($restaurant, null);

        $this->assertSame(FoodRestaurantEtaService::STATUS_UNAVAILABLE, $eta['status']);
        $this->assertSame('customer_location_missing', $eta['reason']);
    }

    public function test_live_google_route_is_used_for_eta(): void
    {
        $this->travelToLocalNoon();
        $this->useGoogleMaps();
        Http::preventStrayRequests();
        Http::fake(['maps.googleapis.com/*' => Http::response($this->matrixResponse())]);

        $eta = $this->etaService()->estimate($this->makeRestaurant(), $this->destination());

        $this->assertSame('google', $eta['route_source']);
        $this->assertSame(5.2, $eta['travel_distance_km']);
        $this->assertSame(16, $eta['travel_minutes']);
        $this->assertFalse($eta['approximate']);
    }

    public function test_live_google_route_is_cached_between_requests(): void
    {
        $this->travelToLocalNoon();
        $this->useGoogleMaps();
        Http::preventStrayRequests();
        Http::fake(['maps.googleapis.com/*' => Http::response($this->matrixResponse())]);

        $restaurant = $this->makeRestaurant();
        $first = $this->etaService()->estimate($restaurant, $this->destination());
        $second = $this->etaService()->estimate($restaurant, $this->destination());

        $this->assertSame('google', $first['route_source']);
        $this->assertSame('cache', $second['route_source']);
        Http::assertSentCount(1);
    }

    public function test_live_google_failure_without_cached_route_returns_unavailable(): void
    {
        $this->travelToLocalNoon();
        $this->useGoogleMaps();
        Http::preventStrayRequests();
        Http::fake(['maps.googleapis.com/*' => Http::response(['status' => 'ERROR'], 500)]);

        $eta = $this->etaService()->estimate($this->makeRestaurant(), $this->destination());

        $this->assertSame(FoodRestaurantEtaService::STATUS_UNAVAILABLE, $eta['status']);
        $this->assertSame('route_unavailable', $eta['reason']);
    }

    public function test_live_google_timeout_without_cached_route_returns_unavailable(): void
    {
        $this->travelToLocalNoon();
        $this->useGoogleMaps();
        Http::preventStrayRequests();
        Http::fake(fn () => throw new ConnectionException('timed out'));

        $eta = $this->etaService()->estimate($this->makeRestaurant(), $this->destination());

        $this->assertSame(FoodRestaurantEtaService::STATUS_UNAVAILABLE, $eta['status']);
        $this->assertSame('route_unavailable', $eta['reason']);
    }

    public function test_restaurants_endpoint_returns_delivery_eta(): void
    {
        $this->travelToLocalNoon();
        $this->makeRestaurant([], $this->foodZone());

        $response = $this->getJson('/api/v1/food/restaurants?latitude=12.9800&longitude=77.6000');

        $response->assertOk()
            ->assertJsonPath('data.data.0.delivery_eta.status', FoodRestaurantEtaService::STATUS_ESTIMATED);
        $this->assertGreaterThan(0, $response->json('data.data.0.delivery_eta.min_minutes'));
        $this->assertIsNumeric($response->json('data.data.0.delivery_eta.travel_distance_km'));
    }

    public function test_restaurants_endpoint_without_location_returns_no_restaurants(): void
    {
        $this->travelToLocalNoon();
        $this->makeRestaurant([], $this->foodZone());

        $response = $this->getJson('/api/v1/food/restaurants');

        // Zone resolution needs a location: without one the backend must not
        // fall back to an unfiltered list.
        $response->assertOk()
            ->assertJsonPath('meta.serviceability.is_serviceable', false);
        $this->assertCount(0, $response->json('data.data'));
    }

    public function test_restaurants_endpoint_batches_route_lookup_for_multiple_restaurants(): void
    {
        $this->travelToLocalNoon();
        $this->useGoogleMaps();
        Http::preventStrayRequests();
        Http::fake(['maps.googleapis.com/*' => Http::response($this->matrixResponse(2))]);

        $zone = $this->foodZone();
        $this->makeRestaurant([], $zone);
        $this->makeRestaurant(['name' => 'Rasoi', 'latitude' => 12.9600, 'longitude' => 77.5800], $zone);

        $response = $this->getJson('/api/v1/food/restaurants?latitude=12.9800&longitude=77.6000&per_page=15');

        $response->assertOk()
            ->assertJsonPath('data.data.0.delivery_eta.route_source', 'google')
            ->assertJsonPath('data.data.1.delivery_eta.route_source', 'google');
        Http::assertSentCount(1);
    }

    public function test_restaurants_endpoint_without_location_makes_no_route_requests(): void
    {
        $this->travelToLocalNoon();
        $this->useGoogleMaps();
        Http::preventStrayRequests();
        Http::fake();

        $this->makeRestaurant([], $this->foodZone());

        $this->getJson('/api/v1/food/restaurants')->assertOk();

        Http::assertNothingSent();
    }

    public function test_restaurant_detail_endpoint_returns_delivery_eta(): void
    {
        $this->travelToLocalNoon();
        $restaurant = $this->makeRestaurant([], $this->foodZone());

        $response = $this->getJson("/api/v1/food/restaurants/{$restaurant->id}?latitude=12.9800&longitude=77.6000");

        $response->assertOk()
            ->assertJsonPath('data.delivery_eta.status', FoodRestaurantEtaService::STATUS_ESTIMATED);
    }

    public function test_discovery_home_returns_delivery_eta_for_recommended_restaurants(): void
    {
        $this->travelToLocalNoon();
        $this->makeRestaurant([], $this->foodZone());

        $response = $this->getJson('/api/v1/discovery/home?latitude=12.9800&longitude=77.6000');

        $response->assertOk()
            ->assertJsonPath('data.food.recommended.0.delivery_eta.status', FoodRestaurantEtaService::STATUS_ESTIMATED);
    }
}
