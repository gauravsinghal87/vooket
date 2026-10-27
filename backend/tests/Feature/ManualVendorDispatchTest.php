<?php

namespace Tests\Feature;

use App\Models\Address;
use App\Models\AppSetting;
use App\Models\DeliveryPartner;
use App\Models\DeliverySlot;
use App\Models\DispatchLog;
use App\Models\Order;
use App\Models\Role;
use App\Models\Store;
use App\Models\User;
use App\Models\Vendor;
use App\Services\DeliverySlotService;
use App\Services\Dispatch\OrderDispatchService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Manual partner dispatch.
 *
 * The default (enabled) is that a scheduled Grocery order is dispatched only
 * by its vendor: after packing, the vendor lists every eligible partner of the
 * order's service, picks one, and only the selected partner receives a
 * targeted request which they then accept through the normal offer flow.
 * Nothing is auto-offered and a rejected/expired request never falls back to
 * someone else. Manual assignment additionally serves as the override for Food
 * and instant Grocery orders that need a partner picked by hand.
 */
class ManualVendorDispatchTest extends TestCase
{
    use RefreshDatabase;

    private Role $vendorRole;

    private Vendor $groceryVendor;

    private Store $store;

    protected function setUp(): void
    {
        parent::setUp();

        Carbon::setTestNow(Carbon::parse('2026-10-01 02:45:00', 'UTC'));

        $this->vendorRole = Role::firstOrCreate(['slug' => 'vendor'], ['name' => 'Vendor']);
        $this->groceryVendor = $this->makeVendor('grocery', 'FreshMart');
        $this->store = $this->makeStore($this->groceryVendor, 'FreshMart Supermarket');
    }

    public function test_scheduled_grocery_order_is_never_auto_offered(): void
    {
        $slot = $this->publishSlot('2026-10-01', '09:00');
        $order = $this->placeScheduledOrder($slot);
        $this->makePartner('grocery');

        $order->update(['status' => 'READY']);

        $result = app(OrderDispatchService::class)->dispatchForOrder($order->fresh());

        $this->assertSame('vendor_manual_dispatch', $result['status']);
        $this->assertDatabaseCount('dispatch_logs', 0);
    }

    public function test_scheduled_grocery_order_is_never_auto_offered_even_past_the_dispatch_lead(): void
    {
        $slot = $this->publishSlot('2026-10-01', '09:00');
        $order = $this->placeScheduledOrder($slot);
        $this->makePartner('grocery');

        $order->update(['status' => 'READY']);

        Carbon::setTestNow(Carbon::parse('2026-10-01 03:00:00', 'UTC'));

        $result = app(OrderDispatchService::class)->dispatchForOrder($order->fresh());

        $this->assertSame('vendor_manual_dispatch', $result['status']);
        $this->assertDatabaseCount('dispatch_logs', 0);
    }

