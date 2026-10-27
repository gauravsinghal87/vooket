<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class VendorCategory extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'vendor_id',
        'store_id',
        'restaurant_id',
        'parent_id',
        'name',
        'slug',
        'description',
        'image',
        'icon',
        'sort_order',
        'is_active',
        'meta',
    ];

    protected function casts(): array
    {
        return [
            'parent_id' => 'integer',
            'sort_order' => 'integer',
            'is_active' => 'boolean',
            'meta' => 'array',
        ];
    }

    public static function uniqueSlug(int $vendorId, string $name, ?int $ignoreId = null): string
    {
        $base = Str::slug($name) ?: 'category';
        $slug = $base;
        $i = 2;
        while (static::withTrashed()->where('vendor_id', $vendorId)->where('slug', $slug)->when($ignoreId, fn ($q) => $q->where('id', '!=', $ignoreId))->exists()) {
            $slug = $base.'-'.$i;
            $i++;
        }

        return $slug;
    }

    public function vendor(): BelongsTo
    {
        return $this->belongsTo(Vendor::class);
    }

    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class);
    }

    public function restaurant(): BelongsTo
    {
        return $this->belongsTo(Restaurant::class);
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(VendorCategory::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(VendorCategory::class, 'parent_id')->orderBy('sort_order')->orderBy('name');
    }

    public function products(): HasMany
    {
        return $this->hasMany(Product::class);
    }

    public function scopeForVendor($query, int $vendorId)
    {
        return $query->where('vendor_id', $vendorId);
    }

    public function scopeForOutlet($query, $outlet)
    {
        if ($outlet instanceof Restaurant) {
            return $query->where('restaurant_id', $outlet->id)
                ->orWhereNull('store_id')
                ->where('vendor_id', $outlet->vendor_id);
        }
        if ($outlet instanceof Store) {
            return $query->where('store_id', $outlet->id)
                ->orWhereNull('restaurant_id')
                ->where('vendor_id', $outlet->vendor_id);
        }

        return $query->where('vendor_id', $outlet);
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function scopeRoot($query)
    {
        return $query->whereNull('parent_id');
    }

    public function scopeOrdered($query)
    {
        return $query->orderBy('sort_order')->orderBy('name');
    }

    public function wouldCreateCycle(?int $newParentId): bool
    {
        if (! $newParentId || $newParentId === $this->id) {
            return false;
        }

        $cursor = (int) $newParentId;
        $guard = 0;
        while ($cursor) {
            if ($cursor === $this->id) {
                return true;
            }
            $parent = static::withTrashed()->find($cursor);
            if (! $parent) {
                return false;
            }
            $cursor = $parent->parent_id ? (int) $parent->parent_id : 0;
            if (++$guard > 50) {
                return true;
            }
        }

        return false;
    }
}
