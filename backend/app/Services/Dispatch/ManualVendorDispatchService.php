<?php

namespace App\Services\Dispatch;

use App\Exceptions\ManualDispatchException;
use App\Models\DeliveryPartner;
use App\Models\DispatchLog;
use App\Models\Order;
use App\Models\OrderStatusHistory;
use App\Models\User;
use App\Services\DeliverySlotService;
use App\Services\OrderStateMachine;
use Illuminate\Support\Facades\DB;

/**
 * Manual partner assignment for Food and Grocery orders.
 *
 * This is the override/recovery path used by both the vendor and admin apps.
 * Unlike the automatic dispatch pipeline the selected partner is picked by a
 * human: the order must be in a serviceable state (PACKED, or READY which is
 * the app's "awaiting a partner" state) with no partner assigned yet, and the
 * pick is filtered with the same service-aware eligibility rules as automatic
 * dispatch (Food orders only see Food partners, Grocery only Grocery).
 *
 * One candidate list is offered over the same offer flow to both scopes:
 * every service-eligible partner — regardless of distance, online state or
 * live location — so a human can recover an order from the full service pool.
 * Distance does not gate the list; it is computed for display only, and
 * assignment availability is annotated per partner so an offline / out-of-zone
 * / locationless partner is still visible but marked unassignable. The only
 * difference between the admin and vendor scopes is authorization: each
 * controller restricts the list and the assign call to the orders it owns.
 * Automatic dispatch keeps its own nearby/radius/ranking rules untouched.
 *
 * Assignment never bypasses partner acceptance: `delivery_partner_id` is NOT
 * set up front and no batch is created until the partner accepts through the
 * existing offer flow. There is no auto-fallback either — when the targeted
 * offer is rejected or expires, the order simply returns to "needs assignment".
 * For scheduled Grocery the automatic pipeline stays gated by
 * `DeliverySlotService::isManualVendorDispatch`; a manual assignment is always
 * permitted regardless of that setting because it is the vendor's explicit
 * override.
 *
 * The order row is locked for the whole assignment so a concurrent partner
 * acceptance and a "change partner" request can never both win.
 */
class ManualVendorDispatchService
{
    /** @var list<string> */
    private const ASSIGNABLE_STATUSES = ['PACKED', 'READY'];

    public function __construct(
        private DeliverySlotService $slotService,
        private DeliveryPartnerEligibilityService $eligibility,
        private OrderDispatchService $dispatch,
        private OrderServiceTypeResolver $resolver,
    ) {}

    public function isManualOrder(Order $order): bool
    {
        return $this->slotService->isManualVendorDispatch($order);
    }

    /**
     * Whether the order is currently eligible for a manual partner assignment.
     * The single source of truth the UI and controllers use to show/hide the
     * "Assign delivery partner" control.
     */
    public function isManualAssignable(Order $order): bool
    {
        if ($order->delivery_partner_id !== null) {
            return false;
        }

        if (! in_array($order->status, self::ASSIGNABLE_STATUSES, true)) {
            return false;
        }

        return in_array($this->resolver->resolve($order), [$this->resolver::FOOD, $this->resolver::GROCERY], true);
    }

    /**
     * Every service-eligible partner that could be targeted for this manual
     * order, regardless of distance, online state or live location.
     *
     * Used by BOTH the admin and vendor manual-assignment scopes. This
     * intentionally does NOT apply the automatic-dispatch radius, zone, online
     * or location-freshness filters. A partner 15 km away, offline, or without
     * a current location is shown (marked with a null distance or an
     * unassignable flag where relevant) so the full service pool is visible.
     * Assignment availability is still computed with the exact same `isEligible`
     * rules the assign step enforces, so the UI can disable partners that would
     * be refused without trusting the client.
     *
     * Partners without a live location sort last; the rest are ranked by
     * distance to the order's pickup point.
     *
     * @return array{pickup: array<string, mixed>, service: string, service_label: string, partners: list<array<string, mixed>>}
     */
    public function manualCandidates(Order $order): array
    {
        $order = $order->fresh() ?? $order;
        $this->assertManualOrder($order);

        $serviceType = $this->resolver->resolve($order);

        $pickup = $this->dispatch->pickupCoordinates($order);

        if (! $pickup) {
            throw new ManualDispatchException('This order has no pickup location.', 'no_pickup_coordinates');
        }

        $candidates = $this->eligibility->servicePartners($serviceType)->get()
            ->map(fn (DeliveryPartner $partner) => [
                'partner' => $partner,
                'distance_km' => $partner->latitude !== null && $partner->longitude !== null
                    ? $this->dispatch->distanceKmBetween(
                        (float) $partner->latitude,
                        (float) $partner->longitude,
                        $pickup['latitude'],
                        $pickup['longitude'],
                    )
                    : null,
            ])
            ->sort(function (array $a, array $b) {
                $aDistance = $a['distance_km'];
                $bDistance = $b['distance_km'];

                if ($aDistance === null && $bDistance === null) {
                    return $a['partner']->id <=> $b['partner']->id;
                }

                if ($aDistance === null) {
                    return 1;
                }

                if ($bDistance === null) {
                    return -1;
                }

                return $aDistance <=> $bDistance ?: $a['partner']->id <=> $b['partner']->id;
            })
            ->values();

        return [
            'pickup' => $pickup,
            'service' => $serviceType,
            'service_label' => $this->resolver->label($serviceType),
            'partners' => $candidates
                ->map(fn (array $candidate) => $this->partnerPayload($candidate['partner'], $candidate['distance_km'], $order, $serviceType))
                ->values()
                ->all(),
        ];
    }

