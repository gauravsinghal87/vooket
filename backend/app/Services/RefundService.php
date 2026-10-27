<?php

namespace App\Services;

use App\Models\Commission;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Refund;
use App\Models\Ride;
use App\Models\Settlement;
use App\Models\SettlementItem;
use App\Models\User;
use App\Models\WalletTransaction;
use App\Support\Money;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Single refund orchestration for Food, Grocery and Ride payables.
 *
 * Reimbursement destinations (exactly one path per refund):
 *   - `wallet`           -> credit the customer wallet once; the gateway
 *                           payment is intentionally NOT refunded.
 *   - `original_payment` -> provider refund through the payment gateway,
 *                           exactly once; the wallet is NOT credited.
 *   - `bank`             -> manual bank settlement; the refund stays in
 *                           PROCESSING until an operator confirms it.
 *
 * Stakeholder reversals on delivered orders are proportional to the refunded
 * share of the order and are recorded as debit settlement items (auditable
 * recovery) instead of deleting the original settlement history. Delivery
 * partner earnings are never reversed by ordinary merchandise refunds.
 */
class RefundService
{
    public const DESTINATION_WALLET = 'wallet';

    public const DESTINATION_ORIGINAL = 'original_payment';

    public const DESTINATION_BANK = 'bank';

    public function __construct(
        private WalletService $walletService,
        private PaymentService $paymentService,
        private JournalService $journalService,
    ) {}

    /**
     * Currently refundable amount: charged amount minus every refund that
     * is still open or completed (failed/rejected refunds free up balance).
     */
    public function refundableAmount(Payment $payment): Money
    {
        $charged = Money::fromPaise((int) ($payment->amount_paise ?? Money::fromMajor($payment->amount)->paise()));
        $open = 0;

        $refunds = Refund::where('payment_id', $payment->id)
            ->whereNotIn('status', ['FAILED', 'REJECTED'])
            ->get();

        foreach ($refunds as $refund) {
            $open += Money::fromMajor($refund->amount)->paise();
        }

        return Money::fromPaise(max(0, $charged->paise() - $open));
    }

    /**
     * Request a refund. Guards:
     *  - the payment must already be settled (SUCCESS / PARTIALLY_REFUNDED);
     *  - the amount cannot exceed the remaining refundable balance;
     *  - the request is idempotent by idempotency_key (unique constraint).
     */
    public function request(
        User $user,
        Payment $payment,
        Money $amount,
        string $reason,
        ?string $notes = null,
        ?string $idempotencyKey = null,
        string $destination = self::DESTINATION_ORIGINAL
    ): Refund {
        if ((int) $payment->user_id !== (int) $user->id) {
            throw new RuntimeException('Payment does not belong to this account');
        }

        if (! in_array($payment->status, ['SUCCESS', 'PARTIALLY_REFUNDED'], true)) {
            throw new RuntimeException('Payment is not refundable');
        }

        if ($amount->isNegative() || $amount->isZero()) {
            throw new RuntimeException('Refund amount must be positive');
        }

        $destination = $this->normalizeDestination($destination);
        $idempotencyKey ??= 'REF_'.strtoupper(Str::uuid()->toString());

        return DB::transaction(function () use ($user, $payment, $amount, $reason, $notes, $idempotencyKey, $destination) {
            $existing = Refund::where('idempotency_key', $idempotencyKey)->first();
            if ($existing) {
                return $existing;
            }

            $lockedPayment = Payment::whereKey($payment->id)->lockForUpdate()->first() ?? $payment;

            $remaining = $this->refundableAmount($lockedPayment);
            if ($amount->compareTo($remaining) > 0) {
                throw new RuntimeException('Refund amount exceeds the refundable balance');
            }

            try {
                return Refund::create([
                    'refund_number' => 'REF_'.date('YmdHis').'_'.strtoupper(Str::random(5)),
                    'payment_id' => $lockedPayment->id,
                    'user_id' => $user->id,
                    'refundable_type' => $lockedPayment->payable_type,
                    'refundable_id' => $lockedPayment->payable_id,
                    'amount' => $amount->major(),
                    'currency' => $lockedPayment->currency ?: 'INR',
                    'reason' => $reason,
                    'notes' => $notes,
                    'status' => 'REQUESTED',
                    'idempotency_key' => $idempotencyKey,
                    'meta' => [
                        'payment_number' => $lockedPayment->payment_number,
                        'destination' => $destination,
                    ],
                ]);
            } catch (QueryException $e) {
                if ((string) $e->getCode() === '23000' || str_contains($e->getMessage(), 'UNIQUE constraint failed')) {
                    $existing = Refund::where('idempotency_key', $idempotencyKey)->first();
                    if ($existing) {
                        return $existing;
                    }
                }

                throw $e;
            }
        });
    }

