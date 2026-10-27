<?php

namespace Tests\Feature;

use App\Exceptions\DeliverySlotException;
use App\Models\Address;
use App\Models\AppSetting;
use App\Models\Cart;
use App\Models\CartItem;
use App\Models\DeliverySlot;
use App\Models\Order;
use App\Models\Product;
use App\Models\Role;
use App\Models\Store;
use App\Models\User;
use App\Models\Vendor;
use App\Models\Zone;
use App\Models\ZoneDeliveryConfig;
use App\Services\DeliveryService;
use App\Services\DeliverySlotService;
use App\Services\Dispatch\OrderDispatchService;
use App\Services\OrderService;
use App\Services\OrderStateMachine;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Grocery scheduled delivery: vendor slot management, customer availability,
 * capacity-safe booking, activation and cancellation release.
 */
class GroceryScheduledDeliveryTest extends TestCase
{
    use RefreshDatabase;

    private Role $vendorRole;

    private Vendor $groceryVendor;

    private Store $store;

    private Zone $zone;

    /** Customer location the store fixtures are requested for. */
    private const CUSTOMER_LAT = 26.9124;

    private const CUSTOMER_LNG = 75.7873;

    /** Delivery-slot availability URL for the customer's delivery location. */
    private function slotsUrl(Store $store): string
    {
        return "/api/v1/grocery/stores/{$store->id}/delivery-slots?".http_build_query([
            'latitude' => self::CUSTOMER_LAT,
            'longitude' => self::CUSTOMER_LNG,
        ]);
    }

    protected function setUp(): void
    {
        parent::setUp();

        Carbon::setTestNow(Carbon::parse('2026-09-28 04:00:00', 'UTC'));

        // Customer-facing grocery endpoints resolve the delivery zone first, so
        // the fixtures live inside an active Grocery-enabled zone. The zone
        // rules themselves are covered by GroceryServiceabilityTest.
        $this->zone = Zone::create([
            'name' => 'Scheduled Delivery Zone',
            'code' => 'GRO-SLOTS',
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
        ]);

        $this->vendorRole = Role::firstOrCreate(['slug' => 'vendor'], ['name' => 'Vendor']);
        $this->groceryVendor = $this->makeVendor('grocery', 'FreshMart');
        $this->store = $this->makeStore($this->groceryVendor, 'FreshMart Supermarket');

        $this->configureZoneDelivery();
    }

    // -----------------------------------------------------------------
    // Vendor slot management
    // -----------------------------------------------------------------

    public function test_grocery_vendor_can_create_update_and_delete_its_own_slot(): void
    {
        $vendorUser = $this->groceryVendor->user;

        Sanctum::actingAs($vendorUser, ['*']);

        $created = $this->postJson('/api/v1/vendor/delivery-slots', [
            'store_id' => $this->store->id,
            'slot_date' => '2026-10-01',
            'start_time' => '09:00',
            'end_time' => '12:00',
            'max_orders' => 8,
            'lead_time_min' => 60,
        ]);

        $created->assertStatus(201);
        $slotId = $created->json('data.id');
        $this->assertSame('2026-10-01', $created->json('data.slot_date'));
        $this->assertSame(8, $created->json('data.availability'));
        $this->assertSame('9:00 AM – 12:00 PM', $created->json('data.label'));
        $this->assertTrue($created->json('data.is_bookable'));

        $this->putJson("/api/v1/vendor/delivery-slots/{$slotId}", ['max_orders' => 12])
            ->assertStatus(200)
            ->assertJsonPath('data.max_orders', 12)
            ->assertJsonPath('data.availability', 12);

        $this->deleteJson("/api/v1/vendor/delivery-slots/{$slotId}")->assertStatus(200);

        $this->assertDatabaseMissing('delivery_slots', ['id' => $slotId]);
    }

    public function test_food_vendor_cannot_manage_delivery_slots(): void
    {
        $restaurantVendor = $this->makeVendor('restaurant', 'Spice Villa');

        Sanctum::actingAs($restaurantVendor->user, ['*']);

        $this->getJson('/api/v1/vendor/delivery-slots')->assertStatus(403);
        $this->postJson('/api/v1/vendor/delivery-slots', [
            'store_id' => $this->store->id,
            'slot_date' => '2026-10-01',
            'start_time' => '09:00',
            'end_time' => '12:00',
        ])->assertStatus(403);
    }

