<?php

namespace Tests\Feature;

use App\Models\DeliveryPartner;
use App\Models\DispatchLog;
use App\Models\Order;
use App\Models\Restaurant;
use App\Models\Role;
use App\Models\User;
use App\Models\Vendor;
use App\Services\DeliveryService;
use App\Services\Dispatch\OrderDispatchService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class OrderLiveTrackingTest extends TestCase
{
    use RefreshDatabase;

    public function test_customer_can_fetch_live_tracking_snapshot_for_own_assigned_order(): void
    {
        [$vendor, $order, $partner, $offer] = $this->makeDispatchedOrderOffer();

        Sanctum::actingAs($partner->user, ['*']);

        $this->postJson("/api/v1/delivery-partner/orders/{$offer->id}/accept")->assertOk();

        Sanctum::actingAs($order->user, ['*']);

        $this->getJson("/api/v1/orders/{$order->id}/tracking")
            ->assertOk()
            ->assertJsonPath('data.order.status', 'PARTNER_ASSIGNED')
            ->assertJsonPath('data.tracking.enabled', true)
            ->assertJsonPath('data.tracking.in_progress', true)
            ->assertJsonPath('data.location.lat', (float) $partner->latitude)
            ->assertJsonPath('data.location.is_stale', false)
            ->assertJsonStructure([
                'data' => [
                    'order' => ['id', 'order_number', 'status', 'pickup', 'dropoff'],
                    'partner' => ['id', 'name', 'phone', 'vehicle_number'],
                    'location' => ['lat', 'lng', 'heading', 'speed', 'accuracy', 'recorded_at', 'is_stale'],
                    'route' => ['polyline', 'distance_km', 'duration_min', 'status'],
                    'eta',
                    'tracking' => ['enabled', 'in_progress', 'source', 'last_updated_at', 'location_stale'],
                ],
            ]);

        $response = $this->getJson("/api/v1/orders/{$order->id}/tracking")->assertOk();
        $this->assertNotNull($response->json('data.eta'));
        $this->assertNotNull($response->json('data.order.dropoff.address'));
        $this->assertNotNull($response->json('data.partner.vehicle_number'));
        $this->assertStringEndsWith('1234', (string) $response->json('data.partner.vehicle_number'));
    }

    public function test_tracking_exposes_assigned_partner_contact_number(): void
    {
        [$vendor, $order, $partner] = $this->makeAssignedOrderWithPartner();

        $partner->user->update(['phone' => '9876500001']);

        Sanctum::actingAs($order->user, ['*']);

        $this->getJson("/api/v1/orders/{$order->id}/tracking")
            ->assertOk()
            ->assertJsonPath('data.partner.phone', '9876500001');
    }

    public function test_tracking_partner_phone_is_null_when_not_on_file(): void
    {
        [$vendor, $order, $partner] = $this->makeAssignedOrderWithPartner();

        $partner->user->update(['phone' => null]);

        Sanctum::actingAs($order->user, ['*']);

        $this->getJson("/api/v1/orders/{$order->id}/tracking")
            ->assertOk()
            ->assertJsonPath('data.partner.phone', null);
    }

    public function test_other_customer_cannot_fetch_someone_elses_tracking(): void
    {
        [$vendor, $order, $partner] = $this->makeAssignedOrderWithPartner();
        $stranger = User::factory()->create(['user_type' => 'customer', 'is_active' => true]);

        Sanctum::actingAs($stranger, ['*']);

        $this->getJson("/api/v1/orders/{$order->id}/tracking")->assertStatus(404);
    }

    public function test_partner_location_update_persists_heading_speed_accuracy_for_tracking(): void
    {
        [$vendor, $order, $partner] = $this->makeAssignedOrderWithPartner();

        Sanctum::actingAs($partner->user, ['*']);

        $this->postJson('/api/v1/delivery-partner/location', [
            'latitude' => 12.9718,
            'longitude' => 77.5949,
            'heading' => 90,
            'speed' => 12.5,
            'accuracy' => 6,
        ])->assertOk()->assertJsonPath('data.is_stale', false);

        $fresh = $partner->fresh();
        $this->assertSame(90.0, (float) $fresh->heading);
        $this->assertSame(12.5, (float) $fresh->speed);
        $this->assertSame(6.0, (float) $fresh->accuracy);

        Sanctum::actingAs($order->user, ['*']);

        $response = $this->getJson("/api/v1/orders/{$order->id}/tracking")->assertOk();
        $this->assertSame(12.9718, (float) $response->json('data.location.lat'));
        $this->assertSame(77.5949, (float) $response->json('data.location.lng'));
        $this->assertSame(90.0, (float) $response->json('data.location.heading'));
        $this->assertSame(12.5, (float) $response->json('data.location.speed'));
        $this->assertSame(6.0, (float) $response->json('data.location.accuracy'));
        $this->assertFalse($response->json('data.location.is_stale'));
    }

    public function test_location_update_with_implausible_jump_is_rejected_and_ignored(): void
    {
        [$vendor, $order, $partner] = $this->makeAssignedOrderWithPartner();

        Sanctum::actingAs($partner->user, ['*']);

        $this->postJson('/api/v1/delivery-partner/location', [
            'latitude' => 55.7558,
            'longitude' => 37.6173,
        ])->assertStatus(422);

        $this->assertSame((float) $partner->latitude, (float) $partner->fresh()->latitude);
        $this->assertSame((float) $partner->longitude, (float) $partner->fresh()->longitude);
    }

    public function test_stale_partner_location_is_flagged_in_tracking_payload(): void
    {
        [$vendor, $order, $partner] = $this->makeAssignedOrderWithPartner();

        $partner->update(['last_location_at' => now()->subMinutes(5)]);

        Sanctum::actingAs($order->user, ['*']);

        $this->getJson("/api/v1/orders/{$order->id}/tracking")
            ->assertOk()
            ->assertJsonPath('data.location.is_stale', true)
            ->assertJsonPath('data.tracking.location_stale', true);
    }

    public function test_delivered_order_has_tracking_disabled_and_no_eta(): void
    {
        [$vendor, $order, $partner] = $this->makeAssignedOrderWithPartner();

        Sanctum::actingAs($partner->user, ['*']);

        foreach (['picked_up', 'out_for_delivery', 'arrived', 'delivered'] as $status) {
            $this->postJson("/api/v1/delivery-partner/orders/{$order->id}/status", ['status' => $status])->assertOk();
        }

        Sanctum::actingAs($order->user, ['*']);

        $this->getJson("/api/v1/orders/{$order->id}/tracking")
            ->assertOk()
            ->assertJsonPath('data.order.status', 'DELIVERED')
            ->assertJsonPath('data.tracking.enabled', false)
            ->assertJsonPath('data.tracking.in_progress', false);
        $this->assertSame(null, $this->getJson("/api/v1/orders/{$order->id}/tracking")->json('data.eta'));
    }

    private function makeVendorUser(): User
    {
        $role = Role::firstOrCreate(['slug' => 'vendor'], ['name' => 'Vendor']);
        $vendorUser = User::factory()->create(['user_type' => 'vendor', 'is_active' => true]);
        $vendorUser->roles()->attach($role->id);

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
            'delivery_address_snapshot' => [
                'address_line_1' => 'MG Road',
                'city' => 'Bengaluru',
                'state' => 'Karnataka',
                'postal_code' => '560001',
                'latitude' => 12.9758,
                'longitude' => 77.6033,
            ],
        ]);
    }

    private function makeEligiblePartner(): DeliveryPartner
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
            'vehicle_number' => 'KA01AB1234',
        ]);
    }

    /**
     * Dispatch an offer for a prepared order (order NOT yet assigned).
     *
     * @return array{Vendor, Order, DeliveryPartner, DispatchLog}
     */
    private function makeDispatchedOrderOffer(): array
    {
        $vendor = $this->makeFoodVendor($this->makeVendorUser());
        $order = $this->makeOrder($vendor);
        $partner = $this->makeEligiblePartner();

        app(OrderDispatchService::class)->dispatchForOrder($order);

        $offer = DispatchLog::where('order_id', $order->id)->first();
        $this->assertNotNull($offer);

        return [$vendor, $order, $partner, $offer];
    }

    /**
     * An order already claimed by its partner (all tracking tests that do not
     * exercise the accept flow use this to get a live, assigned order).
     *
     * @return array{Vendor, Order, DeliveryPartner}
     */
    private function makeAssignedOrderWithPartner(): array
    {
        [$vendor, $order, $partner] = $this->makeDispatchedOrderOffer();

        $order->update(['status' => 'READY']);
        app(DeliveryService::class)->claimOrder($order, $partner);

        // The delivery gate requires an OTP verification before the
        // delivered transition; tracking tests only exercise the payload.
        $order->update(['delivery_otp_verified_at' => now()]);

        return [$vendor, $order, $partner];
    }
}
