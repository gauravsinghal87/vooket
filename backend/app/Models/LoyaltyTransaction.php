<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class LoyaltyTransaction extends Model
{
    use HasFactory;

    protected $fillable = [
        'loyalty_account_id',
        'user_id',
        'type',
        'points',
        'balance_before',
        'balance_after',
        'source_type',
        'source_id',
        'description',
        'expires_at',
    ];

    protected function casts(): array
    {
        return [
            'expires_at' => 'datetime',
        ];
    }

    public function loyaltyAccount()
    {
        return $this->belongsTo(LoyaltyAccount::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