    public function test_vendor_cannot_manage_another_vendors_slot_or_store(): void
    {
        $otherVendor = $this->makeVendor('grocery', 'Other Mart');
        $otherStore = $this->makeStore($otherVendor, 'Other Mart Store');
        $otherSlot = $this->publishSlot($otherVendor, $otherStore, '2026-10-01', '09:00');

        Sanctum::actingAs($this->groceryVendor->user, ['*']);

        $this->putJson("/api/v1/vendor/delivery-slots/{$otherSlot->id}", ['max_orders' => 3])
            ->assertStatus(404);
        $this->deleteJson("/api/v1/vendor/delivery-slots/{$otherSlot->id}")->assertStatus(404);

        $this->postJson('/api/v1/vendor/delivery-slots', [
            'store_id' => $otherStore->id,
            'slot_date' => '2026-10-01',
            'start_time' => '18:00',
            'end_time' => '20:00',
        ])->assertStatus(404);
    }

    public function test_slot_capacity_cannot_drop_below_booked_orders(): void
    {
        $slot = $this->publishSlot($this->groceryVendor, $this->store, '2026-10-01', '09:00', maxOrders: 5);
        $this->placeScheduledOrder($slot);
        $this->placeScheduledOrder($slot);

        Sanctum::actingAs($this->groceryVendor->user, ['*']);

        $this->putJson("/api/v1/vendor/delivery-slots/{$slot->id}", ['max_orders' => 0])
            ->assertStatus(422)
            ->assertJsonValidationErrors('max_orders');

        $this->putJson("/api/v1/vendor/delivery-slots/{$slot->id}", ['max_orders' => 1])
            ->assertStatus(422);

        $this->assertSame(5, $slot->fresh()->max_orders);

        $this->putJson("/api/v1/vendor/delivery-slots/{$slot->id}", ['max_orders' => 2])
            ->assertStatus(200);

        $this->assertSame(2, $slot->fresh()->max_orders);
    }

    public function test_slot_with_booked_orders_cannot_be_disabled_or_deleted(): void
    {
        $slot = $this->publishSlot($this->groceryVendor, $this->store, '2026-10-01', '09:00');
        $this->placeScheduledOrder($slot);

        Sanctum::actingAs($this->groceryVendor->user, ['*']);

        $this->putJson("/api/v1/vendor/delivery-slots/{$slot->id}", ['is_active' => false])
            ->assertStatus(422);
        $this->deleteJson("/api/v1/vendor/delivery-slots/{$slot->id}")->assertStatus(422);

        $this->assertTrue($slot->fresh()->is_active);
        $this->assertDatabaseHas('delivery_slots', ['id' => $slot->id]);
    }

    public function test_slot_cannot_be_published_beyond_the_horizon_or_as_a_duplicate(): void
    {
        Sanctum::actingAs($this->groceryVendor->user, ['*']);

        $this->postJson('/api/v1/vendor/delivery-slots', [
            'store_id' => $this->store->id,
            'slot_date' => now()->addDays(120)->format('Y-m-d'),
            'start_time' => '09:00',
            'end_time' => '12:00',
        ])->assertStatus(422);

        $this->publishSlot($this->groceryVendor, $this->store, '2026-10-01', '09:00');

        $this->postJson('/api/v1/vendor/delivery-slots', [
            'store_id' => $this->store->id,
            'slot_date' => '2026-10-01',
            'start_time' => '09:00',
            'end_time' => '13:00',
        ])->assertStatus(422);
    }

    // -----------------------------------------------------------------
    // Customer availability
    // -----------------------------------------------------------------

