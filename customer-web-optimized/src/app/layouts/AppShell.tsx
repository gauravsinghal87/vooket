import { useEffect } from 'react';
import { Outlet, useLocation, useSearchParams } from 'react-router-dom';
import { Header } from './Header';
import { BottomNav } from './BottomNav';
import { CartConflictDialog } from '@/features/cart/components/cart-conflict-dialog';
import { routeTheme } from '@/shared/components/service/service-theme';
import { useAppConfig } from '@/shared/hooks/useBranding';

// The three service routes share one themed top band: `/food`, `/grocery` and
// `/rides`. Every other route keeps the plain dark header and the default
// (blue) theme values.
const TOP_ROUTES = ['/food', '/grocery', '/rides'];

export function AppShell() {
  const { pathname } = useLocation();
  const [params] = useSearchParams();

  // Load the shared `/app-config` branding on first paint. Besides feeding the
  // Header brand, this adds the configured platform name to the document title
  // and swaps the favicon for the uploaded logo.
  const { data: appConfig } = useAppConfig();
  useEffect(() => {
    const branding = appConfig?.branding;
    if (!branding) return;
    if (typeof branding.name === 'string' && branding.name.trim()) {
      document.title = `${branding.name.trim()} — Food, Grocery & Rides`;
    }
    const favicon = document.querySelector<HTMLLinkElement>("link[rel='icon']");
    if (branding.logo && favicon) favicon.href = branding.logo;
  }, [appConfig]);

  // The Grocery service uses a warm cream page surface; Food, Ride and the
  // generic pages keep the neutral surface they had before.
  // The Grocery checkout renders its own compact header (back / title / share)
  // so the shared SuperBasket header is not repeated above it.
  const isGroceryCheckout = pathname === '/cart' && params.get('type') === 'grocery';
  const isGrocery = pathname.startsWith('/grocery') || pathname.startsWith('/store') || isGroceryCheckout;
  // Zomato paints the whole food surface pure white — the home, the restaurant
  // listings and the cart — so the cards, chips and rating badges sit on white
  // rather than on the warm ink canvas the other services use.
  const isFoodCheckout = pathname === '/cart' && params.get('type') !== 'grocery';
  const isFoodSurface =
    isFoodCheckout ||
    (pathname === '/search' && params.get('type') === 'food') ||
    pathname.startsWith('/food') ||
    pathname.startsWith('/restaurant') ||
    pathname.startsWith('/restaurants');
  // The Food home renders its own immersive hero (video/image background with
  // the header layered over it), so the shared sticky header is suppressed
  // there — otherwise two headers would stack above the same page.
  const isFoodHero = pathname === '/food';
  // The Grocery home does the same with its Admin festive hero: the page
  // renders the shared header inside `GroceryHero`, so `AppShell` drops its own
  // band and lets the hero run full-bleed. A selected Grocery category
  // (`/grocery?category=<id>`) keeps the existing sticky header.
  const groceryCategory = Number(params.get('category'));
  const hasGroceryCategory = Number.isFinite(groceryCategory) && groceryCategory > 0;
  const isGroceryHero = pathname === '/grocery' && !hasGroceryCategory;
  // Order tracking paints the shared header and a full-bleed tracking hero as
  // one continuous band, so its `main` also drops the max-width and gutter and
  // the page re-applies them inside its own content blocks.
  const isOrderTracking = pathname.startsWith('/order/');
  // The restaurant detail screen is edge-to-edge like the Food home: a
  // full-width cover image sits directly under the top edge and the page paints
  // its own floating (back / search / cart) controls over it, so `main` must not
  // add the shared gutter or max-width and the shared header band is dropped
  // (otherwise a second, separate bar would stack above the cover).
  const isRestaurantDetail = pathname.startsWith('/restaurant/');
  // Zomato's search is a full-screen surface: only its own back+input pill at
  // the top, so the shared location/header band is dropped there too.
  const isSearchScreen = pathname === '/search';
  // The profile paints its own back arrow and account card, as the reference's
  // profile screen does — no shared band above it.
  const isProfile = pathname === '/profile';
  const isRidesHome = pathname === '/rides';
  const isRidesSelector = pathname === '/rides/destination';
  const isRideConfirmPickup = pathname === '/rides/confirm-pickup';
  const hideBottomNav = isRidesSelector || isRideConfirmPickup;
  // The rides home owns a full-height map + booking sheet and re-applies its own
  // max-width and gutter, so it drops the shared shell's column.
  const fullBleedMain =
    isFoodHero ||
    isGroceryHero ||
    isOrderTracking ||
    isRestaurantDetail ||
    isRidesHome ||
    isRidesSelector ||
    isRideConfirmPickup;

  // Single theme source for the top band: every surface in the upper section
  // (header band, hero canvas on `/food`, active module, microphone, promo
  // cards, banner CTA) reads its colour from the variables `index.css` declares
  // for this attribute, so the selected module and the colours around it always
  // come from the route's service. Eating `/food` paints burgundy, `/grocery`
  // bronze and `/rides` the neutral blue — and the selected module can never
  // disagree, because both read the same route value.
  const topTheme = TOP_ROUTES.includes(pathname) ? routeTheme(pathname) : undefined;

  // Module scope for CSS isolation. Unlike `data-service-theme` (which only
  // paints the three top bands), this attribute covers every surface a module
  // owns — restaurant detail, store/product detail, ride tracking and the
  // module-scoped addresses screens — so module CSS can be scoped with
  // `[data-module='…']` and can never leak into a sibling service.
  const queryType = params.get('type');
  const moduleContext: 'food' | 'grocery' | 'rides' | undefined = pathname.startsWith('/food') || pathname.startsWith('/restaurant')
    ? 'food'
    : pathname.startsWith('/grocery') || pathname.startsWith('/store')
      ? 'grocery'
      : pathname.startsWith('/ride')
        ? 'rides'
        : pathname === '/product'
          ? params.get('service') === 'food'
            ? 'food'
            : 'grocery'
          : pathname === '/cart' || pathname === '/checkout'
            ? queryType === 'grocery'
              ? 'grocery'
              : 'food'
            : pathname === '/search' && (queryType === 'food' || queryType === 'grocery')
              ? queryType
              : undefined;

  return (
    <div
      className={`flex min-h-dvh flex-col ${isGrocery ? 'bg-grocery-50' : isFoodSurface ? 'bg-white' : 'bg-ink-50'}`}
      data-service-theme={topTheme}
      data-module={moduleContext}
    >
      {/* The food cart paints its own Zomato header (back / restaurant /
          delivery-location row), so the shared band is dropped there too. */}
      {!isGroceryCheckout && !isFoodCheckout && !isFoodHero && !isGroceryHero && !isRestaurantDetail && !isSearchScreen && !isProfile && !isRidesSelector && !isRideConfirmPickup && <Header />}
      {/* On `/food` and the order-tracking pages the page owns a full-bleed
          surface, so `main` drops the max-width and gutter there and the page
          re-applies both inside its own content blocks. Every other route keeps
          the shared shell. */}
      <main
        className={
          fullBleedMain
            ? 'w-full flex-1 pb-[calc(var(--bottom-dock-h)+env(safe-area-inset-bottom)+var(--spacing)*14)]'
            : 'mx-auto w-full max-w-5xl flex-1 px-[var(--page-gutter)] pt-4 pb-[calc(var(--bottom-dock-h)+env(safe-area-inset-bottom)+var(--spacing)*14)]'
        }
      >
        <Outlet />
      </main>
      {!hideBottomNav && <BottomNav />}
      <CartConflictDialog />
    </div>
  );
}