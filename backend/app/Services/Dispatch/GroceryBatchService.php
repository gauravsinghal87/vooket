<?php

namespace App\Services\Dispatch;

use App\Infrastructure\Interfaces\MapProviderInterface;
use App\Models\DeliveryBatch;
use App\Models\DeliveryPartner;
use App\Models\Order;
use App\Services\DeliverySlotService;
use Carbon\CarbonInterface;
use Illuminate\Database\QueryException;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Grocery multi-order delivery batches: one physical trip, several orders.
 *
 * Batching is deliberately narrow. It only ever groups orders that are all
 * of the following, which means Food, Ride and ASAP grocery keep their exact
 * existing one-order-per-partner behaviour:
 *
 *   - order_type is `grocery`
 *   - scheduled (has a delivery slot), not ASAP
 *   - READY or PACKED
 *   - unassigned (no delivery_partner_id)
 *   - same vendor / pickup point
 *   - slot windows that actually overlap
 *   - within the partner's remaining trip capacity
 *   - the resulting route still fits the shared window
 *
 * Every order keeps its own `delivery_partner_id`, status, OTP, payment and
 * earnings rows. A batch only groups them and records the stop sequence, so
 * one order can be picked up, OTP-verified, paid and cancelled without
 * touching its siblings.
 */
class GroceryBatchService
{
    /**
     * Statuses an order may hold when it joins (or is offered into) a batch.
     *
     * @var list<string>
     */
    public const BATCHABLE_STATUSES = ['READY', 'PACKED'];

    /**
     * Order statuses that still represent live trip work.
     *
     * @var list<string>
     */
    public const ACTIVE_ORDER_STATUSES = [
        'PARTNER_ASSIGNED',
        'PICKED_UP',
        'OUT_FOR_DELIVERY',
        'ARRIVED',
    ];

    public function __construct(
        private readonly DeliverySlotService $slotService,
    ) {}

    /**
     * Trip capacity, clamped to the safe 1..5 range.
     *
     * This is an internal deployment value, not an admin setting: a scheduled
     * order is batched onto a partner's trip only when the trip already fits
     * the shared delivery window. A value of 1 disables batching entirely.
     *
     * @return int<1, 5>
     */
    public static function maxOrdersPerBatch(): int
    {
        $ceiling = max(1, (int) config('delivery_slots.grocery_batch_max_orders', 5));
        $value = (int) config('delivery_slots.grocery_max_scheduled_orders_per_batch', 3);

        return min($ceiling, max(1, $value));
    }

    public function isBatchingEnabled(): bool
    {
        return self::maxOrdersPerBatch() > 1;
    }

    public function remainingCapacity(DeliveryPartner $partner): int
    {
        return max(0, self::maxOrdersPerBatch() - $this->activeOrderCount($partner->id));
    }

    /**
     * Live count of orders across the partner's active trip. Read from the
     * database rather than the cached `active_batch_order_count` column so a
     * stale in-memory model can never over-commit a trip.
     */
    public function activeOrderCount(int $partnerId): int
    {
        return (int) DeliveryBatch::query()
            ->join('delivery_batch_orders', 'delivery_batch_orders.delivery_batch_id', '=', 'delivery_batches.id')
            ->where('delivery_batches.status', DeliveryBatch::STATUS_ACTIVE)
            ->where('delivery_batches.delivery_partner_id', $partnerId)
            ->count();
    }

    /**
     * The order's immutable batching traits, independent of who is carrying
     * it. Used after assignment, when the order is already PARTNER_ASSIGNED
     * and holds a delivery_partner_id, so `isBatchableOrder()` can no longer
     * be consulted for it.
     */
    public function isBatchCandidate(Order $order): bool
    {
        return $this->isBatchingEnabled()
            && $order->order_type === 'grocery'
            && $order->delivery_slot_id !== null
            && $order->vendor_id !== null;
    }

    /**
     * Whether the order may be offered into a trip right now: it must be a
     * batch candidate and still unassigned and waiting.
     */
    public function isBatchableOrder(Order $order): bool
    {
        return $this->isBatchCandidate($order)
            && $order->delivery_partner_id === null
            && in_array($order->status, self::BATCHABLE_STATUSES, true);
    }

