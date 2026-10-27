<?php

namespace App\Services;

use App\Infrastructure\Interfaces\AiProviderInterface;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\User;

class AiRecommendationService
{
    public function __construct(private AiProviderInterface $ai) {}

    public function recommendFood(User $user, int $limit = 10): array
    {
        $recentOrders = $user->orders()
            ->with(['items' => fn ($q) => $q->select('product_id', 'product_name')])
            ->whereIn('status', ['DELIVERED', 'OUT_FOR_DELIVERY'])
            ->orderBy('created_at', 'desc')
            ->limit(20)
            ->get();

        $recentProducts = $recentOrders->flatMap(fn ($o) => $o->items)->pluck('product_id')->unique()->values();

        // Rule-based recommendations (fallback when AI provider is not configured)
        $recommended = Product::where('is_active', true)
            ->where('is_available', true)
            ->whereIn('category_id', Product::whereIn('id', $recentProducts)->pluck('category_id'))
            ->whereNotIn('id', $recentProducts)
            ->limit($limit)
            ->get();

        return $recommended;
    }

    public function recommendGrocery(User $user, int $limit = 10): array
    {
        $recentPurchases = OrderItem::whereHas('order', function ($q) use ($user) {
            $q->where('user_id', $user->id)->where('order_type', 'grocery');
        })
            ->latest()
            ->limit(50)
            ->get()
            ->groupBy('product_id')
            ->map(fn ($items) => [
                'product' => $items->first()->product,
                'count' => $items->count(),
                'last_purchased_at' => $items->first()->created_at,
            ])
            ->sortByDesc('count')
            ->take($limit);

        return $recentPurchases->values()->toArray();
    }

    public function frequentlyBoughtTogether(int $productId, int $limit = 6): array
    {
        // Find products frequently bought together with the given product
        $productIds = OrderItem::where('product_id', $productId)
            ->pluck('order_id')
            ->unique();

        $together = OrderItem::whereIn('order_id', $productIds)
            ->where('product_id', '!=', $productId)
            ->selectRaw('product_id, COUNT(*) as count')
            ->groupBy('product_id')
            ->orderByDesc('count')
            ->limit($limit)
            ->get()
            ->pluck('product_id');

        return Product::whereIn('id', $together)->get()->values();
    }

    public function getReplenishmentSuggestions(User $user): array
    {
        $recentPurchases = OrderItem::whereHas('order', function ($q) use ($user) {
            $q->where('user_id', $user->id)->where('order_type', 'grocery');
        })
            ->with('product')
            ->latest()
            ->get()
            ->groupBy('product_id');

        $suggestions = [];

        foreach ($recentPurchases as $productId => $items) {
            $product = $items->first()->product;
            if (! $product) {
                continue;
            }

            $count = $items->count();
            $lastPurchase = $items->first()->created_at;
            // Estimate consumption cycle: assume 30 days per unit purchased
            $estimatedDaysAgo = $lastPurchase->diffInDays(now());
            $quantityPurchased = $items->sum('quantity');
            $avgDailyUse = $quantityPurchased > 0 ? max(0.1, (float) $quantityPurchased / 30) : 0.1;
            $estimatedStockRemaining = max(0, $quantityPurchased - ($avgDailyUse * $estimatedDaysAgo));

            if ($estimatedStockRemaining < 1) {
                $suggestions[] = [
                    'product' => $product,
                    'message' => 'You may be running low on '.$product->name,
                    'last_purchased_days_ago' => (int) $estimatedDaysAgo,
                    'estimated_stock_remaining' => round($estimatedStockRemaining, 1),
                    'suggested_quantity' => 1,
                ];
            }
        }

        return $suggestions;
    }

    public function getMonthlySuggestions(User $user): array
    {
        return $this->getReplenishmentSuggestions($user);
    }
}
