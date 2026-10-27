<?php

namespace App\Services;

use App\Models\JournalEntry;
use App\Models\JournalLine;
use App\Support\Money;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Balanced double-entry journal.
 *
 * Every posting carries at least two lines, the sum of debits must equal the
 * sum of credits (in paise) and every account code must exist in ACCOUNTS.
 * A posting is atomic with the money movement it describes, so the journal
 * can never hold a half-posted event.
 *
 * Sign convention used by this chart of accounts:
 * - Assets (payment_clearing, cash_on_hand, *_cash_receivable) grow with debits.
 * - Liabilities (party wallets, revenue clearing accounts) grow with credits.
 * - Income (platform_revenue) grows with credits; expenses (platform_expense)
 *   grow with debits.
 *
 * Consequences used by the wiring:
 * - Crediting a wallet    => Dr counterparty, Cr {wallet_type}_wallet
 * - Debting a wallet      => Dr {wallet_type}_wallet, Cr counterparty
 * - Capturing a payment   => Dr payment_clearing, Cr revenue clearing / wallet
 * - Paying out a wallet   => Dr {wallet_type}_wallet, Cr payment_clearing
 */
class JournalService
{
    /**
     * The chart of accounts. Anything not listed here is rejected by post().
     *
     * @var list<string>
     */
    public const ACCOUNTS = [
        // assets
        'payment_clearing',
        'cash_on_hand',
        'partner_cash_receivable',
        'driver_cash_receivable',
        // liabilities
        'customer_wallet',
        'vendor_wallet',
        'driver_wallet',
        'delivery_partner_wallet',
        'platform_wallet',
        'order_revenue_clearing',
        'ride_revenue_clearing',
        // income
        'platform_revenue',
        // expenses (contra accounts)
        'platform_expense',
    ];

    /**
     * Wallet account for a wallet type.
     */
    public static function walletAccount(string $walletType): string
    {
        $account = $walletType.'_wallet';

        return in_array($account, self::ACCOUNTS, true) ? $account : 'platform_wallet';
    }

    /**
     * Post a balanced entry.
     *
     * Each line: [
     *   'account'     => string (required, must be in ACCOUNTS),
     *   'direction'   => 'debit'|'credit' (required),
     *   'amount'      => int|float|string|Money (required, must be > 0),
     *   'party_type'  => ?string,
     *   'party_id'    => ?int,
     *   'memo'        => ?string,
     *   'meta'        => array,
     * ]
     *
     * @param  array<int, array<string, mixed>>  $lines
     */
    public function post(
        string $sourceType,
        int $sourceId,
        string $entryType,
        array $lines,
        ?string $idempotencyKey = null,
        ?string $transactionId = null,
        ?string $description = null,
        array $meta = []
    ): JournalEntry {
        if ($entryType === '') {
            throw new RuntimeException('Journal entry type is required');
        }

        if (count($lines) < 2) {
            throw new RuntimeException('A journal entry requires at least two lines');
        }

        $normalized = [];
        $debitPaise = 0;
        $creditPaise = 0;

        foreach (array_values($lines) as $index => $line) {
            $account = (string) ($line['account'] ?? '');

            if (! in_array($account, self::ACCOUNTS, true)) {
                throw new RuntimeException("Unknown journal account [{$account}] at line {$index}");
            }

            $direction = strtolower((string) ($line['direction'] ?? ''));

            if (! in_array($direction, ['debit', 'credit'], true)) {
                throw new RuntimeException("Journal line {$index} direction must be debit or credit");
            }

            $amount = $line['amount'] ?? null;
            $paise = $amount instanceof Money ? $amount->paise() : Money::fromMajor($amount ?? 0)->paise();

            if ($paise <= 0) {
                throw new RuntimeException("Journal line {$index} amount must be positive");
            }

            if ($direction === 'debit') {
                $debitPaise += $paise;
            } else {
                $creditPaise += $paise;
            }

            $normalized[] = [
                'account' => $account,
                'party_type' => $line['party_type'] ?? null,
                'party_id' => isset($line['party_id']) ? (int) $line['party_id'] : null,
                'direction' => $direction,
                'amount' => Money::fromPaise($paise)->major(),
                'currency' => $line['currency'] ?? 'INR',
                'memo' => $line['memo'] ?? null,
                'meta' => $line['meta'] ?? null,
            ];
        }

        if ($debitPaise !== $creditPaise) {
            throw new RuntimeException(sprintf(
                'Unbalanced journal entry: debits %s do not equal credits %s',
                Money::fromPaise($debitPaise)->major(),
                Money::fromPaise($creditPaise)->major()
            ));
        }

        return DB::transaction(function () use ($sourceType, $sourceId, $entryType, $normalized, $idempotencyKey, $transactionId, $description, $meta, $debitPaise) {
            if ($idempotencyKey) {
                $existing = JournalEntry::where('idempotency_key', $idempotencyKey)->first();

                if ($existing) {
                    return $existing->load('lines');
                }
            }

            $entry = JournalEntry::create([
                'entry_number' => 'JE_'.Str::uuid()->toString(),
                'source_type' => $sourceType,
                'source_id' => $sourceId,
                'entry_type' => $entryType,
                'transaction_id' => $transactionId,
                'description' => $description,
                'currency' => 'INR',
                'total_debit' => Money::fromPaise($debitPaise)->major(),
                'total_credit' => Money::fromPaise($debitPaise)->major(),
                'idempotency_key' => $idempotencyKey,
                'meta' => $meta ?: null,
                'posted_at' => now(),
            ]);

            foreach ($normalized as $line) {
                $entry->lines()->create($line + ['journal_entry_id' => $entry->id]);
            }

            return $entry->load('lines');
        });
    }

