<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class LedgerEntry extends Model
{
    use HasFactory;

    protected $fillable = [
        'entry_id',
        'transaction_id',
        'account_type',
        'account_name',
        'wallet_id',
        'reference_type',
        'reference_id',
        'amount',
        'currency',
        'meta',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'meta' => 'array',
            'created_at' => 'datetime',
        ];
    }

    public $timestamps = false;

    public function wallet()
    {
        return $this->belongsTo(Wallet::class);
    }
}
