<?php

namespace Tests\Feature;

use App\Models\AppSetting;
use App\Models\DeliveryPartner;
use App\Models\DispatchLog;
use App\Models\Order;
use App\Models\Role;
use App\Models\User;
use App\Models\Vendor;
use App\Services\DeliveryService;
use App\Services\Pricing\DeliveryFeeService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use ReflectionMethod;
use Tests\TestCase;

class DispatchServiceIsolationTest extends TestCase
{
    use RefreshDatabase;

    private function partnerUser(): User
    {
        $user = User::factory()->create(['user_type' => 'delivery_partner', 'is_active' => true]);
        $user->roles()->attach(Role::firstOrCreate(['slug' => 'delivery_partner'], ['name' => 'Delivery Partner']));

        return $user;
    }

    public function test_grocery_delivery_partner_cannot_accept_a_food_order(): void
    {
        $foodOrder = Order::create([
            'order_number' => 'ORD-FOO-X',
            'user_id' => User::factory()->create()->id,
            'order_type' => 'food',
            'status' => 'READY',
            'payment_status' => 'paid',
            'payment_method' => 'cash_on_delivery',
            'subtotal' => 100,
            'delivery_fee' => 20,
            'total_amount' => 120,
        ]);

        $groceryUser = $this->partnerUser();
        $groceryPartner = DeliveryPartner::create([
            'user_id' => $groceryUser->id,
            'status' => 'approved',
            'service_type' => 'grocery',
            'is_online' => true,
            'is_busy' => false,
        ]);

        $offer = DispatchLog::create([
            'dispatch_type' => 'delivery',
            'order_id' => $foodOrder->id,
            'candidate_id' => $groceryPartner->id,
            'candidate_type' => DispatchLog::CANDIDATE_TYPE_DELIVERY_PARTNER,
            'status' => DispatchLog::STATUS_PENDING,
            'expires_at' => now()->addMinutes(5),
        ]);

        Sanctum::actingAs($groceryUser, ['*']);

        $response = $this->postJson("/api/v1/delivery-partner/orders/{$offer->id}/accept");

        $response->assertStatus(403);
        $this->assertStringContainsString('Food delivery requests cannot be accepted', $response->json('message'));
        $this->assertStringContainsString('grocery delivery partner', $response->json('message'));
        $this->assertNull($foodOrder->fresh()->delivery_partner_id);
    }

    public function test_food_delivery_partner_cannot_accept_a_grocery_order(): void
    {
        $groceryOrder = Order::create([
            'order_number' => 'ORD-GRO-Y',
            'user_id' => User::factory()->create()->id,
            'order_type' => 'grocery',
            'status' => 'READY',
            'payment_status' => 'paid',
            'payment_method' => 'cash_on_delivery',
            'subtotal' => 100,
            'delivery_fee' => 20,
            'total_amount' => 120,
        ]);

        $foodUser = $this->partnerUser();
        $foodPartner = DeliveryPartner::create([
            'user_id' => $foodUser->id,
            'status' => 'approved',
            'service_type' => 'food',
            'is_online' => true,
            'is_busy' => false,
        ]);

        $offer = DispatchLog::create([
            'dispatch_type' => 'delivery',
            'order_id' => $groceryOrder->id,
            'candidate_id' => $foodPartner->id,
            'candidate_type' => DispatchLog::CANDIDATE_TYPE_DELIVERY_PARTNER,
            'status' => DispatchLog::STATUS_PENDING,
            'expires_at' => now()->addMinutes(5),
        ]);

        Sanctum::actingAs($foodUser, ['*']);

        $response = $this->postJson("/api/v1/delivery-partner/orders/{$offer->id}/accept");

        $response->assertStatus(403);
        $this->assertStringContainsString('Grocery delivery requests cannot be accepted', $response->json('message'));
        $this->assertStringContainsString('food delivery partner', $response->json('message'));
        $this->assertNull($groceryOrder->fresh()->delivery_partner_id);
    }

