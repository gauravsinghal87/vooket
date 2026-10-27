<?php

namespace Tests\Feature;

use App\Models\Cart;
use App\Models\CartItem;
use App\Models\Coupon;
use App\Models\CouponUsage;
use App\Models\Order;
use App\Models\Product;
use App\Models\Role;
use App\Models\User;
use App\Models\Vendor;
use App\Services\CouponService;
use App\Services\OrderService;
use App\Services\PaymentService;
use App\Support\Money;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use RuntimeException;
use Tests\TestCase;

class CouponSecurityTest extends TestCase
{
    use RefreshDatabase;

    private function makeUser(string $phone, string $type = 'customer'): User
    {
        return User::create(['name' => 'Customer '.$phone, 'phone' => $phone, 'user_type' => $type, 'is_active' => true]);
    }

    private function makeVendor(string $phone = '9000000100'): Vendor
    {
        $merchant = $this->makeUser($phone, 'vendor');

        return Vendor::create([
            'user_id' => $merchant->id,
            'business_name' => 'Test Kitchen',
            'vendor_type' => 'restaurant',
            'owner_name' => $merchant->name,
            'phone' => $phone,
            'status' => 'approved',
        ]);
    }

    private function makeProduct(Vendor $vendor, float $price = 100.0, array $extra = []): Product
    {
        $uniq = uniqid('sku', true);

        return Product::create(array_merge([
            'vendor_id' => $vendor->id,
            'name' => 'Burger '.$uniq,
            'slug' => 'burger-'.str_replace(['.', ' '], '-', $uniq),
            'sku' => $uniq,
            'price' => $price,
            'type' => 'food',
            'tax_rate' => 5,
            'is_active' => true,
            'is_available' => true,
        ], $extra));
    }

    private function makeCartWithProduct(User $user, Vendor $vendor, int $quantity = 4): Cart
    {
        $product = $this->makeProduct($vendor);

        $cart = Cart::create([
            'user_id' => $user->id,
            'cart_type' => 'food',
            'vendor_id' => $vendor->id,
            'subtotal' => 0,
            'discount' => 0,
            'tax' => 0,
            'delivery_fee' => 20,
            'total' => 0,
            'items_count' => 0,
        ]);

        CartItem::create([
            'cart_id' => $cart->id,
            'product_id' => $product->id,
            'unit_price' => $product->price,
            'quantity' => $quantity,
            'line_total' => round($product->price * $quantity, 2),
        ]);

        $cart->update(['subtotal' => round($product->price * $quantity, 2)]);

        return $cart;
    }

    private function makeCoupon(array $attr = []): Coupon
    {
        return Coupon::create(array_merge([
            'code' => strtoupper(uniqid('SAVE', false)),
            'name' => 'Test coupon',
            'type' => 'percentage',
            'value' => '20',
            'max_discount' => '100',
            'min_order_amount' => '50',
            'service' => 'food',
            'is_active' => true,
            'status' => 'active',
        ], $attr));
    }

    private function checkout(User $user, array $data = []): Order
    {
        return app(OrderService::class)->createOrder($user, array_merge([
            'order_type' => 'food',
            'payment_method' => 'cash_on_delivery',
        ], $data));
    }

    public function test_1_valid_coupon_applies_single_discount_and_records_redemption(): void
    {
        $user = $this->makeUser('9100000001');
        $vendor = $this->makeVendor();
        $coupon = $this->makeCoupon();
        $cart = $this->makeCartWithProduct($user, $vendor); // subtotal 400

        $cart->update(['coupon_code' => $coupon->code]);

        $order = $this->checkout($user);

        $this->assertSame($coupon->code, $order->coupon_code);
        $this->assertSame('80.00', $order->coupon_discount);
        $this->assertSame('80.00', $order->discount_amount);
        $this->assertDatabaseHas('coupon_usages', [
            'coupon_id' => $coupon->id,
            'user_id' => $user->id,
            'order_id' => $order->id,
            'discount_amount' => '80.00',
            'status' => 'applied',
        ]);
        $this->assertSame(1, $coupon->fresh()->total_uses);
    }

