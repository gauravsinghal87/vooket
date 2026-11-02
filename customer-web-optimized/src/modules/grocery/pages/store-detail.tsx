import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { groceryService } from '@/modules/grocery/services';
import { useAppStore } from '@/shared/stores/appStore';
import { DEFAULT_LOCATION } from '@/shared/utils/location';
import { coordsKey } from '@/shared/utils/geo';
import { GroceryServiceabilityNotice } from '@/modules/grocery/components/serviceability-notice';
import { Card } from '@/shared/components/ui/card';
import { Rating } from '@/shared/components/ui/rating';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/shared/components/ui/state';
import { ProductCard } from '@/shared/components/product/product-card';
import { ViewCartBar } from '@/features/cart/components/view-cart-bar';
import { useCart } from '@/features/cart/hooks/useCart';
import { cn } from '@/shared/utils/utils';

export function StorePage() {
  const { id } = useParams();
  const storeId = Number(id);

  // The store and its catalogue are resolved against the current delivery
  // address: the key includes the coordinates, so changing the address refetches
  // instead of showing the previous address's store.
  const location = useAppStore((s) => s.location);
  const openLocationSelector = useAppStore((s) => s.openLocationSelector);
  const origin = location ?? DEFAULT_LOCATION;
  const coords = { latitude: origin.latitude, longitude: origin.longitude };

  const store = useQuery({
    queryKey: ['store', storeId, coordsKey(origin)],
    queryFn: () => groceryService.getStore(storeId, coords),
    enabled: Number.isFinite(storeId),
  });

  const products = useQuery({
    queryKey: ['store-products', storeId, coordsKey(origin)],
    queryFn: () => groceryService.getProducts(storeId, coords),
    enabled: Number.isFinite(storeId),
  });

  // `store` is null when the backend says this location cannot reach it — the
  // unavailable state takes over instead of a "Store not found" dead end.
  const serviceability = store.data?.serviceability ?? null;
  const unavailable = !store.isLoading && serviceability?.is_serviceable === false;
  const s = store.data?.store ?? null;
  const { data: groceryCart } = useCart('grocery');
  const hasGroceryItems = (groceryCart?.items ?? []).length > 0;

  return (
    <div className={cn('mx-auto max-w-3xl space-y-6', hasGroceryItems && 'pb-24 md:pb-20')}>
      <Link to="/stores" className="inline-flex items-center gap-1 text-sm font-semibold text-success">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      {store.isLoading && <Skeleton className="h-40 w-full rounded-3xl" />}

      {store.isError && <ErrorState title="Store not found" action={{ label: 'Go back', onClick: () => history.back() }} />}

      {unavailable && (
        <GroceryServiceabilityNotice serviceability={serviceability} onChangeLocation={openLocationSelector} />
      )}

      {/*
       * The endpoint answered with no store: this delivery address cannot reach
       * it (same wording the backend returns). It is a location problem, so it
       * offers the same way out as the unavailable state above — a store id that
       * does not exist at all comes back as a 404 and still renders "Store not
       * found" through the error branch.
       */}
      {!store.isLoading && !store.isError && !unavailable && !s && (
        <EmptyState
          title="Store not available at this location"
          description="This store doesn't deliver to your current delivery address. Try another delivery address to see stores available near you."
          action={{ label: 'Change location', onClick: openLocationSelector }}
        />
      )}

      {s && (
        <>
          <Card className="overflow-hidden">
            <div className="relative h-40 w-full">
              <img src={s.cover_image ?? ''} alt={s.name} className="h-full w-full object-cover" />
            </div>
            <div className="p-4">
              <h1 className="text-xl font-extrabold text-neutral-900">{s.name}</h1>
              <p className="mt-1 text-sm text-neutral-500">{s.address}</p>
              <div className="mt-2">
                <Rating value={s.rating} count={s.rating_count} />
              </div>
            </div>
          </Card>

          <div>
            <h2 className="mb-3 text-base font-bold text-neutral-900">Products</h2>
            {products.isLoading && <Skeleton className="h-24 w-full rounded-2xl" />}
            {products.data && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {products.data.data.map((p) => (
                  <ProductCard key={p.id} product={p} type="grocery" addSize="icon" />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <ViewCartBar type="grocery" />
    </div>
  );
}
