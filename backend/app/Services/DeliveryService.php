<?php

namespace App\Services;

use App\Exceptions\DeliveryGateException;
use App\Exceptions\InvalidOrderTransitionException;
use App\Jobs\BroadcastOrderTracking;
use App\Models\DeliveryPartner;
use App\Models\DeliveryPartnerEarning;
use App\Models\DispatchLog;
use App\Models\Order;
use App\Models\OrderStatusHistory;
use App\Models\Payment;
use App\Models\User;
use App\Models\Wallet;
use App\Services\Dispatch\DeliveryPartnerEligibilityService;
use App\Services\Dispatch\GroceryBatchService;
use App\Services\Dispatch\OrderDispatchService;
use App\Services\Dispatch\OrderServiceTypeResolver;
use App\Services\Integration\WebhookNotifier;
use App\Services\Pricing\DeliveryFeeService;
use App\Services\Pricing\GroceryDeliveryConfigService;
use App\Support\Money;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Delivery lifecycle: the single, row-locked path through which an order
 * moves from partner assignment into a delivered/cancelled terminal state.
 *
 * All mutating entry points lock the order row first, so concurrent web
 * requests (double "delivered" taps, an admin marking cancelled while a
 * partner claims a job, two partners racing for the same delivery) serialize
 * on the order. Financial side effects — partner earnings, vendor
 * commission, inventory sale, refunds — are exactly-once and re-entrant.
 */
class DeliveryService
{
    public function __construct(
        private WalletService $walletService,
        private RefundService $refundService,
        private PaymentService $paymentService,
        private InventoryService $inventoryService,
        private CommissionService $commissionService,
        private WebhookNotifier $webhookNotifier,
        private OrderDispatchService $dispatchService,
        private DeliveryPartnerEligibilityService $eligibility,
        private OrderServiceTypeResolver $serviceTypeResolver,
        private DeliveryFeeService $deliveryFeeService,
        private GroceryDeliveryConfigService $groceryDeliveryConfig,
        private DeliverySlotService $deliverySlotService,
        private JournalService $journalService,
    ) {}

    /**
     * Nearest eligible partner for a manual (admin) assignment.
     */
    public function findAvailablePartner(Order $order): ?DeliveryPartner
    {
        $pickup = $this->dispatchService->pickupCoordinates($order);

        if (! $pickup) {
            return null;
        }

        $maxRadius = (float) config('dispatch.max_radius_km', 10);

        return $this->eligibility->eligibleCandidates($order)
            ->map(fn (DeliveryPartner $partner) => [
                'partner' => $partner,
                'distance_km' => $this->haversineKm(
                    $pickup['latitude'],
                    $pickup['longitude'],
                    (float) $partner->latitude,
                    (float) $partner->longitude
                ),
            ])
            ->reject(fn (array $candidate) => $candidate['distance_km'] > $maxRadius)
            ->sortBy([
                ['distance_km', 'asc'],
                ['id', 'asc'],
            ])
            ->value('partner');
    }

    /**
     * Atomically assign `$partner` to the order. Idempotent for the same
     * partner; reassignment to a different partner is rejected.
     */
    public function claimOrder(Order $order, DeliveryPartner $partner, ?User $actor = null, ?string $note = null): Order
    {
        return DB::transaction(function () use ($order, $partner, $actor, $note) {
            $locked = Order::whereKey($order->id)->lockForUpdate()->first();

            if (! $locked) {
                throw new RuntimeException('Order not found');
            }

            if ($locked->delivery_partner_id !== null) {
                if ((int) $locked->delivery_partner_id === (int) $partner->id) {
                    return $locked->fresh();
                }

                throw new RuntimeException('Order already has an assigned delivery partner');
            }

            if (! $this->eligibility->isEligible($partner, $locked)) {
                throw new RuntimeException('Partner is not eligible for this order');
            }

            $this->assertMutationAllowed($locked, 'PARTNER_ASSIGNED');

            $oldStatus = (string) $locked->status;
            $changedById = $partner->user_id;
            $changedByType = 'delivery_partner';

            if ($actor) {
                $changedById = $actor->id;
                $changedByType = in_array($actor->user_type, ['admin', 'super_admin'], true) ? 'admin' : $actor->user_type;
            }

            $locked->update([
                'status' => 'PARTNER_ASSIGNED',
                'delivery_partner_id' => $partner->id,
                'partner_assigned_at' => now(),
            ]);

            $this->recordHistory($locked, 'PARTNER_ASSIGNED', $changedById, $changedByType, $note ?? 'Delivery partner assigned', $oldStatus);

            $expiredOfferIds = DispatchLog::where('order_id', $locked->id)
                ->whereIn('status', [DispatchLog::STATUS_PENDING, DispatchLog::STATUS_SENT])
                ->pluck('id');

            DispatchLog::where('order_id', $locked->id)
                ->whereIn('status', [DispatchLog::STATUS_PENDING, DispatchLog::STATUS_SENT])
                ->update(['status' => DispatchLog::STATUS_EXPIRED]);

            // Freeze the earning the partner accepted so the figure they agreed
            // to is the figure credited on completion, even if an Admin changes
            // the per-km rate while the delivery is in progress.
            $this->snapshotAcceptedOfferEarning($locked);

            $partner = DeliveryPartner::whereKey($partner->id)->lockForUpdate()->first() ?? $partner;
            $partner->update(['is_busy' => true]);

            $this->webhookNotifier->deliveryAssigned($locked->fresh());

            $this->broadcastOrder($locked->fresh());
            $this->broadcastAssignment($locked->fresh(), $partner);

            DB::afterCommit(function () use ($expiredOfferIds) {
                foreach ($expiredOfferIds as $offerId) {
                    app(OrderDispatchService::class)->announceOfferExpired(DispatchLog::find($offerId));
                }
            });

            return $locked->fresh();
        });
    }

