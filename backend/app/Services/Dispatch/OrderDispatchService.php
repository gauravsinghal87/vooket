<?php

namespace App\Services\Dispatch;

use App\Exceptions\ManualDispatchException;
use App\Infrastructure\Interfaces\RealtimeProviderInterface;
use App\Models\DeliveryPartner;
use App\Models\DispatchLog;
use App\Models\Order;
use App\Services\DeliverySlotService;
use App\Services\Pricing\DeliveryFeeService;
use App\Services\Pricing\GroceryDeliveryConfigService;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Delivers "READY" orders to eligible delivery partners via DispatchLog
 * offers.
 *
 * Offers are created sequentially:
 *   - the nearest eligible partner receives a "pending" (active) offer,
 *   - the remaining candidates are queued as "sent" and promoted one by one
 *     as each active offer is declined or expires.
 *
 * The flow is idempotent: re-marking an order READY never duplicates an
 * existing active offer chain.
 */
class OrderDispatchService
{
    /**
     * A scheduled grocery order is only offered to partners once it has been
     * packed. `READY` is the state the grocery vendor UI reaches with
     * "Mark as packed your order"; `PACKED` is kept for the equivalent
     * explicit state.
     */
    private const SCHEDULED_DISPATCHABLE_STATUSES = ['PACKED', 'READY'];

    public function __construct(
        private DeliveryPartnerEligibilityService $eligibility,
        private OrderServiceTypeResolver $serviceTypeResolver,
        private DeliveryFeeService $deliveryFeeService,
        private DeliverySlotService $deliverySlotService,
        private GroceryBatchService $batchService,
        private GroceryDeliveryConfigService $groceryDeliveryConfig,
    ) {}

    /**
     * Create delivery offers for an order, unless one already exists.
     *
     * @return array{status: string, offer?: DispatchLog, offers?: int}
     */
    public function dispatchForOrder(Order $order): array
    {
        $order = $order->fresh() ?? $order;

        if ($order->delivery_partner_id) {
            return ['status' => 'already_assigned'];
        }

        if (in_array($order->status, ['PARTNER_ASSIGNED', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'SCHEDULED'], true)) {
            return ['status' => 'not_dispatcheable', 'order_status' => $order->status];
        }

        // Scheduled Grocery orders are dispatched manually by their vendor, so
        // the automatic scheduler must NEVER offer them to a partner. ASAP
        // Grocery, Food and Ride pass through untouched.
        if ($this->deliverySlotService->isManualVendorDispatch($order)) {
            return ['status' => 'vendor_manual_dispatch'];
        }

        $scheduledGate = $this->scheduledDispatchGate($order);

        if ($scheduledGate !== null) {
            return $scheduledGate;
        }

        $active = $this->activeOffer($order);
        if ($active) {
            return ['status' => 'already_offering', 'offer' => $active];
        }

        $promoted = $this->promoteNext($order);
        if ($promoted) {
            return ['status' => 'promoted', 'offer' => $promoted];
        }

        return $this->createOfferBatch($order);
    }

    /**
     * Create a single, targeted offer for one partner — used by the vendor's
     * manual assignment flow for scheduled Grocery orders. The offer is
     * created "pending" and the partner is notified, exactly like the first
     * offer of an automatic batch, so the partner accepts it through the same
     * existing flow.
     *
     * @param  array<string, mixed>  $metaExtra
     */
    public function createTargetedOffer(Order $order, DeliveryPartner $partner, array $metaExtra = []): DispatchLog
    {
        $order = $order->fresh() ?? $order;
        $pickup = $this->pickupCoordinates($order);

        if (! $pickup) {
            throw new ManualDispatchException('This order has no pickup location.', 'no_pickup_coordinates');
        }

        $serviceType = $this->serviceTypeResolver->resolve($order);
        $distance = $this->distanceKmBetween(
            (float) $partner->latitude,
            (float) $partner->longitude,
            $pickup['latitude'],
            $pickup['longitude'],
        );

        $offer = DispatchLog::create([
            'dispatch_type' => (string) config('dispatch.dispatch_type', 'delivery'),
            'order_id' => $order->id,
            'candidate_id' => $partner->id,
            'candidate_type' => DispatchLog::CANDIDATE_TYPE_DELIVERY_PARTNER,
            'distance_km' => $distance,
            'status' => DispatchLog::STATUS_PENDING,
            'expires_at' => now()->addSeconds($this->offerTimeout()),
            'meta' => array_merge($this->offerMeta($order, $serviceType, $pickup, $partner, $distance), $metaExtra),
        ]);

        $this->notifyPartnerOffer($offer);

        return $offer;
    }

