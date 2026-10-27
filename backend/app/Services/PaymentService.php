<?php

namespace App\Services;

use App\Infrastructure\Interfaces\PaymentGatewayInterface;
use App\Infrastructure\Providers\Payments\MockPaymentProvider;
use App\Models\Order;
use App\Models\Payment;
use App\Models\PaymentTransaction;
use App\Models\Ride;
use App\Models\User;
use App\Models\Wallet;
use App\Models\WalletTransaction;
use App\Models\WebhookEvent;
use App\Services\Integration\WebhookNotifier;
use App\Support\Money;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;

class PaymentService
{
    public const PAYMENT_METHODS = ['upi', 'card', 'net_banking', 'wallet'];

    public const TERMINAL_SUCCESS = ['SUCCESS', 'REFUNDED', 'PARTIALLY_REFUNDED'];

    private const CURRENCY = 'INR';

    public function __construct(
        private WalletService $walletService,
        private WebhookNotifier $webhookNotifier,
        private JournalService $journalService,
    ) {}

    /**
     * Create a payment intent for an Order/Ride payable. The amount is
     * always computed server-side and the client amount is ignored.
     */
    public function initiatePayable(User $user, Model $payable, string $method, ?string $idempotencyKey = null): Payment
    {
        $this->validateMethod($method);
        $this->assertGatewayUsable();

        if (property_exists($payable, 'user_id') && (int) $payable->user_id !== (int) $user->id) {
            throw new RuntimeException('Payable does not belong to this account');
        }

        if (! ($payable instanceof Order) && ! ($payable instanceof Ride)) {
            throw new RuntimeException('Unsupported payable type');
        }

        if ($payable instanceof Order) {
            // The order was priced authoritatively when it was placed and froze
            // the delivery decision in meta.delivery_pricing. Payment must never
            // charge a delivery amount that no longer matches that snapshot.
            $this->assertOrderDeliveryPricingMatches($payable);
        }

        $totalPaise = Money::fromMajor($payable->total_amount ?? ($payable->final_fare ?? $payable->estimated_fare ?? null))->paise();

        if ($totalPaise <= 0) {
            throw new RuntimeException('Payable amount must be greater than zero');
        }

        $paidPaise = $this->paidAmountForPayable($payable)->paise();
        $remainingPaise = $totalPaise - $paidPaise;

        if ($remainingPaise <= 0) {
            throw new RuntimeException('Payable is already fully paid');
        }

        if ($idempotencyKey) {
            $existing = Payment::where('idempotency_key', $idempotencyKey)
                ->where('user_id', $user->id)
                ->first();

            if ($existing) {
                if ($existing->payable_type === get_class($payable)
                    && (int) $existing->payable_id === (int) $payable->getKey()
                    && (int) $existing->amount_paise === $remainingPaise) {
                    return $existing;
                }

                throw new RuntimeException('Idempotency key already used with a different payload');
            }
        }

        if ($payable instanceof Order && $payable->delivery_payment_collected_at) {
            throw new RuntimeException('This order was already paid in cash to the delivery partner');
        }

        return $this->createProviderOrder(
            $user,
            get_class($payable),
            (int) $payable->getKey(),
            $remainingPaise,
            $method,
            $idempotencyKey,
            'Payment for '.Str::snake(class_basename($payable)).' #'.$payable->getKey()
        );
    }

    /**
     * Create a wallet top-up intent. No wallet credit ever happens here —
     * funds are credited only after server-side verification.
     */
    public function initiateWalletTopup(User $user, Money $amount, string $method, ?string $idempotencyKey = null): Payment
    {
        $this->validateMethod($method);
        $this->assertGatewayUsable();

        $min = Money::fromMajor(config('integrations.wallet.topup.min_amount', 10));
        $max = Money::fromMajor(config('integrations.wallet.topup.max_amount', 50000));

        if ($amount->compareTo($min) < 0 || $amount->compareTo($max) > 0) {
            throw new RuntimeException('Top-up amount is outside the allowed range');
        }

        if ($idempotencyKey) {
            $existing = Payment::where('idempotency_key', $idempotencyKey)
                ->where('user_id', $user->id)
                ->first();

            if ($existing) {
                if ($existing->payable_type === Wallet::class && (int) $existing->amount_paise === $amount->paise()) {
                    return $existing;
                }

                throw new RuntimeException('Idempotency key already used with a different payload');
            }
        }

        return $this->createProviderOrder(
            $user,
            Wallet::class,
            (int) $user->id,
            $amount->paise(),
            $method,
            $idempotencyKey,
            'Wallet top-up via '.$method
        );
    }

