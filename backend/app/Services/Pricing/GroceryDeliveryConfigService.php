<?php

namespace App\Services\Pricing;

use App\Models\Order;
use App\Models\Zone;
use App\Models\ZoneDeliveryConfig;

/**
 * Single resolver for the Grocery delivery configuration.
 *
 * Grocery has two independent configurations that must never be mixed:
 *
 *  - Instant Delivery reads the original `grocery_*` settings.
 *  - Scheduled Delivery reads the `grocery_scheduled_*` settings, and within
 *    that its own Free / Chargeable mode decides which subset applies.
 *
 * Food and Ride never come through here; they keep using the service-prefixed
 * settings in DeliveryFeeService directly.
 *
 * Every method accepts an optional destination zone. A saved zone configuration
 * for the combination is mandatory once the deployment has active service
 * zones; the global settings are only the bootstrap path for a fresh install
 * with no zones yet and the admin reference/backfill source.
 *
 * Everything downstream (cart, checkout, order snapshot, partner earning)
 * resolves through here, so the branch lives in exactly one place.
 */
class GroceryDeliveryConfigService
{
    public function __construct(private ZoneDeliveryConfigService $zoneConfigs) {}

    public const MODE_INSTANT = 'instant';

    public const MODE_SCHEDULED = 'scheduled';

    public const TYPE_FREE = 'free';

    public const TYPE_CHARGEABLE = 'chargeable';

    public const GROUP = 'grocery_scheduled_delivery';

    public const TYPE_KEY = 'grocery_scheduled_delivery_type';

    /**
     * Settings the customer is charged with in Scheduled Chargeable mode.
     *
     * @var array<int, string>
     */
    public const CHARGEABLE_KEYS = [
        'grocery_scheduled_delivery_fee_per_km',
        'grocery_scheduled_free_delivery_above',
        'grocery_scheduled_free_delivery_km',
        'grocery_scheduled_delivery_gst_percent',
    ];

    /**
     * Settings the platform funds with in Scheduled Chargeable mode.
     *
     * @var array<int, string>
     */
    public const CHARGEABLE_ADMIN_KEYS = [
        'grocery_scheduled_delivery_fee_paid_by_admin_per_km',
    ];

    /**
     * Free-mode settings: customer delivery is ₹0, so only the admin-funded
     * per-parcel cost and the customer-facing packaging/handling survive.
     *
     * @var array<int, string>
     */
    public const FREE_KEYS = [
        'grocery_scheduled_free_delivery_admin_fee_per_parcel',
        'grocery_scheduled_free_delivery_packaging_charge',
        'grocery_scheduled_free_delivery_handling_fee',
    ];

    /**
     * Packaging/handling are customer-facing charges, so they are stored per
     * mode to match the per-mode field groups in the admin UI.
     *
     * @var array<int, string>
     */
    public const CHARGEABLE_EXTRA_KEYS = [
        'grocery_scheduled_packaging_charge',
        'grocery_scheduled_handling_fee',
    ];

    /**
     * Every key owned by the Scheduled Delivery configuration.
     *
     * @var array<int, string>
     */
    public const SCHEDULED_KEYS = [
        self::TYPE_KEY,
        ...self::FREE_KEYS,
        ...self::CHARGEABLE_KEYS,
        ...self::CHARGEABLE_ADMIN_KEYS,
        ...self::CHARGEABLE_EXTRA_KEYS,
    ];

    /**
     * Selected Scheduled Delivery mode. A configured destination zone supplies
     * its saved type; only the no-zone bootstrap path uses the global type.
     */
    public function scheduledType(?Zone $zone = null): string
    {
        $config = $this->zoneConfigs->requireForPricing(
            $zone,
            ZoneDeliveryConfig::MODULE_GROCERY,
            ZoneDeliveryConfig::MODE_SCHEDULED
        );

        return $config['delivery_type'] === self::TYPE_FREE ? self::TYPE_FREE : self::TYPE_CHARGEABLE;
    }