    public function test_availability_returns_only_bookable_slots_for_the_store(): void
    {
        $this->zoneVendor();
        $otherStore = $this->makeStore($this->makeVendor('grocery', 'Other Mart'), 'Other Mart Store');

        $bookable = $this->publishSlot($this->groceryVendor, $this->store, '2026-10-01', '09:00', leadTimeMin: 0);
        $disabled = $this->publishSlot($this->groceryVendor, $this->store, '2026-10-01', '14:00', leadTimeMin: 0);
        $disabled->update(['is_active' => false]);
        $full = $this->publishSlot($this->groceryVendor, $this->store, '2026-10-01', '18:00', maxOrders: 1, leadTimeMin: 0);
        $full->update(['booked_orders' => 1]);
        $tooSoon = $this->publishSlot($this->groceryVendor, $this->store, Carbon::now('Asia/Kolkata')->addHours(2)->format('Y-m-d'), Carbon::now('Asia/Kolkata')->addHours(2)->format('H:i'), leadTimeMin: 180);
        $outOfWindow = $this->publishSlot($this->groceryVendor, $this->store, now()->addDays(20)->format('Y-m-d'), '09:00', leadTimeMin: 0);
        $otherStoresSlot = $this->publishSlot($this->groceryVendor, $otherStore, '2026-10-01', '09:00', leadTimeMin: 0);

        $response = $this->getJson($this->slotsUrl($this->store));

        $response->assertStatus(200);
        $this->assertSame([$bookable->id], collect($response->json('data'))->pluck('id')->all());

        foreach ([$disabled, $full, $tooSoon, $outOfWindow, $otherStoresSlot] as $hidden) {
            $this->assertNotSame($hidden->id, collect($response->json('data'))->pluck('id')->first());
        }
    }

    public function test_store_without_scheduled_delivery_support_exposes_no_slots(): void
    {
        $this->zoneVendor();
        $slot = $this->publishSlot($this->groceryVendor, $this->store, '2026-10-01', '09:00', leadTimeMin: 0);
        $this->store->update(['supports_scheduled_delivery' => false]);

        $this->getJson($this->slotsUrl($this->store))
            ->assertStatus(200)
            ->assertJsonCount(0, 'data');

        $this->assertNotEmpty($slot->fresh()->id);
    }

    // -----------------------------------------------------------------
    // Order creation
    // -----------------------------------------------------------------

    public function test_grocery_order_with_a_slot_is_created_as_scheduled_with_a_snapshot(): void
    {
        $slot = $this->publishSlot($this->groceryVendor, $this->store, '2026-10-01', '09:00', maxOrders: 4);
        $customer = $this->makeCustomer('9111111001');
        $this->makeGroceryCart($customer);

        $order = $this->checkout($customer, ['delivery_slot_id' => $slot->id]);

        $this->assertSame('SCHEDULED', $order->status);
        $this->assertSame('scheduled', $order->timing_type);
        $this->assertSame($slot->id, $order->delivery_slot_id);
        $this->assertSame('2026-10-01', $order->meta['delivery_schedule']['slot_date']);
        $this->assertSame('scheduled', $order->meta['delivery_schedule']['delivery_mode']);
        $this->assertSame('Asia/Kolkata', $order->meta['delivery_schedule']['timezone']);
        $this->assertSame(
            Carbon::parse('2026-10-01 09:00', 'Asia/Kolkata')->utc()->toDateTimeString(),
            $order->scheduled_at->utc()->toDateTimeString()
        );
        $this->assertSame(1, $slot->fresh()->booked_orders);
        $this->assertDatabaseHas('order_status_histories', [
            'order_id' => $order->id,
            'status' => 'SCHEDULED',
        ]);
    }

    public function test_grocery_order_without_a_slot_stays_asap(): void
    {
        $slot = $this->publishSlot($this->groceryVendor, $this->store, '2026-10-01', '09:00');
        $customer = $this->makeCustomer('9111111002');
        $this->makeGroceryCart($customer);

        $order = $this->checkout($customer);

        $this->assertSame('PENDING', $order->status);
        $this->assertSame('instant', $order->timing_type);
        $this->assertNull($order->scheduled_at);
        $this->assertNull($order->delivery_slot_id);
        $this->assertSame('asap', $order->meta['delivery_schedule']['delivery_mode']);
        $this->assertSame(0, $slot->fresh()->booked_orders);
    }

