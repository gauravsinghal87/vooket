<?php

namespace App\Services;

use App\Exceptions\PartnerWalletBalanceException;
use App\Exceptions\VendorWalletBalanceException;
use App\Models\AppSetting;
use App\Models\DeliveryPartner;
use App\Models\DeliveryPartnerEarning;
use App\Models\Driver;
use App\Models\DriverEarning;
use App\Models\Payout;
use App\Models\Settlement;
use App\Models\User;
use App\Models\Vendor;
use App\Models\Wallet;
use App\Models\WalletTransaction;
use App\Support\Money;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use InvalidArgumentException;
use RuntimeException;

/**
 * Withdrawal and payout engine. All requests serialize on a per-subject
 * lock, verify the available balance inside the transaction and record a
 * unique idempotency key so a double-submit can never create two payouts.
 */
class WithdrawalService
{
    public function __construct(
        private WalletService $walletService,
    ) {}

    public function requestDriverWithdrawal(User $user, Money $amount, ?string $idempotencyKey = null): Payout
    {
        return $this->requestEarnings(function () use ($user, $amount, $idempotencyKey) {
            $driver = Driver::where('user_id', $user->id)->first();

            if (! $driver) {
                throw new RuntimeException('Driver profile not found');
            }

            // A replayed request must resolve to the payout it already created.
            // Checked before the balance rules because the first request already
            // consumed its own headroom, so re-validating would reject the retry.
            $existing = $this->existingPayout($idempotencyKey, fn ($q) => $q->where('driver_id', $driver->id));

            if ($existing) {
                return $existing;
            }

            Driver::whereKey($driver->id)->lockForUpdate()->first();

            $earnings = Money::fromMajor((string) DriverEarning::where('driver_id', $driver->id)->lockForUpdate()->get()->sum('earning_amount'));
            $withdrawn = Money::fromMajor((string) Payout::where('driver_id', $driver->id)
                ->whereIn('status', ['PENDING', 'PROCESSING', 'SUCCESS'])
                ->sum('amount'));

            $available = $earnings->sub($withdrawn);

            $this->guardPartnerWalletFloor($user, 'driver', $amount, $available);

            return $this->createPayout(
                'driver',
                partyType: 'driver',
                driverId: $driver->id,
                user: $user,
                amount: $amount,
                available: $available,
                bank: $driver,
                idempotencyKey: $idempotencyKey,
            );
        });
    }

    public function requestPartnerWithdrawal(User $user, Money $amount, ?string $idempotencyKey = null): Payout
    {
        return $this->requestEarnings(function () use ($user, $amount, $idempotencyKey) {
            $partner = DeliveryPartner::where('user_id', $user->id)->first();

            if (! $partner) {
                throw new RuntimeException('Delivery partner profile not found');
            }

            $existing = $this->existingPayout($idempotencyKey, fn ($q) => $q->where('delivery_partner_id', $partner->id));

            if ($existing) {
                return $existing;
            }

            DeliveryPartner::whereKey($partner->id)->lockForUpdate()->first();

            $earnings = Money::fromMajor((string) DeliveryPartnerEarning::where('delivery_partner_id', $partner->id)
                ->where('status', '!=', 'reversed')
                ->lockForUpdate()
                ->get()
                ->sum('amount'));
            $withdrawn = Money::fromMajor((string) Payout::where('delivery_partner_id', $partner->id)
                ->whereIn('status', ['PENDING', 'PROCESSING', 'SUCCESS'])
                ->sum('amount'));

            $available = $earnings->sub($withdrawn);

            $this->guardPartnerWalletFloor($user, 'delivery_partner', $amount, $available);

            return $this->createPayout(
                'delivery_partner',
                partyType: 'delivery_partner',
                partnerId: $partner->id,
                user: $user,
                amount: $amount,
                available: $available,
                bank: $partner,
                idempotencyKey: $idempotencyKey,
            );
        });
    }

