/**
 * Design tokens ported verbatim from customer-web/src/index.css and
 * customer-web/src/components/service/service-theme.ts. Hex values come
 * straight from the CSS (Tailwind v4 @theme) — do not "fix" them.
 */

export const colors = {
  brand: {
    50: '#eef6ff', 100: '#d9ecff', 200: '#bcdeff', 300: '#8ecaff', 400: '#59abff',
    500: '#3386ff', 600: '#1b66f5', 700: '#1451e1', 800: '#1743b6', 900: '#193c8f', 950: '#142657',
  },
  accent: {
    50: '#fff4ed', 100: '#ffe6d5', 200: '#fec9aa', 300: '#fda274', 400: '#fb703c',
    500: '#f94d16', 600: '#ea320c', 700: '#c2230c', 800: '#9a1e12', 900: '#7c1c12',
  },  food: {
    /* Food module palette — Zomato red, matching customer-web/src/index.css.
       Scoped to Food: Grocery and Rides read their own scales. The 600 step is
       the exact Zomato red. */
    50: '#fdecee', 100: '#fbdde0', 200: '#f7bcc1', 300: '#f19aa2', 400: '#ec6b78',
    500: '#e64252', 600: '#e23242', 700: '#c72232', 800: '#a81d2b', 900: '#8a1924',
    950: '#4e0d11',
  },
  grocery: {
    50: '#fffdf5', 100: '#fff8e1', 200: '#fdf0c8', 300: '#fae39a', 400: '#f7cf4f',
    500: '#f5b921', 600: '#e0a008', 700: '#b87f06', 800: '#94620f', 900: '#7a5212', 950: '#241b08',
  },
  ink: {
    50: '#f7f6f4', 100: '#e9e7e3', 500: '#6b675f', 700: '#37332e', 800: '#211d19',
    900: '#17140f', 950: '#100e0a',
  },
  neutral: {
    100: '#e9e7e3', 200: '#d6d3cc', 300: '#c9c5bd', 400: '#a29e96', 500: '#6b675f', 700: '#37332e',
  },
  success: '#16a34a',
  danger: '#dc2626',
  warning: '#f59e0b',
  /* -------------------------------------------------------------------- */
  /* Zomato design tokens (food module only) — exact equivalents of the
     reference app's oklch palette:
       primary   oklch(0.6 0.21 22)    -> #e23242 Zomato red
       dark      oklch(0.24 0.01 260)  -> #1c1f24 nav / dark surface
       veg       oklch(0.55 0.15 150)  -> #05893e veg green
       gold      oklch(0.72 0.11 75)   -> #cd9a50 PRO gold
       info      oklch(0.55 0.18 260)  -> #296cd8 info blue
     -------------------------------------------------------------------- */
  zRed: '#e23242',
  zRedDark: '#c72232',
  zRedSoft: '#fdeaec',
  zGreen: '#05893e',
  zGreenSoft: '#e7f6ed',
  zDark: '#1c1f24',
  zGold: '#cd9a50',
  zGoldSoft: '#fbedd1',
  zInfo: '#296cd8',
  zInfoSoft: '#e3efff',
  emerald: { 50: '#ecfdf5', 500: '#10b981', 600: '#059669', 700: '#047857' },
  amber: { 600: '#d97706', 700: '#b45309' },
  white: '#ffffff',
  black: '#000000',
};

export const ink = colors.ink;