    /**
     * Void every live (pending / queued) offer for an order — used when the
     * vendor re-targets a different partner. Expired/rejected offers are left
     * alone. Returns the number of offers superseded.
     */
    public function supersedeOffers(Order $order, ?int $exceptCandidateId = null): int
    {
        $offers = DispatchLog::where('order_id', $order->id)
            ->whereIn('status', [DispatchLog::STATUS_PENDING, DispatchLog::STATUS_SENT])
            ->when($exceptCandidateId !== null, fn ($query) => $query->where('candidate_id', '!=', $exceptCandidateId))
            ->get();

        if ($offers->isEmpty()) {
            return 0;
        }

        DispatchLog::whereIn('id', $offers->pluck('id'))->update(['status' => DispatchLog::STATUS_EXPIRED]);

        foreach ($offers as $offer) {
            $this->announceOfferExpired($offer);
        }

        return $offers->count();
    }

    /**
     * Eligibility gate for a scheduled grocery order.
     *
     * A scheduled order is held back from delivery partners until its booked
     * delivery window has opened, and until the vendor has actually packed it.
     * ASAP grocery orders and every food/ride order are not scheduled, so they
     * are never gated and keep the existing behaviour.
     *
     * @return array{status: string, dispatch_eligible_at?: string, order_status?: string}|null
     */
    private function scheduledDispatchGate(Order $order): ?array
    {
        $slot = $this->deliverySlotService->dispatchEligibleAt($order);

        if ($slot === null) {
            return null;
        }

        $now = Carbon::now('UTC');

        if ($slot->greaterThan($now)) {
            return ['status' => 'scheduled_wait', 'dispatch_eligible_at' => $slot->toIso8601String()];
        }

        if (! in_array($order->status, self::SCHEDULED_DISPATCHABLE_STATUSES, true)) {
            return ['status' => 'scheduled_not_prepared', 'order_status' => $order->status];
        }

        return null;
    }

    /**
     * Mark expired "pending" offers as expired for the order.
     */
    public function expirePendingOffers(Order $order): int
    {
        return DispatchLog::where('order_id', $order->id)
            ->where('status', DispatchLog::STATUS_PENDING)
            ->where('expires_at', '<', now())
            ->update(['status' => DispatchLog::STATUS_EXPIRED]);
    }

    /**
     * Promote the next queued ("sent") candidate to an active "pending"
     * offer. Ineligible candidates are skipped and marked expired.
     */
    public function promoteNext(Order $order): ?DispatchLog
    {
        $this->expirePendingOffers($order);

        while ($next = DispatchLog::where('order_id', $order->id)
            ->where('status', DispatchLog::STATUS_SENT)
            ->orderBy('id')
            ->first()) {
            $partner = DeliveryPartner::find($next->candidate_id);

            if (! $partner || ! $this->eligibility->isEligible($partner, $order)) {
                $meta = (array) $next->meta;
                $meta['expired_reason'] = 'partner_unavailable';
                $next->update(['status' => DispatchLog::STATUS_EXPIRED, 'meta' => $meta]);

                continue;
            }

            $next->update([
                'status' => DispatchLog::STATUS_PENDING,
                'expires_at' => now()->addSeconds($this->offerTimeout()),
            ]);
            $this->notifyPartnerOffer($next);

            return $next;
        }

        $this->markDispatchStatus($order, 'no_partner_available');

        return null;
    }

    public function isOfferExpired(DispatchLog $offer): bool
    {
        return $offer->expires_at !== null && $offer->expires_at->isPast();
    }

    public function isEligiblePartner(DeliveryPartner $partner, Order $order): bool
    {
        return $this->eligibility->isEligible($partner, $order);
    }

