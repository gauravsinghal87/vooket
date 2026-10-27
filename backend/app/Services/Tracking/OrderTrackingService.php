<?php

namespace App\Services\Tracking;

use App\Models\DeliveryPartner;
use App\Models\Order;
use App\Models\User;
use App\Services\Dispatch\OrderDispatchService;
use App\Services\RideService;
use Illuminate\Support\Facades\Cache;

/**
 * Server-authoritative customer/vendor/partner/admin tracking payload.
 *
 * Builds a privacy-safe snapshot for one order: caller-side ownership checks
 * happen in the controller; this service only assembles data that is safe to
 * expose. For the order's own customer it includes the assigned partner's
 * contact number so they can call their courier, but never bank/KYC data,
 * auth tokens or internal dispatch details.
 */
class OrderTrackingService
{
    /**
     * Statuses during which the partner is actively moving on a live map.
     */
    public const ACTIVE_TRACKING_STATUSES = [
        'PARTNER_ASSIGNED',
        'PICKED_UP',
        'OUT_FOR_DELIVERY',
        'ARRIVED',
    ];

    private const TERMINAL_STATUSES = ['DELIVERED', 'CANCELLED'];

    private const STAGE_PRE_PICKUP = 'to_pickup';

    private const STAGE_DELIVERY = 'to_customer';

    private const LABELS = [
        'PENDING' => 'Placed',
        'PLACED' => 'Placed',
        'ACCEPTED' => 'Accepted',
        'CONFIRMED' => 'Confirmed',
        'PREPARING' => 'Preparing',
        'PICKING' => 'Picking items',
        'PROCESSING' => 'Processing',
        'PACKED' => 'Packed & ready',
        'READY' => 'Order ready',
        'PARTNER_ASSIGNED' => 'Partner assigned',
        'PICKED_UP' => 'Picked up',
        'OUT_FOR_DELIVERY' => 'On the way',
        'ARRIVED' => 'Arrived',
        'DELIVERED' => 'Delivered',
        'CANCELLED' => 'Cancelled',
    ];

    public function __construct(
        private OrderDispatchService $dispatchService,
        private RideService $rideService,
    ) {}

    /**
     * Backend ownership policy for tracking access:
     *   - the order's customer,
     *   - an admin/super-admin for operational tracking,
     *   - the vendor whose business owns the order,
     *   - the partner currently assigned to the order.
     */
    public function canTrack(User $user, Order $order): bool
    {
        if ((int) $order->user_id === (int) $user->id) {
            return true;
        }

        if (in_array($user->user_type, ['admin', 'super_admin'], true)) {
            return true;
        }

        if ($user->user_type === 'vendor' && $order->vendor_id) {
            $vendor = $order->loadMissing('vendor')->vendor;

            return $vendor !== null && (int) $vendor->user_id === (int) $user->id;
        }

        if ($user->user_type === 'delivery_partner' && $order->delivery_partner_id) {
            $partner = DeliveryPartner::where('user_id', $user->id)->first();

            return $partner !== null && (int) $partner->id === (int) $order->delivery_partner_id;
        }

        return false;
    }

    /**
     * Full safe tracking snapshot.
     *
     * @return array<string, mixed>
     */
    public function payload(Order $order): array
    {
        $order = $order->loadMissing(['deliveryPartner.user']);
        $status = strtoupper((string) $order->status);
        $partner = $order->deliveryPartner;

        $location = $partner ? $this->locationFor($partner) : null;
        $route = $this->routeFor($order);
        $eta = $this->etaFor($order, $route);

        return [
            'order' => $this->orderSummary($order),
            'partner' => $partner ? $this->partnerSafe($partner) : null,
            'location' => $location,
            'route' => $route,
            'eta' => $eta,
            'tracking' => [
                'enabled' => ! in_array($status, self::TERMINAL_STATUSES, true),
                'in_progress' => in_array($status, self::ACTIVE_TRACKING_STATUSES, true),
                'source' => $this->realtimeConfigured() ? 'realtime' : 'polling',
                'last_updated_at' => $partner?->last_location_at?->toISOString(),
                'location_stale' => (bool) ($location['is_stale'] ?? false),
            ],
        ];
    }

