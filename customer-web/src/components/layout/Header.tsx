import { MapPin, Wallet, ChevronDown } from 'lucide-react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { Avatar } from '@/components/ui/avatar';
import { SearchBar } from '@/components/service/search-bar';
import { LocationSelector } from './location-selector';
import { GroceryCategoryHeader, GroceryEtaRow } from '@/components/grocery/grocery-header';
import { useAppStore } from '@/store/appStore';
import { useAuthStore } from '@/store/authStore';
import { DEFAULT_LOCATION } from '@/lib/location';
import { serviceTheme } from '@/components/service/service-theme';
import { cn } from '@/lib/utils';

// The three service routes share one themed band (location → module switcher →
// search). Every other route keeps the plain dark header without the switcher.
const TOP_ROUTES = ['/food', '/grocery', '/rides'];

/**
 * The one shared header.
 *
 * Each top-level route paints the same structure — location row, the connected
 * module switcher and search — on the band its theme describes: `AppShell`
 * points `data-service-theme` at the route's service, and
 * `--hero-header-bg` / the module colours follow from there using `index.css`.
 * So the header band, the hero below it on `/food`, the selected module and the
 * search accent all change together and can never disagree.
 *
 * A selected grocery category (`/grocery?category=<id>`) swaps the band for the
 * compact category header, and `/grocery` itself renders the real nearest-store
 * ETA in the location row.
 */
const HERO_HEADER_BG = 'hero-header-bg';

interface HeaderProps {
  /**
   * `default` is the sticky themed band every route shares. `overlay` drops the
   * band and its shadow so the same header can sit directly on top of the Food
   * hero video (`FoodHero`) — same controls, no separate solid block.
   */
  variant?: 'default' | 'overlay';
  /**
   * For `overlay` only: whether the artwork behind the header is dark. Food's
   * video hero and an active Grocery festive hero both need white controls;
   * Grocery's clean fallback (no uploaded hero banner) is a light cream band
   * and needs dark controls instead.
   */
  overlayOnDark?: boolean;
}

