<?php

namespace App\Http\Controllers\API\Vendor;

use App\Http\Controllers\API\BaseController;
use App\Models\Category;
use App\Models\Restaurant;
use App\Models\Vendor;
use App\Models\VendorCategory;
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
        $vendor = $this->requiredVendor($request);
        if (! $vendor) {
            return $this->error('Vendor profile not found', null, 404);
        }

        $query = VendorCategory::forVendor($vendor->id)
            ->withCount('children as children_count')
            ->withCount('products as products_count')
            ->orderBy('sort_order')
            ->orderBy('name');

        if (($request->query('status') ?? null) !== null && in_array($request->query('status'), ['active', 'inactive'], true)) {
            $query->where('is_active', $request->query('status') === 'active');
        }
        if (($request->query('parent_id') ?? null) !== null) {
            $query->where('parent_id', $request->query('parent_id') === 'null' ? null : (int) $request->query('parent_id'));
        }

        if ($request->boolean('trashed')) {
            $query->onlyTrashed();
        }

        if ($request->boolean('all')) {
            return $this->success($query->get()->map(fn (VendorCategory $c) => $this->node($c))->all(), 'Vendor categories retrieved');
        }

        $categories = $query->paginate($request->integer('per_page', 20));

        return $this->success(
            collect($categories->items())->map(fn (VendorCategory $c) => $this->node($c))->all(),
            'Vendor categories retrieved',
            200,
            $this->paginationMeta($categories)
        );
    }

    public function options(Request $request)
    {
        $vendor = $this->requiredVendor($request);
        if (! $vendor) {
            return $this->error('Vendor profile not found', null, 404);
        }

        $categories = VendorCategory::forVendor($vendor->id)
            ->with('parent:id,name')
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        return $this->success($categories->map(fn (VendorCategory $c) => [
            'id' => $c->id,
            'name' => $c->parent ? $c->parent->name.' / '.$c->name : $c->name,
            'parent_id' => $c->parent_id,
            'is_active' => $c->is_active,
        ])->all(), 'Vendor category options retrieved');
    }

    public function show(Request $request, int $id)
    {
        $vendor = $this->requiredVendor($request);
        if (! $vendor) {
            return $this->error('Vendor profile not found', null, 404);
        }

        $category = VendorCategory::forVendor($vendor->id)->withTrashed()->with(['parent:id,parent_id,name,slug'])->find($id);
        if (! $category) {
            return $this->error('Category not found', null, 404);
        }

        $data = $this->node($category);
        $data['parent'] = $category->parent ? ['id' => $category->parent->id, 'name' => $category->parent->name] : null;
        $data['products_count'] = $category->products()->count();
        $data['products'] = $category->products()->with('category:id,name')->limit(10)->get()->map(fn ($p) => [
            'id' => $p->id,
            'name' => $p->name,
            'price' => $p->price,
            'is_active' => $p->is_active,
            'category' => $p->category ? ['id' => $p->category->id, 'name' => $p->category->name] : null,
        ]);

        return $this->success($data, 'Vendor category retrieved');
    }

    public function store(Request $request)
    {
        $vendor = $this->requiredVendor($request);
        if (! $vendor) {
            return $this->error('Vendor profile not found', null, 404);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:120',
            'parent_id' => 'nullable|integer',
            'slug' => 'nullable|string|max:160|regex:/^[a-z0-9-]+$/',
            'description' => 'nullable|string|max:1000',
            'image' => 'nullable|string|max:255',
            'icon' => 'nullable|string|max:255',
            'sort_order' => 'nullable|integer|min:0',
            'is_active' => 'nullable|boolean',
            'store_id' => 'nullable|integer',
            'restaurant_id' => 'nullable|integer',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        $data = $validator->validated();
        $data['vendor_id'] = $vendor->id;

        if (! empty($data['parent_id'])) {
            $parent = VendorCategory::forVendor($vendor->id)->find($data['parent_id']);
            if (! $parent) {
                return $this->error('Parent category does not belong to this vendor.', null, 422);
            }
        }

        if (! empty($data['store_id'])) {
            $data['restaurant_id'] = null;
            if (! $vendor->stores()->whereKey($data['store_id'])->exists()) {
                return $this->error('Invalid store for this vendor.', null, 422);
            }
        }
        if (! empty($data['restaurant_id'])) {
            $data['store_id'] = null;
            if (! $vendor->restaurants()->whereKey($data['restaurant_id'])->exists()) {
                return $this->error('Invalid restaurant for this vendor.', null, 422);
            }
        }

        $data['slug'] = ! empty($data['slug']) ? VendorCategory::uniqueSlug($vendor->id, $data['slug']) : VendorCategory::uniqueSlug($vendor->id, $data['name']);

        $category = VendorCategory::create($data);
        $this->audit->created($category, $category->fresh()->toArray());

        return $this->success($this->node($category), 'Category created', 201);
    }

    public function update(Request $request, int $id)
    {
        $vendor = $this->requiredVendor($request);
        if (! $vendor) {
            return $this->error('Vendor profile not found', null, 404);
        }

        $category = VendorCategory::forVendor($vendor->id)->find($id);
        if (! $category) {
            return $this->error('Category not found', null, 404);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|required|string|max:120',
            'parent_id' => 'nullable|integer',
            'slug' => 'nullable|string|max:160|regex:/^[a-z0-9-]+$/',
            'description' => 'nullable|string|max:1000',
            'image' => 'nullable|string|max:255',
            'icon' => 'nullable|string|max:255',
            'sort_order' => 'nullable|integer|min:0',
            'is_active' => 'nullable|boolean',
            'store_id' => 'nullable|integer',
            'restaurant_id' => 'nullable|integer',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        $data = $validator->validated();

        if (array_key_exists('parent_id', $data) && $category->wouldCreateCycle($data['parent_id'])) {
            return $this->error('Cannot set a descendant as the parent category.', ['parent_id' => ['Cycle detected.']], 422);
        }
        if (! empty($data['parent_id'])) {
            $parent = VendorCategory::forVendor($vendor->id)->find($data['parent_id']);
            if (! $parent) {
                return $this->error('Parent category does not belong to this vendor.', null, 422);
            }
        }

        if (! empty($data['slug'])) {
            $data['slug'] = VendorCategory::uniqueSlug($vendor->id, $data['slug'], $category->id);
        }

        $old = $category->fresh()->toArray();
        $category->update($data);
        $category->refresh();
        $this->audit->updated($category, $old, $category->fresh()->toArray());

        return $this->success($this->node($category), 'Category updated');
    }

    public function destroy(Request $request, int $id)
    {
        $vendor = $this->requiredVendor($request);
        if (! $vendor) {
            return $this->error('Vendor profile not found', null, 404);
        }

        $category = VendorCategory::forVendor($vendor->id)->find($id);
        if (! $category) {
            return $this->error('Category not found', null, 404);
        }

        $childrenCount = $category->children()->count();
        if ($childrenCount > 0) {
            return $this->error("This category has {$childrenCount} sub-category(ies). Remove them first.", null, 409);
        }

        if ($category->products()->exists()) {
            if (! $request->boolean('force')) {
                return $this->error('This category still has products attached. Pass force=true to keep products.', null, 409);
            }
            $category->products()->update(['vendor_category_id' => null]);
        }

        $category->delete();
        $this->audit->deleted($category);

        return $this->success(['id' => $category->id, 'deleted_at' => $category->deleted_at], 'Category deleted');
    }

    public function restore(Request $request, int $id)
    {
        $vendor = $this->requiredVendor($request);
        if (! $vendor) {
            return $this->error('Vendor profile not found', null, 404);
        }

        $category = VendorCategory::forVendor($vendor->id)->onlyTrashed()->find($id);
        if (! $category) {
            return $this->error('Category not found in trash', null, 404);
        }

        $category->restore();
        $this->audit->log('restored', VendorCategory::class, $category->id, [], $category->fresh()->toArray(), 'Vendor category restored');

        return $this->success($this->node($category), 'Category restored');
    }

    public function reorder(Request $request)
    {
        $vendor = $this->requiredVendor($request);
        if (! $vendor) {
            return $this->error('Vendor profile not found', null, 404);
        }

        $validator = Validator::make($request->all(), [
            'items' => 'required|array|min:1',
            'items.*.id' => 'required|integer',
            'items.*.sort_order' => 'required|integer|min:0',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        $items = $validator->validated()['items'];
        $ids = collect($items)->pluck('id')->all();
        $owned = VendorCategory::forVendor($vendor->id)->whereIn('id', $ids)->count();
        if ($owned !== count($ids)) {
            return $this->error('Some categories do not belong to this vendor.', null, 422);
        }

        foreach ($items as $item) {
            VendorCategory::whereKey($item['id'])->update(['sort_order' => $item['sort_order']]);
        }

        $this->audit->log('reordered', VendorCategory::class, null, [], ['items' => $items], 'Vendor categories reordered');

        return $this->success(collect($items)->pluck('id'), 'Category order updated');
    }

    public function toggle(Request $request, int $id)
    {
        $vendor = $this->requiredVendor($request);
        if (! $vendor) {
            return $this->error('Vendor profile not found', null, 404);
        }

        $category = VendorCategory::forVendor($vendor->id)->find($id);
        if (! $category) {
            return $this->error('Category not found', null, 404);
        }

        $category->is_active = ! $category->is_active;
        $category->save();
        $this->audit->log($category->is_active ? 'activated' : 'deactivated', VendorCategory::class, $category->id, ['is_active' => ! $category->is_active], ['is_active' => $category->is_active], 'Vendor category status updated');

        return $this->success(['id' => $category->id, 'is_active' => $category->is_active], 'Category status updated');
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

    public function deleteImage(Request $request, int $id)
    {
        $vendor = $this->requiredVendor($request);
        if (! $vendor) {
            return $this->error('Vendor profile not found', null, 404);
        }

        $category = VendorCategory::forVendor($vendor->id)->find($id);
        if (! $category) {
            return $this->error('Category not found', null, 404);
        }

        $this->deleteStoredImage($category->image);
        $category->update(['image' => null]);
        $this->audit->updated($category, ['image' => $category->image], ['image' => null]);

        return $this->success(['id' => $category->id, 'image' => null], 'Image removed');
    }

    public function platform(Request $request)
    {
        $vendor = $this->requiredVendor($request);
        if (! $vendor) {
            return $this->error('Vendor profile not found', null, 404);
        }

        $type = $vendor->vendor_type === 'grocery' ? 'grocery' : 'food';
        $outlet = $vendor->ensureOutlet();

        $categories = Category::where('type', $type)->ordered()->get()->map(function (Category $category) {
            $node = $category->toTreeNode(true);
            $node['selected'] = false;

            return $node;
        });

        $selected = [];
        if ($outlet) {
            $selected = $outlet->categories()->pluck('categories.id')->map(fn ($id) => (int) $id)->all();
        }

        return $this->success([
            'service_type' => $type,
            'categories' => $categories->all(),
            'selected_category_ids' => $selected,
            'outlet' => $outlet ? ($outlet instanceof Restaurant ? ['id' => $outlet->id, 'type' => 'restaurant', 'name' => $outlet->name] : ['id' => $outlet->id, 'type' => 'store', 'name' => $outlet->name]) : null,
        ], 'Platform categories retrieved');
    }

    public function syncPlatform(Request $request)
    {
        $vendor = $this->requiredVendor($request);
        if (! $vendor) {
            return $this->error('Vendor profile not found', null, 404);
        }

        $validator = Validator::make($request->all(), [
            'category_ids' => 'required|array',
            'category_ids.*' => 'integer|exists:categories,id',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        $type = $vendor->vendor_type === 'grocery' ? 'grocery' : 'food';
        $ids = array_map('intval', $validator->validated()['category_ids']);

        $validGiven = Category::whereIn('id', $ids)->get();
        foreach ($validGiven as $category) {
            if ($category->type !== $type) {
                return $this->error("Category \"{$category->name}\" does not belong to this service.", null, 422);
            }
        }

        $outlet = $vendor->ensureOutlet();
        if (! $outlet) {
            return $this->error('No outlet exists for this vendor.', null, 409);
        }

        $outlet->categories()->sync($validGiven->pluck('id'));

        return $this->success(['selected_category_ids' => $validGiven->pluck('id')->map(fn ($id) => (int) $id)->all()], 'Platform categories updated');
    }

    private function node(VendorCategory $category): array
    {
        return [
            'id' => $category->id,
            'vendor_id' => $category->vendor_id,
            'store_id' => $category->store_id,
            'restaurant_id' => $category->restaurant_id,
            'parent_id' => $category->parent_id,
            'name' => $category->name,
            'slug' => $category->slug,
            'description' => $category->description,
            'image' => $category->image,
            'icon' => $category->icon,
            'sort_order' => $category->sort_order,
            'is_active' => $category->is_active,
            'meta' => $category->meta,
            'children_count' => $category->children_count ?? $category->children()->count(),
            'products_count' => $category->products_count ?? $category->products()->count(),
            'created_at' => $category->created_at,
            'updated_at' => $category->updated_at,
            'deleted_at' => $category->deleted_at,
        ];
    }

    private function requiredVendor(Request $request): ?Vendor
    {
        $vendor = $request->user()?->vendor;

        return $vendor instanceof Vendor ? $vendor : null;
    }

    private function imageUrl(string $path): string
    {
        return rtrim(config('app.url'), '/').'/storage/'.$path;
    }

    private function deleteStoredImage(?string $image): void
    {
        if (! $image) {
            return;
        }

        $base = rtrim(config('app.url'), '/').'/storage/';

        if (! Str::startsWith($image, $base)) {
            return;
        }

        $relative = Str::after($image, $base);

        if (Str::contains($relative, '..') || ! Str::startsWith($relative, 'category-images/')) {
            return;
        }

        if (Storage::disk('public')->exists($relative)) {
            Storage::disk('public')->delete($relative);
        }
    }
}
