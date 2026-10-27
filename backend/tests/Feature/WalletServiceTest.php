<?php

namespace Tests\Feature;

use App\Models\FinancialAdjustment;
use App\Models\LedgerEntry;
use App\Models\User;
use App\Models\Wallet;
use App\Models\WalletTransaction;
use App\Services\WalletService;
use App\Support\Money;
use Illuminate\Foundation\Testing\RefreshDatabase;
use RuntimeException;
use Tests\TestCase;

class WalletServiceTest extends TestCase
{
    use RefreshDatabase;

    private WalletService $walletService;

    protected function setUp(): void
    {
        parent::setUp();

        $this->walletService = app(WalletService::class);
    }

    private function makeUser(string $phone = '9000000001'): User
    {
        return User::create(['name' => 'Customer', 'phone' => $phone, 'user_type' => 'customer', 'is_active' => true]);
    }

    private function walletBalance(User $user): string
    {
        return (string) Wallet::where('user_id', $user->id)->where('wallet_type', 'customer')->value('balance');
    }

    public function test_credit_updates_balance_and_writes_double_entry_ledger(): void
    {
        $user = $this->makeUser();

        $transaction = $this->walletService->credit($user, 'customer', 250.50);

        $this->assertSame('250.50', $this->walletBalance($user));
        $this->assertSame('250.50', (string) $transaction->balance_after);
        $this->assertSame('0.00', (string) $transaction->balance_before);
        $this->assertSame('credit', $transaction->direction);
        $this->assertSame(1, LedgerEntry::where('wallet_id', $transaction->wallet_id)->count());
    }

    public function test_debit_lowers_balance_and_rejects_overdraw(): void
    {
        $user = $this->makeUser();
        $this->walletService->credit($user, 'customer', 100.00);

        $debit = $this->walletService->debit($user, 'customer', 40.00);

        $this->assertSame('60.00', $this->walletBalance($user));
        $this->assertSame('60.00', (string) $debit->balance_after);
        $this->assertSame('debit', $debit->direction);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Insufficient wallet balance');
        $this->walletService->debit($user, 'customer', 61.00);
    }

    public function test_credit_is_idempotent_by_idempotency_key(): void
    {
        $user = $this->makeUser();

        $this->walletService->credit($user, 'customer', 100.00, 'CREDIT', null, null, 'Top up', 'idem_1');
        $second = $this->walletService->credit($user, 'customer', 100.00, 'CREDIT', null, null, 'Top up', 'idem_1');

        $this->assertSame('100.00', $this->walletBalance($user));
        $this->assertSame('100.00', (string) $second->balance_after);
        $this->assertSame(1, WalletTransaction::where('idempotency_key', 'idem_1')->count());
    }

    public function test_credit_rejects_non_positive_amount(): void
    {
        $user = $this->makeUser();

        $this->expectException(RuntimeException::class);
        $this->walletService->credit($user, 'customer', 0);
    }

    public function test_withdrawal_reservation_finalize_and_release(): void
    {
        $user = $this->makeUser();
        $this->walletService->credit($user, 'customer', 200.00);

        $reservation = $this->walletService->reserveForWithdrawal($user, 'customer', Money::fromMajor('50.00'), null, null, 'Payout', 'res_1');

        $wallet = Wallet::where('user_id', $user->id)->where('wallet_type', 'customer')->first();
        $this->assertSame('50.00', (string) $wallet->pending_balance);
        $this->assertSame('150.00', $this->walletService->getAvailableBalance($user)->major());

        $this->walletService->finalizeWithdrawal($reservation);

        $wallet->refresh();
        $this->assertSame('0.00', (string) $wallet->pending_balance);
        $this->assertSame('150.00', (string) $wallet->balance);
        $this->assertSame('150.00', $this->walletService->getAvailableBalance($user)->major());
        $this->assertSame('completed', $reservation->fresh()->status);

        $second = $this->walletService->reserveForWithdrawal($user, 'customer', Money::fromMajor('20.00'), null, null, 'Payout', 'res_2');
        $this->walletService->releaseWithdrawalReservation($second, 'bank rejected');

        $wallet->refresh();
        $this->assertSame('0.00', (string) $wallet->pending_balance);
        $this->assertSame('150.00', (string) $wallet->balance);
        $this->assertSame('reversed', $second->fresh()->status);
    }

    public function test_admin_adjustment_is_recorded_and_applied_exactly_once(): void
    {
        $user = $this->makeUser('9000000002');
        $admin = $this->makeUser('9000000003');

        $transaction = $this->walletService->adjust($user, 'customer', Money::fromMajor('75.00'), 'credit', 'Goodwill bonus', $admin, 'Festival credit', 'adj_idem_1');

        $this->assertSame('75.00', $this->walletBalance($user));
        $this->assertSame(1, FinancialAdjustment::where('idempotency_key', 'adj_idem_1')->count());

        $second = $this->walletService->adjust($user, 'customer', Money::fromMajor('75.00'), 'credit', 'Goodwill bonus', $admin, 'Festival credit', 'adj_idem_1');

        $this->assertSame($transaction->id, $second->id);
        $this->assertSame('75.00', $this->walletBalance($user));
        $this->assertSame(1, FinancialAdjustment::count());
    }

    public function test_admin_debit_adjustment_draws_down_balance(): void
    {
        $user = $this->makeUser('9000000004');
        $admin = $this->makeUser('9000000005');
        $this->walletService->credit($user, 'customer', 100.00);

        $this->walletService->adjust($user, 'customer', Money::fromMajor('30.00'), 'debit', 'Recovery', $admin, null, 'adj_idem_2');

        $this->assertSame('70.00', $this->walletBalance($user));
        $this->assertSame(1, FinancialAdjustment::where('idempotency_key', 'adj_idem_2')->count());
    }
}