    public function test_vendor_lists_all_same_service_partners_with_no_radius_limit(): void
    {
        $slot = $this->publishSlot('2026-10-01', '09:00');
        $order = $this->placeScheduledOrder($slot);
        $order->update(['status' => 'READY']);

        $near = $this->makePartner('grocery');
        $far = $this->makePartner('grocery');
        $far->update(['latitude' => 20.0, 'longitude' => 77.0, 'last_location_at' => now()]);
        $offline = $this->makePartner('grocery');
        $offline->update(['is_online' => false]);
        $locationless = $this->makePartner('grocery');
        $locationless->update(['latitude' => null, 'longitude' => null]);
        $food = $this->makePartner('food');

        Sanctum::actingAs($this->groceryVendor->user, ['*']);

        $response = $this->getJson("/api/v1/vendor/orders/{$order->id}/eligible-delivery-partners")
            ->assertOk()
            ->assertJsonPath('meta.service', 'grocery')
            ->assertJsonPath('meta.service_label', 'Grocery delivery');

        $data = $response->json('data');
        $ids = array_column($data, 'id');

        $this->assertContains($near->id, $ids);
        $this->assertContains($far->id, $ids, 'A partner beyond the automatic-dispatch radius is still listed.');
        $this->assertContains($offline->id, $ids, 'An offline partner is listed for reference.');
        $this->assertContains($locationless->id, $ids, 'A partner without a live location is still listed.');
        $this->assertNotContains($food->id, $ids, 'A partner of another service is not listed.');

        $byId = array_column($data, null, 'id');

        $this->assertTrue($byId[$near->id]['available_for_assignment'], 'An online, located, in-capacity partner is assignable.');
        $this->assertFalse($byId[$offline->id]['available_for_assignment'], 'An offline partner is listed but not assignable.');
        $this->assertFalse($byId[$locationless->id]['available_for_assignment'], 'A location-less partner is listed but not assignable.');
        $this->assertNull($byId[$locationless->id]['distance_km'], 'No location means no distance.');
        $this->assertSame('offline', $byId[$offline->id]['status']);

        $this->assertSame($near->id, $data[0]['id'], 'Nearest located partner ranks first.');
        $this->assertSame($locationless->id, end($data)['id'], 'Partners without a location sort last.');
        $this->assertArrayHasKey('distance_km', $data[0]);
        $this->assertArrayHasKey('availability', $data[0]);
        $this->assertArrayHasKey('available_for_assignment', $data[0]);
        $this->assertArrayHasKey('is_online', $data[0]);
        $this->assertArrayHasKey('active_batch_order_count', $data[0]);
    }

    public function test_eligible_partner_list_is_not_exposed_for_a_foreign_vendor_order(): void
    {
        $otherVendor = $this->makeVendor('grocery', 'Other Mart');
        $otherStore = $this->makeStore($otherVendor, 'Other Store');
        $slot = DeliverySlot::create([
            'vendor_id' => $otherVendor->id,
            'store_id' => $otherStore->id,
            'slot_date' => '2026-10-01',
            'start_time' => '09:00:00',
            'end_time' => '11:00:00',
            'slot_timezone' => config('delivery_slots.timezone'),
            'max_orders' => 10,
            'booked_orders' => 0,
            'lead_time_min' => 60,
            'is_active' => true,
        ]);
        $order = $this->placeScheduledOrderFor($otherVendor, $slot);
        $order->update(['status' => 'READY']);

        Sanctum::actingAs($this->groceryVendor->user, ['*']);
        $this->getJson("/api/v1/vendor/orders/{$order->id}/eligible-delivery-partners")
            ->assertStatus(404);
        $this->postJson("/api/v1/vendor/orders/{$order->id}/assign-delivery-partner", [
            'delivery_partner_id' => $this->makePartner('grocery')->id,
        ])->assertStatus(404);
    }

    public function test_vendor_assignment_creates_a_single_targeted_offer_for_the_partner(): void
    {
        $slot = $this->publishSlot('2026-10-01', '09:00');
        $order = $this->placeScheduledOrder($slot);
        $order->update(['status' => 'READY']);

        $partner = $this->makePartner('grocery');

        Sanctum::actingAs($this->groceryVendor->user, ['*']);

        $response = $this->postJson("/api/v1/vendor/orders/{$order->id}/assign-delivery-partner", [
            'delivery_partner_id' => $partner->id,
            'note' => 'Please deliver by 11am',
        ])->assertOk();

        $fresh = $order->fresh();

        $this->assertSame('READY', $fresh->status);
        $this->assertNull($fresh->delivery_partner_id, 'Assignment never assigns the order directly.');
        $this->assertSame('vendor_manual', $fresh->meta['delivery_assignment_mode']);

        $offer = DispatchLog::where('order_id', $order->id)->first();
        $this->assertNotNull($offer);
        $this->assertSame(DispatchLog::STATUS_PENDING, $offer->status);
        $this->assertSame('vendor_manual', $offer->meta['assignment']['mode']);
        $this->assertSame('vendor', $offer->meta['assignment']['assigned_by']);
        $this->assertSame('Please deliver by 11am', $offer->meta['assignment']['note']);
        $this->assertSame($response->json('data.offer.id'), $offer->id);

        $this->assertDatabaseCount('dispatch_logs', 1);
    }

