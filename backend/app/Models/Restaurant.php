<?php

namespace App\Models;

use App\Services\RestaurantOperatingHoursService;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Restaurant extends Model
{
    use HasFactory, SoftDeletes;

    /**
     * Schedule-based availability computed from opens_at/closes_at in the
     * business timezone. The `is_open` column stays the manual
     * vendor/admin-facing on/off toggle used for listing filters.
     */
    protected $appends = ['is_open_now'];

    protected $fillable = [
        'vendor_id',
        'name',
        'slug',
        'description',
        'cuisine_type',
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
        'dine_in',
        'is_veg',
        'is_halal',
        'avg_prep_time_min',
        'avg_delivery_time_min',
        'rating',
        'rating_count',
        'min_order_amount',
        'delivery_fee',
        'free_delivery_above',
        'opening_hours',
        'holidays',
        'order_type',
        'meta',
    ];

    protected function casts(): array
    {
        return [
            'latitude' => 'decimal:7',
            'longitude' => 'decimal:7',
            'is_open' => 'boolean',
            'is_featured' => 'boolean',
            'dine_in' => 'boolean',
            'is_veg' => 'boolean',
            'is_halal' => 'boolean',
            'avg_prep_time_min' => 'decimal:1',
            'avg_delivery_time_min' => 'decimal:1',
            'rating' => 'decimal:2',
            'min_order_amount' => 'decimal:2',
            'delivery_fee' => 'decimal:2',
            'free_delivery_above' => 'decimal:2',
            'opening_hours' => 'array',
            'holidays' => 'array',
            'meta' => 'array',
        ];
    }

    public function vendor()
    {
        return $this->belongsTo(Vendor::class);
    }

    /**
     * Whether the restaurant is open right now per its saved local operating
     * hours (supports overnight schedules; legacy rows fall back to 09:00–22:00).
     */
    public function getIsOpenNowAttribute(): bool
    {
        return app(RestaurantOperatingHoursService::class)->isOpenNow($this->opens_at, $this->closes_at);
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
