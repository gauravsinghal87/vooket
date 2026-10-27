<?php

namespace App\Http\Controllers\API\Admin;

use App\Http\Controllers\API\BaseController;
use App\Models\Product;
use App\Models\Restaurant;
use App\Models\Store;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class CatalogController extends BaseController
{
    // ============ RESTAURANTS ============

    public function restaurants(Request $request)
    {
        $query = Restaurant::with('vendor:id,business_name,vendor_type,logo,cover_image')
            ->withCount(['products', 'orders'])
            ->withSum(['orders' => fn ($q) => $q->where('payment_status', '!=', 'failed')], 'total_amount');

        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('cuisine_type', 'like', "%{$search}%");
            });
        }
        if (($request->query('is_featured') ?? null) !== null) {
            $query->where('is_featured', filter_var($request->query('is_featured'), FILTER_VALIDATE_BOOL));
        }
        if (($request->query('is_open') ?? null) !== null) {
            $query->where('is_open', filter_var($request->query('is_open'), FILTER_VALIDATE_BOOL));
        }

        $query->latest();
        $restaurants = $query->paginate($request->integer('per_page', 20));

        return $this->success($restaurants->items(), 'Restaurants retrieved', 200, $this->paginationMeta($restaurants));
    }

    public function restaurantShow(Request $request, int $id)
    {
        $restaurant = Restaurant::with(['vendor:id,business_name,vendor_type,logo,cover_image', 'products' => fn ($q) => $q->with('category:id,name,slug')])
            ->find($id);

        if (! $restaurant) {
            return $this->error('Restaurant not found', null, 404);
        }

        return $this->success($restaurant);
    }

    public function toggleRestaurant(Request $request, int $id)
    {
        $validator = Validator::make($request->all(), [
            'field' => 'required|in:is_open,is_featured,dine_in,is_veg,is_halal',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        $restaurant = Restaurant::find($id);
        if (! $restaurant) {
            return $this->error('Restaurant not found', null, 404);
        }

        $field = $request->input('field');
        $restaurant->update([$field => ! (bool) $restaurant->$field]);

        return $this->success($restaurant->fresh(), 'Restaurant updated');
    }

    // ============ STORES ============

    public function stores(Request $request)
    {
        $query = Store::with('vendor:id,business_name,vendor_type,logo,cover_image')
            ->withCount(['products', 'orders'])
            ->withSum(['orders' => fn ($q) => $q->where('payment_status', '!=', 'failed')], 'total_amount');

        if ($search = $request->query('search')) {
            $query->where('name', 'like', "%{$search}%");
        }
        if ($type = $request->query('store_type')) {
            $query->where('store_type', $type);
        }
        if (($request->query('is_featured') ?? null) !== null) {
            $query->where('is_featured', filter_var($request->query('is_featured'), FILTER_VALIDATE_BOOL));
        }

        $query->latest();
        $stores = $query->paginate($request->integer('per_page', 20));

        return $this->success($stores->items(), 'Stores retrieved', 200, $this->paginationMeta($stores));
    }

    public function storeShow(Request $request, int $id)
    {
        $store = Store::with(['vendor:id,business_name,vendor_type,logo,cover_image'])->find($id);

        if (! $store) {
            return $this->error('Store not found', null, 404);
        }

        return $this->success($store);
    }

    public function toggleStore(Request $request, int $id)
    {
        $validator = Validator::make($request->all(), [
            'field' => 'required|in:is_open,is_featured',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        $store = Store::find($id);
        if (! $store) {
            return $this->error('Store not found', null, 404);
        }

        $field = $request->input('field');
        $store->update([$field => ! (bool) $store->$field]);

        return $this->success($store->fresh(), 'Store updated');
    }

    // ============ PRODUCTS ============

    public function products(Request $request)
    {
        $query = Product::with([
            'vendor:id,business_name,vendor_type,logo,cover_image',
            'category:id,name,slug',
            'restaurant:id,name',
            'store:id,name',
        ]);

        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('sku', 'like', "%{$search}%")
                    ->orWhere('slug', 'like', "%{$search}%");
            });
        }
        if ($type = $request->query('type')) {
            $query->where('type', $type);
        }
        if ($vendorId = $request->query('vendor_id')) {
            $query->where('vendor_id', $vendorId);
        }
        if ($categoryId = $request->query('category_id')) {
            $query->where('category_id', $categoryId);
        }
        if (($request->query('is_active') ?? null) !== null) {
            $query->where('is_active', filter_var($request->query('is_active'), FILTER_VALIDATE_BOOL));
        }

        $query->latest();
        $products = $query->paginate($request->integer('per_page', 20));

        return $this->success($products->items(), 'Products retrieved', 200, $this->paginationMeta($products));
    }

    public function toggleProduct(Request $request, int $id)
    {
        $validator = Validator::make($request->all(), [
            'field' => 'required|in:is_active,is_available,is_featured',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        $product = Product::find($id);
        if (! $product) {
            return $this->error('Product not found', null, 404);
        }

        $field = $request->input('field');
        $product->update([$field => ! (bool) $product->$field]);

        return $this->success($product->fresh(), 'Product updated');
    }

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
}
