<?php

namespace Tests\Feature;

use App\Models\DeliverySlot;
use App\Models\Role;
use App\Models\Store;
use App\Models\User;
use App\Models\Vendor;
use App\Models\Zone;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class GroceryDeliverySlotBulkTest extends TestCase
{
    use RefreshDatabase;

    private Role $vendorRole;

    private Vendor $groceryVendor;

    private Store $store;

    protected function setUp(): void
    {
        parent::setUp();

        Carbon::setTestNow(Carbon::parse('2026-09-28 04:00:00', 'UTC'));

        $this->vendorRole = Role::firstOrCreate(['slug' => 'vendor'], ['name' => 'Vendor']);
        $this->groceryVendor = $this->makeVendor('grocery', 'FreshMart');
        $this->store = $this->makeStore($this->groceryVendor, 'FreshMart Supermarket');
    }

    private function makeVendor(string $type, string $name): Vendor
    {
        $user = User::factory()->create(['user_type' => 'vendor', 'is_active' => true]);
        $user->roles()->attach($this->vendorRole->id);

        return Vendor::create([
            'user_id' => $user->id,
            'business_name' => $name,
            'owner_name' => $name.' Owner',
            'email' => str($name)->slug().'@example.com',
            'phone' => '98989'.random_int(10000, 99999),
            'vendor_type' => $type,
            'status' => 'approved',
            'is_active' => true,
        ]);
    }

    private function makeStore(Vendor $vendor, string $name): Store
    {
        return Store::create([
            'vendor_id' => $vendor->id,
            'name' => $name,
            'slug' => str($name)->slug().'-'.uniqid(),
            'store_type' => 'convenience',
            'latitude' => 26.9124,
            'longitude' => 75.7873,
            'order_type' => 'both',
            'is_open' => true,
            'is_active' => true,
            'supports_instant_delivery' => true,
            'supports_scheduled_delivery' => true,
        ]);
    }

    private function bulkPayload(array $overrides = []): array
    {
        return array_merge([
            'store_id' => $this->store->id,
            'from_date' => '2026-10-01',
            'to_date' => '2026-10-01',
            'shifts' => ['morning'],
            'max_orders' => 20,
            'lead_time_min' => 30,
        ], $overrides);
    }

    public function test_one_date_morning(): void
    {
        Sanctum::actingAs($this->groceryVendor->user, ['*']);

        $res = $this->postJson('/api/v1/vendor/delivery-slots/bulk', $this->bulkPayload());
        $res->assertStatus(201)
            ->assertJsonPath('data.created_count', 1)
            ->assertJsonPath('data.skipped_count', 0);

        $slot = DeliverySlot::first();
        $this->assertSame('08:00:00', $slot->start_time instanceof \DateTimeInterface ? $slot->start_time->format('H:i:s') : (string) $slot->start_time);
        $this->assertSame('12:00:00', $slot->end_time instanceof \DateTimeInterface ? $slot->end_time->format('H:i:s') : (string) $slot->end_time);
        $this->assertSame('morning', $slot->shift);
        $this->assertSame(20, $slot->max_orders);
        $this->assertSame(30, $slot->lead_time_min);
    }

    public function test_one_date_evening(): void
    {
        Sanctum::actingAs($this->groceryVendor->user, ['*']);

        $res = $this->postJson('/api/v1/vendor/delivery-slots/bulk', $this->bulkPayload(['shifts' => ['evening']]));
        $res->assertStatus(201)->assertJsonPath('data.created_count', 1);

        $slot = DeliverySlot::first();
        $this->assertSame('17:00:00', $slot->start_time instanceof \DateTimeInterface ? $slot->start_time->format('H:i:s') : (string) $slot->start_time);
        $this->assertSame('21:00:00', $slot->end_time instanceof \DateTimeInterface ? $slot->end_time->format('H:i:s') : (string) $slot->end_time);
    }

    public function test_one_date_both(): void
    {
        Sanctum::actingAs($this->groceryVendor->user, ['*']);

        $res = $this->postJson('/api/v1/vendor/delivery-slots/bulk', $this->bulkPayload(['shifts' => ['morning', 'evening']]));
        $res->assertStatus(201)->assertJsonPath('data.created_count', 2);
    }

    public function test_multiple_dates_both(): void
    {
        Sanctum::actingAs($this->groceryVendor->user, ['*']);

        $res = $this->postJson('/api/v1/vendor/delivery-slots/bulk', $this->bulkPayload([
            'from_date' => '2026-10-01',
            'to_date' => '2026-10-03',
            'shifts' => ['morning', 'evening'],
        ]));
        $res->assertStatus(201)->assertJsonPath('data.created_count', 6);
    }

    public function test_from_after_to(): void
    {
        Sanctum::actingAs($this->groceryVendor->user, ['*']);

        $res = $this->postJson('/api/v1/vendor/delivery-slots/bulk', $this->bulkPayload([
            'from_date' => '2026-10-05',
            'to_date' => '2026-10-01',
        ]));
        $res->assertStatus(422);
    }

    public function test_past_dates(): void
    {
        Sanctum::actingAs($this->groceryVendor->user, ['*']);

        $res = $this->postJson('/api/v1/vendor/delivery-slots/bulk', $this->bulkPayload([
            'from_date' => '2026-09-20',
            'to_date' => '2026-09-21',
        ]));
        $res->assertStatus(422);
    }

    public function test_invalid_shift(): void
    {
        Sanctum::actingAs($this->groceryVendor->user, ['*']);

        $res = $this->postJson('/api/v1/vendor/delivery-slots/bulk', $this->bulkPayload(['shifts' => ['midnight']]));
        $res->assertStatus(422);
    }

    public function test_duplicate_prevention(): void
    {
        Sanctum::actingAs($this->groceryVendor->user, ['*']);

        $this->postJson('/api/v1/vendor/delivery-slots/bulk', $this->bulkPayload())->assertStatus(201);

        $res = $this->postJson('/api/v1/vendor/delivery-slots/bulk', $this->bulkPayload());
        $res->assertStatus(201)
            ->assertJsonPath('data.created_count', 0)
            ->assertJsonPath('data.skipped_count', 1);
    }

    public function test_partial_duplicate(): void
    {
        Sanctum::actingAs($this->groceryVendor->user, ['*']);

        $this->postJson('/api/v1/vendor/delivery-slots/bulk', $this->bulkPayload(['shifts' => ['morning']]))->assertStatus(201);

        $res = $this->postJson('/api/v1/vendor/delivery-slots/bulk', $this->bulkPayload(['shifts' => ['morning', 'evening']]));
        $res->assertStatus(201)
            ->assertJsonPath('data.created_count', 1)
            ->assertJsonPath('data.skipped_count', 1);
    }

    public function test_vendor_cannot_create_for_other_store(): void
    {
        $otherVendor = $this->makeVendor('grocery', 'Other Mart');
        $otherStore = $this->makeStore($otherVendor, 'Other Store');

        Sanctum::actingAs($this->groceryVendor->user, ['*']);

        $res = $this->postJson('/api/v1/vendor/delivery-slots/bulk', $this->bulkPayload(['store_id' => $otherStore->id]));
        $res->assertStatus(404);
    }

    public function test_capacity_validation(): void
    {
        Sanctum::actingAs($this->groceryVendor->user, ['*']);

        $res = $this->postJson('/api/v1/vendor/delivery-slots/bulk', $this->bulkPayload(['max_orders' => 0]));
        $res->assertStatus(422);
    }

    public function test_cutoff_validation(): void
    {
        Sanctum::actingAs($this->groceryVendor->user, ['*']);

        $res = $this->postJson('/api/v1/vendor/delivery-slots/bulk', $this->bulkPayload(['lead_time_min' => -5]));
        $res->assertStatus(422);
    }

    public function test_shifts_endpoint(): void
    {
        Sanctum::actingAs($this->groceryVendor->user, ['*']);

        $res = $this->getJson('/api/v1/vendor/delivery-slots/shifts');
        $res->assertStatus(200)
            ->assertJsonPath('data.morning.start', '08:00:00')
            ->assertJsonPath('data.morning.end', '12:00:00')
            ->assertJsonPath('data.evening.start', '17:00:00')
            ->assertJsonPath('data.evening.end', '21:00:00');
    }

    public function test_customer_checkout_retrieves_generated_slots(): void
    {
        Sanctum::actingAs($this->groceryVendor->user, ['*']);
        $this->postJson('/api/v1/vendor/delivery-slots/bulk', $this->bulkPayload(['shifts' => ['morning', 'evening']]))->assertStatus(201);

        $customerLat = 26.9124;
        $customerLng = 75.7873;

        // zone needed for serviceability
        Zone::create([
            'name' => 'Scheduled Delivery Zone',
            'code' => 'GRO-SLOTS',
            'type' => 'multi',
            'country' => 'IN',
            'food_enabled' => true,
            'grocery_enabled' => true,
            'ride_enabled' => true,
            'priority' => 10,
            'center_latitude' => $customerLat,
            'center_longitude' => $customerLng,
            'radius_km' => 20,
            'is_active' => true,
        ]);
        $this->groceryVendor->update(['zone_id' => Zone::first()->id]);

        $res = $this->getJson("/api/v1/grocery/stores/{$this->store->id}/delivery-slots?latitude={$customerLat}&longitude={$customerLng}");
        $res->assertStatus(200);
        $this->assertCount(2, $res->json('data'));
    }
}