    /**
     * Verify a payment server-side and apply its outcome exactly once.
     */
    public function verifyPayment(User $user, string $paymentNumber, ?string $providerOrderId, ?string $providerPaymentId, ?string $signature, ?string $ip = null, ?string $agent = null): array
    {
        $payment = Payment::where('payment_number', $paymentNumber)
            ->where('user_id', $user->id)
            ->first();

        if (! $payment) {
            throw new RuntimeException('Payment not found');
        }

        if ($payment->amount_paise === null) {
            $payment->update(['amount_paise' => Money::fromMajor($payment->amount)->paise()]);
        }

        if (in_array($payment->status, self::TERMINAL_SUCCESS, true)) {
            return ['payment' => $payment->fresh(), 'status' => $payment->status, 'already_processed' => true];
        }

        $this->assertGatewayUsable();

        if (! $providerPaymentId) {
            throw new RuntimeException('Provider payment id is required');
        }

        $gateway = $this->gateway();

        if (! $this->isMock($gateway) && ! $gateway->verifyPaymentSignature(
            ['provider_order_id' => $providerOrderId, 'provider_payment_id' => $providerPaymentId],
            (string) $signature
        )) {
            throw new RuntimeException('Invalid payment signature');
        }

        $status = $gateway->verifyPayment($providerPaymentId);

        return $this->applyProviderStatus($payment, $status, $ip, $agent);
    }

    /**
     * Apply a provider-reported status (from direct verification or webhook)
     * to a payment, reconciling amount + currency and guarding every
     * state transition.
     */
    public function applyProviderStatus(Payment $payment, array $status, ?string $ip = null, ?string $agent = null): array
    {
        $providerStatus = $status['status'] ?? 'unknown';

        if ($providerStatus === 'captured' || $providerStatus === 'authorized') {
            $amountPaise = $status['amount'] ?? null;

            if (! is_int($amountPaise) || $amountPaise <= 0) {
                throw new RuntimeException('Provider did not report a valid amount');
            }

            if ($providerStatus === 'captured') {
                return [
                    'payment' => $this->capturePayment($payment, $amountPaise, $status, $ip, $agent),
                    'status' => 'SUCCESS',
                    'already_processed' => false,
                ];
            }
        }

        if ($providerStatus === 'failed' || $providerStatus === 'cancelled') {
            if (! in_array($payment->status, self::TERMINAL_SUCCESS, true)) {
                $this->markFailed($payment, 'Provider reported the payment as '.$providerStatus, $ip, $agent);
            }

            return ['payment' => $payment->fresh(), 'status' => 'FAILED', 'already_processed' => false];
        }

        if ($providerStatus === 'pending' || $providerStatus === 'attempted') {
            return ['payment' => $payment->fresh(), 'status' => $payment->status, 'already_processed' => true, 'pending' => true];
        }

        throw new RuntimeException('Provider returned an unrecognized payment status: '.$providerStatus);
    }