    public function test_scheduling_does_not_change_order_pricing(): void
    {
        $slot = $this->publishSlot($this->groceryVendor, $this->store, '2026-10-01', '09:00');

        $asapCustomer = $this->makeCustomer('9111111003');
        $this->makeGroceryCart($asapCustomer);
        $asap = $this->checkout($asapCustomer);

        $scheduledCustomer = $this->makeCustomer('9111111004');
        $this->makeGroceryCart($scheduledCustomer);
        $scheduled = $this->checkout($scheduledCustomer, ['delivery_slot_id' => $slot->id]);

        $this->assertSame((float) $asap->delivery_fee, (float) $scheduled->delivery_fee);
        $this->assertSame((float) $asap->total_amount, (float) $scheduled->total_amount);
        $this->assertSame((float) $asap->subtotal, (float) $scheduled->subtotal);
        $this->assertSame((float) $asap->delivery_gst_amount, (float) $scheduled->delivery_gst_amount);
    }

    public function test_unbookable_slots_are_rejected(): void
    {
        $customer = $this->makeCustomer('9111111005');

        $full = $this->publishSlot($this->groceryVendor, $this->store, '2026-10-01', '09:00', maxOrders: 1);
        $full->update(['booked_orders' => 1]);
        $disabled = $this->publishSlot($this->groceryVendor, $this->store, '2026-10-01', '12:00');
        $disabled->update(['is_active' => false]);
        $closed = $this->publishSlot($this->groceryVendor, $this->store, Carbon::now('Asia/Kolkata')->addHours(2)->format('Y-m-d'), Carbon::now('Asia/Kolkata')->addHours(2)->format('H:i'), leadTimeMin: 300);
        $foreign = $this->publishSlot($this->groceryVendor, $this->makeStore($this->groceryVendor, 'Second Outlet'), '2026-10-01', '20:00');
        $past = $this->publishSlot($this->groceryVendor, $this->store, '2026-09-20', '09:00');

        foreach ([$full, $disabled, $closed, $foreign, $past] as $slot) {
            $this->makeGroceryCart($customer);

            try {
                $this->checkout($customer, ['delivery_slot_id' => $slot->id]);
                $this->fail("Slot {$slot->id} should not be bookable.");
            } catch (DeliverySlotException $e) {
                $this->assertNotSame('', $e->getMessage());
            }
        }

        $this->assertSame(0, Order::count());
        $this->assertSame(1, $full->fresh()->booked_orders);
    }

    public function test_slot_from_another_vendors_store_cannot_be_booked(): void
    {
        $otherVendor = $this->makeVendor('grocery', 'Rival Mart');
        $otherSlot = $this->publishSlot($otherVendor, $this->makeStore($otherVendor, 'Rival Store'), '2026-10-01', '09:00');

        $customer = $this->makeCustomer('9111111006');
        $this->makeGroceryCart($customer);

        $this->expectException(DeliverySlotException::class);
        $this->checkout($customer, ['delivery_slot_id' => $otherSlot->id]);
    }

    public function test_food_orders_cannot_use_a_delivery_slot(): void
    {
        $slot = $this->publishSlot($this->groceryVendor, $this->store, '2026-10-01', '09:00');
        $customer = $this->makeCustomer('9111111007');

        Sanctum::actingAs($customer, ['*']);

        $this->postJson('/api/v1/orders', [
            'order_type' => 'food',
            'payment_method' => 'cash_on_delivery',
            'delivery_slot_id' => $slot->id,
        ])->assertStatus(422)->assertJsonValidationErrors('delivery_slot_id');

        $this->assertSame(0, $slot->fresh()->booked_orders);
    }

    public function test_grocery_scheduled_at_without_a_slot_is_rejected(): void
    {
        $customer = $this->makeCustomer('9111111008');
        $this->makeGroceryCart($customer);

        Sanctum::actingAs($customer, ['*']);

        $this->postJson('/api/v1/orders', [
            'order_type' => 'grocery',
            'payment_method' => 'cash_on_delivery',
            'scheduled_at' => now()->addDay()->toIso8601String(),
        ])->assertStatus(422);

        $this->assertSame(0, Order::count());
    }

    // -----------------------------------------------------------------
    // Activation and dispatch safety
    // -----------------------------------------------------------------