    /**
     * Post the mirror image of an entry (every debit becomes a credit and
     * vice versa). The reversal gets its own entry; the original is left
     * untouched so the audit trail shows both movements.
     *
     * @param  array<int, array<string, mixed>>  $lines
     */
    public function reverse(
        string $sourceType,
        int $sourceId,
        string $entryType,
        array $lines,
        ?string $idempotencyKey = null,
        ?string $transactionId = null,
        ?string $description = null,
        array $meta = []
    ): JournalEntry {
        $mirrored = array_map(static function (array $line): array {
            $line['direction'] = ($line['direction'] ?? '') === 'debit' ? 'credit' : 'debit';

            return $line;
        }, array_values($lines));

        return $this->post(
            $sourceType,
            $sourceId,
            $entryType.'_reversal',
            $mirrored,
            $idempotencyKey ? $idempotencyKey.':reversal' : null,
            $transactionId,
            $description,
            $meta + ['reversal_of' => $entryType]
        );
    }

    /**
     * Net balance of an account over a period: debits minus credits.
     * Positive for asset/expense accounts, negative for liability/income
     * accounts that carry a credit balance.
     */
    public function balance(string $account, ?string $from = null, ?string $to = null): Money
    {
        $rows = $this->query($account, $from, $to)
            ->selectRaw('direction, COALESCE(SUM(amount), 0) as total')
            ->groupBy('direction')
            ->get();

        $debit = Money::zero();
        $credit = Money::zero();

        foreach ($rows as $row) {
            if ($row->direction === 'debit') {
                $debit = Money::fromMajor($row->total);
            } else {
                $credit = Money::fromMajor($row->total);
            }
        }

        return $debit->sub($credit);
    }

    /**
     * Debit, credit and net totals for several accounts at once.
     *
     * @param  list<string>  $accounts
     * @return array<string, array{debit: float, credit: float, net: float}>
     */
    public function balances(array $accounts, ?string $from = null, ?string $to = null): array
    {
        $result = [];

        foreach ($accounts as $account) {
            $result[$account] = [
                'debit' => 0.0,
                'credit' => 0.0,
                'net' => 0.0,
            ];
        }

        $rows = JournalLine::whereIn('account', $accounts)
            ->when($from, fn ($q) => $q->whereHas('journalEntry', fn ($e) => $e->where('posted_at', '>=', $from)))
            ->when($to, fn ($q) => $q->whereHas('journalEntry', fn ($e) => $e->where('posted_at', '<=', $to)))
            ->selectRaw('account, direction, COALESCE(SUM(amount), 0) as total')
            ->groupBy('account', 'direction')
            ->get();

        foreach ($rows as $row) {
            $result[$row->account][$row->direction] = (float) $row->total;
        }

        foreach ($result as $account => $totals) {
            $result[$account]['net'] = round($totals['debit'] - $totals['credit'], 2);
        }

        return $result;
    }

