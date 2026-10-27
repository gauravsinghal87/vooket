<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphToMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class Category extends Model
{
    use HasFactory, SoftDeletes;

    public const TYPES = ['food', 'grocery', 'rides'];

    /**
     * Where a category may be surfaced to customers.
     *
     * - `top_navigation` renders only in the sticky grocery category strip.
     * - `main_content`   renders only in the main grocery category grid/sections.
     * - `both`           renders in both, and is the safe default so existing
     *                    categories are never accidentally hidden.
     */
    public const DISPLAY_PLACEMENTS = ['top_navigation', 'main_content', 'both'];

    public const DISPLAY_PLACEMENT_DEFAULT = 'both';

    protected $fillable = [
        'name',
        'slug',
        'parent_id',
        'type',
        'icon',
        'image',
        'navigation_icon',
        'display_placement',
        'description',
        'sort_order',
        'is_active',
        'is_featured',
        'meta',
        'meta_title',
        'meta_description',
    ];

    protected function casts(): array
    {
        return [
            'parent_id' => 'integer',
            'sort_order' => 'integer',
            'is_active' => 'boolean',
            'is_featured' => 'boolean',
            'meta' => 'array',
        ];
    }

    public static function uniqueSlug(string $name, ?int $ignoreId = null): string
    {
        $base = Str::slug($name) ?: 'category';
        $slug = $base;
        $i = 2;
        while (static::withTrashed()->where('slug', $slug)->when($ignoreId, fn ($q) => $q->where('id', '!=', $ignoreId))->exists()) {
            $slug = $base.'-'.$i;
            $i++;
        }

        return $slug;
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(Category::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(Category::class, 'parent_id')->orderBy('sort_order')->orderBy('name');
    }

    public function products(): HasMany
    {
        return $this->hasMany(Product::class);
    }

    public function restaurants(): MorphToMany
    {
        return $this->morphedByMany(Restaurant::class, 'categorizable');
    }

    public function stores(): MorphToMany
    {
        return $this->morphedByMany(Store::class, 'categorizable');
    }

    public function scopeForService($query, string $type)
    {
        return $query->where('type', $type);
    }

    public function scopeRoot($query)
    {
        return $query->whereNull('parent_id');
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Restrict to one or more display placements.
     *
     * @param  string|array<int, string>  $placements
     */
    public function scopeDisplayPlacement($query, string|array $placements)
    {
        $placements = is_array($placements) ? $placements : [$placements];

        return $query->whereIn('display_placement', $placements);
    }

    /**
     * Categories that may render in the sticky top navigation strip.
     */
    public function scopeInTopNavigation($query)
    {
        return $query->whereIn('display_placement', ['top_navigation', self::DISPLAY_PLACEMENT_DEFAULT]);
    }

    /**
     * Categories that may render in the main grocery content area.
     */
    public function scopeInMainContent($query)
    {
        return $query->whereIn('display_placement', ['main_content', self::DISPLAY_PLACEMENT_DEFAULT]);
    }

    public function scopeFeatured($query)
    {
        return $query->where('is_featured', true);
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

    public function hasChildren(): bool
    {
        return $this->children()->exists();
    }

    /**
     * This category's ID plus every descendant ID, used to filter by a whole
     * category tree (e.g. a root Food category should include its children).
     *
     * @return array<int, int>
     */
    public function subtreeIds(): array
    {
        $ids = [(int) $this->id];
        $frontier = [(int) $this->id];

        while ($frontier !== []) {
            $children = static::whereIn('parent_id', $frontier)
                ->pluck('id')
                ->map(fn ($id) => (int) $id)
                ->all();

            $children = array_values(array_diff($children, $ids));
            $ids = array_merge($ids, $children);
            $frontier = $children;
        }

        return $ids;
    }

    public function vendorCount(): int
    {
        return $this->products()->whereHas('vendor')->distinct()->count('vendor_id');
    }

    public function toTreeNode(bool $withCounts = false): array
    {
        $node = [
            'id' => $this->id,
            'name' => $this->name,
            'slug' => $this->slug,
            'parent_id' => $this->parent_id,
            'type' => $this->type,
            'icon' => $this->icon,
            'image' => $this->image,
            'navigation_icon' => $this->navigation_icon,
            'display_placement' => $this->display_placement ?? self::DISPLAY_PLACEMENT_DEFAULT,
            'description' => $this->description,
            'sort_order' => $this->sort_order,
            'is_active' => $this->is_active,
            'is_featured' => $this->is_featured,
            'meta' => $this->meta,
            'meta_title' => $this->meta_title,
            'meta_description' => $this->meta_description,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];

        if ($withCounts) {
            $node['children_count'] = $this->hasChildren() ? $this->children()->count() : 0;
            $node['products_count'] = $this->products_count ?? $this->products()->count();
            $node['vendors_count'] = $this->vendorCount();
        }

        return $node;
    }
}