    public function test_scheduled_order_cannot_reach_a_partner_directly(): void
    {
        $slot = $this->publishSlot($this->groceryVendor, $this->store, '2026-10-01', '09:00');
        $order = $this->placeScheduledOrder($slot);

        $dispatch = app(OrderDispatchService::class);
        $this->assertSame('not_dispatcheable', $dispatch->dispatchForOrder($order)['status']);
        $this->assertDatabaseCount('dispatch_logs', 0);

        $this->assertFalse(OrderStateMachine::canTransition($order, 'PARTNER_ASSIGNED'));
        $this->assertFalse(OrderStateMachine::canTransition($order, 'OUT_FOR_DELIVERY'));
        $this->assertFalse(OrderStateMachine::canTransition($order, 'DELIVERED'));
        $this->assertTrue(OrderStateMachine::canTransition($order, 'CANCELLED'));

        Sanctum::actingAs($this->groceryVendor->user, ['*']);
        $this->putJson("/api/v1/vendor/orders/{$order->id}/status", ['status' => 'out_for_delivery'])
            ->assertStatus(422);

        $this->assertSame('SCHEDULED', $order->fresh()->status);
    }

    public function test_vendor_can_prepare_a_scheduled_order_before_the_slot_starts(): void
    {
        $slot = $this->publishSlotStartingIn(180);
        $order = $this->placeScheduledOrder($slot);

        $this->assertSame('SCHEDULED', $order->status);
        $this->assertTrue(OrderStateMachine::canTransition($order, 'ACCEPTED'));
        $this->assertTrue(Carbon::now('UTC')->lessThan($slot->startsAt()));

        Sanctum::actingAs($this->groceryVendor->user, ['*']);

        $this->putJson("/api/v1/vendor/orders/{$order->id}/status", ['status' => 'accepted'])
            ->assertStatus(200)
            ->assertJsonPath('data.status', 'ACCEPTED');

        $this->putJson("/api/v1/vendor/orders/{$order->id}/status", ['status' => 'preparing'])
            ->assertStatus(200)
            ->assertJsonPath('data.status', 'PREPARING');

        $this->putJson("/api/v1/vendor/orders/{$order->id}/status", ['status' => 'ready'])
            ->assertStatus(200)
            ->assertJsonPath('data.status', 'READY');

        $this->assertSame('READY', $order->fresh()->status);
        $this->assertNotNull($order->fresh()->ready_at);
        $this->assertDatabaseCount('dispatch_logs', 0);
    }

    public function test_scheduled_dispatch_is_held_until_the_booked_window_opens(): void
    {
        // The default is vendor-manual dispatch; this test covers the legacy
        // automatic path, so manual dispatch is explicitly switched off.
        AppSetting::updateOrCreate(
            ['key' => 'grocery_vendor_manual_dispatch'],
            ['value' => '0', 'label' => 'Vendor-Manual Dispatch for Scheduled Grocery', 'group' => 'grocery_delivery', 'type' => 'boolean', 'is_public' => false]
        );

        $slot = $this->publishSlotStartingIn(90);
        $order = $this->placeScheduledOrder($slot);
        $order->update(['status' => 'READY']);

        $dispatch = app(OrderDispatchService::class);
        $eligibleAt = $slot->startsAt();

        $waiting = $dispatch->dispatchForOrder($order->fresh());
        $this->assertSame('scheduled_wait', $waiting['status']);
        $this->assertSame($eligibleAt->toIso8601String(), $waiting['dispatch_eligible_at']);
        $this->assertDatabaseCount('dispatch_logs', 0);

        Carbon::setTestNow($eligibleAt->copy()->subMinute());

        $this->assertSame('scheduled_wait', $dispatch->dispatchForOrder($order->fresh())['status']);
        $this->assertDatabaseCount('dispatch_logs', 0);

        Carbon::setTestNow($eligibleAt);

        $this->assertNotSame('scheduled_wait', $dispatch->dispatchForOrder($order->fresh())['status']);
    }

