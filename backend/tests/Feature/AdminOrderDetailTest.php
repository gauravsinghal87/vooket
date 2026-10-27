<?php

namespace Tests\Feature;

use App\Models\Commission;
use App\Models\DeliveryPartner;
use App\Models\DeliveryPartnerEarning;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Role;
use App\Models\Settlement;
use App\Models\SettlementItem;
use App\Models\User;
use App\Models\Vendor;
use App\Models\Wallet;
use App\Models\WalletTransaction;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AdminOrderDetailTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_order_detail_exposes_persisted_financial_records(): void
    {
        $admin = $this->makeAdmin();
        $order = $this->makeFinancialOrder();

        Sanctum::actingAs($admin, ['*']);

        $this->getJson("/api/v1/admin/orders/{$order->id}")
            ->assertOk()
            ->assertJsonPath('data.financial.order_bill.subtotal', '299.00')
            ->assertJsonPath('data.financial.order_bill.packaging_fee', '10.00')
            ->assertJsonPath('data.financial.order_bill.handling_fee', '15.00')
            ->assertJsonPath('data.financial.order_bill.total_amount', '324.00')
            ->assertJsonPath('data.financial.payments.0.payment_number', 'PAY_20261006105739_TEST')
            ->assertJsonPath('data.financial.payments.0.method', 'card')
            ->assertJsonPath('data.financial.payments.0.gateway', 'razorpay')
            ->assertJsonPath('data.financial.payments.0.status', 'SUCCESS')
            ->assertJsonPath('data.financial.vendor_settlement.settlement_number', 'STL_20261006113513_TEST')
            ->assertJsonPath('data.financial.vendor_settlement.status', 'processing')
            ->assertJsonPath('data.financial.vendor_settlement.gross_earnings', '299.00')
            ->assertJsonPath('data.financial.vendor_settlement.total_commission', '44.85')
            ->assertJsonPath('data.financial.vendor_settlement.net_payable', '254.15')
            ->assertJsonPath('data.financial.commissions.0.commission_amount', '44.85')
            ->assertJsonPath('data.financial.commissions.0.commission_rate', '15.00')
            ->assertJsonPath('data.financial.partner_earnings.0.amount', '20.00')
            ->assertJsonPath('data.financial.partner_earnings.0.status', 'earned')
            ->assertJsonPath('data.financial.partner_earnings.0.customer_delivery_fee', '0.00')
            ->assertJsonPath('data.financial.partner_earnings.0.admin_funded', '20.00')
            ->assertJsonPath('data.financial.platform.commission_fee', '44.85')
            ->assertJsonPath('data.financial.platform.admin_funded_delivery', '20.00')
            ->assertJsonPath('data.financial.wallet_transactions.0.direction', 'credit')
            ->assertJsonPath('data.financial.refunds', [])
            ->assertJsonPath('data.packaging_fee', '10.00')
            ->assertJsonPath('data.commission_fee', '44.85')
            ->assertJsonPath('data.net_vendor_payout', '254.15')
            ->assertJsonPath('data.vendor_payout_status', 'pending');
    }

    public function test_admin_order_detail_requires_super_admin_authorization(): void
    {
        $order = $this->makeFinancialOrder();
        $customer = User::factory()->create(['user_type' => 'customer', 'is_active' => true]);

        $this->getJson("/api/v1/admin/orders/{$order->id}")->assertStatus(401);

        Sanctum::actingAs($customer, ['*']);
        $this->getJson("/api/v1/admin/orders/{$order->id}")->assertStatus(403);
    }

    public function test_admin_order_detail_returns_not_found_for_unknown_order(): void
    {
        $admin = $this->makeAdmin();

        Sanctum::actingAs($admin, ['*']);

        $this->getJson('/api/v1/admin/orders/999999')->assertStatus(404);
    }

    public function test_admin_order_index_stays_lightweight_without_financial_payload(): void
    {
        $admin = $this->makeAdmin();
        $order = $this->makeFinancialOrder();

        Sanctum::actingAs($admin, ['*']);

        $this->getJson('/api/v1/admin/orders?service=food')->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonMissingPath('data.0.financial')
            ->assertJsonFragment(['order_number' => $order->order_number]);
    }

    private function makeAdmin(): User
    {
        Role::updateOrCreate(['slug' => 'super_admin'], ['name' => 'Super Admin', 'is_system' => true]);
        $admin = User::factory()->create([
            'name' => 'Financial Admin',
            'email' => 'financial-admin@example.com',
            'user_type' => 'super_admin',
            'is_active' => true,
        ]);
        $admin->roles()->sync([Role::where('slug', 'super_admin')->first()->id]);

        return $admin;
    }

    private function makeFinancialOrder(): Order
    {
        $customer = User::factory()->create(['user_type' => 'customer', 'is_active' => true]);
        $vendorUser = User::factory()->create(['user_type' => 'vendor', 'is_active' => true]);
        $vendor = Vendor::create([
            'user_id' => $vendorUser->id,
            'business_name' => 'Financial Test Kitchen',
            'owner_name' => 'Owner',
            'phone' => '9898989222',
            'vendor_type' => 'restaurant',
            'status' => 'approved',
            'is_active' => true,
            'latitude' => 12.9716,
            'longitude' => 77.5946,
        ]);

        $order = Order::create([
            'order_number' => 'ORD_'.Str::upper(Str::random(8)),
            'idempotency_key' => 'idem-'.uniqid('', true),
            'user_id' => $customer->id,
            'vendor_id' => $vendor->id,
            'restaurant_id' => null,
            'order_type' => 'food',
            'status' => 'DELIVERED',
            'payment_status' => 'paid',
            'payment_method' => 'online',
            'subtotal' => 299,
            'discount_amount' => 0,
            'tax_amount' => 0,
            'delivery_fee' => 0,
            'packaging_fee' => 10,
            'handling_fee' => 15,
            'platform_fee' => 0,
            'tip_amount' => 0,
            'wallet_used' => 0,
            'round_off' => 0,
            'total_amount' => 324,
            'commission_fee' => 44.85,
            'net_vendor_payout' => 254.15,
            'vendor_payout_status' => 'pending',
            'partner_payout' => 20,
            'partner_payout_status' => 'pending',
            'delivered_at' => now(),
        ]);

        Payment::create([
            'payment_number' => 'PAY_20261006105739_TEST',
            'user_id' => $customer->id,
            'payable_type' => Order::class,
            'payable_id' => $order->id,
            'amount' => 324,
            'currency' => 'INR',
            'method' => 'card',
            'gateway' => 'razorpay',
            'status' => 'SUCCESS',
            'paid_at' => now(),
            'verified_at' => now(),
        ]);

        $settlement = Settlement::create([
            'settlement_number' => 'STL_20261006113513_TEST',
            'party_type' => 'vendor',
            'vendor_id' => $vendor->id,
            'gross_earnings' => 299,
            'total_commission' => 44.85,
            'net_payable' => 254.15,
            'status' => 'processing',
            'period_start' => today(),
            'period_end' => today(),
            'period_type' => 'daily',
        ]);

        SettlementItem::create([
            'settlement_id' => $settlement->id,
            'source_type' => 'order',
            'source_id' => $order->id,
            'amount' => 254.15,
            'direction' => 'credit',
            'description' => 'Net payout for order '.$order->order_number,
            'meta' => ['order_number' => $order->order_number, 'gross' => 299, 'commission' => 44.85, 'net' => 254.15],
        ]);

        Commission::create([
            'commission_number' => 'CMM_20261006113513_TEST',
            'service' => 'food',
            'party_type' => 'vendor',
            'vendor_id' => $vendor->id,
            'source_type' => 'order',
            'source_id' => $order->id,
            'gross_amount' => 299,
            'commission_amount' => 44.85,
            'commission_rate' => 15,
            'commission_type' => 'percentage',
            'net_amount' => 254.15,
            'status' => 'calculated',
        ]);

        $wallet = Wallet::create([
            'user_id' => $vendorUser->id,
            'wallet_type' => 'vendor',
            'balance' => 254.15,
            'total_credited' => 254.15,
        ]);

        WalletTransaction::create([
            'transaction_id' => 'WTX_'.Str::upper(Str::random(8)),
            'wallet_id' => $wallet->id,
            'user_id' => $vendorUser->id,
            'type' => 'SETTLEMENT',
            'amount' => 254.15,
            'balance_before' => 0,
            'balance_after' => 254.15,
            'currency' => 'INR',
            'direction' => 'credit',
            'status' => 'completed',
            'reference_type' => 'order',
            'reference_id' => $order->id,
            'description' => 'Net vendor earnings for order '.$order->order_number,
        ]);

        $partnerUser = User::factory()->create(['user_type' => 'delivery_partner', 'is_active' => true]);
        $partner = DeliveryPartner::create([
            'user_id' => $partnerUser->id,
            'status' => 'approved',
            'service_type' => 'food',
            'is_online' => true,
            'is_busy' => false,
        ]);

        DeliveryPartnerEarning::create([
            'delivery_partner_id' => $partner->id,
            'order_id' => $order->id,
            'earning_number' => 'EARN_20261006113513_TEST',
            'amount' => 20,
            'type' => 'delivery',
            'status' => 'earned',
            'meta' => [
                'order_number' => $order->order_number,
                'earning_breakdown' => [
                    'basis' => 'accepted_offer_snapshot',
                    'per_km' => 5,
                    'service' => 'food',
                    'distance_km' => 0.57,
                    'platform_funded' => 20,
                    'free_distance_km' => 2,
                    'customer_delivery_fee' => 0,
                    'additional_distance_km' => 0,
                    'first_distance_earning' => 20,
                ],
            ],
        ]);

        $order->setRelation('deliveryPartner', $partner);

        return $order;
    }
}