    public function test_2_expired_coupon_rejected_at_checkout(): void
    {
        $user = $this->makeUser('9100000002');
        $vendor = $this->makeVendor();
        $coupon = $this->makeCoupon(['expires_at' => now()->subDay()]);
        $cart = $this->makeCartWithProduct($user, $vendor);

        $cart->update(['coupon_code' => $coupon->code]);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('This coupon has expired');
        $this->checkout($user);
    }

    public function test_3_inactive_coupon_rejected_at_checkout(): void
    {
        $user = $this->makeUser('9100000003');
        $vendor = $this->makeVendor();
        $coupon = $this->makeCoupon(['is_active' => false]);
        $cart = $this->makeCartWithProduct($user, $vendor);

        $cart->update(['coupon_code' => $coupon->code]);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('This coupon is not active');
        $this->checkout($user);
    }

    public function test_4_minimum_order_rejection(): void
    {
        $user = $this->makeUser('9100000004');
        $vendor = $this->makeVendor();
        $coupon = $this->makeCoupon(['min_order_amount' => '500']);
        $cart = $this->makeCartWithProduct($user, $vendor); // subtotal 400

        $cart->update(['coupon_code' => $coupon->code]);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Minimum order amount');
        $this->checkout($user);
    }

    public function test_5_maximum_discount_caps_percentage(): void
    {
        $user = $this->makeUser('9100000005');
        $vendor = $this->makeVendor();
        $coupon = $this->makeCoupon(['value' => '20', 'max_discount' => '50']);
        $cart = $this->makeCartWithProduct($user, $vendor); // 20% of 400 = 80 -> capped 50

        $cart->update(['coupon_code' => $coupon->code]);

        $order = $this->checkout($user);

        $this->assertSame('50.00', $order->coupon_discount);
        $this->assertSame('50.00', $order->discount_amount);
    }

    public function test_6_fixed_discount(): void
    {
        $user = $this->makeUser('9100000006');
        $vendor = $this->makeVendor();
        $coupon = $this->makeCoupon(['type' => 'fixed', 'value' => '30', 'max_discount' => null]);
        $cart = $this->makeCartWithProduct($user, $vendor);

        $cart->update(['coupon_code' => $coupon->code]);

        $order = $this->checkout($user);

        $this->assertSame('30.00', $order->coupon_discount);
    }

    public function test_7_percentage_discount(): void
    {
        $user = $this->makeUser('9100000007');
        $vendor = $this->makeVendor();
        $coupon = $this->makeCoupon(['value' => '10', 'max_discount' => null]);
        $cart = $this->makeCartWithProduct($user, $vendor); // 400 -> 40

        $cart->update(['coupon_code' => $coupon->code]);

        $this->assertSame('40.00', $this->checkout($user)->coupon_discount);
    }

    public function test_8_discount_calculated_exactly_once(): void
    {
        $user = $this->makeUser('9100000008');
        $vendor = $this->makeVendor();
        $coupon = $this->makeCoupon(['value' => '20', 'max_discount' => null]);
        $cart = $this->makeCartWithProduct($user, $vendor); // subtotal 400 (tax-inclusive), delivery 20 + 18% GST

        $cart->update(['coupon_code' => $coupon->code]);

        $order = $this->checkout($user);

        // single authoritative discount bucket: coupon_discount === discount_amount
        $this->assertSame($order->coupon_discount, $order->discount_amount);
        // total = subtotal (tax-inclusive, product tax NOT added) + delivery
        // + delivery GST (18% of 20) - discount (ONCE), no tip
        $this->assertSame('343.60', $order->total_amount);
    }

    public function test_9_coupon_cannot_be_double_applied_even_if_cart_discount_is_set(): void
    {
        $user = $this->makeUser('9100000009');
        $vendor = $this->makeVendor();
        $coupon = $this->makeCoupon(['value' => '20', 'max_discount' => null]);
        $cart = $this->makeCartWithProduct($user, $vendor); // subtotal 400 (tax-inclusive), delivery 20 + 18% GST

        // Reproduce the old double-apply: cart.discount already holds the coupon value
        $cart->update(['coupon_code' => $coupon->code, 'discount' => '80', 'total' => '360']);

        $order = $this->checkout($user);

        // Discount must have been applied exactly once (80, not 160)
        $this->assertSame('80.00', $order->discount_amount);
        $this->assertSame('343.60', $order->total_amount); // 400 + 20 + 3.60 GST - 80

        $this->assertSame(1, CouponUsage::where('coupon_id', $coupon->id)->count());
        $this->assertSame(1, $coupon->fresh()->total_uses);
    }