    public function test_retired_dispatch_lead_setting_no_longer_affects_dispatch_eligibility(): void
    {
        $slot = $this->publishSlotStartingIn(120, leadTimeMin: 0);
        $order = $this->placeScheduledOrder($slot);
        $order->update(['status' => 'READY']);

        // A stale row from an older seeder must not shorten the window.
        AppSetting::updateOrCreate(
            ['key' => 'grocery_scheduled_dispatch_lead_minutes'],
            ['group' => 'grocery_delivery', 'label' => 'Grocery Scheduled Dispatch Lead Time (minutes)', 'value' => '30', 'type' => 'number', 'is_public' => false, 'sort_order' => 6]
        );

        $service = app(DeliverySlotService::class);

        $this->assertSame(0, (int) $slot->lead_time_min, 'booking cutoff is a separate setting');
        $this->assertSame($slot->startsAt()->toIso8601String(), $service->dispatchEligibleAt($order)->toIso8601String());
    }

    public function test_scheduled_order_is_not_dispatched_until_it_is_packed(): void
    {
        // Legacy automatic path: vendor-manual dispatch is switched off.
        AppSetting::updateOrCreate(
            ['key' => 'grocery_vendor_manual_dispatch'],
            ['value' => '0', 'label' => 'Vendor-Manual Dispatch for Scheduled Grocery', 'group' => 'grocery_delivery', 'type' => 'boolean', 'is_public' => false]
        );

        $slot = $this->publishSlotStartingIn(30);
        $order = $this->placeScheduledOrder($slot);

        Carbon::setTestNow($slot->startsAt());

        $dispatch = app(OrderDispatchService::class);
        $order->update(['status' => 'ACCEPTED']);

        $notPrepared = $dispatch->dispatchForOrder($order->fresh());
        $this->assertSame('scheduled_not_prepared', $notPrepared['status']);
        $this->assertDatabaseCount('dispatch_logs', 0);

        $order->update(['status' => 'READY']);

        $this->assertNotSame('scheduled_not_prepared', $dispatch->dispatchForOrder($order->fresh())['status']);
    }

    public function test_asap_grocery_and_food_orders_are_never_gated(): void
    {
        $dispatch = app(OrderDispatchService::class);
        $service = app(DeliverySlotService::class);

        $asapCustomer = $this->makeCustomer('9111111009');
        $this->makeGroceryCart($asapCustomer);
        $asap = $this->checkout($asapCustomer);

        $this->assertNull($asap->delivery_slot_id);
        $this->assertNull($service->dispatchEligibleAt($asap));
        $this->assertNotSame('scheduled_wait', $dispatch->dispatchForOrder($asap->fresh())['status']);
        $this->assertNotSame('scheduled_not_prepared', $dispatch->dispatchForOrder($asap->fresh())['status']);

        // Food is never scheduled, so the gate can never apply to it, even if a
        // schedule timestamp were somehow present on the order.
        $food = new Order;
        $food->order_type = 'food';
        $food->scheduled_at = Carbon::now('UTC');

        $this->assertNull($service->dispatchEligibleAt($food));
    }

    public function test_activation_command_releases_due_orders_into_the_normal_queue(): void
    {
        // Booked through the real API path, so the only thing that knows when
        // the order is due is the slot it was booked into.
        $slot = $this->publishSlotStartingIn(1);
        $due = $this->placeScheduledOrder($slot);
        $later = $this->placeScheduledOrder(
            $this->publishSlot($this->groceryVendor, $this->store, Carbon::now('UTC')->addDay()->format('Y-m-d'), '09:00')
        );

        $this->assertSame($slot->startsAt()->toDateTimeString(), $due->scheduled_at?->toDateTimeString());

        $this->artisan('grocery:activate-scheduled-orders')->assertSuccessful();

        $this->assertSame('SCHEDULED', $due->fresh()->status);

        Carbon::setTestNow(Carbon::now('UTC')->addMinutes(2));

        $this->artisan('grocery:activate-scheduled-orders')->assertSuccessful();

        $this->assertSame('PENDING', $due->fresh()->status);
        $this->assertNotNull($due->fresh()->meta['delivery_schedule']['activated_at']);
        $this->assertSame('SCHEDULED', $later->fresh()->status);

        $this->assertDatabaseHas('order_status_histories', [
            'order_id' => $due->id,
            'old_status' => 'SCHEDULED',
            'new_status' => 'PENDING',
        ]);
    }