    /**
     * True when the whole journal (or a slice of it) balances: total debits
     * equal total credits. Used by reconciliation checks.
     */
    public function isBalanced(?string $from = null, ?string $to = null): bool
    {
        $totals = JournalLine::query()
            ->when($from, fn ($q) => $q->whereHas('journalEntry', fn ($e) => $e->where('posted_at', '>=', $from)))
            ->when($to, fn ($q) => $q->whereHas('journalEntry', fn ($e) => $e->where('posted_at', '<=', $to)))
            ->selectRaw('direction, COALESCE(SUM(amount), 0) as total')
            ->groupBy('direction')
            ->get();

        $debit = Money::zero();
        $credit = Money::zero();

        foreach ($totals as $row) {
            if ($row->direction === 'debit') {
                $debit = Money::fromMajor($row->total);
            } else {
                $credit = Money::fromMajor($row->total);
            }
        }

        return $debit->compareTo($credit) === 0;
    }

    /**
     * The counterparty account for a wallet movement, derived from the wallet
     * type, the transaction type, the payment reference and the service meta.
     * Falls back to platform_wallet (flagged in meta) so an unmapped type can
     * never silently drop the balancing side of an entry.
     */
    public function walletCounterparty(
        string $walletType,
        string $type,
        string $direction,
        ?string $referenceType = null,
        array $meta = []
    ): string {
        $service = strtolower((string) ($meta['service'] ?? ''));
        $reference = $referenceType ? class_basename($referenceType) : '';
        $revenueClearing = $this->revenueClearingFor($referenceType, $service, $meta);
        $isOrderOrRide = in_array($reference, ['Order', 'Ride'], true)
            || in_array($service, ['food', 'grocery', 'ride'], true);

        if ($direction === 'credit') {
            return match ($type) {
                'TOP_UP', 'PAYOUT' => 'payment_clearing',
                // An order/ride refund gives revenue back; a top-up refund
                // returns gateway money.
                'REFUND' => $isOrderOrRide ? $revenueClearing : 'payment_clearing',
                'SETTLEMENT', 'COMMISSION', 'EARNING', 'REVERSAL' => $revenueClearing,
                'CASH_COLLECTION' => 'partner_cash_receivable',
                'BONUS', 'INCENTIVE', 'ADJUSTMENT', 'CREDIT' => 'platform_expense',
                default => 'platform_wallet',
            };
        }

        return match ($type) {
            'DEBIT', 'PURCHASE', 'REVERSAL' => $revenueClearing,
            'SETTLEMENT' => $this->cashReceivableAccount($walletType, $revenueClearing),
            'WITHDRAWAL', 'PAYOUT' => 'payment_clearing',
            'COMMISSION', 'ADJUSTMENT', 'DEBIT_ADJUSTMENT' => 'platform_revenue',
            default => 'platform_wallet',
        };
    }

    /**
     * Revenue clearing account that funds a movement for a given reference.
     */
    public function revenueClearingFor(?string $referenceType, string $service = '', array $meta = []): string
    {
        $reference = $referenceType ? class_basename($referenceType) : '';

        if ($reference === 'Ride' || $service === 'ride') {
            return 'ride_revenue_clearing';
        }

        return 'order_revenue_clearing';
    }

    /**
     * The receivable cleared when a party repays collected cash.
     */
    private function cashReceivableAccount(string $walletType, string $revenueClearing): string
    {
        return match ($walletType) {
            'delivery_partner' => 'partner_cash_receivable',
            'driver' => 'driver_cash_receivable',
            default => $revenueClearing,
        };
    }

    private function query(string $account, ?string $from, ?string $to)
    {
        return JournalLine::where('account', $account)
            ->when($from, fn ($q) => $q->whereHas('journalEntry', fn ($e) => $e->where('posted_at', '>=', $from)))
            ->when($to, fn ($q) => $q->whereHas('journalEntry', fn ($e) => $e->where('posted_at', '<=', $to)));
    }
}
