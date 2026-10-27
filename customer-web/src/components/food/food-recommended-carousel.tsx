import { FoodRestaurantCard } from '@/components/food/food-restaurant-card';
import { Skeleton } from '@/components/ui/skeleton';
import type { Restaurant } from '@/types/catalog';

// The recommended rail is a horizontally scrollable, two-row CSS grid filled
// column-by-column: restaurants 1&2 form the first column, 3&4 the second, and
// so on. The grid is wider than its clipped `.rec-rail` container, so the next
// column is partially visible at the right edge and the rest are reached by
// scrolling — never by adding a third row. `--rec-gap` and the `calc()` column
// widths (see `.rec-grid` in index.css) size every card from the available
// width, so nothing is hardcoded per device.
export function FoodRecommendedCarousel({
  restaurants,
  distanceFor,
}: {
  restaurants: Restaurant[];
  distanceFor: (restaurant: Restaurant) => number | null;
}) {
  return (
    <div className="rec-rail no-scrollbar">
      <div className="rec-grid">
        {restaurants.map((restaurant) => (
          <FoodRestaurantCard key={restaurant.id} restaurant={restaurant} distanceKm={distanceFor(restaurant)} />
        ))}
      </div>
    </div>
  );
}

export function FoodRecommendedSkeleton() {
  return (
    <div className="rec-rail no-scrollbar" aria-hidden>
      <div className="rec-grid">
        {Array.from({ length: 6 }).map((_, index) => (
          // No white tile: the compact card it stands in for has no
          // background of its own, so the placeholder mirrors that too.
          <div key={index} className="overflow-hidden rounded-2xl">
            <Skeleton className="aspect-[5/4] w-full rounded-none" />
            <div className="space-y-1.5 p-2.5">
              <Skeleton className="h-3 w-4/5 rounded-md" />
              <Skeleton className="h-2.5 w-1/2 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
