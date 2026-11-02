import { ChevronDown, SlidersHorizontal } from 'lucide-react';
import type { Restaurant } from '@/shared/types/catalog';
import { cn } from '@/shared/utils/utils';

/**
 * The Food home's filter model. Every field maps to a real attribute the
 * `/food/restaurants` payload already returns, so each option actually narrows
 * or reorders the results — no visual-only controls, no invented backend params.
 */
export type FoodSortId = 'recommended' | 'rating' | 'fast';

/**
 * Dish-price band. The discovery payload carries exactly one real dish price
 * per restaurant (`featured_item.price`), so the band narrows the feed by that
 * dish — never a visual-only control.
 */
export type FoodDishPriceBand = 'under200' | '200to350' | 'above350';

export interface FoodFilters {
  sort: FoodSortId;
  /** Minimum average rating, e.g. 3.5 / 4 / 4.5. `null` = any. */
  minRating: number | null;
  /** Maximum average delivery time in minutes, e.g. 30 / 45. `null` = any. */
  maxDelivery: number | null;
  freeDelivery: boolean;
  featured: boolean;
  halal: boolean;
  dineIn: boolean;
  veg: boolean;
  /** Price band for the restaurant's featured dish. `null` = any. */
  dishPrice: FoodDishPriceBand | null;
}

export const DEFAULT_FOOD_FILTERS: FoodFilters = {
  sort: 'recommended',
  minRating: null,
  maxDelivery: null,
  freeDelivery: false,
  featured: false,
  halal: false,
  dineIn: false,
  veg: false,
  dishPrice: null,
};

export const DISH_PRICE_BANDS: { id: FoodDishPriceBand; label: string; symbols: string }[] = [
  { id: 'under200', label: 'Under ₹200', symbols: '₹' },
  { id: '200to350', label: '₹200 - ₹350', symbols: '₹₹' },
  { id: 'above350', label: 'Above ₹350', symbols: '₹₹₹' },
];

function dishPriceMatches(price: number, band: FoodDishPriceBand): boolean {
  if (band === 'under200') return price < 200;
  if (band === '200to350') return price >= 200 && price <= 350;
  return price > 350;
}

/** Number of active filter facets, used for the chip/button badge. */
export function activeFoodFilterCount(f: FoodFilters): number {
  let n = 0;
  if (f.sort !== 'recommended') n += 1;
  if (f.minRating !== null) n += 1;
  if (f.maxDelivery !== null) n += 1;
  if (f.freeDelivery) n += 1;
  if (f.featured) n += 1;
  if (f.halal) n += 1;
  if (f.dineIn) n += 1;
  if (f.veg) n += 1;
  if (f.dishPrice !== null) n += 1;
  return n;
}

const ratingOf = (r: Restaurant): number => parseFloat(r.avg_rating ?? r.rating);
// Prefer the backend ETA the card actually shows so the "Under N min" filter
// can never include a card whose displayed estimate is above the threshold.
// Falls back to the stored estimate when the API returned no ETA (mock data).
const deliveryOf = (r: Restaurant): number =>
  r.delivery_eta?.max_minutes ?? parseFloat(r.avg_delivery_time_min);

export function applyFoodFilters(list: Restaurant[], f: FoodFilters): Restaurant[] {
  let out = [...list];
  if (f.minRating !== null) out = out.filter((r) => ratingOf(r) >= f.minRating!);
  if (f.maxDelivery !== null) {
    out = out.filter((r) => Number.isFinite(deliveryOf(r)) && deliveryOf(r) <= f.maxDelivery!);
  }
  if (f.freeDelivery) out = out.filter((r) => parseFloat(r.delivery_fee) === 0 || r.free_delivery_above !== null);
  if (f.featured) out = out.filter((r) => r.is_featured === true);
  if (f.halal) out = out.filter((r) => r.is_halal === true);
  if (f.dineIn) out = out.filter((r) => r.dine_in === true);
  if (f.veg) out = out.filter((r) => r.is_veg === true);
  if (f.dishPrice !== null) {
    const band = f.dishPrice;
    out = out.filter((r) => {
      const raw = r.featured_item?.price;
      if (raw == null) return false;
      const price = Number(raw);
      return Number.isFinite(price) && dishPriceMatches(price, band);
    });
  }

  if (f.sort === 'rating') out.sort((a, b) => ratingOf(b) - ratingOf(a));
  else if (f.sort === 'fast') out.sort((a, b) => deliveryOf(a) - deliveryOf(b));
  return out;
}

