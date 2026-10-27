<?php

namespace Tests\Feature;

use App\Models\Restaurant;
use App\Models\Role;
use App\Models\User;
use App\Models\Vendor;
use App\Models\Zone;
use App\Services\Maps\ZoneService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Zone-based Food visibility: the backend resolves the customer's active Food
 * zone and only lists restaurants that can actually deliver to the location.
 *
 * Coordinates are real-world points around Jaipur so the tests exercise the
 * same polygon/radius maths the live zones use.
 */
class FoodServiceabilityTest extends TestCase
{
    use RefreshDatabase;

    /** Customer location used by most tests (Jaipur city centre). */
    private const CUSTOMER_LAT = 26.9124;

    private const CUSTOMER_LNG = 75.7873;

    /** A point well outside every test zone (Bangalore). */
    private const FAR_LAT = 12.9716;

    private const FAR_LNG = 77.5946;

    /**
     * @param  array<string, mixed>  $overrides
     */
    private function zone(array $overrides = []): Zone
    {
        return Zone::create(array_merge([
            'name' => 'Test Food Zone',
            'code' => 'TEST-'.Str::upper(Str::random(6)),
            'type' => 'multi',
            'country' => 'IN',
            'food_enabled' => true,
            'grocery_enabled' => true,
            'ride_enabled' => true,
            'priority' => 10,
            'center_latitude' => self::CUSTOMER_LAT,
            'center_longitude' => self::CUSTOMER_LNG,
            'radius_km' => 20,
            'is_active' => true,
        ], $overrides));
    }

    /**
     * @return array<int, array{lat: float, lng: float}>
     */
    private function squarePolygon(float $latitude, float $longitude, float $delta = 0.05): array
    {
        return [
            ['lat' => $latitude - $delta, 'lng' => $longitude - $delta],
            ['lat' => $latitude - $delta, 'lng' => $longitude + $delta],
            ['lat' => $latitude + $delta, 'lng' => $longitude + $delta],
            ['lat' => $latitude + $delta, 'lng' => $longitude - $delta],
        ];
    }

    private function restaurant(
        string $name,
        ?Zone $vendorZone,
        float $latitude = self::CUSTOMER_LAT,
        float $longitude = self::CUSTOMER_LNG,
        bool $isOpen = true,
    ): Restaurant {
        $vendor = Vendor::create([
            'user_id' => User::factory()->create(['user_type' => 'vendor'])->id,
            'business_name' => $name.' Vendor',
            'owner_name' => 'Test Owner',
            'phone' => '9'.random_int(100000000, 999999999),
            'vendor_type' => 'restaurant',
            'status' => 'approved',
            'is_active' => true,
            'latitude' => $latitude,
            'longitude' => $longitude,
            'zone_id' => $vendorZone?->id,
        ]);

        return Restaurant::create([
            'vendor_id' => $vendor->id,
            'name' => $name,
            'slug' => Str::slug($name).'-'.Str::lower(Str::random(6)),
            'latitude' => $latitude,
            'longitude' => $longitude,
            'is_open' => $isOpen,
        ]);
    }

    /**
     * @param  array<string, mixed>  $params
     * @return array{ids: array<int, int>, serviceability: array<string, mixed>, first: array<string, mixed>|null}
     */
    private function listings(?float $latitude = self::CUSTOMER_LAT, ?float $longitude = self::CUSTOMER_LNG, array $params = []): array
    {
        $query = $params;

        if ($latitude !== null) {
            $query['latitude'] = $latitude;
        }

        if ($longitude !== null) {
            $query['longitude'] = $longitude;
        }

        $response = $this->getJson('/api/v1/food/restaurants?'.http_build_query($query))->assertOk();
        $rows = $response->json('data.data');

        return [
            'ids' => collect($rows)->pluck('id')->all(),
            'serviceability' => $response->json('meta.serviceability'),
            'first' => $rows[0] ?? null,
        ];
    }

    public function test_lists_restaurants_inside_the_resolved_food_zone(): void
    {
        $zone = $this->zone();
        $inside = $this->restaurant('Inside Kitchen', $zone, 26.9050, 75.7800);

        // Beyond the zone's food search radius (== its 20 km radius here).
        $tooFar = $this->restaurant('Far Kitchen', $zone, 26.9124, 75.7873 + 0.5);

        // Same coarse area but a different zone: without cross-zone delivery it
        // must not leak into the higher-priority zone's listing.
        $otherZone = $this->zone(['name' => 'Other Zone', 'priority' => 5]);
        $neighbourOutlet = $this->restaurant('Neighbour Kitchen', $otherZone);

        $result = $this->listings();

        $this->assertSame([$inside->id], $result['ids']);
        $this->assertNotContains($tooFar->id, $result['ids']);
        $this->assertNotContains($neighbourOutlet->id, $result['ids']);
        $this->assertTrue($result['serviceability']['is_serviceable']);
        $this->assertSame($zone->id, $result['serviceability']['zone_id']);
        $this->assertSame('food', $result['serviceability']['service']);

        // The browsing ETA is still attached to the surviving rows.
        $this->assertIsArray($result['first']['delivery_eta']);
    }