    public function markPickedUp(Order $order, DeliveryPartner $partner, ?string $note = null): Order
    {
        return $this->advance($order, $partner, 'PICKED_UP', 'picked_up_at', $note);
    }

    public function markOutForDelivery(Order $order, DeliveryPartner $partner, ?string $note = null): Order
    {
        return $this->advance($order, $partner, 'OUT_FOR_DELIVERY', 'out_for_delivery_at', $note);
    }

    public function markArrived(Order $order, DeliveryPartner $partner, ?string $note = null): Order
    {
        return $this->advance($order, $partner, 'ARRIVED', 'arrived_at', $note);
    }

    public function markDelivered(Order $order, DeliveryPartner $partner, ?string $note = null, bool $enforceDeliveryGate = true): Order
    {
        $this->assertOwnership($order, $partner);

        return DB::transaction(function () use ($order, $partner, $note, $enforceDeliveryGate) {
            $locked = Order::whereKey($order->id)->lockForUpdate()->first();

            if (! $locked) {
                throw new RuntimeException('Order not found');
            }

            if ($locked->status === 'DELIVERED') {
                return $locked->fresh();
            }

            $this->assertMutationAllowed($locked, 'DELIVERED');

            if ($enforceDeliveryGate) {
                $this->assertDeliveryReady($locked);
            }

            $oldStatus = (string) $locked->status;

            $earning = $this->resolvePartnerEarning($locked);

            $locked->update([
                'status' => 'DELIVERED',
                'delivered_at' => now(),
                'delivered_via' => $this->resolveDeliveredVia($locked),
                'partner_payout' => $earning['amount'],
                'partner_payout_status' => 'pending',
            ]);

            $this->recordHistory($locked, 'DELIVERED', $partner->user_id, 'delivery_partner', $note ?? 'Order delivered', $oldStatus);

            $this->inventoryService->completeSale($locked, $partner->user_id);

            $this->recordPartnerEarning($locked, $partner, $earning['amount'], $earning['breakdown']);

            $this->commissionService->finalizeForOrder($locked, $partner->user_id);

            // Delivering one stop must not close the partner's trip while
            // sibling orders from the same grocery batch are still live.
            app(GroceryBatchService::class)->syncOrderStatus($locked->fresh());

            $this->webhookNotifier->orderDelivered($locked->fresh());
            $this->webhookNotifier->orderUpdated($locked->fresh());

            $this->broadcastOrder($locked->fresh());

            return $locked->fresh();
        });
    }

    /**
     * Delivery-completion gate shared by the partner API and any guarded
     * deliver path. Applies to both food and grocery delivery orders: payment
     * must be satisfied - either fully captured online or, for food cash,
     * collected AND settled through the partner wallet - and the customer
     * delivery OTP must be verified before the order may be marked delivered.
     *
     * @throws DeliveryGateException
     */
    public function assertDeliveryReady(Order $order): void
    {
        if (! in_array($order->order_type, ['food', 'grocery'], true)) {
            return;
        }

        $total = Money::fromMajor($order->total_amount ?? 0);
        $paid = $this->paymentService->paidForPayable($order);
        $remaining = $total->sub($paid);

        if ($order->delivery_payment_collected_at) {
            if (! $order->delivery_payment_settled_at) {
                throw new DeliveryGateException('Cash collected for this order must be settled in the partner wallet before marking as delivered');
            }
        } elseif ($remaining->paise() > 0 && (string) $order->payment_status !== 'paid') {
            throw new DeliveryGateException('Payment for this order must be collected before marking as delivered');
        }

        if (! $order->delivery_otp_verified_at) {
            throw new DeliveryGateException('Customer delivery OTP must be verified before marking as delivered');
        }
    }