    /**
     * Reject a driver/partner payout that would take the wallet below the
     * admin-configured `partner_min_wallet_balance` floor.
     *
     * This is a floor on the REMAINING balance, not a minimum on the request, so
     * a small payout is fine as long as the balance stays above the floor. The
     * spendable wallet balance is taken as an additional cap: earnings can be
     * credited to a wallet that has since been spent, and the floor must never be
     * satisfied by a balance the partner cannot actually draw on.
     *
     * Called inside the payout transaction, after the earning rows are locked, so
     * two concurrent requests cannot both pass the floor on the same balance.
     *
     * @param  Money  $earningsAvailable  Canonical withdrawable balance at request time.
     * @param  Money|null  $amount  Requested amount, or null to only report the ceiling.
     */
    public function partnerMaximumPayout(User $user, string $walletType, ?Money $earningsAvailable = null): Money
    {
        $minimum = $this->partnerMinimumWalletBalance();

        $available = $earningsAvailable ?? $this->partnerAvailableBalance($user, $walletType);

        $maximum = $available->sub($minimum);

        if ($maximum->isNegative()) {
            return Money::zero();
        }

        $walletAvailable = $this->walletService->available($user, $walletType);

        return $maximum->compareTo($walletAvailable) < 0 ? $maximum : $walletAvailable;
    }

    /**
     * Canonical withdrawable balance for a driver or partner at request time:
     * credited earnings less every payout already requested and not yet failed.
     *
     * Partner/earnings payouts reserve nothing on the wallet at request time, so
     * netting the in-flight payouts here is what stops two simultaneous requests
     * from each seeing the full balance and together withdrawing more than was
     * earned. It is the same figure `createPayout` validates against.
     */
    public function partnerAvailableBalance(User $user, string $walletType): Money
    {
        $isDriver = $walletType === 'driver';

        $subject = $isDriver
            ? Driver::where('user_id', $user->id)->first()
            : DeliveryPartner::where('user_id', $user->id)->first();

        if (! $subject) {
            return Money::zero();
        }

        $earnings = $isDriver
            ? Money::fromMajor((string) DriverEarning::where('driver_id', $subject->id)->sum('earning_amount'))
            : Money::fromMajor((string) DeliveryPartnerEarning::where('delivery_partner_id', $subject->id)
                ->where('status', '!=', 'reversed')
                ->sum('amount'));

        $withdrawn = $isDriver
            ? Money::fromMajor((string) Payout::where('driver_id', $subject->id)
                ->whereIn('status', ['PENDING', 'PROCESSING', 'SUCCESS'])
                ->sum('amount'))
            : Money::fromMajor((string) Payout::where('delivery_partner_id', $subject->id)
                ->whereIn('status', ['PENDING', 'PROCESSING', 'SUCCESS'])
                ->sum('amount'));

        return $earnings->sub($withdrawn);
    }

    /**
     * @param  Builder<Payout>  $query
     */
    private function existingPayout(?string $idempotencyKey, callable $scope): ?Payout
    {
        if ($idempotencyKey === null) {
            return null;
        }

        return Payout::where('idempotency_key', $idempotencyKey)->where($scope)->first();
    }

    /**
     * Apply the `partner_min_wallet_balance` floor inside the payout transaction.
     *
     * Must only be called from within the payout lock, so the balance it checks is
     * the committed one and no concurrent request can slip past the floor.
     */
    private function guardPartnerWalletFloor(User $user, string $walletType, Money $amount, Money $available): void
    {
        $minimum = $this->partnerMinimumWalletBalance();

        // Strictly above: a balance sitting exactly on the floor has no headroom,
        // and taking anything from it would breach the floor immediately.
        if ($available->compareTo($minimum) <= 0) {
            throw PartnerWalletBalanceException::balanceNotAboveMinimum($minimum);
        }

        $maximum = $this->partnerMaximumPayout($user, $walletType, $available);

        if ($amount->compareTo($maximum) > 0) {
            throw PartnerWalletBalanceException::exceedsMaximum($maximum, $minimum);
        }
    }

