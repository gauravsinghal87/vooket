<?php

namespace App\Services;

use App\Models\DeliveryPartner;
use App\Models\DeliveryPartnerEarning;
use App\Models\Driver;
use App\Models\DriverEarning;
use App\Models\FinancialAdjustment;
use App\Models\LedgerEntry;
use App\Models\User;
use App\Models\Wallet;
use App\Models\WalletTransaction;
use App\Services\Integration\WebhookNotifier;
use App\Support\Money;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;

class WalletService
{
    public function __construct(
        private WebhookNotifier $webhookNotifier,
        private JournalService $journalService,
    ) {}

    /**
     * Ensure a user has a wallet of the given type
     */
    public function ensureWallet(User $user, string $walletType = 'customer'): Wallet
    {
        return Wallet::firstOrCreate(
            ['user_id' => $user->id, 'wallet_type' => $walletType],
            [
                'balance' => '0.00',
                'pending_balance' => '0.00',
                'total_credited' => '0.00',
                'total_debited' => '0.00',
                'currency' => $user->currency ?? 'INR',
                'status' => 'active',
            ]
        );
    }

    /**
     * Credit an earning to a partner/driver wallet. Exactly-once:
     * the idempotency key is derived from the earning reference
     * (service + reference type + reference id) so finalizing the same
     * earning twice can never double-credit the wallet.
     */
    public function creditEarning(
        User $user,
        string $walletType,
        Money $amount,
        string $service,
        string $referenceType,
        int $referenceId,
        string $description,
        array $meta = []
    ): WalletTransaction {
        $idempotencyKey = 'wallet-earning:'.$service.':'.class_basename($referenceType).':'.$referenceId;

        return $this->credit(
            user: $user,
            walletType: $walletType,
            amount: $amount->major(),
            type: 'EARNING',
            referenceType: $referenceType,
            referenceId: $referenceId,
            description: $description,
            idempotencyKey: $idempotencyKey,
            meta: array_merge(['service' => $service], $meta),
        );
    }

    /**
     * The wallet for a given user + wallet type (created on demand).
     */
    public function wallet(User $user, string $walletType): Wallet
    {
        return $this->ensureWallet($user, $walletType);
    }

    /**
     * Spendable balance = balance − pending_balance (reserved funds).
     */
    public function available(User $user, string $walletType): Money
    {
        $wallet = $this->ensureWallet($user, $walletType);

        return Money::fromMajor($wallet->balance)->sub(Money::fromMajor($wallet->pending_balance));
    }

    /**
     * The same spendable balance as {@see available()}, but reading the row
     * under a row lock so a caller that is about to authorise a spend and
     * re-reads inside its own transaction cannot race a concurrent debit or
     * reservation. Returns zero for a wallet that does not exist yet, so this
     * stays a pure read.
     */
    public function availableForUpdate(User $user, string $walletType): Money
    {
        $wallet = Wallet::where('user_id', $user->id)
            ->where('wallet_type', $walletType)
            ->lockForUpdate()
            ->first();

        if (! $wallet) {
            return Money::zero();
        }

        return Money::fromMajor($wallet->balance)->sub(Money::fromMajor($wallet->pending_balance));
    }

    /**
     * Lifetime earnings credited to this wallet: the sum of its EARNING
     * credit transactions only, so top-ups, adjustments and cash
     * settlement movements are never counted as earnings. Derived from
     * the wallet's own exactly-once earning credits, so it works for
     * every service (food, grocery, ride) without service filters.
     */
    public function totalEarned(User $user, string $walletType): Money
    {
        $wallet = $this->ensureWallet($user, $walletType);

        $sum = WalletTransaction::where('wallet_id', $wallet->id)
            ->where('type', 'EARNING')
            ->where('direction', 'credit')
            ->sum('amount');

        return Money::fromMajor($sum ?? 0);
    }