    /**
     * Record a partner-side cash collection for a food or grocery order at
     * the door.
     *
     * Confirmation is deliberately wallet-neutral: the collected cash is the
     * customer's money remitted to the platform, NOT partner income, so it is
     * NEVER credited to the spendable partner wallet. It is recorded on the
     * order (delivery_payment_collected_at / _via / payment_status=paid) as
     * the auditable cash-collection ledger. The partner accounts for the
     * collected amount through the separate, explicit settle step.
     *
     * 'qr' attestation is rejected: a partner can never declare a payment
     * received without a verified gateway capture.
     *
     * Idempotent: replaying a completed collection returns the current order
     * and settlement state without any additional wallet effect.
     *
     * @return array{order: Order, payment: array}
     */
    public function confirmPaymentCollection(Order $order, DeliveryPartner $partner, string $method): array
    {
        $this->assertOwnership($order, $partner);

        return DB::transaction(function () use ($order, $partner, $method) {
            $locked = Order::whereKey($order->id)->lockForUpdate()->first();

            if (! $locked) {
                throw new RuntimeException('Order not found');
            }

            if (! $this->serviceTypeResolver->supportsCashCollection($this->serviceTypeResolver->resolve($locked))) {
                throw new DeliveryGateException('Payment collection is only available for food and grocery orders');
            }

            if (! in_array($locked->status, ['OUT_FOR_DELIVERY', 'ARRIVED'], true)) {
                throw new DeliveryGateException('Payment can only be collected once the order is out for delivery');
            }

            $method = strtolower($method);

            if ($method !== 'cash') {
                throw new DeliveryGateException('Only cash collection is supported — online payments are confirmed by the platform');
            }

            if (! $partner->user_id) {
                throw new RuntimeException('Partner wallet is not available');
            }

            $remaining = Money::fromMajor($locked->total_amount ?? 0)->sub($this->paymentService->paidForPayable($locked));

            if ($remaining->paise() <= 0) {
                throw new DeliveryGateException('No cash to collect for this order');
            }

            if (! $locked->delivery_payment_collected_at) {
                $locked->update([
                    'delivery_payment_collected_at' => now(),
                    'delivery_payment_collected_via' => 'cash',
                    'payment_status' => 'paid',
                ]);
            }

            $this->postCashCollectionJournal($locked, $remaining, 'partner');

            $this->broadcastOrder($locked->fresh());

            return [
                'order' => $locked->refresh(),
                'payment' => $this->paymentResultPayload($locked, $partner, $remaining),
            ];
        });
    }

