<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Settlement extends Model
{
    use HasFactory;

    protected $fillable = [
        'settlement_number',
        'party_type',
        'vendor_id',
        'driver_id',
        'delivery_partner_id',
        'gross_earnings',
        'total_commission',
        'total_incentives',
        'total_bonuses',
        'total_adjustments',
        'total_refunds',
        'net_payable',
        'status',
        'period_start',
        'period_end',
        'period_type',
        'approved_at',
        'approved_by',
        'paid_at',
        'payout_id',
        'breakdown',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'gross_earnings' => 'decimal:2',
            'total_commission' => 'decimal:2',
            'total_incentives' => 'decimal:2',
            'total_bonuses' => 'decimal:2',
            'total_adjustments' => 'decimal:2',
            'total_refunds' => 'decimal:2',
            'net_payable' => 'decimal:2',
            'period_start' => 'date',
            'period_end' => 'date',
            'approved_at' => 'datetime',
            'paid_at' => 'datetime',
            'breakdown' => 'array',
        ];
    }

    public function settlementItems()
    {
        return $this->hasMany(SettlementItem::class);
    }

    public function payout()
    {
        return $this->belongsTo(Payout::class);
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
