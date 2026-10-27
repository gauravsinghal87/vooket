<?php

namespace Tests\Feature;

use App\Models\DeliveryPartner;
use App\Models\DeliveryPartnerEarning;
use App\Models\Driver;
use App\Models\DriverEarning;
use App\Models\Order;
use App\Models\Ride;
use App\Models\Role;
use App\Models\User;
use App\Models\Vendor;
use App\Models\Wallet;
use App\Models\WalletTransaction;
use App\Services\WalletService;
use App\Support\Money;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PartnerWalletTest extends TestCase
{
    use RefreshDatabase;

    private WalletService $walletService;

    protected function setUp(): void
    {
        parent::setUp();

        $this->walletService = app(WalletService::class);
    }

    public function test_credit_earning_credits_wallet_exactly_once_with_service_tag(): void
    {
        [$partner, $earning] = $this->makePartnerEarning();

        $first = $this->walletService->creditEarning(
            $partner->user,
            'delivery_partner',
            Money::fromMajor(120.50),
            'food',
            DeliveryPartnerEarning::class,
            $earning->id,
            'Delivery earning'
        );

        $second = $this->walletService->creditEarning(
            $partner->user,
            'delivery_partner',
            Money::fromMajor(120.50),
            'food',
            DeliveryPartnerEarning::class,
            $earning->id,
            'Delivery earning'
        );

        $wallet = Wallet::where('user_id', $partner->user_id)->where('wallet_type', 'delivery_partner')->first();

        $this->assertSame($first->id, $second->id);
        $this->assertSame('120.50', (string) $wallet->balance);
        $this->assertSame(1, WalletTransaction::where('reference_type', DeliveryPartnerEarning::class)->where('reference_id', $earning->id)->count());
        $this->assertSame('EARNING', $first->type);
        $this->assertSame('food', (string) $first->service);
        $this->assertSame('credit', $first->direction);
    }

    public function test_credit_earning_service_tag_differentiates_food_and_grocery(): void
    {
        [$partner, $earning] = $this->makePartnerEarning();

        $this->walletService->creditEarning(
            $partner->user,
            'delivery_partner',
            Money::fromMajor(80),
            'food',
            DeliveryPartnerEarning::class,
            $earning->id,
            'Food delivery'
        );

        $second = $this->walletService->creditEarning(
            $partner->user,
            'delivery_partner',
            Money::fromMajor(80),
            'grocery',
            DeliveryPartnerEarning::class,
            $earning->id,
            'Grocery delivery'
        );

        $this->assertNotSame(
            WalletTransaction::where('reference_id', $earning->id)->value('idempotency_key'),
            $second->idempotency_key
        );
        $this->assertSame('160.00', $second->balance_after);
    }

    public function test_credit_earning_idempotent_across_reconcile_and_creation_paths(): void
    {
        [$partner, $earning] = $this->makePartnerEarning();

        $this->walletService->reconcileFinalizedEarnings($partner->user);
        $this->walletService->creditEarning(
            $partner->user,
            'delivery_partner',
            Money::fromMajor(120.50),
            'food',
            DeliveryPartnerEarning::class,
            $earning->id,
            'Delivery earning'
        );

        $wallet = Wallet::where('user_id', $partner->user_id)->where('wallet_type', 'delivery_partner')->first();

        $this->assertSame('120.50', (string) $wallet->balance);
        $this->assertSame(1, WalletTransaction::where('reference_type', DeliveryPartnerEarning::class)->where('reference_id', $earning->id)->count());
    }

    public function test_driver_earning_reconcile_and_direct_credit_are_exactly_once(): void
    {
        $driver = $this->makeDriver();
        $earning = $this->makeRide($driver, 140);

        $this->walletService->reconcileFinalizedEarnings($driver->user);
        $this->walletService->creditEarning(
            $driver->user,
            'driver',
            Money::fromMajor(140),
            'ride',
            DriverEarning::class,
            $earning->id,
            'Ride earning'
        );

        $wallet = Wallet::where('user_id', $driver->user_id)->where('wallet_type', 'driver')->first();

        $this->assertSame('140.00', (string) $wallet->balance);
        $this->assertSame(1, WalletTransaction::where('reference_type', DriverEarning::class)->where('reference_id', $earning->id)->count());
        $this->assertSame('ride', (string) WalletTransaction::where('reference_id', $earning->id)->first()->service);
    }

    public function test_partner_wallet_endpoint_returns_balance_and_available(): void
    {
        [$partner, $earning] = $this->makePartnerEarning();
        $this->walletService->creditEarning(
            $partner->user,
            'delivery_partner',
            Money::fromMajor(50),
            'food',
            DeliveryPartnerEarning::class,
            $earning->id,
            'Delivery earning'
        );

        Sanctum::actingAs($partner->user, ['*']);

        $this->getJson('/api/v1/delivery-partner/wallet')
            ->assertOk()
            ->assertJsonPath('data.wallet_type', 'delivery_partner')
            ->assertJsonPath('data.available_balance', 50);
    }

    public function test_partner_wallet_endpoint_reports_total_earned_separately_from_total_credited(): void
    {
        [$partner, $earning] = $this->makePartnerEarning();
        $this->walletService->creditEarning(
            $partner->user,
            'delivery_partner',
            Money::fromMajor(50),
            'food',
            DeliveryPartnerEarning::class,
            $earning->id,
            'Delivery earning'
        );

        $this->walletService->credit(
            $partner->user,
            'delivery_partner',
            30,
            'CREDIT',
            null,
            null,
            'Top-up',
            'topup_test',
            []
        );

        Sanctum::actingAs($partner->user, ['*']);

        $this->getJson('/api/v1/delivery-partner/wallet')
            ->assertOk()
            ->assertJsonPath('data.total_earned', 50)
            ->assertJsonPath('data.total_credited', 80)
            ->assertJsonPath('data.balance', 80)
            ->assertJsonPath('data.available_balance', 80);
    }

    public function test_driver_wallet_endpoint_reports_total_earned_separately_from_total_credited(): void
    {
        $driver = $this->makeDriver();
        $this->makeRide($driver, 140);
        $this->walletService->reconcileFinalizedEarnings($driver->user);

        $this->walletService->credit(
            $driver->user,
            'driver',
            60,
            'CREDIT',
            null,
            null,
            'Top-up',
            'driver_topup_test',
            []
        );

        Sanctum::actingAs($driver->user, ['*']);

        $this->getJson('/api/v1/driver/wallet')
            ->assertOk()
            ->assertJsonPath('data.total_earned', 140)
            ->assertJsonPath('data.total_credited', 200)
            ->assertJsonPath('data.balance', 200);
    }

    public function test_partner_wallet_transactions_endpoint_filters_by_service_and_direction(): void
    {
        [$partner, $earning] = $this->makePartnerEarning();

        $this->walletService->creditEarning(
            $partner->user,
            'delivery_partner',
            Money::fromMajor(50),
            'food',
            DeliveryPartnerEarning::class,
            $earning->id,
            'Food delivery'
        );

        $this->walletService->credit(
            $partner->user,
            'delivery_partner',
            30,
            'CREDIT',
            null,
            null,
            'Bonus',
            'bonus_1',
            []
        );

        Sanctum::actingAs($partner->user, ['*']);

        $food = $this->getJson('/api/v1/delivery-partner/wallet/transactions?service=food')
            ->assertOk()
            ->json('data.data');

        $this->assertCount(1, $food);
        $this->assertSame('EARNING', $food[0]['type']);
        $this->assertSame('food', $food[0]['service']);

        $debits = $this->getJson('/api/v1/delivery-partner/wallet/transactions?direction=debit')
            ->assertOk()
            ->json('data.data');

        $this->assertSame([], $debits);
    }

    private function makePartnerEarning(): array
    {
        $partner = $this->makePartner();
        $order = $this->makeOrder($partner);

        $earning = DeliveryPartnerEarning::create([
            'delivery_partner_id' => $partner->id,
            'order_id' => $order->id,
            'earning_number' => 'EARN_TEST_'.uniqid(),
            'amount' => 120.50,
            'currency' => 'INR',
            'type' => 'delivery',
            'status' => 'earned',
            'idempotency_key' => 'delivery:test-'.uniqid(),
            'meta' => ['order_number' => $order->order_number],
        ]);

        return [$partner, $earning];
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

    private function makeDriver(): Driver
    {
        $driverUser = User::factory()->create(['user_type' => 'driver', 'is_active' => true]);
        $driverUser->roles()->attach(Role::firstOrCreate(['slug' => 'driver'], ['name' => 'Driver']));

        return Driver::create([
            'user_id' => $driverUser->id,
            'status' => 'approved',
            'is_online' => true,
            'is_busy' => false,
            'latitude' => 12.9717,
            'longitude' => 77.5947,
            'last_location_at' => now(),
        ]);
    }

    private function makeOrder(DeliveryPartner $partner, string $orderType = 'food'): Order
    {
        $vendorUser = User::factory()->create(['user_type' => 'vendor', 'is_active' => true]);
        $vendor = Vendor::create([
            'user_id' => $vendorUser->id,
            'business_name' => 'Wallet Test Kitchen',
            'owner_name' => 'Owner',
            'phone' => '9898989100',
            'vendor_type' => 'restaurant',
            'status' => 'approved',
            'is_active' => true,
            'latitude' => 12.9716,
            'longitude' => 77.5946,
        ]);
        $customer = User::factory()->create(['user_type' => 'customer', 'is_active' => true]);

        return Order::create([
            'order_number' => 'ORD_'.Str::upper(Str::random(8)),
            'idempotency_key' => 'idem-'.uniqid(),
            'user_id' => $customer->id,
            'vendor_id' => $vendor->id,
            'order_type' => $orderType,
            'status' => 'DELIVERED',
            'payment_status' => 'paid',
            'payment_method' => 'cash_on_delivery',
            'subtotal' => 200,
            'delivery_fee' => 120.50,
            'total_amount' => 320.50,
            'delivery_partner_id' => $partner->id,
        ]);
    }

    private function makeRide(Driver $driver, float $earned): DriverEarning
    {
        $customer = User::factory()->create(['user_type' => 'customer', 'is_active' => true]);
        $ride = Ride::create([
            'ride_number' => 'RID_'.Str::upper(Str::random(8)),
            'user_id' => $customer->id,
            'driver_id' => $driver->id,
            'status' => Ride::STATUS_COMPLETED,
            'pickup_latitude' => 12.9717,
            'pickup_longitude' => 77.5947,
            'destination_latitude' => 12.9617,
            'destination_longitude' => 77.6047,
            'final_fare' => 200,
            'payment_method' => 'online',
            'payment_status' => Ride::PAYMENT_STATUS_PAID,
        ]);

        return DriverEarning::create([
            'driver_id' => $driver->id,
            'ride_id' => $ride->id,
            'trip_fare' => 200,
            'driver_percentage' => 70,
            'commission_percentage' => 30,
            'commission_amount' => 60,
            'earning_amount' => $earned,
            'currency' => 'INR',
            'status' => DriverEarning::STATUS_PAID,
        ]);
    }
}