export const shadows = {
  card: {
    shadowColor: 'rgb(16 14 10)',
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  float: {
    shadowColor: 'rgb(16 14 10)',
    shadowOpacity: 0.22,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  pill: {
    shadowColor: 'rgb(16 14 10)',
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
};

export const radii = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  '2xl': 22,
  '3xl': 28,
  full: 999,
};

export const spacing = {
  gutter: 16, // --page-gutter: 1rem; 1.5rem at >= 640px (mobile-first keeps 16)
};

/**
 * Geometry of the "notched" restaurant card — the Swiggy-style card with a
 * rounded-top photo, an offer chip in the top-left corner and a green rating
 * pill sitting in a white notch cut into the bottom-left of the photo.
 *
 * These mirror the `--notch-*` tokens of customer-web/src/index.css so the
 * app and the web app draw the same card.
 *
 * `surface` is the card's OWN surface colour: the notch is painted in it,
 * exactly like the info area below it, so the two always melt into one
 * another and can never show a seam against the section the card is dropped
 * into.
 */
export const notch = {
  /** The notch's own surface — the white cut-out in the photo's corner. */
  surface: colors.white,
  /** Rating pill fill — Zomato's rating green. */
  ratingBg: colors.zGreen,
  /** How far the rating pill dips below the photo. */
  overhang: 6,
  /** The breathing room between the rating pill and the edges of the cutout. */
  gap: 5,
  /** The wide variant, used by the restaurant grids. */
  md: {
    /** Card + photo top-corner radius. */
    radius: 16,
    /** Radius of the two inward curves that cut the notch. */
    curve: 12,
    /** Photo aspect ratio (width / height). */
    aspect: 1.25,
    /** Info-area padding. */
    padX: 12,
    padY: 12,
    nameSize: 15,
    metaSize: 12,
    pillSize: 12,
    pillPadX: 8,
    pillPadY: 5,
    offerSize: 10,
    offerPadX: 7,
    offerPadY: 5,
  },
  /** The compact variant, used by the recommendation rail. */
  sm: {
    radius: 14,
    curve: 10,
    aspect: 1.25,
    padX: 10,
    padY: 10,
    nameSize: 13,
    metaSize: 11,
    pillSize: 11,
    pillPadX: 7,
    pillPadY: 4,
    offerSize: 9,
    offerPadX: 6,
    offerPadY: 4,
  },
} as const;

/**
 * Geometry of the LARGE restaurant card — the full-width "restaurants
 * delivering to you" card.
 *
 * This layout has no notch: the photo is a 16:9 cover with rounded top
 * corners and the rating badge sits in the white information panel, on the
 * right, aligned with the name. It mirrors the web card's featured layout.
 */
export const featured = {
  /** Card + photo corner radius (the reference's rounded-3xl feed card). */
  radius: 20,
  /** Photo aspect ratio (width / height) — the reference's 5:3 feed card. */
  aspect: 5 / 3,
  /** Info-area padding. */
  padX: 16,
  /** The card's own shadow. */
  shadow: {
    shadowColor: 'rgb(16 14 10)',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
} as const;

/** Convert a #rrggbb hex to rgba() string with target alpha (0..1). */
export function withAlpha(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  const a = Math.max(0, Math.min(1, alpha));
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/** Hero top-band theme, keyed by route service. Values mirror index.css. */
export interface HeroTheme {
  headerBg: [string, string];
  heroBg: [string, string];
  surface: string;
  activeColor: string;
  activeContrast: string;
  searchAccent: string;
  muted: string;
  moduleDark: string;
}

export const HERO_THEMES: Record<'neutral' | 'food' | 'grocery' | 'rides', HeroTheme> = {
  neutral: {
    headerBg: [colors.brand[800], colors.brand[900]],
    heroBg: [colors.brand[900], colors.brand[950]],
    surface: withAlpha(colors.white, 0.12),
    activeColor: colors.brand[600],
    activeContrast: colors.white,
    searchAccent: colors.brand[600],
    muted: withAlpha(colors.white, 0.55),
    moduleDark: colors.brand[950],
  },
  food: {
    headerBg: [colors.food[600], colors.food[600]],
    heroBg: [colors.food[600], colors.food[700]],
    surface: withAlpha(colors.white, 0.18),
    activeColor: colors.food[600],
    activeContrast: colors.white,
    searchAccent: colors.food[600],
    muted: withAlpha(colors.white, 0.85),
    moduleDark: colors.food[700],
  },
  grocery: {
    headerBg: [colors.grocery[800], colors.grocery[900]],
    heroBg: [colors.grocery[900], colors.grocery[950]],
    surface: withAlpha(colors.grocery[100], 0.14),
    activeColor: colors.grocery[500],
    activeContrast: colors.ink[900],
    searchAccent: colors.grocery[600],
    muted: withAlpha(colors.grocery[200], 0.72),
    moduleDark: colors.grocery[900],
  },
  rides: {
    headerBg: [colors.brand[800], colors.brand[900]],
    heroBg: [colors.brand[900], colors.brand[950]],
    surface: withAlpha(colors.white, 0.12),
    activeColor: colors.brand[600],
    activeContrast: colors.white,
    searchAccent: colors.brand[600],
    muted: withAlpha(colors.white, 0.55),
    moduleDark: colors.brand[950],
  },
};

/**
 * Food order-tracking header gradient. Ends on `food[600]` — the exact stop the
 * expanded-map tracking header (`TrackingHeader`) starts from — so the app
 * header runs into it as one continuous red surface with no dark strip or seam.
 */
export const ORDER_HEADER_BG: [string, string] = [colors.food[700], colors.food[600]];

/**
 * Grocery order-tracking header gradient. Ends on `grocery[400]` — the exact
 * stop the expanded-map tracking header (`TrackingHeader`) starts from — so the
 * app header runs into it as one continuous gold surface with no dark strip.
 */
export const GROCERY_ORDER_HEADER_BG: [string, string] = [colors.grocery[500], colors.grocery[400]];

/** Service themes mirroring customer-web/src/components/service/service-theme.ts */
export interface ServiceTheme {
  label: string;
  /** Solid fill for the active tab / primary CTA */
  solid: string;
  /** Soft tint background */
  soft: string;
  /** Strong text color */
  strong: string;
  /** Gradient for hero-ish tiles */
  gradient: [string, string];
  /** Short search placeholder hint */
  searchPlaceholder: string;
  /** Short descriptor shown under the label in the home module switcher */
  descriptor: string;
  activeText: string;
  activeMuted: string;
  activePlate: string;
  idlePlate: string;
  activeIndicator: string;
  iconActive: string;
  iconIdle: string;
  badge?: string;
}

export const SERVICE_THEMES: Record<'food' | 'grocery' | 'rides', ServiceTheme> = {
  food: {
    label: 'Food',
    solid: colors.food[600],
    soft: colors.food[50],
    strong: colors.food[600],
    gradient: [colors.food[500], colors.food[700]],
    searchPlaceholder: 'Search for restaurants, dishes or cuisines',
    descriptor: 'Meals from restaurants',
    activeText: colors.white,
    activeMuted: withAlpha(colors.white, 0.75),
    activePlate: withAlpha(colors.food[800], 0.5),
    idlePlate: withAlpha(colors.white, 0.1),
    activeIndicator: colors.white,
    iconActive: colors.food[200],
    iconIdle: colors.food[400],
  },
  grocery: {
    label: 'Grocery',
    solid: colors.grocery[500],
    soft: colors.grocery[100],
    strong: colors.grocery[700],
    gradient: [colors.grocery[300], colors.grocery[500]],
    searchPlaceholder: 'Search for atta, dal, coke and more',
    descriptor: 'Daily essentials',
    activeText: colors.ink[900],
    activeMuted: withAlpha(colors.ink[900], 0.7),
    activePlate: withAlpha(colors.ink[900], 0.1),
    idlePlate: withAlpha(colors.white, 0.1),
    activeIndicator: colors.ink[900],
    iconActive: colors.grocery[300],
    iconIdle: colors.grocery[400],
  },
  rides: {
    label: 'Rides',
    solid: colors.brand[700],
    soft: colors.brand[50],
    strong: colors.brand[700],
    gradient: [colors.brand[700], colors.brand[900]],
    searchPlaceholder: 'Search destinations & places',
    descriptor: 'Book a ride',
    activeText: colors.white,
    activeMuted: withAlpha(colors.white, 0.75),
    activePlate: withAlpha(colors.brand[950], 0.45),
    idlePlate: withAlpha(colors.white, 0.1),
    activeIndicator: colors.white,
    iconActive: colors.brand[100],
    iconIdle: colors.brand[300],
  },
};

export const SERVICE_ROUTES: Record<'food' | 'grocery' | 'rides', string> = {
  food: '/food',
  grocery: '/grocery',
  rides: '/rides',
};

export function serviceTheme(service: 'food' | 'grocery' | 'rides'): ServiceTheme {
  return SERVICE_THEMES[service];
}

export type ServiceType = 'food' | 'grocery' | 'rides';

/**
 * Which service is in view, derived from the route (URL is authoritative).
 *
 * Every screen a module owns lights its tab — not just the module home:
 * Food covers `/food`, `/restaurants` and `/restaurant/:id`; Grocery covers
 * `/grocery`, `/stores`, `/store/:id` and `/product/:id`; Rides covers
 * `/rides*` and `/ride/:id`. The shared cart, checkout and search screens
 * carry the module in the query (`?type=grocery`), product detail in
 * `?service=food`, so those resolve through `search` when the caller passes
 * it; the untyped cart/checkout default to food (matching the cart pages),
 * the untyped search spans all modules, and `/` plus the cross-module screens
 * (orders, wallet, profile, auth) stay null.
 */
export function activeService(pathname: string, search?: string): ServiceType | null {
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
    const service = new URLSearchParams(search ?? '').get('service');
    return service === 'food' ? 'food' : 'grocery';
  }
  if (pathname === '/search' || pathname === '/cart' || pathname === '/checkout') {
    const type = new URLSearchParams(search ?? '').get('type');
    if (type === 'food' || type === 'grocery' || type === 'rides') return type;
    // An untyped search spans all modules; the untyped cart/checkout come from
    // the food cart (`params.type === 'grocery' ? GroceryCartPage : FoodCartPage`).
    return pathname === '/search' ? null : 'food';
  }
  return null;
}

export type ServiceThemeId = 'neutral' | ServiceType;

export function routeTheme(pathname: string): ServiceThemeId {
  return activeService(pathname) ?? 'neutral';
}

export const FONT_FAMILY = 'Outfit';

export const typography = {
  h1: { fontSize: 26, fontWeight: '800', color: colors.ink[900] },
  h2: { fontSize: 20, fontWeight: '800', color: colors.ink[900] },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: colors.ink[900] },
  body: { fontSize: 15, color: colors.ink[900] },
  caption: { fontSize: 12, color: colors.neutral[500] },
  small: { fontSize: 11, color: colors.neutral[500] },
} as const;