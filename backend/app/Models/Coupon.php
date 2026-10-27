<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Coupon extends Model
{
    use HasFactory;

    protected $fillable = [
        'code',
        'name',
        'description',
        'type',
        'value',
        'max_discount',
        'min_order_amount',
        'service',
        'vendor_id',
        'category_ids',
        'product_ids',
        'city_ids',
        'zone_ids',
        'user_eligibility',
        'usage_limit',
        'per_user_limit',
        'payment_methods',
        'starts_at',
        'expires_at',
        'time_start',
        'time_end',
        'day_of_week',
        'first_order_only',
        'is_active',
        'status',
        'total_uses',
        'meta',
    ];

    protected function casts(): array
    {
        return [
            'value' => 'decimal:2',
            'max_discount' => 'decimal:2',
            'min_order_amount' => 'decimal:2',
            'starts_at' => 'datetime',
            'expires_at' => 'datetime',
            'first_order_only' => 'boolean',
            'is_active' => 'boolean',
            'meta' => 'array',
        ];
    }

    public function couponUsages()
    {
        return $this->hasMany(CouponUsage::class);
    }
}