    /**
     * The admin-controlled amount that must REMAIN in a Food/Grocery vendor
     * wallet after a payout. Read live from `app_settings` so a Super Admin
     * change applies to the next request with no redeploy. Falls back to the
     * config default when the row is missing or unusable, which keeps a fresh
     * install and a migrated install consistent.
     */
    public function vendorMinimumWalletBalance(): Money
    {
        return $this->minimumWalletBalance('vendor_payout', 'vendor_min_wallet_balance');
    }

    /**
     * The admin-controlled amount that must REMAIN in a delivery partner or ride
     * driver wallet after a payout. Independent of the vendor floor: the two
     * settings have separate keys, defaults and admin controls.
     */
    public function partnerMinimumWalletBalance(): Money
    {
        return $this->minimumWalletBalance('partner_payout', 'partner_min_wallet_balance');
    }

    /**
     * Shared reader for both wallet-balance floors.
     *
     * Read live rather than cached so an admin change applies to the next payout
     * request with no redeploy, and fail-closed to the documented default when a
     * row is missing, blank, unparsable or negative.
     */
    private function minimumWalletBalance(string $group, string $key): Money
    {
        $default = Money::fromMajor((string) config("{$group}.min_wallet_balance", '0'));
        $configured = AppSetting::where('group', $group)->where('key', $key)->value('value');

        if ($configured === null || trim((string) $configured) === '') {
            return $default;
        }

        try {
            $minimum = Money::fromMajor((string) $configured);
        } catch (InvalidArgumentException) {
            return $default;
        }

        // A negative floor would let a payout take the balance below zero, so
        // fall back to the documented default instead. The admin endpoint rejects
        // negatives, and this keeps a hand-edited row fail-closed.
        return $minimum->isNegative() ? $default : $minimum;
    }

    /**
     * Canonical settlement balance for a vendor: settled-but-unpaid settlement
     * value less everything already requested and not yet failed.
     *
     * Netting the in-flight payouts is what stops two simultaneous requests from
     * each seeing the full balance and together withdrawing more than the vendor
     * owns. The settlement rows are locked for the duration of the caller's
     * transaction, so a concurrent request reads the committed payout before it
     * computes its own available amount.
     */
    public function vendorAvailableBalance(Vendor $vendor, bool $lock = false): Money
    {
        $settlements = Settlement::where('vendor_id', $vendor->id)->where('status', 'processing');

        if ($lock) {
            $settlements->lockForUpdate()->get();
        }

        $due = Money::fromMajor((string) (clone $settlements)->sum('net_payable'));

        $requested = Money::fromMajor((string) Payout::where('vendor_id', $vendor->id)
            ->whereIn('status', ['PENDING', 'PROCESSING', 'SUCCESS'])
            ->sum('amount'));

        return $due->sub($requested);
    }

    /**
     * The most a vendor may withdraw right now: the headroom between the
     * canonical spendable wallet balance and the configured floor, never more
     * than what the settlement balance also allows.
     *
     * Taking the lower of the two means the figure published to the vendor is
     * the exact amount the payout endpoint will accept, so the UI can never
     * offer something the server then refuses.
     */
    public function vendorMaximumPayout(Vendor $vendor, bool $lock = false): Money
    {
        $wallet = $lock
            ? $this->walletService->availableForUpdate($vendor->user, 'vendor')
            : $this->walletService->available($vendor->user, 'vendor');

        return $this->maximumBetween($wallet, $this->vendorAvailableBalance($vendor, lock: $lock));
    }

    /**
     * The single place the ceiling is derived, so the number the vendor is shown
     * and the number the request is validated against cannot drift apart.
     */
    private function maximumBetween(Money $walletAvailable, Money $settledAvailable): Money
    {
        $headroom = $walletAvailable->sub($this->vendorMinimumWalletBalance());
        $maximum = $headroom->compareTo($settledAvailable) < 0 ? $headroom : $settledAvailable;

        // Under the floor or already over-withdrawn: nothing is withdrawable, and
        // a negative ceiling must never be published or compared against.
        return $maximum->isNegative() ? Money::zero() : $maximum;
    }

