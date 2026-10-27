<?php

namespace App\Http\Controllers\API;

use App\Infrastructure\Interfaces\SearchProviderInterface;
use App\Models\Banner;
use App\Models\Category;
use App\Models\Coupon;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\Restaurant;
use App\Models\Store;
use App\Services\AiRecommendationService;
use App\Services\Delivery\FoodRestaurantEtaService;
use App\Services\Delivery\FoodServiceabilityService;
use App\Services\Delivery\GroceryServiceabilityService;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Validator;

class DiscoveryController extends BaseController
{
    public function __construct(
        private SearchProviderInterface $search,
        private AiRecommendationService $ai,
        private FoodRestaurantEtaService $eta,
        private FoodServiceabilityService $serviceability,
        private GroceryServiceabilityService $groceryServiceability,
    ) {}

    public function home(Request $request)
    {
        $user = $request->user();

        // Zone-based visibility: every Food rail on this endpoint draws from the
        // same serviceable set, so no section can expose an out-of-zone outlet.
        $resolved = $this->serviceability->resolveFromRequest($request);

        // Grocery resolves the very same coordinates against the Grocery zones,
        // with its own flag, radius and cross-zone rule.
        $groceryResolved = $this->groceryServiceability->resolveFromRequest($request);

        $restaurantsQuery = Restaurant::where('is_open', true)
            ->with(['vendor:id,business_name,logo,cover_image'])
            ->withAvg('reviews as avg_rating', 'rating')
            ->orderBy('is_featured', 'desc');

        $this->serviceability->constrain($restaurantsQuery, $resolved);

        $restaurants = $restaurantsQuery->get();

        // Attach the browsing ETA before the rails are sliced so every food
        // collection shares the same per-restaurant estimate.
        $this->eta->attach($restaurants, FoodRestaurantEtaService::destinationFrom($request));

        $storesQuery = Store::where('is_open', true)
            ->with(['vendor:id,business_name,logo,cover_image'])
            ->withAvg('reviews as avg_rating', 'rating')
            ->orderBy('is_featured', 'desc');

        $this->groceryServiceability->constrainStores($storesQuery, $groceryResolved);

        $stores = $storesQuery->get();

        $activeBanners = Banner::active()
            ->orderBy('sort_order')
            ->orderByDesc('id')
            ->get();

        $foodBanners = $activeBanners->filter(fn (Banner $b) => $this->matchesServiceSlot($b, 'food'))->values();
        $groceryBanners = $activeBanners->filter(fn (Banner $b) => $this->matchesServiceSlot($b, 'grocery'))->values();

        $popular = $restaurants->take(8)->values();
        $top = $restaurants->sortByDesc('avg_rating')->values()->take(8);
        $fast = $restaurants->sortBy('avg_delivery_time_min')->values()->take(8);
        $offers = $restaurants->sortByDesc('id')->values()->take(6);
        $recommended = $popular;

        $recentlyOrdered = collect();
        $buyAgain = collect();
        $monthlyEssentials = [];
        $recentlyViewed = [];

        if ($user) {
            $recentFoodIds = Order::where('user_id', $user->id)
                ->where('order_type', 'food')
                ->whereNotNull('restaurant_id')
                ->latest()
                ->limit(10)
                ->pluck('restaurant_id');

            $recentlyOrdered = $restaurants->whereIn('id', $recentFoodIds)->values()->take(8);

            $buyAgain = OrderItem::whereHas('order', fn ($q) => $q->where('user_id', $user->id)->where('order_type', 'grocery'))
                ->with('product.brand', 'product.variationOptions.values')
                ->latest()
                ->limit(10)
                ->get()
                ->pluck('product')
                ->filter()
                ->unique('id')
                // Reorder history is still Grocery data: it only survives when
                // the store behind it can deliver to the selected location.
                ->filter(fn ($product) => $this->groceryServiceability->productIsServiceable($product, $groceryResolved))
                ->values()
                ->take(8);

            $monthlyEssentials = collect($this->ai->getMonthlySuggestions($user))
                ->map(function ($s) {
                    $product = $s['product'] ?? null;
                    if (! $product) {
                        return null;
                    }
                    $quantity = (int) ($s['suggested_quantity'] ?? 1);

                    return [
                        'id' => $product->id,
                        'product' => $product,
                        'recommendedQuantity' => max(1, $quantity),
                        'unitLabel' => $product->unit_label ?? '',
                        'lastPurchased' => $product->updated_at?->toDateString() ?? now()->toDateString(),
                        'suggestedReorderDate' => now()->addDays(7)->toDateString(),
                        'isEssential' => false,
                    ];
                })
                ->filter()
                ->filter(fn ($s) => $this->groceryServiceability->productIsServiceable($s['product'], $groceryResolved))
                ->values()
                ->all();
        }

        $groceryDealsQuery = Product::where('is_active', true)
            ->where('is_available', true)
            ->where('type', 'grocery')
            ->whereNotNull('compare_at_price')
            ->whereColumn('compare_at_price', '>', 'price')
            ->with(['brand', 'variationOptions.values']);

        $this->groceryServiceability->constrainProducts($groceryDealsQuery, $groceryResolved);

        $groceryDeals = $groceryDealsQuery->latest()
            ->limit(8)
            ->get();

        $groceryRecommendedQuery = Product::where('is_active', true)
            ->where('is_available', true)
            ->where('type', 'grocery')
            ->where('is_featured', true)
            ->with(['brand', 'variationOptions.values']);

        $this->groceryServiceability->constrainProducts($groceryRecommendedQuery, $groceryResolved);

        $groceryRecommended = $groceryRecommendedQuery->latest()
            ->limit(8)
            ->get();

        $groceryCategories = ($groceryResolved['serviceable'] ?? false)
            ? Category::where('is_active', true)
                ->whereNull('parent_id')
                ->where(function ($q) {
                    $q->where('type', 'grocery')->orWhereNull('type');
                })
                ->with('children')
                ->orderBy('sort_order')
                ->get()
            : collect();

        $foodBanners = $activeBanners->filter(fn (Banner $b) => $this->matchesServiceSlot($b, 'food'))->values();
        $groceryBanners = $activeBanners->filter(fn (Banner $b) => $this->matchesServiceSlot($b, 'grocery'))->values();

        $foodDeals = Product::where('is_active', true)
            ->where('is_available', true)
            ->where('type', 'food')
            ->whereNotNull('compare_at_price')
            ->whereColumn('compare_at_price', '>', 'price')
            ->with(['brand', 'variationOptions.values'])
            ->latest()
            ->limit(10)
            ->get();

        $dealIds = $foodDeals->pluck('id');

        $foodProducts = Product::where('is_active', true)
            ->where('is_available', true)
            ->where('type', 'food')
            ->whereNotIn('id', $dealIds)
            ->with(['brand', 'variationOptions.values'])
            ->orderBy('is_featured', 'desc')
            ->latest()
            ->limit(10)
            ->get();

        return $this->success([
            'recommended_restaurants' => $recommended,
            'food' => [
                'recommended' => $recommended,
                'popular' => $popular,
                'top' => $top,
                'fast' => $fast,
                'offers' => $offers,
                'recently_ordered' => $recentlyOrdered,
                'products' => $foodProducts,
                'deals' => $foodDeals,
                'banners' => $foodBanners,
            ],
            'grocery' => [
                'buy_again' => $buyAgain,
                'monthly_essentials' => $monthlyEssentials,
                'recommended' => $groceryRecommended,
                'deals' => $groceryDeals,
                'stores' => $stores,
                'categories' => $groceryCategories,
                'recently_viewed' => $recentlyViewed,
                'banners' => $groceryBanners,
            ],
            'offers' => $this->couponsAsOffers(['food', 'grocery']),
            'categories' => Category::where('is_active', true)->limit(20)->get(),
        ], '', 200, [
            'serviceability' => $this->serviceability->payload($resolved),
            'grocery_serviceability' => $this->groceryServiceability->payload($groceryResolved),
        ]);
    }

