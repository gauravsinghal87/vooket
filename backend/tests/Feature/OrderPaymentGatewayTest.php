<?php

namespace Tests\Feature;

use App\Models\Cart;
use App\Models\CartItem;
use App\Models\IntegrationSetting;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Product;
use App\Models\User;
use App\Models\Vendor;
use App\Services\OrderService;
use App\Support\Money;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class OrderPaymentGatewayTest extends TestCase
{
    use RefreshDatabase;

    public function test_initiate_returns_razorpay_public_key_from_settings_in_test_mode(): void
    {
        $this->useRazorpayTestSettings();
        $customer = $this->makeCustomer();
        $order = $this->makeOnlineOrder($customer);
        $expectedPaise = Money::fromMajor($order->total_amount)->paise();

        Http::preventStrayRequests();
        Http::fake([
            'https://api.razorpay.com/v1/orders' => Http::response([
                'id' => 'order_rzp_test_abc',
                'amount' => $expectedPaise,
                'currency' => 'INR',
                'status' => 'created',
            ]),
        ]);

        Sanctum::actingAs($customer, ['*']);

        $res = $this->postJson('/api/v1/payments/initiate', [
            'payable_type' => 'order',
            'payable_id' => $order->id,
            'payment_method' => 'card',
        ]);

        $res->assertStatus(201)
            ->assertJsonPath('data.key_id', 'rzp_test_PublicKeyId')
            ->assertJsonPath('data.mock', false)
            ->assertJsonPath('data.provider_order_id', 'order_rzp_test_abc')
            ->assertJsonPath('data.amount_paise', $expectedPaise)
            ->assertJsonPath('data.method', 'card');

        $this->assertStringNotContainsString('rzp_test_SecretKey', $res->getContent());
        $this->assertSame('razorpay', Payment::first()->gateway);
    }

    public function test_verify_captures_payment_and_marks_order_paid_in_real_provider_mode(): void
    {
        $this->useRazorpayTestSettings();
        $customer = $this->makeCustomer();
        $order = $this->makeOnlineOrder($customer);
        $expectedPaise = Money::fromMajor($order->total_amount)->paise();

        Http::preventStrayRequests();
        Http::fake([
            'https://api.razorpay.com/v1/orders' => Http::response([
                'id' => 'order_rzp_test_verify',
                'amount' => $expectedPaise,
                'currency' => 'INR',
                'status' => 'created',
            ]),
            'https://api.razorpay.com/v1/payments/pay_rzp_test_verify' => Http::response([
                'id' => 'pay_rzp_test_verify',
                'order_id' => 'order_rzp_test_verify',
                'amount' => $expectedPaise,
                'currency' => 'INR',
                'status' => 'captured',
                'method' => 'card',
            ]),
        ]);

        Sanctum::actingAs($customer, ['*']);

        $initiate = $this->postJson('/api/v1/payments/initiate', [
            'payable_type' => 'order',
            'payable_id' => $order->id,
            'payment_method' => 'card',
        ])->assertStatus(201);

        $signature = hash_hmac('sha256', 'order_rzp_test_verify|pay_rzp_test_verify', 'rzp_test_SecretKey');

        $verify = $this->postJson('/api/v1/payments/verify', [
            'payment_number' => $initiate->json('data.payment_number'),
            'provider_order_id' => 'order_rzp_test_verify',
            'provider_payment_id' => 'pay_rzp_test_verify',
            'signature' => $signature,
        ]);

        $verify->assertOk()
            ->assertJsonPath('data.status', 'SUCCESS')
            ->assertJsonPath('data.already_processed', false);

        $this->assertDatabaseHas('payments', [
            'payment_number' => $initiate->json('data.payment_number'),
            'status' => 'SUCCESS',
            'provider_payment_id' => 'pay_rzp_test_verify',
        ]);
        $this->assertDatabaseHas('orders', ['id' => $order->id, 'payment_status' => 'paid']);
    }

    public function test_verify_rejects_an_invalid_signature_in_real_provider_mode(): void
    {
        $this->useRazorpayTestSettings();
        $customer = $this->makeCustomer();
        $order = $this->makeOnlineOrder($customer);
        $expectedPaise = Money::fromMajor($order->total_amount)->paise();

        Http::preventStrayRequests();
        Http::fake([
            'https://api.razorpay.com/v1/orders' => Http::response([
                'id' => 'order_rzp_test_sig',
                'amount' => $expectedPaise,
                'currency' => 'INR',
                'status' => 'created',
            ]),
        ]);

        Sanctum::actingAs($customer, ['*']);

        $initiate = $this->postJson('/api/v1/payments/initiate', [
            'payable_type' => 'order',
            'payable_id' => $order->id,
            'payment_method' => 'card',
        ])->assertStatus(201);

        $this->postJson('/api/v1/payments/verify', [
            'payment_number' => $initiate->json('data.payment_number'),
            'provider_order_id' => 'order_rzp_test_sig',
            'provider_payment_id' => 'pay_rzp_test_sig',
            'signature' => 'bogus-signature',
        ])->assertStatus(422)->assertJsonPath('success', false);

        $this->assertDatabaseHas('payments', ['status' => 'INITIATED']);
        $this->assertDatabaseMissing('payments', ['status' => 'SUCCESS']);
    }

    public function test_mock_mode_checkout_payload_exposes_mock_sentinel(): void
    {
        $customer = $this->makeCustomer();
        $order = $this->makeOnlineOrder($customer);

        Sanctum::actingAs($customer, ['*']);

        $this->postJson('/api/v1/payments/initiate', [
            'payable_type' => 'order',
            'payable_id' => $order->id,
            'payment_method' => 'upi',
        ])->assertStatus(201)
            ->assertJsonPath('data.key_id', 'mock')
            ->assertJsonPath('data.mock', true);
    }

    private function useRazorpayTestSettings(): void
    {
        config(['integrations.mode' => 'test']);

        IntegrationSetting::create([
            'service' => 'payments',
            'provider' => 'razorpay',
            'environment' => 'test',
            'is_enabled' => true,
            'credentials' => ['key_id' => 'rzp_test_PublicKeyId', 'key_secret' => 'rzp_test_SecretKey'],
        ]);

        Cache::flush();
    }

    private function makeCustomer(): User
    {
        return User::factory()->create([
            'name' => 'Pay Customer',
            'phone' => '9123456789',
            'user_type' => 'customer',
            'is_active' => true,
        ]);
    }

    private function makeOnlineOrder(User $user): Order
    {
        $vendorUser = User::factory()->create(['user_type' => 'vendor', 'is_active' => true]);
        $vendor = Vendor::create([
            'user_id' => $vendorUser->id,
            'business_name' => 'Pay Test Kitchen',
            'owner_name' => 'Pay Test Owner',
            'phone' => '9898989099',
            'vendor_type' => 'restaurant',
            'status' => 'approved',
            'is_active' => true,
        ]);

        $product = Product::create([
            'vendor_id' => $vendor->id,
            'name' => 'Pay Test Burger',
            'slug' => 'pay-test-burger-'.uniqid('s', true),
            'sku' => 'SKU_PAY_'.uniqid(),
            'price' => 100,
            'type' => 'food',
            'tax_rate' => 5,
            'is_active' => true,
            'is_available' => true,
        ]);

        Cart::create([
            'user_id' => $user->id,
            'cart_type' => 'food',
            'vendor_id' => $vendor->id,
            'subtotal' => 400,
            'discount' => 0,
            'tax' => 0,
            'delivery_fee' => 20,
            'total' => 0,
            'items_count' => 1,
        ]);

        CartItem::create([
            'cart_id' => Cart::where('user_id', $user->id)->first()->id,
            'product_id' => $product->id,
            'unit_price' => $product->price,
            'quantity' => 4,
            'line_total' => 400,
        ]);

        return app(OrderService::class)->createOrder($user, [
            'order_type' => 'food',
            'payment_method' => 'online',
        ]);
    }
}