    /**
     * Backfill wallet credits for any finalized earnings that predate the
     * wallet ledger (e.g. earnings settled before an upgrade). Exactly-once:
     * re-runs return existing wallet transactions because creditEarning is
     * idempotent by earning id.
     */
    public function reconcileFinalizedEarnings(User $user): void
    {
        $driver = Driver::where('user_id', $user->id)->first();
        if ($driver) {
            foreach (DriverEarning::where('driver_id', $driver->id)->get() as $earning) {
                $this->creditEarning(
                    user: $user,
                    walletType: 'driver',
                    amount: Money::fromMajor($earning->earning_amount),
                    service: 'ride',
                    referenceType: DriverEarning::class,
                    referenceId: $earning->id,
                    description: "Ride earning for ride #{$earning->ride?->ride_number}",
                    meta: ['earning_id' => $earning->id],
                );
            }
        }

        $partner = DeliveryPartner::where('user_id', $user->id)->first();
        if ($partner) {
            foreach (DeliveryPartnerEarning::where('delivery_partner_id', $partner->id)->where('status', '!=', 'reversed')->get() as $earning) {
                $service = $earning->order?->order_type === 'grocery' ? 'grocery' : 'food';

                $this->creditEarning(
                    user: $user,
                    walletType: 'delivery_partner',
                    amount: Money::fromMajor($earning->amount),
                    service: $service,
                    referenceType: DeliveryPartnerEarning::class,
                    referenceId: $earning->id,
                    description: "Delivery earning for order #{$earning->order?->order_number}",
                    meta: ['earning_id' => $earning->id],
                );
            }
        }
    }

    /**
     * Credit a wallet (double-entry ledger). Concurrency-safe:
     * the wallet row is locked and the operation is idempotent by
     * idempotency_key (enforced by a unique database constraint).
     */
    public function credit(
        User $user,
        string $walletType,
        int|float|string $amount,
        string $type = 'CREDIT',
        ?string $referenceType = null,
        ?int $referenceId = null,
        ?string $description = null,
        ?string $idempotencyKey = null,
        array $meta = []
    ): WalletTransaction {
        $paise = Money::fromMajor($amount)->paise();

        if ($paise <= 0) {
            throw new RuntimeException('Amount must be positive');
        }

        return DB::transaction(function () use ($user, $walletType, $paise, $type, $referenceType, $referenceId, $description, $idempotencyKey, $meta) {
            if ($idempotencyKey) {
                $existing = WalletTransaction::where('idempotency_key', $idempotencyKey)->first();
                if ($existing) {
                    return $existing;
                }
            }

            $wallet = $this->ensureWallet($user, $walletType);
            $wallet = Wallet::whereKey($wallet->id)->lockForUpdate()->first() ?? $wallet;

            $balanceBefore = Money::fromMajor($wallet->balance);
            $balanceAfter = $balanceBefore->add(Money::fromPaise($paise));
            $totalCredited = Money::fromMajor($wallet->total_credited)->add(Money::fromPaise($paise));

            try {
                $transaction = WalletTransaction::create([
                    'transaction_id' => $this->generateTransactionId(),
                    'wallet_id' => $wallet->id,
                    'user_id' => $user->id,
                    'type' => $type,
                    'service' => $meta['service'] ?? null,
                    'amount' => Money::fromPaise($paise)->major(),
                    'balance_before' => $balanceBefore->major(),
                    'balance_after' => $balanceAfter->major(),
                    'currency' => $wallet->currency,
                    'direction' => 'credit',
                    'status' => 'completed',
                    'reference_type' => $referenceType,
                    'reference_id' => $referenceId,
                    'description' => $description,
                    'meta' => $meta,
                    'idempotency_key' => $idempotencyKey,
                ]);

                $wallet->update([
                    'balance' => $balanceAfter->major(),
                    'total_credited' => $totalCredited->major(),
                ]);
            } catch (QueryException $e) {
                if (! $this->isUniqueViolation($e)) {
                    throw $e;
                }

                if ($idempotencyKey) {
                    $existing = WalletTransaction::where('idempotency_key', $idempotencyKey)->first();
                    if ($existing) {
                        return $existing;
                    }
                }

                throw $e;
            }

            $this->recordLedger($user, $wallet, Money::fromPaise($paise)->major(), 'debit', $referenceType, $referenceId, $transaction->transaction_id, $type, $meta);
            $this->postWalletJournal($wallet, $transaction, $type, 'credit', $referenceType, $referenceId, $meta);

            $this->webhookNotifier?->walletCredited($transaction);

            return $transaction;
        });
    }

