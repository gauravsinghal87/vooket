<?php

namespace App\Services\Pricing;

use App\Exceptions\DeliveryConfigurationException;
use App\Models\AppSetting;
use App\Models\Zone;
use App\Models\ZoneDeliveryConfig;

/**
 * Reads and writes the per-zone delivery configuration rows.
 *
 * This service deliberately has no dependency on the pricing calculators, which
 * in turn depend on it to resolve a zone override. It only maps a persisted row
 * (or the global app settings, for admin display/backfill) into a normalised
 * array with the same shape the calculators already use.
 *
 * Delivery pricing is MANDATORY per zone. Once a deployment has active service
 * zones, a missing or incomplete row is an error for that zone; global app
 * settings are only used for (a) admin reference values and (b) the one-time
 * backfill of existing zones, never as a customer pricing fallback. The only
 * exception is a deployment with no active zones at all (a fresh install,
 * before zones are created), which keeps the legacy bootstrap behaviour.
 */
class ZoneDeliveryConfigService
{
    public const SOURCE_ZONE = 'zone';

    public const SOURCE_GLOBAL = 'global';

    /**
     * Canonical global setting keys each field overrides. Kept in the snapshot
     * so an audited order always names the configuration it was priced with.
     *
     * @var array<string, array<string, string|null>>
     */
    private const FIELD_KEYS = [
        'food' => [
            'per_km' => 'food_delivery_fee_per_km',
            'admin_per_km' => 'food_delivery_fee_paid_by_admin_per_km',
            'free_above' => 'food_free_delivery_above',
            'free_km' => 'food_free_delivery_km',
            'gst_percent' => 'food_delivery_gst_percent',
            'partner_free_distance_earning' => 'food_partner_free_distance_earning',
            'packaging_charge' => 'food_delivery_packaging_charge',
            'handling_fee' => 'food_delivery_handling_fee',
            'admin_per_parcel' => null,
        ],
        'grocery_instant' => [
            'per_km' => 'grocery_delivery_fee_per_km',
            'admin_per_km' => 'grocery_delivery_fee_paid_by_admin_per_km',
            'free_above' => 'grocery_free_delivery_above',
            'free_km' => 'grocery_free_delivery_km',
            'gst_percent' => 'grocery_delivery_gst_percent',
            'partner_free_distance_earning' => 'grocery_partner_free_distance_earning',
            'packaging_charge' => null,
            'handling_fee' => null,
            'admin_per_parcel' => null,
        ],
        'grocery_scheduled_free' => [
            'per_km' => null,
            'admin_per_km' => null,
            'free_above' => null,
            'free_km' => null,
            'gst_percent' => null,
            'partner_free_distance_earning' => null,
            'packaging_charge' => 'grocery_scheduled_free_delivery_packaging_charge',
            'handling_fee' => 'grocery_scheduled_free_delivery_handling_fee',
            'admin_per_parcel' => 'grocery_scheduled_free_delivery_admin_fee_per_parcel',
        ],
        'grocery_scheduled_chargeable' => [
            'per_km' => 'grocery_scheduled_delivery_fee_per_km',
            'admin_per_km' => 'grocery_scheduled_delivery_fee_paid_by_admin_per_km',
            'free_above' => 'grocery_scheduled_free_delivery_above',
            'free_km' => 'grocery_scheduled_free_delivery_km',
            'gst_percent' => 'grocery_scheduled_delivery_gst_percent',
            'partner_free_distance_earning' => null,
            'packaging_charge' => 'grocery_scheduled_packaging_charge',
            'handling_fee' => 'grocery_scheduled_handling_fee',
            'admin_per_parcel' => null,
        ],
    ];

    /**
     * Resolve a zone's persisted configuration, or null when it is unconfigured.
     *
     * @return array<string, mixed>|null
     */
    public function find(?Zone $zone, string $module, string $deliveryMode): ?array
    {
        if ($zone === null) {
            return null;
        }

        $config = ZoneDeliveryConfig::query()
            ->where('zone_id', $zone->id)
            ->where('module', $module)
            ->where('delivery_mode', $deliveryMode)
            ->first();

        return $config === null ? null : $this->normalize($config);
    }

    /**
     * Raw persisted model, used by the admin API to expose saved state.
     */
    public function model(?Zone $zone, string $module, string $deliveryMode): ?ZoneDeliveryConfig
    {
        if ($zone === null) {
            return null;
        }

        return ZoneDeliveryConfig::query()
            ->where('zone_id', $zone->id)
            ->where('module', $module)
            ->where('delivery_mode', $deliveryMode)
            ->first();
    }

