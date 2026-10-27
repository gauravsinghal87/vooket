<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Vehicle extends Model
{
    use HasFactory;

    protected $fillable = [
        'driver_id',
        'vehicle_type_id',
        'make',
        'model',
        'color',
        'year',
        'registration_number',
        'image',
        'documents',
        'status',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'documents' => 'array',
            'is_active' => 'boolean',
        ];
    }

    public function driver()
    {
        return $this->belongsTo(Driver::class);
    }

    public function vehicleType()
    {
        return $this->belongsTo(VehicleType::class);
    }

    public function vehicleDocuments()
    {
        return $this->hasMany(VehicleDocument::class);
    }
}
