import { useQuery } from '@tanstack/react-query';
import {
  fetchDiscoveryHome,
  mapFoodDiscovery,
  mapGroceryDiscovery,
  type DiscoveryLocation,
  type FoodDiscovery,
  type GroceryDiscovery,
} from '@/shared/services/discovery';
import { repositories } from '@/shared/repositories';
import { IS_MOCK } from '@/shared/config/dataSource';
import { coordsKey } from '@/shared/utils/geo';

/** Public discovery is safe to keep warm across module switches. */
const DISCOVERY_STALE_MS = 5 * 60 * 1000;
const DISCOVERY_GC_MS = 30 * 60 * 1000;

interface DiscoveryHomeData {
  food: FoodDiscovery;
  grocery: GroceryDiscovery;
}

/**
 * The single `/discovery/home` query for Food and Grocery.
 *
 * The endpoint returns both module payloads in one envelope. Those two pages
 * used to issue separate requests with separate query keys, so switching
 * modules re-downloaded the same 30–90 KB payload. Both now share this key and
 * map the cached envelope into their own module shape.
 *
 * Mock mode keeps the original mock repositories: it never calls the real
 * endpoint, and each module still receives its own mock fixture.
 *
 * The cache is cleared on login, logout and a 401 (see the auth store), so a
 * user-specific section such as `recently_ordered` can never leak between
 * accounts.
 */
export function useDiscoveryHome(origin: DiscoveryLocation) {
  const key =
    origin.latitude != null && origin.longitude != null
      ? coordsKey({ latitude: origin.latitude, longitude: origin.longitude })
      : 'none';

  const query = useQuery<DiscoveryHomeData>({
    queryKey: ['discovery-home', key],
    queryFn: async () => {
      if (IS_MOCK) {
        const [food, grocery] = await Promise.all([
          repositories.food.getHome(origin),
          repositories.grocery.getHome(origin),
        ]);
        return { food, grocery };
      }
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

  return {
    ...query,
    food: query.data?.food,
    grocery: query.data?.grocery,
  };
}
