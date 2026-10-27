<?php

namespace App\Http\Controllers\API;

use App\Models\Brand;
use App\Models\Category;
use App\Models\Product;
use App\Models\Store;
use App\Services\Delivery\GroceryServiceabilityService;
use App\Services\DeliverySlotService;
use Illuminate\Http\Request;

/**
 * Customer-facing grocery catalogue.
 *
 * Every endpoint below resolves the requested delivery location with
 * {@see GroceryServiceabilityService} and reports the verdict in
 * `meta.serviceability`. When the location cannot be served by Grocery the
 * data collapses to an empty result — the controller never falls back to an
 * unfiltered store, category or product list.
 */
class GroceryController extends BaseController
{
    public function __construct(
        private DeliverySlotService $deliverySlotService,
        private GroceryServiceabilityService $serviceability,
    ) {}

    public function stores(Request $request)
    {
        $resolved = $this->serviceability->resolveFromRequest($request);

        $query = Store::where('is_open', true)
            ->withAvg('reviews as avg_rating', 'rating');

        $this->serviceability->constrainStores($query, $resolved);

        if ($request->has('search')) {
            $query->where('name', 'like', "%{$request->search}%");
        }

        if ($request->has('latitude') && $request->has('longitude')) {
            $query->orderByRaw('ABS(latitude - ?) + ABS(longitude - ?)', [
                $request->latitude,
                $request->longitude,
            ]);
        } else {
            $query->orderBy('is_featured', 'desc');
        }

        $stores = $query->paginate($request->get('per_page', 15));

        return $this->success($stores, '', 200, [
            'serviceability' => $this->serviceability->payload($resolved),
        ]);
    }

    /**
     * A store that exists but cannot deliver to the requested location comes
     * back as `data = null` with the serviceability reason, so clients can
     * render the unavailable-location state instead of a store they may not
     * shop from. A store that does not exist keeps its 404.
     */
    public function storeDetail(Request $request, $id)
    {
        $store = Store::withAvg('reviews as avg_rating', 'rating')
            ->withCount('reviews as review_count')
            ->find($id);

        if (! $store) {
            return $this->error('Store not found', null, 404);
        }

        $resolved = $this->serviceability->resolveFromRequest($request);
        $payload = $this->serviceability->payload($resolved);

        if (! $this->serviceability->storeIsServiceable($store, $resolved)) {
            return $this->success(null, 'Store not available at this location', 200, [
                'serviceability' => $payload,
            ]);
        }

        return $this->success($store, '', 200, [
            'serviceability' => $payload,
        ]);
    }

    public function products(Request $request, $id)
    {
        $store = Store::find($id);

        if (! $store) {
            return $this->error('Store not found', null, 404);
        }

        $resolved = $this->serviceability->resolveFromRequest($request);

        $query = Product::where('store_id', $id)
            ->where('is_active', true)
            ->where('is_available', true)
            ->with(['category', 'brand'])
            ->with(['variationOptions' => fn ($opts) => $opts->with('values')]);

        // A store that cannot deliver to the requested location exposes no
        // catalogue at all, even when its id is called directly.
        if (! $this->serviceability->storeIsServiceable($store, $resolved)) {
            $query->whereRaw('1 = 0');
        }

        if ($request->has('category_id')) {
            $query->where('category_id', $request->category_id);
        }

        if ($request->has('brand_id')) {
            $query->where('brand_id', $request->brand_id);
        }

        if ($request->has('search')) {
            $query->where(function ($q) use ($request) {
                $q->where('name', 'like', "%{$request->search}%")
                    ->orWhere('description', 'like', "%{$request->search}%");
            });
        }

        if ($request->has('is_veg')) {
            $query->where('is_veg', $request->boolean('is_veg'));
        }

        $products = $query->orderBy('name')->paginate($request->get('per_page', 20));

        return $this->success($products, '', 200, [
            'serviceability' => $this->serviceability->payload($resolved),
        ]);
    }