    public function test_the_partner_sees_the_targeted_request_in_their_incoming_orders(): void
    {
        $slot = $this->publishSlot('2026-10-01', '09:00');
        $order = $this->placeScheduledOrder($slot);
        $order->update(['status' => 'READY']);

        $partner = $this->makePartner('grocery');

        Sanctum::actingAs($this->groceryVendor->user, ['*']);
        $this->postJson("/api/v1/vendor/orders/{$order->id}/assign-delivery-partner", [
            'delivery_partner_id' => $partner->id,
        ])->assertOk();

        Sanctum::actingAs($partner->user, ['*']);
        $this->getJson('/api/v1/delivery-partner/incoming-orders')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.order_id', $order->id);
    }

    public function test_a_packed_order_is_promoted_to_ready_for_the_offer(): void
    {
        $slot = $this->publishSlot('2026-10-01', '09:00');
        $order = $this->placeScheduledOrder($slot);
        $order->update(['status' => 'PACKED']);

        $partner = $this->makePartner('grocery');

        Sanctum::actingAs($this->groceryVendor->user, ['*']);
        $this->postJson("/api/v1/vendor/orders/{$order->id}/assign-delivery-partner", [
            'delivery_partner_id' => $partner->id,
        ])->assertOk();

        $fresh = $order->fresh();

        $this->assertSame('READY', $fresh->status);
        $this->assertNotNull($fresh->ready_at);
        $this->assertDatabaseHas('order_status_histories', [
            'order_id' => $order->id,
            'old_status' => 'PACKED',
            'new_status' => 'READY',
        ]);
        $this->assertSame(1, DispatchLog::where('order_id', $order->id)->where('status', DispatchLog::STATUS_PENDING)->count());
    }

    public function test_reassigning_a_different_partner_supersedes_the_previous_offer(): void
    {
        $slot = $this->publishSlot('2026-10-01', '09:00');
        $order = $this->placeScheduledOrder($slot);
        $order->update(['status' => 'READY']);

        $first = $this->makePartner('grocery');
        $second = $this->makePartner('grocery');

        Sanctum::actingAs($this->groceryVendor->user, ['*']);
        $this->postJson("/api/v1/vendor/orders/{$order->id}/assign-delivery-partner", [
            'delivery_partner_id' => $first->id,
        ])->assertOk();

        $this->postJson("/api/v1/vendor/orders/{$order->id}/assign-delivery-partner", [
            'delivery_partner_id' => $second->id,
        ])->assertOk();

        $this->assertSame(
            DispatchLog::STATUS_EXPIRED,
            DispatchLog::where('order_id', $order->id)->where('candidate_id', $first->id)->first()->status
        );
        $this->assertSame(
            DispatchLog::STATUS_PENDING,
            DispatchLog::where('order_id', $order->id)->where('candidate_id', $second->id)->first()->status
        );
    }

    public function test_assigning_the_same_partner_again_is_idempotent(): void
    {
        $slot = $this->publishSlot('2026-10-01', '09:00');
        $order = $this->placeScheduledOrder($slot);
        $order->update(['status' => 'READY']);

        $partner = $this->makePartner('grocery');

        Sanctum::actingAs($this->groceryVendor->user, ['*']);
        $this->postJson("/api/v1/vendor/orders/{$order->id}/assign-delivery-partner", [
            'delivery_partner_id' => $partner->id,
        ])->assertOk();
        $this->postJson("/api/v1/vendor/orders/{$order->id}/assign-delivery-partner", [
            'delivery_partner_id' => $partner->id,
        ])->assertOk();

        $this->assertSame(1, DispatchLog::where('order_id', $order->id)->count());
    }

