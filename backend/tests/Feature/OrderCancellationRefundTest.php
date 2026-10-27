<?php

namespace Tests\Feature;

use App\Models\Cart;
use App\Models\CartItem;
use App\Models\DeliveryPartner;
use App\Models\DispatchLog;
use App\Models\Inventory;
use App\Models\InventoryReservation;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Product;
use App\Models\Refund;
use App\Models\Role;
use App\Models\User;
use App\Models\Vendor;
use App\Models\WalletTransaction;
use App\Services\DeliveryService;
use App\Services\OrderService;
use App\Services\WalletService;
use App\Support\Money;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class OrderCancellationRefundTest extends TestCase
{
    use RefreshDatabase;

    public function test_cancelling_wallet_paid_order_credits_wallet_and_releases_inventory(): void
    {
        $user = $this->makeCustomer('9100000401');
        $this->makeCartWithProduct($user);
        app(WalletService::class)->credit($user, 'customer', 1000, 'CREDIT', null, null, 'Test credit');

        $order = $this->checkout($user, 'wallet');
        $inventory = Inventory::where('product_id', $order->items->first()->product_id)->firstOrFail();

        $canceled = app(DeliveryService::class)->cancelOrder($order, $user, 'Out of stock');

        $this->assertSame('CANCELLED', $canceled->fresh()->status);
        $this->assertNotNull($canceled->fresh()->cancelled_at);
        $this->assertSame('customer', $canceled->fresh()->cancelled_by_type);
        $this->assertSame((int) $order->wallet_used, (int) $canceled->fresh()->refund_amount);
        $this->assertSame('pending', $canceled->fresh()->refund_status);
        $this->assertSame(0, (int) $inventory->fresh()->reserved_quantity);
        $this->assertSame('released', InventoryReservation::where('order_id', $order->id)->first()->state);
        $this->assertDatabaseHas('order_status_histories', [
            'order_id' => $order->id,
            'new_status' => 'CANCELLED',
            'changed_by_type' => 'customer',
        ]);
        $this->assertDatabaseHas('wallet_transactions', [
            'user_id' => $user->id,
            'type' => 'REFUND',
            'reference_type' => Order::class,
            'reference_id' => $order->id,
        ]);
    }

    public function test_repeated_wallet_refund_does_not_double_credit(): void
    {
        $user = $this->makeCustomer('9100000402');
        $this->makeCartWithProduct($user);
        app(WalletService::class)->credit($user, 'customer', 1000, 'CREDIT', null, null, 'Test credit');

        $order = $this->checkout($user, 'wallet');
        $walletUsed = (float) $order->wallet_used;
        $service = app(DeliveryService::class);

        $service->cancelOrder($order, $user, 'first');
        $service->cancelOrder($order, $user, 'replay');

        $this->assertSame('CANCELLED', $order->fresh()->status);
        $this->assertSame(1, WalletTransaction::where('user_id', $user->id)->where('type', 'REFUND')->count());
    }

    public function test_cancelling_with_successful_gateway_payment_creates_refund_once(): void
    {
        $user = $this->makeCustomer('9100000403');
        $vendor = $this->makeVendor();
        $product = $this->makeProduct($vendor, 20);

        $this->makeCartWithProduct($user, stock: 20, qty: 1, vendor: $vendor, product: $product);
        $order = $this->checkout($user, 'cash_on_delivery');
        Payment::create([
            'payment_number' => 'PAY_GATE_'.uniqid(),
            'user_id' => $user->id,
            'payable_type' => Order::class,
            'payable_id' => $order->id,
            'amount' => $order->total_amount,
            'amount_paise' => Money::fromMajor($order->total_amount)->paise(),
            'currency' => 'INR',
            'method' => 'cash_on_delivery',
            'gateway' => 'test',
            'status' => 'SUCCESS',
            'paid_at' => now(),
            'idempotency_key' => 'PG_'.Str::upper(Str::random(8)),
        ]);

        $service = app(DeliveryService::class);
        $first = $service->cancelOrder($order, $user, 'Customer changed mind');
        $second = $service->cancelOrder($order->fresh(), $user, 'again');

        $this->assertSame($first->id, $second->id);
        $this->assertSame(1, Refund::where('payment_id', Payment::where('payable_id', $order->id)->first()->id)->count());
    }

    public function test_cancellation_releases_partner_busy_and_expires_offers(): void
    {
        $order = $this->makeReadyOrder();
        $partner = $this->makePartner();
        DispatchLog::create([
            'dispatch_type' => 'delivery',
            'order_id' => $order->id,
            'candidate_id' => 999,
            'candidate_type' => DispatchLog::CANDIDATE_TYPE_DELIVERY_PARTNER,
            'status' => DispatchLog::STATUS_PENDING,
        ]);

        $order->update([
            'delivery_partner_id' => $partner->id,
            'partner_assigned_at' => now(),
        ]);
        $partner->update(['is_busy' => true]);

        app(DeliveryService::class)->cancelOrder($order, $order->user, 'Vendor out of stock');

        $this->assertSame('CANCELLED', $order->fresh()->status);
        $this->assertFalse((bool) $partner->fresh()->is_busy);
        $this->assertSame(DispatchLog::STATUS_EXPIRED, DispatchLog::where('order_id', $order->id)->firstOrFail()->status);
    }

    public function test_cancellation_from_delivered_status_is_rejected(): void
    {
        $order = $this->makeReadyOrder();
        $partner = $this->makePartner();
        $order->update(['status' => 'DELIVERED', 'delivered_at' => now(), 'delivered_via' => 'NONE']);

        try {
            app(DeliveryService::class)->cancelOrder($order, $order->user, 'Late change of heart');
            $this->fail('Expected RuntimeException (InvalidOrderTransitionException)');
        } catch (\Throwable $e) {
            $this->assertStringContainsString('Cannot move order', $e->getMessage());
        }

        $this->assertSame('DELIVERED', $order->fresh()->status);
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

        return Vendor::create([
            'user_id' => $vendorUser->id,
            'business_name' => 'Cancel Kitchen',
            'owner_name' => 'Cancel Owner',
            'phone' => '9898989005',
            'vendor_type' => 'restaurant',
            'status' => 'approved',
            'is_active' => true,
            'latitude' => 12.9716,
            'longitude' => 77.5946,
        ]);
    }

    private function makeProduct(Vendor $vendor, int $stock, string $sku = ''): Product
    {
        $sku = $sku ?: uniqid('cancel-sku', true);

        $product = Product::create([
            'vendor_id' => $vendor->id,
            'name' => 'Cancel Burger '.$sku,
            'slug' => 'cancel-burger-'.Str::lower($sku),
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
            'low_stock_threshold' => 5,
            'track_inventory' => true,
        ]);

        return $product;
    }

    private function makeCartWithProduct(User $user, int $stock = 20, int $qty = 4, ?Vendor $vendor = null, ?Product $product = null): void
    {
        $vendor = $vendor ?? $this->makeVendor();
        $product = $product ?? $this->makeProduct($vendor, $stock);

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
            'quantity' => $qty,
            'line_total' => round($product->price * $qty, 2),
        ]);
    }

    private function checkout(User $user, string $paymentMethod): Order
    {
        return app(OrderService::class)->createOrder($user, [
            'order_type' => 'food',
            'payment_method' => $paymentMethod,
        ]);
    }

    private function makeReadyOrder(): Order
    {
        $vendorUser = User::factory()->create(['user_type' => 'vendor', 'is_active' => true]);
        $vendor = Vendor::create([
            'user_id' => $vendorUser->id,
            'business_name' => 'Cancel Kitchen',
            'owner_name' => 'Cancel Owner',
            'phone' => '9898989006',
            'vendor_type' => 'restaurant',
            'status' => 'approved',
            'is_active' => true,
        ]);
        $customer = User::factory()->create(['user_type' => 'customer', 'is_active' => true]);

        return Order::create([
            'order_number' => 'ORD_'.Str::upper(Str::random(8)),
            'user_id' => $customer->id,
            'vendor_id' => $vendor->id,
            'order_type' => 'food',
            'status' => 'READY',
            'payment_status' => 'paid',
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
            'is_busy' => false,
            'latitude' => 12.9717,
            'longitude' => 77.5947,
            'last_location_at' => now(),
        ]);
    }
}
