<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AddonOption extends Model
{
    use HasFactory;

    protected $fillable = [
        'addon_id',
        'name',
        'price',
        'is_default',
        'is_available',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'price' => 'decimal:2',
            'is_default' => 'boolean',
            'is_available' => 'boolean',
        ];
    }

    public function addon()
    {
        return $this->belongsTo(Addon::class);
    }
}