export const FOOD_SORT_CAPTION: Record<FoodSortId, string> = {
  recommended: '',
  rating: 'Highest rated kitchens first',
  fast: 'Quickest delivery first',
};

/**
 * Food "Veg Mode" control. Sits beside the sticky search field and is a real
 * filter: turning it on narrows the Food home's recommendations and restaurant
 * feed to pure-veg kitchens (`is_veg`), using the same predicate as the "Pure
 * veg" filter. The green treatment mirrors the veg mark used across the app so
 * the control reads as "vegetarian only" at a glance.
 */
export function VegModeToggle({ enabled, onChange }: { enabled: boolean; onChange: (enabled: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label="Veg Mode — show pure veg restaurants only"
      onClick={() => onChange(!enabled)}
      className="tap flex w-11 shrink-0 flex-col items-center justify-center gap-[3px]"
    >

      <span className="whitespace-nowrap text-[13px] font-extrabold uppercase leading-[11px] tracking-wide">
        VEG
      </span>
      <span className="whitespace-nowrap text-[10px] font-extrabold uppercase leading-[11px] tracking-wide">
        MODE
      </span>
      <span
        className={cn(
          'relative h-[18px] w-[30px] shrink-0 rounded-full transition-colors duration-200',
          enabled ? 'bg-z-green' : 'bg-neutral-300'
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-[14px] w-[14px] rounded-full bg-white shadow-sm transition-all duration-200',
            enabled ? 'left-3.5' : 'left-0.5'
          )}
        />
      </span>
    </button>
  );
}

export function foodChipClass(active: boolean, extra?: string): string {
  return cn(
    'tap shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-all duration-200 active:scale-95',
    active
      ? 'border-food-600 bg-food-50 text-food-700'
      : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300',
    extra
  );
}

interface FoodFilterChipsProps {
  filters: FoodFilters;
  onChange: (next: FoodFilters) => void;
  onOpenFilters: () => void;
}

/**
 * The compact filter bar above the feed: a `Filters` button (opens the full
 * sheet) followed by the everyday quick-filter chips. The strip scrolls
 * sideways on narrow screens and never wraps; the chips drive the same
 * `FoodFilters` state the sheet edits, so a quick tap and a sheet choice stay
 * in sync.
 */
export function FoodFilterChips({ filters, onChange, onOpenFilters }: FoodFilterChipsProps) {
  const count = activeFoodFilterCount(filters);
  const quick: { key: string; label: string; active: boolean; toggle: () => void }[] = [
    {
      key: 'rating',
      label: 'Top rated',
      active: filters.sort === 'rating',
      toggle: () => onChange({ ...filters, sort: filters.sort === 'rating' ? 'recommended' : 'rating' }),
    },
    {
      key: 'fast',
      label: 'Fastest delivery',
      active: filters.sort === 'fast',
      toggle: () => onChange({ ...filters, sort: filters.sort === 'fast' ? 'recommended' : 'fast' }),
    },
    {
      key: 'offers',
      label: 'Free delivery',
      active: filters.freeDelivery,
      toggle: () => onChange({ ...filters, freeDelivery: !filters.freeDelivery }),
    },
    {
      key: 'veg',
      label: 'Pure veg',
      active: filters.veg,
      toggle: () => onChange({ ...filters, veg: !filters.veg }),
    },
  ];

  return (
    <div className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-0.5">
      <button
        type="button"
        onClick={onOpenFilters}
        aria-haspopup="dialog"
        aria-label={count > 0 ? `Filters, ${count} active` : 'Filters'}
        className={foodChipClass(
          count > 0,
          'flex items-center gap-1.5 pl-3 pr-2.5 font-bold'
        )}
      >
        <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={2.4} />
        {count > 0 ? `Filters (${count})` : 'Filters'}
        <ChevronDown className="h-3.5 w-3.5 opacity-70" strokeWidth={2.4} />
      </button>

      <span aria-hidden className="h-5 w-px shrink-0 bg-neutral-200" />

      {quick.map((q) => (
        <button
          key={q.key}
          type="button"
          onClick={q.toggle}
          aria-pressed={q.active}
          className={foodChipClass(q.active)}
        >
          {q.label}
        </button>
      ))}
    </div>
  );
}