    public function test_a_rejected_request_never_falls_back_to_another_partner(): void
    {
        $slot = $this->publishSlot('2026-10-01', '09:00');
        $order = $this->placeScheduledOrder($slot);
        $order->update(['status' => 'READY']);

        $targeted = $this->makePartner('grocery');
        $backup = $this->makePartner('grocery');

        Sanctum::actingAs($this->groceryVendor->user, ['*']);
        $this->postJson("/api/v1/vendor/orders/{$order->id}/assign-delivery-partner", [
            'delivery_partner_id' => $targeted->id,
        ])->assertOk();

        Sanctum::actingAs($targeted->user, ['*']);
        $offer = DispatchLog::where('order_id', $order->id)->first();
        $this->postJson("/api/v1/delivery-partner/orders/{$offer->id}/reject")->assertOk();

        $this->assertSame(DispatchLog::STATUS_REJECTED, $offer->fresh()->status);
        $this->assertNull($order->fresh()->delivery_partner_id);

        // No queued broadcast to anyone else — the vendor must choose again.
        $this->assertSame(1, DispatchLog::where('order_id', $order->id)->count());
        $this->assertNull(DispatchLog::where('order_id', $order->id)->where('candidate_id', $backup->id)->first());
        $this->assertSame(
            'vendor_manual_dispatch',
            app(OrderDispatchService::class)->dispatchForOrder($order->fresh())['status']
        );
    }

    public function test_an_order_already_claimed_by_a_partner_cannot_be_reassigned(): void
    {
        $slot = $this->publishSlot('2026-10-01', '09:00');
        $order = $this->placeScheduledOrder($slot);
        $order->update(['status' => 'READY']);

        $first = $this->makePartner('grocery');
        $order->update(['delivery_partner_id' => $first->id, 'status' => 'PARTNER_ASSIGNED']);

        Sanctum::actingAs($this->groceryVendor->user, ['*']);
        $this->postJson("/api/v1/vendor/orders/{$order->id}/assign-delivery-partner", [
            'delivery_partner_id' => $this->makePartner('grocery')->id,
        ])->assertStatus(422);
    }

    public function test_an_unassigned_order_must_be_packed_or_ready(): void
    {
        $slot = $this->publishSlot('2026-10-01', '09:00');
        $order = $this->placeScheduledOrder($slot);
        $order->update(['status' => 'ACCEPTED']);

        Sanctum::actingAs($this->groceryVendor->user, ['*']);
        $this->postJson("/api/v1/vendor/orders/{$order->id}/assign-delivery-partner", [
            'delivery_partner_id' => $this->makePartner('grocery')->id,
        ])
            ->assertStatus(422)
            ->assertJsonPath('message', 'This order can only be assigned after you have packed it.');
    }

    public function test_an_ineligible_partner_is_refused(): void
    {
        $slot = $this->publishSlot('2026-10-01', '09:00');
        $order = $this->placeScheduledOrder($slot);
        $order->update(['status' => 'READY']);

        $offline = $this->makePartner('grocery');
        $offline->update(['is_online' => false]);

        Sanctum::actingAs($this->groceryVendor->user, ['*']);
        $this->postJson("/api/v1/vendor/orders/{$order->id}/assign-delivery-partner", [
            'delivery_partner_id' => $offline->id,
        ])
            ->assertStatus(422)
            ->assertJsonPath('message', 'This delivery partner is not eligible for this order.');
    }

