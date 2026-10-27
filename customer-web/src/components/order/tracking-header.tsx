import { RefreshCw, X } from 'lucide-react';
import type { OrderType } from '@/types/models';
import { cn } from '@/lib/utils';

interface TrackingHeaderProps {
  orderType: OrderType;
  restaurantName: string;
  heading: string;
  /** Real, backend-derived ETA copy (e.g. "~12 min"); omitted when unknown. */
  etaLabel?: string | null;
  cancelled?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Drops back to the collapsed layout (banner + compact tracking card). */
  onCollapse: () => void;
}

/**
 * The compact service-themed header shown only in the expanded-map layout
 * (`customer-web` `/order/:id`).
 *
 * It paints the same Food red / Grocery gold the global app header adopts for
 * the page, so the two read as one continuous band directly above the map.
 * Content is centered (service label, restaurant name, live status, ETA pill)
 * with the collapse control and refresh pinned to the symmetric side columns,
 * and every value comes from the real order/tracking payload — never hardcoded.
 */
export function TrackingHeader({
  orderType,
  restaurantName,
  heading,
  etaLabel,
  cancelled = false,
  refreshing = false,
  onRefresh,
  onCollapse,
}: TrackingHeaderProps) {
  const isGrocery = orderType === 'grocery';
  const controlClass = cn(
    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors',
    isGrocery ? 'bg-ink-900/10 text-ink-900 hover:bg-ink-900/20' : 'bg-white/15 text-white hover:bg-white/25'
  );
  const mutedClass = isGrocery ? 'text-ink-900/60' : 'text-white/60';

  return (
    <section
      aria-label="Order status"
      className={cn(
        'bg-gradient-to-b',
        isGrocery ? 'from-grocery-400 to-grocery-500 text-ink-900' : 'from-food-600 to-food-700 text-white'
      )}
    >
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-2.5 px-4 pb-4 pt-3">
        {/* Top row: collapse control · service label + restaurant name (true
            centre) · refresh. The symmetric side columns keep the name centred
            on the viewport, and `truncate` stops a long name from overlapping
            them. */}
        <div className="grid grid-cols-[2.25rem_minmax(0,1fr)_2.25rem] items-center gap-2">
          <button
            type="button"
            autoFocus
            onClick={onCollapse}
            aria-label="Collapse map"
            className={controlClass}
          >
            <X className="h-5 w-5" />
          </button>
          <div className="min-w-0 text-center">
            <p className={cn('truncate text-[11px] font-bold uppercase tracking-wide', mutedClass)}>
              {isGrocery ? 'Grocery order' : 'Food order'}
            </p>
            <h1 className="mt-0.5 truncate text-lg font-extrabold">{restaurantName}</h1>
          </div>
          {onRefresh ? (
            <button
              type="button"
              onClick={onRefresh}
              aria-label="Refresh order status"
              className={controlClass}
            >
              <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
            </button>
          ) : (
            <span aria-hidden className="h-9 w-9" />
          )}
        </div>

        {/* Second row: centered live order status. */}
        <p className="truncate text-center text-sm font-bold">{cancelled ? 'Order cancelled' : heading}</p>

        {/* Third row: centered ETA pill — white chip, service-tinted text. */}
        {!cancelled && etaLabel ? (
          <div className="flex justify-center">
            <span
              className={cn(
                'inline-flex items-center rounded-full bg-white px-4 py-1.5 text-sm font-extrabold shadow-pill',
                isGrocery ? 'text-grocery-800' : 'text-food-700'
              )}
            >
              Arriving in {etaLabel}
            </span>
          </div>
        ) : null}
      </div>
    </section>
  );
}