    public function approve(Refund $refund, User $admin): Refund
    {
        return DB::transaction(function () use ($refund, $admin) {
            $locked = Refund::whereKey($refund->id)->where('status', 'REQUESTED')->lockForUpdate()->first();

            if (! $locked) {
                throw new RuntimeException('Refund is not in a requestable state');
            }

            $locked->update([
                'status' => 'APPROVED',
                'approved_by' => $admin->id,
                'approved_at' => now(),
            ]);

            return $locked->fresh();
        });
    }

    /**
     * Execute the money movement for a refund through its recorded
     * destination. Exactly one reimbursement path runs per refund:
     *  - wallet: one wallet credit (idempotent by refund id), no gateway call;
     *  - original_payment: one provider refund (idempotent by provider
     *    reference), never a wallet credit.
     * Safe to call repeatedly.
     */
    public function process(Refund $refund): Refund
    {
        return DB::transaction(function () use ($refund) {
            $locked = Refund::whereKey($refund->id)
                ->whereIn('status', ['REQUESTED', 'APPROVED', 'PROCESSING', 'FAILED'])
                ->lockForUpdate()
                ->first();

            if (! $locked) {
                $fresh = $refund->fresh();
                if ($fresh && strtoupper((string) $fresh->status) === 'COMPLETED') {
                    return $fresh;
                }

                throw new RuntimeException('Refund is not in a processable state');
            }

            $payment = Payment::whereKey($locked->payment_id)->lockForUpdate()->first();

            if (! $payment) {
                throw new RuntimeException('Payment not found for refund');
            }

            $destination = $this->normalizeDestination($locked->meta['destination'] ?? self::DESTINATION_ORIGINAL);

            if ($destination === self::DESTINATION_BANK) {
                $locked->update(['status' => 'PROCESSING']);

                throw new RuntimeException('Bank refunds are settled manually and cannot be auto-processed');
            }

            if (! $locked->provider_reference) {
                // Remaining refundable balance excluding this refund itself
                // (it is already counted while in REQUESTED/APPROVED state).
                $charged = Money::fromPaise((int) ($payment->amount_paise ?? Money::fromMajor($payment->amount)->paise()));
                $otherOpen = 0;
                foreach (Refund::where('payment_id', $payment->id)
                    ->where('id', '!=', $locked->id)
                    ->whereNotIn('status', ['FAILED', 'REJECTED'])
                    ->get() as $other) {
                    $otherOpen += Money::fromMajor($other->amount)->paise();
                }
                $remaining = Money::fromPaise(max(0, $charged->paise() - $otherOpen));

                if (Money::fromMajor($locked->amount)->compareTo($remaining) > 0) {
                    throw new RuntimeException('Refund amount exceeds the refundable balance');
                }
            }

            $locked->update(['status' => 'PROCESSING']);

            if ($destination === self::DESTINATION_WALLET) {
                $this->walletService->credit(
                    $locked->user,
                    'customer',
                    $locked->amount,
                    'REFUND',
                    Refund::class,
                    $locked->id,
                    'Refund for '.$locked->refund_number,
                    'refund:wallet:'.$locked->id,
                    [
                        'refund_id' => $locked->id,
                        'payment_number' => $payment->payment_number,
                        'destination' => self::DESTINATION_WALLET,
                    ]
                );

                $locked->update([
                    'status' => 'COMPLETED',
                    'processed_at' => now(),
                    'meta' => array_merge($locked->meta ?? [], ['gateway_refunded' => false]),
                ]);

                $this->syncPayableAfterRefund($payment, $locked);

                return $locked->fresh();
            }

            // Original payment method: the provider is refunded exactly once.
            if (! $locked->provider_reference) {
                try {
                    $gateway = $this->paymentService->gateway();

                    $response = $gateway->refund([
                        'payment_id' => $payment->provider_payment_id,
                        'amount_paise' => Money::fromMajor($locked->amount)->paise(),
                        'currency' => $locked->currency ?: 'INR',
                        'notes' => [
                            'refund_number' => $locked->refund_number,
                            'reason' => $locked->reason,
                        ],
                    ]);

                    $locked->update([
                        'status' => 'COMPLETED',
                        'provider_reference' => $response['id'] ?? null,
                        'processed_at' => now(),
                        'meta' => array_merge($locked->meta ?? [], [
                            'provider_response' => $response,
                            'gateway_refunded' => true,
                        ]),
                    ]);
                } catch (\Throwable $e) {
                    $locked->update([
                        'status' => 'FAILED',
                        'meta' => array_merge($locked->meta ?? [], ['error' => $e->getMessage()]),
                    ]);

                    throw new RuntimeException('Refund processing failed: '.$e->getMessage(), 0, $e);
                }
            } else {
                $locked->update(['status' => 'COMPLETED', 'processed_at' => $locked->processed_at ?? now()]);
            }

            $this->syncPayableAfterRefund($payment, $locked);

            $this->postGatewayRefundJournal($payment, $locked);

            return $locked->fresh();
        });
    }

