<?php

namespace Tests\Feature;

use App\Models\DeliveryPartner;
use App\Models\DispatchLog;
use App\Models\Order;
use App\Models\Role;
use App\Models\User;
use App\Models\Vendor;
use App\Models\Zone;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Admin manual delivery-partner assignment.
 *
 * The admin app reuses the vendor's offer flow: for a Food or Grocery order
 * still waiting on a partner (READY / PACKED, no partner yet) the admin lists
 * every service-eligible partner — including offline, far-away and
 * location-less ones — and targets one with a single pending offer.
 * `delivery_partner_id` is never set up front; the partner still accepts
 * through the normal offer flow.
 */
class AdminManualDeliveryAssignmentTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_lists_all_same_service_partners_including_offline_far_and_locationless(): void
    {
        $admin = $this->makeAdmin();
        $vendor = $this->makeVendor('food', 'Spice Villa');
        $order = $this->placeFoodOrder($vendor);

        $near = $this->makePartner('food');
        $far = $this->makePartner('food');
        $far->update(['latitude' => 20.0, 'longitude' => 77.0, 'last_location_at' => now()]);
        $offline = $this->makePartner('food');
        $offline->update(['is_online' => false]);
        $locationless = $this->makePartner('food');
        $locationless->update(['latitude' => null, 'longitude' => null]);
        $unapproved = $this->makePartner('food');
        $unapproved->update(['status' => 'pending']);
        $grocery = $this->makePartner('grocery');

        Sanctum::actingAs($admin, ['*']);

        $data = $this->getJson("/api/v1/admin/orders/{$order->id}/eligible-delivery-partners")
            ->assertOk()
            ->assertJsonPath('meta.service', 'food')
            ->assertJsonPath('meta.service_label', 'Food delivery')
            ->json('data');

        $ids = array_column($data, 'id');

        $this->assertContains($near->id, $ids, 'Nearest online partner is listed.');
        $this->assertContains($far->id, $ids, 'A partner beyond the dispatch radius is listed.');
        $this->assertContains($offline->id, $ids, 'An offline partner is listed.');
        $this->assertContains($locationless->id, $ids, 'A partner without a live location is listed.');
        $this->assertNotContains($unapproved->id, $ids, 'A pending partner is not listed.');
        $this->assertNotContains($grocery->id, $ids, 'A partner of another service is not listed.');

        $byId = array_column($data, null, 'id');

        $this->assertTrue($byId[$near->id]['available_for_assignment'], 'An online, located, in-capacity partner is assignable.');
        $this->assertTrue($byId[$far->id]['available_for_assignment'], 'Distance does not gate assignability for the admin.');
        $this->assertFalse($byId[$offline->id]['available_for_assignment'], 'An offline partner is listed but not assignable.');
        $this->assertFalse($byId[$locationless->id]['available_for_assignment'], 'A location-less partner is listed but not assignable.');
        $this->assertFalse($byId[$locationless->id]['has_current_location']);
        $this->assertNull($byId[$locationless->id]['distance_km'], 'No location means no distance.');
        $this->assertSame('offline', $byId[$offline->id]['status']);

        $this->assertSame($near->id, $data[0]['id'], 'Nearest located partner ranks first.');
        $this->assertSame($locationless->id, end($data)['id'], 'Partners without a location sort last.');
        $this->assertArrayHasKey('distance_km', $data[0]);
        $this->assertArrayHasKey('availability', $data[0]);
        $this->assertArrayHasKey('available_for_assignment', $data[0]);
        $this->assertArrayNotHasKey('phone', $data[0], 'Candidate payload must not expose contact details.');
    }

    public function test_admin_lists_all_grocery_partners_for_a_grocery_order(): void
    {
        $admin = $this->makeAdmin();
        $vendor = $this->makeVendor('grocery', 'FreshMart');
        $south = Zone::create(['name' => 'Test South Zone', 'code' => 'SOUTH']);
        $central = Zone::create(['name' => 'Test Central Zone', 'code' => 'CENTRAL']);
        $order = $this->placeGroceryOrder($vendor);
        $order->update(['pickup_zone_id' => $south->id]);

        $inZone = $this->makePartner('grocery');
        $inZone->update(['current_zone_id' => $south->id]);
        $otherZone = $this->makePartner('grocery');
        $otherZone->update(['current_zone_id' => $central->id]);
        $offlineOtherZone = $this->makePartner('grocery');
        $offlineOtherZone->update(['current_zone_id' => $central->id, 'is_online' => false]);
        $food = $this->makePartner('food');

        Sanctum::actingAs($admin, ['*']);

        $data = $this->getJson("/api/v1/admin/orders/{$order->id}/eligible-delivery-partners")
            ->assertOk()
            ->assertJsonPath('meta.service', 'grocery')
            ->json('data');

        $ids = array_column($data, 'id');

        $this->assertContains($inZone->id, $ids);
        $this->assertContains($otherZone->id, $ids, 'A partner from another zone is still listed for the admin.');
        $this->assertContains($offlineOtherZone->id, $ids, 'An offline partner from another zone is still listed.');
        $this->assertNotContains($food->id, $ids, 'Food partners are never listed for a grocery order.');

        $byId = array_column($data, null, 'id');

        $this->assertTrue($byId[$inZone->id]['available_for_assignment']);
        $this->assertFalse($byId[$otherZone->id]['available_for_assignment'], 'Out-of-zone partner is listed but marked unassignable.');
        $this->assertFalse($byId[$offlineOtherZone->id]['available_for_assignment']);
    }

    public function test_admin_assignment_creates_a_single_targeted_offer_with_admin_meta(): void
    {
        $admin = $this->makeAdmin();
        $vendor = $this->makeVendor('food', 'Spice Villa');
        $order = $this->placeFoodOrder($vendor);
        $partner = $this->makePartner('food');

        Sanctum::actingAs($admin, ['*']);

        $response = $this->postJson("/api/v1/admin/orders/{$order->id}/assign-delivery-partner", [
            'delivery_partner_id' => $partner->id,
            'note' => 'Assign this one',
        ])->assertOk();

        $fresh = $order->fresh();

        $this->assertNull($fresh->delivery_partner_id, 'Admin assignment never claims the order directly.');
        $this->assertSame('admin_manual', $fresh->meta['delivery_assignment_mode']);

        $offer = DispatchLog::where('order_id', $order->id)->first();
        $this->assertNotNull($offer);
        $this->assertSame(DispatchLog::STATUS_PENDING, $offer->status);
        $this->assertSame('admin_manual', $offer->meta['assignment']['mode']);
        $this->assertSame('admin', $offer->meta['assignment']['assigned_by']);
        $this->assertSame('Assign this one', $offer->meta['assignment']['note']);
        $this->assertSame($response->json('data.offer.id'), $offer->id);

        $this->assertDatabaseCount('dispatch_logs', 1);
    }

    public function test_the_partner_sees_the_admin_targeted_request_in_their_incoming_orders(): void
    {
        $admin = $this->makeAdmin();
        $vendor = $this->makeVendor('grocery', 'FreshMart');
        $order = $this->placeGroceryOrder($vendor);
        $partner = $this->makePartner('grocery');

        Sanctum::actingAs($admin, ['*']);
        $this->postJson("/api/v1/admin/orders/{$order->id}/assign-delivery-partner", [
            'delivery_partner_id' => $partner->id,
        ])->assertOk();

        Sanctum::actingAs($partner->user, ['*']);
        $this->getJson('/api/v1/delivery-partner/incoming-orders')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.order_id', $order->id);
    }

    public function test_admin_order_detail_exposes_manual_assignable_and_active_dispatch_offer(): void
    {
        $admin = $this->makeAdmin();
        $vendor = $this->makeVendor('food', 'Spice Villa');
        $order = $this->placeFoodOrder($vendor);
        $partner = $this->makePartner('food');

        Sanctum::actingAs($admin, ['*']);
        $this->postJson("/api/v1/admin/orders/{$order->id}/assign-delivery-partner", [
            'delivery_partner_id' => $partner->id,
        ])->assertOk();

        Sanctum::actingAs($admin, ['*']);
        $this->getJson("/api/v1/admin/orders/{$order->id}")
            ->assertOk()
            ->assertJsonPath('data.manual_assignable', true)
            ->assertJsonPath('data.active_dispatch_offer.status', DispatchLog::STATUS_PENDING)
            ->assertJsonPath('data.active_dispatch_offer.partner_id', $partner->id)
            ->assertJsonPath('data.active_dispatch_offer.mode', 'admin_manual')
            ->assertJsonPath('data.active_dispatch_offer.assigned_by', 'admin');
    }

    public function test_admin_order_index_exposes_manual_assignable_flag(): void
    {
        $admin = $this->makeAdmin();
        $vendor = $this->makeVendor('food', 'Spice Villa');
        $ready = $this->placeFoodOrder($vendor);
        $claimed = $this->placeFoodOrder($vendor);
        $claimed->update(['status' => 'PARTNER_ASSIGNED', 'delivery_partner_id' => $this->makePartner('food')->id]);
        $delivered = $this->placeFoodOrder($vendor);
        $delivered->update(['status' => 'DELIVERED']);

        Sanctum::actingAs($admin, ['*']);

        $data = $this->getJson('/api/v1/admin/orders?service=food')->assertOk()->json('data');
        $flags = array_column($data, 'manual_assignable', 'id');

        $this->assertTrue($flags[$ready->id], 'A ready unassigned order is manually assignable.');
        $this->assertFalse($flags[$claimed->id], 'An already claimed order cannot be reassigned.');
        $this->assertFalse($flags[$delivered->id], 'A delivered order is not manually assignable.');
    }

    public function test_ride_orders_cannot_be_manually_assigned(): void
    {
        $admin = $this->makeAdmin();
        $vendor = $this->makeVendor('grocery', 'FreshMart');
        $ride = Order::create([
            'order_number' => 'ORD_RIDE_'.Str::upper(Str::random(6)),
            'user_id' => User::factory()->create(['user_type' => 'customer', 'is_active' => true])->id,
            'vendor_id' => $vendor->id,
            'order_type' => 'ride',
            'status' => 'READY',
            'timing_type' => 'instant',
            'payment_status' => 'paid',
            'payment_method' => 'cash_on_delivery',
            'subtotal' => 0,
            'delivery_fee' => 0,
            'total_amount' => 0,
        ]);

        Sanctum::actingAs($admin, ['*']);

        $this->getJson("/api/v1/admin/orders/{$ride->id}/eligible-delivery-partners")
            ->assertStatus(422)
            ->assertJsonPath('message', 'Only food and grocery orders can be assigned a delivery partner.');

        $this->postJson("/api/v1/admin/orders/{$ride->id}/assign-delivery-partner", [
            'delivery_partner_id' => $this->makePartner('grocery')->id,
        ])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Only food and grocery orders can be assigned a delivery partner.');
    }

    public function test_an_unassigned_order_must_still_be_packed_or_ready(): void
    {
        $admin = $this->makeAdmin();
        $vendor = $this->makeVendor('food', 'Spice Villa');
        $order = $this->placeFoodOrder($vendor, 'ACCEPTED');

        Sanctum::actingAs($admin, ['*']);
        $this->postJson("/api/v1/admin/orders/{$order->id}/assign-delivery-partner", [
            'delivery_partner_id' => $this->makePartner('food')->id,
        ])
            ->assertStatus(422)
            ->assertJsonPath('message', 'This order can only be assigned after you have packed it.');
    }

    public function test_an_order_already_claimed_by_a_partner_cannot_be_reassigned(): void
    {
        $admin = $this->makeAdmin();
        $vendor = $this->makeVendor('food', 'Spice Villa');
        $order = $this->placeFoodOrder($vendor);
        $order->update(['status' => 'PARTNER_ASSIGNED', 'delivery_partner_id' => $this->makePartner('food')->id]);

        Sanctum::actingAs($admin, ['*']);
        $this->postJson("/api/v1/admin/orders/{$order->id}/assign-delivery-partner", [
            'delivery_partner_id' => $this->makePartner('food')->id,
        ])
            ->assertStatus(422)
            ->assertJsonPath('message', 'This order already has an assigned delivery partner.');
    }

    public function test_an_offline_partner_is_refused(): void
    {
        $admin = $this->makeAdmin();
        $vendor = $this->makeVendor('food', 'Spice Villa');
        $order = $this->placeFoodOrder($vendor);
        $offline = $this->makePartner('food');
        $offline->update(['is_online' => false]);

        Sanctum::actingAs($admin, ['*']);
        $this->postJson("/api/v1/admin/orders/{$order->id}/assign-delivery-partner", [
            'delivery_partner_id' => $offline->id,
        ])
            ->assertStatus(422)
            ->assertJsonPath('message', 'This delivery partner is not eligible for this order.');
    }

    public function test_reassigning_a_different_partner_supersedes_the_previous_offer(): void
    {
        $admin = $this->makeAdmin();
        $vendor = $this->makeVendor('food', 'Spice Villa');
        $order = $this->placeFoodOrder($vendor);
        $first = $this->makePartner('food');
        $second = $this->makePartner('food');

        Sanctum::actingAs($admin, ['*']);
        $this->postJson("/api/v1/admin/orders/{$order->id}/assign-delivery-partner", [
            'delivery_partner_id' => $first->id,
        ])->assertOk();

        $this->postJson("/api/v1/admin/orders/{$order->id}/assign-delivery-partner", [
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
        $this->assertSame(1, DispatchLog::where('order_id', $order->id)->where('status', DispatchLog::STATUS_PENDING)->count());
    }

    public function test_assignment_requires_super_admin_authorization(): void
    {
        $vendor = $this->makeVendor('food', 'Spice Villa');
        $order = $this->placeFoodOrder($vendor);
        $partner = $this->makePartner('food');

        $this->postJson("/api/v1/admin/orders/{$order->id}/assign-delivery-partner", [
            'delivery_partner_id' => $partner->id,
        ])->assertStatus(401);

        $customer = User::factory()->create(['user_type' => 'customer', 'is_active' => true]);
        Sanctum::actingAs($customer, ['*']);
        $this->postJson("/api/v1/admin/orders/{$order->id}/assign-delivery-partner", [
            'delivery_partner_id' => $partner->id,
        ])->assertStatus(403);
    }

    public function test_assignment_returns_not_found_for_unknown_order(): void
    {
        $admin = $this->makeAdmin();

        Sanctum::actingAs($admin, ['*']);
        $this->getJson('/api/v1/admin/orders/999999/eligible-delivery-partners')->assertStatus(404);
        $this->postJson('/api/v1/admin/orders/999999/assign-delivery-partner', [
            'delivery_partner_id' => $this->makePartner('food')->id,
        ])->assertStatus(404);
    }

    // -----------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------

    private function makeAdmin(): User
    {
        Role::updateOrCreate(['slug' => 'super_admin'], ['name' => 'Super Admin', 'is_system' => true]);
        $admin = User::factory()->create([
            'name' => 'Manual Dispatch Admin',
            'email' => 'manual-dispatch-admin@example.com',
            'user_type' => 'super_admin',
            'is_active' => true,
        ]);
        $admin->roles()->sync([Role::where('slug', 'super_admin')->first()->id]);

        return $admin;
    }

    private function makeVendor(string $type, string $name): Vendor
    {
        $user = User::factory()->create(['user_type' => 'vendor', 'is_active' => true]);
        $user->roles()->attach(Role::firstOrCreate(['slug' => 'vendor'], ['name' => 'Vendor']));

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

    private function placeFoodOrder(Vendor $vendor, string $status = 'READY'): Order
    {
        return Order::create([
            'order_number' => 'ORD_'.strtoupper(bin2hex(random_bytes(4))),
            'user_id' => User::factory()->create(['user_type' => 'customer', 'is_active' => true])->id,
            'vendor_id' => $vendor->id,
            'order_type' => 'food',
            'status' => $status,
            'timing_type' => 'instant',
            'payment_status' => 'paid',
            'payment_method' => 'cash_on_delivery',
            'subtotal' => 200,
            'delivery_fee' => 30,
            'total_amount' => 230,
        ])->fresh();
    }

    private function placeGroceryOrder(Vendor $vendor, string $status = 'READY'): Order
    {
        return Order::create([
            'order_number' => 'ORD_'.strtoupper(bin2hex(random_bytes(4))),
            'user_id' => User::factory()->create(['user_type' => 'customer', 'is_active' => true])->id,
            'vendor_id' => $vendor->id,
            'order_type' => 'grocery',
            'status' => $status,
            'timing_type' => 'instant',
            'payment_status' => 'paid',
            'payment_method' => 'cash_on_delivery',
            'subtotal' => 240,
            'delivery_fee' => 25,
            'total_amount' => 265,
        ])->fresh();
    }
}