    /**
     * Authoritative pricing configuration for a destination.
     *
     * A non-null zone MUST have a complete saved row: there is no global or
     * other-zone fallback. A null zone is only tolerated when the deployment
     * has no active zones at all (bootstrap); otherwise the address is outside
     * the service area.
     *
     * @return array<string, mixed>
     *
     * @throws DeliveryConfigurationException
     */
    public function requireForPricing(?Zone $zone, string $module, string $deliveryMode): array
    {
        if ($zone !== null) {
            $config = $this->find($zone, $module, $deliveryMode);

            if ($config === null || ! $this->isComplete($zone, $module, $deliveryMode)) {
                throw DeliveryConfigurationException::missingForZone($zone);
            }

            return $config;
        }

        if ($this->zonesConfigured()) {
            throw DeliveryConfigurationException::outsideServiceZone();
        }

        return $this->globalValues(
            $module,
            $deliveryMode,
            $deliveryMode === ZoneDeliveryConfig::MODE_SCHEDULED
                ? $this->globalScheduledType()
                : null
        );
    }

    /**
     * Whether a zone has a complete, active row for the combination.
     *
     * Zero is a valid value; "complete" only means the required row exists and
     * a Scheduled row has a valid type (and a per-parcel amount when Free).
     */
    public function isComplete(?Zone $zone, string $module, string $deliveryMode): bool
    {
        $config = $this->model($zone, $module, $deliveryMode);

        return $config !== null && $this->rowIsComplete($config);
    }

    /**
     * True when the deployment has at least one active service zone.
     *
     * This is what separates a fresh install (no zones yet, legacy bootstrap)
     * from a live deployment where every destination must be covered by a zone.
     */
    public function zonesConfigured(): bool
    {
        return Zone::query()->where('is_active', true)->exists();
    }

    /**
     * The configured global Scheduled Delivery type, used only for admin
     * reference values and the explicit backfill.
     */
    public function globalScheduledType(): string
    {
        $value = strtolower(trim((string) AppSetting::where(
            'key',
            'grocery_scheduled_delivery_type'
        )->value('value')));

        return $value === ZoneDeliveryConfig::TYPE_FREE
            ? ZoneDeliveryConfig::TYPE_FREE
            : ZoneDeliveryConfig::TYPE_CHARGEABLE;
    }

    /**
     * Copy current global settings into every missing zone row.
     *
     * This is the explicit, repeatable rollout mechanism. It NEVER overwrites an
     * existing row (even an incomplete one), so admin edits are safe and can be
     * run more than once. Returns a summary suitable for the CLI and admin UI.
     *
     * @return array{
     *     dry_run: bool,
     *     zones: int,
     *     created: int,
     *     existing: int,
     *     incomplete_existing: int,
     *     created_configs: array<int, array<string, mixed>>
     * }
     */
    public function backfillMissingFromGlobal(bool $dryRun = false): array
    {
        $combinations = [
            [ZoneDeliveryConfig::MODULE_FOOD, ZoneDeliveryConfig::MODE_STANDARD],
            [ZoneDeliveryConfig::MODULE_GROCERY, ZoneDeliveryConfig::MODE_INSTANT],
            [ZoneDeliveryConfig::MODULE_GROCERY, ZoneDeliveryConfig::MODE_SCHEDULED],
        ];

        $zones = Zone::query()->orderBy('id')->get();
        $created = 0;
        $existing = 0;
        $incompleteExisting = 0;
        $createdConfigs = [];

        foreach ($zones as $zone) {
            foreach ($combinations as [$module, $mode]) {
                $model = $this->model($zone, $module, $mode);

                if ($model !== null) {
                    $existing++;

                    if (! $this->rowIsComplete($model)) {
                        $incompleteExisting++;
                    }

                    continue;
                }

                $type = $mode === ZoneDeliveryConfig::MODE_SCHEDULED
                    ? $this->globalScheduledType()
                    : null;
                $values = $this->globalValues($module, $mode, $type);

                if (! $dryRun) {
                    ZoneDeliveryConfig::query()->firstOrCreate(
                        [
                            'zone_id' => $zone->id,
                            'module' => $module,
                            'delivery_mode' => $mode,
                        ],
                        $this->columnValues($values)
                    );
                }

                $created++;
                $createdConfigs[] = [
                    'zone_id' => $zone->id,
                    'zone_name' => $zone->name,
                    'module' => $module,
                    'delivery_mode' => $mode,
                    'delivery_type' => $type,
                ];
            }
        }

        return [
            'dry_run' => $dryRun,
            'zones' => $zones->count(),
            'created' => $created,
            'existing' => $existing,
            'incomplete_existing' => $incompleteExisting,
            'created_configs' => $createdConfigs,
        ];
    }

