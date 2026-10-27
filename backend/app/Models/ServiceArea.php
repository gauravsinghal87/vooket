<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ServiceArea extends Model
{
    use HasFactory;

    protected $fillable = [
        'zone_id',
        'name',
        'city',
        'state',
        'country',
        'latitude',
        'longitude',
        'radius_km',
        'polygon',
        'food_available',
        'grocery_available',
        'rides_available',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'latitude' => 'decimal:7',
            'longitude' => 'decimal:7',
            'radius_km' => 'decimal:2',
            'polygon' => 'array',
            'food_available' => 'boolean',
            'grocery_available' => 'boolean',
            'rides_available' => 'boolean',
            'is_active' => 'boolean',
        ];
    }

    public function zone()
    {
        return $this->belongsTo(Zone::class);
    }
}
