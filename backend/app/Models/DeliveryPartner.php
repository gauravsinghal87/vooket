<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class DeliveryPartner extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'user_id',
        'status',
        'service_type',
        'vehicle_type',
        'vehicle_number',
        'vehicle_model',
        'vehicle_color',
        'license_number',
        'license_expiry',
        'aadhar_number',
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
        'active_batch_order_count',
        'rejection_reason',
        'reviewed_at',
        'documents',
        'kyc_data',
        'rating',
        'rating_count',
        'total_deliveries',
        'total_earnings',
        'accepted_orders',
        'rejected_orders',
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
            'active_batch_order_count' => 'integer',
            'reviewed_at' => 'datetime',
            'documents' => 'array',
            'kyc_data' => 'array',
            'rating' => 'decimal:2',
            'total_earnings' => 'decimal:2',
        ];
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function currentZone()
    {
        return $this->belongsTo(Zone::class, 'current_zone_id');
    }

    public function reviews()
    {
        return $this->morphMany(Review::class, 'reviewable');
    }

    /**
     * The partner's current trip, if any. `active_flag` is 1 while open and
     * NULL once closed, so the unique index keeps this to at most one batch.
     */
    public function activeBatch()
    {
        return $this->hasOne(DeliveryBatch::class, 'delivery_partner_id')
            ->where('status', DeliveryBatch::STATUS_ACTIVE)
            ->latestOfMany('id');
    }

    public function deliveryBatches()
    {
        return $this->hasMany(DeliveryBatch::class, 'delivery_partner_id');
    }
}