    public function requestVendorPayout(User $user, Money $amount, ?string $idempotencyKey = null): Payout
    {
        return $this->requestEarnings(function () use ($user, $amount, $idempotencyKey) {
            $vendor = Vendor::where('user_id', $user->id)->first();

            if (! $vendor) {
                throw new RuntimeException('Vendor profile not found');
            }

            // A replayed request must resolve to the payout it already created.
            // Checking this before the balance and floor rules keeps a network
            // retry working: the first request already consumed its own headroom,
            // so re-validating would reject the retry.
            if ($idempotencyKey !== null) {
                $existing = Payout::where('idempotency_key', $idempotencyKey)
                    ->where('vendor_id', $vendor->id)
                    ->first();

                if ($existing) {
                    return $existing;
                }
            }

            $minimum = $this->vendorMinimumWalletBalance();
            $wallet = $this->walletService->availableForUpdate($vendor->user, 'vendor');
            $available = $this->vendorAvailableBalance($vendor, lock: true);

            // The wallet must sit strictly above the floor before anything can be
            // taken, otherwise the vendor would breach it on the very first
            // withdrawal.
            if ($wallet->compareTo($minimum) <= 0) {
                throw VendorWalletBalanceException::balanceNotAboveMinimum($minimum, $wallet);
            }

            // What is left behind after this payout must still meet the floor,
            // and the request may not exceed what has actually been settled.
            $maximum = $this->maximumBetween($wallet, $available);

            if ($amount->compareTo($maximum) > 0) {
                throw VendorWalletBalanceException::exceedsMaximum($minimum, $maximum);
            }

            return $this->createPayout(
                'vendor',
                partyType: 'vendor',
                vendorId: $vendor->id,
                user: $user,
                amount: $amount,
                available: $available,
                bank: $vendor,
                idempotencyKey: $idempotencyKey,
            );
        });
    }

    /**
     * Wallet-funded withdrawal: the wallet row is locked, the available
     * balance (balance - pending) is verified, funds are atomically
     * reserved and a payout is recorded idempotently.
     */
    public function requestWalletWithdrawal(User $user, Money $amount, string $walletType, ?string $idempotencyKey = null): Payout
    {
        if ($amount->isNegative() || $amount->isZero()) {
            throw new RuntimeException('Amount must be positive');
        }

        $idempotencyKey ??= 'WDL_'.strtoupper(Str::uuid()->toString());

        return DB::transaction(function () use ($user, $amount, $walletType, $idempotencyKey) {
            $existing = Payout::where('idempotency_key', $idempotencyKey)->first();
            if ($existing) {
                return $existing;
            }

            $wallet = $this->walletService->ensureWallet($user, $walletType);
            $wallets = Wallet::whereKey($wallet->id)->lockForUpdate()->get();

            $available = Money::fromMajor($wallet->balance)->sub(Money::fromMajor($wallet->pending_balance));

            if ($available->compareTo($amount) < 0) {
                throw new RuntimeException('Insufficient wallet balance');
            }

            $reservation = $this->walletService->reserveForWithdrawal(
                $user,
                $walletType,
                $amount,
                'withdrawal',
                null,
                'Withdrawal reservation for amount '.$amount->major(),
                $idempotencyKey,
                ['service' => 'inflight']
            );

            $payout = $this->createPayout(
                'wallet',
                partyType: $walletType,
                user: $user,
                amount: $amount,
                available: $available,
                bank: null,
                idempotencyKey: $idempotencyKey,
                meta: ['wallet_id' => $wallet->id, 'wallet_transaction_id' => $reservation->id, 'funded_by' => 'wallet'],
            );

            return $payout;
        });
    }

    public function markPayoutProcessing(Payout $payout): Payout
    {
        return $this->transitionPayout($payout, ['PENDING'], 'PROCESSING');
    }