    /**
     * Book a refund paid back through the original payment method:
     * revenue is given back and the gateway clearing asset shrinks.
     * Wallet refunds are already booked by their own wallet credit
     * (Dr revenue clearing, Cr customer wallet).
     */
    private function postGatewayRefundJournal(Payment $payment, Refund $refund): void
    {
        $revenueAccount = $payment->payable_type === Ride::class
            ? 'ride_revenue_clearing'
            : 'order_revenue_clearing';

        $this->journalService->post(
            sourceType: Refund::class,
            sourceId: $refund->id,
            entryType: 'refund_issued',
            lines: [
                ['account' => $revenueAccount, 'direction' => 'debit', 'amount' => $refund->amount, 'memo' => 'Refund '.$refund->refund_number],
                ['account' => 'payment_clearing', 'direction' => 'credit', 'amount' => $refund->amount, 'memo' => 'Refund '.$refund->refund_number],
            ],
            idempotencyKey: 'refund:gateway:'.$refund->id,
            description: 'Gateway refund for '.$refund->refund_number,
            meta: [
                'destination' => self::DESTINATION_ORIGINAL,
                'payment_number' => $payment->payment_number,
                'payable' => $payment->payable_type ? class_basename($payment->payable_type) : null,
            ]
        );
    }

    public function reject(Refund $refund, User $admin, ?string $reason = null): Refund
    {
        return DB::transaction(function () use ($refund, $admin, $reason) {
            $locked = Refund::whereKey($refund->id)
                ->whereIn('status', ['REQUESTED', 'APPROVED'])
                ->lockForUpdate()
                ->first();

            if (! $locked) {
                throw new RuntimeException('Refund is not in a rejectable state');
            }

            $meta = $locked->meta ?? [];
            $meta['rejected_by'] = $admin->id;
            $meta['rejection_reason'] = $reason;

            $locked->update([
                'status' => 'REJECTED',
                'meta' => $meta,
            ]);

            return $locked->fresh();
        });
    }