    /**
     * The partner's open trip, if any.
     */
    public function activeBatch(DeliveryPartner $partner): ?DeliveryBatch
    {
        return DeliveryBatch::where('delivery_partner_id', $partner->id)
            ->where('status', DeliveryBatch::STATUS_ACTIVE)
            ->latest('id')
            ->first();
    }

    /**
     * Decide whether `order` can be added to the partner's open trip, and
     * return the reasons it cannot when it cannot.
     *
     * @return array{eligible: bool, reasons: list<string>}
     */
    public function evaluateAdd(DeliveryPartner $partner, Order $order, ?DeliveryBatch $batch = null): array
    {
        $reasons = [];

        if (! $this->isBatchCandidate($order)) {
            $reasons[] = 'order_not_batchable';
        }

        $batch ??= $this->activeBatch($partner);

        if (! $batch) {
            $reasons[] = 'no_active_batch';

            return ['eligible' => false, 'reasons' => $reasons];
        }

        if ($this->remainingCapacity($partner) < 1) {
            $reasons[] = 'partner_at_capacity';
        }

        $orders = $this->batchOrdersWith($batch, $order);

        if ($orders->isEmpty()) {
            $reasons[] = 'route_not_resolvable';

            return ['eligible' => false, 'reasons' => $reasons];
        }

        if ($this->containsDifferentVendor($orders, $order)) {
            $reasons[] = 'different_pickup_point';
        }

        if (! $this->windowsOverlap($orders, $order)) {
            $reasons[] = 'windows_do_not_overlap';
        }

        if (! $this->routeFitsWindow($orders, $batch)) {
            $reasons[] = 'route_does_not_fit_window';
        }

        return ['eligible' => empty($reasons), 'reasons' => $reasons];
    }

    /**
     * True when a candidate order could join the partner's open trip.
     */
    public function canAdd(DeliveryPartner $partner, Order $order, ?DeliveryBatch $batch = null): bool
    {
        return $this->evaluateAdd($partner, $order, $batch)['eligible'];
    }

    /**
     * Add an already-assigned order to the partner's trip.
     *
     * Caller is responsible for holding the partner row lock; this method
     * re-verifies capacity inside the transaction so a concurrent accept
     * cannot push the partner over the limit.
     */
    public function addOrder(DeliveryPartner $partner, Order $order, ?DeliveryBatch $batch = null): ?DeliveryBatch
    {
        $batch ??= $this->activeBatch($partner);

        if (! $batch) {
            return null;
        }

        $batchOrders = $this->batchOrdersWith($batch, $order);
        $route = $this->buildRoute($batchOrders);

        if ($route === null) {
            return null;
        }

        DB::transaction(function () use ($batch, $order, $route, $batchOrders) {
            $sequence = (int) $batch->batchOrders()->max('sequence') + 1;

            $batch->batchOrders()->create([
                'order_id' => $order->id,
                'sequence' => $sequence,
                'status' => $order->status,
            ]);

            [$windowStart, $windowEnd] = $this->mergedWindow($batchOrders);

            $batch->forceFill(array_filter([
                'route' => $route,
                'stop_count' => $batchOrders->count(),
                'window_start' => $windowStart,
                'window_end' => $windowEnd,
            ], fn ($value) => $value !== null))->save();

            $this->syncCapacity($batch->delivery_partner_id);
        });

        return $batch->fresh();
    }

    /**
     * Remove a single order from the trip. The remaining orders, their
     * statuses and the partner's assignment are untouched.
     */
    public function removeOrder(DeliveryBatch $batch, Order $order): void
    {
        DB::transaction(function () use ($batch, $order) {
            $batch->batchOrders()->where('order_id', $order->id)->delete();

            $remaining = $this->currentOrders($batch);

            if ($remaining->isEmpty()) {
                $batch->close(DeliveryBatch::STATUS_CANCELLED);
            } else {
                $batch->forceFill([
                    'route' => $this->buildRoute($remaining),
                    'stop_count' => $remaining->count(),
                ])->save();
            }

            $this->syncCapacity($batch->delivery_partner_id);
        });
    }

