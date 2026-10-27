<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class VehicleType extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'code',
        'icon',
        'description',
        'capacity',
        'ac',
        'is_active',
        'sort_order',
        'meta',
    ];

    protected function casts(): array
    {
        return [
            'ac' => 'boolean',
            'is_active' => 'boolean',
            'meta' => 'array',
        ];
    }

    public function drivers()
    {
        return $this->hasMany(Driver::class);
    }

    public function vehicles()
    {
        return $this->hasMany(Vehicle::class);
    }

    public function fareRules()
    {
        return $this->hasMany(FareRule::class);
    }
}
