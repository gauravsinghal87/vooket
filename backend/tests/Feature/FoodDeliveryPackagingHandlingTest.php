<?php

namespace Tests\Feature;

use App\Models\Address;
use App\Models\AppSetting;
use App\Models\Cart;
use App\Models\CartItem;
use App\Models\Product;
use App\Models\Role;
use App\Models\User;
use App\Models\Vendor;
use App\Services\OrderService;
use App\Services\Pricing\DeliveryFeeService;
use Database\Seeders\ConfigurationSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Food packaging and handling are flat customer-facing charges.
 *
 * They sit on top of the unchanged distance delivery fee and are resolved from
 * settings in the single pricing service, so the cart preview, the order and the
 * customer bill always agree. Grocery keeps its own per-mode configuration, so
 * these two settings can only ever move Food.
 */
class FoodDeliveryPackagingHandlingTest extends TestCase
{
    use RefreshDatabase;

    private const VENDOR_LAT = 12.9716;

    private const VENDOR_LNG = 77.5946;

    /** ~7 km from the restaurant, outside the 2 km free allowance. */
    private const ADDRESS_LAT = 13.0350;

    private const ADDRESS_LNG = 77.5946;

    private Vendor $vendor;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(ConfigurationSeeder::class);

        $vendorUser = User::factory()->create(['user_type' => 'vendor', 'is_active' => true]);
        $vendorUser->roles()->attach(Role::firstOrCreate(['slug' => 'vendor'], ['name' => 'Vendor']));

