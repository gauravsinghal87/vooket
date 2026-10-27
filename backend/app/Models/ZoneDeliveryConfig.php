<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One zone's delivery configuration for a single module + delivery mode.
 *
 * A persisted row is authoritative for that zone. When a deployment has active
 * service zones, a missing row means the combination is not configured and
 * customer pricing fails with an actionable error; global `app_settings` values
 * are only a reference/backfill source, never a live per-zone fallback.
 */
class ZoneDeliveryConfig extends Model
{
    use HasFactory;

    public const MODULE_FOOD = 'food';

    public const MODULE_GROCERY = 'grocery';

    /** Food has one delivery configuration; there is no Free/Chargeable split. */
    public const MODE_STANDARD = 'standard';

    public const MODE_INSTANT = 'instant';

    public const MODE_SCHEDULED = 'scheduled';

    public const TYPE_FREE = 'free';

    public const TYPE_CHARGEABLE = 'chargeable';

    /** @var array<int, string> */
    public const MODULES = [self::MODULE_FOOD, self::MODULE_GROCERY];

    /** @var array<int, string> */
    public const MODES = [self::MODE_STANDARD, self::MODE_INSTANT, self::MODE_SCHEDULED];

    protected $fillable = [
        'zone_id',
        'module',
        'delivery_mode',
        'delivery_type',
        'delivery_fee_per_km',
        'delivery_fee_paid_by_admin_per_km',
        'free_delivery_above',
        'free_delivery_km',
        'delivery_gst_percent',
        'partner_free_distance_earning',
        'packaging_charge',
        'handling_fee',
        'admin_fee_per_parcel',
    ];

    protected function casts(): array
    {
        return [
            'delivery_fee_per_km' => 'decimal:2',
            'delivery_fee_paid_by_admin_per_km' => 'decimal:2',
            'free_delivery_above' => 'decimal:2',
            'free_delivery_km' => 'decimal:2',
            'delivery_gst_percent' => 'decimal:2',
            'partner_free_distance_earning' => 'decimal:2',
            'packaging_charge' => 'decimal:2',
            'handling_fee' => 'decimal:2',
            'admin_fee_per_parcel' => 'decimal:2',
        ];
    }

    public function zone(): BelongsTo
    {
        return $this->belongsTo(Zone::class);
    }

    /**
     * The delivery mode a module uses for its single/base configuration.
     */
    public static function modeForModule(string $module): string
    {
        return $module === self::MODULE_FOOD ? self::MODE_STANDARD : self::MODE_INSTANT;
    }
}
