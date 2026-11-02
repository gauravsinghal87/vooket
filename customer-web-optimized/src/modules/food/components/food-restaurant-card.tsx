import { NotchRestaurantCard } from '@/modules/food/components/restaurant/notch-restaurant-card';
import type { Restaurant } from '@/shared/types/catalog';

/**
 * The card used by the Food recommendation rail.
 *
 * A narrow, image-first card in the shared "notch" design: the green rating
 * pill sits in the white notch cut into the bottom-left of the image instead
 * of floating over the photo, and the name and ETA sit on the page background
 * underneath.
 */
export function FoodRestaurantCard({
  restaurant,
  distanceKm,
}: {
  restaurant: Restaurant;
  distanceKm?: number | null;
}) {
  return (
    <NotchRestaurantCard
      restaurant={restaurant}
      distanceKm={distanceKm}
      size="sm"
      eager
      className="h-full"
    />
  );
}