        $this->vendor = Vendor::create([
            'user_id' => $vendorUser->id,
            'business_name' => 'Pack Kitchen',
            'owner_name' => 'Pack Owner',
            'email' => 'packkitchen@example.com',
            'phone' => '9898912999',
            'vendor_type' => 'restaurant',
            'status' => 'approved',
            'is_active' => true,
            'latitude' => self::VENDOR_LAT,
            'longitude' => self::VENDOR_LNG,
        ]);
    }

    public function test_the_two_settings_exist_once_and_default_to_no_charge(): void
    {
        $packaging = AppSetting::where('key', 'food_delivery_packaging_charge')->firstOrFail();
        $handling = AppSetting::where('key', 'food_delivery_handling_fee')->firstOrFail();

        $this->assertSame('food_delivery', $packaging->group);
        $this->assertSame('food_delivery', $handling->group);
        $this->assertSame('number', $packaging->type);
        $this->assertEqualsWithDelta(0.0, (float) $packaging->value, 0.001);
        $this->assertEqualsWithDelta(0.0, (float) $handling->value, 0.001);
    }

    public function test_the_configured_charges_are_separate_lines_on_the_food_cart_and_order(): void
    {
        $this->setFoodCharges(packaging: 10, handling: 5);

        $customer = $this->makeCustomer();
        $address = $this->makeAddress($customer);
        $cart = $this->makeCart($customer, $address->id);

        $distanceKm = app(DeliveryFeeService::class)->distanceKm(
            self::VENDOR_LAT,
            self::VENDOR_LNG,
            self::ADDRESS_LAT,
            self::ADDRESS_LNG
        );
        $expectedDeliveryFee = app(DeliveryFeeService::class)->calculate('food', $cart->subtotal, $distanceKm);
        $expectedGst = round($expectedDeliveryFee * 18 / 100, 2);

        $this->recalculate($cart);

        $cart = $cart->fresh();
        $this->assertEqualsWithDelta($expectedDeliveryFee, (float) $cart->delivery_fee, 0.02);
        $this->assertEqualsWithDelta(10.0, (float) $cart->packaging_fee, 0.01);
        $this->assertEqualsWithDelta(5.0, (float) $cart->handling_fee, 0.01);
        $this->assertEqualsWithDelta(
            round($cart->subtotal + $cart->delivery_fee + $cart->delivery_gst_amount + 10 + 5, 2),
            (float) $cart->total,
            0.02
        );

        $order = app(OrderService::class)->createOrder($customer, [
            'order_type' => 'food',
            'payment_method' => 'cash_on_delivery',
            'address_id' => $address->id,
        ])->fresh();

        $this->assertEqualsWithDelta(10.0, (float) $order->packaging_fee, 0.01);
        $this->assertEqualsWithDelta(5.0, (float) $order->handling_fee, 0.01);
        $this->assertEqualsWithDelta($cart->delivery_fee, (float) $order->delivery_fee, 0.02);
        $this->assertEqualsWithDelta($expectedGst, (float) $order->delivery_gst_amount, 0.02);
        $this->assertEqualsWithDelta(
            round($order->subtotal + $order->delivery_fee + $order->delivery_gst_amount + 10 + 5, 2),
            (float) $order->total_amount,
            0.02
        );
    }

    public function test_zero_charges_leave_the_food_bill_exactly_as_it_was(): void
    {
        $this->setFoodCharges(packaging: 0, handling: 0);

        $customer = $this->makeCustomer();
        $address = $this->makeAddress($customer);
        $cart = $this->makeCart($customer, $address->id);

        $this->recalculate($cart);

        $cart = $cart->fresh();
        $this->assertEqualsWithDelta(0.0, (float) $cart->packaging_fee, 0.001);
        $this->assertEqualsWithDelta(0.0, (float) $cart->handling_fee, 0.001);
        $this->assertEqualsWithDelta(
            round($cart->subtotal + $cart->delivery_fee + $cart->delivery_gst_amount, 2),
            (float) $cart->total,
            0.02
        );

        $order = app(OrderService::class)->createOrder($customer, [
            'order_type' => 'food',
            'payment_method' => 'cash_on_delivery',
            'address_id' => $address->id,
        ])->fresh();

        $this->assertEqualsWithDelta(0.0, (float) $order->packaging_fee, 0.001);
        $this->assertEqualsWithDelta(0.0, (float) $order->handling_fee, 0.001);
    }

    public function test_a_later_setting_change_does_not_move_an_existing_food_order(): void
    {
        $this->setFoodCharges(packaging: 10, handling: 5);

        $customer = $this->makeCustomer();
        $address = $this->makeAddress($customer);
        $this->makeCart($customer, $address->id);

        $order = app(OrderService::class)->createOrder($customer, [
            'order_type' => 'food',
            'payment_method' => 'cash_on_delivery',
            'address_id' => $address->id,
        ])->fresh();

        $total = (float) $order->total_amount;

        $this->setFoodCharges(packaging: 40, handling: 25);

        $order->refresh();
        $this->assertEqualsWithDelta(10.0, (float) $order->packaging_fee, 0.01);
        $this->assertEqualsWithDelta(5.0, (float) $order->handling_fee, 0.01);
        $this->assertEqualsWithDelta($total, (float) $order->total_amount, 0.001);
    }

    public function test_the_food_charges_never_move_grocery_pricing(): void
    {
        $this->setFoodCharges(packaging: 10, handling: 5);

        $customer = $this->makeCustomer();
        $address = $this->makeAddress($customer);
        $product = $this->makeProduct('food');

        $cart = $this->makeCart($customer, $address->id, 'grocery', $product);

        $this->recalculate($cart);

        $cart = $cart->fresh();
        $this->assertEqualsWithDelta(0.0, (float) $cart->packaging_fee, 0.001);
        $this->assertEqualsWithDelta(0.0, (float) $cart->handling_fee, 0.001);
        $this->assertGreaterThan(0, (float) $cart->delivery_fee);
    }

    public function test_the_admin_endpoint_rejects_a_negative_charge(): void
    {
        $role = Role::firstOrCreate(['slug' => 'super_admin'], ['name' => 'Super Admin', 'is_system' => true]);
        $admin = User::factory()->create(['user_type' => 'super_admin', 'is_active' => true]);
        $admin->roles()->sync([$role->id]);

        $this->withHeader('Authorization', 'Bearer '.$admin->createToken('test')->plainTextToken);

        foreach (['food_delivery_packaging_charge', 'food_delivery_handling_fee'] as $key) {
            $setting = AppSetting::where('key', $key)->firstOrFail();

            $this->putJson("/api/v1/admin/app-settings/{$setting->id}", ['value' => -1])
                ->assertStatus(422)
                ->assertJsonValidationErrors('value');

            $this->putJson("/api/v1/admin/app-settings/{$setting->id}", ['value' => 12.5])
                ->assertOk()
                ->assertJsonPath('data.value', '12.5');
        }
    }

    private function setFoodCharges(float $packaging, float $handling): void
    {
        AppSetting::where('key', 'food_delivery_packaging_charge')->update(['value' => (string) $packaging]);
        AppSetting::where('key', 'food_delivery_handling_fee')->update(['value' => (string) $handling]);
    }

    private function makeProduct(string $type): Product
    {
        return Product::create([
            'vendor_id' => $this->vendor->id,
            'name' => ucfirst($type).' '.uniqid('f', true),
            'slug' => $type.'-'.uniqid('s', true),
            'sku' => 'SKU_'.uniqid(),
            'price' => 120,
            'type' => $type,
            'tax_rate' => 0,
            'is_active' => true,
            'is_available' => true,
        ]);
    }

    private function makeCart(User $customer, int $addressId, string $cartType = 'food', ?Product $product = null): Cart
    {
        $product = $this->makeProduct($cartType);

        $cart = Cart::create([
            'user_id' => $customer->id,
            'cart_type' => $cartType,
            'vendor_id' => $this->vendor->id,
            'address_id' => $addressId,
            'subtotal' => 240,
            'discount' => 0,
            'tax' => 0,
            'delivery_fee' => 0,
            'total' => 240,
            'items_count' => 2,
        ]);

        CartItem::create([
            'cart_id' => $cart->id,
            'product_id' => $product->id,
            'unit_price' => $product->price,
            'quantity' => 2,
            'line_total' => 240,
        ]);

        return $cart;
    }

    /**
     * Recalculate through the real customer endpoint so the preview is covered end
     * to end rather than through a reimplementation of the pricing.
     */
    private function recalculate(Cart $cart): Cart
    {
        Sanctum::actingAs($cart->user, ['*']);

        $this->postJson('/api/v1/cart/delivery-address', [
            'cart_type' => $cart->cart_type,
            'address_id' => $cart->address_id,
        ])->assertOk();

        return $cart->fresh();
    }

    private function makeCustomer(): User
    {
        return User::factory()->create([
            'user_type' => 'customer',
            'is_active' => true,
        ]);
    }

    private function makeAddress(User $customer): Address
    {
        return Address::create([
            'user_id' => $customer->id,
            'label' => 'Home',
            'contact_name' => 'Customer',
            'contact_phone' => '98123'.random_int(10000, 99999),
            'address_line_1' => '12 Test Street',
            'city' => 'Bengaluru',
            'state' => 'Karnataka',
            'postal_code' => '560001',
            'formatted_address' => '12 Test Street, Bengaluru',
            'latitude' => self::ADDRESS_LAT,
            'longitude' => self::ADDRESS_LNG,
            'is_default' => true,
        ]);
    }
}
