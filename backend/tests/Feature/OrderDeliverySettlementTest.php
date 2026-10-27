<?php

namespace Tests\Feature;

use App\Models\Address;
use App\Models\AppSetting;
use App\Models\Cart;
use App\Models\CartItem;
use App\Models\Commission;
use App\Models\CommissionRule;
use App\Models\DeliveryPartner;
use App\Models\DeliveryPartnerEarning;
use App\Models\Inventory;
use App\Models\Order;
use App\Models\Product;
use App\Models\Role;
use App\Models\User;
use App\Models\Vendor;
use App\Services\CommissionService;
use App\Services\DeliveryService;
use App\Services\OrderService;
use App\Services\Pricing\DeliveryFeeService;
use App\Services\WalletService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OrderDeliverySettlementTest extends TestCase
{
    use RefreshDatabase;

    public function test_delivered_order_records_partner_earning_once_and_frees_partner(): void
    {
        [$order, $partner] = $this->makeDeliveredOrder();

        $earning = DeliveryPartnerEarning::where('order_id', $order->id)->firstOrFail();
        $partner = $partner->fresh();

        $this->assertSame(20, (int) $earning->amount);
        $this->assertSame('delivery', $earning->type);
        $this->assertSame('earned', $earning->status);
        $this->assertNull($earning->paid_at);
        $this->assertSame('PARTNER_ONLY', $order->fresh()->delivered_via);
        $this->assertSame(20, (int) $order->fresh()->partner_payout);
        $this->assertSame('pending', $order->fresh()->partner_payout_status);
        $this->assertNotNull($order->fresh()->delivered_at);
        $this->assertFalse($partner->is_busy);
        $this->assertSame(1, (int) $partner->total_deliveries);
        $this->assertSame(20, (int) $partner->total_earnings);
    }

    public function test_repeated_delivered_call_does_not_double_earn(): void
    {
        [$order, $partner] = $this->makeDeliveredOrder();

        $deliveryService = app(DeliveryService::class);
        $replay = $deliveryService->markDelivered($order, $partner);

        $this->assertSame($order->id, $replay->id);
        $this->assertSame(1, DeliveryPartnerEarning::where('order_id', $order->id)->count());
        $this->assertSame(20, (int) $partner->fresh()->total_earnings);
        $this->assertSame(1, (int) $partner->fresh()->total_deliveries);
    }

    public function test_delivered_order_finalizes_commission_from_commission_rule(): void
    {
        CommissionRule::create([
            'name' => 'Food 10%',
            'service' => 'food',
            'applicable_to' => 'vendor',
            'type' => 'percentage',
            'percentage_rate' => 10,
            'is_active' => true,
            'priority' => 1,
        ]);

        [$order, $partner] = $this->makeDeliveredOrder();

        $order = $order->fresh();

        /**
         * Confirmed commercial rule, documented calculation:
         *   item price 100 x 4            = 400.00 (tax-INCLUSIVE; the
         *                                    embedded 5% GST = 19.05 is
         *                                    extracted into tax_amount and
         *                                    is NOT added on top)
         *   discount                       =   0.00
         *   commission base                = 400.00 (eligible item subtotal
         *                                    after discounts; taxes, delivery
         *                                    fees and tips are excluded)
         *   commission (10%)               =  40.00
         *   net vendor payout              = 360.00
         */
        $this->assertEqualsWithDelta(19.05, (float) $order->tax_amount, 0.01);
        $this->assertEqualsWithDelta(400.0, (float) $order->subtotal, 0.01);
        $this->assertEqualsWithDelta(
            400.0 + 20.0 + round(20.0 * (float) app(DeliveryFeeService::class)->gstPercent('food') / 100, 2),
            (float) $order->total_amount,
            0.01,
            'Total = tax-inclusive subtotal + delivery fee + delivery GST (product tax is never added on top).'
        );
        $this->assertSame(40, (int) $order->commission_fee);
        $this->assertSame(360, (int) $order->net_vendor_payout);
        $this->assertSame('pending', $order->vendor_payout_status);
        $this->assertDatabaseHas('commissions', [
            'party_type' => 'vendor',
            'source_type' => 'order',
            'source_id' => $order->id,
            'commission_amount' => 40,
            'status' => 'calculated',
        ]);
        $this->assertSame(1, Commission::where('source_type', 'order')->where('source_id', $order->id)->count());
    }

    public function test_finalize_for_order_is_idempotent_for_a_delivered_order(): void
    {
        CommissionRule::create([
            'name' => 'Food 10%',
            'service' => 'food',
            'applicable_to' => 'vendor',
            'type' => 'percentage',
            'percentage_rate' => 10,
            'is_active' => true,
            'priority' => 1,
        ]);

        [$order, $partner] = $this->makeDeliveredOrder();

        app(CommissionService::class)->finalizeForOrder($order, $partner->user_id);
        app(CommissionService::class)->finalizeForOrder($order, $partner->user_id);

        $fresh = $order->fresh();
        $this->assertSame(40, (int) $fresh->commission_fee);
        $this->assertSame(360, (int) $fresh->net_vendor_payout);
        $this->assertSame(1, Commission::where('source_type', 'order')->where('source_id', $order->id)->count());
    }

    public function test_delivered_via_is_partner_only_for_cash_on_delivery(): void
    {
        [$order] = $this->makeDeliveredOrder();

        $this->assertSame('PARTNER_ONLY', $order->fresh()->delivered_via);
    }

    public function test_delivered_via_is_none_when_fully_paid_by_wallet(): void
    {
        [$order] = $this->makeDeliveredOrder(walletBalance: 1000);

        $this->assertSame('NONE', $order->fresh()->delivered_via);
    }

    public function test_delivered_via_is_delivery_fee_only_when_only_fee_remains(): void
    {
        [$order] = $this->makeDeliveredOrder(walletBalance: 420);

        $this->assertSame('DELIVERY_FEE_ONLY', $order->fresh()->delivered_via);
    }

    public function test_free_delivery_food_order_pays_the_free_distance_guarantee_with_no_base(): void
    {
        AppSetting::updateOrCreate(['key' => 'food_free_delivery_above'], [
            'label' => 'Free Delivery Above', 'value' => '500',
            'group' => 'food_delivery', 'type' => 'number', 'is_public' => true,
        ]);
        // Legacy setting: it must not participate in new earnings.
        AppSetting::updateOrCreate(['key' => 'food_partner_base_fee'], [
            'label' => 'Food Partner Base Fee', 'value' => '30',
            'group' => 'partner_delivery', 'type' => 'number', 'is_public' => false,
        ]);
        AppSetting::updateOrCreate(['key' => 'food_delivery_fee_paid_by_admin_per_km'], [
            'label' => 'Food Admin Funded Fee per KM', 'value' => '5',
            'group' => 'partner_delivery', 'type' => 'number', 'is_public' => false,
        ]);

        [$order, $partner] = $this->makeDeliveredFreeOrder();

        $order = $order->fresh();
        $earning = DeliveryPartnerEarning::where('order_id', $order->id)->firstOrFail();

        $distance = app(DeliveryFeeService::class)->distanceKm(12.9716, 77.5946, 12.9800, 77.6000);
        // The drop is inside the 2 km free allowance, so the partner is paid the
        // fixed free-distance guarantee and nothing distance-based on top.
        $expected = round((float) AppSetting::where('key', 'food_partner_free_distance_earning')->value('value'), 2);

        $this->assertSame(0, (int) $order->delivery_fee);
        $this->assertEquals($expected, (float) $earning->amount);
        $this->assertSame('delivery', $earning->type);
        $this->assertSame('earned', $earning->status);
        $this->assertEquals($expected, (float) $order->partner_payout);
        $this->assertEquals($expected, (float) $partner->fresh()->total_earnings);
        $this->assertSame('customer_delivery_fee_plus_free_distance_earning', $earning->meta['earning_basis']);
        $this->assertEquals($expected, (float) $earning->meta['earning_breakdown']['platform_funded']);
        $this->assertSame(0, (int) $earning->meta['earning_breakdown']['customer_delivery_fee']);
        $this->assertSame(0.0, (float) $earning->meta['earning_breakdown']['additional_distance_km']);
        $this->assertSame(0.0, (float) $earning->meta['earning_breakdown']['additional_admin_earning']);
        $this->assertLessThanOrEqual(
            2.0,
            (float) $earning->meta['earning_breakdown']['free_distance_km'],
            'The whole trip sits inside the free-delivery allowance.'
        );
        $this->assertArrayNotHasKey('base', $earning->meta['earning_breakdown']);
    }

    public function test_grocery_partner_earning_uses_the_admin_funded_per_km_rate(): void
    {
        $user = $this->makeCustomer('9100000303');

        Address::create([
            'user_id' => $user->id,
            'label' => 'Home',
            'contact_name' => 'Customer 9100000303',
            'contact_phone' => '9100000303',
            'address_line_1' => '12, Main Road',
            'city' => 'Bengaluru',
            'state' => 'Karnataka',
            'postal_code' => '560001',
            'country' => 'IN',
            'latitude' => 12.9800,
            'longitude' => 77.6000,
            'type' => 'home',
            'is_default' => true,
        ]);

        $this->makeCartWithProduct($user, deliveryFee: 25);

        $addressId = $user->addresses()->value('id');
        $order = $this->checkout($user, 'cash_on_delivery', (int) $addressId);
        $order->update(['order_type' => 'grocery']);
        $order->update(['status' => 'READY']);

        $partner = $this->makePartner();
        $partner->update(['service_type' => 'grocery']);
        $order = app(DeliveryService::class)->claimOrder($order->fresh(), $partner);
        app(DeliveryService::class)->markPickedUp($order, $partner);
        app(DeliveryService::class)->markOutForDelivery($order, $partner);
        app(DeliveryService::class)->markArrived($order, $partner);

        // Satisfy the grocery delivery gate: cash collected + settled and the
        // delivery OTP verified (mirrors the partner API steps).
        $order->update([
            'delivery_payment_collected_at' => now(),
            'delivery_payment_collected_via' => 'cash',
            'delivery_payment_settled_at' => now(),
            'delivery_otp_verified_at' => now(),
        ]);

        app(DeliveryService::class)->markDelivered($order, $partner);

        $order = $order->fresh();
        $earning = DeliveryPartnerEarning::where('order_id', $order->id)->firstOrFail();

        $distance = app(DeliveryFeeService::class)->distanceKm(12.9716, 77.5946, 12.9800, 77.6000);
        // This drop is ~1.13 km, inside the 2 km free radius, so the customer pays
        // nothing and the partner is paid the fixed free-distance guarantee. The
        // Admin-funded per-km rate only funds distance beyond that allowance.
        $guarantee = round((float) AppSetting::where('key', 'grocery_partner_free_distance_earning')->value('value'), 2);
        $freeKm = (float) AppSetting::where('key', 'grocery_free_delivery_km')->value('value');
        $expected = round($guarantee + max(0.0, round($distance - $freeKm, 4)) * 5, 2);

        // The partner is paid the guaranteed free-distance earning, with no base
        // fee, and the per-km rate applies only beyond the free allowance.
        $this->assertSame(0, (int) $order->delivery_fee);
        $this->assertEquals($expected, (float) $earning->amount);
        $this->assertEquals($expected, (float) $order->partner_payout);
        $this->assertSame('customer_delivery_fee_plus_free_distance_earning', $earning->meta['earning_basis']);
        $this->assertSame(
            'grocery_delivery_fee_paid_by_admin_per_km',
            $earning->meta['earning_breakdown']['per_km_key']
        );
        $this->assertSame(
            'grocery_partner_free_distance_earning',
            $earning->meta['earning_breakdown']['first_distance_earning_key']
        );
    }

    /**
     * The reported regression: a short, free-to-the-customer delivery must not
     * produce a near-zero partner earning, and the Admin-funded per-km rate must
     * only ever fund the distance beyond the free allowance.
     */
    public function test_partner_earning_guarantees_the_free_distance_and_only_funds_the_excess(): void
    {
        $service = 'food';

        $this->setPartnerSetting($service, 'free_delivery_km', '2');
        $this->setPartnerSetting($service, 'partner_free_distance_earning', '20');
        $this->setPartnerSetting($service, 'delivery_fee_paid_by_admin_per_km', '5');

        $feeService = app(DeliveryFeeService::class);

        // Inside the free allowance the partner always earns the fixed guarantee,
        // never a distance-pro-rated amount, and the customer pays nothing.
        foreach ([0.02, 0.57, 1.0, 1.99, 2.0] as $distance) {
            $earning = $feeService->partnerEarning($service, $distance, 0.0);

            $this->assertEqualsWithDelta(20.0, $earning['amount'], 0.001, "Distance {$distance} km");
            $this->assertSame(0.0, $earning['breakdown']['additional_distance_km']);
            $this->assertSame(0.0, $earning['breakdown']['additional_admin_earning']);
            $this->assertSame(0.0, $feeService->calculate($service, 299.0, $distance));
        }

        // Beyond the allowance the guarantee is joined by the Admin-funded excess
        // only, so the first 2 km are never funded twice.
        $earning = $feeService->partnerEarning($service, 4.67, 13.35);
        $this->assertEqualsWithDelta(13.35 + 20 + (2.67 * 5), $earning['amount'], 0.001);
        $this->assertSame(2.67, $earning['breakdown']['additional_distance_km']);
        $this->assertEqualsWithDelta(13.35, $earning['breakdown']['additional_admin_earning'], 0.001);

        // Food and Grocery guarantees are configured independently.
        $this->setPartnerSetting('grocery', 'partner_free_distance_earning', '35');
        $this->setPartnerSetting('grocery', 'free_delivery_km', '2');
        $this->setPartnerSetting('grocery', 'delivery_fee_paid_by_admin_per_km', '5');

        $this->assertEqualsWithDelta(35.0, $feeService->partnerEarning('grocery', 0.57, 0.0)['amount'], 0.001);
        $this->assertEqualsWithDelta(20.0, $feeService->partnerEarning($service, 0.57, 0.0)['amount'], 0.001);
    }

    private function setPartnerSetting(string $service, string $suffix, string $value): void
    {
        AppSetting::updateOrCreate(['key' => $service.'_'.$suffix], [
            'label' => $suffix,
            'value' => $value,
            'group' => $service.'_delivery',
            'type' => 'number',
            'is_public' => true,
        ]);
    }

    private function makeDeliveredOrder(float $walletBalance = 0.0, string $paymentMethod = 'cash_on_delivery'): array
    {
        $user = $this->makeCustomer('9100000301');
        $this->makeCartWithProduct($user);

        if ($walletBalance > 0) {
            app(WalletService::class)->credit($user, 'customer', $walletBalance, 'CREDIT', null, null, 'Test credit');
            $paymentMethod = 'wallet';
        }

        $order = $this->checkout($user, $paymentMethod);
        $order->update(['status' => 'READY']);

        $partner = $this->makePartner();
        $order = app(DeliveryService::class)->claimOrder($order->fresh(), $partner);
        app(DeliveryService::class)->markPickedUp($order, $partner);
        app(DeliveryService::class)->markOutForDelivery($order, $partner);
        app(DeliveryService::class)->markArrived($order, $partner);

        // Satisfy the food delivery gate: payment collected + delivery OTP
        // verified (mirrors the partner API payment + OTP steps).
        $order->update([
            'delivery_payment_collected_at' => now(),
            'delivery_payment_collected_via' => 'cash',
            'delivery_payment_settled_at' => now(),
            'delivery_otp_verified_at' => now(),
        ]);

        app(DeliveryService::class)->markDelivered($order, $partner);

        return [$order, $partner];
    }

    private function makeDeliveredFreeOrder(): array
    {
        $user = $this->makeCustomer('9100000302');

        Address::create([
            'user_id' => $user->id,
            'label' => 'Home',
            'contact_name' => 'Customer 9100000302',
            'contact_phone' => '9100000302',
            'address_line_1' => '12, Main Road',
            'city' => 'Bengaluru',
            'state' => 'Karnataka',
            'postal_code' => '560001',
            'country' => 'IN',
            'latitude' => 12.9800,
            'longitude' => 77.6000,
            'type' => 'home',
            'is_default' => true,
        ]);

        $this->makeCartWithProduct($user, unitPrice: 125);

        $addressId = $user->addresses()->value('id');
        $order = $this->checkout($user, 'cash_on_delivery', (int) $addressId);
        $order->update(['status' => 'READY']);

        $partner = $this->makePartner();
        $order = app(DeliveryService::class)->claimOrder($order->fresh(), $partner);
        app(DeliveryService::class)->markPickedUp($order, $partner);
        app(DeliveryService::class)->markOutForDelivery($order, $partner);
        app(DeliveryService::class)->markArrived($order, $partner);

        $order->update([
            'delivery_payment_collected_at' => now(),
            'delivery_payment_collected_via' => 'cash',
            'delivery_payment_settled_at' => now(),
            'delivery_otp_verified_at' => now(),
        ]);

        app(DeliveryService::class)->markDelivered($order, $partner);

        return [$order, $partner];
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

    private function makeCartWithProduct(User $user, float $deliveryFee = 20, float $unitPrice = 100): void
    {
        $vendorUser = User::factory()->create(['user_type' => 'vendor', 'is_active' => true]);
        $vendorUser->roles()->attach(Role::firstOrCreate(['slug' => 'vendor'], ['name' => 'Vendor']));
        $vendor = Vendor::create([
            'user_id' => $vendorUser->id,
            'business_name' => 'Settle Kitchen',
            'owner_name' => 'Settle Owner',
            'phone' => '9898989003',
            'vendor_type' => 'restaurant',
            'status' => 'approved',
            'is_active' => true,
            'latitude' => 12.9716,
            'longitude' => 77.5946,
        ]);

        $product = Product::create([
            'vendor_id' => $vendor->id,
            'name' => 'Settle Burger '.uniqid('p', true),
            'slug' => 'settle-burger-'.uniqid('s', true),
            'sku' => 'SKU_SETTLE_'.uniqid(),
            'price' => $unitPrice,
            'type' => 'food',
            'tax_rate' => 5,
            'is_active' => true,
            'is_available' => true,
        ]);

        Inventory::create([
            'vendor_id' => $vendor->id,
            'product_id' => $product->id,
            'quantity' => 20,
            'reserved_quantity' => 0,
            'low_stock_threshold' => 5,
            'track_inventory' => true,
        ]);

        $cart = Cart::create([
            'user_id' => $user->id,
            'cart_type' => 'food',
            'vendor_id' => $vendor->id,
            'subtotal' => 0,
            'discount' => 0,
            'tax' => 0,
            'delivery_fee' => $deliveryFee,
            'total' => 0,
            'items_count' => 0,
        ]);

        CartItem::create([
            'cart_id' => $cart->id,
            'product_id' => $product->id,
            'unit_price' => $product->price,
            'quantity' => 4,
            'line_total' => round($product->price * 4, 2),
        ]);
    }

    private function checkout(User $user, string $paymentMethod, ?int $addressId = null): Order
    {
        return app(OrderService::class)->createOrder($user, [
            'order_type' => 'food',
            'payment_method' => $paymentMethod,
            'address_id' => $addressId,
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