    public function test_activated_order_can_be_accepted_by_the_vendor(): void
    {
        $order = $this->placeScheduledOrder($this->publishSlotStartingIn(1));

        Carbon::setTestNow(Carbon::now('UTC')->addMinutes(2));

        $this->artisan('grocery:activate-scheduled-orders')->assertSuccessful();

        Sanctum::actingAs($this->groceryVendor->user, ['*']);
        $this->putJson("/api/v1/vendor/orders/{$order->id}/status", ['status' => 'accepted'])
            ->assertStatus(200);

        $this->assertSame('ACCEPTED', $order->fresh()->status);
    }

    public function test_cancelling_a_scheduled_order_releases_capacity_exactly_once(): void
    {
        $slot = $this->publishSlot($this->groceryVendor, $this->store, '2026-10-01', '09:00', maxOrders: 5);
        $order = $this->placeScheduledOrder($slot);
        $customer = $order->user;

        $this->assertSame(1, $slot->fresh()->booked_orders);

        Sanctum::actingAs($customer, ['*']);

        $this->postJson("/api/v1/orders/{$order->id}/cancel", ['reason' => 'Plans changed'])
            ->assertStatus(200);

        $this->assertSame('CANCELLED', $order->fresh()->status);
        $this->assertNotNull($order->fresh()->slot_released_at);
        $this->assertSame(0, $slot->fresh()->booked_orders);

        app(DeliveryService::class)->cancelOrder($order->fresh(), $customer, 'again');

        $this->assertSame(0, $slot->fresh()->booked_orders);
    }

    public function test_delivered_scheduled_order_keeps_its_capacity(): void
    {
        $slot = $this->publishSlot($this->groceryVendor, $this->store, '2026-10-01', '09:00');
        $order = $this->placeScheduledOrder($slot);

        $order->update(['status' => 'DELIVERED']);
        $this->assertTrue(app(DeliverySlotService::class)->releaseForOrder($order->fresh()) === false);
        $this->assertSame(1, $slot->fresh()->booked_orders);
    }

    // -----------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------

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

    /**
     * Put the grocery vendor inside the customer's zone. Only the customer-facing
     * slot lookups need it, so the order tests keep their zone-less vendor and
     * stay exactly as they were.
     */
    private function zoneVendor(): void
    {
        $this->groceryVendor->update(['zone_id' => $this->zone->id]);
    }

    /**
     * Active zones now require a complete configuration for every module.
     * These fixtures use the same values for Instant and Scheduled Chargeable so
     * the scheduling tests can assert that slot timing does not change pricing.
     */
    private function configureZoneDelivery(): void
    {
        $values = [
            'delivery_fee_per_km' => 5,
            'delivery_fee_paid_by_admin_per_km' => 5,
            'free_delivery_above' => null,
            'free_delivery_km' => 0,
            'delivery_gst_percent' => 18,
            'partner_free_distance_earning' => 20,
            'packaging_charge' => 0,
            'handling_fee' => 0,
        ];

        ZoneDeliveryConfig::create([
            'zone_id' => $this->zone->id,
            'module' => ZoneDeliveryConfig::MODULE_FOOD,
            'delivery_mode' => ZoneDeliveryConfig::MODE_STANDARD,
            ...$values,
        ]);

        ZoneDeliveryConfig::create([
            'zone_id' => $this->zone->id,
            'module' => ZoneDeliveryConfig::MODULE_GROCERY,
            'delivery_mode' => ZoneDeliveryConfig::MODE_INSTANT,
            ...$values,
        ]);

        ZoneDeliveryConfig::create([
            'zone_id' => $this->zone->id,
            'module' => ZoneDeliveryConfig::MODULE_GROCERY,
            'delivery_mode' => ZoneDeliveryConfig::MODE_SCHEDULED,
            'delivery_type' => ZoneDeliveryConfig::TYPE_CHARGEABLE,
            ...$values,
        ]);
    }

