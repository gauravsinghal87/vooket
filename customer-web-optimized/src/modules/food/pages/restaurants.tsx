import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { foodService } from '@/modules/food/services';
import { useAppStore } from '@/shared/stores/appStore';
import { DEFAULT_LOCATION } from '@/shared/utils/location';
import { RestaurantCard } from '@/modules/food/components/restaurant/restaurant-card';
import { ServiceabilityNotice } from '@/modules/food/components/serviceability-notice';
import { CardSkeleton } from '@/shared/components/ui/skeleton';
import { ErrorState, NoResultsState } from '@/shared/components/ui/state';
import { Input } from '@/shared/components/ui/input';

export function RestaurantsPage() {
  const [search, setSearch] = useState('');
  // Same effective location as the Food home: the saved address when there is
  // one, otherwise the shared default the header shows. Every listing surface
  // resolves the same coordinates so they can never disagree.
  const location = useAppStore((s) => s.location) ?? DEFAULT_LOCATION;
  const openLocationSelector = useAppStore((s) => s.openLocationSelector);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['restaurants', search, location.latitude, location.longitude],
    queryFn: () =>
      foodService.getRestaurants({
        search: search || undefined,
        latitude: location.latitude,
        longitude: location.longitude,
      }),
  });

  const list = data?.data ?? [];
  const serviceability = data?.serviceability ?? null;
  const notServiceable = serviceability?.is_serviceable === false;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold text-neutral-900">Restaurants</h1>
        <p className="text-sm text-neutral-500">Find something delicious near you.</p>
      </div>

      <Input
        placeholder="Search restaurants…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        aria-label="Search restaurants"
      />

      {isLoading && <CardSkeleton count={6} />}

      {isError && (
        <ErrorState
          title="Couldn't load restaurants"
          action={{ label: 'Retry', onClick: () => refetch() }}
        />
      )}

      {!isLoading && !isError && notServiceable && (
        <ServiceabilityNotice serviceability={serviceability} onChangeLocation={openLocationSelector} />
      )}

      {!isLoading && !isError && !notServiceable && list.length === 0 && (
        <NoResultsState query={search} onClear={() => setSearch('')} />
      )}

      {!isLoading && !isError && !notServiceable && list.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          {list.map((r) => (
            <RestaurantCard key={r.id} restaurant={r} />
          ))}
        </div>
      )}
    </div>
  );
}
