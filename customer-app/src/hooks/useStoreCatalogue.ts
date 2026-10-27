import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { repositories } from '@/api/repositories';
import { useAppStore } from '@/stores/appStore';
import { DEFAULT_LOCATION } from '@/lib/location';
import { coordsKey } from '@/lib/geo';
import type { Product } from '@/types/catalog';

/**
 * Products for exactly one grocery store.
 *
 * Uses the existing store-scoped endpoint `GET /grocery/stores/{id}/products`,
 * which the backend already restricts with `where('store_id', $id)`, so the
 * active store is enforced on the server. The result is additionally filtered
 * client-side as a guard, so products from two stores can never be rendered
 * together.
 *
 * The query key always contains the store id, the category/search filters and
 * the delivery coordinates. Because the key changes when the active store or
 * the address changes, React Query holds a separate cache entry per store and
 * address, and the previous address's products are never shown while the next
 * request is in flight (no stale-data flash after a location change).
 *
 * The coordinates also decide serviceability: the backend returns an empty page
 * plus `meta.serviceability` when the store cannot deliver to that address, so
 * the catalogue never falls back to an unfiltered product list.
 */
export function useStoreCatalogue(
  storeId: number | null,
  options: {
    categoryId?: number | null;
    search?: string | null;
    perPage?: number;
    enabled?: boolean;
    isVeg?: boolean | null;
    /**
     * Keep the previous page rendered while the next page loads (used by the
     * category grid's "Show more"). Never enabled for the store home, where
     * showing another store's cached products would be wrong.
     */
    keepPrevious?: boolean;
  } = {}
) {
  const { categoryId = null, search = null, perPage = 60, enabled = true, isVeg = null, keepPrevious = false } = options;
  const query = search?.trim() ?? '';

  const location = useAppStore((s) => s.location);
  const origin = location ?? DEFAULT_LOCATION;

  const result = useQuery({
    // `perPage` is part of the key so "Show more products" grows the page size
    // and refetches instead of reusing the cached first page.
    queryKey: ['grocery-products', storeId, categoryId, query, isVeg, perPage, coordsKey(origin)],
    queryFn: async () => {
      if (storeId === null) return null;
      const page = await repositories.grocery.getProducts(storeId, {
        category_id: categoryId ?? undefined,
        search: query || undefined,
        per_page: perPage,
        is_veg: isVeg ?? undefined,
        latitude: origin.latitude,
        longitude: origin.longitude,
      });
      return { ...page, data: page.data.filter((p) => p.store_id === storeId) };
    },
    enabled: storeId !== null && enabled,
    placeholderData: keepPrevious ? keepPreviousData : undefined,
  });

  return {
    ...result,
    /** Products that belong to the active store. */
    products: result.data?.data ?? [],
    total: result.data?.total ?? 0,
    /** Grocery verdict for the delivery address the catalogue was requested for. */
    serviceability: result.data?.serviceability ?? null,
  };
}

/**
 * Splits a product list into the active store's products only. Used for
 * discovery payloads (`/discovery/home`) that are not store-scoped.
 */
export function productsOfStore(products: Product[] | undefined, storeId: number | null): Product[] {
  if (!products || storeId === null) return [];
  return products.filter((p) => p.store_id === storeId);
}