    /**
     * Debit a wallet (double-entry ledger). The wallet row is locked inside
     * the transaction and the balance is verified under the lock, so
     * concurrent debits cannot overdraw the wallet.
     */
    public function debit(
        User $user,
        string $walletType,
        int|float|string $amount,
        string $type = 'DEBIT',
        ?string $referenceType = null,
        ?int $referenceId = null,
        ?string $description = null,
        ?string $idempotencyKey = null,
        array $meta = []
    ): WalletTransaction {
        $paise = Money::fromMajor($amount)->paise();

        if ($paise <= 0) {
            throw new RuntimeException('Amount must be positive');
        }

        return DB::transaction(function () use ($user, $walletType, $paise, $type, $referenceType, $referenceId, $description, $idempotencyKey, $meta) {
            if ($idempotencyKey) {
                $existing = WalletTransaction::where('idempotency_key', $idempotencyKey)->first();
                if ($existing) {
                    return $existing;
                }
            }

            $wallet = $this->ensureWallet($user, $walletType);
            $wallet = Wallet::whereKey($wallet->id)->lockForUpdate()->first() ?? $wallet;

            $balance = Money::fromMajor($wallet->balance);
            $pending = Money::fromMajor($wallet->pending_balance);
            $amount = Money::fromPaise($paise);

            if ($balance->sub($pending)->compareTo($amount) < 0) {
                throw new RuntimeException('Insufficient wallet balance');
            }

            $balanceBefore = $balance;
            $balanceAfter = $balance->sub($amount);
            $totalDebited = Money::fromMajor($wallet->total_debited)->add($amount);

            try {
                $transaction = WalletTransaction::create([
                    'transaction_id' => $this->generateTransactionId(),
                    'wallet_id' => $wallet->id,
                    'user_id' => $user->id,
                    'type' => $type,
                    'service' => $meta['service'] ?? null,
                    'amount' => $amount->major(),
                    'balance_before' => $balanceBefore->major(),
                    'balance_after' => $balanceAfter->major(),
                    'currency' => $wallet->currency,
                    'direction' => 'debit',
                    'status' => 'completed',
                    'reference_type' => $referenceType,
                    'reference_id' => $referenceId,
                    'description' => $description,
                    'meta' => $meta,
                    'idempotency_key' => $idempotencyKey,
                ]);

                $wallet->update([
                    'balance' => $balanceAfter->major(),
                    'total_debited' => $totalDebited->major(),
                ]);
            } catch (QueryException $e) {
                if (! $this->isUniqueViolation($e)) {
                    throw $e;
                }

                if ($idempotencyKey) {
                    $existing = WalletTransaction::where('idempotency_key', $idempotencyKey)->first();
                    if ($existing) {
                        return $existing;
                    }
                }

                throw $e;
            }

            $this->recordLedger($user, $wallet, $amount->major(), 'credit', $referenceType, $referenceId, $transaction->transaction_id, $type, $meta);
            $this->postWalletJournal($wallet, $transaction, $type, 'debit', $referenceType, $referenceId, $meta);

            $this->webhookNotifier?->walletDebited($transaction);

            return $transaction;
        });
    }

    /**
     * Available balance = balance - pending (reserved) balance.
     */
    public function getAvailableBalance(User $user, string $walletType = 'customer'): Money
    {
        $wallet = $this->ensureWallet($user, $walletType);

        return Money::fromMajor($wallet->balance)->sub(Money::fromMajor($wallet->pending_balance));
    }

    public function getBalance(User $user, string $walletType = 'customer'): float
    {
        $wallet = $this->ensureWallet($user, $walletType);

        return (float) $wallet->balance;
    }