    public function test_instant_grocery_and_food_orders_can_be_manually_assigned(): void
    {
        $asap = Order::create([
            'order_number' => 'ORD_ASAP_'.uniqid(),
            'user_id' => User::factory()->create(['user_type' => 'customer', 'is_active' => true])->id,
            'vendor_id' => $this->groceryVendor->id,
            'order_type' => 'grocery',
            'status' => 'READY',
            'timing_type' => 'instant',
            'payment_status' => 'paid',
            'payment_method' => 'cash_on_delivery',
            'subtotal' => 120,
            'delivery_fee' => 25,
            'total_amount' => 145,
        ]);

        $foodVendor = $this->makeVendor('food', 'Spice Villa');
        $food = Order::create([
            'order_number' => 'ORD_FOOD_'.uniqid(),
            'user_id' => User::factory()->create(['user_type' => 'customer', 'is_active' => true])->id,
            'vendor_id' => $foodVendor->id,
            'order_type' => 'food',
            'status' => 'READY',
            'timing_type' => 'instant',
            'payment_status' => 'paid',
            'payment_method' => 'cash_on_delivery',
            'subtotal' => 200,
            'delivery_fee' => 30,
            'total_amount' => 230,
        ]);

        // A food order owned by the same grocery vendor scopes in too.
        $groceryOwnedFood = Order::create([
            'order_number' => 'ORD_FOOD_'.uniqid(),
            'user_id' => User::factory()->create(['user_type' => 'customer', 'is_active' => true])->id,
            'vendor_id' => $this->groceryVendor->id,
            'order_type' => 'food',
            'status' => 'READY',
            'timing_type' => 'instant',
            'payment_status' => 'paid',
            'payment_method' => 'cash_on_delivery',
            'subtotal' => 200,
            'delivery_fee' => 30,
            'total_amount' => 230,
        ]);

        $groceryPartner = $this->makePartner('grocery');
        $foodPartner = $this->makePartner('food');

        Sanctum::actingAs($this->groceryVendor->user, ['*']);

        // Instant grocery is now manual-listed and assignable with a grocery partner.
        $this->getJson("/api/v1/vendor/orders/{$asap->id}/eligible-delivery-partners")
            ->assertOk()
            ->assertJsonPath('data.0.id', $groceryPartner->id);

        $this->postJson("/api/v1/vendor/orders/{$asap->id}/assign-delivery-partner", [
            'delivery_partner_id' => $groceryPartner->id,
        ])->assertOk();

        // Food owned by this vendor lists only food partners.
        $this->getJson("/api/v1/vendor/orders/{$groceryOwnedFood->id}/eligible-delivery-partners")
            ->assertOk()
            ->assertJsonPath('data.0.id', $foodPartner->id)
            ->assertJsonPath('data.0.service', 'food');

        // Assigning a grocery partner to a food order is refused.
        $this->postJson("/api/v1/vendor/orders/{$groceryOwnedFood->id}/assign-delivery-partner", [
            'delivery_partner_id' => $groceryPartner->id,
        ])
            ->assertStatus(422)
            ->assertJsonPath('message', 'This delivery partner is not eligible for this order.');

        // Food partner assignment succeeds on the food order.
        $this->postJson("/api/v1/vendor/orders/{$groceryOwnedFood->id}/assign-delivery-partner", [
            'delivery_partner_id' => $foodPartner->id,
        ])->assertOk();

        // A foreign vendor's order is still out of scope for this vendor.
        $this->postJson("/api/v1/vendor/orders/{$food->id}/assign-delivery-partner", [
            'delivery_partner_id' => $foodPartner->id,
        ])->assertStatus(404);
    }