    public function markPayoutSuccess(Payout $payout, ?string $adminRemark = null, ?User $actor = null): Payout
    {
        return DB::transaction(function () use ($payout, $adminRemark, $actor) {
            $locked = Payout::whereKey($payout->id)->whereIn('status', ['PENDING', 'PROCESSING'])->lockForUpdate()->first();

            if (! $locked) {
                if ($payout->status === 'SUCCESS') {
                    // Replays are idempotent: the financial effects and the
                    // original remark are left untouched.
                    return $payout->fresh();
                }
                throw new RuntimeException('Payout cannot be marked as SUCCESS from current state');
            }

            $previousStatus = $locked->status;
            $transactionId = $locked->meta['wallet_transaction_id'] ?? null;

            if ($transactionId) {
                $transaction = WalletTransaction::find((int) $transactionId);
                if ($transaction) {
                    $this->walletService->finalizeWithdrawal($transaction);
                }
            } elseif (in_array($locked->party_type, ['vendor', 'driver', 'delivery_partner'], true)) {
                // Due-settlement (earnings) payout: no wallet reservation was made at
                // request time, so the wallet is only debited here on success — this
                // makes "Wallet balance" / "Available to withdraw" drop in lockstep
                // with the admin marking the payout PAID. Idempotent per payout.
                $subject = match ($locked->party_type) {
                    'vendor' => $locked->vendor,
                    'driver' => $locked->driver,
                    'delivery_partner' => $locked->deliveryPartner,
                    default => null,
                };

                $walletType = match ($locked->party_type) {
                    'vendor' => 'vendor',
                    'driver' => 'driver',
                    'delivery_partner' => 'delivery_partner',
                    default => null,
                };

                if ($subject?->user_id) {
                    $this->walletService->debit(
                        $subject->user,
                        $walletType,
                        $locked->amount,
                        referenceType: 'payout',
                        referenceId: $locked->id,
                        description: 'Payout #'.$locked->payout_number,
                        idempotencyKey: 'admin-payout-paid:'.$locked->id,
                        meta: ['payout_id' => $locked->id, 'source' => 'admin_payout_success', 'service' => $locked->meta['service'] ?? null],
                    );
                }
            }

            $processedAt = now();

            $updates = [
                'status' => 'SUCCESS',
                'processed_at' => $processedAt,
            ];

            // Only touch the remark when the admin supplied one; a request with
            // no note must not erase a remark that is already on the record.
            if ($adminRemark !== null) {
                $updates['admin_remark'] = $adminRemark;
            }

            $locked->update($updates);

            if ($locked->party_type === 'driver' && $locked->driver_id) {
                $this->markDriverEarningsPaid($locked);
            }

            // Same transaction as the status change, so the audit trail can
            // never claim a payout was paid without the matching remark.
            app(AuditService::class)->log(
                action: 'payout.paid',
                entityType: Payout::class,
                entityId: $locked->id,
                oldValues: ['status' => $previousStatus],
                newValues: [
                    'status' => 'SUCCESS',
                    'processed_at' => $processedAt->toIso8601String(),
                    'admin_remark' => $adminRemark,
                ],
                description: 'Payout '.$locked->payout_number.' marked as paid',
                meta: [
                    'payout_number' => $locked->payout_number,
                    'party_type' => $locked->party_type,
                    'amount' => (string) $locked->amount,
                ],
                actor: $actor,
            );

            return $locked->fresh();
        });
    }

    /**
     * Mark the driver's pending earnings as paid up to the settled payout
     * amount, oldest first. The payout/balance math nets in-flight payouts on
     * its own, so this only makes the per-earning status truthful for audits;
     * it never changes the withdrawable figure. Replays settle nothing extra
     * because the rows are already paid.
     */
    private function markDriverEarningsPaid(Payout $payout): void
    {
        $remaining = Money::fromMajor((string) $payout->amount);

        $earnings = DriverEarning::where('driver_id', $payout->driver_id)
            ->where('status', DriverEarning::STATUS_PENDING)
            ->orderBy('id')
            ->lockForUpdate()
            ->get();

        foreach ($earnings as $earning) {
            if ($remaining->paise() <= 0) {
                break;
            }

            $amount = Money::fromMajor((string) $earning->earning_amount);
            $meta = $earning->meta ?? [];
            $meta['settled_by_payout_id'] = $payout->id;
            $meta['settled_at'] = now()->toIso8601String();

            $earning->update([
                'status' => DriverEarning::STATUS_PAID,
                'meta' => $meta,
            ]);

            $remaining = $remaining->sub($amount);
        }
    }

