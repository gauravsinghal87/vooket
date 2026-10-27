<?php

namespace Tests\Feature;

use App\Models\Cart;
use App\Models\CartItem;
use App\Models\Commission;
use App\Models\CommissionRule;
use App\Models\Inventory;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Product;
use App\Models\Refund;
use App\Models\Role;
use App\Models\Settlement;
use App\Models\User;
use App\Models\Vendor;
use App\Services\CommissionService;
use App\Services\OrderService;
use App\Services\RefundService;
use App\Support\Money;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class AdminCancelledOrderRefundRevenueTest extends TestCase
{
    use RefreshDatabase;

    private RefundService $refundService;

    protected function setUp(): void
    {
        parent::setUp();
        $this->refundService = app(RefundService::class);
    }

    public function test_admin_refund_removes_cancelled_prepaid_order_from_dashboard_and_vendor_boards_once(): void
    {
        $customer = $this->makeCustomer('9898980501');
        $vendor = $this->makeVendor();
        $product = $this->makeProduct($vendor, 20);
        $this->makeCartWithProduct($customer, $vendor, $product);
        $order = $this->checkoutAndPay($customer, $vendor);

        $beforeDashboard = Order::where('payment_status', '!=', 'failed')
            ->where('payment_status', '!=', 'REFUNDED')
            ->sum('total_amount');
        $beforeVendor = Settlement::where('status', 'processing')->sum('net_payable')
            + Commission::where('status', 'calculated')->sum('net_amount');

        $refund = $this->refundService->refundCancelledOrder(
            $order,
            $this->makeAdmin(),
            Money::fromMajor((float) $order->total_amount),
            'Admin refund for cancelled order',
        );

        $afterDashboard = Order::where('payment_status', '!=', 'failed')
            ->where('payment_status', '!=', 'REFUNDED')
            ->sum('total_amount');
        $afterVendor = Settlement::where('status', 'processing')->sum('net_payable')
            + Commission::where('status', 'calculated')->sum('net_amount');

        $this->assertSame('CANCELLED', $order->fresh()->status);
        $this->assertSame('COMPLETED', $refund->status);
        $this->assertSame('REFUNDED', $order->fresh()->payment_status);
        $this->assertNotNull($refund->processed_at, 'Admin refund must actually move money (processed_at set)');
        $this->assertTrue($beforeDashboard - $afterDashboard >= 0.01, 'Dashboard revenue must drop');
        $this->assertTrue($beforeVendor - $afterVendor >= 0.01, 'Vendor earnings must drop');

        // idempotent re-click returns the same refund — no double reversal
        $again = $this->refundService->refundCancelledOrder(
            $order,
            $this->makeAdmin(),
            Money::fromMajor((float) $order->total_amount),
            'Admin re-click',
        );
        $this->assertSame($refund->id, $again->id);
        $this->assertSame(
            $afterDashboard,
            Order::where('payment_status', '!=', 'failed')->where('payment_status', '!=', 'REFUNDED')->sum('total_amount'),
            'Re-click must not re-reverse'
        );
    }

    private function checkoutAndPay(User $customer, Vendor $vendor): Order
    {
        $order = app(OrderService::class)->createOrder($customer, [
            'order_type' => 'food',
            'payment_method' => 'online',
        ]);

        Payment::create([
            'payment_number' => 'PAY_GATE_'.uniqid(),
            'user_id' => $customer->id,
            'payable_type' => Order::class,
            'payable_id' => $order->id,
            'amount' => $order->total_amount,
            'amount_paise' => Money::fromMajor($order->total_amount)->paise(),
            'currency' => 'INR',
            'method' => 'card',
            'gateway' => 'mock',
            'status' => 'SUCCESS',
            'paid_at' => now(),
            'idempotency_key' => 'PG_'.Str::upper(Str::random(8)),
        ]);

        // Simulate the real-world race: order reached delivery/settlement
        // (commission + vendor settlement finalised) but was then cancelled.
        CommissionRule::create([
            'name' => 'Food 10%',
            'service' => 'food',
            'applicable_to' => 'vendor',
            'type' => 'percentage',
            'percentage_rate' => 10,
            'is_active' => true,
            'priority' => 1,
        ]);
        $order->update(['status' => 'DELIVERED', 'delivered_at' => now()]);
        app(CommissionService::class)->finalizeForOrder($order->fresh());
        $order->update(['status' => 'CANCELLED', 'cancelled_at' => now()]);

        return $order->fresh();
    }

    private function makeCustomer(string $phone): User
    {
        return User::factory()->create([
            'name' => 'Refund Customer',
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
            'phone' => '9898989006',
            'vendor_type' => 'restaurant',
            'status' => 'approved',
            'is_active' => true,
            'latitude' => 12.9716,
            'longitude' => 77.5946,
        ]);
    }

    private function makeProduct(Vendor $vendor, int $stock): Product
    {
        $sku = 'refund-sku-'.uniqid();
        $product = Product::create([
            'vendor_id' => $vendor->id,
            'name' => 'Refund Burger '.$sku,
            'slug' => 'refund-burger-'.Str::slug($sku),
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

    private function makeCartWithProduct(User $user, Vendor $vendor, Product $product): void
    {
        $cart = Cart::create([
            'user_id' => $user->id,
            'vendor_id' => $vendor->id,
            'cart_type' => 'food',
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
            'quantity' => 0,
            'line_total' => 0,
        ]);
        CartItem::where('cart_id', $cart->id)->update([
            'quantity' => 4,
            'line_total' => (float) $product->price * 4,
        ]);
    }

    private function refundService(): RefundService
    {
        return app(RefundService::class);
    }

    private function makeAdmin(): User
    {
        $admin = User::factory()->create(['user_type' => 'super_admin', 'is_active' => true]);
        $role = Role::firstOrCreate(['slug' => 'super_admin'], ['name' => 'SUPER_ADMIN', 'slug' => 'super_admin']);
        $admin->roles()->sync([$role->id]);

        return $admin;
    }
}
