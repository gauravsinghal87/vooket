import { Link } from 'react-router-dom';
import { Clock, Star, Zap } from 'lucide-react';
import type { Restaurant } from '@/shared/types/catalog';
import { Image } from '@/shared/components/ui/image';
import { deliveryEtaText } from '@/modules/food/utils/delivery-eta';
import { cn } from '@/shared/utils/utils';
import { restaurantOffer, restaurantRating } from '@/modules/food/components/restaurant/restaurant-card-parts';

/**
 * The compact recommendation card from the reference's "RECOMMENDED FOR YOU"
 * grid: a square photo with rounded corners, the offer chip over the top-left
 * of the photo, a green rating pill that straddles the photo's bottom-left
 * edge (white ring, no notch cut-out), the restaurant name below, and the
 * delivery estimate on the last line.
 *
 * Deliberately distinct from `NotchRestaurantCard` (the notch belongs to the
 * restaurant grids) and from `FeaturedRestaurantCard` (the large feed card).
 * Offer, rating and ETA are read through the same shared helpers every other
 * card uses, so the numbers can never disagree between layouts.
 */
export function FoodRecommendedCard({
  restaurant,
  distanceKm: _distanceKm,
}: {
  restaurant: Restaurant;
  distanceKm?: number | null;
}) {
  const rating = restaurantRating(restaurant);
  const offer = restaurantOffer(restaurant);
  // Fast kitchens get the reference's green "Near & Fast" treatment; everyone
  // else shows the backend ETA line.
  const etaMinutes = restaurant.delivery_eta?.max_minutes ?? null;
  const fast = etaMinutes !== null && etaMinutes <= 30;
  const etaText = deliveryEtaText(restaurant) ?? '—';

  return (
    <Link
      to={`/restaurant/${restaurant.id}`}
      className="tap group block min-w-0"
      aria-label={restaurant.name}
    >
      <div className="relative">
        <div className="relative aspect-[1.5/1.2] w-full overflow-hidden rounded-2xl bg-neutral-100">
          <Image
            src={restaurant.cover_image ?? restaurant.logo}
            alt=""
            eager
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
          />
          {!restaurant.is_open && (
            <span className="absolute inset-0 flex items-center justify-center bg-ink-900/55 text-[10px] font-extrabold uppercase tracking-widest text-white">
              Closed
            </span>
          )}
        </div>

        {offer && (
          <span className="absolute left-1.5 top-1.5 max-w-[calc(100%-12px)] truncate rounded bg-ink-950/75 px-1.5 py-0.5 text-[10px] font-semibold leading-tight text-white">
            {offer}
          </span>
        )}

        {rating !== null && (
          <span className="absolute -bottom-2 left-1.5 z-10 inline-flex items-center gap-0.5 rounded-full border-2 border-white bg-z-green px-1.5 py-[1px] text-[11px] font-bold leading-tight text-white shadow-sm">
            <Star className="h-2.5 w-2.5 fill-white" strokeWidth={0} />
            {rating.toFixed(1)}
          </span>
        )}
      </div>

      <p className="mt-3 truncate text-[15px] font-semibold leading-tight text-neutral-900">
        {restaurant.name}
      </p>

      <p
        className={cn(
          'mt-1 flex items-center gap-1 text-xs font-medium',
          fast ? 'text-z-green' : 'text-neutral-500'
        )}
      >
        {fast ? (
          <Zap className="h-3 w-3 shrink-0 fill-current" strokeWidth={0} />
        ) : (
          <Clock className="h-3 w-3 shrink-0" />
        )}
        <span className="truncate">{fast ? 'Near & Fast' : etaText}</span>
      </p>
    </Link>
  );
}
