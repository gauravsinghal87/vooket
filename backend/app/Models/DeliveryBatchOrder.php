<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * Membership of one order in one delivery batch. Carries the stop sequence and
 * a mirror of the order status for cheap batch reads; the order itself remains
 * the single source of truth for status, OTP, payment and earnings.
 */
class DeliveryBatchOrder extends Model
{
    use HasFactory;

    protected $fillable = [
        'delivery_batch_id',
        'order_id',
        'sequence',
        'status',
        'pickup_completed_at',
        'delivered_at',
    ];

    protected function casts(): array
    {
        return [
            'sequence' => 'integer',
            'pickup_completed_at' => 'datetime',
            'delivered_at' => 'datetime',
        ];
    }

    public function batch()
    {
        return $this->belongsTo(DeliveryBatch::class, 'delivery_batch_id');
    }

    public function order()
    {
        return $this->belongsTo(Order::class);
    }
}
