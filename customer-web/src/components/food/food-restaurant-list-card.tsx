import { FeaturedRestaurantCard } from '@/components/restaurant/featured-restaurant-card';
import type { Restaurant } from '@/types/catalog';

/**
 * The card used by the Food restaurant feed ("restaurants delivering to you").
 *
 * These are the large, single, full-width cards: a 5:3 photo with rounded
 * corners, the dish/offer badge at the top-left and — in the white panel
 * underneath — the name in large bold type, the green pill rating hard right,
 * the ETA | distance line and the blue-icon offer row.
 *
 * There is deliberately no notch on this layout: the notched design belongs
 * to the compact grid card (`FoodRecommendedCard`).
 */
export function FoodRestaurantListCard({
  restaurant,
  distanceKm,
}: {
  restaurant: Restaurant;
  distanceKm?: number | null;
}) {
  return (
    <FeaturedRestaurantCard
      restaurant={restaurant}
      distanceKm={distanceKm}
      className="w-full"
    />
  );
}