    /**
     * Target `$partner` for `$order`, superseding any prior live offer for a
     * different partner. Returns the resulting offer.
     *
     * Idempotent: assigning the same partner again keeps their existing live
     * (pending) offer instead of creating a duplicate.
     *
     * @param  string|null  $channel  `admin` records admin_manual assignment,
     *                                anything else records vendor_manual
     * @return array{status: string, order: Order, offer: DispatchLog}
     */
    public function assign(Order $order, DeliveryPartner $partner, User $actor, ?string $note = null, ?string $channel = null): array
    {
        $channel = $channel === 'admin' ? 'admin' : 'vendor';
        $mode = $channel === 'admin' ? 'admin_manual' : 'vendor_manual';

        return DB::transaction(function () use ($order, $partner, $actor, $note, $channel, $mode) {
            $locked = Order::whereKey($order->id)->lockForUpdate()->first();

            if (! $locked) {
                throw new ManualDispatchException('Order not found.', 'order_not_found');
            }

            $this->assertManualOrder($locked);

            if ($locked->delivery_partner_id !== null) {
                throw new ManualDispatchException('This order already has an assigned delivery partner.', 'already_assigned');
            }

            if (! in_array($locked->status, self::ASSIGNABLE_STATUSES, true)) {
                throw new ManualDispatchException(
                    'This order can only be assigned after you have packed it.',
                    'not_assignment_eligible'
                );
            }

            $freshPartner = DeliveryPartner::whereKey($partner->id)->first();

            if (! $freshPartner || ! $this->eligibility->isEligible($freshPartner, $locked)) {
                throw new ManualDispatchException(
                    'This delivery partner is not eligible for this order.',
                    'partner_ineligible'
                );
            }

            // A partner already on a trip is selectable (the vendor is shown a
            // warning), but the trip is only extended when the partner accepts
            // — the accept step enforces the final batching capacity. Awarding
            // an offer here never means the order is actually in a batch yet.

            if ($locked->status === 'PACKED') {
                OrderStateMachine::assertCanTransition($locked, 'READY');

                OrderStatusHistory::create([
                    'order_id' => $locked->id,
                    'status' => 'READY',
                    'old_status' => 'PACKED',
                    'new_status' => 'READY',
                    'changed_at' => now(),
                    'notes' => 'Advanced to READY for partner assignment',
                    'changed_by' => $actor->id,
                    'changed_by_type' => $channel,
                ]);

                $locked->update(['status' => 'READY', 'ready_at' => now()]);
            }

            $existing = DispatchLog::where('order_id', $locked->id)
                ->where('candidate_id', $freshPartner->id)
                ->where('status', DispatchLog::STATUS_PENDING)
                ->latest('id')
                ->first();

            if ($existing) {
                $meta = $locked->meta ?? [];
                $meta['delivery_assignment_mode'] = $mode;
                $locked->update(['meta' => $meta]);

                return ['status' => 'assigned', 'order' => $locked->fresh(), 'offer' => $existing];
            }

            $offer = $this->dispatch->createTargetedOffer($locked, $freshPartner, [
                'assignment' => [
                    'mode' => $mode,
                    'assigned_by' => $channel,
                    'assigned_by_user_id' => $actor->id,
                    'note' => $note,
                    'assigned_at' => now()->toIso8601String(),
                ],
            ]);

            $this->dispatch->supersedeOffers($locked, $freshPartner->id);

            $meta = $locked->meta ?? [];
            $meta['delivery_assignment_mode'] = $mode;
            $meta['dispatch'] = array_merge($meta['dispatch'] ?? [], [
                'status' => 'manual_offer_pending',
                'mode' => $mode,
            ]);
            $locked->update(['meta' => $meta]);

            return ['status' => 'assigned', 'order' => $locked->fresh(), 'offer' => $offer];
        });
    }

    /**
     * @throws ManualDispatchException
     */
    private function assertManualOrder(Order $order): void
    {
        if (! in_array($this->resolver->resolve($order), [$this->resolver::FOOD, $this->resolver::GROCERY], true)) {
            throw new ManualDispatchException(
                'Only food and grocery orders can be assigned a delivery partner.',
                'not_dispatchable_service'
            );
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function partnerPayload(DeliveryPartner $partner, ?float $distanceKm, Order $order, string $serviceType): array
    {
        $status = ! $partner->is_online ? 'offline' : ($partner->is_busy ? 'on_job' : 'online');
        $eligibleForBatch = $this->eligibility->allowsAdditionalOrders($order);

        return [
            'id' => $partner->id,
            'name' => $partner->user?->name ?? 'Delivery Partner',
            'distance_km' => $distanceKm === null ? null : (float) $distanceKm,
            'service' => (string) $partner->service_type,
            'service_label' => $this->resolver->label((string) $partner->service_type),
            'status' => $status,
            'availability' => $status,
            'is_online' => (bool) $partner->is_online,
            'is_busy' => (bool) $partner->is_busy,
            'is_manual_order' => $this->isManualOrder($order),
            'has_current_location' => $partner->latitude !== null && $partner->longitude !== null,
            'available' => (bool) $partner->is_online && (! $partner->is_busy || $eligibleForBatch),
            'available_for_assignment' => $this->eligibility->isEligible($partner, $order),
            'active_batch_order_count' => (int) $partner->active_batch_order_count,
            'vehicle_type' => $partner->vehicle_type,
            'rating' => (float) ($partner->rating ?? 0),
            'last_location_at' => $partner->last_location_at?->toIso8601String(),
        ];
    }
}