    /**
     * Global values for the same module + mode. Used for admin reference values
     * and the explicit backfill only; never by customer pricing once zones exist.
     *
     * @return array<string, mixed>
     */
    public function globalValues(string $module, string $deliveryMode, ?string $deliveryType = null): array
    {
        $group = $this->fieldGroup($module, $deliveryMode, $deliveryType);
        $keys = self::FIELD_KEYS[$group];
        $settingKeys = array_values(array_filter($keys, fn (?string $key): bool => $key !== null));

        $values = $settingKeys === []
            ? collect()
            : AppSetting::whereIn('key', $settingKeys)->pluck('value', 'key');

        $number = function (string $field, float $default) use ($keys, $values): float {
            $key = $keys[$field] ?? null;

            if ($key === null) {
                return $default;
            }

            $value = $values[$key] ?? null;

            return $value === null || $value === '' ? $default : round((float) $value, 2);
        };

        $nullable = function (string $field) use ($keys, $values): ?float {
            $key = $keys[$field] ?? null;

            if ($key === null) {
                return null;
            }

            $value = $values[$key] ?? null;

            return $value === null || $value === '' ? null : round((float) $value, 2);
        };

        return [
            'id' => null,
            'zone_id' => null,
            'module' => $module,
            'delivery_mode' => $deliveryMode,
            'delivery_type' => $deliveryType,
            'per_km' => $number('per_km', $group === 'grocery_scheduled_free' ? 0.0 : 5.0),
            'admin_per_km' => $number('admin_per_km', $group === 'grocery_scheduled_free' ? 0.0 : 5.0),
            'free_above' => $nullable('free_above'),
            'free_km' => $nullable('free_km'),
            'gst_percent' => $number('gst_percent', $group === 'grocery_scheduled_free' ? 0.0 : 18.0),
            'partner_free_distance_earning' => $number('partner_free_distance_earning', 20.0),
            'packaging_charge' => $number('packaging_charge', 0.0),
            'handling_fee' => $number('handling_fee', 0.0),
            // A Free Scheduled configuration is incomplete without a per-parcel
            // admin amount, but zero is a valid amount. Only Chargeable/Food/
            // Instant leave this field empty.
            'admin_per_parcel' => $group === 'grocery_scheduled_free'
                ? $number('admin_per_parcel', 0.0)
                : null,
            'keys' => $keys,
            'source' => self::SOURCE_GLOBAL,
            'config_source' => self::SOURCE_GLOBAL,
            'updated_at' => null,
        ];
    }

    /**
     * Create or update the zone's configuration for one module + mode.
     *
     * Updates are partial: a key that is absent from $values keeps its persisted
     * value. This matters when the admin UI switches a Scheduled configuration
     * between Free and Chargeable, because each type only exposes a subset of
     * fields and the hidden fields must survive the switch. An explicit null
     * still clears a nullable column, and zero remains a valid saved value.
     *
     * @param  array<string, mixed>  $values
     */
    public function upsert(Zone $zone, string $module, string $deliveryMode, array $values): ZoneDeliveryConfig
    {
        $existing = $this->model($zone, $module, $deliveryMode);

        $columnMap = [
            'delivery_type' => 'delivery_type',
            'delivery_fee_per_km' => 'delivery_fee_per_km',
            'delivery_fee_paid_by_admin_per_km' => 'delivery_fee_paid_by_admin_per_km',
            'free_delivery_above' => 'free_delivery_above',
            'free_delivery_km' => 'free_delivery_km',
            'delivery_gst_percent' => 'delivery_gst_percent',
            'partner_free_distance_earning' => 'partner_free_distance_earning',
            'packaging_charge' => 'packaging_charge',
            'handling_fee' => 'handling_fee',
            'admin_fee_per_parcel' => 'admin_fee_per_parcel',
        ];

        $attributes = $existing === null
            ? [
                'delivery_type' => null,
                'delivery_fee_per_km' => 0,
                'delivery_fee_paid_by_admin_per_km' => 0,
                'free_delivery_above' => null,
                'free_delivery_km' => null,
                'delivery_gst_percent' => 0,
                'partner_free_distance_earning' => 0,
                'packaging_charge' => 0,
                'handling_fee' => 0,
                'admin_fee_per_parcel' => null,
            ]
            : $existing->only(array_values($columnMap));

        foreach ($columnMap as $field => $column) {
            if (! array_key_exists($field, $values)) {
                continue;
            }

            $attributes[$column] = $values[$field] === '' ? null : $values[$field];
        }

        return ZoneDeliveryConfig::updateOrCreate(
            [
                'zone_id' => $zone->id,
                'module' => $module,
                'delivery_mode' => $deliveryMode,
            ],
            $attributes
        );
    }