    /**
     * Transition a payment to SUCCESS exactly once (row-locked), with a
     * single, idempotent side effect. Cancelled/FAILED payments may retry;
     * SUCCESS is terminal.
     */
    public function capturePayment(Payment $payment, int $amountPaise, array $status, ?string $ip = null, ?string $agent = null): Payment
    {
        $providerPaymentId = $status['payment_id'] ?? null;
        $providerOrderId = $status['order_id'] ?? null;
        $providerCurrency = $status['currency'] ?? null;

        if ($providerCurrency !== null && strtoupper($providerCurrency) !== self::CURRENCY) {
            throw new RuntimeException('Provider currency mismatch');
        }

        return DB::transaction(function () use ($payment, $amountPaise, $providerPaymentId, $providerOrderId, $status, $ip, $agent) {
            $locked = Payment::whereKey($payment->id)
                ->whereIn('status', ['INITIATED', 'PENDING', 'FAILED'])
                ->lockForUpdate()
                ->first();

            if (! $locked) {
                $fresh = $payment->fresh();

                if ($fresh && in_array($fresh->status, self::TERMINAL_SUCCESS, true)) {
                    return $fresh;
                }

                throw new RuntimeException('Payment state does not allow capture');
            }

            $expected = (int) $locked->amount_paise;

            if ($amountPaise !== $expected) {
                throw new RuntimeException('Amount mismatch: expected '.$expected.' paise, provider reported '.$amountPaise);
            }

            $locked->update([
                'status' => 'SUCCESS',
                'provider_payment_id' => $providerPaymentId,
                'provider_order_id' => $providerOrderId,
                'provider_reference' => $providerPaymentId,
                'gateway_response' => $status['raw'] ?? $status,
                'paid_at' => now(),
                'verified_at' => now(),
            ]);

            $this->recordTransition($locked, 'SUCCESS', $status, $ip, $agent);

            $this->applySideEffect($locked);

            $this->postCaptureJournal($locked);

            $this->webhookNotifier?->paymentCaptured($locked->fresh());

            return $locked->fresh();
        });
    }

    public function markFailed(Payment $payment, string $reason, ?string $ip = null, ?string $agent = null): Payment
    {
        if (in_array($payment->status, self::TERMINAL_SUCCESS, true)) {
            throw new RuntimeException('Cannot fail an already successful payment');
        }

        return DB::transaction(function () use ($payment, $reason, $ip, $agent) {
            $locked = Payment::whereKey($payment->id)
                ->whereIn('status', ['INITIATED', 'PENDING'])
                ->lockForUpdate()
                ->first();

            if (! $locked) {
                return $payment->fresh() ?? $payment;
            }

            $locked->update([
                'status' => 'FAILED',
                'failure_reason' => $reason,
                'failed_at' => now(),
            ]);

            $this->recordTransition($locked, 'FAILED', ['reason' => $reason], $ip, $agent);
            $this->webhookNotifier?->paymentFailed($locked->fresh());

            return $locked->fresh();
        });
    }