    public function test_matching_food_delivery_partner_can_accept_a_food_order(): void
    {
        $foodOrder = Order::create([
            'order_number' => 'ORD-FOO-Z',
            'user_id' => User::factory()->create()->id,
            'order_type' => 'food',
            'status' => 'READY',
            'payment_status' => 'paid',
            'payment_method' => 'cash_on_delivery',
            'subtotal' => 100,
            'delivery_fee' => 20,
            'total_amount' => 120,
        ]);

        $foodUser = $this->partnerUser();
        $foodPartner = DeliveryPartner::create([
            'user_id' => $foodUser->id,
            'status' => 'approved',
            'service_type' => 'food',
            'is_online' => true,
            'is_busy' => false,
            'latitude' => 12.9717,
            'longitude' => 77.5947,
        ]);

        $offer = DispatchLog::create([
            'dispatch_type' => 'delivery',
            'order_id' => $foodOrder->id,
            'candidate_id' => $foodPartner->id,
            'candidate_type' => DispatchLog::CANDIDATE_TYPE_DELIVERY_PARTNER,
            'status' => DispatchLog::STATUS_PENDING,
            'expires_at' => now()->addMinutes(5),
        ]);

        Sanctum::actingAs($foodUser, ['*']);

        $response = $this->postJson("/api/v1/delivery-partner/orders/{$offer->id}/accept");

        $response->assertStatus(200);
        $this->assertSame($foodPartner->id, $foodOrder->fresh()->delivery_partner_id);
        $this->assertSame(DispatchLog::STATUS_ACCEPTED, $offer->fresh()->status);
    }

    public function test_accepting_over_http_freezes_the_earning_and_ignores_later_rate_changes(): void
    {
        AppSetting::updateOrCreate(['key' => 'food_delivery_fee_paid_by_admin_per_km'], [
            'label' => 'Food Admin Funded Fee per KM', 'value' => '11',
            'group' => 'partner_delivery', 'type' => 'number', 'is_public' => false,
        ]);
        // A legacy base fee must never reach a new earning.
        AppSetting::updateOrCreate(['key' => 'food_partner_base_fee'], [
            'label' => 'Food Partner Base Fee', 'value' => '30',
            'group' => 'partner_delivery', 'type' => 'number', 'is_public' => false,
        ]);

        $vendor = Vendor::create([
            'user_id' => User::factory()->create()->id,
            'business_name' => 'Snapshot Vendor',
            'vendor_type' => 'restaurant',
            'owner_name' => 'Snapshot Owner',
            'phone' => '9898989111',
            'is_active' => true,
            'status' => 'approved',
            'latitude' => 12.9716,
            'longitude' => 77.5946,
        ]);

        $order = Order::create([
            'order_number' => 'ORD-FOO-SNAP',
            'user_id' => User::factory()->create()->id,
            'order_type' => 'food',
            'status' => 'READY',
            'payment_status' => 'paid',
            'payment_method' => 'cash_on_delivery',
            'subtotal' => 100,
            'delivery_fee' => 13.35,
            'total_amount' => 113.35,
            'vendor_id' => $vendor->id,
            'delivery_address_snapshot' => [
                'address' => 'Drop', 'latitude' => 13.01, 'longitude' => 77.62,
            ],
        ]);

        $user = $this->partnerUser();
        $partner = DeliveryPartner::create([
            'user_id' => $user->id,
            'status' => 'approved',
            'service_type' => 'food',
            'is_online' => true,
            'is_busy' => false,
            'latitude' => 12.9717,
            'longitude' => 77.5947,
        ]);

        // Offer meta carries the authoritative expected earning.
        $distance = app(DeliveryFeeService::class)->orderDeliveryDistanceKm($order);
        $expected = round(13.35 + 11 * round($distance, 2), 2);

        $offer = DispatchLog::create([
            'dispatch_type' => 'delivery',
            'order_id' => $order->id,
            'candidate_id' => $partner->id,
            'candidate_type' => DispatchLog::CANDIDATE_TYPE_DELIVERY_PARTNER,
            'status' => DispatchLog::STATUS_PENDING,
            'expires_at' => now()->addMinutes(5),
            'meta' => [
                'estimated_earning' => $expected,
                'estimated_partner_earning' => $expected,
                'earning_breakdown' => [
                    'customer_delivery_fee' => 13.35,
                    'distance_earning' => round(11 * round($distance, 2), 2),
                ],
            ],
        ]);

        Sanctum::actingAs($user, ['*']);
        $this->postJson("/api/v1/delivery-partner/orders/{$offer->id}/accept")->assertStatus(200);

        // The snapshot must be taken on the real HTTP accept path.
        $meta = $order->fresh()->meta;
        $meta = is_array($meta) ? $meta : json_decode($meta, true);
        $this->assertArrayHasKey('accepted_partner_earning', $meta);
        $this->assertEquals($expected, (float) $meta['accepted_partner_earning']['amount']);

        // Raising the rate afterwards must not change the accepted figure.
        AppSetting::where('key', 'food_delivery_fee_paid_by_admin_per_km')->update(['value' => '99']);

        $resolve = new ReflectionMethod(DeliveryService::class, 'resolvePartnerEarning');
        $resolve->setAccessible(true);
        $this->assertEquals($expected, (float) $resolve->invoke(app(DeliveryService::class), $order->fresh())['amount']);
    }
}
