import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { BadgePercent, Clock, Star } from 'lucide-react';
import type { Restaurant } from '@/types/catalog';
import { Image } from '@/components/ui/image';
import { formatDistanceKm } from '@/lib/geo';
import { deliveryDistanceKm, deliveryEtaText } from '@/lib/delivery-eta';
import { cn } from '@/lib/utils';
import { RestaurantVegMark, restaurantOffer, restaurantRating } from '@/components/restaurant/restaurant-card-parts';

/**
 * The large, single restaurant card — the one used by the "Restaurants
 * delivering to you" feed, recreated from the reference's featured card:
 *
 *  - a 5:3 photo with a dark dish badge over the top-left corner (the real
 *    `featured_item` name and price, prefixed by the veg mark) and the offer
 *    chip as a fallback when the kitchen has no featured item;
 *  - a white panel underneath: the name in large bold type with the green
 *    rounded rating pill hard right, the ETA | distance meta line, and the
 *    offer row with the blue coupon icon.
 *
 * The card carries no favourite button (the feed does not support
 * favourites) and no image carousel (restaurants expose a single cover), so
 * neither control is drawn — matching the reference only where Vooket has the
 * data to back it.
 *
 * The rating, offer and veg marker come from `restaurant-card-parts`, so this
 * layout and the compact grid card always show the same real values.
 */
export interface FeaturedRestaurantCardProps {
  restaurant: Restaurant;
  /** Client-side distance, used only when the API returned no routed estimate. */
  distanceKm?: number | null;
  /** Load the image eagerly instead of lazily. */
  eager?: boolean;
  /** Extra rows rendered under the meta line. */
  children?: ReactNode;
  className?: string;
}

export function FeaturedRestaurantCard({
  restaurant,
  distanceKm,
  eager = true,
  children,
  className,
}: FeaturedRestaurantCardProps) {
  const rating = restaurantRating(restaurant);
  const offer = restaurantOffer(restaurant);
  const featuredItem = restaurant.featured_item ?? null;

  // ETA and route distance come from the backend estimate for the customer's
  // delivery location; the client-side distance is only a fallback for when the
  // API could not return a routed estimate. The reference separates the two
  // with a pipe, not a middot.
  const etaText = deliveryEtaText(restaurant);
  const distanceLabel = formatDistanceKm(deliveryDistanceKm(restaurant) ?? distanceKm);
  const metaText = [etaText, distanceLabel].filter(Boolean).join(' | ') || '—';

  // The badge over the photo names the featured dish and its real price, as
  // in the reference; kitchens without one fall back to their offer text.
  const badgeText = featuredItem
    ? `${featuredItem.name} · ₹${Number(featuredItem.price).toLocaleString('en-IN')}`
    : offer;

  return (
    <Link
      to={`/restaurant/${restaurant.id}`}
      className={cn('group block', className)}
      aria-label={restaurant.name}
    >
      <article className="overflow-hidden rounded-3xl border border-neutral-200/80 bg-white shadow-card transition-transform duration-200 hover:-translate-y-0.5">
        <div className="relative aspect-[5/3] w-full overflow-hidden bg-neutral-100">
          <Image
            src={restaurant.cover_image ?? restaurant.logo}
            eager={eager}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />

          {badgeText && (
            <span className="absolute left-3 top-3 z-10 flex max-w-[calc(100%-64px)] items-center gap-1.5 rounded-md bg-ink-950/80 px-2 py-1 text-[13px] font-medium leading-tight text-white backdrop-blur-sm">
              {featuredItem && <RestaurantVegMark isVeg={restaurant.is_veg} size={13} />}
              <span className="truncate">{badgeText}</span>
            </span>
          )}

          {!restaurant.is_open && (
            <span className="absolute inset-0 z-10 flex items-center justify-center bg-ink-900/55 text-[11px] font-extrabold uppercase tracking-widest text-white backdrop-blur-sm">
              Closed
            </span>
          )}
        </div>

        <div className="min-w-0 p-4">
          {/* The name and the rating pill share this row: the name takes the
              free space on the left, the pill sits hard against the right
              edge — inside the white panel, never over the photo. */}
          <div className="flex items-start justify-between gap-3">
            <h3 className="min-w-0 flex-1 truncate text-2xl font-bold leading-tight tracking-tight text-neutral-900">
              {restaurant.name}
            </h3>
            {rating !== null && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-z-green px-2.5 py-1 text-[13px] font-bold leading-none text-white">
                <Star className="h-3.5 w-3.5 fill-white" strokeWidth={0} />
                {rating.toFixed(1)}
              </span>
            )}
          </div>

          <p className="mt-1.5 flex items-center gap-1.5 text-sm font-medium text-neutral-500">
            <Clock className="h-4 w-4 shrink-0" />
            <span className="truncate">{metaText}</span>
          </p>

          {offer && (
            <p className="mt-1.5 flex items-center gap-1.5 text-sm font-semibold text-z-info">
              <BadgePercent className="h-4 w-4 shrink-0" />
              <span className="truncate">{offer}</span>
            </p>
          )}

          {children}
        </div>
      </article>
    </Link>
  );
}
