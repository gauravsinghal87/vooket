<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PeakPeriod extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'zone_id',
        'day_of_week',
        'start_time',
        'end_time',
        'surge_multiplier',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'surge_multiplier' => 'decimal:2',
            'is_active' => 'boolean',
        ];
    }
}