    /**
     * Admin-initiated refund for a CANCELLED prepaid/online order. Reverses
     * the order's financial impact and actually moves the money back through
     * the recorded destination (provider refund by default). Idempotent:
     * a refund already opened for the payment (e.g. the automatic
     * cancellation refund) is reused instead of creating a second one.
     */
    public function refundCancelledOrder(
        Order $order,
        User $admin,
        Money $amount,
        string $reason,
        ?string $notes = null,
        string $destination = self::DESTINATION_ORIGINAL
    ): Refund {
        return DB::transaction(function () use ($order, $admin, $amount, $reason, $notes, $destination) {
            $locked = Order::whereKey($order->id)->lockForUpdate()->first();

            if (! $locked) {
                throw new RuntimeException('Order not found');
            }

            if (strtoupper((string) $locked->status) !== 'CANCELLED') {
                throw new RuntimeException('Only a cancelled order can be refunded');
            }

            $idempotencyKey = 'ADMIN_ORDER_REFUND_'.$locked->id;
            $payment = $locked->payments()->lockForUpdate()->first();

            if (! $payment) {
                throw new RuntimeException('No payment found for this order');
            }

            // Idempotency first: a re-click (or an automatic cancellation
            // refund that already ran) must return the existing refund
            // instead of re-validating a payment that is now REFUNDED.
            $existing = Refund::where('idempotency_key', $idempotencyKey)->lockForUpdate()->first()
                ?? Refund::where('payment_id', $payment->id)
                    ->whereNotIn('status', ['FAILED', 'REJECTED'])
                    ->lockForUpdate()
                    ->first();

            if ($existing) {
                if (strtoupper((string) $existing->status) !== 'COMPLETED') {
                    $this->reverseVendorShareForOrder($locked, (float) $existing->amount, 'admin-order-refund:'.$locked->id);
                    $this->markCommissionsReversed($locked, (float) $existing->amount);
                    $this->process($existing);
                }

                return $existing->fresh();
            }

            if (! in_array(strtoupper((string) $payment->status), ['SUCCESS', 'PAID', 'PARTIALLY_REFUNDED'], true)) {
                throw new RuntimeException('Payment is not refundable');
            }

            $method = strtolower((string) ($payment->payment_method ?? $payment->method ?? ''));
            $destination = $method === 'wallet'
                ? self::DESTINATION_WALLET
                : $this->normalizeDestination($destination);

            $orderTotal = Money::fromMajor((float) $locked->total_amount);
            if ($amount->isNegative() || $amount->isZero() || $amount->compareTo($orderTotal) > 0) {
                throw new RuntimeException('Refund amount must be between 0 and the order total');
            }

            $refund = Refund::create([
                'refund_number' => 'REF_'.date('YmdHis').'_'.strtoupper(Str::random(5)),
                'payment_id' => $payment->id,
                'user_id' => $admin->id,
                'refundable_type' => $payment->payable_type,
                'refundable_id' => $payment->payable_id,
                'amount' => $amount->major(),
                'currency' => $payment->currency ?: 'INR',
                'reason' => $reason,
                'notes' => $notes,
                'status' => 'REQUESTED',
                'idempotency_key' => $idempotencyKey,
                'meta' => [
                    'source' => 'admin_order_refund',
                    'order_id' => $locked->id,
                    'destination' => $destination,
                    'reversed_revenue' => true,
                ],
            ]);

            $this->reverseVendorShareForOrder(
                $locked,
                (float) $refund->amount,
                'admin-order-refund:'.$locked->id
            );

            $this->markCommissionsReversed($locked, (float) $refund->amount);

            $this->process($refund);

            return $refund->fresh();
        });
    }

    /**
     * Admin-approved refund for a DELIVERED order raised via a support
     * ticket. Reverses the vendor/platform shares proportionally (never the
     * delivery partner's earning) and reimburses the customer through the
     * chosen destination.
     */
    public function refundDeliveredOrder(
        Order $order,
        User $admin,
        Money $amount,
        string $reason,
        ?string $notes = null,
        string $destination = self::DESTINATION_WALLET,
        ?int $ticketId = null,
    ): Refund {
        return DB::transaction(function () use ($order, $amount, $reason, $notes, $destination, $ticketId) {
            $locked = Order::whereKey($order->id)->lockForUpdate()->first();

            if (! $locked) {
                throw new RuntimeException('Order not found');
            }

            if (! in_array(strtoupper((string) $locked->status), ['DELIVERED', 'CANCELLED'], true)) {
                throw new RuntimeException('Only a delivered or cancelled order can be refunded through this flow');
            }

            $payment = $locked->payments()->lockForUpdate()->first();

            if (! $payment) {
                throw new RuntimeException('No payment found for this order');
            }

            if (! in_array(strtoupper((string) $payment->status), ['SUCCESS', 'PAID', 'PARTIALLY_REFUNDED'], true)) {
                throw new RuntimeException('Payment is not refundable');
            }

            $orderTotal = Money::fromMajor((float) $locked->total_amount);
            if ($amount->isNegative() || $amount->isZero() || $amount->compareTo($orderTotal) > 0) {
                throw new RuntimeException('Refund amount must be between 0 and the order total');
            }

            $destination = $this->normalizeDestination($destination);

            $idempotencyKey = 'SUPPORT_REFUND_'.($ticketId ?: $locked->id);

            $existing = Refund::where('idempotency_key', $idempotencyKey)->lockForUpdate()->first();
            if ($existing) {
                return $existing;
            }

            $refund = Refund::create([
                'refund_number' => 'REF_'.date('YmdHis').'_'.strtoupper(Str::random(5)),
                'payment_id' => $payment->id,
                'user_id' => $locked->user_id,
                'refundable_type' => $payment->payable_type,
                'refundable_id' => $payment->payable_id,
                'amount' => $amount->major(),
                'currency' => $payment->currency ?: 'INR',
                'reason' => $reason,
                'notes' => $notes,
                'status' => 'REQUESTED',
                'idempotency_key' => $idempotencyKey,
                'meta' => [
                    'source' => 'support_ticket',
                    'ticket_id' => $ticketId,
                    'order_id' => $locked->id,
                    'destination' => $destination,
                    'reversed_revenue' => true,
                ],
            ]);

            $reversed = $this->reverseVendorShareForOrder(
                $locked,
                (float) $refund->amount,
                'support-refund:'.$refund->id
            );

            $this->markCommissionsReversed($locked, (float) $refund->amount);

            $meta = $refund->meta ?? [];
            $meta['reversed_settlement_ids'] = $reversed['settlement_ids'];
            $meta['vendor_debit_total'] = $reversed['wallet_debited'];
            $meta['vendor_receivable_total'] = $reversed['receivable'];
            $refund->update(['meta' => $meta]);

            if ($destination !== self::DESTINATION_BANK) {
                $this->process($refund);
            } else {
                $refund->update(['status' => 'PROCESSING']);
            }

            return $refund->fresh();
        });
    }