    /**
     * Process an inbound provider webhook event idempotently.
     */
    public function processWebhookEvent(PaymentGatewayInterface $gateway, string $provider, array $payload, ?string $ip = null, ?string $agent = null): WebhookEvent
    {
        $this->assertGatewayUsable();

        $eventType = (string) ($payload['event'] ?? '');
        $entity = $payload['payload'] ?? [];
        $paymentEntity = $entity['payment']['entity'] ?? ($entity['payment'] ?? []);
        $orderId = ($entity['order']['entity']['id'] ?? $paymentEntity['order_id'] ?? null)
            ?? (is_array($entity['order'] ?? null) ? ($entity['order']['id'] ?? null) : null);

        if (! is_array($paymentEntity)) {
            $paymentEntity = is_array($entity['payment'] ?? null) ? $entity['payment'] : [];
        }

        $providerPaymentId = $paymentEntity['id'] ?? null;
        $eventId = md5(json_encode([
            'provider' => $provider,
            'event' => $eventType,
            'payment' => $providerPaymentId,
            'created_at' => $payload['created_at'] ?? null,
            'raw' => $payload,
        ]));

        $webhookEvent = DB::transaction(function () use ($provider, $eventId, $eventType, $payload) {
            try {
                return WebhookEvent::create([
                    'provider' => $provider,
                    'event_id' => $eventId,
                    'event_type' => $eventType,
                    'payload' => $payload,
                    'status' => 'processing',
                ]);
            } catch (QueryException $e) {
                if ((string) $e->getCode() !== '23000' && ! str_contains($e->getMessage(), 'UNIQUE constraint failed')) {
                    throw $e;
                }

                $existing = WebhookEvent::where('provider', $provider)
                    ->where('event_id', $eventId)
                    ->first();

                if ($existing) {
                    if (in_array($existing->status, ['processed', 'ignored'], true)) {
                        $existing->touch();

                        return $existing;
                    }
                    throw new RuntimeException('Webhook event is still being processed');
                }

                throw $e;
            }
        });

        $execute = $this->resolveWebhookExecution($webhookEvent, $eventType);

        if ($execute === null) {
            $webhookEvent->update([
                'status' => 'ignored',
                'processed_at' => now(),
            ]);

            return $webhookEvent->fresh();
        }

        try {
            [$amountPaise, $currency, $localStatus] = $execute;
            $payment = $this->findPaymentForWebhook($webhookEvent, $providerPaymentId, $orderId);

            if (! $payment) {
                $webhookEvent->update([
                    'status' => 'ignored',
                    'processed_at' => now(),
                    'error' => 'No matching local payment found',
                ]);

                return $webhookEvent->fresh();
            }

            $remoteStatus = $localStatus;
            $internalStatus = $remoteStatus === 'captured' ? 'captured' : 'failed';

            if ($internalStatus === 'captured' && (int) $amountPaise !== (int) $payment->amount_paise) {
                throw new RuntimeException('Amount mismatch on webhook');
            }

            $status = $this->applyProviderStatus(
                $payment,
                [
                    'status' => $internalStatus,
                    'amount' => $internalStatus === 'captured' ? (int) $amountPaise : null,
                    'payment_id' => $providerPaymentId,
                    'order_id' => $orderId,
                    'currency' => $currency,
                    'raw' => $payload,
                ],
                $ip,
                $agent
            );

            $webhookEvent->update([
                'status' => 'processed',
                'processed_at' => now(),
            ]);

            return $webhookEvent->fresh();
        } catch (\Throwable $e) {
            $webhookEvent->update([
                'status' => 'failed',
                'error' => $e->getMessage(),
            ]);

            throw $e;
        }
    }

    public function findPaymentForWebhook(WebhookEvent $webhookEvent, ?string $providerPaymentId, ?string $orderId): ?Payment
    {
        $query = Payment::query();

        $query->where(function ($q) use ($providerPaymentId, $orderId) {
            if ($providerPaymentId) {
                $q->where('provider_payment_id', $providerPaymentId)
                    ->orWhere('provider_reference', $providerPaymentId);
            }

            if ($orderId) {
                $method = $providerPaymentId ? 'orWhere' : 'where';
                $q->{$method}('provider_order_id', $orderId);
            }
        });

        return $query->latest('id')->first();
    }

    public function paidForPayable(Model $payable): Money
    {
        return $this->paidAmountForPayable($payable);
    }

    /**
     * Total amount actually paid for a payable (successful online payments +
     * completed wallet debits referencing it).
     */
    public function paidAmountForPayable(Model $payable): Money
    {
        $type = get_class($payable);
        $id = (int) $payable->getKey();
        $paid = 0;

        $payments = Payment::where('payable_type', $type)
            ->where('payable_id', $id)
            ->whereIn('status', ['SUCCESS', 'PARTIALLY_REFUNDED', 'REFUNDED'])
            ->get();

        foreach ($payments as $payment) {
            $paid += (int) ($payment->amount_paise ?? Money::fromMajor($payment->amount)->paise());
        }

        $debits = WalletTransaction::where('reference_type', $type)
            ->where('reference_id', $id)
            ->where('direction', 'debit')
            ->where('status', 'completed')
            ->whereIn('type', ['PURCHASE', 'WITHDRAWAL', 'CASH_COLLECTION', 'DEBIT'])
            ->get();

        foreach ($debits as $debit) {
            $paid += Money::fromMajor($debit->amount)->paise();
        }

        return Money::fromPaise($paid);
    }

    public function gateway(): PaymentGatewayInterface
    {
        return app(PaymentGatewayInterface::class);
    }