    /**
     * Remove a zone configuration. Pricing for the zone then fails with an
     * actionable "setup required" error until a new configuration is saved.
     */
    public function remove(Zone $zone, string $module, string $deliveryMode): bool
    {
        return ZoneDeliveryConfig::query()
            ->where('zone_id', $zone->id)
            ->where('module', $module)
            ->where('delivery_mode', $deliveryMode)
            ->delete() > 0;
    }

    /**
     * Convert a pricing-shaped configuration into the editable field names used
     * by the admin form and the save endpoint.
     *
     * The pricing calculators use short aliases (`per_km`, `gst_percent`, ...)
     * while the database columns and save payload use the explicit names
     * (`delivery_fee_per_km`, `delivery_gst_percent`, ...). The admin API must
     * expose the latter so a saved row can be loaded back without a second,
     * incompatible mapping in the browser.
     *
     * @param  array<string, mixed>  $values
     * @return array<string, mixed>
     */
    public function adminValues(array $values): array
    {
        return [
            'delivery_type' => $values['delivery_type'] ?? null,
            'delivery_fee_per_km' => (float) ($values['per_km'] ?? 0),
            'delivery_fee_paid_by_admin_per_km' => (float) ($values['admin_per_km'] ?? 0),
            'free_delivery_above' => ($values['free_above'] ?? null) === null
                ? null
                : (float) $values['free_above'],
            'free_delivery_km' => ($values['free_km'] ?? null) === null
                ? null
                : (float) $values['free_km'],
            'delivery_gst_percent' => (float) ($values['gst_percent'] ?? 0),
            'partner_free_distance_earning' => (float) ($values['partner_free_distance_earning'] ?? 0),
            'packaging_charge' => (float) ($values['packaging_charge'] ?? 0),
            'handling_fee' => (float) ($values['handling_fee'] ?? 0),
            'admin_fee_per_parcel' => ($values['admin_per_parcel'] ?? null) === null
                ? null
                : (float) $values['admin_per_parcel'],
        ];
    }

    /**
     * Admin-facing view of every combination for a zone.
     *
     * @return array<string, array<string, mixed>>
     */
    public function adminSnapshot(Zone $zone): array
    {
        $combinations = [
            'food' => [ZoneDeliveryConfig::MODULE_FOOD, ZoneDeliveryConfig::MODE_STANDARD, null],
            'grocery_instant' => [ZoneDeliveryConfig::MODULE_GROCERY, ZoneDeliveryConfig::MODE_INSTANT, null],
            'grocery_scheduled' => [
                ZoneDeliveryConfig::MODULE_GROCERY,
                ZoneDeliveryConfig::MODE_SCHEDULED,
                $this->savedScheduledType($zone),
            ],
        ];

        $snapshot = [];

        foreach ($combinations as $key => [$module, $mode, $type]) {
            $saved = $this->find($zone, $module, $mode);
            $model = $this->model($zone, $module, $mode);
            $effectiveType = $model?->delivery_type === ZoneDeliveryConfig::TYPE_FREE
                ? ZoneDeliveryConfig::TYPE_FREE
                : $type;
            $global = $this->globalValues($module, $mode, $effectiveType);

            $snapshot[$key] = [
                'module' => $module,
                'delivery_mode' => $mode,
                'configured' => $model !== null && $this->rowIsComplete($model),
                'saved' => $model !== null,
                'values' => $this->adminValues($saved ?? $global),
                'global' => $this->adminValues($global),
                'updated_at' => $model?->updated_at?->toIso8601String(),
            ];
        }

        return $snapshot;
    }

