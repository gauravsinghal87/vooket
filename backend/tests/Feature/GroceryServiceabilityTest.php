<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Product;
use App\Models\Restaurant;
use App\Models\Role;
use App\Models\Store;
use App\Models\User;
use App\Models\Vendor;
use App\Models\Zone;
use App\Services\Maps\ZoneService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Zone-based Grocery visibility: the backend resolves the customer's active
 * Grocery zone and only lists the stores (and therefore the categories and
 * products behind them) that can actually deliver to that location.
 *
 * Coordinates are real-world points around Jaipur so the tests exercise the
 * same polygon/radius maths the live zones use. Zone settings are only ever
 * created here — the Admin zone configuration itself is never rewritten.
 */
class GroceryServiceabilityTest extends TestCase
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
            'name' => 'Test Grocery Zone',
            'code' => 'GROC-'.Str::upper(Str::random(6)),
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

    private function store(
        string $name,
        ?Zone $vendorZone,
        float $latitude = self::CUSTOMER_LAT,
        float $longitude = self::CUSTOMER_LNG,
        bool $isOpen = true,
        bool $isFeatured = false,
    ): Store {
        $vendor = Vendor::create([
            'user_id' => User::factory()->create(['user_type' => 'vendor'])->id,
            'business_name' => $name.' Vendor',
            'owner_name' => 'Test Owner',
            'phone' => '9'.random_int(100000000, 999999999),
            'vendor_type' => 'grocery',
            'status' => 'approved',
            'is_active' => true,
            'latitude' => $latitude,
            'longitude' => $longitude,
            'zone_id' => $vendorZone?->id,
        ]);

        return Store::create([
            'vendor_id' => $vendor->id,
            'name' => $name,
            'slug' => Str::slug($name).'-'.Str::lower(Str::random(6)),
            'store_type' => 'supermarket',
            'latitude' => $latitude,
            'longitude' => $longitude,
            'is_open' => $isOpen,
            'is_featured' => $isFeatured,
            'order_type' => 'both',
        ]);
    }

    private function product(Store $store, string $name, bool $isFeatured = false): Product
    {
        return Product::create([
            'vendor_id' => $store->vendor_id,
            'store_id' => $store->id,
            'name' => $name,
            'slug' => Str::slug($name).'-'.Str::lower(Str::random(6)),
            'sku' => 'SKU-'.Str::upper(Str::random(8)),
            'price' => 120,
            'type' => 'grocery',
            'is_featured' => $isFeatured,
            'is_active' => true,
            'is_available' => true,
        ]);
    }

    /**
     * GET /grocery/stores for a coordinate pair.
     *
     * @param  array<string, mixed>  $params
     * @return array{ids: array<int, int>, serviceability: array<string, mixed>}
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

        $response = $this->getJson('/api/v1/grocery/stores?'.http_build_query($query))->assertOk();

        return [
            'ids' => collect($response->json('data.data'))->pluck('id')->all(),
            'serviceability' => $response->json('meta.serviceability'),
        ];
    }

    /* ------------------------------------------------------------------
     | Zone resolution
     * ---------------------------------------------------------------- */

    public function test_lists_stores_inside_the_resolved_grocery_zone(): void
    {
        $zone = $this->zone();
        $inside = $this->store('Inside Mart', $zone, 26.9050, 75.7800);

        // Well beyond the zone's grocery search radius (its 20 km radius here).
        $tooFar = $this->store('Far Mart', $zone, 26.9124, 75.7873 + 0.5);

        // Same area, different zone: without cross-zone grocery delivery it must
        // not leak into the resolved zone's listing.
        $otherZone = $this->zone(['name' => 'Other Zone', 'priority' => 5]);
        $neighbour = $this->store('Neighbour Mart', $otherZone);

        $result = $this->listings();

        $this->assertSame([$inside->id], $result['ids']);
        $this->assertNotContains($tooFar->id, $result['ids']);
        $this->assertNotContains($neighbour->id, $result['ids']);

        $this->assertTrue($result['serviceability']['is_serviceable']);
        $this->assertNull($result['serviceability']['reason']);
        $this->assertSame($zone->id, $result['serviceability']['zone_id']);
        $this->assertSame('Test Grocery Zone', $result['serviceability']['zone_name']);
        $this->assertSame('grocery', $result['serviceability']['service']);
        $this->assertEquals(20, $result['serviceability']['search_radius_km']);
        $this->assertFalse($result['serviceability']['allows_cross_zone_grocery_delivery']);
    }

    public function test_returns_no_stores_when_the_location_is_outside_every_zone(): void
    {
        $zone = $this->zone(['radius_km' => 5]);
        $this->store('Inside Mart', $zone);

        $result = $this->listings(self::FAR_LAT, self::FAR_LNG);

        $this->assertSame([], $result['ids']);
        $this->assertFalse($result['serviceability']['is_serviceable']);
        $this->assertSame(ZoneService::REASON_OUTSIDE_SERVICE_AREA, $result['serviceability']['reason']);
    }

    public function test_inactive_zone_is_not_serviceable(): void
    {
        $zone = $this->zone(['is_active' => false]);
        $this->store('Inside Mart', $zone);

        $result = $this->listings();

        $this->assertSame([], $result['ids']);
        $this->assertFalse($result['serviceability']['is_serviceable']);
        $this->assertSame(ZoneService::REASON_NO_ZONE, $result['serviceability']['reason']);
    }

    public function test_zone_with_grocery_disabled_is_not_serviceable(): void
    {
        // Grocery is live somewhere else, but not in the zone that actually
        // covers the customer, so the distinct "service not available in this
        // zone" reason is reported instead of "no zone defined".
        $groceryDisabledZone = $this->zone(['grocery_enabled' => false]);

        $this->zone([
            'name' => 'Far Grocery Zone',
            'priority' => 5,
            'center_latitude' => 27.5000,
            'center_longitude' => 76.5000,
            'radius_km' => 1,
        ]);

        $this->store('Inside Mart', $groceryDisabledZone);

        $result = $this->listings();

        $this->assertSame([], $result['ids']);
        $this->assertFalse($result['serviceability']['is_serviceable']);
        $this->assertSame(ZoneService::REASON_SERVICE_DISABLED, $result['serviceability']['reason']);
    }

    public function test_grocery_disabled_zone_yields_to_a_grocery_enabled_zone(): void
    {
        // Overlapping zones: the higher-priority one has Grocery switched off,
        // so resolution falls through to the lower-priority Grocery-enabled zone
        // that covers the very same point.
        $disabled = $this->zone(['name' => 'Grocery Off', 'priority' => 30, 'grocery_enabled' => false]);
        $enabled = $this->zone(['name' => 'Grocery On', 'priority' => 5]);

        $store = $this->store('Enabled Mart', $enabled);

        $result = $this->listings();

        $this->assertSame([$store->id], $result['ids']);
        $this->assertTrue($result['serviceability']['is_serviceable']);
        $this->assertSame($enabled->id, $result['serviceability']['zone_id']);
        $this->assertNotSame($disabled->id, $result['serviceability']['zone_id']);
    }

    public function test_polygon_boundary_takes_precedence_over_the_radius_fallback(): void
    {
        // The circular radius would cover the customer, but the drawn boundary
        // does not — the polygon is authoritative, so the location is outside.
        $zone = $this->zone([
            'polygon' => $this->squarePolygon(27.5000, 76.5000),
        ]);

        $store = $this->store('Inside Mart', $zone);

        $result = $this->listings();

        $this->assertSame([], $result['ids']);
        $this->assertFalse($result['serviceability']['is_serviceable']);
        $this->assertSame(ZoneService::REASON_OUTSIDE_SERVICE_AREA, $result['serviceability']['reason']);
    }

    public function test_zone_without_a_polygon_falls_back_to_its_radius(): void
    {
        $zone = $this->zone(['polygon' => null]);
        $store = $this->store('Inside Mart', $zone);

        $result = $this->listings();

        $this->assertSame([$store->id], $result['ids']);
        $this->assertTrue($result['serviceability']['is_serviceable']);
        $this->assertSame($zone->id, $result['serviceability']['zone_id']);
    }

    public function test_overlapping_zone_priority_decides_which_stores_are_listed(): void
    {
        $highPriority = $this->zone(['name' => 'Priority Zone', 'priority' => 30]);
        $lowPriority = $this->zone(['name' => 'Low Priority Zone', 'priority' => 5]);

        $highStore = $this->store('Priority Mart', $highPriority);
        $lowStore = $this->store('Low Priority Mart', $lowPriority);

        $result = $this->listings();

        $this->assertSame($highPriority->id, $result['serviceability']['zone_id']);
        $this->assertSame([$highStore->id], $result['ids']);
        $this->assertNotContains($lowStore->id, $result['ids']);
    }

    public function test_grocery_search_radius_filters_distant_stores(): void
    {
        $zone = $this->zone(['grocery_partner_search_radius_km' => 2]);

        $near = $this->store('Near Mart', $zone, self::CUSTOMER_LAT, self::CUSTOMER_LNG + 0.01);
        $mid = $this->store('Mid Mart', $zone, self::CUSTOMER_LAT, self::CUSTOMER_LNG + 0.05);

        $result = $this->listings();

        $this->assertSame([$near->id], $result['ids']);
        $this->assertNotContains($mid->id, $result['ids']);
        $this->assertEquals(2, $result['serviceability']['search_radius_km']);
    }

    public function test_cross_zone_grocery_delivery_lists_neighbour_stores_only_when_enabled(): void
    {
        $neighbourZone = $this->zone(['name' => 'Neighbour Zone', 'priority' => 5]);
        $neighbourStore = $this->store('Neighbour Mart', $neighbourZone);

        $zone = $this->zone(['name' => 'Home Zone', 'priority' => 30, 'allow_cross_zone_grocery_delivery' => false]);
        $homeStore = $this->store('Home Mart', $zone);

        $crossOff = $this->listings();
        $this->assertSame([$homeStore->id], $crossOff['ids']);
        $this->assertNotContains($neighbourStore->id, $crossOff['ids']);
        $this->assertFalse($crossOff['serviceability']['allows_cross_zone_grocery_delivery']);

        $zone->update(['allow_cross_zone_grocery_delivery' => true]);

        $crossOn = $this->listings();
        $this->assertEqualsCanonicalizing([$homeStore->id, $neighbourStore->id], $crossOn['ids']);
        $this->assertTrue($crossOn['serviceability']['allows_cross_zone_grocery_delivery']);
    }

    public function test_store_without_coordinates_is_never_listed(): void
    {
        $zone = $this->zone();
        $located = $this->store('Located Mart', $zone);
        $missing = $this->store('Missing Mart', $zone);

        $missing->forceFill(['latitude' => null, 'longitude' => null])->save();

        $result = $this->listings();

        $this->assertSame([$located->id], $result['ids']);
        $this->assertNotContains($missing->id, $result['ids']);
    }

    /* ------------------------------------------------------------------
     | Missing / invalid coordinates
     * ---------------------------------------------------------------- */

    public function test_missing_coordinates_return_no_stores_products_or_categories(): void
    {
        $zone = $this->zone();
        $store = $this->store('Inside Mart', $zone);
        $this->product($store, 'Inside Flour');

        $stores = $this->listings(null, null);
        $this->assertSame([], $stores['ids']);
        $this->assertFalse($stores['serviceability']['is_serviceable']);
        $this->assertSame('LOCATION_REQUIRED', $stores['serviceability']['reason']);

        $categories = $this->getJson('/api/v1/grocery/categories')->assertOk();
        $this->assertSame([], $categories->json('data'));
        $this->assertSame('LOCATION_REQUIRED', $categories->json('meta.serviceability.reason'));

        $products = $this->getJson('/api/v1/grocery/products')->assertOk();
        $this->assertSame([], collect($products->json('data.data'))->pluck('id')->all());
        $this->assertFalse($products->json('meta.serviceability.is_serviceable'));
    }

    public function test_invalid_coordinates_are_rejected(): void
    {
        $zone = $this->zone();
        $this->store('Inside Mart', $zone);

        $result = $this->listings(999, 0);

        $this->assertSame([], $result['ids']);
        $this->assertFalse($result['serviceability']['is_serviceable']);
        $this->assertSame(ZoneService::REASON_INVALID_COORDINATES, $result['serviceability']['reason']);

        // Non-numeric coordinates never reach the resolver as a number.
        $response = $this->getJson('/api/v1/grocery/stores?latitude=north&longitude=west')->assertOk();
        $this->assertSame([], collect($response->json('data.data'))->pluck('id')->all());
        $this->assertSame('LOCATION_REQUIRED', $response->json('meta.serviceability.reason'));
    }

    /* ------------------------------------------------------------------
     | Endpoint enforcement
     * ---------------------------------------------------------------- */

    public function test_store_detail_of_an_ineligible_store_is_not_exposed(): void
    {
        $zoneA = $this->zone(['name' => 'Zone A', 'center_latitude' => self::CUSTOMER_LAT, 'center_longitude' => self::CUSTOMER_LNG]);
        $zoneB = $this->zone([
            'name' => 'Zone B',
            'priority' => 5,
            'center_latitude' => 18.5204,
            'center_longitude' => 73.8567,
            'radius_km' => 5,
        ]);

        $homeStore = $this->store('Home Mart', $zoneA);
        $awayStore = $this->store('Away Mart', $zoneB, 18.5204, 73.8567);

        // A serviceable location still may not read another zone's store.
        $inZone = $this->getJson("/api/v1/grocery/stores/{$awayStore->id}?latitude=".self::CUSTOMER_LAT.'&longitude='.self::CUSTOMER_LNG)
            ->assertOk();
        $this->assertNull($inZone->json('data'));
        $this->assertTrue($inZone->json('meta.serviceability.is_serviceable'));

        // An unserviceable location may not read any store.
        $outside = $this->getJson("/api/v1/grocery/stores/{$homeStore->id}?latitude=".self::FAR_LAT.'&longitude='.self::FAR_LNG)
            ->assertOk();
        $this->assertNull($outside->json('data'));
        $this->assertFalse($outside->json('meta.serviceability.is_serviceable'));

        // A store that does not exist keeps its 404.
        $this->getJson('/api/v1/grocery/stores/999999?latitude='.self::CUSTOMER_LAT.'&longitude='.self::CUSTOMER_LNG)
            ->assertNotFound();
    }

    public function test_store_products_of_an_ineligible_store_are_not_exposed(): void
    {
        $zoneA = $this->zone(['name' => 'Zone A']);
        $zoneB = $this->zone([
            'name' => 'Zone B',
            'priority' => 5,
            'center_latitude' => 18.5204,
            'center_longitude' => 73.8567,
            'radius_km' => 5,
        ]);

        $awayStore = $this->store('Away Mart', $zoneB, 18.5204, 73.8567);
        $awayProduct = $this->product($awayStore, 'Away Sugar');

        $this->store('Home Mart', $zoneA);

        $eligible = $this->getJson("/api/v1/grocery/stores/{$awayStore->id}/products?latitude=".self::CUSTOMER_LAT.'&longitude='.self::CUSTOMER_LNG)
            ->assertOk();
        $this->assertSame([], collect($eligible->json('data.data'))->pluck('id')->all());
        $this->assertNotContains($awayProduct->id, collect($eligible->json('data.data'))->pluck('id')->all());
        $this->assertTrue($eligible->json('meta.serviceability.is_serviceable'));

        $outside = $this->getJson("/api/v1/grocery/stores/{$awayStore->id}/products?latitude=".self::FAR_LAT.'&longitude='.self::FAR_LNG)
            ->assertOk();
        $this->assertSame([], collect($outside->json('data.data'))->pluck('id')->all());
        $this->assertFalse($outside->json('meta.serviceability.is_serviceable'));

        $this->getJson('/api/v1/grocery/stores/999999/products?latitude='.self::CUSTOMER_LAT.'&longitude='.self::CUSTOMER_LNG)
            ->assertNotFound();
    }

    public function test_all_products_are_scoped_to_eligible_stores(): void
    {
        $zoneA = $this->zone(['name' => 'Zone A']);
        $zoneB = $this->zone([
            'name' => 'Zone B',
            'priority' => 5,
            'center_latitude' => 18.5204,
            'center_longitude' => 73.8567,
            'radius_km' => 5,
        ]);

        $homeStore = $this->store('Home Mart', $zoneA);
        $awayStore = $this->store('Away Mart', $zoneB, 18.5204, 73.8567);

        $homeProduct = $this->product($homeStore, 'Home Flour');
        $awayProduct = $this->product($awayStore, 'Away Flour');

        $inZone = $this->getJson('/api/v1/grocery/products?latitude='.self::CUSTOMER_LAT.'&longitude='.self::CUSTOMER_LNG)
            ->assertOk();

        $ids = collect($inZone->json('data.data'))->pluck('id')->all();

        $this->assertContains($homeProduct->id, $ids);
        $this->assertNotContains($awayProduct->id, $ids);

        $outside = $this->getJson('/api/v1/grocery/products?latitude='.self::FAR_LAT.'&longitude='.self::FAR_LNG)
            ->assertOk();

        $this->assertSame([], collect($outside->json('data.data'))->pluck('id')->all());
        $this->assertFalse($outside->json('meta.serviceability.is_serviceable'));
    }

    public function test_discovery_home_grocery_rails_follow_the_zone_rules(): void
    {
        $zoneA = $this->zone(['name' => 'Zone A']);
        $zoneB = $this->zone([
            'name' => 'Zone B',
            'priority' => 5,
            'center_latitude' => 18.5204,
            'center_longitude' => 73.8567,
            'radius_km' => 5,
        ]);

        $homeStore = $this->store('Home Mart', $zoneA, self::CUSTOMER_LAT, self::CUSTOMER_LNG, true, true);
        $awayStore = $this->store('Away Mart', $zoneB, 18.5204, 73.8567, true, true);

        $homeProduct = $this->product($homeStore, 'Home Rice', true);
        $awayProduct = $this->product($awayStore, 'Away Rice', true);

        Category::create(['name' => 'Grocery Pantry', 'slug' => 'grocery-pantry', 'type' => 'grocery']);

        $inZone = $this->getJson('/api/v1/discovery/home?latitude='.self::CUSTOMER_LAT.'&longitude='.self::CUSTOMER_LNG)
            ->assertOk();

        $storeIds = collect($inZone->json('data.grocery.stores'))->pluck('id')->all();
        $recommendedIds = collect($inZone->json('data.grocery.recommended'))->pluck('id')->all();

        $this->assertSame([$homeStore->id], $storeIds);
        $this->assertNotContains($awayStore->id, $storeIds);
        $this->assertContains($homeProduct->id, $recommendedIds);
        $this->assertNotContains($awayProduct->id, $recommendedIds);
        $this->assertCount(1, $inZone->json('data.grocery.categories'));

        // Both services report their own verdict for the same coordinates.
        $this->assertTrue($inZone->json('meta.grocery_serviceability.is_serviceable'));
        $this->assertSame('grocery', $inZone->json('meta.grocery_serviceability.service'));
        $this->assertSame('food', $inZone->json('meta.serviceability.service'));

        $outside = $this->getJson('/api/v1/discovery/home?latitude='.self::FAR_LAT.'&longitude='.self::FAR_LNG)
            ->assertOk();

        $this->assertSame([], collect($outside->json('data.grocery.stores'))->pluck('id')->all());
        $this->assertSame([], collect($outside->json('data.grocery.recommended'))->pluck('id')->all());
        $this->assertSame([], $outside->json('data.grocery.categories'));
        $this->assertFalse($outside->json('meta.grocery_serviceability.is_serviceable'));
    }

    public function test_discovery_search_filters_grocery_stores_and_products(): void
    {
        $zoneA = $this->zone(['name' => 'Zone A']);
        $zoneB = $this->zone([
            'name' => 'Zone B',
            'priority' => 5,
            'center_latitude' => 18.5204,
            'center_longitude' => 73.8567,
            'radius_km' => 5,
        ]);

        $homeStore = $this->store('Home Mart', $zoneA);
        $awayStore = $this->store('Away Mart', $zoneB, 18.5204, 73.8567);

        $homeProduct = $this->product($homeStore, 'Mart Flour');
        $awayProduct = $this->product($awayStore, 'Mart Sugar');

        $inZone = $this->getJson(
            '/api/v1/discovery/search?query=Mart&type=grocery&latitude='.self::CUSTOMER_LAT.'&longitude='.self::CUSTOMER_LNG
        )->assertOk();

        $this->assertSame([$homeStore->id], collect($inZone->json('data.stores'))->pluck('id')->all());

        $productIds = collect($inZone->json('data.products'))->pluck('id')->all();
        $this->assertContains($homeProduct->id, $productIds);
        $this->assertNotContains($awayProduct->id, $productIds);
        $this->assertTrue($inZone->json('meta.grocery_serviceability.is_serviceable'));

        $outside = $this->getJson(
            '/api/v1/discovery/search?query=Mart&type=grocery&latitude='.self::FAR_LAT.'&longitude='.self::FAR_LNG
        )->assertOk();

        $this->assertSame([], collect($outside->json('data.stores'))->pluck('id')->all());
        $this->assertSame([], collect($outside->json('data.products'))->pluck('id')->all());
        $this->assertFalse($outside->json('meta.grocery_serviceability.is_serviceable'));
    }

    public function test_featured_content_is_scoped_to_eligible_stores(): void
    {
        $zoneA = $this->zone(['name' => 'Zone A']);
        $zoneB = $this->zone([
            'name' => 'Zone B',
            'priority' => 5,
            'center_latitude' => 18.5204,
            'center_longitude' => 73.8567,
            'radius_km' => 5,
        ]);

        $homeStore = $this->store('Home Mart', $zoneA, self::CUSTOMER_LAT, self::CUSTOMER_LNG, true, true);
        $awayStore = $this->store('Away Mart', $zoneB, 18.5204, 73.8567, true, true);

        $homeProduct = $this->product($homeStore, 'Home Ghee', true);
        $awayProduct = $this->product($awayStore, 'Away Ghee', true);

        $inZone = $this->getJson('/api/v1/discovery/featured?latitude='.self::CUSTOMER_LAT.'&longitude='.self::CUSTOMER_LNG)
            ->assertOk();

        $this->assertSame([$homeStore->id], collect($inZone->json('data.stores'))->pluck('id')->all());
        $this->assertNotContains($awayStore->id, collect($inZone->json('data.stores'))->pluck('id')->all());

        $productIds = collect($inZone->json('data.products'))->pluck('id')->all();
        $this->assertContains($homeProduct->id, $productIds);
        $this->assertNotContains($awayProduct->id, $productIds);
        $this->assertTrue($inZone->json('meta.grocery_serviceability.is_serviceable'));

        $outside = $this->getJson('/api/v1/discovery/featured?latitude='.self::FAR_LAT.'&longitude='.self::FAR_LNG)
            ->assertOk();

        $this->assertSame([], collect($outside->json('data.stores'))->pluck('id')->all());
        $this->assertNotContains($homeProduct->id, collect($outside->json('data.products'))->pluck('id')->all());
        $this->assertFalse($outside->json('meta.grocery_serviceability.is_serviceable'));
    }

    /* ------------------------------------------------------------------
     | Configuration changes
     * ---------------------------------------------------------------- */

    public function test_zone_configuration_changes_change_results_and_the_reported_version(): void
    {
        $role = Role::updateOrCreate(['slug' => 'super_admin'], ['name' => 'Super Admin', 'is_system' => true]);

        $admin = User::create([
            'name' => 'Zone Admin',
            'email' => 'grocery.zones@example.com',
            'phone' => '9777777111',
            'password' => Hash::make('secret'),
            'user_type' => 'super_admin',
            'is_active' => true,
        ]);
        $admin->roles()->sync([$role->id]);

        $headers = ['Authorization' => 'Bearer '.$admin->createToken('test')->plainTextToken];

        $zone = $this->zone();
        $this->zone([
            'name' => 'Far Grocery Zone',
            'priority' => 5,
            'center_latitude' => 27.5000,
            'center_longitude' => 76.5000,
            'radius_km' => 1,
        ]);
        $this->store('Inside Mart', $zone);

        $before = $this->listings();
        $this->assertTrue($before['serviceability']['is_serviceable']);
        $this->assertSame(app(ZoneService::class)->configurationVersion(), $before['serviceability']['zone_version']);

        // An admin turning Grocery off in this zone: results and the version
        // clients cache against both move.
        $this->putJson("/api/v1/admin/zones/{$zone->id}", [
            'name' => $zone->name,
            'code' => $zone->code,
            'type' => 'multi',
            'country' => 'IN',
            'grocery_enabled' => false,
        ], $headers)->assertOk();

        $after = $this->listings();

        $this->assertSame([], $after['ids']);
        $this->assertFalse($after['serviceability']['is_serviceable']);
        $this->assertSame(ZoneService::REASON_SERVICE_DISABLED, $after['serviceability']['reason']);
        $this->assertGreaterThan($before['serviceability']['zone_version'], $after['serviceability']['zone_version']);

        // Re-enabling it restores the very same stores.
        $this->putJson("/api/v1/admin/zones/{$zone->id}", [
            'name' => $zone->name,
            'code' => $zone->code,
            'type' => 'multi',
            'country' => 'IN',
            'grocery_enabled' => true,
        ], $headers)->assertOk();

        $restored = $this->listings();
        $this->assertCount(1, $restored['ids']);
        $this->assertTrue($restored['serviceability']['is_serviceable']);
        $this->assertGreaterThan($after['serviceability']['zone_version'], $restored['serviceability']['zone_version']);
    }

    /* ------------------------------------------------------------------
     | Other services stay untouched
     * ---------------------------------------------------------------- */

    public function test_food_and_ride_flows_are_unaffected_by_the_grocery_rule(): void
    {
        // A zone that serves Food and Rides but has Grocery switched off.
        $zone = $this->zone(['grocery_enabled' => false]);

        // Grocery is offered somewhere else, so the reason is the specific
        // "service not available in this zone" rather than "no zone defined".
        $this->zone([
            'name' => 'Far Grocery Zone',
            'priority' => 5,
            'center_latitude' => 27.5000,
            'center_longitude' => 76.5000,
            'radius_km' => 1,
        ]);

        $vendor = Vendor::create([
            'user_id' => User::factory()->create(['user_type' => 'vendor'])->id,
            'business_name' => 'Inside Kitchen Vendor',
            'owner_name' => 'Test Owner',
            'phone' => '9'.random_int(100000000, 999999999),
            'vendor_type' => 'restaurant',
            'status' => 'approved',
            'is_active' => true,
            'latitude' => self::CUSTOMER_LAT,
            'longitude' => self::CUSTOMER_LNG,
            'zone_id' => $zone->id,
        ]);

        $restaurant = Restaurant::create([
            'vendor_id' => $vendor->id,
            'name' => 'Inside Kitchen',
            'slug' => Str::slug('Inside Kitchen').'-'.Str::lower(Str::random(6)),
            'latitude' => self::CUSTOMER_LAT,
            'longitude' => self::CUSTOMER_LNG,
            'is_open' => true,
        ]);

        $this->store('Inside Mart', $zone);

        $query = 'latitude='.self::CUSTOMER_LAT.'&longitude='.self::CUSTOMER_LNG;

        // Food keeps listing the same outlet for the same coordinates.
        $food = $this->getJson('/api/v1/food/restaurants?'.$query)->assertOk();
        $this->assertSame([$restaurant->id], collect($food->json('data.data'))->pluck('id')->all());
        $this->assertTrue($food->json('meta.serviceability.is_serviceable'));
        $this->assertSame('food', $food->json('meta.serviceability.service'));

        // Grocery reports its own disabled verdict and lists nothing.
        $grocery = $this->getJson('/api/v1/grocery/stores?'.$query)->assertOk();
        $this->assertSame([], collect($grocery->json('data.data'))->pluck('id')->all());
        $this->assertSame(ZoneService::REASON_SERVICE_DISABLED, $grocery->json('meta.serviceability.reason'));
        $this->assertSame('grocery', $grocery->json('meta.serviceability.service'));

        // The public serviceability check still answers per service.
        $this->assertTrue($this->getJson('/api/v1/serviceability?'.$query.'&service=food')->assertOk()->json('data.serviceable'));
        $this->assertTrue($this->getJson('/api/v1/serviceability?'.$query.'&service=ride')->assertOk()->json('data.serviceable'));
        $this->assertFalse($this->getJson('/api/v1/serviceability?'.$query.'&service=grocery')->assertOk()->json('data.serviceable'));

        // Discovery home still serves Food while Grocery is empty.
        $home = $this->getJson('/api/v1/discovery/home?'.$query)->assertOk();
        $this->assertSame([$restaurant->id], collect($home->json('data.food.recommended'))->pluck('id')->all());
        $this->assertSame([], collect($home->json('data.grocery.stores'))->pluck('id')->all());
        $this->assertTrue($home->json('meta.serviceability.is_serviceable'));
        $this->assertFalse($home->json('meta.grocery_serviceability.is_serviceable'));
    }
}