    public function allProducts(Request $request)
    {
        $resolved = $this->serviceability->resolveFromRequest($request);

        $query = Product::where('is_active', true)
            ->where('is_available', true)
            ->with(['category', 'brand'])
            ->with(['variationOptions' => fn ($opts) => $opts->with('values')]);

        // Products are only reachable through the store that may deliver to the
        // requested location: an ineligible store's catalogue disappears here
        // just like it does on the store listing.
        $this->serviceability->constrainProducts($query, $resolved);

        if ($request->has('category_id')) {
            $query->where('category_id', $request->category_id);
        }

        if ($request->has('brand_id')) {
            $query->where('brand_id', $request->brand_id);
        }

        if ($request->has('search')) {
            $query->where(function ($q) use ($request) {
                $q->where('name', 'like', "%{$request->search}%")
                    ->orWhere('description', 'like', "%{$request->search}%");
            });
        }

        if ($request->has('sort')) {
            match ($request->sort) {
                'low' => $query->orderBy('price', 'asc'),
                'high' => $query->orderBy('price', 'desc'),
                default => $query->orderBy('name'),
            };
        } else {
            $query->orderBy('name');
        }

        $products = $query->paginate($request->get('per_page', 20));

        return $this->success($products, '', 200, [
            'serviceability' => $this->serviceability->payload($resolved),
        ]);
    }

    public function categories(Request $request)
    {
        $resolved = $this->serviceability->resolveFromRequest($request);

        // The grocery taxonomy only exists for locations Grocery serves; an
        // unserviceable location gets an empty tree rather than a rail it can
        // never get results from.
        if (! ($resolved['serviceable'] ?? false)) {
            return $this->success([], '', 200, [
                'serviceability' => $this->serviceability->payload($resolved),
            ]);
        }

        /**
         * Optional `placement` filter (comma-separated) so a consumer can ask
         * for a single surface, e.g. `?placement=top_navigation,both`. Unknown
         * values are ignored and the payload always exposes each category's
         * `display_placement` so clients may filter the full list themselves.
         */
        $placements = array_values(array_intersect(
            array_map('trim', explode(',', (string) $request->query('placement'))),
            Category::DISPLAY_PLACEMENTS
        ));

        /**
         * The full active grocery tree, not just one level. The Blinkit-style
         * category detail screen reads the selected category's own children
         * (e.g. "Atta, Rice & Dal" -> Atta / Rice / Dal) for its left sidebar,
         * so every nested level must come back with its children. The same
         * active + grocery-type + placement rules apply at every depth, and
         * ordering follows the admin `sort_order` (then name), mirroring the
         * existing `children` relation.
         */
        $all = Category::where('is_active', true)
            ->where(function ($q) {
                $q->where('type', 'grocery')->orWhereNull('type');
            })
            ->when($placements, fn ($q) => $q->whereIn('display_placement', $placements))
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        $byParent = [];
        foreach ($all as $category) {
            $byParent[(string) $category->parent_id][] = $category;
        }

        $build = function (?int $parentId) use (&$build, $byParent): array {
            $children = [];

            foreach ($byParent[(string) $parentId] ?? [] as $category) {
                $node = $category->toTreeNode();
                $node['children'] = $build((int) $category->id);
                $children[] = $node;
            }

            return $children;
        };

        return $this->success($build(null), '', 200, [
            'serviceability' => $this->serviceability->payload($resolved),
        ]);
    }

    public function brands(Request $request)
    {
        $resolved = $this->serviceability->resolveFromRequest($request);

        $brands = ($resolved['serviceable'] ?? false)
            ? Brand::where('is_active', true)
                ->orderBy('name')
                ->get()
            : collect();

        return $this->success($brands, '', 200, [
            'serviceability' => $this->serviceability->payload($resolved),
        ]);
    }

    /**
     * Bookable delivery slots for a grocery store, grouped by local date.
     *
     * Returns only slots a customer can still take right now: active, inside
     * the booking window, and with spare capacity past the lead time.
     */
    public function deliverySlots(Request $request, ?int $store = null)
    {
        $request->validate([
            'store_id' => 'sometimes|integer|exists:stores,id',
            'days' => 'sometimes|integer|min:1',
        ]);

        $storeId = $store ?? $request->integer('store_id');

        if (! $storeId) {
            return $this->error('store_id is required', null, 422);
        }

        $storeModel = Store::find($storeId);

        if (! $storeModel) {
            return $this->error('Store not found', null, 404);
        }

        // Slots are part of the store's delivery promise: a store the location
        // cannot reach offers no bookable window either.
        $resolved = $this->serviceability->resolveFromRequest($request);

        if (! $this->serviceability->storeIsServiceable($storeModel, $resolved)) {
            return $this->error('Store not available at this location', null, 404);
        }

        $slots = $this->deliverySlotService->availabilityForStore(
            $storeModel,
            $request->has('days') ? $request->integer('days') : null
        );

        return $this->success($slots, '', 200, [
            'serviceability' => $this->serviceability->payload($resolved),
        ]);
    }
}