    public function markPayoutFailed(Payout $payout, ?string $reason = null): Payout
    {
        return DB::transaction(function () use ($payout, $reason) {
            $locked = Payout::whereKey($payout->id)->whereIn('status', ['PENDING', 'PROCESSING'])->lockForUpdate()->first();

            if (! $locked) {
                if ($payout->status === 'FAILED') {
                    return $payout->fresh();
                }
                throw new RuntimeException('Payout cannot be marked as FAILED from current state');
            }

            $transactionId = $locked->meta['wallet_transaction_id'] ?? null;

            if ($transactionId) {
                $transaction = WalletTransaction::find((int) $transactionId);
                if ($transaction) {
                    $this->walletService->releaseWithdrawalReservation($transaction, $reason);
                }
            }

            $locked->update([
                'status' => 'FAILED',
                'failure_reason' => $reason,
            ]);

            return $locked->fresh();
        });
    }

    private function requestEarnings(\Closure $builder): Payout
    {
        return DB::transaction(fn () => $builder());
    }

    private function createPayout(
        string $service,
        string $partyType,
        User $user,
        Money $amount,
        Money $available,
        $bank,
        ?string $idempotencyKey,
        ?int $driverId = null,
        ?int $partnerId = null,
        ?int $vendorId = null,
        array $meta = []
    ): Payout {
        if ($amount->isNegative() || $amount->isZero()) {
            throw new RuntimeException('Amount must be positive');
        }

        if ($available->compareTo($amount) < 0) {
            throw new RuntimeException('Insufficient balance');
        }

        if ($bank && empty($bank->bank_account_number) && empty($bank->bank_ifsc)) {
            throw new RuntimeException('Add bank details before requesting a withdrawal');
        }

        $idempotencyKey ??= 'WDL_'.strtoupper(Str::uuid()->toString());

        try {
            return Payout::create([
                'payout_number' => 'WD_'.date('YmdHis').'_'.strtoupper(Str::random(5)),
                'party_type' => $partyType,
                'driver_id' => $driverId,
                'delivery_partner_id' => $partnerId,
                'vendor_id' => $vendorId,
                'amount' => $amount->major(),
                'currency' => 'INR',
                'bank_account_name' => $bank->bank_account_name ?? null,
                'bank_account_number' => $bank->bank_account_number ?? null,
                'bank_ifsc' => $bank->bank_ifsc ?? null,
                'bank_name' => $bank->bank_name ?? null,
                'status' => 'PENDING',
                'mode' => 'bank_transfer',
                'idempotency_key' => $idempotencyKey,
                'meta' => array_merge(['service' => $service], $meta),
            ]);
        } catch (QueryException $e) {
            if ((string) $e->getCode() === '23000' || str_contains($e->getMessage(), 'UNIQUE constraint failed')) {
                $existing = Payout::where('idempotency_key', $idempotencyKey)->first();

                if ($existing) {
                    return $existing;
                }
            }

            throw $e;
        }
    }

    private function transitionPayout(Payout $payout, array $fromStatuses, string $toStatus, ?string $failureReason = null): Payout
    {
        return DB::transaction(function () use ($payout, $fromStatuses, $toStatus, $failureReason) {
            $locked = Payout::whereKey($payout->id)->whereIn('status', $fromStatuses)->lockForUpdate()->first();

            if (! $locked) {
                if ($payout->status === $toStatus) {
                    return $payout->fresh();
                }
                throw new RuntimeException('Payout cannot be moved to '.$toStatus.' from current state');
            }

            $locked->update([
                'status' => $toStatus,
                'failure_reason' => $failureReason,
            ]);

            return $locked->fresh();
        });
    }
}
