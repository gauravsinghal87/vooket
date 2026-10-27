<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Cart extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'session_id',
        'cart_type',
        'vendor_id',
        'address_id',
        'delivery_mode',
        'subtotal',
        'discount',
        'tax',
        'delivery_fee',
        'delivery_gst_percent',
        'delivery_gst_amount',
        'packaging_fee',
        'handling_fee',
        'pricing_quote',
        'total',
        'coupon_code',
        'items_count',
        'expires_at',
    ];

    protected function casts(): array
    {
        return [
            'subtotal' => 'decimal:2',
            'discount' => 'decimal:2',
            'tax' => 'decimal:2',
            'delivery_fee' => 'decimal:2',
            'delivery_gst_amount' => 'decimal:2',
            'packaging_fee' => 'decimal:2',
            'handling_fee' => 'decimal:2',
            'pricing_quote' => 'array',
            'total' => 'decimal:2',
            'expires_at' => 'datetime',
        ];
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function vendor()
    {
        return $this->belongsTo(Vendor::class);
    }

    public function items()
    {
        return $this->hasMany(CartItem::class);
    }
}