    /**
     * Resolve the delivery configuration for a grocery order or cart.
     *
     * @param  string  $deliveryMode  instant|scheduled
     * @return array{
     *     delivery_mode: string,
     *     scheduled_delivery_type: string|null,
     *     per_km: float,
     *     admin_per_km: float,
     *     admin_per_parcel: float|null,
     *     free_above: float|null,
     *     free_km: float|null,
     *     gst_percent: float,
     *     packaging_charge: float,
     *     handling_fee: float,
     *     keys: array<string, string|null>
     * }
     */
    public function resolve(string $deliveryMode, ?Zone $zone = null): array
    {
        if ($deliveryMode === self::MODE_SCHEDULED) {
            return $this->scheduled($zone);
        }

        return $this->instant($zone);
    }

    /**
     * Convenience for an order: scheduled is derived from the order's own
     * frozen `delivery_mode`, falling back to `scheduled_at`.
     */
    public function resolveForOrder(Order $order): array
    {
        return $this->resolve($this->deliveryModeForOrder($order), $order->dropZone);
    }

    /**
     * Instant Delivery.
     *
     * @return array<string, mixed>
     */
    public function instant(?Zone $zone = null): array
    {
        return $this->instantFromConfig($this->zoneConfigs->requireForPricing(
            $zone,
            ZoneDeliveryConfig::MODULE_GROCERY,
            ZoneDeliveryConfig::MODE_INSTANT
        ));
    }

    /**
     * Scheduled Delivery, resolved through its saved type.
     *
     * @return array<string, mixed>
     */
    public function scheduled(?Zone $zone = null): array
    {
        $config = $this->zoneConfigs->requireForPricing(
            $zone,
            ZoneDeliveryConfig::MODULE_GROCERY,
            ZoneDeliveryConfig::MODE_SCHEDULED
        );

        return $config['delivery_type'] === self::TYPE_FREE
            ? $this->freeFromConfig($config)
            : $this->chargeableFromConfig($config);
    }

    /**
     * Map a complete zone/global configuration into the Instant delivery shape.
     *
     * @param  array<string, mixed>  $config
     * @return array<string, mixed>
     */
    private function instantFromConfig(array $config): array
    {
        return [
            'module' => ZoneDeliveryConfig::MODULE_GROCERY,
            'delivery_mode' => self::MODE_INSTANT,
            'scheduled_delivery_type' => null,
            'per_km' => (float) $config['per_km'],
            'admin_per_km' => (float) $config['admin_per_km'],
            'admin_per_parcel' => null,
            'free_above' => $config['free_above'],
            'free_km' => $config['free_km'],
            'gst_percent' => (float) $config['gst_percent'],
            'packaging_charge' => 0.0,
            'handling_fee' => 0.0,
            'partner_free_distance_earning' => (float) ($config['partner_free_distance_earning'] ?? 0),
            'keys' => $config['keys'],
            'config_source' => $config['config_source'] ?? ZoneDeliveryConfigService::SOURCE_ZONE,
            'zone_config_id' => $config['id'] ?? null,
            'zone_id' => $config['zone_id'] ?? null,
        ];
    }

    /**
     * Scheduled Free Delivery: the customer delivery charge is always ₹0. The
     * per-KM customer settings are deliberately not read at all, so no
     * instant-style fee can leak into a free scheduled order.
     *
     * @param  array<string, mixed>  $config
     * @return array<string, mixed>
     */
    private function freeFromConfig(array $config): array
    {
        return [
            'module' => ZoneDeliveryConfig::MODULE_GROCERY,
            'delivery_mode' => self::MODE_SCHEDULED,
            'scheduled_delivery_type' => self::TYPE_FREE,
            'per_km' => 0.0,
            'admin_per_km' => 0.0,
            'admin_per_parcel' => (float) ($config['admin_per_parcel'] ?? 0),
            'free_above' => null,
            'free_km' => null,
            'gst_percent' => 0.0,
            'packaging_charge' => (float) $config['packaging_charge'],
            'handling_fee' => (float) $config['handling_fee'],
            'partner_free_distance_earning' => (float) ($config['partner_free_distance_earning'] ?? 0),
            'keys' => [
                'admin_per_parcel' => $config['keys']['admin_per_parcel'] ?? null,
                'packaging_charge' => $config['keys']['packaging_charge'] ?? null,
                'handling_fee' => $config['keys']['handling_fee'] ?? null,
            ],
            'config_source' => $config['config_source'] ?? ZoneDeliveryConfigService::SOURCE_ZONE,
            'zone_config_id' => $config['id'] ?? null,
            'zone_id' => $config['zone_id'] ?? null,
        ];
    }

