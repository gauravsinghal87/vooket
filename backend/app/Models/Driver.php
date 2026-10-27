<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Driver extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'user_id',
        'vehicle_type_id',
        'status',
        'vehicle_number',
        'vehicle_model',
        'vehicle_color',
        'license_number',
        'license_expiry',
        'aadhar_number',
        'pan_number',
        'bank_account_name',
        'bank_account_number',
        'bank_ifsc',
        'bank_name',
        'latitude',
        'longitude',
        'current_zone_id',
        'heading',
        'speed',
        'accuracy',
        'last_location_at',
        'is_online',
        'is_busy',
        'is_verified',
        'verified_at',
        'rejection_reason',
        'reviewed_at',
        'documents',
        'kyc_data',
        'biometric_data',
        'rating',
        'rating_count',
        'total_trips',
        'accepted_rides',
        'rejected_rides',
    ];

    protected function casts(): array
    {
        return [
            'license_expiry' => 'date',
            'latitude' => 'decimal:7',
            'longitude' => 'decimal:7',
            'heading' => 'decimal:2',
            'speed' => 'decimal:2',
            'accuracy' => 'decimal:2',
            'last_location_at' => 'datetime',
            'is_online' => 'boolean',
            'is_busy' => 'boolean',
            'is_verified' => 'boolean',
            'verified_at' => 'datetime',
            'reviewed_at' => 'datetime',
            'documents' => 'array',
            'kyc_data' => 'array',
            'biometric_data' => 'array',
            'rating' => 'decimal:2',
        ];
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function vehicleType()
    {
        return $this->belongsTo(VehicleType::class);
    }

    public function currentZone()
    {
        return $this->belongsTo(Zone::class, 'current_zone_id');
    }

    public function vehicles()
    {
        return $this->hasMany(Vehicle::class);
    }

    public function reviews()
    {
        return $this->morphMany(Review::class, 'reviewable');
    }
}
