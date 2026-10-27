<?php

namespace Tests\Feature;

use App\Models\AppSetting;
use App\Models\Driver;
use App\Models\DriverEarning;
use App\Models\Payout;
use App\Models\Ride;
use App\Models\Role;
use App\Models\User;
use App\Models\Wallet;
use App\Models\WalletTransaction;
use App\Services\WalletService;
use App\Services\WithdrawalService;
use App\Support\Money;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PayoutControlsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config(['partner_payout.min_wallet_balance' => '0']);
        config(['vendor_payout.min_wallet_balance' => '0']);

        AppSetting::where('key', 'partner_min_wallet_balance')->update(['value' => '0']);
        AppSetting::firstOrCreate(
            ['key' => 'partner_min_wallet_balance'],
            ['group' => 'partner_payout', 'label' => 'Partner Min Wallet Balance', 'value' => '0', 'type' => 'number']
        );
    }

    public function test_wallet_withdrawal_reserves_the_amount_into_pending_balance(): void
    {
        $user = $this->makeCustomer();
        app(WalletService::class)->credit($user, 'customer', 1000, 'TOP_UP', null, null, 'Top up');

        $payout = app(WithdrawalService::class)->requestWalletWithdrawal($user, Money::fromMajor(400), 'customer');

        $this->assertSame('PENDING', $payout->status);
        $this->assertSame(400.0, (float) $payout->amount);

        $wallet = Wallet::where('user_id', $user->id)->where('wallet_type', 'customer')->firstOrFail();
        $this->assertSame(1000.0, (float) $wallet->balance, 'Reservation must not debit the balance yet');
        $this->assertSame(400.0, (float) $wallet->pending_balance);

        $this->assertSame(600.0, (float) app(WalletService::class)->available($user, 'customer')->major());
    }

    public function test_wallet_withdrawal_replay_is_idempotent_and_reserves_once(): void
    {
        $user = $this->makeCustomer();
        app(WalletService::class)->credit($user, 'customer', 1000, 'TOP_UP', null, null, 'Top up');

        $first = app(WithdrawalService::class)->requestWalletWithdrawal($user, Money::fromMajor(400), 'customer', 'TEST_KEY_1');
        $second = app(WithdrawalService::class)->requestWalletWithdrawal($user, Money::fromMajor(400), 'customer', 'TEST_KEY_1');

        $this->assertSame($first->id, $second->id);

        $wallet = Wallet::where('user_id', $user->id)->where('wallet_type', 'customer')->firstOrFail();
        $this->assertSame(400.0, (float) $wallet->pending_balance, 'Replay must not reserve twice');
        $this->assertSame(1, Payout::where('idempotency_key', 'TEST_KEY_1')->count());
    }

    public function test_wallet_withdrawal_rejects_an_amount_above_the_available_balance(): void
    {
        $user = $this->makeCustomer();
        app(WalletService::class)->credit($user, 'customer', 100, 'TOP_UP', null, null, 'Top up');

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('Insufficient wallet balance');

        app(WithdrawalService::class)->requestWalletWithdrawal($user, Money::fromMajor(500), 'customer');
    }

    public function test_second_wallet_withdrawal_cannot_exceed_the_unreserved_balance(): void
    {
        $user = $this->makeCustomer();
        app(WalletService::class)->credit($user, 'customer', 1000, 'TOP_UP', null, null, 'Top up');

        app(WithdrawalService::class)->requestWalletWithdrawal($user, Money::fromMajor(700), 'customer');

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('Insufficient wallet balance');

        app(WithdrawalService::class)->requestWalletWithdrawal($user, Money::fromMajor(400), 'customer');
    }

    public function test_payout_paid_drains_pending_balance_and_posts_journal(): void
    {
        $user = $this->makeCustomer();
        app(WalletService::class)->credit($user, 'customer', 1000, 'TOP_UP', null, null, 'Top up');

        $payout = app(WithdrawalService::class)->requestWalletWithdrawal($user, Money::fromMajor(400), 'customer');

        app(WithdrawalService::class)->markPayoutSuccess($payout);

        $wallet = Wallet::where('user_id', $user->id)->where('wallet_type', 'customer')->firstOrFail();
        $this->assertSame(600.0, (float) $wallet->balance);
        $this->assertSame(0.0, (float) $wallet->pending_balance);
        $this->assertSame('SUCCESS', $payout->fresh()->status);

        $tx = WalletTransaction::where('wallet_id', $wallet->id)->where('type', 'WITHDRAWAL')->firstOrFail();
        $this->assertDatabaseHas('journal_entries', ['idempotency_key' => 'payout:finalize:'.$tx->transaction_id]);
    }

    public function test_payout_failed_releases_the_reservation(): void
    {
        $user = $this->makeCustomer();
        app(WalletService::class)->credit($user, 'customer', 1000, 'TOP_UP', null, null, 'Top up');

        $payout = app(WithdrawalService::class)->requestWalletWithdrawal($user, Money::fromMajor(400), 'customer');

        app(WithdrawalService::class)->markPayoutFailed($payout, 'Bank rejected');

        $wallet = Wallet::where('user_id', $user->id)->where('wallet_type', 'customer')->firstOrFail();
        $this->assertSame(1000.0, (float) $wallet->balance, 'Failed payout must return the funds');
        $this->assertSame(0.0, (float) $wallet->pending_balance);
        $this->assertSame('FAILED', $payout->fresh()->status);
        $this->assertSame(1000.0, (float) app(WalletService::class)->available($user, 'customer')->major());
    }

    public function test_driver_earnings_payout_cannot_be_requested_twice_for_the_same_earnings(): void
    {
        [$driver, $earning] = $this->makeDriverWithEarning(200.0);
        $driver->update(['bank_account_number' => '1234567890', 'bank_ifsc' => 'HDFC0001234']);

        $payout = app(WithdrawalService::class)->requestDriverWithdrawal($driver->user, Money::fromMajor(200));

        $this->assertSame(200.0, (float) $payout->amount);

        try {
            app(WithdrawalService::class)->requestDriverWithdrawal($driver->user, Money::fromMajor(200));
            $this->fail('A second payout for the same earnings must be rejected');
        } catch (\RuntimeException) {
            // expected: the earnings are already fully committed
        }

        $this->assertSame(1, Payout::where('driver_id', $driver->id)->count());
    }

    public function test_admin_only_can_approve_payouts(): void
    {
        [$driver] = $this->makeDriverWithEarning(100.0);
        $driver->update(['bank_account_number' => '1234567890', 'bank_ifsc' => 'HDFC0001234']);
        $payout = app(WithdrawalService::class)->requestDriverWithdrawal($driver->user, Money::fromMajor(100));

        Sanctum::actingAs($this->makeCustomer(), ['*']);
        $this->postJson("/api/v1/admin/payouts/{$payout->id}/paid")->assertStatus(403);

        Sanctum::actingAs($driver->user, ['*']);
        $this->postJson("/api/v1/admin/payouts/{$payout->id}/paid")->assertStatus(403);

        Sanctum::actingAs($this->makeAdmin(), ['*']);
        $this->postJson("/api/v1/admin/payouts/{$payout->id}/paid")->assertOk();
        $this->assertSame('SUCCESS', $payout->fresh()->status);
    }

    public function test_admin_payout_state_transitions_follow_the_lifecycle(): void
    {
        $admin = $this->makeAdmin();
        [$driver] = $this->makeDriverWithEarning(100.0);
        $driver->update(['bank_account_number' => '1234567890', 'bank_ifsc' => 'HDFC0001234']);
        $payout = app(WithdrawalService::class)->requestDriverWithdrawal($driver->user, Money::fromMajor(100));

        Sanctum::actingAs($admin, ['*']);

        $this->postJson("/api/v1/admin/payouts/{$payout->id}/processing")->assertOk();
        $this->assertSame('PROCESSING', $payout->fresh()->status);

        $this->postJson("/api/v1/admin/payouts/{$payout->id}/paid")->assertOk();
        $this->assertSame('SUCCESS', $payout->fresh()->status);

        // Already-success payout cannot be re-failed into a contradictory state.
        $this->postJson("/api/v1/admin/payouts/{$payout->id}/failed", ['reason' => 'oops'])->assertStatus(422);
        $this->assertSame('SUCCESS', $payout->fresh()->status);
    }

    public function test_admin_can_list_and_filter_payouts(): void
    {
        [$driver] = $this->makeDriverWithEarning(100.0);
        $driver->update(['bank_account_number' => '1234567890', 'bank_ifsc' => 'HDFC0001234']);
        app(WithdrawalService::class)->requestDriverWithdrawal($driver->user, Money::fromMajor(100));

        Sanctum::actingAs($this->makeAdmin(), ['*']);

        $this->getJson('/api/v1/admin/payouts?party_type=driver')
            ->assertOk()
            ->assertJsonStructure(['data' => ['data' => [['id', 'payout_number', 'amount', 'status']]]]);
    }

    private function makeCustomer(): User
    {
        return User::factory()->create(['user_type' => 'customer']);
    }

    private function makeAdmin(): User
    {
        $admin = User::factory()->create(['user_type' => 'super_admin', 'is_active' => true]);
        $role = Role::firstOrCreate(['slug' => 'super_admin'], ['name' => 'SUPER_ADMIN']);
        $admin->roles()->sync([$role->id]);

        return $admin;
    }

    /**
     * @return array{0: Driver, 1: DriverEarning}
     */
    private function makeDriverWithEarning(float $earning): array
    {
        $user = User::factory()->create(['user_type' => 'driver']);
        $user->roles()->attach(Role::firstOrCreate(['slug' => 'driver'], ['name' => 'Driver']));

        $driver = Driver::create([
            'user_id' => $user->id,
            'status' => 'approved',
            'vehicle_number' => 'RJ14WD1234',
            'vehicle_model' => 'Maruti Alto',
            'vehicle_color' => 'White',
            'license_number' => 'RJ14201801234',
            'license_expiry' => now()->addYears(3),
            'is_online' => true,
            'is_busy' => false,
            'is_verified' => true,
        ]);

        $driver->setRelation('user', $user);

        $ride = Ride::create([
            'ride_number' => 'RIDE_'.strtoupper(Str::random(8)),
            'user_id' => $user->id,
            'driver_id' => $driver->id,
            'status' => Ride::STATUS_COMPLETED,
            'pickup_latitude' => 26.9124,
            'pickup_longitude' => 75.7873,
            'destination_latitude' => 26.949,
            'destination_longitude' => 75.8017,
            'estimated_fare' => $earning,
            'final_fare' => $earning,
            'payment_method' => Ride::PAYMENT_METHOD_CASH,
            'payment_status' => Ride::PAYMENT_STATUS_PAID,
        ]);

        $row = DriverEarning::create([
            'driver_id' => $driver->id,
            'ride_id' => $ride->id,
            'trip_fare' => $earning,
            'driver_percentage' => 100,
            'commission_percentage' => 0,
            'commission_amount' => 0,
            'earning_amount' => $earning,
            'currency' => 'INR',
            'status' => DriverEarning::STATUS_PENDING,
        ]);

        app(WalletService::class)->creditEarning(
            user: $user,
            walletType: 'driver',
            amount: Money::fromMajor($earning),
            service: 'ride',
            referenceType: DriverEarning::class,
            referenceId: $row->id,
            description: 'Test earning',
        );

        return [$driver->fresh(), $row];
    }
}
