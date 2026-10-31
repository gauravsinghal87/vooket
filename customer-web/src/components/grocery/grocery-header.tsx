import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronDown, Clock, MapPin, Navigation, Search, Share2, ShoppingCart } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { useAuthStore } from '@/store/authStore';
import { useCartStore } from '@/store/cartStore';
import { useActiveGroceryStore } from '@/hooks/useActiveGroceryStore';
import { useGroceryCategories } from '@/hooks/useGroceryCategories';
import { findGroceryCategory } from '@/lib/groceryCategories';
import { serviceTheme } from '@/components/service/service-theme';
import { estimateDeliveryMinutes, formatDistanceKm } from '@/lib/geo';
import { cn } from '@/lib/utils';

/**
 * The real nearest-store ETA for the Grocery top band.
 *
 * Delivery time comes from `estimateDeliveryMinutes` and the distance from
 * `formatDistanceKm`, both fed by the unchanged `useActiveGroceryStore` hook —
 * there is no hard-coded value. The component is only mounted on `/grocery` so
 * the store-discovery query never fires for the other services.
 *
 * `onLight` is the pale-yellow band and the clean cream fallback; `onDark` is
 * the transparent header sitting on an uploaded festive hero image.
 */
export function GroceryEtaRow({ tone = 'onLight' }: { tone?: 'onLight' | 'onDark' }) {
  const { activeStore, distanceKm, isLoading } = useActiveGroceryStore();
  const eta = estimateDeliveryMinutes(distanceKm);
  const distance = formatDistanceKm(distanceKm);
  const onDark = tone === 'onDark';

  const etaText = activeStore && eta !== null ? `Delivery in ${eta} min` : 'Delivery times';

  return (
    <span
      className={cn(
        'flex items-center gap-1 text-[15px] font-extrabold leading-tight',
        onDark ? 'text-white' : 'text-ink-900'
      )}
    >
      {isLoading && !activeStore ? (
        <span className={cn('h-4 w-28 animate-pulse rounded', onDark ? 'bg-white/30' : 'bg-ink-900/10')} />
      ) : (
        <>
          {activeStore && eta !== null && (
            <Clock className={cn('h-4 w-4 shrink-0', onDark ? 'text-white/85' : 'text-grocery-800')} />
          )}
          <span className="truncate">{etaText}</span>
          {distance && (
            <span
              className={cn(
                'inline-flex shrink-0 items-center gap-0.5 text-[12px] font-bold',
                onDark ? 'text-white/85' : 'text-grocery-800'
              )}
            >
              <Navigation className="h-3 w-3" /> {distance}
            </span>
          )}
        </>
      )}
    </span>
  );
}

/**
 * Compact header for `?category=<id>`: back, the category's real name from the
 * backend, search, share and a single compact delivery-location line.
 *
 * The name and image come from the shared `grocery-categories` query, so this
 * costs no extra request, and the line still opens the one existing
 * `LocationSelector` sheet.
 */
export function GroceryCategoryHeader({
  categoryId,
  onLocOpenChange,
  activeLoc,
}: {
  categoryId: number;
  onLocOpenChange: (open: boolean) => void;
  activeLoc: { label: string; address: string };
}) {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const groceryCount = useCartStore((s) => s.groceryCount);
  const { categories, isLoading } = useGroceryCategories();

  const category = findGroceryCategory(categories, categoryId);
  const theme = serviceTheme('grocery');

  /**
   * Normal history behaviour: step back through the categories the customer
   * opened. A deep link straight into a category has nothing to go back to, so
   * it lands on the grocery home instead of leaving the app.
   */
  const goBack = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate('/grocery');
  };

  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  return (
    <header className="sticky top-0 z-40 border-b border-grocery-300 bg-grocery-200/95 backdrop-blur">
      <div className="mx-auto max-w-5xl px-[var(--page-gutter)]">
        <div className="flex items-center gap-1.5 pt-2">
          <button
            onClick={goBack}
            aria-label="Back"
            className="tap -ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-800 transition-colors hover:bg-grocery-300/70"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <h1 className="min-w-0 flex-1 truncate text-[15px] font-extrabold leading-tight text-ink-900">
            {isLoading && !category ? (
              <span className="inline-block h-4 w-32 animate-pulse rounded bg-ink-900/10" />
            ) : (
              (category?.name ?? 'Grocery')
            )}
          </h1>

          {/* Reuses the existing grocery search route; no new search endpoint. */}
          <Link
            to="/search?type=grocery"
            aria-label={theme.searchPlaceholder}
            className="tap flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-800 transition-colors hover:bg-grocery-300/70"
          >
            <Search className="h-5 w-5" />
          </Link>

          {canShare && (
            <button
              onClick={() =>
                void navigator
                  .share({ title: category?.name ?? theme.label, url: window.location.href })
                  .catch(() => undefined)
              }
              aria-label="Share"
              className="tap flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-800 transition-colors hover:bg-grocery-300/70"
            >
              <Share2 className="h-5 w-5" />
            </button>
          )}

          <Link
            to="/cart?type=grocery"
            className="tap relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-800 transition-colors hover:bg-grocery-200/60"
            aria-label={`Cart, ${groceryCount} items`}
          >
            <ShoppingCart className="h-5 w-5" />
            {groceryCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-ink-900 px-1 text-[10px] font-bold text-white animate-pop">
                {groceryCount}
              </span>
            )}
          </Link>

          <Link
            to={user ? '/profile' : '/auth/login'}
            aria-label="Account"
            className={cn('shrink-0 rounded-full ring-2 ring-grocery-200 transition-transform hover:scale-105')}
          >
            <Avatar name={user?.name ?? 'Guest'} size="sm" />
          </Link>
        </div>

        {/* The one delivery-location presentation for this page. */}
        <button
          onClick={() => onLocOpenChange(true)}
          aria-label="Change delivery location"
          className="tap flex w-full items-center gap-1.5 pb-2.5 pt-1.5 text-left text-[12px] text-neutral-600"
        >
          <MapPin className="h-3.5 w-3.5 shrink-0 text-grocery-700" fill="currentColor" strokeWidth={0} />
          <span className="shrink-0 text-neutral-500">Delivering to</span>
          <span className="shrink-0 font-bold text-ink-900">{activeLoc.label}</span>
          <span className="truncate">· {activeLoc.address}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
        </button>
      </div>
    </header>
  );
}