    public function test_manual_override_still_works_when_the_automatic_mode_is_enabled(): void
    {
        AppSetting::updateOrCreate(
            ['key' => 'grocery_vendor_manual_dispatch'],
            ['value' => '0', 'label' => 'Vendor-Manual Dispatch for Scheduled Grocery', 'group' => 'grocery_delivery', 'type' => 'boolean', 'is_public' => false]
        );

        $this->assertFalse(app(DeliverySlotService::class)->manualVendorDispatchEnabled());

        $slot = $this->publishSlot('2026-10-01', '09:00');
        $order = $this->placeScheduledOrder($slot);
        $order->update(['status' => 'READY']);

        // Automatic dispatch is now enabled again for the order...
        $this->assertNotSame(
            'vendor_manual_dispatch',
            app(OrderDispatchService::class)->dispatchForOrder($order->fresh())['status']
        );

        // ...but the vendor can still pick a partner manually as an override.
        Sanctum::actingAs($this->groceryVendor->user, ['*']);
        $this->postJson("/api/v1/vendor/orders/{$order->id}/assign-delivery-partner", [
            'delivery_partner_id' => $this->makePartner('grocery')->id,
        ])->assertOk();

        $this->assertSame(
            'vendor_manual',
            $order->fresh()->meta['delivery_assignment_mode']
        );
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
            'email' => str($name)->slug().uniqid().'@example.com',
            'phone' => '98989'.random_int(10000, 99999),
            'vendor_type' => $type,
            'status' => 'approved',
            'is_active' => true,
            'latitude' => 12.9716,
            'longitude' => 77.5946,
        ]);
    }

    private function makeStore(Vendor $vendor, string $name): Store
    {
        return Store::create([
            'vendor_id' => $vendor->id,
            'name' => $name,
            'slug' => str($name)->slug().'-'.uniqid(),
            'store_type' => 'supermarket',
            'order_type' => 'both',
            'is_open' => true,
            'is_active' => true,
            'supports_instant_delivery' => true,
            'supports_scheduled_delivery' => true,
        ]);
    }

    private function makePartner(string $serviceType): DeliveryPartner
    {
        $user = User::factory()->create(['user_type' => 'delivery_partner', 'is_active' => true]);
        $user->roles()->attach(Role::firstOrCreate(['slug' => 'delivery_partner'], ['name' => 'Delivery Partner']));

        return DeliveryPartner::create([
            'user_id' => $user->id,
            'status' => 'approved',
            'service_type' => $serviceType,
            'is_online' => true,
            'is_busy' => false,
            'latitude' => 12.9720,
            'longitude' => 77.5950,
            'last_location_at' => now(),
        ]);
    }

    private function publishSlot(string $date, string $start): DeliverySlot
    {
        return DeliverySlot::create([
            'vendor_id' => $this->groceryVendor->id,
            'store_id' => $this->store->id,
            'slot_date' => $date,
            'start_time' => Carbon::parse($start)->format('H:i:s'),
            'end_time' => Carbon::parse($start)->addHours(3)->format('H:i:s'),
            'slot_timezone' => config('delivery_slots.timezone'),
            'max_orders' => 10,
            'booked_orders' => 0,
            'lead_time_min' => 60,
            'is_active' => true,
        ]);
    }

    private function placeScheduledOrder(DeliverySlot $slot): Order
    {
        return $this->placeScheduledOrderFor($this->groceryVendor, $slot);
    }

    private function placeScheduledOrderFor(Vendor $vendor, DeliverySlot $slot): Order
    {
        $customer = User::factory()->create(['user_type' => 'customer', 'is_active' => true]);
        $address = Address::create([
            'user_id' => $customer->id,
            'label' => 'Home',
            'contact_name' => 'Customer',
            'contact_phone' => '98123'.random_int(10000, 99999),
            'address_line_1' => '8 Market Road',
            'city' => 'Bengaluru',
            'state' => 'Karnataka',
            'postal_code' => '560001',
            'formatted_address' => '8 Market Road, Bengaluru',
            'latitude' => 12.9810,
            'longitude' => 77.6010,
            'is_default' => true,
        ]);

        return Order::create([
            'order_number' => 'ORD_'.strtoupper(bin2hex(random_bytes(4))),
            'user_id' => $customer->id,
            'vendor_id' => $vendor->id,
            'delivery_slot_id' => $slot->id,
            'order_type' => 'grocery',
            'status' => 'SCHEDULED',
            'timing_type' => 'scheduled',
            'scheduled_at' => $slot->startsAt(),
            'payment_status' => 'paid',
            'payment_method' => 'cash_on_delivery',
            'subtotal' => 240,
            'delivery_fee' => 25,
            'total_amount' => 265,
            'address_id' => $address->id,
            'delivery_address_snapshot' => $address->toArray(),
            'meta' => [
                'delivery_schedule' => [
                    'delivery_mode' => 'scheduled',
                    'starts_at' => $slot->startsAt()->toIso8601String(),
                    'ends_at' => $slot->endsAt()->toIso8601String(),
                ],
                'dispatch' => ['model' => 'grocery_scheduled'],
            ],
        ])->fresh();
    }
}