    /**
     * Mirror an order's status onto its batch membership row and close the
     * trip once every stop is done.
     */
    public function syncOrderStatus(Order $order): void
    {
        $membership = DeliveryBatch::query()
            ->join('delivery_batch_orders', 'delivery_batch_orders.delivery_batch_id', '=', 'delivery_batches.id')
            ->where('delivery_batch_orders.order_id', $order->id)
            ->where('delivery_batches.status', DeliveryBatch::STATUS_ACTIVE)
            ->select('delivery_batches.*')
            ->first();

        if (! $membership) {
            return;
        }

        DB::transaction(function () use ($membership, $order) {
            if (! in_array($order->status, self::ACTIVE_ORDER_STATUSES, true)) {
                // The order has left the delivery lifecycle (delivered,
                // cancelled, ...). Drop it from the trip so the stop list,
                // route and capacity only ever describe live work.
                $membership->batchOrders()->where('order_id', $order->id)->delete();
            } else {
                $membership->batchOrders()
                    ->where('order_id', $order->id)
                    ->update(array_filter([
                        'status' => $order->status,
                        'pickup_completed_at' => $order->picked_up_at ?? now(),
                    ], fn ($value) => $value !== null));
            }

            $remaining = $membership->batchOrders()->count();

            if ($remaining === 0) {
                $membership->close();
            } else {
                $membership->forceFill([
                    'route' => $this->buildRoute($this->currentOrders($membership)),
                    'stop_count' => $remaining,
                ])->save();
            }

            $this->syncCapacity($membership->delivery_partner_id);
        });
    }

    /**
     * Drop the order from its trip when it leaves the delivery lifecycle
     * (cancelled, expired, ...) so the batch does not keep a dead stop.
     */
    public function detachIfIneligible(Order $order): void
    {
        if (in_array($order->status, self::ACTIVE_ORDER_STATUSES, true)) {
            return;
        }

        $batch = $this->batchFor($order);

        if ($batch) {
            $this->removeOrder($batch, $order);
        }
    }

    public function batchFor(Order $order): ?DeliveryBatch
    {
        return DeliveryBatch::query()
            ->join('delivery_batch_orders', 'delivery_batch_orders.delivery_batch_id', '=', 'delivery_batches.id')
            ->where('delivery_batch_orders.order_id', $order->id)
            ->where('delivery_batches.status', DeliveryBatch::STATUS_ACTIVE)
            ->select('delivery_batches.*')
            ->first();
    }

    /**
     * Recompute the partner's cached batch load. Must run inside a
     * transaction that already holds the partner row.
     */
    public function syncCapacity(int $partnerId): void
    {
        DeliveryPartner::whereKey($partnerId)
            ->update(['active_batch_order_count' => $this->activeOrderCount($partnerId)]);
    }

    /**
     * Create the opening trip for a partner's very first grocery order.
     */
    public function openBatch(DeliveryPartner $partner, Order $order): ?DeliveryBatch
    {
        try {
            $batch = DB::transaction(function () use ($partner, $order) {
                $batch = DeliveryBatch::create([
                    'delivery_partner_id' => $partner->id,
                    'order_type' => $order->order_type,
                    'status' => DeliveryBatch::STATUS_ACTIVE,
                    'batch_number' => 'BAT_'.now()->format('YmdHis').'_'.strtoupper(Str::random(6)),
                    'window_start' => $this->windowStart($order),
                    'window_end' => $this->windowEnd($order),
                    'delivery_slot_id' => $order->delivery_slot_id,
                    'stop_count' => 1,
                    'active_flag' => 1,
                    'route' => $this->buildRoute(collect([$order])),
                    'started_at' => now(),
                ]);

                // The opening order is stop 1 of the new trip.
                $batch->batchOrders()->create([
                    'order_id' => $order->id,
                    'sequence' => 1,
                    'status' => $order->status,
                ]);

                $this->syncCapacity($partner->id);

                return $batch;
            });

            return $batch;
        } catch (QueryException $e) {
            // Unique (delivery_partner_id, active_flag) guard: a concurrent
            // accept already opened the trip, so reuse it.
            if (! $this->isUniqueViolation($e)) {
                throw $e;
            }

            return $this->activeBatch($partner);
        }
    }

