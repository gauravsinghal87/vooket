<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class DeliveryPartnerEarning extends Model
{
    use HasFactory;

    protected $fillable = [
        'delivery_partner_id',
        'order_id',
        'earning_number',
        'amount',
        'currency',
        'type',
        'status',
        'payout_id',
        'paid_at',
        'idempotency_key',
        'meta',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'paid_at' => 'datetime',
            'meta' => 'array',
        ];
    }

    public function deliveryPartner()
    {
        return $this->belongsTo(DeliveryPartner::class);
    }

    public function order()
    {
        return $this->belongsTo(Order::class);
    }

    public function payout()
    {
        return $this->belongsTo(Payout::class);
    }
}
