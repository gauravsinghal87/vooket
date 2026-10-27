<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class DeliveryFeeRule extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'service',
        'base_fee',
        'per_km',
        'peak_fee',
        'surge_multiplier',
        'weather_surcharge',
        'small_order_fee',
        'min_order_for_free_delivery',
        'platform_fee',
        'zone_id',
        'city',
        'peak_hour_start',
        'peak_hour_end',
        'peak_days',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'base_fee' => 'decimal:2',
            'per_km' => 'decimal:2',
            'peak_fee' => 'decimal:2',
            'surge_multiplier' => 'decimal:2',
            'weather_surcharge' => 'decimal:2',
            'small_order_fee' => 'decimal:2',
            'min_order_for_free_delivery' => 'decimal:2',
            'platform_fee' => 'decimal:2',
            'is_active' => 'boolean',
        ];
    }
}
