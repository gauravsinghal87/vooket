<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Payout extends Model
{
    use HasFactory;

    protected $fillable = [
        'payout_number',
        'party_type',
        'vendor_id',
        'driver_id',
        'delivery_partner_id',
        'amount',
        'currency',
        'bank_account_name',
        'bank_account_number',
        'bank_ifsc',
        'bank_name',
        'gateway',
        'provider_reference',
        'status',
        'mode',
        'gateway_response',
        'processed_at',
        'idempotency_key',
        'failure_reason',
        'admin_remark',
        'meta',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'gateway_response' => 'array',
            'processed_at' => 'datetime',
            'meta' => 'array',
        ];
    }

    public function settlements()
    {
        return $this->hasMany(Settlement::class);
    }

    public function vendor()
    {
        return $this->belongsTo(Vendor::class);
    }

    public function driver()
    {
        return $this->belongsTo(Driver::class);
    }

    public function deliveryPartner()
    {
        return $this->belongsTo(DeliveryPartner::class);
    }
}