    /**
     * Atomically reserve funds for a withdrawal. The balance is verified
     * under the wallet row lock and the amount is frozen into
     * pending_balance. Returns the pending wallet transaction ready to be
     * finalized when the payout completes or released when it fails.
     */
    public function reserveForWithdrawal(
        User $user,
        string $walletType,
        Money $amount,
        ?string $referenceType = null,
        ?int $referenceId = null,
        ?string $description = null,
        ?string $idempotencyKey = null,
        array $meta = []
    ): WalletTransaction {
        $paise = $amount->paise();

        if ($paise <= 0) {
            throw new RuntimeException('Amount must be positive');
        }

        if ($idempotencyKey === null) {
            $idempotencyKey = $this->generateTransactionId();
        }

        return DB::transaction(function () use ($user, $walletType, $amount, $referenceType, $referenceId, $description, $idempotencyKey, $meta) {
            $existing = WalletTransaction::where('idempotency_key', $idempotencyKey)->first();
            if ($existing) {
                return $existing;
            }

            $wallet = $this->ensureWallet($user, $walletType);
            $wallet = Wallet::whereKey($wallet->id)->lockForUpdate()->first() ?? $wallet;

            $balance = Money::fromMajor($wallet->balance);
            $pending = Money::fromMajor($wallet->pending_balance);

            if ($balance->sub($pending)->compareTo($amount) < 0) {
                throw new RuntimeException('Insufficient wallet balance');
            }

            $pendingAfter = $pending->add($amount);

            try {
                $transaction = WalletTransaction::create([
                    'transaction_id' => $this->generateTransactionId(),
                    'wallet_id' => $wallet->id,
                    'user_id' => $user->id,
                    'type' => 'WITHDRAWAL',
                    'service' => $meta['service'] ?? null,
                    'amount' => $amount->major(),
                    'balance_before' => $balance->major(),
                    'balance_after' => $balance->major(),
                    'currency' => $wallet->currency,
                    'direction' => 'debit',
                    'status' => 'pending',
                    'reference_type' => $referenceType,
                    'reference_id' => $referenceId,
                    'description' => $description,
                    'meta' => $meta,
                    'idempotency_key' => $idempotencyKey,
                ]);

                $wallet->update(['pending_balance' => $pendingAfter->major()]);
            } catch (QueryException $e) {
                if (! $this->isUniqueViolation($e)) {
                    throw $e;
                }

                $existing = WalletTransaction::where('idempotency_key', $idempotencyKey)->first();
                if ($existing) {
                    return $existing;
                }

                throw $e;
            }

            return $transaction;
        });
    }

    /**
     * Finalize a successful withdrawal: the reserved amount leaves the
     * wallet (pending_balance is drained).
     */
    public function finalizeWithdrawal(WalletTransaction $transaction): void
    {
        DB::transaction(function () use ($transaction) {
            $transaction = WalletTransaction::whereKey($transaction->id)->lockForUpdate()->first()
                ?? $transaction;

            if ($transaction->status === 'completed') {
                return;
            }

            if ($transaction->status !== 'pending') {
                throw new RuntimeException('Reservation is not in a finalizable state');
            }

            $wallet = Wallet::whereKey($transaction->wallet_id)->lockForUpdate()->first();
            if (! $wallet) {
                throw new RuntimeException('Wallet not found');
            }

            $pending = Money::fromMajor($wallet->pending_balance)->sub(Money::fromMajor($transaction->amount));
            $balance = Money::fromMajor($wallet->balance)->sub(Money::fromMajor($transaction->amount));
            $totalDebited = Money::fromMajor($wallet->total_debited)->add(Money::fromMajor($transaction->amount));

            $transaction->update(['status' => 'completed']);
            $wallet->update([
                'balance' => $balance->major(),
                'pending_balance' => $pending->major(),
                'total_debited' => $totalDebited->major(),
            ]);

            // The reserved funds have actually left the wallet: book the
            // payout as wallet liability down, gateway/cash asset down.
            $this->journalService->post(
                sourceType: WalletTransaction::class,
                sourceId: $transaction->id,
                entryType: 'payout_paid',
                lines: [
                    ['account' => JournalService::walletAccount($wallet->wallet_type), 'direction' => 'debit', 'amount' => $transaction->amount, 'party_type' => $wallet->wallet_type, 'party_id' => $wallet->user_id, 'memo' => $transaction->description],
                    ['account' => 'payment_clearing', 'direction' => 'credit', 'amount' => $transaction->amount, 'memo' => $transaction->description],
                ],
                idempotencyKey: 'payout:finalize:'.$transaction->transaction_id,
                transactionId: $transaction->transaction_id,
                description: $transaction->description,
                meta: ['wallet_type' => $wallet->wallet_type, 'payout' => true]
            );
        });
    }

