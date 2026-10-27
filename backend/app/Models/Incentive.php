<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Incentive extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'apply_to',
        'type',
        'amount',
        'amount_type',
        'min_trips',
        'min_amount',
        'city_id',
        'starts_at',
        'ends_at',
        'time_start',
        'time_end',
        'is_active',
        'meta',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'min_amount' => 'decimal:2',
            'starts_at' => 'date',
            'ends_at' => 'date',
            'is_active' => 'boolean',
            'meta' => 'array',
        ];
    }
}