    /**
     * The saved Scheduled Delivery type for a zone. When the zone has no saved
     * row, the global reference type is shown so the admin form starts from the
     * same mode the backfill would use.
     */
    public function savedScheduledType(Zone $zone): string
    {
        $config = $this->model($zone, ZoneDeliveryConfig::MODULE_GROCERY, ZoneDeliveryConfig::MODE_SCHEDULED);

        if ($config === null) {
            return $this->globalScheduledType();
        }

        return $config->delivery_type === ZoneDeliveryConfig::TYPE_FREE
            ? ZoneDeliveryConfig::TYPE_FREE
            : ZoneDeliveryConfig::TYPE_CHARGEABLE;
    }

    /**
     * @return array<string, mixed>
     */
    private function normalize(ZoneDeliveryConfig $config): array
    {
        $type = $config->delivery_type === ZoneDeliveryConfig::TYPE_FREE
            ? ZoneDeliveryConfig::TYPE_FREE
            : ($config->delivery_mode === ZoneDeliveryConfig::MODE_SCHEDULED
                ? ZoneDeliveryConfig::TYPE_CHARGEABLE
                : null);

        $keys = self::FIELD_KEYS[$this->fieldGroup(
            $config->module,
            $config->delivery_mode,
            $type
        )];

        return [
            'id' => $config->id,
            'zone_id' => $config->zone_id,
            'module' => $config->module,
            'delivery_mode' => $config->delivery_mode,
            'delivery_type' => $type,
            'per_km' => (float) $config->delivery_fee_per_km,
            'admin_per_km' => (float) $config->delivery_fee_paid_by_admin_per_km,
            'free_above' => $config->free_delivery_above === null ? null : (float) $config->free_delivery_above,
            'free_km' => $config->free_delivery_km === null ? null : (float) $config->free_delivery_km,
            'gst_percent' => (float) $config->delivery_gst_percent,
            'partner_free_distance_earning' => (float) $config->partner_free_distance_earning,
            'packaging_charge' => (float) $config->packaging_charge,
            'handling_fee' => (float) $config->handling_fee,
            'admin_per_parcel' => $config->admin_fee_per_parcel === null
                ? null
                : (float) $config->admin_fee_per_parcel,
            'keys' => $keys,
            'source' => self::SOURCE_ZONE,
            'config_source' => self::SOURCE_ZONE,
            'updated_at' => $config->updated_at?->toIso8601String(),
        ];
    }

    /**
     * A persisted row is complete when all fields required by its delivery
     * mode are present. Zero values are explicitly valid.
     */
    private function rowIsComplete(ZoneDeliveryConfig $config): bool
    {
        if ($config->delivery_mode !== ZoneDeliveryConfig::MODE_SCHEDULED) {
            return true;
        }

        if (! in_array($config->delivery_type, [
            ZoneDeliveryConfig::TYPE_FREE,
            ZoneDeliveryConfig::TYPE_CHARGEABLE,
        ], true)) {
            return false;
        }

        return $config->delivery_type !== ZoneDeliveryConfig::TYPE_FREE
            || $config->admin_fee_per_parcel !== null;
    }

    /**
     * Map a normalised configuration array back onto the persistence columns.
     *
     * @param  array<string, mixed>  $values
     * @return array<string, mixed>
     */
    private function columnValues(array $values): array
    {
        return [
            'delivery_type' => $values['delivery_type'] ?? null,
            'delivery_fee_per_km' => $values['per_km'] ?? 0,
            'delivery_fee_paid_by_admin_per_km' => $values['admin_per_km'] ?? 0,
            'free_delivery_above' => $values['free_above'] ?? null,
            'free_delivery_km' => $values['free_km'] ?? null,
            'delivery_gst_percent' => $values['gst_percent'] ?? 0,
            'partner_free_distance_earning' => $values['partner_free_distance_earning'] ?? 0,
            'packaging_charge' => $values['packaging_charge'] ?? 0,
            'handling_fee' => $values['handling_fee'] ?? 0,
            'admin_fee_per_parcel' => $values['admin_per_parcel'] ?? null,
        ];
    }

    private function fieldGroup(string $module, string $deliveryMode, ?string $deliveryType): string
    {
        if ($module === ZoneDeliveryConfig::MODULE_FOOD) {
            return 'food';
        }

        if ($deliveryMode === ZoneDeliveryConfig::MODE_SCHEDULED) {
            return $deliveryType === ZoneDeliveryConfig::TYPE_FREE
                ? 'grocery_scheduled_free'
                : 'grocery_scheduled_chargeable';
        }

        return 'grocery_instant';
    }
}
