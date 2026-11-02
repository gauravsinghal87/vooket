import type { Restaurant } from '@/shared/types/catalog';
import { FoodRecommendedCard } from './food-recommended-card';
import { Skeleton } from '@/shared/components/ui/skeleton';

/**
 * The Food home's recommendation block, laid out like the reference: a
 * horizontally scrollable rail of two fixed rows, filled column-by-column
 * (restaurants 1&2 form the first column, 3&4 the second, …) with three
 * restaurants visible per row on phones. The grid is wider than its clipped
 * `.rec-rail` container, so the next column peeks in at the right edge and
 * the rest are reached by scrolling — never by growing a third row.
 * `--rec-gap` and the `calc()` column widths (see `.rec-grid` in index.css)
 * size every card from the available width, so nothing is hardcoded per
 * device.
 */
export function FoodRecommendedGrid({
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
          <FoodRecommendedCard
            key={restaurant.id}
            restaurant={restaurant}
            distanceKm={distanceFor(restaurant)}
          />
        ))}
      </div>
    </div>
  );
}

export function FoodRecommendedGridSkeleton() {
  return (
    <div className="rec-rail no-scrollbar" aria-hidden>
      <div className="rec-grid">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="min-w-0">
            <Skeleton className="aspect-[1.5/1.2] w-full rounded-2xl" />
            <div className="space-y-1.5 pt-3">
              <Skeleton className="h-3.5 w-4/5 rounded-md" />
              <Skeleton className="h-3 w-1/2 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
