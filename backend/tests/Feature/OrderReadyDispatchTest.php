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

class OrderReadyDispatchTest extends TestCase
{
    use RefreshDatabase;

    private Role $vendorRole;

    protected function setUp(): void
    {
        parent::setUp();

        $this->vendorRole = Role::firstOrCreate(['slug' => 'vendor'], ['name' => 'Vendor']);
    }

    private function makeVendorUser(): User
    {
        $vendorUser = User::factory()->create(['user_type' => 'vendor', 'is_active' => true]);
        $vendorUser->roles()->attach($this->vendorRole->id);

        return $vendorUser;
    }

    private function makeFoodVendor(User $vendorUser): Vendor
    {
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

        return $vendor;
    }

    private function makeOrder(Vendor $vendor): Order
    {
        $customer = User::factory()->create(['user_type' => 'customer', 'is_active' => true]);

        return Order::create([
            'order_number' => 'ORD_'.Str::upper(Str::random(8)),
            'user_id' => $customer->id,
            'vendor_id' => $vendor->id,
            'restaurant_id' => Restaurant::where('vendor_id', $vendor->id)->value('id'),
            'order_type' => 'food',
            'status' => 'PREPARING',
            'payment_status' => 'paid',
            'payment_method' => 'cash_on_delivery',
            'subtotal' => 200,
            'delivery_fee' => 30,
            'total_amount' => 230,
        ]);
    }

    private function makeEligiblePartner(float $latitude = 12.9717, float $longitude = 77.5947): DeliveryPartner
    {
        $partnerUser = User::factory()->create(['user_type' => 'delivery_partner', 'is_active' => true]);
        $partnerUser->roles()->attach(Role::firstOrCreate(['slug' => 'delivery_partner'], ['name' => 'Delivery Partner']));

        return DeliveryPartner::create([
            'user_id' => $partnerUser->id,
            'status' => 'approved',
            'service_type' => 'food',
            'is_online' => true,
            'is_busy' => false,
            'latitude' => $latitude,
            'longitude' => $longitude,
            'last_location_at' => now(),
        ]);
    }

    public function test_marking_order_ready_creates_delivery_offer_for_eligible_partner(): void
    {
        $vendorUser = $this->makeVendorUser();
        $vendor = $this->makeFoodVendor($vendorUser);
        $partner = $this->makeEligiblePartner();
        $order = $this->makeOrder($vendor);

        Sanctum::actingAs($vendorUser, ['*']);

        $this->putJson("/api/v1/vendor/orders/{$order->id}/status", ['status' => 'ready'])
            ->assertOk();

        $this->assertSame('READY', $order->fresh()->status);

        $offer = DispatchLog::where('order_id', $order->id)
            ->where('candidate_id', $partner->id)
            ->first();

        $this->assertNotNull($offer);
        $this->assertSame('pending', $offer->status);
        $this->assertNotNull($offer->expires_at);

        $this->assertSame('food', $offer->meta['service_type'] ?? null);
        $this->assertSame((int) $order->delivery_fee, (int) ($offer->meta['estimated_earning'] ?? 0));
    }

    public function test_marking_order_ready_is_idempotent_and_does_not_duplicate_offers(): void
    {
        $vendorUser = $this->makeVendorUser();
        $vendor = $this->makeFoodVendor($vendorUser);
        $this->makeEligiblePartner();
        $order = $this->makeOrder($vendor);

        Sanctum::actingAs($vendorUser, ['*']);

        $this->putJson("/api/v1/vendor/orders/{$order->id}/status", ['status' => 'ready'])->assertOk();
        $this->putJson("/api/v1/vendor/orders/{$order->id}/status", ['status' => 'ready'])->assertOk();

        $this->assertSame(1, DispatchLog::where('order_id', $order->id)->count());
    }

