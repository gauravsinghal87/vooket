<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class FinancialAdjustment extends Model
{
    use HasFactory;

    protected $fillable = [
        'adjustment_number',
        'user_id',
        'wallet_id',
        'wallet_type',
        'amount',
        'direction',
        'reason',
        'notes',
        'adjusted_by',
        'reference_type',
        'reference_id',
        'idempotency_key',
        'meta',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'meta' => 'array',
        ];
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function wallet()
    {
        return $this->belongsTo(Wallet::class);
    }

    public function adjustedBy()
    {
        return $this->belongsTo(User::class, 'adjusted_by');
    }
}
