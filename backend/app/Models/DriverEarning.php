<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class DriverEarning extends Model
{
    use HasFactory;

    public const STATUS_PENDING = 'pending';

    public const STATUS_PAID = 'paid';

    protected $fillable = [
        'driver_id',
        'ride_id',
        'trip_fare',
        'driver_percentage',
        'commission_percentage',
        'commission_amount',
        'earning_amount',
        'currency',
        'status',
        'meta',
    ];

    protected function casts(): array
    {
        return [
            'trip_fare' => 'decimal:2',
            'driver_percentage' => 'decimal:2',
            'commission_percentage' => 'decimal:2',
            'commission_amount' => 'decimal:2',
            'earning_amount' => 'decimal:2',
            'meta' => 'array',
        ];
    }

    public function driver()
    {
        return $this->belongsTo(Driver::class);
    }

    public function ride()
    {
        return $this->belongsTo(Ride::class);
    }
}
