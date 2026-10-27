<?php

namespace Tests\Feature;

use App\Models\DeliveryPartner;
use App\Models\Order;
use App\Models\Role;
use App\Models\User;
use App\Models\Vendor;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class VendorOrderGuardTest extends TestCase
{
    use RefreshDatabase;

    public function test_returns_422_when_vendor_marks_out_for_delivery_on_partner_assigned_order(): void
    {
        [$vendorUser, $vendor] = $this->makeVendor();
        $order = $this->makeOrder($vendor, 'PARTNER_ASSIGNED', withPartner: true);

        Sanctum::actingAs($vendorUser, ['*']);

        $response = $this->putJson("/api/v1/vendor/orders/{$order->id}/status", ['status' => 'out_for_delivery']);

        $response->assertStatus(422);
        $this->assertSame('PARTNER_ASSIGNED', $order->fresh()->status);
    }

    public function test_vendor_can_mark_out_for_delivery_once_no_partner_is_assigned(): void
    {
        [$vendorUser, $vendor] = $this->makeVendor();
        $order = $this->makeOrder($vendor, 'OUT_FOR_DELIVERY', withPartner: false);

        $order->update(['status' => 'READY']);

        Sanctum::actingAs($vendorUser, ['*']);

        $this->putJson("/api/v1/vendor/orders/{$order->id}/status", ['status' => 'out_for_delivery'])
            ->assertOk();

        $this->assertSame('OUT_FOR_DELIVERY', $order->fresh()->status);
    }

    public function test_active_orders_default_list_includes_partner_assigned_and_picked_up(): void
    {
        [$vendorUser, $vendor] = $this->makeVendor();
        $this->makeOrder($vendor, 'READY');
        $this->makeOrder($vendor, 'PARTNER_ASSIGNED');
        $this->makeOrder($vendor, 'PICKED_UP');
        $this->makeOrder($vendor, 'DELIVERED');

        Sanctum::actingAs($vendorUser, ['*']);

        $response = $this->getJson('/api/v1/vendor/orders')->assertOk();

        $statuses = collect($response->json('data'))->pluck('status')->all();
        $this->assertEqualsCanonicalizing(['READY', 'PARTNER_ASSIGNED', 'PICKED_UP'], $statuses);
    }

    private function makeVendor(): array
    {
        $role = Role::firstOrCreate(['slug' => 'vendor'], ['name' => 'Vendor']);
        $vendorUser = User::factory()->create(['user_type' => 'vendor', 'is_active' => true]);
        $vendorUser->roles()->attach($role->id);

        $vendor = Vendor::create([
            'user_id' => $vendorUser->id,
            'business_name' => 'Spice Villa',
            'owner_name' => 'Rahul Sharma',
            'phone' => '9898989898',
            'vendor_type' => 'restaurant',
            'status' => 'approved',
            'is_active' => true,
        ]);

        return [$vendorUser, $vendor];
    }

    private function makeOrder(Vendor $vendor, string $status, bool $withPartner = false): Order
    {
        $customer = User::factory()->create(['user_type' => 'customer', 'is_active' => true]);

        $partner = null;
        if ($withPartner) {
            $partnerUser = User::factory()->create(['user_type' => 'delivery_partner', 'is_active' => true]);
            $partner = DeliveryPartner::create([
                'user_id' => $partnerUser->id,
                'status' => 'approved',
                'service_type' => 'food',
                'is_online' => true,
                'is_busy' => true,
            ]);
        }

        $order = Order::create([
            'order_number' => 'ORD_'.Str::upper(Str::random(8)),
            'user_id' => $customer->id,
            'vendor_id' => $vendor->id,
            'order_type' => 'food',
            'status' => $status,
            'payment_status' => 'paid',
            'payment_method' => 'cash_on_delivery',
            'subtotal' => 200,
            'delivery_fee' => 30,
            'total_amount' => 230,
        ]);

        if ($partner) {
            $order->update(['delivery_partner_id' => $partner->id]);
        }

        return $order;
    }
}
