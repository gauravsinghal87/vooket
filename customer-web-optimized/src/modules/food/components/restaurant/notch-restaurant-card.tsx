import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Star } from 'lucide-react';
import type { Restaurant } from '@/shared/types/catalog';
import { Image } from '@/shared/components/ui/image';
import { formatDistanceKm } from '@/shared/utils/geo';
import { deliveryDistanceKm, deliveryEtaText } from '@/modules/food/utils/delivery-eta';
import { cn } from '@/shared/utils/utils';
import {
  RestaurantVegMark,
  restaurantOffer,
  restaurantRating,
} from '@/modules/food/components/restaurant/restaurant-card-parts';

// The shared bits live in their own module so the large "featured" card can
// use the same rules without depending on this card's markup. They are
// re-exported here for the callers that already import them from this file.
export { RestaurantVegMark, restaurantOffer, restaurantRating };

export interface NotchRestaurantCardProps {
  restaurant: Restaurant;
  /** Client-side distance, used only when the API returned no routed estimate. */
  distanceKm?: number | null;
  /** `sm` is the narrow recommendation rail, `md` the restaurant grids. */
  size?: 'sm' | 'md';
  /** Load the image eagerly (above-the-fold rails) instead of lazily. */
  eager?: boolean;
  /** Extra rows rendered under the ETA line. */
  children?: ReactNode;
  className?: string;
}

/**
 * The compact restaurant card used by every restaurant grid and by the Food
 * recommendation rail.
 *
 * The design is the Swiggy-style "notched" card: a photo with rounded top
 * corners, an offer chip at the top-left and a green rating pill sitting in
 * a white notch cut into the bottom-left of the image. The card around it is
 * not a tile — no background, no shadow, no border — so the page background
 * shows through around the photo and the info area below it.
 *
 * The card carries no favourite button: the listing cards show the offer,
 * the rating and the delivery estimate only.
 *
 * This component is opt-in: it is used by the Food recommendation rail and
 * the Restaurants grid. The large, single restaurant cards use
 * `FeaturedRestaurantCard` instead, which has no notch. Nothing else in the
 * app is affected by either of them.
 */
export function NotchRestaurantCard({
  restaurant,
  distanceKm,
  size = 'md',
  eager = false,
  children,
  className,
}: NotchRestaurantCardProps) {
  const rating = restaurantRating(restaurant);
  const offer = restaurantOffer(restaurant);

  // ETA and route distance come from the backend estimate for the customer's
  // delivery location; the client-side distance is only a fallback for when the
  // API could not return a routed estimate.
  const etaText = deliveryEtaText(restaurant);
  const distanceLabel = formatDistanceKm(deliveryDistanceKm(restaurant) ?? distanceKm);
  const metaText = [etaText, distanceLabel].filter(Boolean).join(' · ') || '—';

  return (
    <Link
      to={`/restaurant/${restaurant.id}`}
      className={cn('group block h-full', className)}
      aria-label={restaurant.name}
    >
      <article className={cn('notch-card group', size === 'sm' && 'notch-card-sm')}>
        <div className="notch-media">
          <Image
            src={restaurant.cover_image ?? restaurant.logo}
            alt=""
            eager={eager}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
          <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink-950/30 via-transparent to-transparent" />

          {offer && <span className="notch-offer">{offer}</span>}

          {!restaurant.is_open && <span className="notch-closed">Closed</span>}
        </div>

        <div className="notch-body">
          {/* The notch is anchored to the top edge of this info area, so it
              always lands exactly on the image boundary. */}
          {rating !== null && (
            <div className="notch-notch">
              <span className="notch-rating">
                <Star className="h-3 w-3 fill-white" strokeWidth={0} />
                {rating.toFixed(1)}
              </span>
            </div>
          )}

          <div className="notch-name-row">
            <h3 className="notch-name">{restaurant.name}</h3>
            <RestaurantVegMark isVeg={restaurant.is_veg} size={size === 'sm' ? 12 : 14} />
          </div>

          <p className="notch-meta">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            <span className="notch-meta-text">{metaText}</span>
          </p>

          {children}
        </div>
      </article>
    </Link>
  );
}