    /**
     * Repair path for a delivered order that was already refunded outside
     * this orchestrator: re-applies any missing vendor/platform reversal,
     * exactly once per order and settlement.
     */
    public function reconcileDeliveredRefund(Order $order, ?User $admin = null): array
    {
        return DB::transaction(function () use ($order) {
            $locked = Order::whereKey($order->id)->lockForUpdate()->first();

            if (! $locked) {
                throw new RuntimeException('Order not found');
            }

            $completedRefunds = Refund::where('refundable_type', Order::class)
                ->where('refundable_id', $locked->id)
                ->whereIn('status', ['COMPLETED', 'PROCESSING', 'APPROVED', 'REQUESTED'])
                ->get();

            $refundedTotal = 0.0;
            foreach ($completedRefunds as $refund) {
                $refundedTotal += (float) $refund->amount;
            }

            $payment = $locked->payments()->lockForUpdate()->first();
            if ($payment) {
                $refundedTotal = max($refundedTotal, (float) $payment->amount - (float) $this->refundableAmount($payment)->major());
            }

            if ($refundedTotal <= 0) {
                return [
                    'order_id' => $locked->id,
                    'vendor_debit' => 0.0,
                    'payment_status' => (string) $locked->payment_status,
                ];
            }

            $reversed = $this->reverseVendorShareForOrder($locked, $refundedTotal, 'reconcile:'.$locked->id);
            $this->markCommissionsReversed($locked, $refundedTotal);

            if ($payment && strtoupper((string) $payment->status) !== 'REFUNDED') {
                $payment->update(['status' => 'REFUNDED']);
            }
            $locked->update(['payment_status' => 'REFUNDED']);

            return [
                'order_id' => $locked->id,
                'vendor_debit' => $reversed['wallet_debited'],
                'payment_status' => 'REFUNDED',
            ];
        });
    }

    /**
     * Ride refund helper: reimburses a paid (completed or cancelled) ride
     * through the chosen destination. Driver earnings for a completed ride
     * are not rewritten; a recovery receivable is recorded instead when the
     * ride was already completed.
     */
    public function refundRide(
        Ride $ride,
        User $admin,
        Money $amount,
        string $reason,
        ?string $notes = null,
        string $destination = self::DESTINATION_ORIGINAL
    ): Refund {
        return DB::transaction(function () use ($ride, $amount, $reason, $notes, $destination) {
            $locked = Ride::whereKey($ride->id)->lockForUpdate()->first();

            if (! $locked) {
                throw new RuntimeException('Ride not found');
            }

            $payment = $locked->payments()->lockForUpdate()->first();

            if (! $payment) {
                throw new RuntimeException('No online payment found for this ride; cash rides are settled through cash reconciliation');
            }

            if (! in_array(strtoupper((string) $payment->status), ['SUCCESS', 'PAID', 'PARTIALLY_REFUNDED'], true)) {
                throw new RuntimeException('Payment is not refundable');
            }

            $payable = Money::fromMajor((float) ($locked->final_fare ?? $locked->estimated_fare));
            if ($amount->isNegative() || $amount->isZero() || $amount->compareTo($payable) > 0) {
                throw new RuntimeException('Refund amount must be between 0 and the ride fare');
            }

            $destination = $this->normalizeDestination($destination);
            $idempotencyKey = 'RIDE_REFUND_'.$locked->id;

            $refund = Refund::where('idempotency_key', $idempotencyKey)->lockForUpdate()->first();

            if (! $refund) {
                $refund = Refund::create([
                    'refund_number' => 'REF_'.date('YmdHis').'_'.strtoupper(Str::random(5)),
                    'payment_id' => $payment->id,
                    'user_id' => $locked->user_id,
                    'refundable_type' => $payment->payable_type,
                    'refundable_id' => $payment->payable_id,
                    'amount' => $amount->major(),
                    'currency' => $payment->currency ?: 'INR',
                    'reason' => $reason,
                    'notes' => $notes,
                    'status' => 'REQUESTED',
                    'idempotency_key' => $idempotencyKey,
                    'meta' => [
                        'source' => 'ride_refund',
                        'ride_id' => $locked->id,
                        'ride_number' => $locked->ride_number,
                        'destination' => $destination,
                    ],
                ]);
            }

            $meta = $refund->meta ?? [];
            if (strtoupper((string) $locked->status) === 'COMPLETED' && $locked->driverEarning) {
                $meta['driver_recovery_note'] = 'Driver earning for ride '.$locked->ride_number.' is retained; recovery must be settled out of band.';
            }
            $refund->update(['meta' => $meta]);

            $this->process($refund);

            return $refund->fresh();
        });
    }

