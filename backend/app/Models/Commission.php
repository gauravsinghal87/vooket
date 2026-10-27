<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Commission extends Model
{
    use HasFactory;

    protected $fillable = [
        'commission_number',
        'service',
        'party_type',
        'vendor_id',
        'driver_id',
        'delivery_partner_id',
        'source_type',
        'source_id',
        'gross_amount',
        'commission_amount',
        'commission_rate',
        'commission_type',
        'net_amount',
        'status',
        'breakdown',
    ];

    protected function casts(): array
    {
        return [
            'gross_amount' => 'decimal:2',
            'commission_amount' => 'decimal:2',
            'commission_rate' => 'decimal:2',
            'net_amount' => 'decimal:2',
            'breakdown' => 'array',
        ];
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
