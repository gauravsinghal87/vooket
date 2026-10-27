import { Bike, Clock, MapPin } from 'lucide-react';
import { NotchRestaurantCard } from '@/components/restaurant/notch-restaurant-card';
import type { Restaurant } from '@/types/catalog';

/**
 * The card used by the Restaurants grid (`/restaurants`).
 *
 * It shares the "notch" design with the Food grids — rounded top corners on
 * the image, a green rating pill in the white notch cut into the image's
 * bottom-left, and the name and the delivery estimate on the page background
 * below it.
 * The listing-specific facts (prep time, delivery fee, minimum order) stay
 * as an extra row underneath, exactly as before.
 */
export function RestaurantCard({
  restaurant,
  horizontal = false,
}: {
  restaurant: Restaurant;
  horizontal?: boolean;
}) {
  const riskfree = parseFloat(restaurant.delivery_fee) === 0 || restaurant.free_delivery_above !== null;
  const prep = restaurant.avg_delivery_time_min ?? restaurant.avg_prep_time_min ?? '—';

  return (
    <NotchRestaurantCard
      restaurant={restaurant}
      size="md"
      className={horizontal ? 'inline-block w-[248px] shrink-0 snap-start' : undefined}
    >
      <div className="mt-2 flex items-center gap-3 border-t border-neutral-100 pt-2 text-[11px] font-medium text-neutral-600">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3 text-neutral-400" /> {prep} min
        </span>
        <span className="flex items-center gap-1">
          <Bike className="h-3 w-3 text-neutral-400" />
          {riskfree ? 'Free' : `₹${restaurant.delivery_fee}`}
        </span>
        <span className="flex items-center gap-1">
          <MapPin className="h-3 w-3 text-neutral-400" />{' '}
          {restaurant.min_order_amount ? `₹${restaurant.min_order_amount}+` : '—'}
        </span>
      </div>
    </NotchRestaurantCard>
  );
}