    /**
     * Release a failed/reversed withdrawal: the reserved amount is returned
     * to the available balance (pending_balance is drained).
     */
    public function releaseWithdrawalReservation(WalletTransaction $transaction, ?string $reason = null): void
    {
        DB::transaction(function () use ($transaction, $reason) {
            $transaction = WalletTransaction::whereKey($transaction->id)->lockForUpdate()->first()
                ?? $transaction;

            if ($transaction->status === 'reversed') {
                return;
            }

            if ($transaction->status !== 'pending') {
                throw new RuntimeException('Reservation is not in a releasable state');
            }

            $wallet = Wallet::whereKey($transaction->wallet_id)->lockForUpdate()->first();
            if (! $wallet) {
                throw new RuntimeException('Wallet not found');
            }

            $pending = Money::fromMajor($wallet->pending_balance)->sub(Money::fromMajor($transaction->amount));

            $meta = $transaction->meta ?? [];
            $meta['released_at'] = now()->toDateTimeString();
            $meta['release_reason'] = $reason;

            $transaction->update([
                'status' => 'reversed',
                'reversed_at' => now(),
                'meta' => $meta,
            ]);
            $wallet->update(['pending_balance' => $pending->major()]);
        });
    }

    /**
     * Admin adjustment: records an auditable FinancialAdjustment and applies
     * the wallet credit/debit exactly once (unique idempotency key).
     */
    public function adjust(
        User $user,
        string $walletType,
        Money $amount,
        string $direction,
        string $reason,
        User $adjustedBy,
        ?string $notes = null,
        ?string $idempotencyKey = null,
        ?string $referenceType = null,
        ?int $referenceId = null
    ): WalletTransaction {
        if ($amount->isNegative() || $amount->isZero()) {
            throw new RuntimeException('Adjustment amount must be positive');
        }

        $idempotencyKey ??= 'ADJ_'.strtoupper(Str::uuid()->toString());
        $major = $amount->major();

        $existing = WalletTransaction::where('idempotency_key', $idempotencyKey)->first();
        if ($existing) {
            return $existing;
        }

        return DB::transaction(function () use ($user, $walletType, $major, $direction, $reason, $adjustedBy, $notes, $idempotencyKey, $referenceType, $referenceId) {
            $wallet = $this->ensureWallet($user, $walletType);

            $adjustment = FinancialAdjustment::create([
                'adjustment_number' => 'ADJ_'.date('YmdHis').'_'.strtoupper(Str::random(6)),
                'user_id' => $user->id,
                'wallet_id' => $wallet->id,
                'wallet_type' => $walletType,
                'amount' => $major,
                'direction' => $direction === 'debit' ? 'debit' : 'credit',
                'reason' => $reason,
                'notes' => $notes,
                'adjusted_by' => $adjustedBy->id,
                'reference_type' => $referenceType,
                'reference_id' => $referenceId,
                'idempotency_key' => $idempotencyKey,
            ]);

            $description = "Admin adjustment ({$reason}) by {$adjustedBy->name}";

            if ($direction === 'debit') {
                return $this->debit(
                    $user,
                    $walletType,
                    $major,
                    'ADJUSTMENT',
                    FinancialAdjustment::class,
                    $adjustment->id,
                    $description,
                    $idempotencyKey,
                    ['adjustment_id' => $adjustment->id]
                );
            }

            return $this->credit(
                $user,
                $walletType,
                $major,
                'ADJUSTMENT',
                FinancialAdjustment::class,
                $adjustment->id,
                $description,
                $idempotencyKey,
                ['adjustment_id' => $adjustment->id]
            );
        });
    }

