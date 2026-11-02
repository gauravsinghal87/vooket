import type { ServiceType } from '@/shared/types/models';
import { UtensilsCrossed, ShoppingBasket, Car, type LucideIcon } from 'lucide-react';

export interface ServiceTheme {
  label: string;
  icon: LucideIcon;
  /** Solid fill for the active tab / primary CTA */
  solid: string;
  /** Soft tint background */
  soft: string;
  /** Strong text color */
  strong: string;
  /** Tailwind gradient for hero-ish tiles */
  gradient: string;
  /** short search placeholder hint */
  searchPlaceholder: string;
  /** short descriptor shown under the label in the home module switcher */
  descriptor: string;
  /**
   * Foreground colours for the service's *selected* home module.
   *
   * The module is filled with the service gradient, so the label needs a
   * foreground that stays legible on that specific gradient — white on the Food
   * red and Ride blue, near-black on the light Grocery gold.
   */
  activeText: string;
  /** Subtler variant of `activeText` for the descriptor line. */
  activeMuted: string;
  /** Plate behind the icon on a selected module. */
  activePlate: string;
  /** Plate behind the icon on an unselected module. */
  idlePlate: string;
  /**
   * Colour of the selected module's top indicator bar.
   *
   * Declared explicitly rather than derived from `activeText`: Tailwind only
   * generates the classes it can see written in the source, so a value computed
   * at runtime would silently render as no background at all.
   */
  activeIndicator: string;
  /**
   * Icon tint while the module's home tab is selected.
   *
   * Declared per theme rather than derived from `strong`/`soft` at runtime:
   * Tailwind only emits classes it can find written out in the source, so a
   * `text-` class assembled with string concatenation would never be generated
   * and the icon would silently lose its colour.
   */
  iconActive: string;
  /** Icon tint while the module's home tab is unselected. */
  iconIdle: string;
  /**
   * Optional short badge (an ETA, for example) shown above the home tab's label.
   *
   * Left unset for every current service, so no badge renders today. The slot
   * exists because the reference design carries one, and rendering it is gated on
   * this field rather than on a `:has()` selector.
   */
  badge?: string;
}

export const SERVICE_THEMES: Record<ServiceType, ServiceTheme> = {
  food: {
    label: 'Food',
    icon: UtensilsCrossed,
    solid: 'bg-food-600 text-white',
    soft: 'bg-food-50',
    strong: 'text-food-600',
    gradient: 'from-food-500 via-food-600 to-food-700',
    searchPlaceholder: 'Search for restaurants, dishes or cuisines',
    descriptor: 'Meals from restaurants',
    activeText: 'text-white',
    activeMuted: 'text-white/75',
    activePlate: 'bg-food-800/50',
    idlePlate: 'bg-white/10',
    activeIndicator: 'bg-white',
    iconActive: 'text-food-200',
    iconIdle: 'text-food-400',
  },
  grocery: {
    label: 'Grocery',
    icon: ShoppingBasket,
    solid: 'bg-grocery-500 text-ink-900',
    soft: 'bg-grocery-100',
    strong: 'text-grocery-700',
    gradient: 'from-grocery-300 to-grocery-500',
    searchPlaceholder: 'Search for atta, dal, coke and more',
    descriptor: 'Daily essentials',
    activeText: 'text-ink-900',
    activeMuted: 'text-ink-900/70',
    activePlate: 'bg-ink-900/10',
    idlePlate: 'bg-white/10',
    activeIndicator: 'bg-ink-900',
    iconActive: 'text-grocery-300',
    iconIdle: 'text-grocery-400',
  },
  rides: {
    label: 'Rides',
    icon: Car,
    solid: 'bg-brand-700 text-white',
    soft: 'bg-brand-50',
    strong: 'text-brand-700',
    gradient: 'from-brand-700 to-brand-900',
    searchPlaceholder: 'Search destinations & places',
    descriptor: 'Book a ride',
    activeText: 'text-white',
    activeMuted: 'text-white/75',
    activePlate: 'bg-brand-950/45',
    idlePlate: 'bg-white/10',
    activeIndicator: 'bg-white',
    iconActive: 'text-brand-100',
    iconIdle: 'text-brand-300',
  },
};

export const SERVICE_ROUTES: Record<ServiceType, string> = {
  food: '/food',
  grocery: '/grocery',
  rides: '/rides',
};

export function serviceTheme(service: ServiceType): ServiceTheme {
  return SERVICE_THEMES[service];
}

/**
 * The one answer to "which service is in view", derived from the URL.
 *
 * Every screen a module owns lights its tab — not just the module home:
 * Food covers `/food`, `/restaurants` and `/restaurant/:id`; Grocery covers
 * `/grocery`, `/stores`, `/store/:id` and `/product/:id`; Rides covers
 * `/rides*` and `/ride/:id`. The shared cart, checkout and search screens
 * carry the module in `?type=` (product detail carries it as router state on
 * web and `?service=` natively), so those resolve through `search` /
 * `stateType` when the caller has them; the untyped cart and checkout default
 * to food, exactly as the cart pages themselves do.
 *
 * `/` and the cross-module screens (orders, wallet, profile, auth, support)
 * deliberately return null: they belong to no single service.
 *
 * The URL is authoritative over the persisted store value, so the module
 * switcher, the top-band theme and every route-derived colour can never
 * disagree with the page the customer is actually on — deep links, refreshes
 * and the back button all resolve to the same module.
 */
export function activeService(pathname: string, search?: string, stateType?: string | null): ServiceType | null {
  if (pathname === '/') return null;
  if (pathname.startsWith('/food')) return 'food';
  if (pathname.startsWith('/grocery')) return 'grocery';
  // Covers /rides, /rides/destination, /rides/confirm-pickup and /ride/:id.
  if (pathname.startsWith('/ride')) return 'rides';
  // /restaurants and /restaurant/:id.
  if (pathname.startsWith('/restaurant')) return 'food';
  // /stores and /store/:id.
  if (pathname.startsWith('/store')) return 'grocery';
  if (pathname.startsWith('/product')) {
    const service = new URLSearchParams(search ?? '').get('service') ?? stateType;
    return service === 'food' ? 'food' : 'grocery';
  }
  if (pathname === '/search' || pathname === '/cart' || pathname === '/checkout') {
    const type = new URLSearchParams(search ?? '').get('type');
    if (type === 'food' || type === 'grocery' || type === 'rides') return type;
    // An untyped search spans all modules; the untyped cart/checkout come from
    // the food cart (mirroring `params.type === 'grocery' ? Grocery : Food`).
    return pathname === '/search' ? null : 'food';
  }
  return null;
}

/** Theme id painted on the top band via `AppShell`'s `data-service-theme`. */
export type ServiceThemeId = 'neutral' | ServiceType;

/**
 * The one theme resolver: the route's service when the route names one,
 * otherwise the neutral (brand-blue) theme used by `/` and any route that
 * does not paint a service band. `index.css` keys the hero variables off the
 * same ids, and `neutral` needs no override — it inherits the `:root` values.
 */
export function routeTheme(pathname: string): ServiceThemeId {
  return activeService(pathname) ?? 'neutral';
}