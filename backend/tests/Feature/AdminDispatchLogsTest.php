<?php

namespace Tests\Feature;

use App\Models\DeliveryPartner;
use App\Models\DispatchLog;
use App\Models\Order;
use App\Models\Restaurant;
use App\Models\Role;
use App\Models\User;
use App\Models\Vendor;
use App\Services\Dispatch\OrderDispatchService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AdminDispatchLogsTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_list_dispatch_logs_with_order_and_partner(): void
    {
        $admin = $this->makeAdmin();
        [$order, $partner] = $this->makeOfferedOrder();

        Sanctum::actingAs($admin, ['*']);

        $response = $this->getJson('/api/v1/admin/dispatch-logs')->assertOk();

        $response->assertJsonPath('data.0.order.order_number', $order->order_number);
        $response->assertJsonPath('data.0.status', DispatchLog::STATUS_PENDING);
        $response->assertJsonPath('data.0.candidate_type', DispatchLog::CANDIDATE_TYPE_DELIVERY_PARTNER);
        $response->assertJsonPath('data.0.delivery_partner.user.name', $partner->user->name);
    }

    public function test_admin_can_filter_dispatch_logs_by_status(): void
    {
        $admin = $this->makeAdmin();
        [$order, $partner] = $this->makeOfferedOrder();
        DispatchLog::query()->update(['status' => DispatchLog::STATUS_REJECTED]);

        Sanctum::actingAs($admin, ['*']);

        $response = $this->getJson('/api/v1/admin/dispatch-logs?status=pending')->assertOk();

        $this->assertCount(0, $response->json('data'));
    }

    public function test_returns_403_for_non_admin_user(): void
    {
        $role = Role::firstOrCreate(['slug' => 'vendor'], ['name' => 'Vendor']);
        $vendorUser = User::factory()->create(['user_type' => 'vendor', 'is_active' => true]);
        $vendorUser->roles()->attach($role->id);

        Sanctum::actingAs($vendorUser, ['*']);

        $this->getJson('/api/v1/admin/dispatch-logs')->assertStatus(403);
    }

    private function makeAdmin(): User
    {
        $adminRole = Role::updateOrCreate(['slug' => 'super_admin'], ['name' => 'Super Admin', 'is_system' => true]);
        $admin = User::create([
            'name' => 'Dispatch Admin',
            'email' => 'dispatch@example.com',
            'phone' => '9000000009',
            'password' => Hash::make('secret'),
            'user_type' => 'super_admin',
            'is_active' => true,
        ]);
        $admin->roles()->sync([$adminRole->id]);

        return $admin;
    }

    private function makeOfferedOrder(): array
    {
        $vendorRole = Role::firstOrCreate(['slug' => 'vendor'], ['name' => 'Vendor']);
        $vendorUser = User::factory()->create(['user_type' => 'vendor', 'is_active' => true]);
        $vendorUser->roles()->attach($vendorRole->id);

        $vendor = Vendor::create([
            'user_id' => $vendorUser->id,
            'business_name' => 'Spice Villa',
            'owner_name' => 'Rahul Sharma',
            'phone' => '9898989898',
            'vendor_type' => 'restaurant',
            'status' => 'approved',
            'is_active' => true,
            'latitude' => 12.9716,
            'longitude' => 77.5946,
        ]);

        Restaurant::create([
            'vendor_id' => $vendor->id,
            'name' => 'Spice Villa',
            'slug' => 'spice-villa',
            'latitude' => 12.9716,
            'longitude' => 77.5946,
        ]);

        $customer = User::factory()->create(['user_type' => 'customer', 'is_active' => true]);

        $order = Order::create([
            'order_number' => 'ORD_'.Str::upper(Str::random(8)),
            'user_id' => $customer->id,
            'vendor_id' => $vendor->id,
            'restaurant_id' => Restaurant::where('vendor_id', $vendor->id)->value('id'),
            'order_type' => 'food',
            'status' => 'READY',
            'payment_status' => 'paid',
            'payment_method' => 'cash_on_delivery',
            'subtotal' => 200,
            'delivery_fee' => 30,
            'total_amount' => 230,
        ]);

        $partnerUser = User::factory()->create(['user_type' => 'delivery_partner', 'is_active' => true]);
        $partner = DeliveryPartner::create([
            'user_id' => $partnerUser->id,
            'status' => 'approved',
            'service_type' => 'food',
            'is_online' => true,
            'is_busy' => false,
            'latitude' => 12.9717,
            'longitude' => 77.5947,
            'last_location_at' => now(),
        ]);

        app(OrderDispatchService::class)->dispatchForOrder($order);

        return [$order, $partner];
    }
}
