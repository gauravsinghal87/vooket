<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ReferralRule extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_type',
        'referrer_reward',
        'referee_reward',
        'reward_type',
        'min_orders_for_reward',
        'min_order_amount_threshold',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'referrer_reward' => 'decimal:2',
            'referee_reward' => 'decimal:2',
            'min_order_amount_threshold' => 'decimal:2',
            'is_active' => 'boolean',
        ];
    }
}
