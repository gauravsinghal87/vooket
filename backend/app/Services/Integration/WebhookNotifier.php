<?php

namespace App\Services\Integration;

use App\Infrastructure\Interfaces\WebhookProviderInterface;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Ride;
use App\Models\WalletTransaction;

/**
 * Convenience facade for dispatching domain events to webhook subscribers.
 * Never throws — integration failures are reported and swallowed so the
 * core domain flow is never blocked by a webhook delivery issue.
 */
class WebhookNotifier
{
    public function __construct(
        protected WebhookProviderInterface $webhook,
        protected IntegrationConfigResolver $resolver,
    ) {}

    public function notify(string $event, array $payload, array $filters = []): void
    {
        try {
            if (! $this->resolver->enabled('webhook')) {
                return;
            }
            $this->webhook->dispatchAll($event, $payload, $filters);
        } catch (\Throwable $e) {
            report($e);
        }
    }

    /**
     * Build the payload and owner filters lazily so a disabled or
     * unsubscribed webhook integration costs no extra queries — the
     * callbacks only run when a webhook is actually enabled.
     *
     * @param  callable(): array<string, mixed>  $payload
     * @param  callable(): array<int, int>  $owners
     */
    protected function notifyLazy(string $event, callable $payload, callable $owners): void
    {
        if (! $this->webhooksEnabled()) {
            return;
        }

        $this->notify($event, $payload(), ['owners' => $owners()]);
    }

    protected function webhooksEnabled(): bool
    {
        try {
            return $this->resolver->enabled('webhook');
        } catch (\Throwable $e) {
            report($e);

            return false;
        }
    }

    public function orderCreated(Order $order): void
    {
        $this->notifyLazy('order.created', fn () => $this->orderPayload($order), fn () => $this->orderOwners($order));
    }

    public function orderUpdated(Order $order): void
    {
        $this->notifyLazy('order.updated', fn () => $this->orderPayload($order), fn () => $this->orderOwners($order));
    }

    public function paymentCaptured(Payment $payment): void
    {
        $this->notifyLazy('payment.captured', fn () => $this->paymentPayload($payment), fn () => $this->paymentOwners($payment));
    }

    public function paymentFailed(Payment $payment): void
    {
        $this->notifyLazy('payment.failed', fn () => $this->paymentPayload($payment), fn () => $this->paymentOwners($payment));
    }

    public function deliveryAssigned(Order $order): void
    {
        $this->notifyLazy(
            'delivery.assigned',
            fn () => $this->orderPayload($order) + [
                'delivery_partner_id' => $order->delivery_partner_id,
                'partner_assigned_at' => $order->partner_assigned_at?->toISOString(),
            ],
            fn () => $this->orderOwners($order)
        );
    }

    public function walletCredited(WalletTransaction $transaction): void
    {
        $this->notifyLazy('wallet.credited', fn () => $this->walletPayload($transaction), fn () => [$transaction->user_id]);
    }

    public function walletDebited(WalletTransaction $transaction): void
    {
        $this->notifyLazy('wallet.debited', fn () => $this->walletPayload($transaction), fn () => [$transaction->user_id]);
    }

    public function rideRequested(Ride $ride): void
    {
        $this->notifyLazy('ride.requested', fn () => $this->ridePayload($ride), fn () => $this->rideOwners($ride));
    }

    public function rideCompleted(Ride $ride): void
    {
        $this->notifyLazy(
            'ride.completed',
            fn () => $this->ridePayload($ride) + ['trip_completed_at' => $ride->trip_completed_at?->toISOString()],
            fn () => $this->rideOwners($ride)
        );
    }

    public function orderCancelled(Order $order): void
    {
        $this->notifyLazy(
            'order.cancelled',
            fn () => $this->orderPayload($order) + [
                'cancelled_at' => $order->cancelled_at?->toISOString(),
                'cancel_reason' => $order->cancel_reason,
            ],
            fn () => $this->orderOwners($order)
        );
    }

    public function orderPickedUp(Order $order): void
    {
        $this->notifyLazy(
            'order.picked_up',
            fn () => $this->orderPayload($order) + ['picked_up_at' => $order->picked_up_at?->toISOString()],
            fn () => $this->orderOwners($order)
        );
    }