    /**
     * Proportional vendor/platform reversal for a refunded order.
     *
     * A partial refund never deletes the original settlement history: a
     * debit settlement item (auditable recovery) is written instead and the
     * settlement's net payable is reduced by the same amount. The vendor
     * wallet is debited only up to its spendable balance; the remainder
     * stays as a receivable inside the settlement.
     *
     * @return array{settlement_ids: array<int>, wallet_debited: float, receivable: float}
     */
    private function reverseVendorShareForOrder(Order $order, float $refundAmount, string $idempotencyPrefix): array
    {
        $result = ['settlement_ids' => [], 'wallet_debited' => 0.0, 'receivable' => 0.0];

        if ($refundAmount <= 0) {
            return $result;
        }

        $orderTotal = max(0.0001, (float) $order->total_amount);
        $ratio = min(1.0, $refundAmount / $orderTotal);
        $isFull = abs($refundAmount - (float) $order->total_amount) < 0.005;

        $netRecorded = (float) ($order->net_vendor_payout ?? 0);
        $reversalNet = $isFull ? round($netRecorded, 2) : round($netRecorded * $ratio, 2);

        if ($reversalNet <= 0) {
            return $result;
        }

        $existingItems = SettlementItem::where('source_type', 'order')
            ->where('source_id', $order->id)
            ->lockForUpdate()
            ->get();

        $settlementIds = $existingItems->pluck('settlement_id')
            ->merge(
                SettlementItem::where('source_type', 'refund')
                    ->where('meta->order_id', $order->id)
                    ->pluck('settlement_id')
            )
            ->unique()
            ->values();

        foreach ($settlementIds as $settlementId) {
            $settlement = Settlement::whereKey($settlementId)->lockForUpdate()->first();

            if (! $settlement) {
                continue;
            }
            if ($settlement->party_type === 'delivery_partner' || $settlement->delivery_partner_id !== null) {
                continue;
            }

            $alreadyReversed = SettlementItem::where('settlement_id', $settlement->id)
                ->where('source_type', 'refund')
                ->where('meta->order_id', $order->id)
                ->exists();

            if ($alreadyReversed) {
                $result['settlement_ids'][] = (int) $settlement->id;

                continue;
            }

            SettlementItem::create([
                'settlement_id' => $settlement->id,
                'source_type' => 'refund',
                'source_id' => $order->id,
                'amount' => $reversalNet,
                'direction' => 'debit',
                'description' => 'Refund reversal for order '.$order->order_number,
                'meta' => [
                    'order_id' => $order->id,
                    'order_number' => $order->order_number,
                    'reversal_ratio' => round($ratio, 6),
                    'refund_amount' => $refundAmount,
                    'idempotency_prefix' => $idempotencyPrefix,
                ],
            ]);

            $settlement->decrement('net_payable', $reversalNet);
            $settlement->increment('total_refunds', $reversalNet);

            if ((float) $settlement->fresh()->net_payable <= 0.0) {
                $settlement->update(['status' => 'REVERSED']);
            }

            $result['settlement_ids'][] = (int) $settlement->id;

            if (! $order->vendor?->user) {
                $result['receivable'] += $reversalNet;

                continue;
            }

            $available = $this->walletService->availableForUpdate($order->vendor->user, 'vendor')->paise();
            $wanted = Money::fromMajor($reversalNet)->paise();
            $toDebit = min($available, $wanted);

            if ($toDebit > 0) {
                $this->walletService->debit(
                    $order->vendor->user,
                    'vendor',
                    Money::fromPaise($toDebit)->major(),
                    'REVERSAL',
                    Settlement::class,
                    $settlement->id,
                    'Refund reversal for order '.$order->order_number,
                    $idempotencyPrefix.':settlement:'.$settlement->id,
                    [
                        'order_id' => $order->id,
                        'settlement_id' => $settlement->id,
                        'source' => 'refund_reconciliation',
                    ]
                );
                $result['wallet_debited'] += Money::fromPaise($toDebit)->major();
            }

            $remainder = Money::fromPaise($wanted - $toDebit)->major();
            if ($remainder > 0) {
                $result['receivable'] += $remainder;
            }
        }

        return $result;
    }