    public function test_rejecting_active_offer_promotes_queued_candidate(): void
    {
        $vendorUser = $this->makeVendorUser();
        $vendor = $this->makeFoodVendor($vendorUser);
        $nearest = $this->makeEligiblePartner(12.9717, 77.5947);
        $queued = $this->makeEligiblePartner(12.9725, 77.5955);
        $order = $this->makeOrder($vendor);

        app(OrderDispatchService::class)->dispatchForOrder($order);

        $activeOffer = DispatchLog::where('order_id', $order->id)->where('candidate_id', $nearest->id)->first();
        $this->assertSame('pending', $activeOffer->status);
        $this->assertSame('sent', DispatchLog::where('order_id', $order->id)->where('candidate_id', $queued->id)->value('status'));

        Sanctum::actingAs($nearest->user, ['*']);

        $this->postJson("/api/v1/delivery-partner/orders/{$activeOffer->id}/reject")->assertOk();

        $this->assertSame('rejected', $activeOffer->fresh()->status);
        $this->assertSame('pending', DispatchLog::where('order_id', $order->id)->where('candidate_id', $queued->id)->value('status'));
        $this->assertSame(1, $nearest->fresh()->rejected_orders);
    }

    public function test_expired_offer_is_promoted_lazily_on_incoming_orders_poll(): void
    {
        $vendorUser = $this->makeVendorUser();
        $vendor = $this->makeFoodVendor($vendorUser);
        $nearest = $this->makeEligiblePartner(12.9717, 77.5947);
        $queued = $this->makeEligiblePartner(12.9725, 77.5955);
        $order = $this->makeOrder($vendor);

        app(OrderDispatchService::class)->dispatchForOrder($order);

        $activeOffer = DispatchLog::where('order_id', $order->id)->where('candidate_id', $nearest->id)->first();
        $activeOffer->update(['expires_at' => now()->subMinute()]);

        Sanctum::actingAs($nearest->user, ['*']);

        $this->getJson('/api/v1/delivery-partner/incoming-orders')->assertOk();

        $this->assertSame('expired', $activeOffer->fresh()->status);
        $this->assertSame('pending', DispatchLog::where('order_id', $order->id)->where('candidate_id', $queued->id)->value('status'));
    }

    public function test_accepting_an_expired_offer_is_rejected_with_410(): void
    {
        $vendorUser = $this->makeVendorUser();
        $vendor = $this->makeFoodVendor($vendorUser);
        $partner = $this->makeEligiblePartner();
        $order = $this->makeOrder($vendor);

        app(OrderDispatchService::class)->dispatchForOrder($order);

        $offer = DispatchLog::where('order_id', $order->id)->first();
        $offer->update(['expires_at' => now()->subMinute()]);

        Sanctum::actingAs($partner->user, ['*']);

        $this->postJson("/api/v1/delivery-partner/orders/{$offer->id}/accept")->assertStatus(410);

        $this->assertSame('expired', $offer->fresh()->status);
        $this->assertNull($order->fresh()->delivery_partner_id);
    }

    public function test_accepting_offer_returns_dispatch_log_with_order_and_active_job_exposes_it(): void
    {
        $vendorUser = $this->makeVendorUser();
        $vendor = $this->makeFoodVendor($vendorUser);
        $partner = $this->makeEligiblePartner();
        $order = $this->makeOrder($vendor);

        app(OrderDispatchService::class)->dispatchForOrder($order);

        $offer = DispatchLog::where('order_id', $order->id)->first();

        Sanctum::actingAs($partner->user, ['*']);

        $response = $this->postJson("/api/v1/delivery-partner/orders/{$offer->id}/accept")
            ->assertOk()
            ->assertJsonPath('data.order.status', 'PARTNER_ASSIGNED')
            ->assertJsonPath('data.order.id', $order->id);

        $this->assertNotNull($response->json('data.order.vendor'));

        $this->getJson('/api/v1/delivery-partner/active-job')
            ->assertOk()
            ->assertJsonPath('data.id', $order->id)
            ->assertJsonPath('data.status', 'PARTNER_ASSIGNED');
    }

    public function test_active_job_exposes_customer_name_and_phone_to_the_assigned_partner(): void
    {
        $vendor = $this->makeFoodVendor($this->makeVendorUser());
        $partner = $this->makeEligiblePartner();
        $order = $this->makeOrder($vendor);

        $order->user->update(['name' => 'Asha Verma', 'phone' => '9876501234']);

        app(OrderDispatchService::class)->dispatchForOrder($order);
        $offer = DispatchLog::where('order_id', $order->id)->first();

        Sanctum::actingAs($partner->user, ['*']);

        $this->postJson("/api/v1/delivery-partner/orders/{$offer->id}/accept")->assertOk();

        $response = $this->getJson('/api/v1/delivery-partner/active-job')->assertOk();

        $this->assertSame('Asha Verma', $response->json('data.user.name'));
        $this->assertSame('9876501234', $response->json('data.user.phone'));
        $this->assertArrayNotHasKey('email', $response->json('data.user'));
    }