    private function createProviderOrder(User $user, string $payableType, int $payableId, int $amountPaise, string $method, ?string $idempotencyKey, string $description): Payment
    {
        $payment = Payment::create([
            'payment_number' => 'PAY_'.date('YmdHis').'_'.strtoupper(Str::random(6)),
            'user_id' => $user->id,
            'payable_type' => $payableType,
            'payable_id' => $payableId,
            'amount' => Money::fromPaise($amountPaise)->major(),
            'amount_paise' => $amountPaise,
            'currency' => self::CURRENCY,
            'method' => $method,
            'gateway' => $this->gatewayName(),
            'status' => 'INITIATED',
            'idempotency_key' => $idempotencyKey ?: 'PAY_IDEM_'.Str::uuid()->toString(),
        ]);

        $gateway = $this->gateway();
        $providerOrder = $gateway->createOrder([
            'amount_paise' => $amountPaise,
            'currency' => self::CURRENCY,
            'receipt' => $payment->payment_number,
            'notes' => [
                'payment_number' => $payment->payment_number,
                'user_id' => $user->id,
                'payable_type' => $payableType,
                'payable_id' => $payableId,
            ],
        ]);

        $orderId = $providerOrder['id'] ?? null;

        if ($orderId) {
            $payment->update([
                'provider_order_id' => $orderId,
                'provider_reference' => $orderId,
                'gateway_response' => $providerOrder,
            ]);
        }

        $this->recordTransition($payment->fresh(), 'INITIATED', $providerOrder, null, null);

        return $payment->fresh();
    }

    /**
     * Book a captured payment: money arrives in the gateway clearing account
     * and the matching revenue is recognised in the service's clearing
     * account. Wallet top-ups are skipped because their own wallet credit
     * already posts Dr payment_clearing / Cr wallet.
     */
    private function postCaptureJournal(Payment $payment): void
    {
        if ($payment->payable_type === Wallet::class) {
            return;
        }

        $revenueAccount = $payment->payable_type === Ride::class
            ? 'ride_revenue_clearing'
            : 'order_revenue_clearing';

        $this->journalService->post(
            sourceType: Payment::class,
            sourceId: $payment->id,
            entryType: 'payment_captured',
            lines: [
                ['account' => 'payment_clearing', 'direction' => 'debit', 'amount' => $payment->amount, 'memo' => 'Payment '.$payment->payment_number],
                ['account' => $revenueAccount, 'direction' => 'credit', 'amount' => $payment->amount],
            ],
            idempotencyKey: 'payment:capture:'.$payment->payment_number,
            description: 'Payment captured for '.($payment->payable_type ? class_basename($payment->payable_type) : 'payable'),
            meta: [
                'method' => $payment->method,
                'gateway' => $payment->gateway,
                'payable' => $payment->payable_type ? class_basename($payment->payable_type) : null,
            ]
        );
    }

    private function applySideEffect(Payment $payment): void
    {
        $user = $payment->user;

        if ($payment->payable_type === Wallet::class) {
            // The credited wallet follows the payer's role so the same
            // server-side top-up intent works for customers, drivers and
            // delivery partners without a second wallet system.
            $walletType = match ($user->user_type) {
                'delivery_partner' => 'delivery_partner',
                'driver' => 'driver',
                default => 'customer',
            };

            $this->walletService->credit(
                $user,
                $walletType,
                $payment->amount,
                'TOP_UP',
                Wallet::class,
                (int) $payment->payable_id,
                'Wallet top-up for payment '.$payment->payment_number,
                'topup:'.$payment->payment_number,
                ['payment_id' => $payment->id]
            );

            return;
        }

        if ($payment->payable_type === Order::class) {
            $order = Order::find((int) $payment->payable_id);
            if ($order && (int) $order->user_id === (int) $payment->user_id) {
                $this->syncPayableCoverage($order);

                $fresh = $order->fresh();
                if ($fresh && $fresh->payment_status === 'paid' && ! $fresh->delivery_payment_collected_at
                    && strtolower((string) $fresh->payment_method) === 'cash_on_delivery') {
                    // A cash-on-delivery order paid online becomes an online
                    // order so customer and partner UIs show the authoritative
                    // online-paid state (no cash collection expected).
                    $fresh->update(['payment_method' => 'online']);
                }

                if ($fresh && $fresh->payment_status === 'paid') {
                    $this->webhookNotifier?->orderUpdated($fresh);
                }
            }

            return;
        }

        if ($payment->payable_type === Ride::class) {
            $ride = Ride::find((int) $payment->payable_id);
            if ($ride && (int) $ride->user_id === (int) $payment->user_id) {
                $this->syncPayableCoverage($ride);
            }
        }
    }

