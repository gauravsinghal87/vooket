<?php

namespace Tests\Feature;

use App\Models\DeliveryPartner;
use App\Models\Order;
use App\Models\OtpCode;
use App\Models\Role;
use App\Models\User;
use App\Models\Vendor;
use App\Models\WalletTransaction;
use App\Services\WalletService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PartnerDeliveryStatusTest extends TestCase
{
    use RefreshDatabase;

    public function test_partner_advances_order_through_delivery_steps_and_earns_delivery_fee(): void
    {
        $partner = $this->makePartner();
        $this->fundPartnerWallet($partner, 300);
        $order = $this->makeAssignedOrder($partner);

        Sanctum::actingAs($partner->user, ['*']);

        $this->postJson("/api/v1/delivery-partner/orders/{$order->id}/status", ['status' => 'picked_up'])
            ->assertOk()
            ->assertJsonPath('data.status', 'PICKED_UP');

        $this->postJson("/api/v1/delivery-partner/orders/{$order->id}/status", ['status' => 'out_for_delivery'])
            ->assertOk()
            ->assertJsonPath('data.status', 'OUT_FOR_DELIVERY');

        $this->postJson("/api/v1/delivery-partner/orders/{$order->id}/status", ['status' => 'arrived'])
            ->assertOk()
            ->assertJsonPath('data.status', 'ARRIVED');

        $this->assertNotNull($this->liveDeliveryOtp($order), 'Arrival should auto-generate a delivery OTP');

        $this->postJson("/api/v1/delivery-partner/orders/{$order->id}/confirm-payment", ['method' => 'cash'])
            ->assertOk()
            ->assertJsonPath('data.order.delivery_payment_collected_via', 'cash')
            ->assertJsonPath('data.payment.settlement', 'pending');

        $this->postJson("/api/v1/delivery-partner/orders/{$order->id}/settle-cash")
            ->assertOk()
            ->assertJsonPath('data.payment.settlement', 'settled');

        $this->postJson("/api/v1/delivery-partner/orders/{$order->id}/verify-delivery-otp", ['otp' => $this->liveDeliveryOtp($order)->otp])
            ->assertOk()
            ->assertJsonPath('data.status', 'ARRIVED');

        $this->postJson("/api/v1/delivery-partner/orders/{$order->id}/status", ['status' => 'delivered'])
            ->assertOk()
            ->assertJsonPath('data.status', 'DELIVERED');

        $freshOrder = $order->fresh();
        $freshPartner = $partner->fresh();

        $this->assertNotNull($freshOrder->picked_up_at);
        $this->assertNotNull($freshOrder->out_for_delivery_at);
        $this->assertNotNull($freshOrder->arrived_at);
        $this->assertNotNull($freshOrder->delivered_at);
        $this->assertNotNull($freshOrder->delivery_payment_collected_at);
        $this->assertNotNull($freshOrder->delivery_payment_settled_at);
        $this->assertNotNull($freshOrder->delivery_otp_verified_at);
        $this->assertSame('paid', $freshOrder->payment_status);
        $this->assertFalse($freshPartner->is_busy);
        $this->assertSame(1, $freshPartner->total_deliveries);
        $this->assertSame((float) $order->delivery_fee, (float) $freshPartner->total_earnings);

        $ledger = WalletTransaction::where('user_id', $partner->user_id)
            ->where('service', 'food')
            ->orderBy('id')
            ->get();

        $this->assertSame(['SETTLEMENT', 'EARNING'], $ledger->pluck('type')->all());
        $this->assertSame((float) $order->total_amount, (float) $ledger[0]->amount);
        $this->assertSame('debit', $ledger[0]->direction);
        $this->assertSame((float) $order->delivery_fee, (float) $ledger[1]->amount);
    }

    public function test_returns_422_when_partner_marks_delivered_before_payment_and_otp(): void
    {
        $partner = $this->makePartner();
        $this->fundPartnerWallet($partner, 300);
        $order = $this->makeAssignedOrder($partner);

        Sanctum::actingAs($partner->user, ['*']);

        $this->postJson("/api/v1/delivery-partner/orders/{$order->id}/status", ['status' => 'picked_up'])
            ->assertOk();
        $this->postJson("/api/v1/delivery-partner/orders/{$order->id}/status", ['status' => 'out_for_delivery'])
            ->assertOk();

        $this->postJson("/api/v1/delivery-partner/orders/{$order->id}/status", ['status' => 'arrived'])
            ->assertOk()
            ->assertJsonPath('data.status', 'ARRIVED');

        $this->postJson("/api/v1/delivery-partner/orders/{$order->id}/status", ['status' => 'delivered'])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Payment for this order must be collected before marking as delivered');

        $this->postJson("/api/v1/delivery-partner/orders/{$order->id}/confirm-payment", ['method' => 'cash'])
            ->assertOk();

        // With the collected cash settled, only the OTP gate remains.
        $this->postJson("/api/v1/delivery-partner/orders/{$order->id}/settle-cash")
            ->assertOk()
            ->assertJsonPath('data.payment.settlement', 'settled');

        $this->postJson("/api/v1/delivery-partner/orders/{$order->id}/status", ['status' => 'delivered'])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Customer delivery OTP must be verified before marking as delivered');

        $this->assertSame('ARRIVED', $order->fresh()->status);
    }

    public function test_returns_422_when_partner_marks_arrived_before_out_for_delivery(): void
    {
        $partner = $this->makePartner();
        $order = $this->makeAssignedOrder($partner);

        Sanctum::actingAs($partner->user, ['*']);

        $this->postJson("/api/v1/delivery-partner/orders/{$order->id}/status", ['status' => 'arrived'])
            ->assertStatus(422);

        $this->assertSame('PARTNER_ASSIGNED', $order->fresh()->status);
    }

    public function test_returns_422_when_partner_marks_delivered_before_out_for_delivery(): void
    {
        $partner = $this->makePartner();
        $order = $this->makeAssignedOrder($partner);

        Sanctum::actingAs($partner->user, ['*']);

        $this->postJson("/api/v1/delivery-partner/orders/{$order->id}/status", ['status' => 'delivered'])
            ->assertStatus(422);

        $this->assertSame('PARTNER_ASSIGNED', $order->fresh()->status);
        $this->assertSame(0, (int) $partner->fresh()->total_earnings);
    }

    public function test_returns_404_when_partner_marks_picked_up_on_order_they_are_not_assigned_to(): void
    {
        $partner = $this->makePartner();
        $vendor = $this->makeFoodVendor($this->makeVendorUser());
        $order = $this->makeOrder($vendor);
        $order->update(['status' => 'READY']);

        Sanctum::actingAs($partner->user, ['*']);

        $this->postJson("/api/v1/delivery-partner/orders/{$order->id}/status", ['status' => 'picked_up'])
            ->assertStatus(404);

        $this->assertSame('READY', $order->fresh()->status);
    }

    private function liveDeliveryOtp(Order $order): ?OtpCode
    {
        return OtpCode::where('order_id', $order->id)
            ->where('purpose', 'delivery')
            ->whereNull('used_at')
            ->where('expires_at', '>', now())
            ->latest('id')
            ->first();
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

        return $vendor;
    }

    private function makeOrder(Vendor $vendor): Order
    {
        $customer = User::factory()->create([
            'user_type' => 'customer',
            'is_active' => true,
            'phone' => '91'.substr((string) hrtime(true), -9),
        ]);

        return Order::create([
            'order_number' => 'ORD_'.Str::upper(Str::random(8)),
            'user_id' => $customer->id,
            'vendor_id' => $vendor->id,
            'order_type' => 'food',
            'status' => 'PARTNER_ASSIGNED',
            'payment_status' => 'pending',
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
            'is_busy' => true,
            'latitude' => 12.9717,
            'longitude' => 77.5947,
            'last_location_at' => now(),
        ]);
    }

    private function fundPartnerWallet(DeliveryPartner $partner, float $amount): void
    {
        app(WalletService::class)->credit(
            $partner->user,
            'delivery_partner',
            $amount,
            'TOP_UP',
            null,
            null,
            'Test funding',
            'test-funding:'.$partner->id.':'.$amount.':'.Str::random(4)
        );
    }

    private function makeAssignedOrder(DeliveryPartner $partner): Order
    {
        $vendor = $this->makeFoodVendor($this->makeVendorUser());
        $order = $this->makeOrder($vendor);
        $order->update(['delivery_partner_id' => $partner->id, 'partner_assigned_at' => now()]);

        return $order;
    }
}
