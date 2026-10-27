<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Payment extends Model
{
    use HasFactory;

    protected $fillable = [
        'payment_number',
        'user_id',
        'payable_type',
        'payable_id',
        'amount',
        'amount_paise',
        'currency',
        'method',
        'gateway',
        'provider_reference',
        'provider_order_id',
        'provider_payment_id',
        'provider_signature',
        'status',
        'gateway_response',
        'idempotency_key',
        'paid_at',
        'verified_at',
        'failed_at',
        'failure_reason',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'amount_paise' => 'integer',
            'gateway_response' => 'array',
            'paid_at' => 'datetime',
            'verified_at' => 'datetime',
            'failed_at' => 'datetime',
        ];
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function payable()
    {
        return $this->morphTo();
    }

    public function paymentTransactions()
    {
        return $this->hasMany(PaymentTransaction::class);
    }

    public function refunds()
    {
        return $this->hasMany(Refund::class);
    }
}
