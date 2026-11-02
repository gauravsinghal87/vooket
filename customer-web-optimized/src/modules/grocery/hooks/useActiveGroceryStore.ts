import { useQuery } from '@tanstack/react-query';
import { groceryService } from '@/modules/grocery/services';
import { useAppStore } from '@/shared/stores/appStore';
import { DEFAULT_LOCATION } from '@/shared/utils/location';
import { coordsKey, nearestEligibleStore, type RankedStore } from '@/shared/utils/geo';
import type { Location } from '@/shared/types/catalog';

/**
 * Resolves the single grocery store the customer is shopping from.
 *
 * USER LOCATION -> available grocery stores -> Haversine distance
 *                -> nearest eligible store -> active store
 *
 * The store list comes from the existing `GET /grocery/stores` endpoint, which
 * the backend already limits to open stores. Client-side we additionally skip
 * pickup-only stores and any store without usable coordinates, then rank by
 * real great-circle distance rather than by API ordering.
 *
 * Re-runs automatically whenever the selected location changes, because the
 * query key is derived from the coordinates.
 */
export function useActiveGroceryStore() {
  const location = useAppStore((s) => s.location);
  const origin: Location | null = location ?? DEFAULT_LOCATION;

  const query = useQuery({
    queryKey: ['grocery', 'active-store', coordsKey(origin)],
    queryFn: () =>
      groceryService.getStores({
        latitude: origin.latitude,
        longitude: origin.longitude,
        per_page: 50,
      }),
    staleTime: 1000 * 60 * 5,
  });

  const ranked: RankedStore | null = nearestEligibleStore(query.data?.data ?? [], origin);

  return {
    ...query,
    /** Coordinates the store was resolved for (falls back to the app default). */
    origin,
    /**
     * Grocery serviceability of those coordinates, straight from the backend.
     * `null` while the first request is still in flight; when it reports the
     * location as unserviceable the store list is empty for real, so callers
     * render the unavailable-location state instead of a "no stores" list.
     */
    serviceability: query.data?.serviceability ?? null,
    ranked,
    /** The one active grocery store, or null while loading / none available. */
    activeStore: ranked?.store ?? null,
    activeStoreId: ranked?.store.id ?? null,
    distanceKm: ranked?.distanceKm ?? null,
  };
}