    /**
     * Scheduled Chargeable Delivery: same calculation model as Instant Grocery,
     * but on its own configuration values.
     *
     * @param  array<string, mixed>  $config
     * @return array<string, mixed>
     */
    private function chargeableFromConfig(array $config): array
    {
        return [
            'module' => ZoneDeliveryConfig::MODULE_GROCERY,
            'delivery_mode' => self::MODE_SCHEDULED,
            'scheduled_delivery_type' => self::TYPE_CHARGEABLE,
            'per_km' => (float) $config['per_km'],
            'admin_per_km' => (float) $config['admin_per_km'],
            'admin_per_parcel' => null,
            'free_above' => $config['free_above'],
            'free_km' => $config['free_km'],
            'gst_percent' => (float) $config['gst_percent'],
            'packaging_charge' => (float) $config['packaging_charge'],
            'handling_fee' => (float) $config['handling_fee'],
            'partner_free_distance_earning' => (float) ($config['partner_free_distance_earning'] ?? 0),
            'keys' => [
                'per_km' => $config['keys']['per_km'] ?? null,
                'admin_per_km' => $config['keys']['admin_per_km'] ?? null,
                'free_above' => $config['keys']['free_above'] ?? null,
                'free_km' => $config['keys']['free_km'] ?? null,
                'gst_percent' => $config['keys']['gst_percent'] ?? null,
                'packaging_charge' => $config['keys']['packaging_charge'] ?? null,
                'handling_fee' => $config['keys']['handling_fee'] ?? null,
            ],
            'config_source' => $config['config_source'] ?? ZoneDeliveryConfigService::SOURCE_ZONE,
            'zone_config_id' => $config['id'] ?? null,
            'zone_id' => $config['zone_id'] ?? null,
        ];
    }

    /**
     * Customer delivery charge for a resolved configuration.
     *
     * Delegates to DeliveryFeeService so scheduled chargeable uses the exact
     * same distance/threshold rules as instant grocery. Free mode short-circuits
     * to ₹0.
     *
     * @param  array<string, mixed>  $config
     */
    public function customerDeliveryFee(DeliveryFeeService $fees, array $config, float $subtotal, ?float $distanceKm): float
    {
        if (($config['scheduled_delivery_type'] ?? null) === self::TYPE_FREE) {
            return 0.0;
        }

        return $fees->calculateWithSettings([
            'per_km' => (float) $config['per_km'],
            'free_above' => $config['free_above'],
            'free_km' => $config['free_km'],
            'gst_percent' => (float) $config['gst_percent'],
        ], $subtotal, $distanceKm);
    }

    /**
     * Admin-funded delivery cost, kept strictly separate from what the customer
     * is charged. Free mode funds a flat per-parcel amount; chargeable mode
     * funds the per-KM amount over the full delivery distance.
     *
     * @param  array<string, mixed>  $config
     */
    public function adminDeliveryCost(array $config, ?float $distanceKm): float
    {
        if (($config['scheduled_delivery_type'] ?? null) === self::TYPE_FREE) {
            return round((float) $config['admin_per_parcel'], 2);
        }

        if ($distanceKm === null) {
            return 0.0;
        }

        return round((float) $config['admin_per_km'] * $distanceKm, 2);
    }

    /**
     * Whether an order is a scheduled grocery order, using the same signals as
     * DeliverySlotService so the pricing branch cannot disagree with dispatch.
     */
    public function deliveryModeForOrder(Order $order): string
    {
        $mode = $order->meta['delivery_schedule']['delivery_mode'] ?? null;

        if ($mode === self::MODE_SCHEDULED || $mode === self::MODE_INSTANT) {
            return (string) $mode;
        }

        if ($order->delivery_slot_id !== null || $order->timing_type === 'scheduled' || $order->scheduled_at !== null) {
            return self::MODE_SCHEDULED;
        }

        return self::MODE_INSTANT;
    }