    public function test_returns_no_restaurants_when_the_location_is_outside_every_zone(): void
    {
        $zone = $this->zone(['radius_km' => 5]);
        $this->restaurant('Inside Kitchen', $zone);

        $result = $this->listings(self::FAR_LAT, self::FAR_LNG);

        $this->assertSame([], $result['ids']);
        $this->assertFalse($result['serviceability']['is_serviceable']);
        $this->assertSame(ZoneService::REASON_OUTSIDE_SERVICE_AREA, $result['serviceability']['reason']);
    }

    public function test_inactive_zone_is_not_serviceable(): void
    {
        $zone = $this->zone(['is_active' => false]);
        $this->restaurant('Inside Kitchen', $zone);

        $result = $this->listings();

        $this->assertSame([], $result['ids']);
        $this->assertFalse($result['serviceability']['is_serviceable']);
        $this->assertSame(ZoneService::REASON_NO_ZONE, $result['serviceability']['reason']);
    }

    public function test_zone_with_food_disabled_is_not_serviceable(): void
    {
        // Food is live somewhere (a Food-enabled zone exists) but not in the
        // zone that actually covers the customer, so the reason is the distinct
        // "service not available in this zone" rather than "no zone defined".
        $foodDisabledZone = $this->zone(['food_enabled' => false, 'grocery_enabled' => true]);

        $this->zone([
            'name' => 'Far Food Zone',
            'priority' => 5,
            'center_latitude' => 27.5000,
            'center_longitude' => 76.5000,
            'radius_km' => 1,
        ]);

        $this->restaurant('Inside Kitchen', $foodDisabledZone);

        $result = $this->listings();

        $this->assertSame([], $result['ids']);
        $this->assertFalse($result['serviceability']['is_serviceable']);
        $this->assertSame(ZoneService::REASON_SERVICE_DISABLED, $result['serviceability']['reason']);
    }

    public function test_missing_coordinates_return_no_restaurants(): void
    {
        $zone = $this->zone();
        $this->restaurant('Inside Kitchen', $zone);

        $result = $this->listings(null, null);

        $this->assertSame([], $result['ids']);
        $this->assertFalse($result['serviceability']['is_serviceable']);
        $this->assertSame('LOCATION_REQUIRED', $result['serviceability']['reason']);
    }

    public function test_invalid_coordinates_return_no_restaurants(): void
    {
        $zone = $this->zone();
        $this->restaurant('Inside Kitchen', $zone);

        $result = $this->listings(999.0, 999.0);

        $this->assertSame([], $result['ids']);
        $this->assertFalse($result['serviceability']['is_serviceable']);
        $this->assertSame(ZoneService::REASON_INVALID_COORDINATES, $result['serviceability']['reason']);
    }

    public function test_polygon_takes_precedence_over_the_radius(): void
    {
        // Centre + generous radius would include the customer, but the drawn
        // polygon does not, so the polygon wins and the location is unserviceable.
        $polygonExcludesCustomer = $this->zone([
            'polygon' => $this->squarePolygon(27.0000, 75.9000, 0.01),
        ]);

        $this->restaurant('Polygon Kitchen', $polygonExcludesCustomer);

        $excluded = $this->listings();

        $this->assertSame([], $excluded['ids']);
        $this->assertSame(ZoneService::REASON_OUTSIDE_SERVICE_AREA, $excluded['serviceability']['reason']);

        // Radius is tiny and would exclude the customer, but the polygon
        // contains them, so the polygon wins and the location is serviceable.
        // The food search radius is set independently so the listing rule does
        // not accidentally hide the outlet.
        $polygonIncludesCustomer = $this->zone([
            'name' => 'Polygon Zone',
            'priority' => 50,
            'radius_km' => 0.01,
            'food_partner_search_radius_km' => 20,
            'polygon' => $this->squarePolygon(self::CUSTOMER_LAT, self::CUSTOMER_LNG, 0.05),
        ]);

        $included = $this->restaurant('Inside Polygon Kitchen', $polygonIncludesCustomer, 26.9000, 75.7800);

        // Remove the first zone so only the polygon zone can resolve.
        $polygonExcludesCustomer->forceDelete();

        $serviceable = $this->listings();

        $this->assertSame([$included->id], $serviceable['ids']);
        $this->assertTrue($serviceable['serviceability']['is_serviceable']);
        $this->assertSame($polygonIncludesCustomer->id, $serviceable['serviceability']['zone_id']);
    }

