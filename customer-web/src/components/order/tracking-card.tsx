import type { ReactNode } from 'react';
import { Maximize2, Truck } from 'lucide-react';
import type { OrderType } from '@/types/models';
import { cn } from '@/lib/utils';

interface TrackingCardProps {
  orderType: OrderType;
  restaurantName: string;
  restaurantLogo?: string | null;
  /** Live status copy from the order payload (e.g. "Your order is on its way"). */
  heading: string;
  /** Real, backend-derived ETA copy (e.g. "~12 min"); omitted when unknown. */
  etaLabel?: string | null;
  cancelled?: boolean;
  /** The live mini-map. When omitted the card renders without the map column. */
  map?: ReactNode;
  /** Opens the expanded-map layout. Omitted when no map is available. */
  onExpand?: () => void;
}

/**
 * The compact Zomato-style tracking card shown in the collapsed layout
 * (`customer-web` `/order/:id`), sitting directly below the promotional banner.
 *
 * Restaurant logo + name, live status and ETA pill on the left, with the live
 * mini-map and its expand affordance on the right — one intentional tracking
 * component rather than a standalone hero followed by a separate map. Every
 * value comes from the real order/tracking payload; the theme follows the order
 * service (Food red / Grocery gold).
 */
export function TrackingCard({
  orderType,
  restaurantName,
  restaurantLogo,
  heading,
  etaLabel,
  cancelled = false,
  map,
  onExpand,
}: TrackingCardProps) {
  const isGrocery = orderType === 'grocery';
  const accentText = isGrocery ? 'text-grocery-800' : 'text-food-700';
  const etaPill = isGrocery ? 'bg-grocery-100 text-grocery-800' : 'bg-food-50 text-food-700';
  const expandButton = isGrocery
    ? 'bg-grocery-500 text-ink-900 hover:bg-grocery-400'
    : 'bg-food-600 text-white hover:bg-food-700';

  return (
    <section
      aria-label="Order status"
      className="rounded-3xl border border-neutral-100 bg-white p-3 shadow-float"
    >
      <div className="flex items-stretch gap-3">
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-neutral-100">
              {restaurantLogo ? (
                <img src={restaurantLogo} alt="" className="h-full w-full object-cover" />
              ) : (
                <Truck className="h-4 w-4 text-neutral-400" />
              )}
            </span>
            <p className="truncate text-sm font-extrabold text-neutral-900">{restaurantName}</p>
          </div>

          <p className={cn('truncate text-xs font-bold', cancelled ? 'text-danger' : accentText)}>
            {cancelled ? 'Order cancelled' : heading}
          </p>

          {!cancelled && etaLabel ? (
            <span
              className={cn(
                'inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-[11px] font-extrabold',
                etaPill
              )}
            >
              Arriving in {etaLabel}
            </span>
          ) : null}
        </div>

        {map && (
          <div className="relative h-[4.5rem] w-24 shrink-0 overflow-hidden rounded-2xl bg-ink-950 sm:h-20 sm:w-32">
            {map}
            {onExpand && (
              <button
                type="button"
                onClick={onExpand}
                aria-label="Expand map"
                className={cn(
                  'absolute bottom-1.5 right-1.5 z-10 flex h-8 w-8 items-center justify-center rounded-full shadow-md transition-colors',
                  expandButton
                )}
              >
                <Maximize2 className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
