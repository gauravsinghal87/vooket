<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class OrderItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'order_id',
        'product_id',
        'product_variant_id',
        'product_name',
        'product_image',
        'sku',
        'unit_price',
        'price_snapshot',
        'quantity',
        'adjusted_quantity',
        'refunded_amount',
        'line_total',
        'selected_options',
        'selected_addons',
        'special_instructions',
        'status',
        'meta',
    ];

    protected function casts(): array
    {
        return [
            'unit_price' => 'decimal:2',
            'price_snapshot' => 'decimal:2',
            'line_total' => 'decimal:2',
            'refunded_amount' => 'decimal:2',
            'selected_options' => 'array',
            'selected_addons' => 'array',
            'meta' => 'array',
        ];
    }

    public function order()
    {
        return $this->belongsTo(Order::class);
    }

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function productVariant()
    {
        return $this->belongsTo(ProductVariant::class);
    }
}