    /**
     * Build the immutable order pricing snapshot stored in `meta.delivery_pricing`.
     *
     * Storing the resolved values and the setting keys they came from means a
     * later Admin change cannot retroactively alter a historical order, and the
     * partner earning can be reproduced from the order alone.
     *
     * @param  array<string, mixed>  $config
     * @return array<string, mixed>
     */
    public function snapshot(
        array $config,
        ?float $distanceKm,
        float $deliveryFee,
        float $gstPercent,
        float $gstAmount,
        float $packagingCharge,
        float $handlingFee,
        float $adminDeliveryCost,
        array $extra = []
    ): array {
        $snapshot = [
            'module' => $config['module'] ?? null,
            'delivery_mode' => $config['delivery_mode'],
            'scheduled_delivery_type' => $config['scheduled_delivery_type'],
            'distance_km' => $distanceKm,
            'customer_delivery_fee' => $deliveryFee,
            'delivery_gst_percent' => $gstPercent,
            'delivery_gst_amount' => $gstAmount,
            'packaging_charge' => $packagingCharge,
            'handling_fee' => $handlingFee,
            'admin_delivery_cost' => $adminDeliveryCost,
            'admin_delivery_cost_basis' => ($config['scheduled_delivery_type'] ?? null) === self::TYPE_FREE
                ? 'per_parcel'
                : 'per_km',
            'free_delivery_applied' => $deliveryFee <= 0.0,
            'free_delivery_reason' => $config['free_delivery_reason'] ?? null,
            'config_source' => $config['config_source'] ?? ZoneDeliveryConfigService::SOURCE_GLOBAL,
            'zone_config_id' => $config['zone_config_id'] ?? $config['id'] ?? null,
            'zone_id' => $config['zone_id'] ?? null,
            'resolved_settings' => [
                'per_km' => $config['per_km'],
                'admin_per_km' => $config['admin_per_km'],
                'admin_per_parcel' => $config['admin_per_parcel'],
                'free_above' => $config['free_above'],
                'free_km' => $config['free_km'],
                'gst_percent' => $config['gst_percent'],
                'packaging_charge' => $config['packaging_charge'],
                'handling_fee' => $config['handling_fee'],
                'partner_free_distance_earning' => $config['partner_free_distance_earning'] ?? null,
            ],
            'setting_keys' => $config['keys'],
            'resolved_at' => now()->toIso8601String(),
        ];

        return array_merge($snapshot, $extra);
    }

    /**
     * Mode-specific Admin-funded delivery cost frozen on the order at creation
     * time, used to override the standard per-km partner earning.
     *
     * Only SCHEDULED grocery orders return an amount. Scheduled Delivery has its
     * own partner-funding model (a flat per-parcel amount when configured as Free
     * Delivery, its own per-km rate when Chargeable), so that cost must win over
     * the standard rule.
     *
     * INSTANT grocery deliberately returns null: it has no separate funding
     * model, so its earning is resolved by the standard rule in
     * DeliveryFeeService::partnerEarning() — the customer's delivery fee, plus
     * the fixed free-distance guarantee, plus the Admin-funded per-km rate for
     * only the distance beyond that allowance. Without this, Instant's snapshot
     * (admin_per_km x full distance) would short-circuit that rule and leave a
     * short, free-to-the-customer grocery delivery paying almost nothing.
     *
     * Also null for a non-grocery order and for a grocery order created before
     * this configuration existed, so those orders keep their stored amounts
     * untouched.
     */
    public function adminFundedAmountForOrder(Order $order): ?float
    {
        if ($order->service_type !== null && $order->service_type !== 'grocery') {
            return null;
        }

        if ($this->deliveryModeForOrder($order) !== self::MODE_SCHEDULED) {
            return null;
        }

        $snapshot = $this->snapshotForOrder($order);

        if ($snapshot === null || ! array_key_exists('admin_delivery_cost', $snapshot)) {
            return null;
        }

        return round((float) $snapshot['admin_delivery_cost'], 2);
    }

    /**
     * The order's own frozen pricing snapshot, or null when the order predates
     * this configuration split and must keep its stored amounts untouched.
     *
     * @return array<string, mixed>|null
     */
    public function snapshotForOrder(Order $order): ?array
    {
        $snapshot = $order->meta['delivery_pricing'] ?? null;

        return is_array($snapshot) ? $snapshot : null;
    }
}
