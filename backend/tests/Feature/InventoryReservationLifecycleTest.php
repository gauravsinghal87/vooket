<?php

namespace Tests\Feature;

use App\Exceptions\InsufficientStockException;
use App\Models\Cart;
use App\Models\CartItem;
use App\Models\DeliveryPartner;
use App\Models\Inventory;
use App\Models\InventoryReservation;
use App\Models\Order;
use App\Models\Product;
use App\Models\Role;
use App\Models\User;
use App\Models\Vendor;
use App\Services\DeliveryService;
use App\Services\OrderService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class InventoryReservationLifecycleTest extends TestCase
{
    use RefreshDatabase;

    public function test_creating_an_order_reserves_stock(): void
    {
        $user = $this->makeCustomer('9100000201');
        [$cart, $product] = $this->makeCartWithProduct($user, quantity: 3, stock: 10);

        $order = $this->checkout($user);

        $reservation = InventoryReservation::where('order_id', $order->id)->firstOrFail();
        $inventory = $product->fresh(['inventory'])->inventory;

        $this->assertSame(3, $reservation->quantity);
        $this->assertSame('reserved', $reservation->state);
        $this->assertSame(10, (int) $inventory->quantity);
        $this->assertSame(3, (int) $inventory->reserved_quantity);
        $this->assertDatabaseHas('inventory_transactions', [
            'inventory_id' => $inventory->id,
            'type' => 'reservation',
            'reference_type' => Order::class,
            'reference_id' => $order->id,
        ]);
    }

    public function test_cancelling_an_order_releases_reserved_stock(): void
    {
        $user = $this->makeCustomer('9100000202');
        [$cart, $product] = $this->makeCartWithProduct($user, quantity: 3, stock: 10);
        $order = $this->checkout($user);
        $inventory = $product->fresh(['inventory'])->inventory;

        $order = app(DeliveryService::class)->cancelOrder($order, $user, 'Test cancel');

        $this->assertSame('CANCELLED', $order->fresh()->status);
        $this->assertSame('released', InventoryReservation::where('order_id', $order->id)->firstOrFail()->state);
        $this->assertSame(10, (int) $inventory->fresh()->quantity);
        $this->assertSame(0, (int) $inventory->fresh()->reserved_quantity);
    }

    public function test_delivering_an_order_sells_reserved_stock(): void
    {
        $user = $this->makeCustomer('9100000203');
        [$cart, $product] = $this->makeCartWithProduct($user, quantity: 3, stock: 10);
        $order = $this->checkout($user);
        $inventory = $product->fresh(['inventory'])->inventory;

        $order->update(['status' => 'READY']);
        $partner = $this->makePartner();
        $order = app(DeliveryService::class)->claimOrder($order->fresh(), $partner);
        app(DeliveryService::class)->markPickedUp($order, $partner);

        // Satisfy the delivery gate (payment collected + OTP verified), the
        // same way the partner API steps would in production.
        $order->update([
            'delivery_payment_collected_at' => now(),
            'delivery_payment_collected_via' => 'cash',
            'delivery_payment_settled_at' => now(),
            'delivery_otp_verified_at' => now(),
        ]);

        app(DeliveryService::class)->markDelivered($order, $partner);

        $reservation = InventoryReservation::where('order_id', $order->id)->firstOrFail();

        $this->assertSame('sold', $reservation->state);
        $this->assertSame(7, (int) $inventory->fresh()->quantity);
        $this->assertSame(0, (int) $inventory->fresh()->reserved_quantity);
        $this->assertDatabaseHas('inventory_transactions', [
            'inventory_id' => $inventory->id,
            'type' => 'sale',
            'quantity_change' => -3,
            'reference_id' => $order->id,
        ]);
    }

    public function test_insufficient_stock_rolls_back_the_whole_order(): void
    {
        $user = $this->makeCustomer('9100000204');
        [$cart, $product] = $this->makeCartWithProduct($user, quantity: 5, stock: 2);
        $inventory = $product->fresh(['inventory'])->inventory;

        try {
            $this->checkout($user);
            $this->fail('Expected InsufficientStockException');
        } catch (InsufficientStockException $e) {
            $this->assertSame(1, count($e->unavailableItems()));
        }

        $this->assertSame(0, Order::count());
        $this->assertSame(0, InventoryReservation::count());
        $this->assertSame(2, (int) $inventory->fresh()->quantity);
        $this->assertSame(0, (int) $inventory->fresh()->reserved_quantity);
        $this->assertNotNull($cart->fresh());
    }

    public function test_multiple_cart_lines_of_same_product_aggregate_into_one_reservation(): void
    {
        $user = $this->makeCustomer('9100000205');
        $vendor = $this->makeVendor();
        $product = $this->makeProduct($vendor, stock: 10);

        $cart = $this->makeEmptyCart($user, $vendor);
        CartItem::create(['cart_id' => $cart->id, 'product_id' => $product->id, 'unit_price' => 100, 'quantity' => 2, 'line_total' => 200]);
        CartItem::create(['cart_id' => $cart->id, 'product_id' => $product->id, 'unit_price' => 100, 'quantity' => 3, 'line_total' => 300]);

        $order = $this->checkout($user);

        $reservations = InventoryReservation::where('order_id', $order->id)->get();
        $inventory = $product->fresh(['inventory'])->inventory;

        $this->assertCount(1, $reservations);
        $this->assertSame(5, (int) $reservations->first()->quantity);
        $this->assertSame(5, (int) $inventory->fresh()->reserved_quantity);
        $this->assertSame(2, $order->items()->count());
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

    private function makeVendor(): Vendor
    {
        $vendorUser = User::factory()->create(['user_type' => 'vendor', 'is_active' => true]);
        $vendorUser->roles()->attach(Role::firstOrCreate(['slug' => 'vendor'], ['name' => 'Vendor']));

        return Vendor::create([
            'user_id' => $vendorUser->id,
            'business_name' => 'Inventory Kitchen',
            'owner_name' => 'Inv Owner',
            'phone' => '9898989002',
            'vendor_type' => 'restaurant',
            'status' => 'approved',
            'is_active' => true,
            'latitude' => 12.9716,
            'longitude' => 77.5946,
        ]);
    }

    private function makeProduct(Vendor $vendor, int $stock, int $limit = 0): Product
    {
        $sku = uniqid('inv-sku', true);
        $product = Product::create([
            'vendor_id' => $vendor->id,
            'name' => 'Stock Item '.$sku,
            'slug' => 'stock-item-'.Str::lower($sku),
            'sku' => $sku,
            'price' => 100,
            'type' => 'food',
            'tax_rate' => 5,
            'is_active' => true,
            'is_available' => true,
        ]);

        Inventory::create([
            'vendor_id' => $vendor->id,
            'product_id' => $product->id,
            'quantity' => $stock,
            'reserved_quantity' => 0,
            'low_stock_threshold' => $limit,
            'track_inventory' => true,
            'location' => null,
        ]);

        return $product;
    }

    private function makeEmptyCart(User $user, Vendor $vendor): Cart
    {
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

        return $cart;
    }

    private function makeCartWithProduct(User $user, int $quantity, int $stock): array
    {
        $vendor = $this->makeVendor();
        $product = $this->makeProduct($vendor, $stock);
        $cart = $this->makeEmptyCart($user, $vendor);

        CartItem::create([
            'cart_id' => $cart->id,
            'product_id' => $product->id,
            'unit_price' => $product->price,
            'quantity' => $quantity,
            'line_total' => round($product->price * $quantity, 2),
        ]);

        return [$cart, $product];
    }

    private function checkout(User $user): Order
    {
        return app(OrderService::class)->createOrder($user, [
            'order_type' => 'food',
            'payment_method' => 'cash_on_delivery',
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
