<?php

namespace Tests\Feature;

use App\Models\FinancialAdjustment;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Payment;
use App\Models\Product;
use App\Models\Refund;
use App\Models\Role;
use App\Models\User;
use App\Models\Vendor;
use App\Services\GroceryAdjustmentService;
use App\Services\RefundService;
use App\Support\Money;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class GroceryAdjustmentTest extends TestCase
{
    use RefreshDatabase;

    private function makeUser(string $type = 'customer'): User
    {
        return User::factory()->create(['user_type' => $type, 'is_active' => true]);
    }

    private function makeAdmin(): User
    {
        $admin = User::factory()->create(['user_type' => 'super_admin', 'is_active' => true]);
        $role = Role::firstOrCreate(['slug' => 'super_admin'], ['name' => 'SUPER_ADMIN', 'slug' => 'super_admin']);
        $admin->roles()->sync([$role->id]);

        return $admin;
    }

    private function makeVendor(): Vendor
    {
        return Vendor::create([
            'user_id' => $this->makeUser('vendor')->id,
            'business_name' => 'FreshMart',
            'owner_name' => 'Grocery Owner',
            'phone' => '9898980701',
            'vendor_type' => 'grocery',
            'status' => 'approved',
            'is_active' => true,
            'commission_rate' => 10,
        ]);
    }

    /**
     * A delivered, online-paid grocery order. Item prices are tax-inclusive
     * and a can of milk (200.00) is damaged in one of the two units.
     *
     * @return array{Order, array<int, OrderItem>, Payment}
     */
    private function makeDeliveredGroceryOrder(int $milkQty = 2, int $breadQty = 1): array
    {
        $customer = $this->makeUser();
        $vendor = $this->makeVendor();

        $milk = $this->makeProduct($vendor, 'Milk 1L', 100.0);
        $bread = $this->makeProduct($vendor, 'Bread', 50.0);

        $subtotal = (100.0 * $milkQty) + (50.0 * $breadQty);
        $deliveryFee = 20.0;
        $deliveryGst = round($deliveryFee * 18 / 100, 2);
        $total = $subtotal + $deliveryFee + $deliveryGst;

        $order = Order::create([
            'order_number' => 'ORD_GRO_'.Str::upper(Str::random(8)),
            'user_id' => $customer->id,
            'vendor_id' => $vendor->id,
            'store_id' => null,
            'order_type' => 'grocery',
            'status' => 'DELIVERED',
            'payment_status' => 'PAID',
            'payment_method' => 'online',
            'subtotal' => $subtotal,
            'discount_amount' => 0,
            'delivery_fee' => $deliveryFee,
            'delivery_gst_percent' => 18,
            'delivery_gst_amount' => $deliveryGst,
            'total_amount' => $total,
            'net_vendor_payout' => $subtotal,
            'delivered_at' => now(),
        ]);

        $milkItem = OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $milk->id,
            'product_name' => 'Milk 1L',
            'unit_price' => 100.0,
            'price_snapshot' => 100.0,
            'quantity' => $milkQty,
            'line_total' => 100.0 * $milkQty,
            'status' => 'active',
        ]);

        $breadItem = OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $bread->id,
            'product_name' => 'Bread',
            'unit_price' => 50.0,
            'price_snapshot' => 50.0,
            'quantity' => $breadQty,
            'line_total' => 50.0 * $breadQty,
            'status' => 'active',
        ]);

        $payment = Payment::create([
            'payment_number' => 'PAY_GRO_'.uniqid(),
            'user_id' => $customer->id,
            'payable_type' => Order::class,
            'payable_id' => $order->id,
            'amount' => $total,
            'amount_paise' => Money::fromMajor($total)->paise(),
            'currency' => 'INR',
            'method' => 'card',
            'gateway' => 'mock',
            'status' => 'SUCCESS',
            'paid_at' => now(),
            'idempotency_key' => 'PG_'.Str::upper(Str::random(8)),
        ]);

        return [$order->fresh(), [$milkItem, $breadItem], $payment];
    }

    private function makeProduct(Vendor $vendor, string $name, float $price): Product
    {
        $sku = 'gro-'.uniqid();

        return Product::create([
            'vendor_id' => $vendor->id,
            'name' => $name,
            'slug' => Str::slug($name).'-'.Str::random(4),
            'sku' => $sku,
            'price' => $price,
            'type' => 'grocery',
            'tax_rate' => 0,
            'is_active' => true,
            'is_available' => true,
        ]);
    }

    public function test_refunds_a_specific_quantity_derived_from_the_line_price(): void
    {
        [$order, $items] = $this->makeDeliveredGroceryOrder(milkQty: 2);
        [$milkItem] = $items;

        $result = app(GroceryAdjustmentService::class)->adjustItems(
            $this->makeAdmin(),
            $order,
            [['order_item_id' => $milkItem->id, 'quantity' => 1]],
            'Damaged milk packet',
            null,
            RefundService::DESTINATION_WALLET,
        );

        // One unit of a 100.00 line refunds exactly 100.00 (tax-inclusive price).
        $this->assertSame('100.00', $result['refund_amount']);
        $this->assertSame('COMPLETED', $result['refund']->status);

        $milkItem->refresh();
        $this->assertSame(1, (int) $milkItem->adjusted_quantity);
        $this->assertSame('100.00', (string) $milkItem->refunded_amount);

        $this->assertSame('100.00', (string) $result['refund']->amount);
        $this->assertDatabaseHas('financial_adjustments', [
            'reference_type' => Refund::class,
            'reference_id' => $result['refund']->id,
        ]);
    }

    public function test_refunds_multiple_lines_in_one_adjustment(): void
    {
        [$order, $items] = $this->makeDeliveredGroceryOrder(milkQty: 2, breadQty: 1);
        [$milkItem, $breadItem] = $items;

        $result = app(GroceryAdjustmentService::class)->adjustItems(
            $this->makeAdmin(),
            $order,
            [
                ['order_item_id' => $milkItem->id, 'quantity' => 2],
                ['order_item_id' => $breadItem->id, 'quantity' => 1],
            ],
            'Whole order items missing',
            null,
            RefundService::DESTINATION_WALLET,
        );

        // 2 * 100.00 + 1 * 50.00 = 250.00
        $this->assertSame('250.00', $result['refund_amount']);
        $this->assertCount(2, $result['adjustments']);
    }

    public function test_cannot_adjust_more_units_than_the_line_has(): void
    {
        [$order, $items] = $this->makeDeliveredGroceryOrder(milkQty: 2);
        [$milkItem] = $items;

        $this->expectException(\RuntimeException::class);

        app(GroceryAdjustmentService::class)->adjustItems(
            $this->makeAdmin(),
            $order,
            [['order_item_id' => $milkItem->id, 'quantity' => 3]],
            'Too many units',
            null,
            RefundService::DESTINATION_WALLET,
        );
    }

    public function test_a_unit_cannot_be_adjusted_twice(): void
    {
        [$order, $items] = $this->makeDeliveredGroceryOrder(milkQty: 1);
        [$milkItem] = $items;

        app(GroceryAdjustmentService::class)->adjustItems(
            $this->makeAdmin(),
            $order,
            [['order_item_id' => $milkItem->id, 'quantity' => 1]],
            'First adjustment',
            null,
            RefundService::DESTINATION_WALLET,
        );

        $this->expectException(\RuntimeException::class);

        app(GroceryAdjustmentService::class)->adjustItems(
            $this->makeAdmin(),
            $order->fresh(),
            [['order_item_id' => $milkItem->id, 'quantity' => 1]],
            'Second adjustment on the same unit',
            null,
            RefundService::DESTINATION_WALLET,
        );
    }

    public function test_cannot_adjust_a_non_grocery_order(): void
    {
        [$order] = $this->makeDeliveredGroceryOrder();
        $order->update(['order_type' => 'food']);

        $item = $order->items()->first();

        $this->expectException(\RuntimeException::class);

        app(GroceryAdjustmentService::class)->adjustItems(
            $this->makeAdmin(),
            $order->fresh(),
            [['order_item_id' => $item->id, 'quantity' => 1]],
            'Wrong service',
            null,
            RefundService::DESTINATION_WALLET,
        );
    }

    public function test_repeated_adjustment_is_idempotent(): void
    {
        [$order, $items] = $this->makeDeliveredGroceryOrder(milkQty: 2);
        [$milkItem] = $items;

        $first = app(GroceryAdjustmentService::class)->adjustItems(
            $this->makeAdmin(),
            $order,
            [['order_item_id' => $milkItem->id, 'quantity' => 1]],
            'Damaged milk packet',
            null,
            RefundService::DESTINATION_WALLET,
        );

        $second = app(GroceryAdjustmentService::class)->adjustItems(
            $this->makeAdmin(),
            $order->fresh(),
            [['order_item_id' => $milkItem->id, 'quantity' => 1]],
            'Damaged milk packet',
            null,
            RefundService::DESTINATION_WALLET,
        );

        $this->assertSame($first['refund']->id, $second['refund']->id);
        $this->assertSame(1, (int) $milkItem->fresh()->adjusted_quantity);
        $this->assertSame(1, FinancialAdjustment::count());
    }

    public function test_refund_cannot_exceed_the_payment_balance(): void
    {
        [$order, $items] = $this->makeDeliveredGroceryOrder(milkQty: 2, breadQty: 1);
        [$milkItem, $breadItem] = $items;

        // Refund the whole order once...
        app(GroceryAdjustmentService::class)->adjustItems(
            $this->makeAdmin(),
            $order,
            [
                ['order_item_id' => $milkItem->id, 'quantity' => 2],
                ['order_item_id' => $breadItem->id, 'quantity' => 1],
            ],
            'Whole order',
            null,
            RefundService::DESTINATION_WALLET,
        );

        // ...then the delivery fee remains as the only refundable balance;
        // a second merchandise adjustment must not push past it.
        $this->expectException(\RuntimeException::class);

        app(GroceryAdjustmentService::class)->adjustItems(
            $this->makeAdmin(),
            $order->fresh(),
            [['order_item_id' => $breadItem->id, 'quantity' => 1]],
            'Extra attempt',
            null,
            RefundService::DESTINATION_WALLET,
        );
    }

    public function test_admin_endpoint_derives_the_amount_from_the_line(): void
    {
        [$order, $items] = $this->makeDeliveredGroceryOrder(milkQty: 2);
        [$milkItem] = $items;

        Sanctum::actingAs($this->makeAdmin(), ['*']);

        $response = $this->postJson("/api/v1/admin/orders/{$order->id}/adjust-items", [
            'items' => [['order_item_id' => $milkItem->id, 'quantity' => 1]],
            'reason' => 'Damaged milk packet',
            'destination' => 'wallet',
        ]);

        $response->assertStatus(201);
        $this->assertSame('100.00', $response->json('data.refund_amount'));
        $this->assertSame(1, (int) $milkItem->fresh()->adjusted_quantity);
    }

    public function test_admin_endpoint_rejects_an_inflated_quantity(): void
    {
        [$order, $items] = $this->makeDeliveredGroceryOrder(milkQty: 1);
        [$milkItem] = $items;

        Sanctum::actingAs($this->makeAdmin(), ['*']);

        $response = $this->postJson("/api/v1/admin/orders/{$order->id}/adjust-items", [
            'items' => [['order_item_id' => $milkItem->id, 'quantity' => 5]],
            'reason' => 'Too many',
        ]);

        $response->assertStatus(422);
    }
}