    public function test_radius_is_used_when_no_valid_polygon_is_defined(): void
    {
        // A single-vertex polygon is not a boundary: the radius fallback decides.
        $zone = $this->zone([
            'radius_km' => 20,
            'polygon' => [['lat' => 27.0000, 'lng' => 75.9000]],
        ]);

        $inside = $this->restaurant('Radius Kitchen', $zone, 26.9050, 75.7800);

        $result = $this->listings();

        $this->assertSame([$inside->id], $result['ids']);
        $this->assertTrue($result['serviceability']['is_serviceable']);
        $this->assertSame($zone->id, $result['serviceability']['zone_id']);
    }

    public function test_overlapping_zones_resolve_by_priority(): void
    {
        $this->zone(['name' => 'Low Priority', 'priority' => 1]);

        $high = $this->zone(['name' => 'High Priority', 'priority' => 100]);
        $highOutlet = $this->restaurant('High Kitchen', $high);

        $low = $this->zone(['name' => 'Low Outlet Zone', 'priority' => 1]);
        $lowOutlet = $this->restaurant('Low Kitchen', $low);

        $result = $this->listings();

        $this->assertSame($high->id, $result['serviceability']['zone_id']);
        $this->assertSame([$highOutlet->id], $result['ids']);
        $this->assertNotContains($lowOutlet->id, $result['ids']);
    }

    public function test_food_search_radius_filters_restaurants_inside_the_zone_radius(): void
    {
        $zone = $this->zone([
            'radius_km' => 50,
            'food_partner_search_radius_km' => 5,
        ]);

        $near = $this->restaurant('Near Kitchen', $zone, 26.9100, 75.7850);

        // ~7.5 km away: inside the zone radius but beyond the food search radius.
        $far = $this->restaurant('Far Kitchen', $zone, 26.9800, 75.7873);

        $result = $this->listings();

        $this->assertSame([$near->id], $result['ids']);
        $this->assertNotContains($far->id, $result['ids']);
    }

    public function test_cross_zone_delivery_lists_restaurants_from_other_zones_when_enabled(): void
    {
        $this->zone([
            'radius_km' => 50,
            'allow_cross_zone_food_delivery' => true,
        ]);

        $other = $this->zone([
            'name' => 'Adjacent Zone',
            'priority' => 5,
            'center_latitude' => 26.9500,
            'center_longitude' => 75.8500,
        ]);

        $crossZoneOutlet = $this->restaurant('Adjacent Kitchen', $other, 26.9500, 75.8500);
        $unzonedOutlet = $this->restaurant('Unzoned Kitchen', null, 26.9300, 75.8000);

        $result = $this->listings();

        $this->assertTrue($result['serviceability']['is_serviceable']);
        $this->assertTrue($result['serviceability']['allows_cross_zone_food_delivery']);
        $this->assertContains($crossZoneOutlet->id, $result['ids']);
        $this->assertContains($unzonedOutlet->id, $result['ids']);
    }

    public function test_cross_zone_delivery_hides_other_zone_restaurants_when_disabled(): void
    {
        $this->zone([
            'radius_km' => 50,
            'allow_cross_zone_food_delivery' => false,
        ]);

        $other = $this->zone([
            'name' => 'Adjacent Zone',
            'priority' => 5,
            'center_latitude' => 26.9500,
            'center_longitude' => 75.8500,
        ]);

        $crossZoneOutlet = $this->restaurant('Adjacent Kitchen', $other, 26.9500, 75.8500);
        $unzonedOutlet = $this->restaurant('Unzoned Kitchen', null, 26.9300, 75.8000);

        $result = $this->listings();

        $this->assertNotContains($crossZoneOutlet->id, $result['ids']);
        $this->assertNotContains($unzonedOutlet->id, $result['ids']);
    }

