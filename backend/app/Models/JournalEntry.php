<?php

namespace App\Models;

use App\Support\Money;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class JournalEntry extends Model
{
    use HasFactory;

    protected $fillable = [
        'entry_number',
        'source_type',
        'source_id',
        'entry_type',
        'transaction_id',
        'description',
        'currency',
        'total_debit',
        'total_credit',
        'idempotency_key',
        'meta',
        'posted_at',
    ];

    protected function casts(): array
    {
        return [
            'total_debit' => 'decimal:2',
            'total_credit' => 'decimal:2',
            'meta' => 'array',
            'posted_at' => 'datetime',
        ];
    }

    public function lines()
    {
        return $this->hasMany(JournalLine::class);
    }

    /**
     * True when the entry's debits equal its credits.
     */
    public function isBalanced(): bool
    {
        return Money::fromMajor($this->total_debit)->compareTo(Money::fromMajor($this->total_credit)) === 0;
    }
}
