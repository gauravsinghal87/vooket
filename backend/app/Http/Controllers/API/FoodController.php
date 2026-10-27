<?php

namespace App\Http\Controllers\API;

use App\Models\Category;
use App\Models\Restaurant;
use App\Services\Delivery\FoodRestaurantEtaService;
use App\Services\Delivery\FoodServiceabilityService;
use Illuminate\Http\Request;

class FoodController extends BaseController
{
    public function __construct(
        private FoodRestaurantEtaService $eta,
        private FoodServiceabilityService $serviceability,
    ) {}

    public function restaurants(Request $request)
    {
        $query = Restaurant::where('is_open', true)
            ->with(['vendor:id,business_name,logo,cover_image'])
            ->withAvg('reviews as avg_rating', 'rating');

        // Zone-based visibility: an unresolvable or unserviceable location
        // yields no restaurants at all (the backend never falls back to a full
        // list), and only outlets inside the resolved Food zone / search radius
        // are listed.
        $resolved = $this->serviceability->resolveFromRequest($request);
        $this->serviceability->constrain($query, $resolved);

        if ($request->has('cuisine')) {
            $query->where('cuisine_type', $request->cuisine);
        }

        if ($request->has('search')) {
            $query->where('name', 'like', "%{$request->search}%");
        }

        $categoryIds = $this->resolveCategoryIds($request->input('category'));

        if ($categoryIds !== null) {
            $query->whereHas('products', function ($products) use ($categoryIds) {
                $products->where('is_active', true)
                    ->where('is_available', true)
                    ->where('type', 'food')
                    ->whereIn('category_id', $categoryIds);
            });
        }

        if ($request->has('latitude') && $request->has('longitude')) {
            $query->orderByRaw('ABS(latitude - ?) + ABS(longitude - ?)', [
                $request->latitude,
                $request->longitude,
            ]);
        } else {
            $query->orderBy('is_featured', 'desc');
        }

        $restaurants = $query->paginate($request->get('per_page', 15));

        $this->eta->attach($restaurants->getCollection(), FoodRestaurantEtaService::destinationFrom($request));

        return $this->success($restaurants, '', 200, [
            'serviceability' => $this->serviceability->payload($resolved),
        ]);
    }

    public function restaurantDetail(Request $request, $id)
    {
        $restaurant = Restaurant::with(['vendor:id,business_name,logo,cover_image'])
            ->withAvg('reviews as avg_rating', 'rating')
            ->withCount('reviews as review_count')
            ->find($id);

        if (! $restaurant) {
            return $this->error('Restaurant not found', null, 404);
        }

        $restaurant->load([
            'products' => fn ($q) => $q->where('is_active', true)->where('is_available', true),
            'products.category',
            'products.variationOptions' => fn ($opts) => $opts->with('values'),
        ]);

        $this->eta->attach([$restaurant], FoodRestaurantEtaService::destinationFrom($request));

        return $this->success($restaurant);
    }

    public function menu($id)
    {
        $restaurant = Restaurant::find($id);

        if (! $restaurant) {
            return $this->error('Restaurant not found', null, 404);
        }

        $categories = Category::whereHas('products', function ($q) use ($id) {
            $q->where('restaurant_id', $id)->where('is_active', true);
        })
            ->with(['products' => function ($q) use ($id) {
                $q->where('restaurant_id', $id)
                    ->where('is_active', true)
                    ->where('is_available', true)
                    ->with(['addons', 'variants'])
                    ->with(['variationOptions' => fn ($opts) => $opts->orderBy('sort_order')->with('values')]);
            }])
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->get();

        return $this->success($categories);
    }

    public function categories()
    {
        $categories = Category::where('is_active', true)
            ->whereNull('parent_id')
            ->where(function ($q) {
                $q->where('type', 'food')->orWhereNull('type');
            })
            ->with('children')
            ->orderBy('sort_order')
            ->get();

        return $this->success($categories);
    }

    public function cuisines()
    {
        $cuisines = Restaurant::where('is_open', true)
            ->whereNotNull('cuisine_type')
            ->distinct()
            ->pluck('cuisine_type');

        return $this->success($cuisines);
    }

    /**
     * Resolve the optional `category` query parameter (a Food category ID or
     * slug) into the category tree IDs used to filter restaurants by the food
     * products they actually sell.
     *
     * Returns null when no category filter is requested, so callers keep the
     * default unfiltered listing. An unknown category resolves to an empty
     * array, which intentionally matches no restaurants instead of falling back
     * to the full list.
     *
     * @return array<int, int>|null
     */
    private function resolveCategoryIds(mixed $category): ?array
    {
        if ($category === null || $category === '') {
            return null;
        }

        if (is_string($category) && strtolower($category) === 'all') {
            return null;
        }

        $model = Category::query()
            ->where('type', 'food')
            ->where(fn ($query) => $query->where('id', $category)->orWhere('slug', $category))
            ->first();

        if (! $model) {
            return [];
        }

        return $model->subtreeIds();
    }
}
