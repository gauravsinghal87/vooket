import { Link } from 'react-router-dom';
import { Store as StoreIcon, ChevronDown, ChevronRight, Navigation, Clock } from 'lucide-react';
import { estimateDeliveryMinutes, formatDistanceKm } from '@/shared/utils/geo';
import { cn } from '@/shared/utils/utils';
import type { Store } from '@/shared/types/catalog';

interface StoreContextProps {
  store: Store | null;
  distanceKm: number | null;
  loading?: boolean;
}

/**
 * Compact single-row store context.
 *
 * The delivery location and ETA now live in the Grocery header, so this only
 * carries the "Shopping from <store>" fact that the existing nearest-store
 * logic makes necessary.
 */
export function StoreContext({ store, distanceKm, loading }: StoreContextProps) {
  const eta = estimateDeliveryMinutes(distanceKm);
  const distance = formatDistanceKm(distanceKm);

  return (
    <div className="flex items-center gap-2.5 rounded-2xl border border-grocery-200 bg-white px-3 py-2 shadow-card">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-grocery-100 text-grocery-700">
        <StoreIcon className="h-4 w-4" />
      </span>

      {loading || !store ? (
        <span className="h-3.5 w-44 animate-pulse rounded bg-neutral-200" />
      ) : (
        <>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] leading-tight text-neutral-700">
              <span className="font-medium text-neutral-500">Shopping from </span>
              <span className="font-extrabold text-ink-900">{store.name}</span>
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2 text-[11px]">
            {distance && (
              <span className="inline-flex items-center gap-0.5 font-bold text-grocery-700">
                <Navigation className="h-3 w-3" /> {distance}
              </span>
            )}
            {store.supports_instant_delivery && eta !== null && (
              <span className="inline-flex items-center gap-0.5 font-bold text-neutral-600">
                <Clock className="h-3 w-3" /> {eta} min
              </span>
            )}
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-bold',
                store.is_open ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
              )}
            >
              <span
                className={cn('h-1.5 w-1.5 rounded-full', store.is_open ? 'bg-emerald-500' : 'bg-red-500')}
              />
              {store.is_open ? 'Open' : 'Closed'}
            </span>
            <Link
              to={`/store/${store.id}`}
              aria-label={`${store.name} details`}
              className="flex items-center gap-0.5 rounded-full border border-grocery-200 px-2 py-0.5 font-bold text-grocery-700 transition-colors hover:bg-grocery-100"
            >
              Details <ChevronDown className="h-3 w-3 -rotate-90" />
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

/** "See all products" link used above the grocery catalogue. */
export function SeeAllProductsLink({ count, to }: { count: number; to: string }) {
  if (count === 0) return null;

  return (
    <Link
      to={to}
      className="inline-flex items-center gap-0.5 rounded-full border border-grocery-200 px-2.5 py-1 text-[11px] font-extrabold text-grocery-700 transition-colors hover:bg-grocery-100"
    >
      See all products <ChevronRight className="h-3.5 w-3.5" />
    </Link>
  );
}