    /**
     * Settle the collected cash for a food or grocery order against the
     * partner wallet.
     *
     * The partner funds the equal SETTLEMENT debit from their OWN wallet
     * balance (their earnings and top-ups). The customer's collected cash is
     * never parked as a spendable credit, so there is exactly one financial
     * effect for the whole cash-collection settlement per order: a single
     * SETTLEMENT debit. When the balance cannot cover the amount, settlement
     * stays pending with the shortfall surfaced to the UI so the partner can
     * top up through the existing Razorpay flow.
     *
     * Idempotent: already-settled orders return the current state without a
     * second debit, and the SETTLEMENT wallet transaction is keyed by
     * delivery-cash-settlement:{order_number}, so even concurrent duplicate
     * requests can only produce one debit.
     *
     * @return array{order: Order, payment: array, settled: bool}
     */
    public function settleCashCollection(Order $order, DeliveryPartner $partner): array
    {
        $this->assertOwnership($order, $partner);

        return DB::transaction(function () use ($order, $partner) {
            $locked = Order::whereKey($order->id)->lockForUpdate()->first();

            if (! $locked) {
                throw new RuntimeException('Order not found');
            }

            if (! $this->serviceTypeResolver->supportsCashCollection($this->serviceTypeResolver->resolve($locked))) {
                throw new DeliveryGateException('Cash settlement is only available for food and grocery orders');
            }

            if (! in_array($locked->status, ['OUT_FOR_DELIVERY', 'ARRIVED'], true)) {
                throw new DeliveryGateException('Cash can only be settled while the order is out for delivery');
            }

            if (! $locked->delivery_payment_collected_at) {
                throw new DeliveryGateException('Cash must be collected before it can be settled');
            }

            if (! $partner->user_id) {
                throw new RuntimeException('Partner wallet is not available');
            }

            if ($locked->delivery_payment_settled_at) {
                return [
                    'order' => $locked->refresh(),
                    'payment' => $this->paymentResultPayload($locked, $partner, Money::fromMajor($locked->total_amount ?? 0)),
                    'settled' => true,
                ];
            }

            $amount = Money::fromMajor($locked->total_amount ?? 0)->sub($this->paymentService->paidForPayable($locked));

            if ($amount->paise() <= 0) {
                throw new DeliveryGateException('Nothing to settle for this order');
            }

            $wallet = $this->walletService->ensureWallet($partner->user, 'delivery_partner');
            $wallet = Wallet::whereKey($wallet->id)->lockForUpdate()->first() ?? $wallet;

            $ownFunds = Money::fromMajor($wallet->balance);

            if ($ownFunds->compareTo($amount) < 0) {
                $available = (float) $ownFunds->major();
                $shortfall = (float) $amount->sub($ownFunds)->major();

                return [
                    'order' => $locked->refresh(),
                    'payment' => $this->paymentResultPayload($locked, $partner, $amount, false, $available, $shortfall),
                    'settled' => false,
                ];
            }

            $this->walletService->debit(
                $partner->user,
                'delivery_partner',
                $amount->major(),
                'SETTLEMENT',
                Order::class,
                $locked->id,
                "Cash settlement for order #{$locked->order_number}",
                'delivery-cash-settlement:'.$locked->order_number,
                ['service' => $this->serviceTypeResolver->resolve($locked), 'order_number' => $locked->order_number, 'method' => 'cash']
            );

            $locked->update(['delivery_payment_settled_at' => now()]);

            return [
                'order' => $locked->refresh(),
                'payment' => $this->paymentResultPayload($locked, $partner, $amount, true),
                'settled' => true,
            ];
        });
    }

    /**
     * Book cash collected from the customer: no gateway capture exists for a
     * cash order, so revenue is recognised here with the partner holding the
     * cash owed to the platform (cleared later by their cash settlement).
     */
    private function postCashCollectionJournal(Order $order, Money $amount, string $role): void
    {
        if ($amount->paise() <= 0) {
            return;
        }

        $receivable = $role === 'driver' ? 'driver_cash_receivable' : 'partner_cash_receivable';

        $this->journalService->post(
            sourceType: Order::class,
            sourceId: $order->id,
            entryType: 'cash_collected',
            lines: [
                ['account' => $receivable, 'direction' => 'debit', 'amount' => $amount, 'memo' => 'Cash collected for order #'.$order->order_number],
                ['account' => 'order_revenue_clearing', 'direction' => 'credit', 'amount' => $amount, 'memo' => 'Cash collected for order #'.$order->order_number],
            ],
            idempotencyKey: 'order:cash-collection:'.$order->order_number,
            description: 'Cash collected for order #'.$order->order_number,
            meta: ['method' => 'cash', 'role' => $role]
        );
    }

    private function paymentResultPayload(Order $order, DeliveryPartner $partner, Money $amount, ?bool $settled = null, ?float $available = null, ?float $shortfall = null): array
    {
        $wallet = $this->walletService->ensureWallet($partner->user, 'delivery_partner');

        $isSettled = $settled ?? (bool) $order->delivery_payment_settled_at;
        $balance = (float) $wallet->balance;
        $availableAmount = $available ?? $balance;
        $shortfallAmount = $shortfall ?? ($isSettled ? 0.0 : (float) max(0, $amount->major() - $availableAmount));

        return [
            'amount' => (float) $amount->major(),
            'collected_at' => $order->delivery_payment_collected_at?->toISOString(),
            'settlement' => $isSettled ? 'settled' : 'pending',
            'settled_at' => $order->delivery_payment_settled_at?->toISOString(),
            'required' => (float) $amount->major(),
            'available' => $availableAmount,
            'shortfall' => $shortfallAmount,
            'wallet_balance' => $balance,
        ];
    }

