<?php

namespace App\Services\Dispatch;

use App\Models\DeliveryPartner;
use App\Models\Order;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

/**
 * Defines which delivery partners may be dispatched an order.
 *
 * A partner is eligible when they:
 *  - serve the order's service type (food|grocery),
 *  - have an accepted/online standing (not pending/rejected/suspended),
 *  - are currently online,
 *  - have room in their current trip (see `GroceryBatchService`),
 *  - have a live geographic location (freshness window is optional).
 *
 * `is_busy` deliberately does NOT gate eligibility. It means "has any active
 * work", which is true for a partner already carrying a batch, and capacity is
 * tracked separately in `active_batch_order_count`. When batching is disabled
 * (`GROCERY_MAX_SCHEDULED_ORDERS_PER_BATCH = 1`) `allowsAdditionalOrders()`
 * still rejects any partner who already holds an order, so the strict
 * one-order-per-partner behaviour is preserved.
 */
class DeliveryPartnerEligibilityService
{
    private const UNAVAILABLE_STATUSES = ['pending', 'rejected', 'suspended'];

    public function eligibleQuery(Order $order, string $serviceType): Builder
    {
        $query = DeliveryPartner::query()
            ->where('service_type', $serviceType)
            ->whereNotIn('status', self::UNAVAILABLE_STATUSES)
            ->where('is_online', true)
            ->whereNotNull('latitude')
            ->whereNotNull('longitude');

        if (! $this->allowsAdditionalOrders($order)) {
            // Batching off for this order: fall back to a partner who is not
            // already carrying work.
            $query->where('is_busy', false);
        }

        if ($order->pickup_zone_id !== null) {
            $query->where('current_zone_id', $order->pickup_zone_id);
        }

        $freshnessMinutes = config('dispatch.location_freshness_minutes');

        if ($freshnessMinutes !== null) {
            $query->where('last_location_at', '>=', now()->subMinutes((int) $freshnessMinutes));
        }

        return $query;
    }

    /**
     * Every service-matchable partner of a given service type, regardless of
     * online state, live location, zone or dispatch capacity.
     *
     * Used by the admin manual-assignment candidate list only: the admin must
     * be able to see ALL partners who could serve the order so they can decide
     * who to target, even when automatic dispatch (and the vendor's own list)
     * would hide them for being offline, out of radius or stale. Pending,
     * rejected and suspended stands are still excluded, and soft-deleted
     * partners are excluded by the model's global scope.
     */
    public function servicePartners(string $serviceType): Builder
    {
        return DeliveryPartner::query()
            ->where('service_type', $serviceType)
            ->whereNotIn('status', self::UNAVAILABLE_STATUSES);
    }

    /**
     * Whether this order may be batched onto a trip the partner already has.
     *
     * Only scheduled Grocery orders batch, and only while the admin capacity
     * above 1. Everything else — Food, Ride, ASAP grocery, and the 1 = disabled
     * setting — keeps the original single-order rule.
     */
    public function allowsAdditionalOrders(Order $order): bool
    {
        // Only scheduled grocery orders are batchable. An ASAP grocery order
        // has no delivery window to merge, so a busy partner must never be
        // offered it.
        if ($order->order_type !== 'grocery' || ! $order->delivery_slot_id) {
            return false;
        }

        return GroceryBatchService::maxOrdersPerBatch() > 1;
    }

    /**
     * Fetch all eligible partners for the order's service type.
     */
    public function eligibleCandidates(Order $order): Collection
    {
        $serviceType = app(OrderServiceTypeResolver::class)->resolve($order);

        return $this->eligibleQuery($order, $serviceType)->get();
    }

    public function isEligible(DeliveryPartner $partner, Order $order): bool
    {
        $serviceType = app(OrderServiceTypeResolver::class)->resolve($order);

        if ((string) $partner->service_type !== $serviceType) {
            return false;
        }

        if (in_array($partner->status, self::UNAVAILABLE_STATUSES, true)) {
            return false;
        }

        if (! $partner->is_online) {
            return false;
        }

        if ($partner->is_busy && ! $this->allowsAdditionalOrders($order)) {
            return false;
        }

        if ($order->pickup_zone_id !== null && (int) $partner->current_zone_id !== (int) $order->pickup_zone_id) {
            return false;
        }

        return $partner->latitude !== null && $partner->longitude !== null;
    }
}