    public function search(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'query' => 'sometimes|string|min:1|max:100',
            'q' => 'sometimes|string|min:1|max:100',
            'type' => 'sometimes|in:all,food,grocery,rides',
            'scope' => 'sometimes|in:all,food,grocery,rides',
            'latitude' => 'sometimes|numeric|between:-90,90',
            'longitude' => 'sometimes|numeric|between:-180,180',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        $query = trim((string) ($request->input('query', $request->input('q', ''))));
        $type = $request->input('type', $request->input('scope', 'all'));

        if ($query === '') {
            return $this->error('A search query is required', null, 422);
        }

        $results = $this->search->search($query, [
            'type' => in_array($type, ['food', 'grocery', 'rides']) ? $type : 'all',
        ]);

        // Restaurant results obey the same zone rules as the listings: an outlet
        // outside the resolved Food zone never surfaces in search either.
        $resolved = $this->serviceability->resolveFromRequest($request);

        $restaurants = $results['food'] ?? [];

        if ($restaurants instanceof Collection) {
            $restaurants = $restaurants
                ->map(fn (Restaurant $restaurant) => $restaurant->loadMissing('vendor'))
                ->filter(fn (Restaurant $restaurant) => $this->serviceability->restaurantIsServiceable($restaurant, $resolved))
                ->values();
        }

        // Grocery results obey the Grocery zone rules of the same coordinates:
        // a store (and therefore its products) outside the resolved Grocery
        // zone or its search radius never surfaces in search either.
        $groceryResolved = $this->groceryServiceability->resolveFromRequest($request);

        $stores = $results['grocery'] ?? [];

        if ($stores instanceof Collection) {
            $stores = $stores
                ->map(fn (Store $store) => $store->loadMissing('vendor'))
                ->filter(fn (Store $store) => $this->groceryServiceability->storeIsServiceable($store, $groceryResolved))
                ->values();
        }

        $products = $results['products'] ?? [];

        if ($products instanceof Collection) {
            // A Grocery-scoped search only ever answers with grocery products;
            // anything else belongs to the Food search results.
            if ($type === 'grocery') {
                $products = $products->filter(fn (Product $product) => $product->type === 'grocery');
            }

            $products = $products
                ->map(fn (Product $product) => $product->loadMissing('store'))
                ->filter(fn (Product $product) => $this->groceryServiceability->productIsServiceable($product, $groceryResolved))
                ->values();
        }

        return $this->success([
            'restaurants' => $restaurants,
            'stores' => $stores,
            'products' => $products,
            'categories' => [],
        ], '', 200, [
            'serviceability' => $this->serviceability->payload($resolved),
            'grocery_serviceability' => $this->groceryServiceability->payload($groceryResolved),
        ]);
    }

