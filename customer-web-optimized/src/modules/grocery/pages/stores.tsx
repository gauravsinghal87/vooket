import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { groceryService } from '@/modules/grocery/services';
import { useAppStore } from '@/shared/stores/appStore';
import { Card } from '@/shared/components/ui/card';
import { Rating } from '@/shared/components/ui/rating';
import { CardSkeleton } from '@/shared/components/ui/skeleton';
import { ErrorState, NoResultsState } from '@/shared/components/ui/state';
import { Input } from '@/shared/components/ui/input';
import { Store as StoreIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { GroceryServiceabilityNotice } from '@/modules/grocery/components/serviceability-notice';

export function StoresPage() {
  const [search, setSearch] = useState('');
  const location = useAppStore((s) => s.location) ?? null;
  const openLocationSelector = useAppStore((s) => s.openLocationSelector);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['stores', search, location?.latitude ?? null, location?.longitude ?? null],
    queryFn: () =>
      groceryService.getStores({
        search: search || undefined,
        latitude: location?.latitude,
        longitude: location?.longitude,
      }),
  });

  const list = data?.data ?? [];

  // Backend verdict for this address: an unserviceable location renders the
  // unavailable state instead of an empty (or worse, unfiltered) store grid.
  const serviceability = data?.serviceability ?? null;
  const notServiceable = serviceability?.is_serviceable === false;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold text-neutral-900">Stores</h1>
        <p className="text-sm text-neutral-500">Groceries near you.</p>
      </div>

      <Input
        placeholder="Search stores…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        aria-label="Search stores"
      />

      {isLoading && <CardSkeleton count={4} />}

      {isError && <ErrorState title="Couldn't load stores" action={{ label: 'Retry', onClick: () => refetch() }} />}

      {!isLoading && !isError && notServiceable && (
        <GroceryServiceabilityNotice
          serviceability={serviceability}
          onChangeLocation={openLocationSelector}
        />
      )}

      {!isLoading && !isError && !notServiceable && list.length === 0 && (
        <NoResultsState query={search} onClear={() => setSearch('')} />
      )}

      {!isLoading && !isError && !notServiceable && list.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {list.map((store) => (
            <Link key={store.id} to={`/store/${store.id}`} className="group block">
              <Card className="overflow-hidden">
                <div className="relative h-32 w-full">
                  <img src={store.cover_image ?? ''} alt={store.name} className="h-full w-full object-cover" />
                </div>
                <div className="p-3">
                  <div className="flex items-center gap-2">
                    <StoreIcon className="h-4 w-4 text-success" />
                    <h3 className="truncate text-sm font-bold text-neutral-900">{store.name}</h3>
                  </div>
                  <p className="mt-1">
                    <Rating value={store.rating} count={store.rating_count} />
                  </p>
                  <p className="mt-1 text-[11px] text-neutral-500">
                    {store.supports_instant_delivery ? 'Instant delivery · ' : ''}
                    {store.delivery_fee ? `Delivery ${store.delivery_fee}` : ''}
                  </p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