    /**
     * Pickup coordinates of the food/grocery source, used to rank partners.
     *
     * Resolves coordinates from the order's Restaurant or Store outlet first,
     * then falls back to the owning Vendor's coordinates so offers can be
     * created even when an outlet record lacks a saved location.
     *
     * @return array{latitude: float, longitude: float, name: string, address: string|null}|null
     */
    public function pickupCoordinates(Order $order): ?array
    {
        $candidates = [];

        if ($order->restaurant_id) {
            $candidates[] = $order->restaurant;
        }
        if ($order->store_id) {
            $candidates[] = $order->store;
        }
        if ($order->vendor_id) {
            $candidates[] = $order->vendor;
        }

        foreach ($candidates as $source) {
            if (! $source || $source->latitude === null || $source->longitude === null) {
                continue;
            }

            return [
                'latitude' => (float) $source->latitude,
                'longitude' => (float) $source->longitude,
                'name' => (string) ($source->name ?? $source->business_name ?? 'Pickup point'),
                'address' => $source->address,
            ];
        }

        return null;
    }

    /**
     * Re-attempt delivery dispatch for orders near a partner that are still
     * waiting for a partner (e.g. none were online when the vendor marked the
     * order READY). Runs when a partner comes online or refreshes their
     * location, so offers appear the moment a partner is available nearby.
     */
    public function dispatchForArea(DeliveryPartner $partner): int
    {
        if ($partner->latitude === null || $partner->longitude === null) {
            return 0;
        }

        $maxRadius = (float) config('dispatch.max_radius_km', 10);
        $nearbyOrders = Order::where('order_type', $partner->service_type)
            // PACKED is dispatchable per the scheduled gate, so it must be
            // considered here too or it would never reach a nearby partner.
            ->whereIn('status', ['PENDING', 'PACKED', 'READY', 'PLACED', 'CONFIRMED', 'PREPARING', 'ACCEPTED'])
            ->whereNull('delivery_partner_id')
            ->whereDoesntHave('dispatchLogs', fn ($query) => $query
                ->whereIn('status', [DispatchLog::STATUS_PENDING, DispatchLog::STATUS_SENT]))
            ->get()
            ->filter(function (Order $order) use ($partner, $maxRadius) {
                $pickup = $this->pickupCoordinates($order);

                if (! $pickup || $this->distanceKmBetween(
                    (float) $partner->latitude,
                    (float) $partner->longitude,
                    $pickup['latitude'],
                    $pickup['longitude']
                ) > $maxRadius) {
                    return false;
                }

                // A partner already on a trip should only be offered orders
                // that actually fit it, rather than every nearby order.
                if ($partner->is_busy && $this->batchService->isBatchableOrder($order)) {
                    return $this->batchService->canAdd($partner, $order);
                }

                return true;
            });

        $dispatched = 0;

        foreach ($nearbyOrders as $nearbyOrder) {
            $result = $this->dispatchForOrder($nearbyOrder);

            if (($result['status'] ?? null) === 'already_assigned') {
                continue;
            }

            $dispatched++;
        }

        return $dispatched;
    }

    /**
     * Build a normalized offer batch for the order. The nearest eligible
     * partner becomes the active ("pending") offer; the rest are queued.
     *
     * @return array{status: string, offer?: DispatchLog, offers?: int}
     */
    private function createOfferBatch(Order $order): array
    {
        $serviceType = $this->serviceTypeResolver->resolve($order);
        $pickup = $this->pickupCoordinates($order);

        if (! $pickup) {
            $this->markDispatchStatus($order, 'no_pickup_coordinates');

            return ['status' => 'no_pickup_coordinates'];
        }

        $candidates = $this->rankedCandidates($order, $pickup['latitude'], $pickup['longitude']);

        if ($candidates->isEmpty()) {
            $this->markDispatchStatus($order, 'no_partner_available');

            return ['status' => 'no_partner_available', 'service_type' => $serviceType];
        }

        $timeout = $this->offerTimeout();
        $offers = [];

        foreach ($candidates->values() as $index => $candidate) {
            $isActive = $index === 0;
            $offer = DispatchLog::create([
                'dispatch_type' => (string) config('dispatch.dispatch_type', 'delivery'),
                'order_id' => $order->id,
                'candidate_id' => $candidate['partner']->id,
                'candidate_type' => DispatchLog::CANDIDATE_TYPE_DELIVERY_PARTNER,
                'distance_km' => $candidate['distance_km'],
                'status' => $isActive ? DispatchLog::STATUS_PENDING : DispatchLog::STATUS_SENT,
                'expires_at' => $isActive ? now()->addSeconds($timeout) : null,
                'meta' => $this->offerMeta($order, $serviceType, $pickup, $candidate['partner'], $candidate['distance_km']),
            ]);

            if ($isActive) {
                $this->notifyPartnerOffer($offer);
            }

            $offers[] = $offer;
        }

        $this->markDispatchStatus($order, 'searching');

        return ['status' => 'offered', 'offer' => $offers[0], 'offers' => count($offers)];
    }

