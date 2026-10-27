<?php

namespace Tests\Feature;

use App\Models\Cart;
use App\Models\CartItem;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use App\Models\Vendor;
use App\Services\OrderService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OrderIdempotencyTest extends TestCase
{
    use RefreshDatabase;

    public function test_replaying_same_idempotency_key_returns_the_existing_order(): void
    {
        $user = $this->makeUser('9100000101');
        $this->makeCartWithProduct($user);

        $order = $this->checkout($user, ['idempotency_key' => 'idem-feed-saga-retry']);
        $replayed = $this->checkout($user, ['idempotency_key' => 'idem-feed-saga-retry']);

        $this->assertInstanceOf(Order::class, $replayed);
        $this->assertSame($order->id, $replayed->id);
        $this->assertSame(1, Order::count());
    }

    public function test_same_idempotency_key_with_different_payload_is_rejected(): void
    {
        $user = $this->makeUser('9100000102');
        $this->makeCartWithProduct($user);

        $this->checkout($user, ['idempotency_key' => 'idem-mutation', 'customer_note' => 'first payload']);
        $orderCount = Order::count();

        $this->expectException(\Exception::class);
        $this->expectExceptionMessage('Idempotency key already used with a different payload');

        $this->checkout($user, ['idempotency_key' => 'idem-mutation', 'customer_note' => 'mutated payload']);

        $this->assertSame($orderCount, Order::count());
    }

    public function test_same_idempotency_key_is_scoped_per_user(): void
    {
        $first = $this->makeUser('9100000103');
        $this->makeCartWithProduct($first);
        $firstOrder = $this->checkout($first, ['idempotency_key' => 'shared-key']);

        $second = $this->makeUser('9100000104');
        $this->makeCartWithProduct($second);
        $secondOrder = $this->checkout($second, ['idempotency_key' => 'shared-key']);

        $this->assertNotSame($firstOrder->id, $secondOrder->id);
        $this->assertSame(2, Order::count());
    }

    private function makeUser(string $phone): User
    {
        return User::factory()->create([
            'name' => 'Customer '.$phone,
            'phone' => $phone,
            'user_type' => 'customer',
            'is_active' => true,
        ]);
    }

    private function makeCartWithProduct(User $user): void
    {
        $vendorUser = User::factory()->create(['user_type' => 'vendor', 'is_active' => true]);
        $vendor = Vendor::create([
            'user_id' => $vendorUser->id,
            'business_name' => 'Idem Kitchen',
            'owner_name' => 'Idem Owner',
            'phone' => '9898989001',
            'vendor_type' => 'restaurant',
            'status' => 'approved',
            'is_active' => true,
        ]);

        $product = Product::create([
            'vendor_id' => $vendor->id,
            'name' => 'Idem Burger '.uniqid('p', true),
            'slug' => 'idem-burger-'.uniqid('s', true),
            'sku' => 'SKU_'.uniqid(),
            'price' => 100,
            'type' => 'food',
            'tax_rate' => 5,
            'is_active' => true,
            'is_available' => true,
        ]);

        $cart = Cart::create([
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
            'cart_id' => $cart->id,
            'product_id' => $product->id,
            'unit_price' => $product->price,
            'quantity' => 4,
            'line_total' => 400,
        ]);
    }

    private function checkout(User $user, array $data = []): Order
    {
        return app(OrderService::class)->createOrder($user, array_merge([
            'order_type' => 'food',
            'payment_method' => 'cash_on_delivery',
        ], $data));
    }
}
