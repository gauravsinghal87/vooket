<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Product extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'vendor_id',
        'store_id',
        'restaurant_id',
        'category_id',
        'vendor_category_id',
        'brand_id',
        'type',
        'product_type',
        'name',
        'slug',
        'description',
        'sku',
        'barcode',
        'price',
        'compare_at_price',
        'cost_price',
        'unit_type',
        'unit_value',
        'unit_label',
        'image',
        'images',
        'is_veg',
        'is_featured',
        'is_active',
        'is_available',
        'min_order_qty',
        'max_order_qty',
        'nutrition_info',
        'ingredients',
        'tax_category',
        'tax_rate',
        'preparation_time_min',
        'expiry_date',
        'meta',
    ];

    protected function casts(): array
    {
        return [
            'price' => 'decimal:2',
            'compare_at_price' => 'decimal:2',
            'cost_price' => 'decimal:2',
            'unit_value' => 'decimal:3',
            'images' => 'array',
            'is_veg' => 'boolean',
            'is_featured' => 'boolean',
            'is_active' => 'boolean',
            'is_available' => 'boolean',
            'nutrition_info' => 'array',
            'ingredients' => 'array',
            'tax_rate' => 'decimal:2',
            'expiry_date' => 'date',
            'meta' => 'array',
        ];
    }

    public function vendor()
    {
        return $this->belongsTo(Vendor::class);
    }

    public function store()
    {
        return $this->belongsTo(Store::class);
    }

    public function restaurant()
    {
        return $this->belongsTo(Restaurant::class);
    }

    public function category()
    {
        return $this->belongsTo(Category::class);
    }

    public function vendorCategory()
    {
        return $this->belongsTo(VendorCategory::class);
    }

    public function brand()
    {
        return $this->belongsTo(Brand::class);
    }

    public function variants()
    {
        return $this->hasMany(ProductVariant::class);
    }

    public function variationOptions()
    {
        return $this->hasMany(VariationOption::class);
    }

    public function addons()
    {
        return $this->belongsToMany(Addon::class, 'product_addons');
    }

    public function scopeWithOptionGroups($query)
    {
        return $query->with([
            'variationOptions' => fn ($q) => $q
                ->orderBy('sort_order')
                ->with(['values' => fn ($v) => $v->orderBy('sort_order')]),
        ]);
    }

    public function inventory()
    {
        return $this->hasOne(Inventory::class);
    }

    public function reviews()
    {
        return $this->morphMany(Review::class, 'reviewable');
    }
}