    public function test_10_global_usage_limit_enforced(): void
    {
        $coupon = $this->makeCoupon(['value' => '10', 'max_discount' => null, 'usage_limit' => 2]);

        $user1 = $this->makeUser('9100000010');
        $vendor1 = $this->makeVendor('9000000200');
        $cart1 = $this->makeCartWithProduct($user1, $vendor1);
        $cart1->update(['coupon_code' => $coupon->code]);
        $this->checkout($user1);

        $user2 = $this->makeUser('9100000011');
        $vendor2 = $this->makeVendor('9000000201');
        $cart2 = $this->makeCartWithProduct($user2, $vendor2);
        $cart2->update(['coupon_code' => $coupon->code]);
        $this->checkout($user2);

        $user3 = $this->makeUser('9100000012');
        $vendor3 = $this->makeVendor('9000000202');
        $cart3 = $this->makeCartWithProduct($user3, $vendor3);
        $cart3->update(['coupon_code' => $coupon->code]);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Coupon usage limit reached');
        $this->checkout($user3);
    }

    public function test_11_per_user_usage_limit_enforced(): void
    {
        $coupon = $this->makeCoupon(['value' => '10', 'max_discount' => null, 'per_user_limit' => 1]);

        $user = $this->makeUser('9100000013');
        $vendor = $this->makeVendor('9000000203');
        $cart1 = $this->makeCartWithProduct($user, $vendor);
        $cart1->update(['coupon_code' => $coupon->code]);
        $this->checkout($user);

        $cart2 = $this->makeCartWithProduct($user, $vendor);
        $cart2->update(['coupon_code' => $coupon->code]);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('You have reached the usage limit for this coupon');
        $this->checkout($user);

        // a different user can still use the same coupon
        $other = $this->makeUser('9100000014');
        $cart3 = $this->makeCartWithProduct($other, $vendor);
        $cart3->update(['coupon_code' => $coupon->code]);
        $order = $this->checkout($other);
        $this->assertSame($coupon->code, $order->coupon_code);
    }

    public function test_12_global_limit_exhausted_by_existing_state_is_rejected(): void
    {
        $coupon = $this->makeCoupon(['value' => '10', 'max_discount' => null, 'usage_limit' => 3]);

        // simulate state where the coupon counter is already maxed out
        $coupon->update(['total_uses' => 3]);

        $user = $this->makeUser('9100000015');
        $vendor = $this->makeVendor('9000000204');
        $cart = $this->makeCartWithProduct($user, $vendor);
        $cart->update(['coupon_code' => $coupon->code]);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Coupon usage limit reached');
        $this->checkout($user);
    }

    public function test_14_same_order_cannot_be_redeemed_twice_by_database(): void
    {
        $coupon = $this->makeCoupon();
        $user = $this->makeUser('9100000016');

        CouponUsage::create([
            'coupon_id' => $coupon->id,
            'user_id' => $user->id,
            'order_id' => 999,
            'discount_amount' => '10.00',
            'status' => 'applied',
        ]);

        $this->expectException(QueryException::class);
        CouponUsage::create([
            'coupon_id' => $coupon->id,
            'user_id' => $user->id,
            'order_id' => 999,
            'discount_amount' => '10.00',
            'status' => 'applied',
        ]);
    }

    public function test_15_checkout_retry_with_same_idempotency_key_does_not_consume_coupon_twice(): void
    {
        $coupon = $this->makeCoupon(['value' => '10', 'max_discount' => null]);
        $user = $this->makeUser('9100000017');
        $vendor = $this->makeVendor('9000000205');
        $cart = $this->makeCartWithProduct($user, $vendor);
        $cart->update(['coupon_code' => $coupon->code]);

        $first = $this->checkout($user, ['idempotency_key' => 'checkout_key_1']);
        $second = $this->checkout($user, ['idempotency_key' => 'checkout_key_1']);

        $this->assertSame($first->id, $second->id);
        $this->assertSame(1, CouponUsage::where('coupon_id', $coupon->id)->count());
        $this->assertSame(1, $coupon->fresh()->total_uses);
        $this->assertSame(1, Order::where('idempotency_key', 'checkout_key_1')->count());
    }