    /**
     * Ensure the delivery amounts being paid are exactly the ones the order was
     * priced with. The order row is authoritative (it was resolved from the
     * destination zone at placement), and the immutable snapshot lets this check
     * catch a partial update or manual tampering without re-pricing against a
     * zone configuration that may have changed since.
     *
     * Legacy orders created before pricing snapshots existed are skipped.
     */
    private function assertOrderDeliveryPricingMatches(Order $order): void
    {
        $snapshot = $order->meta['delivery_pricing'] ?? null;

        if (! is_array($snapshot) || ! array_key_exists('customer_delivery_fee', $snapshot)) {
            return;
        }

        $expected = [
            'delivery_fee' => (float) $snapshot['customer_delivery_fee'],
            'delivery_gst_percent' => (float) ($snapshot['delivery_gst_percent'] ?? 0),
            'delivery_gst_amount' => (float) ($snapshot['delivery_gst_amount'] ?? 0),
            'packaging_fee' => (float) ($snapshot['packaging_charge'] ?? 0),
            'handling_fee' => (float) ($snapshot['handling_fee'] ?? 0),
        ];

        foreach ($expected as $field => $value) {
            if (abs((float) $order->{$field} - $value) > 0.009) {
                throw new RuntimeException('Order delivery pricing is inconsistent. Please place the order again.');
            }
        }
    }

    private function syncPayableCoverage(Model $payable): void
    {
        $totalPaise = Money::fromMajor($payable->total_amount ?? ($payable->final_fare ?? $payable->estimated_fare ?? null))->paise();
        $paidPaise = $this->paidAmountForPayable($payable)->paise();

        if ($totalPaise > 0 && $paidPaise >= $totalPaise) {
            $payable->update(['payment_status' => 'paid']);

            return;
        }

        if ($paidPaise > 0) {
            $payable->update(['payment_status' => 'partial_paid']);
        }
    }

    private function recordTransition(Payment $payment, string $status, array $payload, ?string $ip, ?string $agent): void
    {
        PaymentTransaction::create([
            'payment_id' => $payment->id,
            'status' => $status,
            'event_name' => 'payment_'.strtolower($status),
            'payload' => $payload,
            'ip_address' => $ip,
            'user_agent' => $agent,
        ]);
    }

    private function validateMethod(string $method): void
    {
        if (! in_array($method, self::PAYMENT_METHODS, true)) {
            throw new RuntimeException('Invalid payment method');
        }
    }

    private function assertGatewayUsable(): void
    {
        if ($this->isMock($this->gateway()) && ! in_array(app()->environment(), ['local', 'testing'], true)) {
            throw new RuntimeException('Mock payment gateway is only allowed in local/testing environments');
        }
    }

    private function isMock(PaymentGatewayInterface $gateway): bool
    {
        return $gateway instanceof MockPaymentProvider;
    }

    private function gatewayName(): string
    {
        return $this->isMock($this->gateway()) ? 'mock' : 'razorpay';
    }

    private function resolveWebhookExecution(WebhookEvent $webhookEvent, string $eventType): ?array
    {
        $payload = $webhookEvent->payload ?? [];
        $entity = $payload['payload'] ?? [];
        $paymentEntity = $entity['payment']['entity'] ?? ($entity['payment'] ?? []);

        if (! is_array($paymentEntity)) {
            $paymentEntity = is_array($entity['payment'] ?? null) ? $entity['payment'] : [];
        }

        $amount = (int) ($paymentEntity['amount'] ?? $paymentEntity['amount_paise'] ?? 0);
        $currency = (string) ($paymentEntity['currency'] ?? 'INR');

        return match ($eventType) {
            'payment.captured', 'order.paid' => [$amount, $currency, 'captured'],
            'payment.failed', 'payment.pending', 'payment.cancelled' => [$amount, $currency, 'failed'],
            default => null,
        };
    }
}