    public function test_discovery_home_rails_use_the_same_filtered_set(): void
    {
        $zone = $this->zone();
        $inside = $this->restaurant('Inside Kitchen', $zone);

        $otherZone = $this->zone(['name' => 'Other Zone', 'priority' => 5]);
        $outside = $this->restaurant('Outside Kitchen', $otherZone);

        $response = $this->getJson('/api/v1/discovery/home?latitude='.self::CUSTOMER_LAT.'&longitude='.self::CUSTOMER_LNG)
            ->assertOk();

        $recommendedIds = collect($response->json('data.food.recommended'))->pluck('id')->all();
        $popularIds = collect($response->json('data.food.popular'))->pluck('id')->all();

        $this->assertSame([$inside->id], $recommendedIds);
        $this->assertSame([$inside->id], $popularIds);
        $this->assertNotContains($outside->id, $recommendedIds);
        $this->assertTrue($response->json('meta.serviceability.is_serviceable'));

        // Grocery rails are untouched by the Food zone rule.
        $this->assertArrayHasKey('stores', $response->json('data.grocery'));

        $far = $this->getJson('/api/v1/discovery/home?latitude='.self::FAR_LAT.'&longitude='.self::FAR_LNG)
            ->assertOk();

        $this->assertSame([], $far->json('data.food.recommended'));
        $this->assertFalse($far->json('meta.serviceability.is_serviceable'));
    }

    public function test_discovery_search_excludes_out_of_zone_restaurants(): void
    {
        $zone = $this->zone();
        $inside = $this->restaurant('Biryani House', $zone, 26.9050, 75.7800);

        $otherZone = $this->zone(['name' => 'Other Zone', 'priority' => 5]);
        $otherZoneOutlet = $this->restaurant('Biryani Palace', $otherZone);

        $beyondRadius = $this->restaurant('Biryani Junction', $zone, 26.9124, 75.7873 + 0.5);

        $response = $this->getJson(
            '/api/v1/discovery/search?query=Biryani&type=food&latitude='.self::CUSTOMER_LAT.'&longitude='.self::CUSTOMER_LNG
        )->assertOk();

        $ids = collect($response->json('data.restaurants'))->pluck('id')->all();

        $this->assertSame([$inside->id], $ids);
        $this->assertNotContains($otherZoneOutlet->id, $ids);
        $this->assertNotContains($beyondRadius->id, $ids);
    }

    public function test_grocery_and_ride_serviceability_are_unaffected_by_the_food_zone_rule(): void
    {
        // A Food-disabled zone still serves grocery and rides.
        $this->zone(['food_enabled' => false, 'grocery_enabled' => true, 'ride_enabled' => true]);

        $query = 'latitude='.self::CUSTOMER_LAT.'&longitude='.self::CUSTOMER_LNG;

        $this->assertFalse(
            $this->getJson('/api/v1/serviceability?'.$query.'&service=food')->assertOk()->json('data.serviceable')
        );

        $this->assertTrue(
            $this->getJson('/api/v1/serviceability?'.$query.'&service=grocery')->assertOk()->json('data.serviceable')
        );

        $this->assertTrue(
            $this->getJson('/api/v1/serviceability?'.$query.'&service=ride')->assertOk()->json('data.serviceable')
        );
    }

    public function test_hiding_a_restaurant_for_an_unserviceable_location_does_not_delete_it(): void
    {
        $zone = $this->zone();
        $restaurant = $this->restaurant('Inside Kitchen', $zone, 26.9050, 75.7800);

        $result = $this->listings(self::FAR_LAT, self::FAR_LNG);

        $this->assertSame([], $result['ids']);
        $this->assertSame(1, Restaurant::count());
        $this->assertTrue(Restaurant::whereKey($restaurant->id)->exists());

        // The restaurant detail endpoint keeps working for direct links.
        $this->getJson("/api/v1/food/restaurants/{$restaurant->id}?latitude=".self::FAR_LAT.'&longitude='.self::FAR_LNG)
            ->assertOk()
            ->assertJsonPath('data.id', $restaurant->id);
    }

    public function test_zone_configuration_version_changes_after_an_admin_zone_mutation(): void
    {
        $zone = $this->zone();
        $this->restaurant('Inside Kitchen', $zone, 26.9050, 75.7800);

        $before = $this->listings()['serviceability']['zone_version'];

        $role = Role::updateOrCreate(['slug' => 'super_admin'], ['name' => 'Super Admin', 'is_system' => true]);
        $admin = User::create([
            'name' => 'Zone Admin',
            'email' => 'zone-admin@example.com',
            'phone' => '9777777771',
            'password' => Hash::make('secret'),
            'user_type' => 'super_admin',
            'is_active' => true,
        ]);
        $admin->roles()->sync([$role->id]);

        $this->postJson('/api/v1/admin/zones', [
            'name' => 'Newly Drawn Zone',
            'code' => 'NEW-ZONE',
            'food_enabled' => true,
            'priority' => 20,
            'center_latitude' => 26.8000,
            'center_longitude' => 75.8000,
            'radius_km' => 10,
        ], ['Authorization' => 'Bearer '.$admin->createToken('test')->plainTextToken])
            ->assertStatus(201);

        $after = $this->listings()['serviceability']['zone_version'];

        $this->assertGreaterThan($before, $after);
    }
}