    /**
     * Cancel an order from any legal pre-terminal state and unwind every
     * side effect exactly once (partner busy flag, inventory reservation,
     * wallet refund, gateway refund request).
     */
    public function cancelOrder(Order $order, User $user, ?string $reason = null): Order
    {
        return DB::transaction(function () use ($order, $user, $reason) {
            $locked = Order::whereKey($order->id)->lockForUpdate()->first();

            if (! $locked) {
                throw new RuntimeException('Order not found');
            }

            if ($locked->status === 'CANCELLED') {
                return $locked->fresh();
            }

            $this->assertMutationAllowed($locked, 'CANCELLED');

            $oldStatus = (string) $locked->status;

            $cancelledByType = match (true) {
                $user->user_type === 'vendor' => 'vendor',
                $user->user_type === 'delivery_partner' => 'delivery_partner',
                in_array($user->user_type, ['admin', 'super_admin'], true) => 'admin',
                default => 'customer',
            };

            $locked->update([
                'status' => 'CANCELLED',
                'cancelled_at' => now(),
                'cancel_reason' => $reason,
                'cancelled_by_type' => $cancelledByType,
                'cancelled_by' => $user->id,
            ]);

            $this->recordHistory($locked, 'CANCELLED', $user->id, $cancelledByType, $reason ?? 'Order cancelled', $oldStatus);

            DispatchLog::where('order_id', $locked->id)
                ->whereIn('status', [DispatchLog::STATUS_PENDING, DispatchLog::STATUS_SENT])
                ->update(['status' => DispatchLog::STATUS_EXPIRED]);

            if ($locked->delivery_partner_id) {
                // Drop just this order from its grocery trip, then only free the
                // partner when nothing else is still assigned to them.
                $batchService = app(GroceryBatchService::class);
                $batch = $batchService->batchFor($locked->fresh());

                if ($batch) {
                    $batchService->removeOrder($batch, $locked->fresh());
                }

                $this->releasePartnerIfIdle(DeliveryPartner::whereKey($locked->delivery_partner_id)->lockForUpdate()->first());
            }

            $this->inventoryService->releaseReservation($locked, $user->id);

            $this->deliverySlotService->releaseForOrder($locked);

            $refunded = $this->unwindCustomerPayments($locked);

            $locked->update([
                'refund_amount' => $refunded['refund_amount'],
                'refund_status' => $refunded['refund_status'],
                'refunded_at' => $refunded['refund_status'] === 'completed' ? now() : null,
            ]);

            $this->webhookNotifier->orderCancelled($locked->fresh());
            $this->webhookNotifier->orderUpdated($locked->fresh());

            $this->broadcastOrder($locked->fresh());
            $this->broadcastCancellationForPartner($locked->fresh());

            return $locked->fresh();
        });
    }

    public function assertOwnership(Order $order, DeliveryPartner $partner): void
    {
        if ((int) $order->delivery_partner_id !== (int) $partner->id) {
            throw new RuntimeException('Order is not assigned to this partner');
        }
    }

    /**
     * Clear `is_busy` only once the partner has no live work left.
     *
     * With grocery batching a partner may hold several orders in one trip, so
     * finishing or cancelling a single order must never mark them free while
     * sibling orders are still active.
     */
    private function releasePartnerIfIdle(?DeliveryPartner $partner): void
    {
        if (! $partner) {
            return;
        }

        $activeStatuses = [
            'PARTNER_ASSIGNED',
            'PICKED_UP',
            'OUT_FOR_DELIVERY',
            'ARRIVED',
        ];

        $hasActiveWork = Order::where('delivery_partner_id', $partner->id)
            ->whereIn('status', $activeStatuses)
            ->exists();

        if ($hasActiveWork) {
            return;
        }

        $partner->forceFill(['is_busy' => false])->save();
    }

    private function broadcastOrder(Order $order): void
    {
        $this->queueTrackingBroadcast($order->id, [
            ['type' => 'order_updated'],
            ['type' => 'vendor_order_updated'],
        ]);
    }

    private function broadcastAssignment(Order $order, DeliveryPartner $partner): void
    {
        $this->queueTrackingBroadcast($order->id, [
            ['type' => 'assignment_confirmed', 'partner_id' => $partner->id],
        ]);
    }

    private function broadcastCancellationForPartner(Order $order): void
    {
        if (! $order->delivery_partner_id) {
            return;
        }

        $this->queueTrackingBroadcast($order->id, [
            ['type' => 'order_cancelled_for_partner', 'partner_id' => $order->delivery_partner_id],
        ]);
    }

    /**
     * Hand the realtime fan-out to the queue so a slow or unreachable
     * websocket server never adds latency to the status transition.
     *
     * @param  array<int, array{type: string, partner_id?: int|null}>  $intents
     */
    private function queueTrackingBroadcast(int $orderId, array $intents): void
    {
        DB::afterCommit(function () use ($orderId, $intents) {
            BroadcastOrderTracking::dispatch($orderId, $intents);
        });
    }