    public function getTransactions(User $user, string $walletType = 'customer', array $filters = [], int $perPage = 15)
    {
        return WalletTransaction::where('user_id', $user->id)
            ->whereHas('wallet', fn ($q) => $q->where('wallet_type', $walletType))
            ->when($filters['service'] ?? null, fn ($q, $s) => $q->where('service', $s))
            ->when($filters['direction'] ?? null, fn ($q, $d) => $q->where('direction', $d))
            ->when($filters['type'] ?? null, fn ($q, $t) => $q->where('type', $t))
            ->when($filters['from'] ?? null, fn ($q, $d) => $q->whereDate('created_at', '>=', $d))
            ->when($filters['to'] ?? null, fn ($q, $d) => $q->whereDate('created_at', '<=', $d))
            ->latest()
            ->paginate($perPage);
    }

    /**
     * Post the balanced double-entry counterpart of a wallet movement.
     * Runs in the same transaction as the wallet update, so a wallet change
     * can never exist without its journal lines (and vice versa).
     */
    private function postWalletJournal(
        Wallet $wallet,
        WalletTransaction $transaction,
        string $type,
        string $direction,
        ?string $referenceType,
        ?int $referenceId,
        array $meta
    ): void {
        $walletAccount = JournalService::walletAccount($wallet->wallet_type);
        $counterparty = $this->journalService->walletCounterparty(
            $wallet->wallet_type,
            $type,
            $direction,
            $referenceType,
            $meta
        );

        $lines = [];

        if ($direction === 'credit') {
            $lines = [
                ['account' => $counterparty, 'direction' => 'debit', 'amount' => $transaction->amount, 'memo' => $transaction->description],
                ['account' => $walletAccount, 'direction' => 'credit', 'amount' => $transaction->amount, 'party_type' => $wallet->wallet_type, 'party_id' => $wallet->user_id, 'memo' => $transaction->description],
            ];
        } else {
            $lines = [
                ['account' => $walletAccount, 'direction' => 'debit', 'amount' => $transaction->amount, 'party_type' => $wallet->wallet_type, 'party_id' => $wallet->user_id, 'memo' => $transaction->description],
                ['account' => $counterparty, 'direction' => 'credit', 'amount' => $transaction->amount, 'memo' => $transaction->description],
            ];
        }

        $this->journalService->post(
            sourceType: WalletTransaction::class,
            sourceId: $transaction->id,
            entryType: 'wallet_'.strtolower($direction),
            lines: $lines,
            idempotencyKey: 'wallet:'.$transaction->transaction_id,
            transactionId: $transaction->transaction_id,
            description: $transaction->description,
            meta: [
                'wallet_type' => $wallet->wallet_type,
                'transaction_type' => $type,
                'reference_type' => $referenceType ? class_basename($referenceType) : null,
                'reference_id' => $referenceId,
                'counterparty_account' => $counterparty,
                'account_mapping' => $counterparty === 'platform_wallet' && ! in_array($type, ['CREDIT', 'DEBIT', 'PAYOUT'], true) ? 'default' : 'mapped',
            ]
        );
    }

    private function recordLedger(
        User $user,
        Wallet $wallet,
        string $amount,
        string $opposingAccount,
        ?string $referenceType,
        ?int $referenceId,
        string $transactionId,
        string $transactionType,
        array $meta
    ): void {
        LedgerEntry::create([
            'entry_id' => 'LE_'.Str::uuid(),
            'transaction_id' => $transactionId,
            'account_type' => $opposingAccount,
            'account_name' => $this->getAccountName($wallet->wallet_type),
            'wallet_id' => $wallet->id,
            'reference_type' => $referenceType,
            'reference_id' => $referenceId,
            'amount' => $amount,
            'currency' => $wallet->currency,
            'meta' => array_merge(['transaction_type' => $transactionType], $meta),
        ]);
    }

    private function getAccountName(string $walletType): string
    {
        return match ($walletType) {
            'customer' => 'customer_wallet',
            'driver' => 'driver_wallet',
            'delivery_partner' => 'delivery_partner_wallet',
            'vendor' => 'vendor_wallet',
            'platform' => 'platform_wallet',
            default => 'wallet',
        };
    }

    private function generateTransactionId(): string
    {
        return 'WLT_'.date('YmdHis').'_'.strtoupper(Str::random(8));
    }

    private function isUniqueViolation(QueryException $e): bool
    {
        $code = (string) $e->getCode();

        return $code === '23000' || str_contains($e->getMessage(), 'UNIQUE constraint failed');
    }
}
