import { useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Screen } from '@/shared/components/Screen';
import {
  applyFoodFilters,
  activeFoodFilterCount,
  FOOD_SORT_CAPTION,
  DEFAULT_FOOD_FILTERS,
  FoodCategories,
  FoodFilterChips,
  FoodFilterSheet,
  FoodRecommendedGrid,
  FoodRecommendedGridSkeleton,
  FoodRestaurantListCard,
  FoodSectionTitle,
  FoodSpotlight,
  RestaurantSkeleton,
  VegModeToggle,
  type FoodFilters,
} from '@/modules/food/components/food';
import { EmptyState } from '@/shared/components/ui/primitives';
import { ServiceabilityNotice } from '@/shared/components/ServiceabilityNotice';
import { SearchBar } from '@/shared/components/SearchBar';
import { FoodHero } from '@/modules/food/components/foodHero';
import { repositories } from '@/shared/repositories';
import { useAppStore } from '@/shared/stores/appStore';
import { haversineKm } from '@/shared/utils/geo';
import { DEFAULT_LOCATION } from '@/shared/utils/location';
import { colors } from '@/modules/food/styles/theme';
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

// Bottom padding under the pinned search row (matches `styles.pinnedSearch`); it
// is also reserved above the docked category row so the chips clear the row.
const PIN_BOTTOM = 8;