    private function advance(Order $order, DeliveryPartner $partner, string $status, string $timestampField, ?string $note = null): Order
    {
        $this->assertOwnership($order, $partner);

        return DB::transaction(function () use ($order, $partner, $status, $timestampField, $note) {
            $locked = Order::whereKey($order->id)->lockForUpdate()->first();

            if (! $locked) {
                throw new RuntimeException('Order not found');
            }

            if ($locked->status === $status) {
                $this->webhookNotifier->orderUpdated($locked->fresh());

                $this->broadcastOrder($locked->fresh());

                return $locked->fresh();
            }

            $this->assertMutationAllowed($locked, $status);

            $oldStatus = (string) $locked->status;

            $locked->update([
                'status' => $status,
                $timestampField => now(),
            ]);

            $this->recordHistory($locked, $status, $partner->user_id, 'delivery_partner', $note ?? 'Status updated to '.strtolower($status), $oldStatus);

            // Keep the grocery trip's stop list in step with this order only.
            // Sibling orders in the same batch are never touched.
            app(GroceryBatchService::class)->syncOrderStatus($locked->fresh());

            match ($status) {
                'PICKED_UP' => $this->webhookNotifier->orderPickedUp($locked->fresh()),
                'OUT_FOR_DELIVERY' => $this->webhookNotifier->orderOutForDelivery($locked->fresh()),
                'ARRIVED' => $this->webhookNotifier->orderArrived($locked->fresh()),
                default => null,
            };
            $this->webhookNotifier->orderUpdated($locked->fresh());

            $this->broadcastOrder($locked->fresh());

            return $locked->fresh();
        });
    }

    /**
     * @throws InvalidOrderTransitionException
     */
    private function assertMutationAllowed(Order $order, string $target): void
    {
        OrderStateMachine::assertCanTransition($order, $target);
    }

    private function recordHistory(Order $order, string $newStatus, int $changedBy, string $changedByType, ?string $note, ?string $oldStatus = null): void
    {
        $previous = strtoupper((string) ($oldStatus ?? $order->status));

        if ($previous === strtoupper($newStatus)) {
            return;
        }

        OrderStatusHistory::create([
            'order_id' => $order->id,
            'status' => $newStatus,
            'old_status' => $previous,
            'new_status' => strtoupper($newStatus),
            'changed_at' => now(),
            'notes' => $note,
            'changed_by' => $changedBy,
            'changed_by_type' => $changedByType,
        ]);
    }

    /**
     * Exactly-once delivery partner earning row (unique order+partner). The
     * partner's cached running totals (is_busy, total_deliveries,
     * total_earnings) are incremented exactly once — only when the earning
     * row itself is first created.
     *
     * We deliberately do NOT increment the cache when an existing earning
     * row is recovered, because that row already bumped the cache exactly
     * once on its original insertion.
     */
    private function recordPartnerEarning(Order $order, DeliveryPartner $partner, float $amount, array $breakdown = []): ?DeliveryPartnerEarning
    {
        $money = Money::fromMajor($amount);

        $existing = DeliveryPartnerEarning::where('order_id', $order->id)
            ->where('delivery_partner_id', $partner->id)
            ->lockForUpdate()
            ->first();

        if ($existing) {
            $this->creditPartnerEarningWallet($order, $partner, $money, $existing);

            return $existing;
        }

        if ($money->isNegative() || $money->isZero()) {
            DeliveryPartner::whereKey($partner->id)
                ->update(['total_deliveries' => DB::raw('total_deliveries + 1')]);

            $this->releasePartnerIfIdle(DeliveryPartner::whereKey($partner->id)->lockForUpdate()->first());

            return null;
        }

        try {
            $earning = DeliveryPartnerEarning::create([
                'delivery_partner_id' => $partner->id,
                'order_id' => $order->id,
                'earning_number' => 'EARN_'.date('YmdHis').'_'.strtoupper(Str::random(6)),
                'amount' => $money->major(),
                'currency' => 'INR',
                'type' => 'delivery',
                'status' => 'earned',
                'idempotency_key' => 'delivery:'.$order->order_number,
                'meta' => [
                    'order_number' => $order->order_number,
                    'delivered_via' => $order->delivered_via,
                    'earning_basis' => $breakdown['basis'] ?? 'customer_delivery_fee',
                    'earning_breakdown' => $breakdown,
                ],
            ]);
        } catch (QueryException $e) {
            if ((string) $e->getCode() === '23000' || str_contains($e->getMessage(), 'UNIQUE constraint failed')) {
                $existing = DeliveryPartnerEarning::where('order_id', $order->id)
                    ->where('delivery_partner_id', $partner->id)
                    ->first();

                $this->creditPartnerEarningWallet($order, $partner, $money, $existing);

                return $existing;
            }

            throw $e;
        }

        DeliveryPartner::whereKey($partner->id)
            ->update([
                'total_deliveries' => DB::raw('total_deliveries + 1'),
                'total_earnings' => DB::raw('total_earnings + '.((float) $earning->amount)),
            ]);

        $this->releasePartnerIfIdle(DeliveryPartner::whereKey($partner->id)->lockForUpdate()->first());

        $this->creditPartnerEarningWallet($order, $partner, $money, $earning);

        return $earning;
    }