    public function ridesPromos()
    {
        return $this->success($this->couponsAsOffers(['rides']));
    }

    /**
     * Customer-facing banner endpoint, filtered by service and placement.
     *
     * GET /api/v1/banners?service=food&placement=food_home_hero
     */
    public function banners(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'service' => 'sometimes|in:food,grocery,rides,all',
            'placement' => 'sometimes|string|max:40',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        $service = (string) $request->input('service', 'all');
        $placement = $request->input('placement');

        $query = Banner::active()->orderBy('sort_order')->orderByDesc('id');

        // Banners are scoped to the requesting service: a service page only ever
        // sees banners tagged for it (or the shared `all`/null tag), then narrowed
        // to the exact placement it renders.
        $query->where(function ($q) use ($service) {
            $q->whereNull('service')->orWhere('service', Banner::SERVICE_ALL);
            if ($service !== Banner::SERVICE_ALL) {
                $q->orWhere('service', $service);
            }
        });

        $query->where(function ($q) use ($placement) {
            $q->whereNull('placement');
            if ($placement !== null && $placement !== '') {
                $q->orWhere('placement', $placement);
            }
        });

        $banners = $query->get()->map(fn (Banner $b) => $this->customerBanner($b))->values();

        return $this->success($banners, 'Banners retrieved');
    }

