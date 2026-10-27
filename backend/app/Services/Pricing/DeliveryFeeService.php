<?php

namespace App\Services\Pricing;

use App\Models\Order;
use App\Models\Zone;
use App\Models\ZoneDeliveryConfig;
use App\Support\Money;

class DeliveryFeeService
{
    public const SERVICE_FOOD = 'food';

    public const SERVICE_GROCERY = 'grocery';

    public function __construct(private ZoneDeliveryConfigService $zoneConfigs) {}

    /**
     * Service-specific delivery settings sourced from the destination zone.
     *
     * There is no customer base delivery fee: the charge is purely
     * distance-based. Partner earnings are configured separately through
     * partnerRate() and are unaffected by this structure.
     *
     * A live deployment MUST have a complete row for the zone. The global
     * settings are only used by the bootstrap path when no active zones exist
     * at all; they are never a per-zone fallback.
     *
     * @return array{per_km: float, free_above: float|null, gst_percent: float, free_km: float|null}
     */
    public function settings(string $service, ?Zone $zone = null): array
    {
        $zoneConfig = $this->zoneConfigs->requireForPricing(
            $zone,
            $this->moduleForService($service),
            ZoneDeliveryConfig::modeForModule($this->moduleForService($service))
        );

        return [
            'per_km' => (float) $zoneConfig['per_km'],
            'free_above' => $zoneConfig['free_above'],
            'gst_percent' => (float) $zoneConfig['gst_percent'],
            'free_km' => $zoneConfig['free_km'],
        ];
    }

    /**
     * Customer delivery fee for a service, subtotal and delivery distance.
     *
     * Two independent rules can make delivery free:
     *  1. the subtotal reaches the free-delivery-above threshold, or
     *  2. the distance falls within the "Free Delivery Within" allowance.
     *
     * "Free Delivery Within (KM)" is a free distance ALLOWANCE, not a
     * threshold: the first N km are free and only the distance beyond N is
     * chargeable. There is no base fee component.
     *
     *   chargeable_km = max(0, distance_km - free_delivery_km)
     *   delivery_fee  = chargeable_km * delivery_fee_per_km
     *
     * Computed in integer paise so the money result cannot drift.
     */
    public function calculate(string $service, float $subtotal, ?float $distanceKm, ?Zone $zone = null): float
    {
        return $this->calculateWithSettings($this->settings($service, $zone), $subtotal, $distanceKm);
    }

    /**
     * Customer delivery fee for an already-resolved settings array.
     *
     * The rules are identical to calculate(); this only removes the
     * service-prefixed lookup so Grocery can pass its own Instant or Scheduled
     * configuration through the exact same calculation instead of
     * reimplementing it.
     *
     * @param  array{per_km: float, free_above: float|null, gst_percent: float, free_km: float|null}  $settings
     */
    public function calculateWithSettings(array $settings, float $subtotal, ?float $distanceKm): float
    {
        return $this->explainWithSettings($settings, $subtotal, $distanceKm)['fee'];
    }

    /**
     * Same calculation as calculateWithSettings(), with the pricing decision
     * exposed so an order can snapshot WHY a delivery was free (subtotal
     * threshold vs. free-distance allowance).
     *
     * @param  array{per_km: float, free_above: float|null, gst_percent: float, free_km: float|null}  $settings
     * @return array{fee: float, free: bool, reason: string|null}
     */
    public function explainWithSettings(array $settings, float $subtotal, ?float $distanceKm): array
    {
        if ($settings['free_above'] !== null && $subtotal >= $settings['free_above']) {
            return ['fee' => 0.0, 'free' => true, 'reason' => 'subtotal_threshold'];
        }

        // Distance is unknown, so there is nothing chargeable.
        if ($distanceKm === null) {
            return ['fee' => 0.0, 'free' => false, 'reason' => null];
        }

        $freeKm = $settings['free_km'];

        if ($freeKm !== null && $distanceKm <= $freeKm) {
            return ['fee' => 0.0, 'free' => true, 'reason' => 'distance_allowance'];
        }

        $chargeableKm = $freeKm !== null ? $distanceKm - $freeKm : $distanceKm;

        if ($chargeableKm <= 0) {
            return ['fee' => 0.0, 'free' => true, 'reason' => 'distance_allowance'];
        }

        $feePaise = (int) round($chargeableKm * Money::fromMajor($settings['per_km'])->paise());

        return ['fee' => $feePaise / 100, 'free' => false, 'reason' => null];
    }