    /**
     * Append the order to the partner's trip. Returns null when the trip is
     * full or the route no longer fits, leaving the order unassigned.
     */
    public function attach(DeliveryPartner $partner, Order $order): ?DeliveryBatch
    {
        $existing = $this->batchFor($order);

        if ($existing) {
            // Already on a trip. Only this partner's own trip counts; an order
            // held by someone else is never adopted.
            return (int) $existing->delivery_partner_id === (int) $partner->id ? $existing : null;
        }

        // Food, Ride, ASAP grocery and anything else outside the batch gate
        // never open or join a trip, so their single-order behaviour is exact.
        // `isBatchCandidate` is used here rather than `isBatchableOrder`
        // because the order is already assigned by the time we get here.
        if (! $this->isBatchCandidate($order)) {
            return null;
        }

        $batch = $this->activeBatch($partner);

        if (! $batch) {
            $batch = $this->openBatch($partner, $order);
        } elseif ($this->canAdd($partner, $order, $batch)) {
            $batch = $this->addOrder($partner, $order, $batch);
        }

        if ($batch && ! $batch->batchOrders()->where('order_id', $order->id)->exists()) {
            return null;
        }

        return $batch;
    }

    /**
     * Trip membership ordered by stop sequence.
     *
     * @return Collection<int, Order>
     */
    public function currentOrders(DeliveryBatch $batch)
    {
        return $batch->orders()->get();
    }

    /**
     * Build a real, map-measured route for the trip: the vendor pickup, then
     * every drop in sequence, with per-leg distance and duration.
     *
     * @param  Collection<int, Order>  $orders
     * @return array<string, mixed>|null
     */
    public function buildRoute($orders): ?array
    {
        $orders = $orders->filter(fn (Order $order) => $order->vendor_id !== null)->values();

        if ($orders->isEmpty()) {
            return null;
        }

        $vendor = $orders->first()->vendor;

        if (! $vendor || $vendor->latitude === null || $vendor->longitude === null) {
            return null;
        }

        $pickup = ['lat' => (float) $vendor->latitude, 'lng' => (float) $vendor->longitude];
        $stops = [];
        $legs = [];
        $cursor = $pickup;
        $totalDistance = 0.0;
        $totalDuration = 0;

        foreach ($orders as $order) {
            $address = $order->address;

            if (! $address || $address->latitude === null || $address->longitude === null) {
                return null;
            }

            $drop = ['lat' => (float) $address->latitude, 'lng' => (float) $address->longitude];
            $leg = $this->measureLeg($cursor, $drop);

            $legs[] = [
                'from_order_id' => null,
                'to_order_id' => $order->id,
                'distance_km' => $leg['distance_km'],
                'duration_min' => $leg['duration_min'],
            ];

            $totalDistance += $leg['distance_km'];
            $totalDuration += $leg['duration_min'];

            $stops[] = [
                'order_id' => $order->id,
                'order_number' => $order->order_number,
                'label' => $address->formatted_address ?: $address->address_line_1,
                'point' => $drop,
                'leg_distance_km' => $leg['distance_km'],
                'leg_duration_min' => $leg['duration_min'],
                'status' => $order->status,
            ];

            $cursor = $drop;
        }

        return [
            'pickup' => $pickup,
            'pickup_label' => $vendor->name,
            'stops' => $stops,
            'legs' => $legs,
            'total_distance_km' => round($totalDistance, 2),
            'total_duration_min' => $totalDuration,
            'measured_at' => now()->toIso8601String(),
        ];
    }