    /**
     * Safe order summary used by the tracking response.
     *
     * @return array<string, mixed>
     */
    public function orderSummary(Order $order): array
    {
        $status = strtoupper((string) $order->status);
        $timestamps = [];
        foreach ([
            'confirmed_at', 'preparing_at', 'picking_at', 'packed_at', 'ready_at',
            'partner_assigned_at', 'picked_up_at', 'out_for_delivery_at', 'arrived_at',
            'delivered_at', 'cancelled_at',
        ] as $field) {
            if ($order->{$field} !== null) {
                $timestamps[$field] = $order->{$field}->toISOString();
            }
        }

        return [
            'id' => $order->id,
            'order_number' => $order->order_number,
            'service_type' => $order->order_type,
            'status' => $status,
            'status_label' => $this->statusLabel($status),
            'pickup' => $this->pickupCoordinatesFor($order),
            'dropoff' => $this->dropoffFor($order),
            'timestamps' => $timestamps,
            'cancel_reason' => $status === 'CANCELLED' ? $order->cancel_reason : null,
        ];
    }

    public function statusLabel(string $status): string
    {
        return self::LABELS[strtoupper($status)]
            ?? ucwords(strtolower(str_replace('_', ' ', $status)));
    }

    /**
     * Authorized partner contact profile for the order's customer.
     *
     * Exposes only what the customer needs to reach their assigned courier:
     * display name, contact number and vehicle info. Never bank, KYC or auth
     * data. `phone` is null when the partner has no number on file, so clients
     * can present an "unavailable" state without fabricating one.
     *
     * @return array<string, mixed>
     */
    public function partnerSafe(DeliveryPartner $partner): array
    {
        $user = $partner->user;

        return [
            'id' => $partner->id,
            'name' => $user?->name ?: 'Delivery Partner',
            'phone' => $user?->phone ?: null,
            'vehicle_type' => $partner->vehicle_type,
            'vehicle_number' => $this->maskVehicleNumber($partner->vehicle_number),
            'photo' => $user?->avatar ?: $this->profilePhoto($partner->documents),
            'rating' => $partner->rating !== null ? (float) $partner->rating : null,
        ];
    }

    /**
     * Latest partner position with explicit freshness. Stale positions keep
     * their last-known coordinates but are flagged so clients never present
     * them as live.
     *
     * @return array<string, mixed>
     */
    public function locationFor(DeliveryPartner $partner): array
    {
        $freshness = (int) config('tracking.location_freshness_seconds', 30);
        $recordedAt = $partner->last_location_at;
        $isStale = $recordedAt === null || $recordedAt->lt(now()->subSeconds($freshness));

        return [
            'lat' => $partner->latitude !== null ? (float) $partner->latitude : null,
            'lng' => $partner->longitude !== null ? (float) $partner->longitude : null,
            'heading' => $partner->heading !== null ? (float) $partner->heading : null,
            'speed' => $partner->speed !== null ? (float) $partner->speed : null,
            'accuracy' => $partner->accuracy !== null ? (float) $partner->accuracy : null,
            'recorded_at' => $recordedAt?->toISOString(),
            'is_stale' => $isStale,
        ];
    }

    /**
     * Route appropriate to the delivery stage, computed from the authoritative
     * pickup/dropoff coordinates and the partner's current position.
     *
     *   before pickup -> partner -> pickup
     *   after pickup  -> partner -> dropoff
     *
     * Route/ETA are cached (TTL = route_recalc_interval_seconds) so a small
     * marker movement never triggers a provider route recalculation.
     *
     * @return array{polyline: string|null, distance_km: float|null, duration_min: int|null, source: string|null, status: string}
     */
    public function routeFor(Order $order): array
    {
        $idle = ['polyline' => null, 'distance_km' => null, 'duration_min' => null, 'source' => null, 'status' => 'idle'];

        $order->loadMissing('deliveryPartner');
        $partner = $order->deliveryPartner;
        $status = strtoupper((string) $order->status);

        if (! $partner || $partner->latitude === null || $partner->longitude === null) {
            return $idle;
        }

        if (in_array($status, self::TERMINAL_STATUSES, true)) {
            return $idle;
        }

        $destination = $this->destinationFor($order, $status);

        if (! $destination) {
            return $idle;
        }

        $origin = ['latitude' => (float) $partner->latitude, 'longitude' => (float) $partner->longitude];
        $key = 'tracking:route:'.$order->id.':'.$destination['key'];
        $ttl = (int) config('tracking.route_recalc_interval_seconds', 30);

        try {
            return Cache::remember($key, $ttl, function () use ($origin, $destination) {
                $route = $this->rideService->directionsForRoute($origin, $destination['point']);

                return [
                    'polyline' => $route['polyline'] ?? null,
                    'distance_km' => isset($route['distance_km']) ? (float) $route['distance_km'] : null,
                    'duration_min' => isset($route['duration_min']) ? (int) $route['duration_min'] : null,
                    'source' => $route['source'] ?? null,
                    'status' => $route['status'] ?? 'OK',
                ];
            });
        } catch (\Throwable $e) {
            report($e);

            return $idle;
        }
    }

