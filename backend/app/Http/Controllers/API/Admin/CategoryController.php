<?php

namespace App\Http\Controllers\API\Admin;

use App\Http\Controllers\API\BaseController;
use App\Models\Category;
use App\Services\AuditService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class CategoryController extends BaseController
{
    public function __construct(private readonly AuditService $audit) {}

    protected function paginationMeta($paginator): array
    {
        return [
            'pagination' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ],
        ];
    }

    public function index(Request $request)
    {
        $query = Category::query()
            ->withCount('children as children_count')
            ->withCount('products as products_count');

        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('slug', 'like', "%{$search}%");
            });
        }

        $type = $request->query('service_type') ?? $request->query('type');
        if ($type && in_array($type, Category::TYPES, true)) {
            $query->where('type', $type);
        }

        if (($request->query('status') ?? null) !== null && in_array($request->query('status'), ['active', 'inactive'], true)) {
            $query->where('is_active', $request->query('status') === 'active');
        }

        if (($request->query('featured') ?? null) !== null) {
            $query->where('is_featured', filter_var($request->query('featured'), FILTER_VALIDATE_BOOL));
        }

        if (($request->query('parent_id') ?? null) !== null) {
            if ($request->query('parent_id') === 'null') {
                $query->whereNull('parent_id');
            } else {
                $query->where('parent_id', (int) $request->query('parent_id'));
            }
        }

        $query->orderBy('sort_order')->orderBy('name');

        if ($request->boolean('trashed')) {
            $query->onlyTrashed();
        }

        $categories = $query->paginate($request->integer('per_page', 20));

        $data = collect($categories->items())->map(fn (Category $category) => $category->toTreeNode(true))->all();

        return $this->success($data, 'Categories retrieved', 200, $this->paginationMeta($categories));
    }

    public function tree(Request $request)
    {
        $query = Category::query();

        $type = $request->query('service_type') ?? $request->query('type');
        if ($type && in_array($type, Category::TYPES, true)) {
            $query->where('type', $type);
        }
        if ($request->boolean('active_only')) {
            $query->active();
        }

        $categories = $query->with('children:id,parent_id,name,slug,type,icon,image,navigation_icon,sort_order,is_active,is_featured')->get();

        $groups = $categories->groupBy('parent_id');

        $build = function ($parentId = null) use (&$build, $groups): array {
            $nodes = [];
            $items = $groups->get($parentId) ?? collect();
            $items = $items->sortBy('sort_order')->sortBy('name')->values();
            foreach ($items as $category) {
                $node = $category->toTreeNode(true);
                $node['children'] = $build($category->id);
                $nodes[] = $node;
            }

            return $nodes;
        };

        return $this->success($build(null), 'Category tree retrieved');
    }

    public function show(Category $category)
    {
        $category->load(['parent:id,name,slug,type', 'children:id,parent_id,name,slug,type,icon,image,navigation_icon,sort_order,is_active,is_featured']);

        $data = $category->toTreeNode(true);
        $data['parent'] = $category->parent ? ['id' => $category->parent->id, 'name' => $category->parent->name, 'slug' => $category->parent->slug, 'type' => $category->parent->type] : null;
        $data['children'] = $category->children->map(fn (Category $child) => $child->toTreeNode(false))->values();

        return $this->success($data, 'Category retrieved');
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:120',
            'type' => 'required|string|in:'.implode(',', Category::TYPES),
            'parent_id' => 'nullable|integer|exists:categories,id',
            'slug' => 'nullable|string|max:160|regex:/^[a-z0-9-]+$/',
            'icon' => 'nullable|string|max:255',
            'image' => 'nullable|string|max:255',
            'navigation_icon' => 'nullable|string|max:255',
            'display_placement' => 'nullable|string|in:'.implode(',', Category::DISPLAY_PLACEMENTS),
            'description' => 'nullable|string|max:1000',
            'sort_order' => 'nullable|integer|min:0',
            'is_active' => 'nullable|boolean',
            'is_featured' => 'nullable|boolean',
            'meta' => 'nullable|array',
            'meta_title' => 'nullable|string|max:200',
            'meta_description' => 'nullable|string|max:1000',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        $data = $validator->validated();

        if (! empty($data['parent_id'])) {
            $parent = Category::find($data['parent_id']);
            if (! $parent) {
                return $this->error('Parent category not found.', null, 422);
            }
            $data['type'] = $parent->type;
        }

        $data['slug'] = ! empty($data['slug']) ? Category::uniqueSlug($data['slug']) : Category::uniqueSlug($data['name']);

        $category = Category::create($data);
        $this->audit->created($category, $category->fresh()->toArray());

        return $this->success($category->toTreeNode(true), 'Category created', 201);
    }

    public function update(Request $request, Category $category)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|required|string|max:120',
            'type' => 'sometimes|required|string|in:'.implode(',', Category::TYPES),
            'parent_id' => 'nullable|integer|exists:categories,id',
            'slug' => 'nullable|string|max:160|regex:/^[a-z0-9-]+$/',
            'icon' => 'nullable|string|max:255',
            'image' => 'nullable|string|max:255',
            'navigation_icon' => 'nullable|string|max:255',
            'display_placement' => 'nullable|string|in:'.implode(',', Category::DISPLAY_PLACEMENTS),
            'description' => 'nullable|string|max:1000',
            'sort_order' => 'nullable|integer|min:0',
            'is_active' => 'nullable|boolean',
            'is_featured' => 'nullable|boolean',
            'meta' => 'nullable|array',
            'meta_title' => 'nullable|string|max:200',
            'meta_description' => 'nullable|string|max:1000',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        $data = $validator->validated();

        if (array_key_exists('parent_id', $data)) {
            if ($category->wouldCreateCycle($data['parent_id'])) {
                return $this->error('Cannot set a descendant as the parent category.', ['parent_id' => ['Cycle detected.']], 422);
            }
            if (! empty($data['parent_id'])) {
                $parent = Category::find($data['parent_id']);
                if (! $parent) {
                    return $this->error('Parent category not found.', null, 422);
                }
                $data['type'] = $parent->type;
            }
        }

        if (! empty($data['slug']) && $data['slug'] !== Str::slug($data['slug'])) {
            return $this->error('Invalid slug format.', ['slug' => ['Use lowercase letters, numbers and hyphens.']], 422);
        }
        if (! empty($data['slug'])) {
            $data['slug'] = Category::uniqueSlug($data['slug'], $category->id);
        }

        $old = $category->fresh()->toArray();
        $category->update($data);
        $category->refresh();
        $this->audit->updated($category, $old, $category->fresh()->toArray());

        return $this->success($category->toTreeNode(true), 'Category updated');
    }

    public function destroy(Request $request, Category $category)
    {
        $childrenCount = $category->children()->count();
        if ($childrenCount > 0) {
            return $this->error(
                "This category has {$childrenCount} sub-category(ies). Reassign or delete them before removing this category.",
                null,
                409
            );
        }

        if ($category->products()->exists()) {
            if (! $request->boolean('force')) {
                return $this->error(
                    'This category still has products attached. Pass force=true to keep products and remove the category.',
                    null,
                    409
                );
            }
            $category->products()->update(['category_id' => null]);
        }

        $category->delete();
        $this->audit->deleted($category);

        return $this->success(['id' => $category->id, 'deleted_at' => $category->deleted_at], 'Category deleted');
    }

    public function restore(int $id)
    {
        $category = Category::withTrashed()->find($id);

        if (! $category) {
            return $this->error('Category not found', null, 404);
        }

        if (! $category->trashed()) {
            return $this->error('Category is not deleted.', null, 422);
        }

        if ($category->parent_id && ! Category::find($category->parent_id)) {
            return $this->error('Parent category is missing; restore the parent first.', null, 409);
        }

        $category->restore();
        $this->audit->log('restored', Category::class, $category->id, [], $category->fresh()->toArray(), 'Category restored', 'info');

        return $this->success($category->toTreeNode(true), 'Category restored');
    }

    public function reorder(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'items' => 'required|array|min:1',
            'items.*.id' => 'required|integer|exists:categories,id',
            'items.*.sort_order' => 'required|integer|min:0',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        foreach ($validator->validated()['items'] as $item) {
            Category::whereKey($item['id'])->update(['sort_order' => $item['sort_order']]);
        }

        $this->audit->log('reordered', Category::class, null, [], ['items' => $validator->validated()['items']], 'Categories reordered');

        return $this->success(collect($validator->validated()['items'])->pluck('id'), 'Category order updated');
    }

    public function toggle(Request $request, Category $category)
    {
        $isActive = ! $category->is_active;
        $category->is_active = $isActive;
        $category->save();

        $affected = [$category->id];
        if (! $isActive && $request->boolean('cascade')) {
            $affected = array_merge($affected, $this->recursiveIds($category->id));
            Category::whereIn('id', $affected)->update(['is_active' => false]);
            $category->refresh();
        }

        $this->audit->log($isActive ? 'activated' : 'deactivated', Category::class, $category->id, ['is_active' => ! $isActive], ['is_active' => $isActive], 'Category '.($isActive ? 'activated' : 'deactivated'));

        return $this->success(['id' => $category->id, 'is_active' => $category->is_active, 'affected_ids' => $affected], 'Category status updated');
    }

    public function toggleFeatured(Category $category)
    {
        $category->is_featured = ! $category->is_featured;
        $category->save();
        $this->audit->log('featured', Category::class, $category->id, ['is_featured' => ! $category->is_featured], ['is_featured' => $category->is_featured], 'Category featured status updated');

        return $this->success(['id' => $category->id, 'is_featured' => $category->is_featured], 'Category featured status updated');
    }

    public function uploadImage(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'image' => 'required|image|mimes:jpeg,png,webp,gif|max:4096',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        try {
            $path = $request->file('image')->store('category-images', 'public');

            return $this->success(['image' => $this->imageUrl($path)], 'Image uploaded');
        } catch (\Exception $e) {
            return $this->error($e->getMessage(), null, 500);
        }
    }

    public function deleteImage(Request $request, Category $category)
    {
        $this->deleteStoredImage($category->image, 'category-images/');
        $category->update(['image' => null]);
        $this->audit->updated($category, ['image' => $category->image], ['image' => null]);

        return $this->success(['id' => $category->id, 'image' => null], 'Image removed');
    }

    public function uploadNavigationIcon(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'image' => 'required|image|mimes:jpeg,png,webp,gif|max:2048',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        try {
            $path = $request->file('image')->store('category-navigation-icons', 'public');

            return $this->success(['navigation_icon' => $this->imageUrl($path)], 'Navigation icon uploaded');
        } catch (\Exception $e) {
            return $this->error($e->getMessage(), null, 500);
        }
    }

    public function deleteNavigationIcon(Request $request, Category $category)
    {
        $this->deleteStoredImage($category->navigation_icon, 'category-navigation-icons/');
        $category->update(['navigation_icon' => null]);
        $this->audit->updated($category, ['navigation_icon' => $category->navigation_icon], ['navigation_icon' => null]);

        return $this->success(['id' => $category->id, 'navigation_icon' => null], 'Navigation icon removed');
    }

    public function bulk(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'action' => 'required|string|in:activate,deactivate,delete,restore',
            'ids' => 'required|array|min:1',
            'ids.*' => 'integer',
            'cascade' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        $data = $validator->validated();
        $ids = array_map('intval', $data['ids']);
        $action = $data['action'];
        $cascade = ! empty($data['cascade']);

        $categories = Category::withTrashed()->whereIn('id', $ids)->get();

        if ($action === 'delete') {
            foreach ($categories as $category) {
                if ($category->children()->count() > 0) {
                    return $this->error("Category \"{$category->name}\" has sub-categories. Remove them first.", null, 409);
                }
            }
            Category::whereIn('id', $ids)->delete();
            $this->audit->log('bulk_destroy', Category::class, null, [], ['ids' => $ids], 'Bulk deleted categories', 'warning');
        } elseif ($action === 'restore') {
            Category::whereIn('id', $ids)->restore();
            $this->audit->log('bulk_restore', Category::class, null, [], ['ids' => $ids], 'Bulk restored categories');
        } elseif ($action === 'activate') {
            Category::whereIn('id', $ids)->update(['is_active' => true]);
            $this->audit->log('bulk_activate', Category::class, null, [], ['ids' => $ids], 'Bulk activated categories');
        } elseif ($action === 'deactivate') {
            $all = $ids;
            if ($cascade) {
                foreach ($categories as $category) {
                    $all = array_merge($all, $this->recursiveIds($category->id));
                }
                $all = array_values(array_unique($all));
            }
            Category::whereIn('id', $all)->update(['is_active' => false]);
            $this->audit->log('bulk_deactivate', Category::class, null, [], ['ids' => $all], 'Bulk deactivated categories');
        }

        return $this->success(['action' => $action, 'ids' => $ids], 'Bulk action completed');
    }

    private function recursiveIds(int $parentId): array
    {
        $ids = [];
        $children = Category::where('parent_id', $parentId)->get(['id']);
        foreach ($children as $child) {
            $ids[] = (int) $child->id;
            $ids = array_merge($ids, $this->recursiveIds((int) $child->id));
        }

        return $ids;
    }

    private function imageUrl(string $path): string
    {
        return rtrim(config('app.url'), '/').'/storage/'.$path;
    }

    private function deleteStoredImage(?string $image, string $prefix): void
    {
        if (! $image) {
            return;
        }

        $base = rtrim(config('app.url'), '/').'/storage/';

        if (! Str::startsWith($image, $base)) {
            return;
        }

        $relative = Str::after($image, $base);

        if (Str::contains($relative, '..') || ! Str::startsWith($relative, $prefix)) {
            return;
        }

        if (Storage::disk('public')->exists($relative)) {
            Storage::disk('public')->delete($relative);
        }
    }
}