export default function FoodHomeScreen() {
  const location = useAppStore((s) => s.location) ?? null;
  // The header shows the saved delivery location, falling back to the shared
  // default until the customer picks one. The ETA and nearest-first ordering
  // use that same effective location so the estimate always matches what the
  // header shows and never silently becomes unavailable.
  const origin = location ?? DEFAULT_LOCATION;

  const home = useQuery({
    queryKey: ['food-home', origin.latitude, origin.longitude],
    queryFn: () => repositories.food.getHome({ latitude: origin.latitude, longitude: origin.longitude }),
  });
  const categories = useQuery({
    queryKey: ['food-categories'],
    queryFn: () => repositories.food.getCategories(),
  });
  const heroBanners = useQuery({
    queryKey: ['banners', 'food_home_hero'],
    queryFn: () => repositories.banners.getByPlacement('food', 'food_home_hero'),
  });

  // Food "Veg Mode" — a persisted preference that narrows the home to pure-veg
  // kitchens. It is a real filter applied to both the recommendation carousel
  // and the paginated feed below.
  const vegMode = useAppStore((s) => s.vegMode);
  const setVegMode = useAppStore((s) => s.setVegMode);

  // The selected Food category is local UI state: choosing one re-filters the
  // page in place (no navigation away from the Food home) and is part of the
  // query key, so the feed resets to page 1 and never shows a stale list.
  const [categoryId, setCategoryId] = useState<number | null>(null);

  // The full directory comes from the paginated restaurants endpoint (the
  // discovery home only exposes a small curated recommendation set), so every
  // serviceable restaurant is reachable and nearest-first ordering is kept.
  const restaurants = useInfiniteQuery({
    queryKey: ['food-restaurants', categoryId, origin.latitude, origin.longitude],
    queryFn: ({ pageParam }) =>
      repositories.food.getRestaurants({
        page: pageParam,
        latitude: origin.latitude,
        longitude: origin.longitude,
        category: categoryId ?? undefined,
      }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.current_page < last.last_page ? last.current_page + 1 : undefined),
  });

  const [filters, setFilters] = useState<FoodFilters>(DEFAULT_FOOD_FILTERS);
  const [sheetOpen, setSheetOpen] = useState(false);

  const distanceFor = (restaurant: Restaurant): number | null => haversineKm(origin, restaurant);

  const allRestaurants = useMemo(
    () => restaurants.data?.pages.flatMap((page) => page.data) ?? [],
    [restaurants.data]
  );

  // "Recommended for you" mirrors the active selection: with no category it is
  // the curated discovery set; with a category it is the top matches from the
  // filtered feed, so the rail never shows restaurants the category excludes.
  const recommendedLoading = categoryId != null ? restaurants.isLoading : home.isLoading;
  const recommended = useMemo(() => {
    const source = categoryId != null ? allRestaurants : ((home.data?.recommended ?? []) as Restaurant[]);
    const filtered = applyFoodFilters(source, filters);
    const list = vegMode ? filtered.filter((r) => r.is_veg === true) : filtered;
    return categoryId != null ? list.slice(0, 8) : list;
  }, [allRestaurants, home.data, filters, vegMode, categoryId]);

  const visibleList = useMemo(() => {
    const filtered = applyFoodFilters(allRestaurants, filters);
    return vegMode ? filtered.filter((r) => r.is_veg === true) : filtered;
  }, [allRestaurants, filters, vegMode]);

  const hasFilters = activeFoodFilterCount(filters) > 0;

  const selectedCategoryName = useMemo(
    () => (categories.data ?? []).find((c) => c.id === categoryId)?.name ?? null,
    [categories.data, categoryId]
  );

  const hasCategory = categoryId != null;
  const canReset = hasFilters || vegMode || hasCategory;

  const resetAll = () => {
    setFilters(DEFAULT_FOOD_FILTERS);
    setVegMode(false);
    setCategoryId(null);
  };

  const applyQuickFilters = (next: FoodFilters) => {
    setFilters(next);
  };

  const applySheetFilters = (next: FoodFilters) => {
    setFilters(next);
    setSheetOpen(false);
  };

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = restaurants;

  const insets = useSafeAreaInsets();

  // Zomato-style two-stage sticky header. Stage A pins the compact search +
  // Veg Mode row the moment the hero's own search scrolls up to the top of the
  // usable viewport (below the status bar). Stage B pins the category row: it is
  // the ScrollView's single native sticky child (`stickyHeaderIndices`), and the
  // negative margin + matching padding below reserve the pinned-search height
  // above it so its chips dock at the row's bottom edge. Keeping the categories
  // a single native instance — instead of a second overlay copy — is what lets
  // the strip stay swipeable and retain its scroll position while docked. Every
  // position is measured, so there are no hardcoded thresholds.
  const [searchY, setSearchY] = useState<number | null>(null);
  const [rowH, setRowH] = useState(0);
  const [searchStuck, setSearchStuck] = useState(false);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    const y = contentOffset.y;
    if (searchY != null) {
      // The pinned search row sits at the status-bar inset, so the hero's own
      // row pins here once it reaches the same line.
      const stuck = y >= searchY - insets.top;
      setSearchStuck((cur) => (cur === stuck ? cur : stuck));
    }
    const nearBottom = y + layoutMeasurement.height >= contentSize.height - 600;
    if (nearBottom && hasNextPage && !isFetchingNextPage) fetchNextPage();
  };

  // Height the docked category row must clear: the status-bar inset, the search
  // row itself, and the pinned row's bottom padding.
  const searchBlockH = insets.top + rowH + PIN_BOTTOM;

  // The search + Veg Mode row that lives inside the hero (its measured offset
  // drives Stage A; the row's measured height reserves the dock space).
  const heroSearch = (
    <View
      onLayout={(e: LayoutChangeEvent) => setSearchY(e.nativeEvent.layout.y)}
      style={styles.heroSearch}
    >
      <View
        style={styles.searchRow}
        onLayout={(e: LayoutChangeEvent) => setRowH(e.nativeEvent.layout.height)}
      >
        <View style={styles.searchField}>
          <SearchBar variant="food" />
        </View>
        <VegModeToggle enabled={vegMode} onChange={setVegMode} onDark />
      </View>
    </View>
  );

  const d = home.data;
  const banners = heroBanners.data ?? [];
  const promos = ((d?.promos ?? []) as Offer[]).filter((p) => !isNewCustomerPromo(p));

  // The backend resolves the delivery location once and reports it on both
  // Food endpoints, so they always agree. When it says the location is
  // unserviceable every listing section below is replaced by the
  // unavailable-location state — never an unfiltered fallback.
  const serviceability = restaurants.data?.pages[0]?.serviceability ?? d?.serviceability ?? null;
  const notServiceable = serviceability?.is_serviceable === false;
  const showList = !notServiceable && !restaurants.isLoading && !restaurants.isError;

  // The reference heads the feed with the real number of delivering
  // restaurants ("1463 RESTAURANTS DELIVERING TO YOU") — that count is the
  // paginated endpoint's `total`, not the pages fetched so far.
  const restaurantCount = restaurants.data?.pages[0]?.total ?? allRestaurants.length;
  const deliveringTitle =
    restaurantCount > 0
      ? `${restaurantCount.toLocaleString('en-IN')} RESTAURANTS DELIVERING TO YOU`
      : 'RESTAURANTS DELIVERING TO YOU';
  // Under the heading the reference prints "Featured"; an active sort or
  // category caption carries more information, so it wins when present.
  const feedCaption = FOOD_SORT_CAPTION[filters.sort] || selectedCategoryName || 'Featured';

  return (
    <Screen
      header={null}
      background="#fff"
      scrollProps={{ onScroll, scrollEventThrottle: 16, stickyHeaderIndices: [1] }}
      overlay={
        // Stage A's pinned search row lives outside the ScrollView, so it never
        // scrolls or takes flow space (no gaps or content jumps when it
        // appears). The wrapper is `box-none` so scrolling still reaches the
        // list beneath it.
        <View pointerEvents="box-none">
          {searchStuck ? (
            <View style={[styles.pinnedSearch, { paddingTop: insets.top }]}>
              <View style={styles.searchRow}>
                <View style={styles.searchField}>
                  <SearchBar variant="food" />
                </View>
                <VegModeToggle enabled={vegMode} onChange={setVegMode} />
              </View>
            </View>
          ) : null}
        </View>
      }
    >
      {/* The Food hero renders its own overlaid header (video/image background
          from the active food_home_hero banner), so the shared header is
          suppressed here to avoid a duplicate. The search + Veg Mode row lives
          inside the hero (`searchSlot`) and scrolls away with it. The wrapper's
          negative bottom margin is what pulls the sticky category row up so its
          reserved dock space leaves no gap at rest — keeping that negative
          margin on this in-flow sibling (rather than on the sticky child)
          means the sticky row's own layout offset stays unambiguous. */}
      <View style={{ marginBottom: notServiceable ? 0 : -searchBlockH }}>
        <FoodHero
          banners={banners}
          searchSlot={heroSearch}
        />
      </View>

      {/* Stage B's category row — the ScrollView's single sticky child. Its
          `paddingTop` (`searchBlockH`) reserves the pinned-search height: once
          docked the chips sit directly below the pinned search row instead of
          under it, so the overlaying search band can never intercept their taps.
          Only the inner body paints a solid backing, so nothing covers the hero
          until the row actually docks. The wrapper always stays mounted (it is
          the sticky child at index 1) but is emptied — together with the hero's
          negative margin above — while the delivery location is unserviceable,
          so no category can be picked on an area we do not serve and no dead
          space is left behind. */}
      <View style={notServiceable ? undefined : { paddingTop: searchBlockH }}>
        {!notServiceable && (
          <View style={styles.categoriesBody}>
            <FoodCategories
              categories={categories.data ?? []}
              loading={categories.isLoading}
              selectedId={categoryId}
              onSelect={setCategoryId}
            />
          </View>
        )}
      </View>

      <View style={styles.stack}>
        {notServiceable ? (
          <ServiceabilityNotice serviceability={serviceability} />
        ) : (
          <>
            <FoodFilterChips
              filters={filters}
              onChange={applyQuickFilters}
              onOpenFilters={() => setSheetOpen(true)}
            />

            <View style={styles.section}>
              <View style={styles.sectionPad}>
                <FoodSectionTitle
                  title="RECOMMENDED FOR YOU"
                  subtitle={FOOD_SORT_CAPTION[filters.sort] || undefined}
                />
              </View>
              {recommendedLoading ? (
                <FoodRecommendedGridSkeleton />
              ) : recommended.length > 0 ? (
                <FoodRecommendedGrid restaurants={recommended} distanceFor={distanceFor} />
              ) : null}
            </View>

            {promos.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionPad}>
                  <FoodSectionTitle title="IN THE SPOTLIGHT" />
                </View>
                <FoodSpotlight promos={promos} />
              </View>
            )}

            <View style={styles.section}>
              <View style={styles.sectionPad}>
                <FoodSectionTitle title={deliveringTitle} subtitle={feedCaption} />
              </View>

              {restaurants.isLoading && <RestaurantSkeleton />}

              {restaurants.isError && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorTitle}>{"Couldn't load restaurants"}</Text>
                  <Text style={styles.errorDesc}>{"We couldn't fetch restaurants right now."}</Text>
                  <Pressable onPress={() => restaurants.refetch()} style={styles.errorBtn}>
                    <Text style={styles.errorBtnText}>Retry</Text>
                  </Pressable>
                </View>
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
                  message="Try a different filter or check back shortly."
                  actionLabel={
                    canReset ? (hasCategory && !hasFilters && !vegMode ? 'Show all' : 'Clear filters') : undefined
                  }
                  onAction={canReset ? resetAll : undefined}
                />
              )}

              {showList && visibleList.length > 0 && (
                <View style={styles.restList}>
                  {visibleList.map((r) => (
                    <FoodRestaurantListCard key={r.id} restaurant={r} distanceKm={distanceFor(r)} />
                  ))}

                  {isFetchingNextPage && <Text style={styles.listFooter}>Loading more restaurants…</Text>}

                  {hasNextPage && !isFetchingNextPage && (
                    <Pressable onPress={() => fetchNextPage()} style={styles.loadMoreBtn}>
                      <Text style={styles.loadMoreText}>Load more</Text>
                    </Pressable>
                  )}

                  {!hasNextPage && allRestaurants.length > 8 && (
                    <Text style={styles.listEnd}>{"You've reached the end."}</Text>
                  )}
                </View>
              )}
            </View>
          </>
        )}
      </View>

      <FoodFilterSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        filters={filters}
        onApply={applySheetFilters}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Search + Veg Mode row while it belongs to the hero (scrolls with it).
  heroSearch: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  // Pinned search row (Stage A): solid page background, status-bar inset added
  // inline while pinned so it clears the notch on both platforms.
  pinnedSearch: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingBottom: PIN_BOTTOM,
    shadowColor: '#100e0a',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  // The row itself — shared by the hero's own search and the pinned copy so the
  // measured height matches exactly.
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchField: {
    flex: 1,
    minWidth: 0,
  },
  // The docked category row paints the solid full-width backing (the native
  // sticky wrapper's padding area above it stays transparent). At rest this sits
  // on the page background, so it is invisible until the row actually docks.
  categoriesBody: {
    backgroundColor: '#fff',
    paddingTop: 8,
    paddingBottom: 8,
  },
  stack: {
    gap: 24,
    paddingBottom: 8,
  },
  section: {
    gap: 12,
  },
  sectionPad: {
    paddingHorizontal: 16,
  },
  restList: {
    paddingHorizontal: 16,
    gap: 16,
  },
  listFooter: {
    fontFamily: 'Outfit_600SemiBold',
    paddingVertical: 8,
    textAlign: 'center',
    fontSize: 13,
    color: colors.neutral[500],
  },
  listEnd: {
    fontFamily: 'Outfit_600SemiBold',
    paddingVertical: 8,
    textAlign: 'center',
    fontSize: 12,
    color: colors.neutral[400],
  },
  loadMoreBtn: {
    alignSelf: 'center',
    marginTop: 4,
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.neutral[300],
    backgroundColor: '#fff',
  },
  loadMoreText: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 14,
    color: colors.neutral[700],
  },
  errorBox: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  errorTitle: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 15,
    color: colors.ink[900],
    textAlign: 'center',
  },
  errorDesc: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 13,
    color: colors.neutral[500],
    textAlign: 'center',
  },
  errorBtn: {
    marginTop: 10,
    backgroundColor: colors.ink[900],
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 999,
  },
  errorBtnText: {
    fontFamily: 'Outfit_700Bold',
    color: '#fff',
    fontSize: 14,
  },
});