    /**
     * Backend-authoritative ETA. Uses the provider route duration when
     * available, otherwise a simple distance/speed heuristic. Returns null when
     * no ETA is meaningful (delivered, cancelled, no partner yet).
     */
    public function etaFor(Order $order, array $route): ?int
    {
        $status = strtoupper((string) $order->status);

        if (in_array($status, self::TERMINAL_STATUSES, true)) {
            return null;
        }

        if ($status === 'ARRIVED') {
            return 0;
        }

        if (! in_array($status, self::ACTIVE_TRACKING_STATUSES, true)) {
            return null;
        }

        $durationMin = $route['duration_min'] ?? null;
        if ($durationMin !== null && $durationMin >= 0) {
            return max(1, (int) $durationMin);
        }

        $order->loadMissing('deliveryPartner');
        $partner = $order->deliveryPartner;
        if (! $partner || $partner->latitude === null || $partner->longitude === null) {
            return null;
        }

        $destination = $this->destinationFor($order, $status);
        if (! $destination) {
            return null;
        }

        $speedKmh = (float) config('tracking.eta_average_speed_kmh', 25);
        $km = $this->haversineKm(
            (float) $partner->latitude,
            (float) $partner->longitude,
            $destination['point']['latitude'],
            $destination['point']['longitude']
        );

        return max(1, (int) round($km / max(1, $speedKmh) * 60));
    }

    public function realtimeConfigured(): bool
    {
        $default = config('broadcasting.default');

        return ! blank($default)
            && isset(config('broadcasting.connections')[$default])
            && $default !== 'null'
            && $default !== 'log';
    }

    /**
     * @return array{latitude: float, longitude: float, name: string, address: string|null}|null
     */
    private function pickupCoordinatesFor(Order $order): ?array
    {
        $pickup = $this->dispatchService->pickupCoordinates($order);

        if (! $pickup) {
            return null;
        }

        return [
            'latitude' => (float) $pickup['latitude'],
            'longitude' => (float) $pickup['longitude'],
            'name' => (string) $pickup['name'],
            'address' => $pickup['address'],
        ];
    }

    /**
     * @return array{latitude: float, longitude: float, address: string}|null
     */
    private function dropoffFor(Order $order): ?array
    {
        $snapshot = (array) ($order->delivery_address_snapshot ?: []);

        $latitude = $snapshot['latitude'] ?? null;
        $longitude = $snapshot['longitude'] ?? null;

        if ($latitude === null || $longitude === null) {
            $address = $order->loadMissing('address')->address;
            $latitude = $address?->latitude;
            $longitude = $address?->longitude;
        }

        $address = $snapshot['formatted_address'] ?? $this->formatAddress($snapshot);

        if ($latitude === null || $longitude === null || blank($address)) {
            return null;
        }

        return [
            'latitude' => (float) $latitude,
            'longitude' => (float) $longitude,
            'address' => (string) $address,
        ];
    }

    /**
     * Pick the authoritative route/ETA destination for the current stage, plus
     * a cache key tag.
     *
     * @return array{key: string, point: array{latitude: float, longitude: float}}|null
     */
    private function destinationFor(Order $order, string $status): ?array
    {
        $stage = in_array($status, self::ACTIVE_TRACKING_STATUSES, true)
            ? self::STAGE_DELIVERY
            : self::STAGE_PRE_PICKUP;

        $source = $stage === self::STAGE_DELIVERY
            ? $this->dropoffFor($order)
            : $this->pickupCoordinatesFor($order);

        if (! $source) {
            return null;
        }

        return [
            'key' => $stage,
            'point' => ['latitude' => (float) $source['latitude'], 'longitude' => (float) $source['longitude']],
        ];
    }

    private function formatAddress(array $snapshot): ?string
    {
        $parts = array_filter([
            $snapshot['address_line_1'] ?? null,
            $snapshot['address_line_2'] ?? null,
            $snapshot['landmark'] ?? null,
            $snapshot['city'] ?? null,
            $snapshot['state'] ?? null,
            $snapshot['postal_code'] ?? null,
        ]);

        return $parts !== [] ? implode(', ', $parts) : null;
    }

    private function maskVehicleNumber(?string $number): ?string
    {
        if (blank($number)) {
            return null;
        }

        if (strlen($number) <= 4) {
            return $number;
        }

        return str_repeat('*', strlen($number) - 4).substr($number, -4);
    }

    private function profilePhoto(?array $documents): ?string
    {
        foreach ((array) ($documents ?? []) as $document) {
            if (($document['type'] ?? null) === 'profile_photo' && ! blank($document['file_path'] ?? null)) {
                return $document['file_path'];
            }
        }

        return null;
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