    /**
     * Commission reversal for a refunded order: full refunds mark the
     * commission REVERSED, partial refunds record the reversed share in the
     * commission meta without rewriting the historical row.
     */
    private function markCommissionsReversed(Order $order, float $refundAmount): void
    {
        $orderTotal = max(0.0001, (float) $order->total_amount);
        $isFull = abs($refundAmount - (float) $order->total_amount) < 0.005;
        $ratio = min(1.0, $refundAmount / $orderTotal);

        $commissions = Commission::where('source_type', 'order')
            ->where('source_id', $order->id)
            ->lockForUpdate()
            ->get();

        foreach ($commissions as $commission) {
            if (strtoupper((string) $commission->status) === 'REVERSED') {
                continue;
            }

            $meta = $commission->meta ?? [];
            $reversedShare = round((float) $commission->commission_amount * $ratio, 2);
            $meta['reversed_amount'] = round((float) ($meta['reversed_amount'] ?? 0) + $reversedShare, 2);
            $meta['reversal_ratio'] = round($ratio, 6);

            if ($isFull) {
                $commission->update(['status' => 'REVERSED', 'meta' => $meta]);

                continue;
            }

            $commission->update([
                'status' => (float) ($meta['reversed_amount']) >= (float) $commission->commission_amount - 0.005
                    ? 'REVERSED'
                    : 'partially_reversed',
                'meta' => $meta,
            ]);
        }
    }

    /**
     * Keep payment, order and ride statuses in step with the completed
     * refund amount. Every refund has exactly one reimbursement outcome, so
     * the payable status is derived from completed refunds only.
     */
    private function syncPayableAfterRefund(Payment $payment, Refund $refund): void
    {
        $completed = 0.0;
        foreach (Refund::where('payment_id', $payment->id)->where('status', 'COMPLETED')->get() as $row) {
            $completed += (float) $row->amount;
        }

        $paid = (float) $payment->amount;
        $fullyRefunded = $completed + 0.005 >= $paid;

        $payment->update(['status' => $fullyRefunded ? 'REFUNDED' : 'PARTIALLY_REFUNDED']);

        $payable = $payment->payable;

        if ($payable instanceof Order) {
            $payable->update([
                'payment_status' => $fullyRefunded ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
                'refund_amount' => $completed,
                'refund_status' => $fullyRefunded ? 'completed' : 'partial',
                'refunded_at' => $fullyRefunded ? now() : ($payable->refunded_at ?? null),
            ]);
        }

        if ($payable instanceof Ride) {
            $payable->update([
                'payment_status' => $fullyRefunded ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
            ]);
        }
    }

    private function normalizeDestination(string $destination): string
    {
        $destination = strtolower(trim($destination));

        return in_array($destination, [self::DESTINATION_WALLET, self::DESTINATION_ORIGINAL, self::DESTINATION_BANK], true)
            ? $destination
            : self::DESTINATION_ORIGINAL;
    }

    /**
     * Kept for backward compatibility with callers that still hold a
     * wallet transaction reference type check.
     */
    public function hasWalletCredit(Refund $refund): bool
    {
        return WalletTransaction::where('reference_type', Refund::class)
            ->where('reference_id', $refund->id)
            ->where('direction', 'credit')
            ->exists();
    }
}
