<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class DeliveryBatch extends Model
{
    use HasFactory;

    public const STATUS_ACTIVE = 'active';

    public const STATUS_COMPLETED = 'completed';

    public const STATUS_CANCELLED = 'cancelled';

    protected $fillable = [
        'delivery_partner_id',
        'order_type',
        'status',
        'batch_number',
        'window_start',
        'window_end',
        'delivery_slot_id',
        'stop_count',
        'active_flag',
        'route',
        'started_at',
        'completed_at',
        'cancelled_at',
    ];

    protected function casts(): array
    {
        return [
            'window_start' => 'datetime',
            'window_end' => 'datetime',
            'stop_count' => 'integer',
            'route' => 'array',
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
            'cancelled_at' => 'datetime',
        ];
    }

    public function deliveryPartner()
    {
        return $this->belongsTo(DeliveryPartner::class);
    }

    public function deliverySlot()
    {
        return $this->belongsTo(DeliverySlot::class);
    }

    public function orders()
    {
        return $this->belongsToMany(Order::class, 'delivery_batch_orders', 'delivery_batch_id', 'order_id')
            ->withPivot(['sequence', 'status', 'pickup_completed_at', 'delivered_at'])
            ->withTimestamps()
            ->orderBy('delivery_batch_orders.sequence');
    }

    public function batchOrders()
    {
        return $this->hasMany(DeliveryBatchOrder::class, 'delivery_batch_id')
            ->orderBy('sequence');
    }

    public function isActive(): bool
    {
        return $this->status === self::STATUS_ACTIVE;
    }

    /**
     * Close the batch and release the per-partner active slot. Idempotent.
     */
    public function close(string $status = self::STATUS_COMPLETED): void
    {
        $this->status = $status;
        $this->active_flag = null;
        $this->completed_at = now();

        if ($status === self::STATUS_CANCELLED) {
            $this->cancelled_at = now();
        }

        $this->save();
    }
}