    /**
     * @return Collection<int, array{partner: DeliveryPartner, distance_km: float}>
     */
    private function rankedCandidates(Order $order, float $pickupLat, float $pickupLng): Collection
    {
        // Only a live offer blocks a partner. Expired and rejected offers must
        // not blacklist a partner permanently, otherwise an order that nobody
        // accepted is never re-offered to the same nearby partners.
        $alreadyOffered = DispatchLog::where('order_id', $order->id)
            ->whereIn('status', [DispatchLog::STATUS_PENDING, DispatchLog::STATUS_SENT, DispatchLog::STATUS_ACCEPTED, DispatchLog::STATUS_ASSIGNED])
            ->pluck('candidate_id')
            ->all();
        $maxRadius = (float) config('dispatch.max_radius_km', 10);
        $maxCandidates = (int) config('dispatch.max_candidates', 8);

        return $this->eligibility->eligibleCandidates($order)
            ->map(fn (DeliveryPartner $partner) => [
                'partner' => $partner,
                'distance_km' => $this->distanceKmBetween($pickupLat, $pickupLng, (float) $partner->latitude, (float) $partner->longitude),
            ])
            ->reject(fn (array $candidate) => $candidate['distance_km'] > $maxRadius)
            ->reject(fn (array $candidate) => in_array($candidate['partner']->id, $alreadyOffered, true))
            ->sortBy('distance_km')
            ->take($maxCandidates);
    }

    private function activeOffer(Order $order): ?DispatchLog
    {
        return DispatchLog::where('order_id', $order->id)
            ->where('status', DispatchLog::STATUS_PENDING)
            ->latest('id')
            ->first();
    }

    private function offerTimeout(): int
    {
        return (int) config('dispatch.offer_timeout_seconds', 45);
    }

    /**
     * @param  array{latitude: float, longitude: float, name: string, address: string|null}  $pickup
     * @return array<string, mixed>
     */
    private function offerMeta(Order $order, string $serviceType, array $pickup, DeliveryPartner $partner, float $distanceKm): array
    {
        $snapshot = $order->delivery_address_snapshot;
        $snapshot = is_array($snapshot) ? $snapshot : (is_string($snapshot) ? (json_decode($snapshot, true) ?: []) : []);

        // $distanceKm is the partner-to-pickup distance used for the offer ETA.
        // The earning is based on the vendor-to-drop delivery distance, which is
        // the same distance used when the earning is finalised on delivery.
        $customerFee = round((float) $order->delivery_fee, 2);
        $deliveryDistance = $this->deliveryFeeService->orderDeliveryDistanceKm($order);
        // Read the Admin-funded cost off the order's own frozen pricing snapshot
        // when it exists, so the amount shown here is the same amount credited on
        // delivery and an Admin edit cannot move an in-flight order's earning.
        $earning = $this->deliveryFeeService->partnerEarningForOrder(
            $order,
            $serviceType,
            $customerFee,
            $this->groceryDeliveryConfig->adminFundedAmountForOrder($order),
        );

        return [
            'service_type' => $serviceType,
            'service_label' => $this->serviceTypeResolver->label($serviceType),
            'pickup' => [
                'latitude' => $pickup['latitude'],
                'longitude' => $pickup['longitude'],
                'name' => $pickup['name'],
                'address' => $pickup['address'],
            ],
            'drop' => $snapshot,
            // The partner's expected earning, NOT the customer's delivery charge.
            // Kept under the historical key so existing clients keep working, and
            // mirrored to an explicitly-named field for clarity.
            'estimated_earning' => $earning['amount'],
            'estimated_partner_earning' => $earning['amount'],
            'earning_breakdown' => $earning['breakdown'],
            'customer_delivery_fee' => $customerFee,
            'delivery_distance_km' => $deliveryDistance,
            'estimated_pickup_eta_min' => max(5, (int) round($distanceKm / 25 * 60)),
            'partner_latitude' => (float) $partner->latitude,
            'partner_longitude' => (float) $partner->longitude,
            'offered_at' => now()->toISOString(),
        ];
    }

