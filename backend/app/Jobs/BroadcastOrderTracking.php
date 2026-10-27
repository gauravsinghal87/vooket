<?php

namespace App\Jobs;

use App\Models\DeliveryPartner;
use App\Models\Order;
use App\Services\Integration\OrderTrackingBroadcaster;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;

/**
 * Delivers the realtime tracking fan-out for one order off the request
 * critical path.
 *
 * Order status transitions used to broadcast synchronously over HTTP to the
 * Reverb server, so a slow or unreachable websocket server added seconds to
 * every vendor/partner/admin status click. The transition now commits and
 * queues this job; a worker performs the (idempotent) broadcasts.
 *
 * Delivery is best-effort by design: realtime is a convenience channel, never
 * a system of record. A broadcast failure is logged and swallowed so an
 * unavailable websocket server can never fail an order or block a worker.
 */
class BroadcastOrderTracking implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    /** @var array<int, int> */
    public array $backoff = [5, 15, 30];

    public int $timeout = 15;

    /**
     * @param  array<int, array{type: string, partner_id?: int|null}>  $intents
     */
    public function __construct(
        public int $orderId,
        public array $intents,
    ) {}

    /**
     * @param  array<int, array{type: string, partner_id?: int|null}>  $intents
     */
    public static function forOrder(int $orderId, array $intents): self
    {
        return new self($orderId, $intents);
    }

    public function handle(OrderTrackingBroadcaster $broadcaster): void
    {
        $order = Order::with(['items', 'deliveryPartner.user'])->find($this->orderId);

        if (! $order) {
            return;
        }

        foreach ($this->intents as $intent) {
            $type = (string) ($intent['type'] ?? '');

            try {
                match ($type) {
                    'order_updated' => $this->broadcastOrderUpdated($broadcaster, $order),
                    'vendor_order_updated' => $broadcaster->vendorOrderUpdated($order),
                    'assignment_confirmed' => $this->broadcastAssignment($broadcaster, $order, $intent['partner_id'] ?? null),
                    'order_cancelled_for_partner' => $this->broadcastCancellation($broadcaster, $order, $intent['partner_id'] ?? null),
                    default => null,
                };
            } catch (\Throwable $e) {
                Log::warning('Tracking broadcast failed', [
                    'order_id' => $order->id,
                    'intent' => $type,
                    'error' => $e->getMessage(),
                ]);
            }
        }
    }

    private function broadcastOrderUpdated(OrderTrackingBroadcaster $broadcaster, Order $order): void
    {
        $broadcaster->orderUpdated($order);
    }

    private function broadcastAssignment(OrderTrackingBroadcaster $broadcaster, Order $order, ?int $partnerId): void
    {
        $partner = $this->resolvePartner($order, $partnerId);

        if ($partner) {
            $broadcaster->assignmentConfirmed($order, $partner);
        }
    }

    private function broadcastCancellation(OrderTrackingBroadcaster $broadcaster, Order $order, ?int $partnerId): void
    {
        $partner = $this->resolvePartner($order, $partnerId);

        if ($partner) {
            $broadcaster->orderCancelledForPartner($order, $partner);
        }
    }

    private function resolvePartner(Order $order, ?int $partnerId): ?DeliveryPartner
    {
        $id = $partnerId ?? $order->delivery_partner_id;

        return $id ? DeliveryPartner::find($id) : null;
    }
}