export function Header({ variant = 'default', overlayOnDark = true }: HeaderProps) {
  const overlay = variant === 'overlay';
  const location = useLocation();
  const { user } = useAuthStore();
  const locationState = useAppStore((s) => s.location);
  const service = useAppStore((s) => s.service);

  const [params] = useSearchParams();
  const activeLoc = locationState ?? DEFAULT_LOCATION;
  const theme = serviceTheme(service);

  // Owned by the app store so any screen (including the Food unavailable-location
  // empty state) can open the same shared selector.
  const locOpen = useAppStore((s) => s.locationSelectorOpen);
  const openLocationSelector = useAppStore((s) => s.openLocationSelector);
  const closeLocationSelector = useAppStore((s) => s.closeLocationSelector);
  const setLocOpen = (open: boolean) => (open ? openLocationSelector() : closeLocationSelector());

  const pathname = location.pathname;
  const isTop = TOP_ROUTES.includes(pathname);
  const isGrocery = pathname === '/grocery';

  // The Rides home owns a full-height map + booking sheet, and destination
  // search lives inside that flow (`/rides/destination`), so its band drops
  // the shared search row — location, wallet and avatar stay exactly as they
  // are. Every other top route keeps the search field.
  const isRidesHome = pathname === '/rides';
  const showBandSearch = isTop && !overlay && !isRidesHome;

  // A Food order tracking screen publishes its service so the band runs into
  // the Food order hero as one continuous red section. Every other route
  // (including grocery orders) keeps the header it had before.
  const onBand = isTop;

  // A selected grocery category gets its own compact header — the same slot
  // taking a different shape, never a second header, so the location is still
  // presented exactly once on the page.
  const categoryId = Number(params.get('category'));
  const inCategory = Number.isFinite(categoryId) && categoryId > 0;

  /* Grocery's band is Blinkit's pale yellow, not the dark bronze the other top
     routes use, so every glyph, icon and hover surface on it flips from white to
     ink. The Grocery home can also render the header over the Admin hero
     artwork: on a dark festive image it keeps white controls, while its clean
     cream fallback (no uploaded hero) flips back to ink. Food and Rides keep
     their white-on-dark treatment untouched. */
  const darkText = overlay ? !overlayOnDark : isGrocery;

  if (isGrocery && inCategory) {
    return (
      <>
        <GroceryCategoryHeader categoryId={categoryId} onLocOpenChange={setLocOpen} activeLoc={activeLoc} />
        <LocationSelector open={locOpen} onOpenChange={setLocOpen} />
      </>
    );
  }

  return (
    <>
      <header
        data-app-header
        className={cn(
          darkText ? 'text-ink-900' : 'text-white',
          overlay
            ? // Sits on the Food hero media: no band, no shadow, no sticky so the
              // video shows through and the header is part of the hero itself.
              'relative z-30'
            : cn(
                'sticky top-0 z-40',
                // The dark bands carry a deep drop to separate them from the
                // page; on Grocery's light band that same shadow reads as a hard
                // seam, so it is only a soft lift there.
                darkText
                  ? 'shadow-[0_2px_12px_rgb(16_14_10/0.10)]'
                  : 'shadow-[0_2px_16px_rgb(0_0_0/0.28)]',
                // The themed band covers all four top-level routes; every other
                // route that uses this header keeps its existing dark background.
                isTop ? HERO_HEADER_BG : 'bg-ink-900'
              )
        )}
      >
        {/* `pb-3` matches the padding the search row used to carry, so the
            band ends with the same breathing room once that row is gone. */}
        <div className={cn('mx-auto max-w-5xl px-[var(--page-gutter)] pt-2.5', isRidesHome && 'pb-3')}>
          <div className="flex items-center gap-2">
            {/* No brand mark in the band: the location leads the row, exactly
                as the reference does, so the two action icons keep their room. */}
            <button
              onClick={() => setLocOpen(true)}
              className={cn(
                'tap flex min-w-0 flex-1 items-center gap-2 rounded-xl px-1.5 py-1 text-left transition-colors',
                darkText ? 'hover:bg-ink-900/5' : 'hover:bg-white/5'
              )}
              aria-label={`Change delivery location. Currently ${activeLoc.label}, ${activeLoc.address}`}
            >
              {/* On the themed band the pin takes whatever the band paints. On
                  Grocery it keeps the white medallion from its old header so
                  the ETA line reads as one unit; every other route uses the
                  plain filled pin (service accent off the band). */}
              {isGrocery ? (
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-grocery-700 shadow-sm">
                  <MapPin className="h-4 w-4" fill="currentColor" strokeWidth={0} />
                </span>
              ) : (
                <MapPin
                  className={cn('h-5 w-5 shrink-0', onBand ? 'text-white' : theme.strong)}
                  fill="currentColor"
                  strokeWidth={0}
                />
              )}
              {isGrocery ? (
                <span className="min-w-0 flex-1">
                  {/* Real nearest-store ETA, mounted only on the Grocery route. */}
                  <GroceryEtaRow tone={darkText ? 'onLight' : 'onDark'} />
                  <span
                    className={cn(
                      'mt-0.5 flex items-center gap-1 text-[12px] font-medium leading-tight',
                      darkText ? 'text-ink-900/70' : 'text-white/80'
                    )}
                  >
                    <span className={cn('shrink-0 font-bold', darkText ? 'text-ink-900' : 'text-white')}>
                      {activeLoc.label}
                    </span>
                    <span className="truncate">· {activeLoc.address}</span>
                    <ChevronDown
                      className={cn('h-3.5 w-3.5 shrink-0', darkText ? 'text-ink-900/40' : 'text-white/60')}
                    />
                  </span>
                </span>
              ) : (
                // Location is the first content in the header: the area name
                // leads, the full address sits underneath as the secondary line.
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1">
                    <span className="truncate text-sm font-bold leading-tight text-white">
                      {activeLoc.label}
                    </span>
                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-white/50" />
                  </span>
                  {/* The secondary line takes its colour from the hero theme, so it
                      stays legible on whichever band is active. Off the top routes
                      the variable falls back to the same white/55 it always was. */}
                  <span className="hero-muted mt-0.5 block truncate text-[11px] font-medium leading-tight">
                    {activeLoc.address}
                  </span>
                </span>
              )}
            </button>

            <div className="flex shrink-0 items-center gap-1.5">
              {/* Wallet replaces the old cart + notification pair: the balance
                  one tap away, and the reference band carries no cart or bell. */}
              <Link
                to="/wallet"
                className={cn(
                  'tap flex h-10 w-10 items-center justify-center rounded-full transition-colors',
                  darkText ? 'hover:bg-ink-900/10' : 'hover:bg-white/10'
                )}
                aria-label="Wallet"
              >
                <Wallet className="h-5 w-5" />
              </Link>
              <Link
                to={user ? '/profile' : '/auth/login'}
                className={cn(
                  'shrink-0 rounded-full ring-2 transition-transform hover:scale-105',
                  darkText ? 'ring-ink-900/15' : 'ring-white/20'
                )}
                aria-label="Account"
              >
                <Avatar name={user?.name ?? 'Guest'} size="sm" />
              </Link>
            </div>
          </div>

          {/* The module switcher now lives at the bottom of the screen (see
              `BottomNav`), so the top of a service route reads location →
              search. There is deliberately only one switcher per screen. */}
          {showBandSearch && (
            <div className="relative z-30 pb-3">
              <SearchBar variant="brand" />
            </div>
          )}
        </div>
      </header>

      <LocationSelector open={locOpen} onOpenChange={setLocOpen} />
    </>
  );
}