    private function markDispatchStatus(Order $order, string $status): void
    {
        $meta = $order->meta ?? [];
        $dispatch = $meta['dispatch'] ?? [];
        $dispatch['status'] = $status;
        $dispatch['updated_at'] = now()->toISOString();
        $meta['dispatch'] = $dispatch;

        $order->update(['meta' => $meta]);
    }

    public function distanceKmBetween(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $earthRadius = 6371;
        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);
        $a = sin($dLat / 2) * sin($dLat / 2) + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) * sin($dLng / 2);
        $c = 2 * atan2(sqrt($a), sqrt(1 - $a));

        return round($earthRadius * $c, 2);
    }

    public function notifyPartnerOffer(DispatchLog $offer): void
    {
        try {
            $partner = DeliveryPartner::find($offer->candidate_id);

            if (! $partner) {
                return;
            }

            $payload = [
                'dispatch_log_id' => $offer->id,
                'order_id' => $offer->order_id,
                'distance_km' => $offer->distance_km,
                'expires_at' => $offer->expires_at?->toISOString(),
                'service_type' => $offer->meta['service_type'] ?? null,
                'service_label' => $offer->meta['service_label'] ?? null,
                'estimated_earning' => $offer->meta['estimated_earning'] ?? null,
                'estimated_partner_earning' => $offer->meta['estimated_partner_earning'] ?? ($offer->meta['estimated_earning'] ?? null),
                'earning_breakdown' => $offer->meta['earning_breakdown'] ?? null,
                'customer_delivery_fee' => $offer->meta['customer_delivery_fee'] ?? null,
                'delivery_distance_km' => $offer->meta['delivery_distance_km'] ?? null,
            ];

            if (app()->bound(RealtimeProviderInterface::class)) {
                DB::afterCommit(function () use ($offer, $payload) {
                    app(RealtimeProviderInterface::class)->broadcast(
                        $this->offerChannel($offer),
                        'delivery.offer-created',
                        $payload
                    );
                });
            }
        } catch (\Throwable $e) {
            report($e);
        }
    }

    /**
     * Announce that the partner's offer was rejected (partner declined, or the
     * offer was auto-rejected because another partner claimed the order).
     */
    public function announceOfferRejected(DispatchLog $offer): void
    {
        $this->announceOfferEvent($offer, 'delivery.offer-rejected');
    }

    /**
     * Announce that the partner's offer expired before it was answered.
     */
    public function announceOfferExpired(DispatchLog $offer): void
    {
        $this->announceOfferEvent($offer, 'delivery.offer-expired');
    }

    private function announceOfferEvent(DispatchLog $offer, string $event): void
    {
        try {
            if (! app()->bound(RealtimeProviderInterface::class)) {
                return;
            }

            DB::afterCommit(function () use ($offer, $event) {
                app(RealtimeProviderInterface::class)->broadcast(
                    $this->offerChannel($offer),
                    $event,
                    [
                        'dispatch_log_id' => $offer->id,
                        'order_id' => $offer->order_id,
                        'status' => $offer->status,
                        'sent_at' => now()->toISOString(),
                    ]
                );
            });
        } catch (\Throwable $e) {
            report($e);
        }
    }

    private function offerChannel(DispatchLog $offer): string
    {
        return 'private-delivery_partner.'.$offer->candidate_id;
    }
}
