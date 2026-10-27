<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class VariationOptionValue extends Model
{
    use HasFactory;

    protected $fillable = [
        'variation_option_id',
        'name',
        'price_adjustment',
        'is_default',
        'is_available',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'price_adjustment' => 'decimal:2',
            'is_default' => 'boolean',
            'is_available' => 'boolean',
        ];
    }

    public function variationOption()
    {
        return $this->belongsTo(VariationOption::class);
    }
}