    public function test_admin_marking_order_ready_creates_delivery_offer(): void
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

        $vendor = $this->makeFoodVendor($this->makeVendorUser());
        $partner = $this->makeEligiblePartner();
        $order = $this->makeOrder($vendor);

        $this->putJson('/api/v1/admin/orders/'.$order->id.'/status', ['status' => 'ready'], [
            'Authorization' => 'Bearer '.$admin->createToken('test')->plainTextToken,
        ])->assertOk();

        $this->assertSame('READY', $order->fresh()->status);
        $this->assertNotNull(
            DispatchLog::where('order_id', $order->id)->where('candidate_id', $partner->id)->first()
        );
    }

    public function test_coming_online_dispatches_nearby_unassigned_orders(): void
    {
        $vendorUser = $this->makeVendorUser();
        $vendor = $this->makeFoodVendor($vendorUser);
        $order = $this->makeOrder($vendor);

        $partnerUser = User::factory()->create(['user_type' => 'delivery_partner', 'is_active' => true]);
        $partnerUser->roles()->attach(Role::firstOrCreate(['slug' => 'delivery_partner'], ['name' => 'Delivery Partner']));
        $partner = DeliveryPartner::create([
            'user_id' => $partnerUser->id,
            'status' => 'approved',
            'service_type' => 'food',
            'is_online' => false,
            'is_busy' => false,
            'latitude' => 12.9717,
            'longitude' => 77.5947,
            'last_location_at' => now(),
        ]);

        Sanctum::actingAs($partnerUser, ['*']);

        $this->postJson('/api/v1/delivery-partner/availability')->assertOk()->assertJsonPath('data.is_online', true);

        $offer = DispatchLog::where('order_id', $order->id)
            ->where('candidate_id', $partner->id)
            ->first();

        $this->assertNotNull($offer);
        $this->assertSame('pending', $offer->status);
        $this->assertNotNull($offer->expires_at);
    }

    public function test_updating_location_while_online_dispatches_nearby_unassigned_orders(): void
    {
        $vendorUser = $this->makeVendorUser();
        $vendor = $this->makeFoodVendor($vendorUser);
        $vendor->update(['latitude' => 19.1142, 'longitude' => 72.8761]);
        Restaurant::where('vendor_id', $vendor->id)->update(['latitude' => 19.1142, 'longitude' => 72.8761]);
        $order = $this->makeOrder($vendor);

        $partner = $this->makeEligiblePartner(19.1143, 72.8762);

        Sanctum::actingAs($partner->user, ['*']);

        $this->postJson('/api/v1/delivery-partner/location', [
            'latitude' => 19.1145,
            'longitude' => 72.8764,
        ])->assertOk();

        $offer = DispatchLog::where('order_id', $order->id)
            ->where('candidate_id', $partner->id)
            ->first();

        $this->assertNotNull($offer);
        $this->assertSame('pending', $offer->status);
    }

    public function test_vendor_profile_location_update_syncs_outlets(): void
    {
        $vendorUser = $this->makeVendorUser();
        $vendor = $this->makeFoodVendor($vendorUser);

        Sanctum::actingAs($vendorUser, ['*']);

        $this->putJson('/api/v1/vendor/profile', [
            'latitude' => 19.0760,
            'longitude' => 72.8777,
        ])->assertOk();

        $this->assertSame(19.0760, (float) $vendor->fresh()->latitude);
        $this->assertSame(72.8777, (float) $vendor->fresh()->longitude);
        $this->assertSame(19.0760, (float) Restaurant::where('vendor_id', $vendor->id)->value('latitude'));
        $this->assertSame(72.8777, (float) Restaurant::where('vendor_id', $vendor->id)->value('longitude'));
    }
}
