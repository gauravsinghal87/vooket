<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Store extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'vendor_id',
        'name',
        'slug',
        'store_type',
        'description',
        'address',
        'latitude',
        'longitude',
        'phone',
        'logo',
        'cover_image',
        'opens_at',
        'closes_at',
        'is_open',
        'is_featured',
        'rating',
        'rating_count',
        'min_order_amount',
        'delivery_fee',
        'opening_hours',
        'holidays',
        'order_type',
        'supports_instant_delivery',
        'supports_scheduled_delivery',
        'substitution_policy',
        'meta',
    ];

    protected function casts(): array
    {
        return [
            'latitude' => 'decimal:7',
            'longitude' => 'decimal:7',
            'is_open' => 'boolean',
            'is_featured' => 'boolean',
            'rating' => 'decimal:2',
            'min_order_amount' => 'decimal:2',
            'delivery_fee' => 'decimal:2',
            'opening_hours' => 'array',
            'holidays' => 'array',
            'supports_instant_delivery' => 'boolean',
            'supports_scheduled_delivery' => 'boolean',
            'meta' => 'array',
        ];
    }

    public function vendor()
    {
        return $this->belongsTo(Vendor::class);
    }

    public function getLogoAttribute(): ?string
    {
        $value = $this->attributes['logo'] ?? null;

        return $value ?: $this->vendor?->logo;
    }

    public function getCoverImageAttribute(): ?string
    {
        $value = $this->attributes['cover_image'] ?? null;

        return $value ?: $this->attributes['logo'] ?? $this->vendor?->cover_image ?: $this->vendor?->logo;
    }

    public function products()
    {
        return $this->hasMany(Product::class);
    }

    public function orders()
    {
        return $this->hasMany(Order::class);
    }

    public function reviews()
    {
        return $this->morphMany(Review::class, 'reviewable');
    }

    public function categories()
    {
        return $this->morphToMany(Category::class, 'categorizable');
    }

    public function vendorCategories()
    {
        return $this->hasMany(VendorCategory::class);
    }
}
