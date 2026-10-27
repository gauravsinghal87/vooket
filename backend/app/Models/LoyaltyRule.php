<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class LoyaltyRule extends Model
{
    use HasFactory;

    protected $fillable = [
        'service',
        'rule_type',
        'points_per_currency',
        'points_per_order',
        'tier_upgrade_threshold',
        'tier',
        'tier_multiplier',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'points_per_currency' => 'decimal:2',
            'tier_multiplier' => 'decimal:2',
            'is_active' => 'boolean',
        ];
    }
}