    public function orderOutForDelivery(Order $order): void
    {
        $this->notifyLazy(
            'order.out_for_delivery',
            fn () => $this->orderPayload($order) + ['out_for_delivery_at' => $order->out_for_delivery_at?->toISOString()],
            fn () => $this->orderOwners($order)
        );
    }

    public function orderArrived(Order $order): void
    {
        $this->notifyLazy(
            'order.arrived',
            fn () => $this->orderPayload($order) + ['arrived_at' => $order->arrived_at?->toISOString()],
            fn () => $this->orderOwners($order)
        );
    }

    public function orderDelivered(Order $order): void
    {
        $this->notifyLazy(
            'order.delivered',
            fn () => $this->orderPayload($order) + ['delivered_at' => $order->delivered_at?->toISOString()],
            fn () => $this->orderOwners($order)
        );
    }

    protected function orderOwners(Order $order): array
    {
        return array_values(array_unique(array_filter([
            $order->user_id,
            $order->vendor?->user_id,
        ])));
    }

    protected function rideOwners(Ride $ride): array
    {
        return array_values(array_unique(array_filter([
            $ride->user_id,
            $ride->driver?->user_id,
        ])));
    }

    protected function paymentOwners(Payment $payment): array
    {
        $owners = [$payment->user_id];

        if ($payment->payable_type === Order::class) {
            $order = Order::query()->find($payment->payable_id);
            if ($order) {
                array_push($owners, $order->user_id, $order->vendor?->user_id);
            }
        }

        return array_values(array_unique(array_filter($owners)));
    }

    protected function ridePayload(Ride $ride): array
    {
        return [
            'id' => $ride->id,
            'ride_number' => $ride->ride_number,
            'user_id' => $ride->user_id,
            'driver_id' => $ride->driver_id,
            'vehicle_type_id' => $ride->vehicle_type_id,
            'status' => $ride->status,
            'pickup_latitude' => $ride->pickup_latitude,
            'pickup_longitude' => $ride->pickup_longitude,
            'destination_latitude' => $ride->destination_latitude,
            'destination_longitude' => $ride->destination_longitude,
            'distance_km' => $ride->distance_km,
            'estimated_fare' => (float) $ride->estimated_fare,
            'final_fare' => isset($ride->final_fare) ? (float) $ride->final_fare : null,
            'payment_method' => $ride->payment_method,
            'payment_status' => $ride->payment_status,
            'created_at' => $ride->created_at?->toISOString(),
        ];
    }

    protected function walletPayload(WalletTransaction $transaction): array
    {
        return [
            'id' => $transaction->id,
            'transaction_id' => $transaction->transaction_id,
            'user_id' => $transaction->user_id,
            'wallet_id' => $transaction->wallet_id,
            'type' => $transaction->type,
            'direction' => $transaction->direction,
            'amount' => (float) $transaction->amount,
            'balance_before' => (float) $transaction->balance_before,
            'balance_after' => (float) $transaction->balance_after,
            'currency' => $transaction->currency,
            'status' => $transaction->status,
            'reference_type' => $transaction->reference_type,
            'reference_id' => $transaction->reference_id,
            'description' => $transaction->description,
            'occurred_at' => $transaction->created_at?->toISOString(),
        ];
    }

    protected function paymentPayload(Payment $payment): array
    {
        return [
            'id' => $payment->id,
            'payment_number' => $payment->payment_number,
            'amount' => (float) $payment->amount,
            'currency' => $payment->currency,
            'method' => $payment->method,
            'gateway' => $payment->gateway,
            'status' => $payment->status,
            'provider_reference' => $payment->provider_reference,
            'payable_type' => $payment->payable_type,
            'payable_id' => $payment->payable_id,
            'paid_at' => $payment->paid_at?->toISOString(),
        ];
    }

    protected function orderPayload(Order $order): array
    {
        return [
            'id' => $order->id,
            'order_number' => $order->order_number,
            'order_type' => $order->order_type,
            'status' => $order->status,
            'payment_status' => $order->payment_status,
            'payment_method' => $order->payment_method,
            'total_amount' => (float) $order->total_amount,
            'currency' => 'INR',
            'user_id' => $order->user_id,
            'vendor_id' => $order->vendor_id,
            'created_at' => $order->created_at?->toISOString(),
        ];
    }
}
