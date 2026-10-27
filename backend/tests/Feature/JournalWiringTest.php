<?php

namespace Tests\Feature;

use App\Models\Cart;
use App\Models\CartItem;
use App\Models\CommissionRule;
use App\Models\DeliveryPartner;
use App\Models\Inventory;
use App\Models\JournalEntry;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Product;
use App\Models\Role;
use App\Models\User;
use App\Models\Vendor;
use App\Services\DeliveryService;
use App\Services\JournalService;
use App\Services\OrderService;
use App\Services\PaymentService;
use App\Services\Pricing\DeliveryFeeService;
use App\Services\WalletService;
use App\Support\Money;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class JournalWiringTest extends TestCase
{
    use RefreshDatabase;

    private JournalService $journal;

    protected function setUp(): void
    {
        parent::setUp();

        $this->journal = app(JournalService::class);
    }

    public function test_wallet_movements_post_balanced_journal_entries(): void
    {
        $customer = $this->makeCustomer('9500000011');

        $credit = app(WalletService::class)->credit($customer, 'customer', 500, 'CREDIT', null, null, 'Top up');
        $debit = app(WalletService::class)->debit($customer, 'customer', 120, 'DEBIT', null, null, 'Spend');

        foreach ([$credit, $debit] as $transaction) {
            $entry = JournalEntry::where('transaction_id', $transaction->transaction_id)->firstOrFail();

            $this->assertSame(2, $entry->lines()->count());
            $this->assertTrue($entry->isBalanced());
            $this->assertDatabaseHas('journal_lines', [
                'journal_entry_id' => $entry->id,
                'account' => 'customer_wallet',
                'direction' => $transaction->direction === 'credit' ? 'credit' : 'debit',
            ]);
        }

        $this->assertTrue($this->journal->isBalanced());
        $this->assertEqualsWithDelta(380.0, (float) $this->journal->balance('customer_wallet')->major() * -1, 0.01);
    }

    public function test_captured_payment_books_gateway_clearing_and_revenue(): void
    {
        $customer = $this->makeCustomer('9500000012');
        $order = $this->makeOrder($customer);

        $payment = $this->captureOrderPayment($order);

        $entry = JournalEntry::where('source_type', Payment::class)
            ->where('source_id', $payment->id)
            ->where('entry_type', 'payment_captured')
            ->firstOrFail();

        $this->assertTrue($entry->isBalanced());
        $this->assertEqualsWithDelta((float) $order->total_amount, (float) $entry->total_debit, 0.01);
        $this->assertEqualsWithDelta((float) $order->total_amount, (float) $this->journal->balance('payment_clearing')->major(), 0.01);
        $this->assertTrue($this->journal->isBalanced());
    }

    public function test_full_online_order_flow_keeps_the_journal_balanced(): void
    {
        CommissionRule::create([
            'name' => 'Food 10%',
            'service' => 'food',
            'applicable_to' => 'vendor',
            'type' => 'percentage',
            'percentage_rate' => 10,
            'is_active' => true,
            'priority' => 1,
        ]);

        $customer = $this->makeCustomer('9500000013');
        $order = $this->makeOrder($customer);
        $this->captureOrderPayment($order);
        $order->update(['status' => 'READY']);

        $partner = $this->makePartner();
        $delivery = app(DeliveryService::class);
        $order = $delivery->claimOrder($order->fresh(), $partner);
        $delivery->markPickedUp($order, $partner);
        $delivery->markOutForDelivery($order, $partner);
        $delivery->markArrived($order, $partner);

        // Payment already captured online, so only the OTP gate is skipped
        // here to keep the test on the money movements.
        $delivery->markDelivered($order, $partner, null, false);

        $order = $order->fresh();

        $commission = (float) $order->commission_fee;
        $netVendor = (float) $order->net_vendor_payout;
        $partnerEarning = (float) $order->partner_payout;
        $total = (float) $order->total_amount;

        $this->assertSame(40, (int) $commission);
        $this->assertSame(360, (int) $netVendor);

        $balances = $this->journal->balances([
            'payment_clearing',
            'order_revenue_clearing',
            'platform_revenue',
            'vendor_wallet',
            'delivery_partner_wallet',
            'customer_wallet',
        ]);

        // The whole journal balances: no money event lost its other side.
        $this->assertTrue($this->journal->isBalanced());

        // Every captured rupee sits in the gateway clearing account.
        $this->assertEqualsWithDelta($total, $balances['payment_clearing']['net'], 0.01);

        // Commission income, vendor payout and partner earning are recognised.
        $this->assertEqualsWithDelta(-$commission, $balances['platform_revenue']['net'], 0.01);
        $this->assertEqualsWithDelta(-$netVendor, $balances['vendor_wallet']['net'], 0.01);
        $this->assertEqualsWithDelta(-$partnerEarning, $balances['delivery_partner_wallet']['net'], 0.01);
        $this->assertEqualsWithDelta(0.0, $balances['customer_wallet']['net'], 0.01);

        // The only revenue still owed out of the clearing account is the
        // delivery GST charged on top of the delivery fee (product tax is
        // tax-inclusive and already inside the vendor/commission split).
        $expectedGst = round(20.0 * (float) app(DeliveryFeeService::class)->gstPercent('food') / 100, 2);
        $this->assertEqualsWithDelta(-$expectedGst, $balances['order_revenue_clearing']['net'], 0.01);

        // Every money movement is recorded: capture + earning + settlement
        // + commission.
        $this->assertSame(4, JournalEntry::count());
        $this->assertSame(
            1,
            JournalEntry::where('entry_type', 'payment_captured')->count()
        );
        $this->assertSame(
            1,
            JournalEntry::where('entry_type', 'commission_accrued')->count()
        );
    }

    public function test_cash_order_collection_settlement_and_delivery_balance(): void
    {
        CommissionRule::create([
            'name' => 'Food 10%',
            'service' => 'food',
            'applicable_to' => 'vendor',
            'type' => 'percentage',
            'percentage_rate' => 10,
            'is_active' => true,
            'priority' => 1,
        ]);

        $customer = $this->makeCustomer('9500000014');
        $order = $this->makeOrder($customer, 'cash_on_delivery');
        $order->update(['status' => 'READY']);

        $partner = $this->makePartner();
        $delivery = app(DeliveryService::class);
        $order = $delivery->claimOrder($order->fresh(), $partner);
        $delivery->markPickedUp($order, $partner);
        $delivery->markOutForDelivery($order, $partner);
        $delivery->markArrived($order, $partner);

        $total = (float) $order->total_amount;

        // 1. Cash collected from the customer: no gateway capture exists, so
        //    the platform records the partner as owing the cash.
        $delivery->confirmPaymentCollection($order->fresh(), $partner, 'cash');

        $this->assertEqualsWithDelta($total, (float) $this->journal->balance('partner_cash_receivable')->major(), 0.01);
        $this->assertEqualsWithDelta(-$total, (float) $this->journal->balance('order_revenue_clearing')->major(), 0.01);

        // 2. The partner funds the settlement from their own wallet.
        app(WalletService::class)->credit($partner->user, 'delivery_partner', $total + 100, 'TOP_UP', null, null, 'Partner top up');
        $delivery->settleCashCollection($order->fresh(), $partner);

        $this->assertEqualsWithDelta(0.0, (float) $this->journal->balance('partner_cash_receivable')->major(), 0.01);
        $this->assertTrue($this->journal->isBalanced());

        // 3. Delivery finalises earning + commission + vendor settlement.
        $delivery->markDelivered($order->fresh(), $partner, null, false);

        $order = $order->fresh();

        $balances = $this->journal->balances([
            'partner_cash_receivable',
            'order_revenue_clearing',
            'platform_revenue',
            'vendor_wallet',
            'delivery_partner_wallet',
            'customer_wallet',
        ]);

        $this->assertTrue($this->journal->isBalanced());

        // Nothing owed on the cash: it was collected and handed over.
        $this->assertEqualsWithDelta(0.0, $balances['partner_cash_receivable']['net'], 0.01);

        // The customer never used a gateway or the wallet for a COD order.
        $this->assertEqualsWithDelta(0.0, $balances['customer_wallet']['net'], 0.01);

        // Commission, vendor payout and partner earning are recognised.
        $this->assertEqualsWithDelta(-(float) $order->commission_fee, $balances['platform_revenue']['net'], 0.01);
        $this->assertEqualsWithDelta(-(float) $order->net_vendor_payout, $balances['vendor_wallet']['net'], 0.01);

        // The partner's wallet ends with exactly the top-up left over: the
        // settlement consumed the collected cash and the earning credited
        // the delivery amount.
        $this->assertEqualsWithDelta(
            $total + 100 - $total + (float) $order->partner_payout,
            -$balances['delivery_partner_wallet']['net'],
            0.01
        );
    }

    private function captureOrderPayment(Order $order): Payment
    {
        $payment = Payment::create([
            'payment_number' => 'PAY_JRNL_'.uniqid(),
            'user_id' => $order->user_id,
            'payable_type' => Order::class,
            'payable_id' => $order->id,
            'amount' => $order->total_amount,
            'amount_paise' => Money::fromMajor($order->total_amount)->paise(),
            'currency' => 'INR',
            'method' => 'card',
            'gateway' => 'mock',
            'status' => 'INITIATED',
            'idempotency_key' => 'JRNL_'.Str::upper(Str::random(8)),
        ]);

        app(PaymentService::class)->capturePayment(
            $payment,
            Money::fromMajor($order->total_amount)->paise(),
            ['payment_id' => 'pay_mock_'.uniqid(), 'currency' => 'INR']
        );

        return $payment->fresh();
    }

    private function makeCustomer(string $phone): User
    {
        return User::factory()->create([
            'name' => 'Journal Customer',
            'phone' => $phone,
            'user_type' => 'customer',
            'is_active' => true,
        ]);
    }

    private function makeOrder(User $customer, string $paymentMethod = 'online'): Order
    {
        $vendorUser = User::factory()->create(['user_type' => 'vendor', 'is_active' => true]);
        $vendorUser->roles()->attach(Role::firstOrCreate(['slug' => 'vendor'], ['name' => 'Vendor']));

        $vendor = Vendor::create([
            'user_id' => $vendorUser->id,
            'business_name' => 'Journal Kitchen',
            'owner_name' => 'Journal Owner',
            'phone' => '9898989007',
            'vendor_type' => 'restaurant',
            'status' => 'approved',
            'is_active' => true,
            'latitude' => 12.9716,
            'longitude' => 77.5946,
        ]);

        $sku = 'journal-sku-'.uniqid();
        $product = Product::create([
            'vendor_id' => $vendor->id,
            'name' => 'Journal Burger '.$sku,
            'slug' => 'journal-burger-'.Str::slug($sku),
            'sku' => strtoupper($sku),
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

        $cart = Cart::create([
            'user_id' => $customer->id,
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
            'quantity' => 4,
            'line_total' => 400.0,
        ]);

        return app(OrderService::class)->createOrder($customer, [
            'order_type' => 'food',
            'payment_method' => $paymentMethod,
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
