<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;

class FareRule extends Model
{
    use HasFactory;

    /** @var array<int, string> */
    protected $fillable = [
        'vehicle_type_id',
        'zone_id',
        'city',
        'base_fare',
        'per_km',
        'per_minute',
        'minimum_fare',
        'booking_fee',
        'platform_fee',
        'tax_rate',
        'surge_multiplier_max',
        'waiting_charge_per_min',
        'cancellation_fee',
        'driver_earn_percentage',
        'is_active',
        'meta',
    ];

    /** @var array<int, string> */
    protected $appends = ['driver_commission_percent', 'waiting_fee_per_minute'];

    protected function casts(): array
    {
        return [
            'base_fare' => 'decimal:2',
            'per_km' => 'decimal:2',
            'per_minute' => 'decimal:2',
            'minimum_fare' => 'decimal:2',
            'booking_fee' => 'decimal:2',
            'platform_fee' => 'decimal:2',
            'tax_rate' => 'decimal:2',
            'surge_multiplier_max' => 'decimal:2',
            'waiting_charge_per_min' => 'decimal:2',
            'cancellation_fee' => 'decimal:2',
            'driver_earn_percentage' => 'decimal:2',
            'is_active' => 'boolean',
            'meta' => 'array',
        ];
    }

    public function vehicleType()
    {
        return $this->belongsTo(VehicleType::class);
    }

    /**
     * Platform commission is the inverse of the driver earnings share.
     * Kept as a derived, read-only value on the same schema column.
     */
    public function getDriverCommissionPercentAttribute(): float
    {
        return round(100 - (float) $this->driver_earn_percentage, 2);
    }

    /**
     * Admin-facing alias for waiting_charge_per_min (reuses the existing column).
     */
    public function getWaitingFeePerMinuteAttribute(): string
    {
        return (string) $this->waiting_charge_per_min;
    }

    /**
     * Invalidate everything that could reference a fare rule after a change.
     * The fare engine currently reads straight from the database, so this is a
     * safety net for any future caching layers.
     */
    public static function flushCaches(int $vehicleTypeId, ?string $zoneId = null): void
    {
        Cache::forget('fare_rules:all');
        Cache::forget('fare_rule:vehicle:'.$vehicleTypeId.':zone:'.($zoneId ?: 'global'));
    }
}
