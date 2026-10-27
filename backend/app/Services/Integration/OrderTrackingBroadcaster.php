<?php

namespace App\Services\Integration;

use App\Infrastructure\Interfaces\RealtimeProviderInterface;
use App\Models\DeliveryPartner;
use App\Models\Order;
use App\Services\Tracking\OrderTrackingService;

/**
 * Fan-out of tracking payloads over the private order channel. Never blocks
 * the core flow: realtime failures are reported and swallowed so order/status
 * mutations always succeed even when broadcasting is unavailable.
 */
class OrderTrackingBroadcaster
{
    public function __construct(
        private OrderTrackingService $tracking,
        private RealtimeProviderInterface $realtime,
    ) {}

    /**
     * Broadcast the full authoritative snapshot for an order status change.
     */
    public function orderUpdated(Order $order, string $event = 'ORDER_UPDATED'): void
    {
        $this->push($order, $event);
    }

    /**
     * Broadcast a normalized, vendor-scoped snapshot of an order update to the
     * owning vendor's private channel. The payload reuses the tracking order
     * summary (never customer PII) plus minimal fulfilment data.
     */
    public function vendorOrderUpdated(Order $order): void
    {
        if (! $order->vendor_id) {
            return;
        }

        $order->loadMissing(['items', 'deliveryPartner.user']);

        $status = strtoupper((string) $order->status);
        $orderBlock = $this->tracking->orderSummary($order);
        $orderBlock['items_count'] = $order->items->count();
        $orderBlock['items'] = $order->items->map(fn ($item) => [
            'product_name' => $item->product_name,
            'quantity' => (int) $item->quantity,
            'unit_price' => (float) $item->unit_price,
            'line_total' => (float) $item->line_total,
        ])->all();
        $orderBlock['payment_method'] = $order->payment_method;
        $orderBlock['totals'] = [
            'subtotal' => (float) $order->subtotal,
            'delivery_fee' => (float) $order->delivery_fee,
            'total_amount' => (float) $order->total_amount,
        ];

        $partner = $order->deliveryPartner ? $this->tracking->partnerSafe($order->deliveryPartner) : null;

        $this->realtime->broadcast($this->vendorChannelFor($order), 'VENDOR_ORDER_UPDATED', [
            'event' => 'VENDOR_ORDER_UPDATED',
            'scope' => 'vendor',
            'order' => $orderBlock,
            'partner' => $partner,
            'sent_at' => now()->toISOString(),
        ]);
    }

    /**
     * Broadcast partner-facing confirmation once a delivery partner is
     * atomically assigned to the order.
     */
    public function assignmentConfirmed(Order $order, DeliveryPartner $partner): void
    {
        $this->realtime->broadcast($this->partnerChannelFor($partner), 'delivery.assignment-confirmed', [
            'order_id' => $order->id,
            'order_number' => $order->order_number,
            'service_type' => $order->order_type,
            'status' => strtoupper((string) $order->status),
            'pickup' => $this->tracking->orderSummary($order)['pickup'] ?? null,
            'sent_at' => now()->toISOString(),
        ]);
    }

    /**
     * Broadcast to the assigned partner that their order was cancelled.
     */
    public function orderCancelledForPartner(Order $order, DeliveryPartner $partner): void
    {
        $this->realtime->broadcast($this->partnerChannelFor($partner), 'delivery.order-cancelled', [
            'order_id' => $order->id,
            'order_number' => $order->order_number,
            'status' => 'CANCELLED',
            'reason' => $order->cancel_reason,
            'sent_at' => now()->toISOString(),
        ]);
    }

    /**
     * Broadcast the latest location for a partner's active order, if any.
     */
    public function partnerLocationUpdated(DeliveryPartner $partner): void
    {
        $order = Order::where('delivery_partner_id', $partner->id)
            ->whereIn('status', OrderTrackingService::ACTIVE_TRACKING_STATUSES)
            ->latest()
            ->first();

        if ($order) {
            $this->push($order, 'LOCATION_UPDATED');
        }
    }

    public function channelFor(Order $order): string
    {
        return config('tracking.channel_prefix', 'private-orders').'.'.$order->id;
    }

    public function vendorChannelFor(Order $order): string
    {
        return 'private-vendor.'.$order->vendor_id;
    }

    public function partnerChannelFor(DeliveryPartner $partner): string
    {
        return 'private-delivery_partner.'.$partner->id;
    }

    private function push(Order $order, string $event): void
    {
        $payload = $this->tracking->payload($order);
        $payload['event'] = $event;
        $payload['sent_at'] = now()->toISOString();

        $this->realtime->broadcast($this->channelFor($order), $event, $payload);
    }
}
