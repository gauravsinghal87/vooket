<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class DispatchLog extends Model
{
    use HasFactory;

    public const STATUS_SENT = 'sent';

    public const STATUS_PENDING = 'pending';

    public const STATUS_ACCEPTED = 'accepted';

    public const STATUS_REJECTED = 'rejected';

    public const STATUS_EXPIRED = 'expired';

    public const STATUS_ASSIGNED = 'assigned';

    public const CANDIDATE_TYPE_DRIVER = 'driver';

    public const CANDIDATE_TYPE_DELIVERY_PARTNER = 'delivery_partner';

    protected $fillable = [
        'dispatch_type',
        'order_id',
        'ride_id',
        'candidate_id',
        'candidate_type',
        'distance_km',
        'status',
        'expires_at',
        'meta',
    ];

    protected function casts(): array
    {
        return [
            'distance_km' => 'decimal:2',
            'meta' => 'array',
            'created_at' => 'datetime',
            'expires_at' => 'datetime',
        ];
    }

    public function order()
    {
        return $this->belongsTo(Order::class);
    }

    public function ride()
    {
        return $this->belongsTo(Ride::class);
    }

    public function deliveryPartner()
    {
        return $this->belongsTo(DeliveryPartner::class, 'candidate_id');
    }

    public function driver()
    {
        return $this->belongsTo(Driver::class, 'candidate_id');
    }

    public $timestamps = false;
}