    /**
     * Credit the partner's wallet exactly once for a finalized delivery
     * earning, keyed by the immutable earning id. Idempotent: replaying the
     * same earning (retry, duplicate delivery attempt, previously settled
     * order) returns the existing wallet transaction instead of double
     * crediting. The service is tagged so food/grocery/ride earnings are
     * distinguishable in the wallet ledger.
     */
    private function creditPartnerEarningWallet(Order $order, DeliveryPartner $partner, Money $money, DeliveryPartnerEarning $earning): void
    {
        if (! $partner->user_id) {
            return;
        }

        $this->walletService->creditEarning(
            user: $partner->user,
            walletType: 'delivery_partner',
            amount: $money,
            service: $order->order_type === 'grocery' ? 'grocery' : 'food',
            referenceType: DeliveryPartnerEarning::class,
            referenceId: $earning->id,
            description: "Delivery earning for order #{$order->order_number}",
            meta: [
                'order_number' => $order->order_number,
                'earning_id' => $earning->id,
            ],
        );
    }

    /**
     * Partner payout for a delivered order.
     *
     * Delegates to DeliveryFeeService::partnerEarning(), the single
     * authoritative formula shared with the dispatch offer, so the amount a
     * partner is shown before accepting always matches the amount credited on
     * completion.
     *
     * When the partner accepted a dispatch offer that snapshotted the earning,
     * that snapshot wins: an Admin changing the per-km rate mid-delivery must
     * not silently alter what an already-accepted partner earns.
     *
     * @return array{amount: float, breakdown: array}
     */
    private function resolvePartnerEarning(Order $order): array
    {
        $service = $this->serviceTypeResolver->resolve($order);
        $customerFee = round((float) ($order->delivery_fee ?? 0), 2);

        $accepted = $this->acceptedOfferEarningSnapshot($order);

        if ($accepted !== null) {
            $amount = round((float) $accepted['amount'], 2);

            $breakdown = [
                'service' => $service,
                'customer_delivery_fee' => $customerFee,
                'basis' => 'accepted_offer_snapshot',
                'per_km' => $accepted['breakdown']['per_km'] ?? null,
                'per_km_key' => $accepted['breakdown']['per_km_key'] ?? null,
                'free_distance_km' => $accepted['breakdown']['free_distance_km'] ?? null,
                'first_distance_earning' => $accepted['breakdown']['first_distance_earning'] ?? null,
                'first_distance_earning_key' => $accepted['breakdown']['first_distance_earning_key'] ?? null,
                'distance_km' => $accepted['breakdown']['distance_km'] ?? null,
                'additional_distance_km' => $accepted['breakdown']['additional_distance_km'] ?? null,
                'additional_admin_earning' => $accepted['breakdown']['additional_admin_earning'] ?? null,
                // Both platform-funded components together, for snapshots taken
                // before the free-distance guarantee existed this is simply the
                // distance component the offer already carried.
                'distance_earning' => round($amount - $customerFee, 2),
                'platform_funded' => round($amount - $customerFee, 2),
                'offered_at' => $accepted['offered_at'] ?? null,
                'accepted_at' => $accepted['accepted_at'] ?? null,
            ];

            return ['amount' => $amount, 'breakdown' => $breakdown];
        }

        return $this->deliveryFeeService->partnerEarningForOrder(
            $order,
            $service,
            $customerFee,
            $this->groceryDeliveryConfig->adminFundedAmountForOrder($order),
        );
    }

