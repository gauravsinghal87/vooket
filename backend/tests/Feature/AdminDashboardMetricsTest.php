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
use App\Models\Role;
use App\Models\User;
use App\Models\Vendor;
use App\Services\CommissionService;
use App\Services\OrderService;
use App\Support\Money;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AdminDashboardMetricsTest extends TestCase
{
    use RefreshDatabase;

    public function test_dashboard_separates_gross_order_value_from_platform_revenue(): void
    {
        $customer = $this->makeCustomer();
        $vendor = $this->makeVendor();
        $product = $this->makeProduct($vendor, 10);
        $this->makeCartWithProduct($customer, $vendor, $product);
        $order = $this->checkoutAndPay($customer);

        $gross = (float) $order->total_amount;
        $expectedCommission = (float) Commission::where('vendor_id', $vendor->id)->sum('commission_amount');

        $this->assertGreaterThan(0, $expectedCommission, 'A commission must have been recorded');

        Sanctum::actingAs($this->makeAdmin(), ['*']);

        $response = $this->getJson('/api/v1/admin/dashboard')->assertOk();

        $counts = $response->json('data.counts');

        $this->assertSame($gross, (float) $counts['total_gross_order_value']);
        $this->assertSame($expectedCommission, (float) $counts['total_platform_revenue']);

        // The old misleading keys must no longer exist.
        $this->assertArrayNotHasKey('total_revenue', $counts);
        $this->assertArrayNotHasKey('today_revenue', $counts);

        $this->assertNotEquals(
            (float) $counts['total_gross_order_value'],
            (float) $counts['total_platform_revenue'],
            'Gross order value and platform revenue are different numbers'
        );

        $series = collect($response->json('data.revenue_series'))->firstWhere('date', today()->toDateString());
        $this->assertSame($gross, (float) $series['gross_order_value']);
        $this->assertSame($expectedCommission, (float) $series['commission']);

        $topVendor = collect($response->json('data.top_vendors'))->firstWhere('id', $vendor->id);
        $this->assertSame($gross, (float) $topVendor['gross_order_value']);
        $this->assertSame($expectedCommission, (float) $topVendor['commission']);
    }

    public function test_reversed_commission_is_excluded_from_platform_revenue(): void
    {
        $customer = $this->makeCustomer();
        $vendor = $this->makeVendor();
        $product = $this->makeProduct($vendor, 10);
        $this->makeCartWithProduct($customer, $vendor, $product);
        $this->checkoutAndPay($customer);

        Commission::query()->update(['status' => 'reversed']);

        Sanctum::actingAs($this->makeAdmin(), ['*']);

        $response = $this->getJson('/api/v1/admin/dashboard')->assertOk();

        $this->assertSame(0.0, (float) $response->json('data.counts.total_platform_revenue'));
    }

    private function checkoutAndPay(User $customer): Order
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

        return $order->fresh();
    }

    private function makeCustomer(): User
    {
        return User::factory()->create([
            'name' => 'Dashboard Customer',
            'phone' => '9898981234',
            'user_type' => 'customer',
            'is_active' => true,
        ]);
    }

    private function makeVendor(): Vendor
    {
        $vendorUser = User::factory()->create(['user_type' => 'vendor', 'is_active' => true]);

        return Vendor::create([
            'user_id' => $vendorUser->id,
            'business_name' => 'Dashboard Kitchen',
            'owner_name' => 'Dashboard Owner',
            'phone' => '9898989007',
            'vendor_type' => 'restaurant',
            'status' => 'approved',
            'is_active' => true,
            'latitude' => 12.9716,
            'longitude' => 77.5946,
        ]);
    }

    private function makeProduct(Vendor $vendor, int $stock): Product
    {
        $sku = 'dashboard-sku-'.uniqid();
        $product = Product::create([
            'vendor_id' => $vendor->id,
            'name' => 'Dashboard Burger '.$sku,
            'slug' => 'dashboard-burger-'.Str::slug($sku),
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

    private function makeAdmin(): User
    {
        $admin = User::factory()->create(['user_type' => 'super_admin', 'is_active' => true]);
        $role = Role::firstOrCreate(['slug' => 'super_admin'], ['name' => 'SUPER_ADMIN']);
        $admin->roles()->sync([$role->id]);

        return $admin;
    }
}
