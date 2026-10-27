<?php

namespace Tests\Feature;

use App\Models\Address;
use App\Models\Cart;
use App\Models\CartItem;
use App\Models\DeliveryPartner;
use App\Models\DeliveryPartnerEarning;
use App\Models\Inventory;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Product;
use App\Models\Role;
use App\Models\User;
use App\Models\Vendor;
use App\Models\Wallet;
use App\Models\WalletTransaction;
use App\Services\DeliveryService;
use App\Services\OrderService;
use App\Services\RefundService;
use App\Services\WalletService;
use App\Support\Money;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class VendorRefundReconciliationTest extends TestCase
{
    use RefreshDatabase;

    public function test_delivered_wallet_refund_debits_vendor_wallet_exactly_once(): void
    {
        [$order, $partner] = $this->buildDeliveredOrder(0.0);

        // Attach a successful gateway payment so the refund flow can resolve it.
        Payment::create([
            'payment_number' => 'PAY_TEST_'.uniqid(),
            'user_id' => $order->user_id,
            'payable_type' => Order::class,
            'payable_id' => $order->id,
            'amount' => $order->total_amount,
            'amount_paise' => Money::fromMajor($order->total_amount)->paise(),
            'currency' => 'INR',
            'method' => 'card',
            'gateway' => 'test',
            'status' => 'SUCCESS',
            'paid_at' => now(),
            'idempotency_key' => 'PG_'.uniqid(),
        ]);

        $vendor = $order->vendor;
        $vendorUser = $vendor->user;

        $vendorWalletBefore = Wallet::where('user_id', $vendorUser->id)->where('wallet_type', 'vendor')->firstOrFail();
        $balanceBefore = (float) $vendorWalletBefore->balance;
        $debitCountBefore = WalletTransaction::where('wallet_id', $vendorWalletBefore->id)->where('direction', 'debit')->count();
        $this->assertSame(0, $debitCountBefore);

        $partnerEarningBefore = DeliveryPartnerEarning::where('order_id', $order->id)->value('amount');

        $refund = app(RefundService::class)->refundDeliveredOrder(
            $order,
            $this->makeAdmin(),
            Money::fromMajor((float) $order->total_amount),
            'food_quality',
            null,
            'wallet',
        );

        $this->assertSame('COMPLETED', $refund->status);

        $vendorWalletAfter = Wallet::where('user_id', $vendorUser->id)->where('wallet_type', 'vendor')->firstOrFail();
        $this->assertLessThan($balanceBefore, (float) $vendorWalletAfter->balance, 'Vendor balance must decrease');

        $debits = WalletTransaction::where('wallet_id', $vendorWalletAfter->id)
            ->where('direction', 'debit')
            ->get();
        $this->assertCount(1, $debits, 'Exactly one vendor debit');
        $this->assertSame('completed', $debits->first()->status);

        // Delivery partner earning preserved.
        $this->assertSame($partnerEarningBefore, DeliveryPartnerEarning::where('order_id', $order->id)->value('amount'));

        // Idempotency: reconcile retry must not add a debit.
        $debitsBeforeRetry = WalletTransaction::where('wallet_id', $vendorWalletAfter->id)->where('direction', 'debit')->count();
        app(RefundService::class)->reconcileDeliveredRefund($order);
        $debitsAfterRetry = WalletTransaction::where('wallet_id', $vendorWalletAfter->id)->where('direction', 'debit')->count();
        $this->assertSame($debitsBeforeRetry, $debitsAfterRetry, 'No duplicate debit on retry');
    }

    private function buildDeliveredOrder(float $walletBalance): array
    {
        $user = User::factory()->create(['name' => 'Customer', 'phone' => '9100000401', 'user_type' => 'customer', 'is_active' => true]);
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
            'name' => 'Settle Burger',
            'slug' => 'settle-burger-'.uniqid(),
            'sku' => 'SKU_SETTLE_'.uniqid(),
            'price' => 100,
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

        if ($walletBalance > 0) {
            app(WalletService::class)->credit($user, 'customer', $walletBalance, 'CREDIT', null, null, 'Test credit');
        }

        $address = Address::create([
            'user_id' => $user->id,
            'label' => 'Home',
            'contact_name' => 'Customer',
            'contact_phone' => '9100000401',
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
            'quantity' => 4,
            'line_total' => round($product->price * 4, 2),
        ]);

        $paymentMethod = $walletBalance > 0 ? 'wallet' : 'cash_on_delivery';
        $order = app(OrderService::class)->createOrder($user, [
            'order_type' => 'food',
            'payment_method' => $paymentMethod,
            'address_id' => $address->id,
        ]);

        $order->update(['status' => 'READY']);

        $partnerUser = User::factory()->create(['user_type' => 'delivery_partner', 'is_active' => true]);
        $partnerUser->roles()->attach(Role::firstOrCreate(['slug' => 'delivery_partner'], ['name' => 'Delivery Partner']));
        $partner = DeliveryPartner::create([
            'user_id' => $partnerUser->id,
            'status' => 'approved',
            'service_type' => 'food',
            'is_online' => true,
            'is_busy' => false,
            'latitude' => 12.9717,
            'longitude' => 77.5947,
            'last_location_at' => now(),
        ]);

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

        $order = $order->fresh();
        $order->load('vendor');

        return [$order, $partner];
    }

    private function makeAdmin(): User
    {
        $admin = User::factory()->create(['user_type' => 'super_admin', 'is_active' => true]);
        $role = Role::firstOrCreate(['slug' => 'super_admin'], ['name' => 'SUPER_ADMIN', 'slug' => 'super_admin']);
        $admin->roles()->sync([$role->id]);

        return $admin;
    }
}
