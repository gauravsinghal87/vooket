import type { Restaurant } from '@/types/catalog';

/**
 * The bits every restaurant card shares, no matter which layout it uses.
 *
 * They live in their own module — outside both the compact "notch" card and
 * the large "featured" card — so the two layouts use exactly the same rules
 * for the rating and the offer without either card depending on the other's
 * markup. That keeps the grid/large boundary explicit: the notch is a
 * *layout* decision, the rating value is not.
 */

/**
 * The restaurant's real rating, or null when the API reported none.
 *
 * `avg_rating` (the reviews average) wins over the stored `rating` column.
 * A missing, unparseable or non-positive value yields null so the card can
 * simply omit the badge — a rating is never invented and `NaN` can never
 * reach the screen.
 */
export function restaurantRating(restaurant: Restaurant): number | null {
  const raw = restaurant.avg_rating ?? restaurant.rating;
  const parsed = parseFloat(String(raw ?? ''));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * The restaurant's real promotion, or null when it has none.
 *
 * A restaurant only ever carries a free-delivery rule, so the chip names that
 * rule (with its real threshold) instead of a generic label. It is omitted
 * entirely when there is neither a threshold nor a free delivery fee.
 */
export function restaurantOffer(restaurant: Restaurant): string | null {
  const freeAbove = restaurant.free_delivery_above ? parseFloat(restaurant.free_delivery_above) : null;
  if (freeAbove !== null && Number.isFinite(freeAbove) && freeAbove > 0) {
    return `Free above ₹${freeAbove.toLocaleString('en-IN')}`;
  }
  if (parseFloat(restaurant.delivery_fee) === 0) return 'Free delivery';
  return null;
}
