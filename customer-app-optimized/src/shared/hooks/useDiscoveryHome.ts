import { useQuery } from '@tanstack/react-query';
import {
  fetchDiscoveryHome,
  mapFoodDiscovery,
  mapGroceryDiscovery,
  type DiscoveryLocation,
  type FoodDiscovery,
  type GroceryDiscovery,
} from '@/shared/repositories/discovery';
import { coordsKey } from '@/shared/utils/geo';

/** Public discovery is safe to keep warm across module switches. */
const DISCOVERY_STALE_MS = 5 * 60 * 1000;
const DISCOVERY_GC_MS = 30 * 60 * 1000;

interface DiscoveryHomeData {
  food: FoodDiscovery;
  grocery: GroceryDiscovery;
}

/**
 * One `/discovery/home` query for the Food and Grocery homes.
 *
 * The endpoint already returns both module payloads. Previously each home
 * fetched the same envelope with a different query key, so switching modules
 * downloaded it again. Both now share this key and map the cached envelope into
 * their own shape. The cache is cleared on login, logout and a 401 so
 * user-specific rails cannot leak between accounts.
 */
export function useDiscoveryHome(origin: DiscoveryLocation) {
  const key =
    origin.latitude != null && origin.longitude != null
      ? coordsKey({ latitude: origin.latitude, longitude: origin.longitude })
      : 'none';

  return useQuery<DiscoveryHomeData>({
    queryKey: ['discovery-home', key],
    queryFn: async () => {
      const { data, meta } = await fetchDiscoveryHome(origin);
      return {
        food: mapFoodDiscovery(data, meta),
        grocery: mapGroceryDiscovery(data, meta),
      };
    },
    staleTime: DISCOVERY_STALE_MS,
    gcTime: DISCOVERY_GC_MS,
    refetchOnWindowFocus: false,
  });
}