    /**
     * Copy the accepted dispatch offer's earning snapshot onto the order.
     *
     * The offer meta already carries `estimated_earning` and its breakdown, so
     * this reuses the existing snapshot fields rather than introducing new
     * storage. No-ops when no accepted offer exists, so admin-assigned partners
     * keep the live-settings behaviour.
     */
    public function snapshotAcceptedOfferEarning(Order $order): void
    {
        $offer = DispatchLog::where('order_id', $order->id)
            ->where('candidate_id', $order->delivery_partner_id)
            ->where('status', DispatchLog::STATUS_ACCEPTED)
            ->latest('id')
            ->first();

        if (! $offer) {
            return;
        }

        $meta = $offer->meta;
        $meta = is_array($meta) ? $meta : (is_string($meta) ? (json_decode($meta, true) ?: []) : []);

        if (! isset($meta['estimated_earning'])) {
            return;
        }

        $orderMeta = $order->meta;
        $orderMeta = is_array($orderMeta) ? $orderMeta : (is_string($orderMeta) ? (json_decode($orderMeta, true) ?: []) : []);

        $orderMeta['accepted_partner_earning'] = [
            'amount' => round((float) $meta['estimated_earning'], 2),
            'breakdown' => is_array($meta['earning_breakdown'] ?? null) ? $meta['earning_breakdown'] : [],
            'offered_at' => $meta['offered_at'] ?? null,
            'accepted_at' => now()->toISOString(),
            'dispatch_log_id' => $offer->id,
        ];

        $order->update(['meta' => $orderMeta]);
    }

    /**
     * The earning snapshot captured when a partner accepted a dispatch offer.
     *
     * @return array{amount: float, breakdown: array, offered_at: mixed, accepted_at: mixed}|null
     */
    private function acceptedOfferEarningSnapshot(Order $order): ?array
    {
        $meta = $order->meta;
        $meta = is_array($meta) ? $meta : (is_string($meta) ? (json_decode($meta, true) ?: []) : []);

        $snapshot = $meta['accepted_partner_earning'] ?? null;

        if (! is_array($snapshot) || ! isset($snapshot['amount'])) {
            return null;
        }

        $snapshot['breakdown'] = is_array($snapshot['breakdown'] ?? null) ? $snapshot['breakdown'] : [];

        return $snapshot;
    }

    private function unwindCustomerPayments(Order $order): array
    {
        $refundAmountPaise = 0;

        if (Money::fromMajor($order->wallet_used ?? 0)->paise() > 0) {
            $this->walletService->credit(
                $order->user,
                'customer',
                (float) $order->wallet_used,
                'REFUND',
                Order::class,
                $order->id,
                "Refund for cancelled order #{$order->order_number}",
                'order-cancel:wallet:'.$order->id,
                ['order_id' => $order->id]
            );
            $refundAmountPaise += Money::fromMajor($order->wallet_used)->paise();
        }

        $payments = Payment::where('payable_type', Order::class)
            ->where('payable_id', $order->id)
            ->whereIn('status', ['SUCCESS', 'PARTIALLY_REFUNDED'])
            ->get();

        foreach ($payments as $payment) {
            $refundable = $this->refundService->refundableAmount($payment);

            if ($refundable->paise() <= 0) {
                continue;
            }

            $this->refundService->request(
                $order->user,
                $payment,
                $refundable,
                'Order cancelled: '.($order->cancel_reason ?? 'auto refund'),
                'Automatic refund created on cancellation of order '.$order->order_number,
                'order-cancel:payment:'.$payment->id,
                RefundService::DESTINATION_ORIGINAL
            );

            $refundAmountPaise += $refundable->paise();
        }

        if ($refundAmountPaise > 0) {
            return ['refund_amount' => Money::fromPaise($refundAmountPaise)->major(), 'refund_status' => 'pending'];
        }

        return ['refund_amount' => null, 'refund_status' => null];
    }

    private function resolveDeliveredVia(Order $order): string
    {
        if (strtolower((string) $order->payment_method) === 'cash_on_delivery') {
            return 'PARTNER_ONLY';
        }

        $total = Money::fromMajor($order->total_amount ?? 0);
        $deliveryFee = Money::fromMajor($order->delivery_fee ?? 0);
        $paid = $this->paymentService->paidForPayable($order);
        $remaining = $total->sub($paid);

        if ($remaining->isNegative() || $remaining->isZero()) {
            return 'NONE';
        }

        if ($remaining->compareTo($deliveryFee) <= 0) {
            return 'DELIVERY_FEE_ONLY';
        }

        return 'PAYMENT_LINK';
    }

    private function haversineKm(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $earthRadius = 6371;
        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);
        $a = sin($dLat / 2) * sin($dLat / 2) + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) * sin($dLng / 2);
        $c = 2 * atan2(sqrt($a), sqrt(1 - $a));

        return round($earthRadius * $c, 2);
    }
}