    private function customerBanner(Banner $banner): array
    {
        return [
            'id' => $banner->id,
            'service' => $banner->service,
            'placement' => $banner->placement,
            'title' => $banner->title,
            'subtitle' => $banner->subtitle,
            'cta_text' => $banner->cta_text,
            'media_type' => $banner->media_type,
            'media_url' => $banner->media_type === 'video' && $banner->video ? $banner->video : $banner->image,
            'image' => $banner->image,
            'video' => $banner->video,
            'poster_image' => $banner->poster_image,
            'target_type' => $banner->target_type,
            'target_id' => $banner->target_id,
            'target_url' => $banner->target_url,
            'sort_order' => $banner->sort_order,
            'ends_at' => $banner->expires_at?->toIso8601String(),
        ];
    }

    /**
     * Whether a banner is eligible for the given service's slot.
     *
     * `$service` is the service-specific hero slot (e.g. "food" matches
     * "food_home_hero"). A banner qualifies when its service is null/"all"/the
     * requested service and its placement is null or that service's hero.
     */
    private function matchesServiceSlot(Banner $banner, string $service): bool
    {
        return ($banner->service === null
            || $banner->service === Banner::SERVICE_ALL
            || $banner->service === $service)
            && ($banner->placement === null
                || $banner->placement === $service.'_home_hero');
    }

    public function categories()
    {
        return $this->success(Category::where('is_active', true)
            ->with('children')
            ->whereNull('parent_id')
            ->orderBy('sort_order')->get());
    }

    public function featured(Request $request)
    {
        $resolved = $this->serviceability->resolveFromRequest($request);
        $groceryResolved = $this->groceryServiceability->resolveFromRequest($request);

        $storesQuery = Store::where('is_featured', true)->where('is_open', true);

        $this->groceryServiceability->constrainStores($storesQuery, $groceryResolved);

        return $this->success([
            'restaurants' => Restaurant::where('is_featured', true)->where('is_open', true)->get(),
            'stores' => $storesQuery->get(),
            // Featured groceries follow their store's zone; non-grocery
            // products stay with the Food rules that already own them.
            'products' => Product::where('is_featured', true)
                ->where('is_active', true)
                ->where(function ($query) use ($groceryResolved) {
                    $query->where('type', '!=', 'grocery')
                        ->orWhereHas('store', fn ($store) => $this->groceryServiceability->constrainStores($store, $groceryResolved));
                })
                ->with('variationOptions.values')
                ->get(),
        ], '', 200, [
            'serviceability' => $this->serviceability->payload($resolved),
            'grocery_serviceability' => $this->groceryServiceability->payload($groceryResolved),
        ]);
    }

    private function couponsAsOffers(array $services): array
    {
        return Coupon::where('is_active', true)
            ->whereIn('service', $services)
            ->where(function ($q) {
                $q->whereNull('starts_at')->orWhere('starts_at', '<=', now());
            })
            ->where(function ($q) {
                $q->whereNull('expires_at')->orWhere('expires_at', '>', now());
            })
            ->latest()
            ->limit(10)
            ->get()
            ->map(function ($coupon) {
                $value = (float) $coupon->value;
                $title = $coupon->name
                    ?? ($coupon->type === 'fixed' ? "Flat ₹{$value} off" : "{$value}% off");

                return [
                    'id' => $coupon->id,
                    'title' => $title,
                    'subtitle' => $coupon->description,
                    'tag' => null,
                    'type' => $coupon->type === 'fixed' ? 'flat' : 'percentage',
                    'value' => $value,
                    'code' => $coupon->code,
                    'service' => $coupon->service === 'rides' ? 'rides' : ($coupon->service === 'grocery' ? 'grocery' : 'food'),
                    'min_order' => $coupon->min_order_amount !== null ? (string) $coupon->min_order_amount : null,
                    'ends_at' => optional($coupon->expires_at)->toIso8601String(),
                ];
            })
            ->values()
            ->all();
    }
}
