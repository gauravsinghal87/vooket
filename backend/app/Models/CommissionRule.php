<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CommissionRule extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'service',
        'applicable_to',
        'type',
        'percentage_rate',
        'fixed_amount',
        'min_amount',
        'max_amount',
        'vendor_id',
        'category_id',
        'city_id',
        'zone_id',
        'vehicle_type_id',
        'effective_from',
        'effective_to',
        'is_active',
        'priority',
        'meta',
    ];

    protected function casts(): array
    {
        return [
            'percentage_rate' => 'decimal:2',
            'fixed_amount' => 'decimal:2',
            'min_amount' => 'decimal:2',
            'max_amount' => 'decimal:2',
            'effective_from' => 'date',
            'effective_to' => 'date',
            'is_active' => 'boolean',
            'meta' => 'array',
        ];
    }
}
