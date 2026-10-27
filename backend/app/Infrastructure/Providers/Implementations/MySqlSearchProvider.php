<?php

namespace App\Infrastructure\Providers\Implementations;

use App\Infrastructure\Interfaces\SearchProviderInterface;
use App\Models\Product;
use App\Models\Restaurant;
use App\Models\Store;
use Illuminate\Support\Facades\Log;

class MySqlSearchProvider implements SearchProviderInterface
{
    public function search(string $query, array $options = []): array
    {
        $type = $options['type'] ?? 'all';
        $results = [];

        if ($type === 'all' || $type === 'food') {
            $results['food'] = Restaurant::where('name', 'like', "%{$query}%")
                ->orWhere('cuisine_type', 'like', "%{$query}%")
                ->limit(20)->get();
        }

        if ($type === 'all' || $type === 'grocery') {
            $results['grocery'] = Store::where('name', 'like', "%{$query}%")
                ->limit(20)->get();
            $results['products'] = Product::where('name', 'like', "%{$query}%")
                ->with('variationOptions.values')
                ->limit(20)->get();
        }

        return $results;
    }

    public function index(string $model, array $data): bool
    {
        Log::info('[SEARCH] index', ['model' => $model]);

        return true;
    }

    public function updateIndex(string $model, string $id, array $data): bool
    {
        Log::info('[SEARCH] update', ['model' => $model, 'id' => $id]);

        return true;
    }

    public function deleteIndex(string $model, string $id): bool
    {
        Log::info('[SEARCH] delete', ['model' => $model, 'id' => $id]);

        return true;
    }

    public function reindex(string $model): bool
    {
        Log::info('[SEARCH] reindex', ['model' => $model]);

        return true;
    }
}
