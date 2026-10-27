<?php

namespace App\Http\Controllers\API\Vendor;

use App\Http\Controllers\API\BaseController;
use App\Models\Category;
use App\Models\Inventory;
use App\Models\Product;
use App\Models\VendorCategory;
use App\Services\ProductOptionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class ProductController extends BaseController
{
    public function index(Request $request)
    {
        $vendor = $request->user()->vendor;
        if (! $vendor) {
            return $this->error('Vendor profile not found', null, 404);
        }

        $query = Product::where('vendor_id', $vendor->id)
            ->with(['category:id,name,slug', 'inventory'])
            ->withCount('variants')
            ->withCount('variationOptions as option_groups_count');

        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('sku', 'like', "%{$search}%");
            });
        }
        if ($categoryId = $request->query('category_id')) {
            $query->where('category_id', $categoryId);
        }
        if (($request->query('is_active') ?? null) !== null) {
            $query->where('is_active', filter_var($request->query('is_active'), FILTER_VALIDATE_BOOL));
        }
        if (($request->query('is_available') ?? null) !== null) {
            $query->where('is_available', filter_var($request->query('is_available'), FILTER_VALIDATE_BOOL));
        }

        $products = $query->latest()->paginate($request->integer('per_page', 20));

        return $this->success($products->items(), 'Products retrieved', 200, [
            'pagination' => [
                'current_page' => $products->currentPage(),
                'last_page' => $products->lastPage(),
                'per_page' => $products->perPage(),
                'total' => $products->total(),
            ],
        ]);
    }

    public function categories(Request $request)
    {
        $vendor = $request->user()->vendor;
        $type = $vendor && $vendor->vendor_type === 'grocery' ? 'grocery' : 'food';

        return $this->success(Category::where('type', $type)->orderBy('sort_order')->get());
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
            $path = $request->file('image')->store('products', 'public');

            return $this->success(['image' => $this->imageUrl($path)], 'Image uploaded');
        } catch (\Exception $e) {
            return $this->error($e->getMessage(), null, 500);
        }
    }

    public function deleteImage(Request $request, int $id)
    {
        $vendor = $request->user()->vendor;

        $product = Product::where('vendor_id', $vendor->id)->find($id);
        if (! $product) {
            return $this->error('Product not found', null, 404);
        }

        $this->deleteStoredImage($product->image);
        $product->update(['image' => null]);

        return $this->success($product->fresh(['category', 'inventory']), 'Image removed');
    }

    public function store(Request $request)
    {
        $vendor = $request->user()->vendor;
        if (! $vendor) {
            return $this->error('Vendor profile not found', null, 404);
        }

        $type = $vendor->vendor_type === 'grocery' ? 'grocery' : 'food';

        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'category_id' => 'required|exists:categories,id',
            'vendor_category_id' => 'sometimes|nullable|integer',
            'price' => 'required|numeric|min:0',
            'compare_at_price' => 'sometimes|numeric|min:0',
            'cost_price' => 'sometimes|numeric|min:0',
            'description' => 'sometimes|string',
            'image' => 'sometimes|string|max:500',
            'is_veg' => 'sometimes|boolean',
            'is_featured' => 'sometimes|boolean',
            'is_available' => 'sometimes|boolean',
            'unit_type' => 'sometimes|string|max:30',
            'unit_value' => 'sometimes|numeric|min:0',
            'unit_label' => 'sometimes|string|max:30',
            'tax_rate' => 'sometimes|numeric|min:0|max:100',
            'min_order_qty' => 'sometimes|integer|min:1',
            'max_order_qty' => 'sometimes|integer|min:1',
            'preparation_time_min' => 'sometimes|integer|min:1',
            'restaurant_id' => 'sometimes|nullable|exists:restaurants,id',
            'store_id' => 'sometimes|nullable|exists:stores,id',
            'track_inventory' => 'sometimes|boolean',
            'quantity' => 'sometimes|numeric|min:0',
            'low_stock_threshold' => 'sometimes|integer|min:0',
            'product_type' => 'sometimes|in:simple,variable',
            'option_groups' => 'sometimes|array',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        $data = $validator->validated();

        $outlet = $type === 'grocery'
            ? $vendor->stores()->first()
            : $vendor->restaurants()->first();

        if ($type === 'grocery') {
            $data['tax_rate'] = 0;
            $data['store_id'] = $data['store_id'] ?? $outlet?->id;
            $data['restaurant_id'] = null;
        } else {
            $data['restaurant_id'] = $data['restaurant_id'] ?? $outlet?->id;
            $data['store_id'] = null;
        }

        $data['vendor_id'] = $vendor->id;
        $data['type'] = $type;
        $data['slug'] = Str::slug($data['name']).'-'.Str::lower(Str::random(5));
        $data['is_active'] = $data['is_active'] ?? true;

        if (! empty($data['vendor_category_id'])
            && ! VendorCategory::forVendor($vendor->id)->whereKey($data['vendor_category_id'])->exists()) {
            return $this->error('Vendor category does not belong to this vendor.', ['vendor_category_id' => ['Invalid vendor category.']], 422);
        }

        $inventoryData = [
            'track_inventory' => $data['track_inventory'] ?? false,
            'quantity' => $data['quantity'] ?? 0,
            'low_stock_threshold' => $data['low_stock_threshold'] ?? 10,
        ];
        unset($data['track_inventory'], $data['quantity'], $data['low_stock_threshold']);

        $optionGroups = $data['option_groups'] ?? [];
        $declaredProductType = $data['product_type'] ?? null;
        unset($data['option_groups'], $data['product_type']);

        if ($declaredProductType === 'simple' && $optionGroups !== []) {
            return $this->error('Simple products cannot have option groups.', ['option_groups' => ['Switch to Variable product to add option groups.']], 422);
        }

        if ($declaredProductType === 'variable' && $optionGroups === []) {
            return $this->error('A variable product needs at least one option group.', ['option_groups' => ['Add at least one option group.']], 422);
        }

        try {
            $optionService = app(ProductOptionService::class);
            $normalizedGroups = $optionGroups === [] ? [] : $optionService->validateAndNormalizeGroups($optionGroups);

            $product = Product::create($data);

            if ($inventoryData['track_inventory']) {
                Inventory::create([
                    'vendor_id' => $vendor->id,
                    'product_id' => $product->id,
                    'product_variant_id' => null,
                    'quantity' => $inventoryData['quantity'],
                    'reserved_quantity' => 0,
                    'low_stock_threshold' => $inventoryData['low_stock_threshold'],
                    'track_inventory' => true,
                ]);
            }

            $optionService->syncOptionGroups($product, $normalizedGroups);

            return $this->success($product->fresh(['category', 'inventory'])->load('variationOptions.values'), 'Product created', 201);
        } catch (\InvalidArgumentException $e) {
            return $this->error($e->getMessage(), ['option_groups' => [$e->getMessage()]], 422);
        } catch (\Exception $e) {
            return $this->error($e->getMessage(), null, 500);
        }
    }

    public function show(Request $request, int $id)
    {
        $vendor = $request->user()->vendor;

        $product = Product::where('vendor_id', $vendor->id)
            ->with(['category', 'variants', 'addons', 'inventory'])
            ->with(['variationOptions' => fn ($q) => $q->orderBy('sort_order')->with('values')])
            ->find($id);

        if (! $product) {
            return $this->error('Product not found', null, 404);
        }

        return $this->success($product);
    }

    public function update(Request $request, int $id)
    {
        $vendor = $request->user()->vendor;

        $product = Product::where('vendor_id', $vendor->id)->find($id);
        if (! $product) {
            return $this->error('Product not found', null, 404);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|string|max:255',
            'category_id' => 'sometimes|exists:categories,id',
            'vendor_category_id' => 'sometimes|nullable|integer',
            'price' => 'sometimes|numeric|min:0',
            'compare_at_price' => 'sometimes|numeric|min:0',
            'description' => 'sometimes|string',
            'image' => 'sometimes|string|max:500',
            'is_veg' => 'sometimes|boolean',
            'is_featured' => 'sometimes|boolean',
            'is_active' => 'sometimes|boolean',
            'is_available' => 'sometimes|boolean',
            'unit_type' => 'sometimes|string|max:30',
            'unit_value' => 'sometimes|numeric|min:0',
            'unit_label' => 'sometimes|string|max:30',
            'tax_rate' => 'sometimes|numeric|min:0|max:100',
            'min_order_qty' => 'sometimes|integer|min:1',
            'max_order_qty' => 'sometimes|integer|min:1',
            'preparation_time_min' => 'sometimes|integer|min:1',
            'track_inventory' => 'sometimes|boolean',
            'quantity' => 'sometimes|numeric|min:0',
            'low_stock_threshold' => 'sometimes|integer|min:0',
            'product_type' => 'sometimes|in:simple,variable',
            'option_groups' => 'sometimes|array',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        $data = $validator->validated();

        if (array_key_exists('vendor_category_id', $data)
            && ! empty($data['vendor_category_id'])
            && ! VendorCategory::forVendor($vendor->id)->whereKey($data['vendor_category_id'])->exists()) {
            return $this->error('Vendor category does not belong to this vendor.', ['vendor_category_id' => ['Invalid vendor category.']], 422);
        }

        if ($product->type === 'grocery') {
            $data['tax_rate'] = 0;
        }

        $inventoryData = [
            'track_inventory' => $data['track_inventory'] ?? null,
            'quantity' => $data['quantity'] ?? null,
            'low_stock_threshold' => $data['low_stock_threshold'] ?? null,
        ];
        unset($data['track_inventory'], $data['quantity'], $data['low_stock_threshold']);

        $optionGroups = $data['option_groups'] ?? null;
        $declaredProductType = $data['product_type'] ?? null;
        unset($data['option_groups'], $data['product_type']);

        if ($declaredProductType === 'simple' && ! empty($optionGroups)) {
            return $this->error('Simple products cannot have option groups.', ['option_groups' => ['Switch to Variable product to add option groups.']], 422);
        }

        if ($declaredProductType === 'variable' && $optionGroups === []) {
            return $this->error('A variable product needs at least one option group.', ['option_groups' => ['Add at least one option group.']], 422);
        }

        if (array_key_exists('image', $data) && ($data['image'] ?? null) !== $product->image) {
            $this->deleteStoredImage($product->image);
        }

        $product->update($data);

        if (is_array($optionGroups) && $optionGroups !== []) {
            try {
                $optionService = app(ProductOptionService::class);
                $normalizedGroups = $optionService->validateAndNormalizeGroups($optionGroups);
                $optionService->syncOptionGroups($product, $normalizedGroups);
            } catch (\InvalidArgumentException $e) {
                return $this->error($e->getMessage(), ['option_groups' => [$e->getMessage()]], 422);
            }
        }

        if ($declaredProductType === 'simple') {
            app(ProductOptionService::class)->syncOptionGroups($product, []);
        }

        if (! empty($inventoryData['track_inventory'])) {
            Inventory::updateOrCreate(
                ['vendor_id' => $vendor->id, 'product_id' => $product->id, 'product_variant_id' => null],
                [
                    'quantity' => $inventoryData['quantity'] ?? 0,
                    'reserved_quantity' => 0,
                    'low_stock_threshold' => $inventoryData['low_stock_threshold'] ?? 10,
                    'track_inventory' => true,
                ]
            );
        }

        return $this->success($product->fresh(['category', 'inventory'])->load('variationOptions.values'), 'Product updated');
    }

    public function destroy(Request $request, int $id)
    {
        $vendor = $request->user()->vendor;

        $product = Product::where('vendor_id', $vendor->id)->find($id);
        if (! $product) {
            return $this->error('Product not found', null, 404);
        }

        $this->deleteStoredImage($product->image);
        $product->delete();

        return $this->success(null, 'Product deleted');
    }

    public function toggleAvailability(Request $request, int $id)
    {
        $vendor = $request->user()->vendor;

        $product = Product::where('vendor_id', $vendor->id)->find($id);
        if (! $product) {
            return $this->error('Product not found', null, 404);
        }

        $product->update(['is_available' => ! $product->is_available]);

        return $this->success($product->fresh(), 'Product availability updated');
    }

    public function updateInventory(Request $request, int $id)
    {
        $vendor = $request->user()->vendor;

        $product = Product::where('vendor_id', $vendor->id)->find($id);
        if (! $product) {
            return $this->error('Product not found', null, 404);
        }

        $validator = Validator::make($request->all(), [
            'quantity' => 'required|numeric|min:0',
            'low_stock_threshold' => 'sometimes|integer|min:0',
            'track_inventory' => 'sometimes|boolean',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        $data = $validator->validated();

        $inventory = Inventory::updateOrCreate(
            ['vendor_id' => $vendor->id, 'product_id' => $product->id, 'product_variant_id' => null],
            [
                'quantity' => $data['quantity'],
                'low_stock_threshold' => $data['low_stock_threshold'] ?? 10,
                'track_inventory' => $data['track_inventory'] ?? true,
            ]
        );

        if ((float) $data['quantity'] <= 0) {
            $product->update(['is_available' => false]);
        }

        return $this->success($inventory->fresh(), 'Inventory updated');
    }

    private function imageUrl(string $path): string
    {
        $url = rtrim(config('app.url'), '/').'/storage/';

        return $url.$path;
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

        $path = Str::after($image, $base);

        if (Storage::disk('public')->exists($path)) {
            Storage::disk('public')->delete($path);
        }
    }
}