    public function test_17_and_18_client_cannot_manipulate_discount_or_final_total(): void
    {
        $coupon = $this->makeCoupon(['value' => '10', 'max_discount' => null]);
        $user = $this->makeUser('9100000018');
        $vendor = $this->makeVendor('9000000206');
        $cart = $this->makeCartWithProduct($user, $vendor); // subtotal 400 (tax-inclusive), delivery 20 + 18% GST
        $cart->update(['coupon_code' => $coupon->code]);

        $order = $this->checkout($user, [
            'discount_amount' => '0.00',
            'total_amount' => '1.00',
            'coupon_discount' => '0.00',
        ]);

        $this->assertSame('40.00', $order->coupon_discount); // expected server 10% of 400
        $this->assertSame('383.60', $order->total_amount);   // 400 + 20 + 3.60 GST - 40
    }

    public function test_19_payable_amount_matches_payment_amount(): void
    {
        $coupon = $this->makeCoupon(['value' => '10', 'max_discount' => null]);
        $user = $this->makeUser('9100000019');
        $vendor = $this->makeVendor('9000000207');
        $cart = $this->makeCartWithProduct($user, $vendor); // subtotal 400 (tax-inclusive), delivery 20 + 18% GST
        $cart->update(['coupon_code' => $coupon->code]);

        $order = $this->checkout($user);

        $payment = app(PaymentService::class)->initiatePayable($user, $order, 'upi');

        $expectedPaise = Money::fromMajor($order->total_amount)->paise();
        $this->assertSame($expectedPaise, (int) $payment->amount_paise);
        $this->assertSame('383.60', $order->total_amount); // 400 + 20 + 3.60 GST - 40
    }

    public function test_20_cancellation_keeps_coupon_consumed(): void
    {
        $coupon = $this->makeCoupon(['value' => '10', 'max_discount' => null]);
        $user = $this->makeUser('9100000020');
        $vendor = $this->makeVendor('9000000208');
        $cart = $this->makeCartWithProduct($user, $vendor);
        $cart->update(['coupon_code' => $coupon->code]);

        $order = $this->checkout($user);

        app(OrderService::class)->cancelOrder($order->fresh(), $user, 'changed my mind');

        // Existing business semantics: coupon usage is NOT reversed on cancellation.
        $this->assertSame('CANCELLED', $order->fresh()->status);
        $this->assertDatabaseHas('coupon_usages', [
            'coupon_id' => $coupon->id,
            'order_id' => $order->id,
            'status' => 'applied',
        ]);
        $this->assertSame(1, $coupon->fresh()->total_uses);
        $this->assertSame(1, CouponUsage::where('coupon_id', $coupon->id)->count());
    }

    public function test_21_duplicate_cancellation_does_not_alter_coupon_usage(): void
    {
        $coupon = $this->makeCoupon(['value' => '10', 'max_discount' => null]);
        $user = $this->makeUser('9100000021');
        $vendor = $this->makeVendor('9000000209');
        $cart = $this->makeCartWithProduct($user, $vendor);
        $cart->update(['coupon_code' => $coupon->code]);

        $order = $this->checkout($user);
        app(OrderService::class)->cancelOrder($order->fresh(), $user);

        $replayed = app(OrderService::class)->cancelOrder($order->fresh(), $user);

        $this->assertSame($order->id, $replayed->id);
        $this->assertSame('CANCELLED', $order->fresh()->status);

        $this->assertSame(1, CouponUsage::where('coupon_id', $coupon->id)->count());
        $this->assertSame(1, $coupon->fresh()->total_uses);
    }

    public function test_22_coupon_management_is_admin_only(): void
    {
        $customer = $this->makeUser('9100000022');
        $driver = $this->makeUser('9100000023', 'driver');

        Sanctum::actingAs($customer, ['*']);
        $this->postJson('/api/v1/admin/coupons', ['code' => 'HACK', 'name' => 'x', 'type' => 'fixed', 'value' => '10'])
            ->assertStatus(403);

        Sanctum::actingAs($driver, ['*']);
        $this->postJson('/api/v1/admin/coupons', ['code' => 'HACK2', 'name' => 'x', 'type' => 'fixed', 'value' => '10'])
            ->assertStatus(403);

        $admin = $this->makeAdmin('9199999901');
        Sanctum::actingAs($admin, ['*']);
        $this->postJson('/api/v1/admin/coupons', ['code' => 'ADMINOK', 'name' => 'x', 'type' => 'fixed', 'value' => '10'])
            ->assertCreated();
    }

