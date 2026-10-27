<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class RiskScoreLog extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'risk_score',
        'level',
        'factors',
        'action',
        'review_pending',
    ];

    protected function casts(): array
    {
        return [
            'factors' => 'array',
            'review_pending' => 'boolean',
        ];
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
