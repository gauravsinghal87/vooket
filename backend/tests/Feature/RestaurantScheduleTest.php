<?php

namespace Tests\Feature;

use App\Models\Restaurant;
use App\Models\Role;
use App\Models\Store;
use App\Models\User;
use App\Models\Vendor;
use App\Models\Zone;
use App\Services\RestaurantOperatingHoursService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class RestaurantScheduleTest extends TestCase
{
    use RefreshDatabase;

    private Role $vendorRole;

    protected function setUp(): void
    {
        parent::setUp();

        $this->vendorRole = Role::firstOrCreate(['slug' => 'vendor'], ['name' => 'Vendor']);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    private function restaurantPayload(array $overrides = []): array
    {
        return array_merge([
            'vendor_type' => 'restaurant',
            'business_name' => 'Spice Villa',
            'owner_name' => 'Rahul Sharma',
            'email' => 'schedule.vendor@example.com',
            'phone' => '9898989898',
            'password' => 'secret123',
            'address' => 'MG Road, Bengaluru',
            'fssai_number' => '12345678901234',
            'avg_prep_time_min' => 25,
            'opens_at' => '10:00',
            'closes_at' => '23:00',
        ], $overrides);
    }

    private function groceryPayload(array $overrides = []): array
    {
        return array_merge([
            'vendor_type' => 'grocery',
            'business_name' => 'FreshMart',
            'owner_name' => 'Priya Patel',
            'email' => 'grocery.schedule@example.com',
            'phone' => '9797979797',
            'password' => 'secret123',
        ], $overrides);
    }

    /**
     * @return array{0: Vendor, 1: Restaurant}
     */
    private function createRestaurantVendor(array $vendorOverrides = [], array $restaurantOverrides = []): array
    {
        $user = User::factory()->create([
            'user_type' => 'vendor',
            'password' => 'secret123',
        ]);
        $user->roles()->attach($this->vendorRole->id);

        $vendor = Vendor::create(array_merge([
            'user_id' => $user->id,
            'business_name' => 'Test Kitchen',
            'vendor_type' => 'restaurant',
            'owner_name' => 'Owner',
            'email' => $user->email,
            'phone' => '9876543210',
            'status' => 'approved',
        ], $vendorOverrides));

        $restaurant = $vendor->ensureOutlet();
        $restaurant->update(array_merge(['is_open' => true], $restaurantOverrides));

        return [$vendor, $restaurant->fresh()];
    }

    public function test_food_registration_saves_preparation_time_and_operating_hours(): void
    {
        $response = $this->postJson('/api/v1/auth/vendor/register', $this->restaurantPayload());

        $response->assertStatus(201);

        $vendor = Vendor::where('email', 'schedule.vendor@example.com')->first();
        $this->assertNotNull($vendor);

        $restaurant = Restaurant::where('vendor_id', $vendor->id)->first();
        $this->assertNotNull($restaurant);
        $this->assertSame(25.0, (float) $restaurant->avg_prep_time_min);
        $this->assertSame('10:00', RestaurantOperatingHoursService::normalize($restaurant->opens_at));
        $this->assertSame('23:00', RestaurantOperatingHoursService::normalize($restaurant->closes_at));
        $this->assertFalse($restaurant->is_open, 'A restaurant created at registration must stay hidden until opened.');
    }

    public function test_food_registration_rejects_invalid_preparation_time(): void
    {
        foreach ([0, 181, 'abc'] as $invalid) {
            $response = $this->postJson(
                '/api/v1/auth/vendor/register',
                $this->restaurantPayload(['avg_prep_time_min' => $invalid])
            );

            $response->assertStatus(422)->assertJsonValidationErrors(['avg_prep_time_min']);
        }

        $this->assertSame(0, Vendor::count());
        $this->assertSame(0, Restaurant::count());
    }

    public function test_food_registration_rejects_invalid_opening_or_closing_times(): void
    {
        foreach (['9 AM', '25:00', '10:61', ''] as $invalid) {
            $response = $this->postJson(
                '/api/v1/auth/vendor/register',
                $this->restaurantPayload(['opens_at' => $invalid])
            );

            $response->assertStatus(422)->assertJsonValidationErrors(['opens_at']);
        }
    }

    public function test_food_registration_rejects_identical_opening_and_closing_times(): void
    {
        $response = $this->postJson(
            '/api/v1/auth/vendor/register',
            $this->restaurantPayload(['opens_at' => '22:00', 'closes_at' => '22:00'])
        );

        $response->assertStatus(422)->assertJsonValidationErrors(['closes_at']);
    }

    public function test_food_registration_supports_overnight_operating_hours(): void
    {
        $response = $this->postJson(
            '/api/v1/auth/vendor/register',
            $this->restaurantPayload(['opens_at' => '18:00', 'closes_at' => '02:00'])
        );

        $response->assertStatus(201);

        $restaurant = Restaurant::first();
        $this->assertSame('18:00', RestaurantOperatingHoursService::normalize($restaurant->opens_at));
        $this->assertSame('02:00', RestaurantOperatingHoursService::normalize($restaurant->closes_at));

        $service = app(RestaurantOperatingHoursService::class);
        $at = fn (string $time) => Carbon::parse($time, 'Asia/Kolkata');

        $this->assertTrue($service->isOpenNow('18:00', '02:00', $at('2026-10-19 23:30:00')), 'Open before midnight');
        $this->assertTrue($service->isOpenNow('18:00', '02:00', $at('2026-10-20 01:00:00')), 'Open after midnight');
        $this->assertTrue($service->isOpenNow('18:00', '02:00', $at('2026-10-19 18:00:00')), 'Opening boundary is inclusive');
        $this->assertFalse($service->isOpenNow('18:00', '02:00', $at('2026-10-20 02:00:00')), 'Closing boundary is exclusive');
        $this->assertFalse($service->isOpenNow('18:00', '02:00', $at('2026-10-19 12:00:00')), 'Closed midday');
    }

    public function test_normal_operating_hours_boundaries(): void
    {
        $service = app(RestaurantOperatingHoursService::class);
        $at = fn (string $time) => Carbon::parse($time, 'Asia/Kolkata');

        $this->assertTrue($service->isOpenNow('09:00', '22:00', $at('2026-10-19 09:00:00')));
        $this->assertTrue($service->isOpenNow('09:00', '22:00', $at('2026-10-19 21:59:00')));
        $this->assertFalse($service->isOpenNow('09:00', '22:00', $at('2026-10-19 22:00:00')));
        $this->assertFalse($service->isOpenNow('09:00', '22:00', $at('2026-10-19 08:59:00')));
        $this->assertFalse($service->isOpenNow('09:00', '22:00', $at('2026-10-20 03:00:00')));
    }

    public function test_grocery_registration_is_not_forced_to_provide_restaurant_fields(): void
    {
        $response = $this->postJson('/api/v1/auth/vendor/register', $this->groceryPayload());

        $response->assertStatus(201);

        $vendor = Vendor::where('email', 'grocery.schedule@example.com')->first();
        $this->assertSame('grocery', $vendor->vendor_type);
        $this->assertSame(0, Restaurant::where('vendor_id', $vendor->id)->count());
        $this->assertSame(0, Restaurant::count());

        // Restaurant-only fields are rejected outright for grocery vendors.
        $this->postJson(
            '/api/v1/auth/vendor/register',
            $this->groceryPayload([
                'email' => 'grocery.with.schedule@example.com',
                'phone' => '9797979798',
                'avg_prep_time_min' => 20,
                'opens_at' => '09:00',
                'closes_at' => '22:00',
            ])
        )->assertStatus(422);
    }

    public function test_backfill_migration_defaults_only_missing_values(): void
    {
        [$vendor, $legacy] = $this->createRestaurantVendor(['email' => 'legacy@example.com']);

        // Simulate a pre-existing restaurant row without saved hours.
        // (avg_prep_time_min is NOT NULL DEFAULT 20 in the schema, so legacy
        // rows always carry the safe default there.)
        DB::table('restaurants')->where('id', $legacy->id)->update([
            'opens_at' => null,
            'closes_at' => null,
        ]);

        [, $configured] = $this->createRestaurantVendor(
            ['email' => 'configured@example.com', 'business_name' => 'Configured Kitchen'],
            ['avg_prep_time_min' => 45, 'opens_at' => '08:00:00', 'closes_at' => '20:00:00']
        );

        $store = Store::create([
            'vendor_id' => $vendor->id,
            'name' => 'Legacy Grocer',
            'slug' => 'legacy-grocer-'.uniqid(),
            'opens_at' => null,
            'closes_at' => null,
        ]);

        $migration = include database_path('migrations/2026_10_19_053620_backfill_restaurant_prep_time_and_opening_hours.php');
        $migration->up();

        $legacy->refresh();
        $this->assertSame(20.0, (float) $legacy->avg_prep_time_min);
        $this->assertSame('09:00', RestaurantOperatingHoursService::normalize($legacy->opens_at));
        $this->assertSame('22:00', RestaurantOperatingHoursService::normalize($legacy->closes_at));
        $configured->refresh();
        $this->assertSame(45.0, (float) $configured->avg_prep_time_min, 'Existing values must not be overwritten');
        $this->assertSame('08:00', RestaurantOperatingHoursService::normalize($configured->opens_at));
        $this->assertSame('20:00', RestaurantOperatingHoursService::normalize($configured->closes_at));

        $this->assertNull($store->fresh()->opens_at, 'Grocery stores must not be touched by the backfill');
        $this->assertNull($store->fresh()->closes_at);
    }

    public function test_food_restaurant_apis_expose_schedule_fields(): void
    {
        $zone = Zone::create([
            'name' => 'Schedule Test Zone',
            'code' => 'SCHED-TEST',
            'type' => 'multi',
            'country' => 'IN',
            'food_enabled' => true,
            'grocery_enabled' => true,
            'ride_enabled' => true,
            'priority' => 10,
            'center_latitude' => 26.9124,
            'center_longitude' => 75.7873,
            'radius_km' => 20,
            'is_active' => true,
        ]);

        [$vendor, $restaurant] = $this->createRestaurantVendor([
            'email' => 'apis@example.com',
            'zone_id' => $zone->id,
            'latitude' => 26.9124,
            'longitude' => 75.7873,
        ], [
            'avg_prep_time_min' => 30,
            'opens_at' => '11:00:00',
            'closes_at' => '23:30:00',
            'latitude' => 26.9124,
            'longitude' => 75.7873,
        ]);

        $list = $this->getJson('/api/v1/food/restaurants?latitude=26.9124&longitude=75.7873');
        $list->assertStatus(200);
        $listed = collect($list->json('data.data'))->firstWhere('id', $restaurant->id);
        $this->assertNotNull($listed, 'An open restaurant must appear in the customer listing');
        $this->assertSame(30.0, (float) $listed['avg_prep_time_min']);
        $this->assertSame('11:00', RestaurantOperatingHoursService::normalize($listed['opens_at']));
        $this->assertSame('23:30', RestaurantOperatingHoursService::normalize($listed['closes_at']));
        $this->assertArrayHasKey('is_open_now', $listed);

        $detail = $this->getJson("/api/v1/food/restaurants/{$restaurant->id}");
        $detail->assertStatus(200);
        $this->assertSame(30.0, (float) $detail->json('data.avg_prep_time_min'));
        $this->assertSame('11:00', RestaurantOperatingHoursService::normalize($detail->json('data.opens_at')));
        $this->assertSame('23:30', RestaurantOperatingHoursService::normalize($detail->json('data.closes_at')));
        $this->assertIsBool($detail->json('data.is_open_now'));

        $this->assertNotNull($vendor);
    }

    public function test_food_vendor_can_update_its_own_schedule(): void
    {
        [$vendor, $restaurant] = $this->createRestaurantVendor(['email' => 'owner.update@example.com'], [
            'avg_prep_time_min' => 20,
            'opens_at' => '09:00:00',
            'closes_at' => '22:00:00',
        ]);

        Sanctum::actingAs($vendor->user, ['*']);

        $this->putJson('/api/v1/vendor/profile', [
            'avg_prep_time_min' => 35,
            'opens_at' => '08:30',
            'closes_at' => '21:45',
        ])->assertStatus(200);

        $restaurant->refresh();
        $this->assertSame(35.0, (float) $restaurant->avg_prep_time_min);
        $this->assertSame('08:30', RestaurantOperatingHoursService::normalize($restaurant->opens_at));
        $this->assertSame('21:45', RestaurantOperatingHoursService::normalize($restaurant->closes_at));

        // Reloading from the database (fresh request) returns the saved values.
        $me = $this->getJson('/api/v1/vendor/me');
        $me->assertStatus(200);

        $outlets = $this->getJson('/api/v1/vendor/outlets');
        $outlets->assertStatus(200);
        $outlet = collect($outlets->json('data'))->firstWhere('id', $restaurant->id);
        $this->assertSame(35.0, (float) $outlet['avg_prep_time_min']);
        $this->assertSame('08:30', RestaurantOperatingHoursService::normalize($outlet['opens_at']));
        $this->assertSame('21:45', RestaurantOperatingHoursService::normalize($outlet['closes_at']));

        // Invalid updates are rejected by the same backend rules.
        $this->putJson('/api/v1/vendor/profile', ['avg_prep_time_min' => 500])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['avg_prep_time_min']);
        $this->putJson('/api/v1/vendor/profile', ['closes_at' => '25:00'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['closes_at']);
        $this->putJson('/api/v1/vendor/profile', ['opens_at' => '21:45', 'closes_at' => '21:45'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['closes_at']);

        // A single-sided update cannot collide with the stored counterpart.
        $this->putJson('/api/v1/vendor/profile', ['opens_at' => '21:45'])
            ->assertStatus(422);
    }

    public function test_vendor_cannot_change_another_vendors_schedule(): void
    {
        [, $target] = $this->createRestaurantVendor(['email' => 'target@example.com'], [
            'avg_prep_time_min' => 30,
            'opens_at' => '10:00:00',
            'closes_at' => '22:00:00',
        ]);

        [$intruder] = $this->createRestaurantVendor(['email' => 'intruder@example.com'], [
            'opens_at' => '09:00:00',
            'closes_at' => '21:00:00',
        ]);

        Sanctum::actingAs($intruder->user, ['*']);

        // The profile endpoint only ever writes to the authenticated user's
        // own vendor — there is no vendor id parameter to tamper with.
        $this->putJson('/api/v1/vendor/profile', [
            'avg_prep_time_min' => 99,
            'opens_at' => '06:00',
            'closes_at' => '23:00',
        ])->assertStatus(200);

        $target->refresh();
        $targetRestaurant = Restaurant::where('vendor_id', $target->id)->first();
        $this->assertSame(30.0, (float) $targetRestaurant->avg_prep_time_min);
        $this->assertSame('10:00', RestaurantOperatingHoursService::normalize($targetRestaurant->opens_at));
        $this->assertSame('22:00', RestaurantOperatingHoursService::normalize($targetRestaurant->closes_at));
    }

    public function test_legacy_restaurant_without_schedule_still_renders(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-10-19 12:00:00', 'Asia/Kolkata'));

        [, $restaurant] = $this->createRestaurantVendor(['email' => 'legacy.render@example.com']);

        DB::table('restaurants')->where('id', $restaurant->id)->update([
            'opens_at' => null,
            'closes_at' => null,
        ]);

        $detail = $this->getJson("/api/v1/food/restaurants/{$restaurant->id}");

        $detail->assertStatus(200);
        $this->assertNull($detail->json('data.opens_at'));
        $this->assertNull($detail->json('data.closes_at'));
        $this->assertSame(20.0, (float) $detail->json('data.avg_prep_time_min'));
        $this->assertTrue(
            $detail->json('data.is_open_now'),
            'Legacy rows fall back to the 09:00-22:00 default schedule (12:00 is inside it)'
        );
    }

    public function test_grocery_store_and_vendor_outlet_listing_remain_unaffected(): void
    {
        $user = User::factory()->create(['user_type' => 'vendor', 'password' => 'secret123']);
        $user->roles()->attach($this->vendorRole->id);

        // Grocery listings are zone-gated, so the outlet sits inside an active
        // Grocery-enabled zone and is requested from that location.
        $zone = Zone::create([
            'name' => 'Grocery Schedule Zone',
            'code' => 'GRO-SCHED',
            'type' => 'multi',
            'country' => 'IN',
            'food_enabled' => true,
            'grocery_enabled' => true,
            'ride_enabled' => true,
            'priority' => 10,
            'center_latitude' => 26.9124,
            'center_longitude' => 75.7873,
            'radius_km' => 20,
            'is_active' => true,
        ]);

        $vendor = Vendor::create([
            'user_id' => $user->id,
            'business_name' => 'FreshMart',
            'vendor_type' => 'grocery',
            'owner_name' => 'Owner',
            'email' => $user->email,
            'phone' => '9876543211',
            'status' => 'approved',
            'zone_id' => $zone->id,
            'latitude' => 26.9124,
            'longitude' => 75.7873,
        ]);

        $store = $vendor->ensureOutlet();
        $store->update(['is_open' => true]);

        $stores = $this->getJson('/api/v1/grocery/stores?latitude=26.9124&longitude=75.7873');
        $stores->assertStatus(200);
        $this->assertNotNull(collect($stores->json('data.data'))->firstWhere('id', $store->id));

        Sanctum::actingAs($user, ['*']);
        $outlets = $this->getJson('/api/v1/vendor/outlets');
        $outlets->assertStatus(200);
        $this->assertSame('store', $outlets->json('data.0.type'));
        $this->assertArrayNotHasKey('avg_prep_time_min', $outlets->json('data.0'));
    }
}