    public function test_23_invalid_admin_coupon_configuration_rejected(): void
    {
        $admin = $this->makeAdmin('9199999902');
        Sanctum::actingAs($admin, ['*']);
        $headers = ['Authorization' => 'Bearer '.$admin->createToken('test')->plainTextToken];

        $this->postJson('/api/v1/admin/coupons', [
            'code' => 'PCT110', 'name' => 'x', 'type' => 'percentage', 'value' => '110',
        ], $headers)->assertStatus(422)->assertJsonPath('errors.value.0', 'Percentage value cannot exceed 100.');

        $this->postJson('/api/v1/admin/coupons', [
            'code' => 'FIXEDMAX', 'name' => 'x', 'type' => 'fixed', 'value' => '10', 'max_discount' => '5',
        ], $headers)->assertStatus(422)->assertJsonPath('errors.max_discount.0', 'Maximum discount only applies to percentage coupons.');

        $this->postJson('/api/v1/admin/coupons', [
            'code' => 'DATES', 'name' => 'x', 'type' => 'fixed', 'value' => '10',
            'starts_at' => '2026-10-01 00:00:00', 'expires_at' => '2026-09-01 00:00:00',
        ], $headers)->assertStatus(422)->assertJsonPath('errors.expires_at.0', 'Expiry must be after the start date.');

        $this->postJson('/api/v1/admin/coupons', [
            'code' => 'NEG', 'name' => 'x', 'type' => 'fixed', 'value' => '-5',
        ], $headers)->assertStatus(422);
    }

    public function test_24_percentage_discount_uses_money_rounding(): void
    {
        $service = app(CouponService::class);

        $coupon = $this->makeCoupon(['type' => 'percentage', 'value' => '12.5', 'max_discount' => null]);
        $this->assertSame('0.13', $service->calculateDiscount($coupon, Money::fromMajor('1.00'))->major());
        $this->assertSame('12.50', $service->calculateDiscount($coupon, Money::fromMajor('100.00'))->major());

        $coupon2 = $this->makeCoupon(['type' => 'percentage', 'value' => '33.33', 'max_discount' => null]);
        $this->assertSame('33.33', $service->calculateDiscount($coupon2, Money::fromMajor('100.00'))->major());
    }

    public function test_25_negative_payable_amount_prevented(): void
    {
        $coupon = $this->makeCoupon(['type' => 'fixed', 'value' => '1000', 'min_order_amount' => '0']);
        $user = $this->makeUser('9100000024');
        $vendor = $this->makeVendor('9000000210');
        $product = $this->makeProduct($vendor, 50.0, ['tax_rate' => 0]);

        $cart = Cart::create([
            'user_id' => $user->id,
            'cart_type' => 'food',
            'vendor_id' => $vendor->id,
            'subtotal' => 0,
            'discount' => 0,
            'tax' => 0,
            'delivery_fee' => 10,
            'total' => 0,
            'items_count' => 0,
        ]);
        CartItem::create([
            'cart_id' => $cart->id,
            'product_id' => $product->id,
            'unit_price' => 50.0,
            'quantity' => 1,
            'line_total' => 50.0,
        ]);
        $cart->update(['subtotal' => 50.0, 'coupon_code' => $coupon->code]);

        $order = $this->checkout($user);

        // discount capped at eligible subtotal (50), never negative payable
        $this->assertSame('50.00', $order->discount_amount);
        $this->assertSame('11.80', $order->total_amount); // 50 + 10 + 1.80 GST - 50
        $this->assertGreaterThanOrEqual(0, (float) $order->total_amount);
    }

    private function makeAdmin(string $phone): User
    {
        $role = Role::updateOrCreate(['slug' => 'super_admin'], ['name' => 'Super Admin', 'is_system' => true]);

        $user = User::create([
            'name' => 'Promotion Admin',
            'email' => 'admin-'.$phone.'@example.com',
            'phone' => $phone,
            'password' => Hash::make('secret'),
            'user_type' => 'super_admin',
            'is_active' => true,
        ]);
        $user->roles()->sync([$role->id]);

        return $user;
    }
}