    /**
     * Great-circle distance between two coordinates in kilometres, or null when
     * any coordinate is missing.
     *
     * @return float|null
     */
    public function distanceKm(?float $lat1, ?float $lng1, ?float $lat2, ?float $lng2)
    {
        if ($lat1 === null || $lng1 === null || $lat2 === null || $lng2 === null) {
            return null;
        }

        $earthRadius = 6371;
        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);
        $a = sin($dLat / 2) * sin($dLat / 2) + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) * sin($dLng / 2);
        $c = 2 * atan2(sqrt($a), sqrt(1 - $a));

        return round($earthRadius * $c, 2);
    }

    /**
     * Delivery-partner payout rate for a service, sourced from dedicated
     * partner settings. Returns base and per-km amounts keyed per service;
     * unconfigured services fall back to the food defaults while groceries
     * keep the legacy customer-fee-based payout in DeliveryService.
     *
     * @return array{base: float, per_km: float}
     */
    /**
     * Vendor-to-drop delivery distance for an order, in km, or null when either
     * endpoint is missing.
     *
     * This is the authoritative distance for partner earnings, and is
     * deliberately distinct from the partner-to-pickup distance stored on a
     * dispatch offer.
     */
    public function orderDeliveryDistanceKm(Order $order): ?float
    {
        $snapshot = $order->delivery_address_snapshot;
        $snapshot = is_array($snapshot)
            ? $snapshot
            : (is_string($snapshot) ? (json_decode($snapshot, true) ?: []) : []);

        return $this->distanceKm(
            $order->vendor?->latitude !== null ? (float) $order->vendor->latitude : null,
            $order->vendor?->longitude !== null ? (float) $order->vendor->longitude : null,
            isset($snapshot['latitude']) && $snapshot['latitude'] !== null ? (float) $snapshot['latitude'] : null,
            isset($snapshot['longitude']) && $snapshot['longitude'] !== null ? (float) $snapshot['longitude'] : null,
        );
    }

    /**
     * Authoritative partner earning for a service, given the vendor-to-drop
     * delivery distance.
     *
     *   additional_km = max(0, distance_km - free_delivery_km)
     *   amount        = customer_delivery_fee
     *                 + partner_free_distance_earning
     *                 + (additional_km * <service>_delivery_fee_paid_by_admin_per_km)
     *
     * There is no partner base fee. The three components are deliberately
     * separate:
     *
     *  - the customer delivery fee is handed to the partner in full, because it
     *    was already collected from the customer;
     *  - `partner_free_distance_earning` is a FIXED guarantee for the customer's
     *    free-delivery allowance. It is never pro-rated against the actual
     *    distance, so a 0.57 km drop inside a 2 km free allowance still pays the
     *    full configured amount instead of a near-zero distance product. A free
     *    customer delivery therefore never means a zero partner earning;
     *  - the Admin-funded per-km rate pays ONLY for the distance beyond the free
     *    allowance, so the first `free_delivery_km` are never funded twice.
     *
     * When the distance is unknown the customer delivery fee is the safest
     * fallback, since no distance-based component can be computed.
     *
     * Shared by the dispatch offer (what the partner is shown before accepting)
     * and delivery finalisation (what they are actually credited), so both
     * always agree.
     *
     * @param  float|null  $adminFundedAmount  Admin-funded delivery cost taken
     *                                         from the order's own frozen
     *                                         pricing snapshot, when present.
     *                                         Short-circuits the per-km rule for
     *                                         Scheduled Grocery Delivery, whose
     *                                         funding is resolved per delivery
     *                                         mode and must not be mixed with the
     *                                         Instant free-distance rule. Null
     *                                         keeps the per-km behaviour.
     * @return array{amount: float, breakdown: array}
     */
    public function partnerEarning(string $service, ?float $distanceKm, float $customerFee = 0.0, ?float $adminFundedAmount = null, ?Zone $zone = null): array
    {
        return $this->computePartnerEarning($service, $distanceKm, $customerFee, $adminFundedAmount, $zone, null);
    }

    /**
     * Partner earning for a placed order.
     *
     * Every new order freezes the resolved partner rate in its own pricing
     * snapshot, so adding or editing a zone configuration after the order was
     * placed can never change what that order already earned. Orders created
     * before the snapshot existed fall back to the live zone/global rate.
     *
     * @return array{amount: float, breakdown: array}
     */
    public function partnerEarningForOrder(Order $order, string $service, float $customerFee, ?float $adminFundedAmount = null): array
    {
        $snapshot = $order->meta['delivery_pricing'] ?? null;
        $snapshotModule = is_array($snapshot) ? ($snapshot['module'] ?? null) : null;
        $serviceModule = $service === self::SERVICE_GROCERY
            ? ZoneDeliveryConfig::MODULE_GROCERY
            : ZoneDeliveryConfig::MODULE_FOOD;

        // Freeze the rate the order was priced with, whether it came from the
        // zone that priced the order or the no-zone bootstrap configuration.
        // Requiring the snapshot module to match the requested service keeps a
        // malformed/mutated order from applying, say, a Food rate to a Grocery
        // earning.
        $rate = $snapshotModule === $serviceModule && is_array($snapshot['partner_rate'] ?? null)
                ? $snapshot['partner_rate']
                : null;

        // Orders created before the frozen rate existed keep their previous
        // global-setting behaviour. They must not start throwing just because
        // the deployment now requires per-zone configurations.
        $rate ??= $this->globalPartnerRate($service);

        return $this->computePartnerEarning(
            $service,
            $this->orderDeliveryDistanceKm($order),
            $customerFee,
            $adminFundedAmount,
            $order->dropZone,
            $rate
        );
    }

    /**
     * @param  array<string, mixed>|null  $rateOverride
     * @return array{amount: float, breakdown: array}
     */
    private function computePartnerEarning(
        string $service,
        ?float $distanceKm,
        float $customerFee,
        ?float $adminFundedAmount,
        ?Zone $zone,
        ?array $rateOverride
    ): array {
        $customerFee = round($customerFee, 2);
        $breakdown = [
            'service' => $service,
            'customer_delivery_fee' => $customerFee,
        ];

        if ($adminFundedAmount !== null) {
            $amount = round($customerFee + $adminFundedAmount, 2);

            $breakdown['basis'] = 'customer_delivery_fee_plus_admin_funded_amount';
            $breakdown['distance_km'] = $distanceKm;
            $breakdown['distance_earning'] = round($adminFundedAmount, 2);
            $breakdown['platform_funded'] = round($adminFundedAmount, 2);

            return ['amount' => $amount, 'breakdown' => $breakdown];
        }

        if ($distanceKm === null) {
            $breakdown['basis'] = 'customer_delivery_fee_distance_unavailable';

            return ['amount' => $customerFee, 'breakdown' => $breakdown];
        }

        $rate = $rateOverride ?? $this->partnerRate($service, $zone);

        // The free-delivery allowance guarantees the partner a fixed earning for
        // the first F km, and the Admin-funded per-km rate only pays for the
        // distance BEYOND that allowance. Charging the per-km rate across the whole
        // distance as well would pay the first F km twice.
        $freeDistanceKm = $rate['free_distance_km'];
        $additionalKm = $freeDistanceKm === null
            ? $distanceKm
            : round(max(0.0, $distanceKm - $freeDistanceKm), 4);

        $firstDistanceEarning = round($rate['free_distance_earning'], 2);
        $additionalEarning = round($additionalKm * $rate['per_km'], 2);
        $amount = round($customerFee + $firstDistanceEarning + $additionalEarning, 2);

        $breakdown['basis'] = 'customer_delivery_fee_plus_free_distance_earning';
        $breakdown['per_km'] = $rate['per_km'];
        // Snapshot the setting key actually used, so a later admin change to the
        // rate can never retroactively alter how this earning was computed.
        $breakdown['per_km_key'] = $rate['per_km_key'] ?? null;
        $breakdown['free_distance_km'] = $freeDistanceKm;
        $breakdown['first_distance_earning'] = $firstDistanceEarning;
        $breakdown['first_distance_earning_key'] = $rate['free_distance_earning_key'] ?? null;
        $breakdown['distance_km'] = $distanceKm;
        $breakdown['additional_distance_km'] = $additionalKm;
        $breakdown['additional_admin_earning'] = $additionalEarning;
        // Both the guaranteed free-distance earning and the Admin-funded distance
        // beyond it are subsidised by the platform; the customer delivery fee was
        // already collected from the customer.
        $breakdown['platform_funded'] = round($firstDistanceEarning + $additionalEarning, 2);

        return ['amount' => $amount, 'breakdown' => $breakdown];
    }

    /**
     * The configuration bundle a partner earning is resolved from.
     *
     * Holds the Admin-funded per-km rate, the customer's free-delivery distance
     * that bounds it, and the fixed guarantee paid for that free distance.
     *
     * @return array{per_km: float, per_km_key: string|null, free_distance_km: float|null, free_distance_earning: float, free_distance_earning_key: string|null}
     */
    public function partnerRate(string $service, ?Zone $zone = null): array
    {
        $module = $this->moduleForService($service);
        $zoneConfig = $this->zoneConfigs->requireForPricing(
            $zone,
            $module,
            ZoneDeliveryConfig::modeForModule($module)
        );

        return $this->partnerRateFromConfig($zoneConfig);
    }

    /**
     * Legacy global rate for orders created before pricing snapshots existed.
     *
     * This intentionally does not consult the destination zone. It preserves the
     * pre-zone behaviour for historical earnings while new orders always freeze
     * their zone rate in the order snapshot.
     *
     * @return array{per_km: float, per_km_key: string|null, free_distance_km: float|null, free_distance_earning: float, free_distance_earning_key: string|null}
     */
    private function globalPartnerRate(string $service): array
    {
        $module = $this->moduleForService($service);

        return $this->partnerRateFromConfig(
            $this->zoneConfigs->globalValues(
                $module,
                ZoneDeliveryConfig::modeForModule($module)
            )
        );
    }

    /**
     * @param  array<string, mixed>  $zoneConfig
     * @return array{per_km: float, per_km_key: string|null, free_distance_km: float|null, free_distance_earning: float, free_distance_earning_key: string|null}
     */
    private function partnerRateFromConfig(array $zoneConfig): array
    {
        return [
            'per_km' => (float) $zoneConfig['admin_per_km'],
            'per_km_key' => $zoneConfig['keys']['admin_per_km'],
            'free_distance_km' => $zoneConfig['free_km'],
            'free_distance_earning' => (float) $zoneConfig['partner_free_distance_earning'],
            'free_distance_earning_key' => $zoneConfig['keys']['partner_free_distance_earning'],
        ];
    }

    /**
     * Configured flat customer-facing charges for a service.
     *
     * Packaging and handling are additional line items on top of the distance
     * delivery fee: they do not take part in the distance, free-distance,
     * free-above or GST rules, and they are never funded by the platform.
     *
     * Only Food has these keys today (food_delivery_packaging_charge and
     * food_delivery_handling_fee). Grocery resolves its packaging and handling
     * per delivery mode through GroceryDeliveryConfigService, and Ride has no
     * such charges, so both stay at zero here and keep their own architecture.
     *
     * A missing or blank setting means no charge, which is the state every
     * existing Food order was created in.
     *
     * @return array{packaging_charge: float, handling_fee: float}
     */
    public function serviceCharges(string $service, ?Zone $zone = null): array
    {
        if ($service !== self::SERVICE_FOOD) {
            return ['packaging_charge' => 0.0, 'handling_fee' => 0.0];
        }

        $zoneConfig = $this->zoneConfigs->requireForPricing(
            $zone,
            ZoneDeliveryConfig::MODULE_FOOD,
            ZoneDeliveryConfig::MODE_STANDARD
        );

        return [
            'packaging_charge' => (float) $zoneConfig['packaging_charge'],
            'handling_fee' => (float) $zoneConfig['handling_fee'],
        ];
    }

    /**
     * Configured delivery GST percentage for a service, defaulting to 18.
     */
    public function gstPercent(string $service, ?Zone $zone = null): float
    {
        return round((float) $this->settings($service, $zone)['gst_percent'], 2);
    }

    /**
     * Delivery GST charged on top of the delivery fee for a service. A zero
     * delivery fee never incurs GST.
     */
    public function gstAmount(string $service, float $fee, ?Zone $zone = null): float
    {
        return round($fee * $this->gstPercent($service, $zone) / 100, 2);
    }

    private function moduleForService(string $service): string
    {
        return $service === self::SERVICE_GROCERY
            ? ZoneDeliveryConfig::MODULE_GROCERY
            : ZoneDeliveryConfig::MODULE_FOOD;
    }
}