    private function makeStore(Vendor $vendor, string $name): Store
    {
        return Store::create([
            'vendor_id' => $vendor->id,
            'name' => $name,
            'slug' => str($name)->slug().'-'.uniqid(),
            'store_type' => 'convenience',
            'latitude' => self::CUSTOMER_LAT,
            'longitude' => self::CUSTOMER_LNG,
            'order_type' => 'both',
            'is_open' => true,
            'is_active' => true,
            'supports_instant_delivery' => true,
            'supports_scheduled_delivery' => true,
        ]);
    }

    private function makeCustomer(string $phone): User
    {
        return User::factory()->create([
            'name' => 'Customer '.$phone,
            'phone' => $phone,
            'user_type' => 'customer',
            'is_active' => true,
        ]);
    }

    private function publishSlot(
        Vendor $vendor,
        Store $store,
        string $date,
        string $start,
        int $maxOrders = 10,
        int $leadTimeMin = 60
    ): DeliverySlot {
        return DeliverySlot::create([
            'vendor_id' => $vendor->id,
            'store_id' => $store->id,
            'slot_date' => $date,
            'start_time' => Carbon::parse($start)->format('H:i:s'),
            'end_time' => Carbon::parse($start)->addHours(2)->format('H:i:s'),
            'slot_timezone' => config('delivery_slots.timezone'),
            'max_orders' => $maxOrders,
            'booked_orders' => 0,
            'lead_time_min' => $leadTimeMin,
            'is_active' => true,
        ]);
    }

    private function makeGroceryCart(User $user): void
    {
        $product = Product::create([
            'vendor_id' => $this->groceryVendor->id,
            'store_id' => $this->store->id,
            'name' => 'Groceries '.uniqid('g', true),
            'slug' => 'grocery-'.uniqid('s', true),
            'sku' => 'SKU_'.uniqid(),
            'price' => 120,
            'type' => 'grocery',
            'tax_rate' => 0,
            'is_active' => true,
            'is_available' => true,
        ]);

        $cart = Cart::create([
            'user_id' => $user->id,
            'cart_type' => 'grocery',
            'vendor_id' => $this->groceryVendor->id,
            'subtotal' => 240,
            'discount' => 0,
            'tax' => 0,
            'delivery_fee' => 25,
            'total' => 265,
            'items_count' => 2,
        ]);

        CartItem::create([
            'cart_id' => $cart->id,
            'product_id' => $product->id,
            'unit_price' => $product->price,
            'quantity' => 2,
            'line_total' => 240,
        ]);
    }

    /**
     * A bookable slot that starts in $minutes, so the test can step the clock
     * past its start to exercise activation.
     */
    private function publishSlotStartingIn(int $minutes, int $leadTimeMin = 0): DeliverySlot
    {
        $start = Carbon::now('Asia/Kolkata')->addMinutes($minutes);

        return $this->publishSlot($this->groceryVendor, $this->store, $start->format('Y-m-d'), $start->format('H:i'), leadTimeMin: $leadTimeMin);
    }

    private function placeScheduledOrder(DeliverySlot $slot, ?Carbon $scheduledAt = null): Order
    {
        $customer = $this->makeCustomer('92'.random_int(10000000, 99999999));
        $this->makeGroceryCart($customer);

        $order = $this->checkout($customer, ['delivery_slot_id' => $slot->id]);

        if ($scheduledAt) {
            $order->update(['scheduled_at' => $scheduledAt]);
        }

        return $order->fresh(['user']);
    }

    private function checkout(User $user, array $data = []): Order
    {
        $payload = array_merge([
            'order_type' => 'grocery',
            'payment_method' => 'cash_on_delivery',
        ], $data);

        if (empty($payload['address_id'])) {
            $address = Address::create([
                'user_id' => $user->id,
                'label' => 'Home',
                'contact_name' => $user->name,
                'contact_phone' => $user->phone,
                'address_line_1' => '12, Main Road',
                'city' => 'Jaipur',
                'state' => 'Rajasthan',
                'postal_code' => '302001',
                'country' => 'IN',
                'latitude' => self::CUSTOMER_LAT,
                'longitude' => self::CUSTOMER_LNG,
                'type' => 'home',
                'is_default' => true,
            ]);

            $payload['address_id'] = $address->id;
        }

        return app(OrderService::class)->createOrder($user, $payload);
    }
}
