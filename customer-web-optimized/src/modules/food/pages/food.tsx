import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Flame } from 'lucide-react';
import { repositories } from '@/shared/repositories';
import { foodService } from '@/modules/food/services';
import { useDiscoveryHome } from '@/shared/hooks/useDiscoveryHome';
import { useAppStore } from '@/shared/stores/appStore';
import { DEFAULT_LOCATION } from '@/shared/utils/location';
import { FoodHero } from '@/modules/food/components/food-hero';
import { SearchBar } from '@/shared/components/service/search-bar';
import { FoodSectionTitle } from '@/modules/food/components/food-section-title';
import { FoodSpotlight } from '@/modules/food/components/food-spotlight';
import { FoodCategories } from '@/modules/food/components/food-categories';
import {
  FoodFilterChips,
  VegModeToggle,
  applyFoodFilters,
  activeFoodFilterCount,
  FOOD_SORT_CAPTION,
  DEFAULT_FOOD_FILTERS,
  type FoodFilters,
} from '@/modules/food/components/food-filters';
import { FoodFilterSheet } from '@/modules/food/components/food-filter-sheet';
import { useStickyFoodHeader } from '@/modules/food/hooks/useStickyFoodHeader';
import { ServiceabilityNotice } from '@/modules/food/components/serviceability-notice';
import { FoodRecommendedGrid, FoodRecommendedGridSkeleton } from '@/modules/food/components/food-recommended-grid';
import { FoodRestaurantListCard } from '@/modules/food/components/food-restaurant-list-card';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { ErrorState, EmptyState } from '@/shared/components/ui/state';
import { haversineKm } from '@/shared/utils/geo';
import { cn } from '@/shared/utils/utils';
import type { Offer, Restaurant } from '@/shared/types/catalog';

// The first-order "New Customer" coupon card is a standalone promotional
// block on the Food home; it is hidden here so the promo rail shows everyday
// offers only. The coupon itself stays live in checkout/cart.
function isNewCustomerPromo(offer: Offer): boolean {
  const code = (offer.code ?? '').toLowerCase();
  const title = (offer.title ?? '').toLowerCase();
  const tag = (offer.tag ?? '').toLowerCase();
  return code === 'first50' || title.includes('new customer') || tag.includes('new customer');
}

function RestaurantListSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-3xl border border-neutral-200/80 bg-white shadow-card">
          <Skeleton className="aspect-[5/3] w-full rounded-none" />
          <div className="space-y-2 p-4">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function FoodPage() {
  const location = useAppStore((s) => s.location) ?? null;
  // The header displays the saved delivery location, falling back to the shared
  // default before the customer picks one. The ETA and nearest-first ordering
  // use that same effective location so the estimate always matches what the
  // header shows and never silently becomes unavailable.
  const origin = location ?? DEFAULT_LOCATION;

  // Food and Grocery share one cached `/discovery/home` request for this
  // location, so switching modules does not download the same envelope twice.
  const discovery = useDiscoveryHome(origin);
  const home = { ...discovery, data: discovery.food };
  const categories = useQuery({
    queryKey: ['food-categories'],
    queryFn: () => foodService.getCategories(),
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  // The food hero is its own placement, so it is fetched with the dedicated
  // endpoint+key and can never be substituted with a generic Home banner.
  const heroBanners = useQuery({
    queryKey: ['banners', 'food_home_hero'],
    queryFn: () => repositories.banners.getByPlacement('food', 'food_home_hero'),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Food "Veg Mode" — a persisted preference that narrows the home to pure-veg
  // kitchens. It is a real filter applied to both the recommendation rail and
  // the paginated feed below.
  const vegMode = useAppStore((s) => s.vegMode);
  const setVegMode = useAppStore((s) => s.setVegMode);
  // The shared location selector lives in the app shell; the unavailable-location
  // state reuses it so "Change location" opens the very same sheet as the header.
  const openLocationSelector = useAppStore((s) => s.openLocationSelector);

  // The active Food category is kept in the URL (not a route change), so the
  // page stays mounted, filtering happens in place, and browser back/forward
  // walks through the previously selected categories.
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedCategoryId = useMemo(() => {
    const raw = Number(searchParams.get('category'));
    return Number.isFinite(raw) && raw > 0 ? raw : null;
  }, [searchParams]);

  const selectCategory = useCallback(
    (categoryId: number | null) => {
      const next = new URLSearchParams(searchParams);
      if (categoryId == null) next.delete('category');
      else next.set('category', String(categoryId));
      setSearchParams(next);
    },
    [searchParams, setSearchParams]
  );

  // The full directory comes from the paginated restaurants endpoint (the
  // discovery home only exposes a small curated recommendation set), so every
  // serviceable restaurant is reachable and the nearest-first ordering is kept.
  // The category is part of the key, so selecting one starts a fresh fetch
  // (pagination resets) and never shows the previous category's results.
  const restaurants = useInfiniteQuery({
    queryKey: ['food-restaurants', selectedCategoryId, origin.latitude, origin.longitude],
    queryFn: ({ pageParam }) =>
      foodService.getRestaurants({
        page: pageParam,
        latitude: origin.latitude,
        longitude: origin.longitude,
        category: selectedCategoryId ?? undefined,
      }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.current_page < last.last_page ? last.current_page + 1 : undefined),
  });

  const [filters, setFilters] = useState<FoodFilters>(DEFAULT_FOOD_FILTERS);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Two-stage sticky search/category header; measurement lives in the hook.
  const {
    heroSearchRef,
    categoriesRef,
    stickySearchRef,
    stickySearchH,
    searchStuck,
    catStuck,
  } = useStickyFoodHeader();

  const distanceFor = useCallback(
    (restaurant: Restaurant): number | null => haversineKm(origin, restaurant),
    [origin]
  );

  const allRestaurants = useMemo(
    () => restaurants.data?.pages.flatMap((page) => page.data) ?? [],
    [restaurants.data]
  );

  // "Recommended for you" mirrors the active selection: with no category it is
  // the curated discovery set; with a category it is the top matches from the
  // filtered feed, so the rail never shows restaurants the category excludes.
  const recommendedLoading = selectedCategoryId != null ? restaurants.isLoading : home.isLoading;
  const recommended = useMemo(() => {
    const source = selectedCategoryId != null ? allRestaurants : (home.data?.recommended ?? []);
    const filtered = applyFoodFilters(source, filters);
    const list = vegMode ? filtered.filter((r) => r.is_veg === true) : filtered;
    return selectedCategoryId != null ? list.slice(0, 8) : list;
  }, [allRestaurants, home.data, filters, vegMode, selectedCategoryId]);

  const visibleList = useMemo(() => {
    const filtered = applyFoodFilters(allRestaurants, filters);
    return vegMode ? filtered.filter((r) => r.is_veg === true) : filtered;
  }, [allRestaurants, filters, vegMode]);

  const hasFilters = activeFoodFilterCount(filters) > 0;

  const selectedCategoryName = useMemo(
    () => (categories.data ?? []).find((c) => c.id === selectedCategoryId)?.name ?? null,
    [categories.data, selectedCategoryId]
  );

  const hasCategory = selectedCategoryId != null;
  const canReset = hasFilters || vegMode || hasCategory;

  const resetAll = () => {
    setFilters(DEFAULT_FOOD_FILTERS);
    setVegMode(false);
    selectCategory(null);
  };

  const applyQuickFilters = (next: FoodFilters) => {
    setFilters(next);
    requestAnimationFrame(() => {
      document.getElementById('food-feed')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const applySheetFilters = (next: FoodFilters) => {
    setFilters(next);
    setSheetOpen(false);
    requestAnimationFrame(() => {
      document.getElementById('food-feed')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  // Infinite scroll: load the next page as the sentinel approaches the viewport.
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = restaurants;
  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el || !hasNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage();
      },
      { rootMargin: '400px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const d = home.data;
  const banners = heroBanners.data ?? [];
  const promos = useMemo(() => (d?.promos ?? []).filter((offer) => !isNewCustomerPromo(offer)), [d?.promos]);

  // The reference heads the feed with the real number of delivering
  // restaurants ("1463 RESTAURANTS DELIVERING TO YOU") — that count is the
  // paginated endpoint's `total`, not the pages fetched so far.
  const restaurantCount = restaurants.data?.pages[0]?.total ?? allRestaurants.length;
  const deliveringTitle =
    restaurantCount > 0 ? `${restaurantCount.toLocaleString('en-IN')} RESTAURANTS DELIVERING TO YOU` : 'RESTAURANTS DELIVERING TO YOU';
  // Under the heading the reference prints "Featured"; an active sort or
  // category caption carries more information, so it wins when present.
  const feedCaption = FOOD_SORT_CAPTION[filters.sort] || selectedCategoryName || 'Featured';

  // The backend resolves the delivery location once and reports it on both
  // Food endpoints; they always agree because they read the same coordinates.
  // When it says the location is unserviceable every section below is replaced
  // by the unavailable-location state — never an unfiltered fallback.
  const serviceability = restaurants.data?.pages[0]?.serviceability ?? d?.serviceability ?? null;
  const notServiceable = serviceability?.is_serviceable === false;
  const showList = !notServiceable && !restaurants.isLoading && !restaurants.isError;

  return (
    <div className="pb-1">
      {/* The Food hero is the active `food_home_hero` banner as a full-bleed
          video/image background with the header layered over it. It renders its
          own header, so `AppShell` drops the shared one on this route. The
          search + Veg Mode control belongs to the hero and scrolls with it. */}
      <FoodHero
        banners={banners}
        searchSlot={
          <div ref={heroSearchRef} className="flex items-center gap-2.5">
            <SearchBar variant="food" className="min-w-0 flex-1" />
            <VegModeToggle enabled={vegMode} onChange={setVegMode} />
          </div>
        }
      />

      {/* Stage A — the compact search + Veg Mode row pins to the viewport top
          once the hero's own search has scrolled past it. It is `fixed` and out
          of flow, so it never leaves a gap where it comes from; while inactive
          it is hidden and removed from the tab order, so the hero search is
          never duplicated on screen. */}
      <div
        ref={stickySearchRef}
        aria-hidden={!searchStuck}
        className={cn(
          'fixed inset-x-0 top-0 z-50 bg-white transition-transform duration-200 will-change-transform',
          searchStuck
            ? 'translate-y-0 shadow-[0_8px_16px_-12px_rgb(16_14_10/0.35)]'
            : 'pointer-events-none invisible -translate-y-full'
        )}
      >
        <div className="mx-auto flex max-w-5xl items-center gap-2.5 px-[var(--page-gutter)] py-2.5">
          <SearchBar variant="food" className="min-w-0 flex-1" />
          <VegModeToggle enabled={vegMode} onChange={setVegMode} />
        </div>
      </div>

      <div className="mx-auto w-full max-w-5xl px-[var(--page-gutter)] pt-4 pb-1">
        {/* Stage B — the category row stays in its natural place below the hero
            until it reaches the bottom edge of the pinned search row, then
            docks directly beneath it. The row owns its full-bleed backing (see
            `FoodCategories`) so it stays horizontally scrollable while pinned. */}
        {/* The category rail is a taxonomy, not a listing: it is hidden while the
            delivery location is unserviceable so no category can be selected
            that would lead to an empty feed. */}
        {!notServiceable && (
          <div ref={categoriesRef} style={{ top: stickySearchH }} className="sticky z-40">
            <FoodCategories
              categories={categories.data ?? []}
              loading={categories.isLoading}
              stuck={catStuck}
              selectedId={selectedCategoryId}
              onSelect={selectCategory}
            />
          </div>
        )}

        <div className="space-y-6 pt-2">
          {notServiceable && (
            <ServiceabilityNotice serviceability={serviceability} onChangeLocation={openLocationSelector} />
          )}

          {!notServiceable && (
            <FoodFilterChips
              filters={filters}
              onChange={applyQuickFilters}
              onOpenFilters={() => setSheetOpen(true)}
            />
          )}

          {!notServiceable && (
            <section id="food-feed" aria-labelledby="recommended-title" className="scroll-mt-48">
              <FoodSectionTitle id="recommended-title" subtitle={FOOD_SORT_CAPTION[filters.sort] || undefined}>
                RECOMMENDED FOR YOU
              </FoodSectionTitle>

              {recommendedLoading ? (
                <FoodRecommendedGridSkeleton />
              ) : recommended.length > 0 ? (
                <FoodRecommendedGrid restaurants={recommended} distanceFor={distanceFor} />
              ) : null}
            </section>
          )}

          {!notServiceable && promos.length > 0 && (
            <section aria-labelledby="spotlight-title">
              <FoodSectionTitle id="spotlight-title">IN THE SPOTLIGHT</FoodSectionTitle>
              <FoodSpotlight promos={promos} />
            </section>
          )}

          {!notServiceable && (
            <section aria-labelledby="delivering-title">
              <FoodSectionTitle id="delivering-title" subtitle={feedCaption}>
                {deliveringTitle}
              </FoodSectionTitle>

              {restaurants.isLoading && <RestaurantListSkeleton />}

              {restaurants.isError && (
                <ErrorState
                  title="Couldn't load restaurants"
                  description="We couldn't fetch restaurants right now."
                  action={{ label: 'Retry', onClick: () => restaurants.refetch() }}
                />
              )}

              {showList && visibleList.length === 0 && (
                <EmptyState
                  title={
                    vegMode
                      ? 'No pure veg restaurants match right now'
                      : selectedCategoryName
                        ? `No ${selectedCategoryName} restaurants right now`
                        : !hasFilters
                          ? 'No restaurants delivering to you right now'
                          : 'No restaurants match these filters'
                  }
                  description="Try a different filter or check back shortly."
                  icon={Flame}
                  action={
                    canReset
                      ? {
                        label: hasCategory && !hasFilters && !vegMode ? 'Show all' : 'Clear filters',
                        onClick: resetAll,
                      }
                      : undefined
                  }
                />
              )}

              {showList && visibleList.length > 0 && (
                <>
                  <div className="flex flex-col gap-5">
                    {visibleList.map((r) => (
                      <FoodRestaurantListCard key={r.id} restaurant={r} distanceKm={distanceFor(r)} />
                    ))}
                  </div>

                  <div ref={loadMoreRef} aria-hidden className="h-px w-full" />

                  {isFetchingNextPage && (
                    <p className="py-2 text-center text-sm font-medium text-neutral-500">
                      Loading more restaurants…
                    </p>
                  )}

                  {hasNextPage && !isFetchingNextPage && (
                    <div className="flex justify-center pt-1">
                      <button
                        onClick={() => fetchNextPage()}
                        className="rounded-full border border-neutral-300 bg-white px-5 py-2 text-sm font-bold text-neutral-700 transition-colors hover:border-food-600 hover:text-food-600"
                      >
                        Load more
                      </button>
                    </div>
                  )}

                  {!hasNextPage && allRestaurants.length > 8 && (
                    <p className="py-2 text-center text-xs font-medium text-neutral-400">
                      You've reached the end.
                    </p>
                  )}
                </>
              )}
            </section>
          )}
        </div>
      </div>

      <FoodFilterSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        filters={filters}
        onApply={applySheetFilters}
      />
    </div>
  );
}
