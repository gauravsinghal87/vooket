<?php

namespace Tests\Feature;

use App\Models\DeliveryPartner;
use App\Models\DispatchLog;
use App\Models\Order;
use App\Models\Role;
use App\Models\User;
use App\Models\Vendor;
use App\Services\DeliveryService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class DeliveryPartnerAuthorizationTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_assigns_partner_and_flips_offers_and_busy_flag(): void
    {
        $order = $this->makeReadyOrder();
        DispatchLog::create([
            'dispatch_type' => 'delivery',
            'order_id' => $order->id,
            'candidate_id' => 999,
            'candidate_type' => DispatchLog::CANDIDATE_TYPE_DELIVERY_PARTNER,
            'status' => DispatchLog::STATUS_PENDING,
        ]);
        $partner = $this->makePartner();
        $admin = $this->makeAdmin();

        $response = $this->actingAs($admin)
            ->putJson("/api/v1/admin/orders/{$order->id}/assign-partner", ['partner_id' => $partner->id])
            ->assertOk();

        $fresh = $order->fresh();

        $this->assertSame('PARTNER_ASSIGNED', $response->json('data.status'));
        $this->assertSame('PARTNER_ASSIGNED', $fresh->status);
        $this->assertSame($partner->id, (int) $fresh->delivery_partner_id);
        $this->assertTrue((bool) $partner->fresh()->is_busy);
        $this->assertSame(DispatchLog::STATUS_EXPIRED, DispatchLog::where('order_id', $order->id)->firstOrFail()->status);
        $this->assertDatabaseHas('order_status_histories', [
            'order_id' => $order->id,
            'new_status' => 'PARTNER_ASSIGNED',
            'changed_by_type' => 'admin',
        ]);
    }

    public function test_admin_cannot_reassign_an_order_that_already_has_a_partner(): void
    {
        $order = $this->makeReadyOrder();
        $first = $this->makePartner();
        $second = $this->makePartner();
        $admin = $this->makeAdmin();

        $this->actingAs($admin)
            ->putJson("/api/v1/admin/orders/{$order->id}/assign-partner", ['partner_id' => $first->id])
            ->assertOk();

        $this->actingAs($admin)
            ->putJson("/api/v1/admin/orders/{$order->id}/assign-partner", ['partner_id' => $second->id])
            ->assertStatus(409);

        $this->assertSame($first->id, (int) $order->fresh()->delivery_partner_id);
        $this->assertFalse((bool) $second->fresh()->is_busy);
    }

    public function test_admin_cannot_assign_a_partner_before_the_order_is_dispatchable(): void
    {
        $vendor = $this->makeFoodVendor();
        $customer = User::factory()->create(['user_type' => 'customer', 'is_active' => true]);
        $order = Order::create([
            'order_number' => 'ORD_'.Str::upper(Str::random(8)),
            'user_id' => $customer->id,
            'vendor_id' => $vendor->id,
            'order_type' => 'food',
            'status' => 'PREPARING',
            'payment_status' => 'paid',
            'payment_method' => 'cash_on_delivery',
            'subtotal' => 200,
            'delivery_fee' => 30,
            'total_amount' => 230,
        ]);
        $partner = $this->makePartner();
        $admin = $this->makeAdmin();

        $this->actingAs($admin)
            ->putJson("/api/v1/admin/orders/{$order->id}/assign-partner", ['partner_id' => $partner->id])
            ->assertStatus(409);

        $this->assertSame('PREPARING', $order->fresh()->status);
    }

    public function test_returns_403_when_vendor_tries_to_assign_a_partner(): void
    {
        $order = $this->makeReadyOrder();
        $partner = $this->makePartner();
        $vendorUser = User::factory()->create(['user_type' => 'vendor', 'is_active' => true]);
        $vendorUser->roles()->attach(Role::firstOrCreate(['slug' => 'vendor'], ['name' => 'Vendor']));

        $this->actingAs($vendorUser)
            ->putJson("/api/v1/admin/orders/{$order->id}/assign-partner", ['partner_id' => $partner->id])
            ->assertStatus(403);
    }

    public function test_partner_unaware_of_another_partners_delivery(): void
    {
        $order = $this->makeReadyOrder();
        $owner = $this->makePartner();
        $intruder = $this->makePartner();
        app(DeliveryService::class)->claimOrder($order, $owner);

        Sanctum::actingAs($intruder->user, ['*']);

        $this->postJson("/api/v1/delivery-partner/orders/{$order->id}/status", ['status' => 'picked_up'])
            ->assertNotFound();

        $this->assertSame('PARTNER_ASSIGNED', $order->fresh()->status);
    }

    private function makeAdmin(): User
    {
        $adminRole = Role::updateOrCreate(['slug' => 'super_admin'], ['name' => 'Super Admin', 'is_system' => true]);
        $admin = User::create([
            'name' => 'Assign Admin',
            'email' => 'assign@example.com',
            'phone' => '9000000099',
            'password' => Hash::make('secret'),
            'user_type' => 'super_admin',
            'is_active' => true,
        ]);
        $admin->roles()->sync([$adminRole->id]);

        return $admin;
    }

    private function makeFoodVendor(): Vendor
    {
        $vendorUser = User::factory()->create(['user_type' => 'vendor', 'is_active' => true]);
        $vendorUser->roles()->attach(Role::firstOrCreate(['slug' => 'vendor'], ['name' => 'Vendor']));

        return Vendor::create([
            'user_id' => $vendorUser->id,
            'business_name' => 'Auth Kitchen',
            'owner_name' => 'Auth Owner',
            'phone' => '9898989004',
            'vendor_type' => 'restaurant',
            'status' => 'approved',
            'is_active' => true,
            'latitude' => 12.9716,
            'longitude' => 77.5946,
        ]);
    }

    private function makeReadyOrder(): Order
    {
        $vendor = $this->makeFoodVendor();
        $customer = User::factory()->create(['user_type' => 'customer', 'is_active' => true]);

        return Order::create([
            'order_number' => 'ORD_'.Str::upper(Str::random(8)),
            'user_id' => $customer->id,
            'vendor_id' => $vendor->id,
            'order_type' => 'food',
            'status' => 'READY',
            'payment_status' => 'paid',
            'payment_method' => 'cash_on_delivery',
            'subtotal' => 200,
            'delivery_fee' => 30,
            'total_amount' => 230,
        ]);
    }

    private function makePartner(): DeliveryPartner
    {
        $partnerUser = User::factory()->create(['user_type' => 'delivery_partner', 'is_active' => true]);
        $partnerUser->roles()->attach(Role::firstOrCreate(['slug' => 'delivery_partner'], ['name' => 'Delivery Partner']));

        return DeliveryPartner::create([
            'user_id' => $partnerUser->id,
            'status' => 'approved',
            'service_type' => 'food',
            'is_online' => true,
            'is_busy' => false,
            'latitude' => 12.9717,
            'longitude' => 77.5947,
            'last_location_at' => now(),
        ]);
    }
}