    /**
     * Distance and duration for one leg, using the configured map provider.
     *
     * The real Google provider returns `duration_min` while the mock provider
     * returns `duration_mins`, so both keys are read.
     *
     * @param  array{lat: float, lng: float}  $origin
     * @param  array{lat: float, lng: float}  $destination
     * @return array{distance_km: float, duration_min: int}
     */
    private function measureLeg(array $origin, array $destination): array
    {
        $maps = app(MapProviderInterface::class);

        $result = $maps->calculateDistanceAndTime(
            ['latitude' => $origin['lat'], 'longitude' => $origin['lng']],
            ['latitude' => $destination['lat'], 'longitude' => $destination['lng']],
        );

        $duration = $result['duration_min'] ?? $result['duration_mins'] ?? 0;

        return [
            'distance_km' => (float) ($result['distance_km'] ?? 0),
            'duration_min' => (int) $duration,
        ];
    }

    /**
     * The trip plus the candidate order, as a route-ready collection.
     *
     * @return Collection<int, Order>
     */
    private function batchOrdersWith(DeliveryBatch $batch, Order $candidate)
    {
        $existing = $this->currentOrders($batch)
            ->reject(fn (Order $order) => $order->id === $candidate->id)
            ->values();

        return $existing->push($candidate);
    }

    private function containsDifferentVendor($orders, Order $candidate): bool
    {
        $pickup = $this->pickupKey($candidate);

        return $orders->contains(function (Order $order) use ($pickup) {
            return $this->pickupKey($order) !== $pickup;
        });
    }

    /**
     * Identity of an order's pickup point. Two orders can share a vendor and
     * still be different stores, so the store is the stricter key and the
     * vendor is only used when no store is attached.
     */
    private function pickupKey(Order $order): string
    {
        $storeId = $order->deliverySlot?->store_id;

        if ($storeId) {
            return 'store:'.$storeId;
        }

        return 'vendor:'.(int) $order->vendor_id;
    }

    /**
     * Latest start and earliest end across every order on the trip. The batch
     * stores this intersection so the active-trip payload always describes the
     * window the whole trip can actually serve.
     *
     * @param  Collection<int, Order>  $orders
     * @return array{0: ?CarbonInterface, 1: ?CarbonInterface}
     */
    private function mergedWindow($orders): array
    {
        $starts = $orders->map(fn (Order $order) => $this->windowStart($order))->filter();
        $ends = $orders->map(fn (Order $order) => $this->windowEnd($order))->filter();

        return [$starts->max(), $ends->min()];
    }

    /**
     * Slot windows must genuinely overlap: the latest start must fall at or
     * before the earliest end.
     *
     * @param  Collection<int, Order>  $orders
     */
    private function windowsOverlap($orders, Order $candidate): bool
    {
        $starts = $orders->concat([$candidate])->map(fn (Order $order) => $this->windowStart($order))->filter();
        $ends = $orders->concat([$candidate])->map(fn (Order $order) => $this->windowEnd($order))->filter();

        if ($starts->isEmpty() || $ends->isEmpty()) {
            return false;
        }

        return $starts->max()->lte($ends->min());
    }

    /**
     * The measured route must still fit inside the shared window, measured
     * from the earlier of the two eligible dispatch instants.
     *
     * @param  Collection<int, Order>  $orders
     */
    private function routeFitsWindow($orders, DeliveryBatch $batch): bool
    {
        $windowEnd = $orders->map(fn (Order $order) => $this->windowEnd($order))->filter()->min();

        if (! $windowEnd) {
            return false;
        }

        $bufferMinutes = (int) config('dispatch.batch_window_buffer_minutes', 10);
        $earliestDeparture = $orders
            ->map(fn (Order $order) => $this->slotService->dispatchEligibleAt($order))
            ->filter()
            ->max();

        if (! $earliestDeparture) {
            return false;
        }

        $route = $this->buildRoute($orders);

        if ($route === null) {
            return false;
        }

        $total = (int) $route['total_duration_min'] + $bufferMinutes;

        return $earliestDeparture->copy()->addMinutes($total)->lte($windowEnd);
    }

    private function windowStart(Order $order): ?CarbonInterface
    {
        return $this->slotService->slotStartFor($order);
    }

    private function windowEnd(Order $order): ?CarbonInterface
    {
        return $this->slotService->slotEndFor($order);
    }

    private function isUniqueViolation(QueryException $e): bool
    {
        return (string) $e->getCode() === '23000' || str_contains($e->getMessage(), 'UNIQUE constraint failed');
    }
}
