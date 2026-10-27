<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Review extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'reviewable_type',
        'reviewable_id',
        'order_id',
        'rating',
        'comment',
        'images',
        'status',
        'helpful_count',
        'meta',
    ];

    protected function casts(): array
    {
        return [
            'rating' => 'decimal:1',
            'images' => 'array',
            'meta' => 'array',
        ];
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function reviewable()
    {
        return $this->morphTo();
    }
}
