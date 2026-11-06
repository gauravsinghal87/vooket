import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Screen } from '@/shared/components/Screen';
import { SearchBar } from '@/shared/components/SearchBar';
import { ViewCartBar } from '@/shared/components/cards';
import {
  GroceryBrandPromoRail,
  GroceryCategoryCarousel,
  GroceryCategoryGrid,
  GroceryCategoryGridSkeleton,
  GroceryCategoryHeader,
  GroceryCategoryRailSkeleton,
  GroceryHero,
  GroceryProductShelf,
  GroceryPromoRail,
  GroceryStoreTerms,
} from '@/modules/grocery/components/grocery';
import { GroceryCategoryView } from '@/modules/grocery/components/groceryCategory';
import { EmptyState, Loader } from '@/shared/components/ui/primitives';
import { LocationSelector } from '@/shared/components/LocationSelector';
import { GroceryServiceabilityNotice } from '@/shared/components/GroceryServiceabilityNotice';
import { repositories } from '@/shared/repositories';
import { useDiscoveryHome } from '@/shared/hooks/useDiscoveryHome';
import { useActiveGroceryStore } from '@/modules/grocery/hooks/useActiveGroceryStore';
import { productsOfStore, useStoreCatalogue } from '@/modules/grocery/hooks/useStoreCatalogue';
import { useCart } from '@/features/cart/hooks/useCart';
import { useGroceryCategories } from '@/modules/grocery/hooks/useGroceryCategories';
import { findGroceryCategory } from '@/modules/grocery/utils/groceryCategories';
import { discountPercent } from '@/shared/utils/utils';
import { colors } from '@/modules/grocery/styles/theme';
import type { Category, Offer, Product } from '@/shared/types/catalog';

/**
 * Store-first grocery experience, ported from customer-web's GroceryPage.
 *
 * USER LOCATION -> nearest eligible grocery store -> ACTIVE STORE
 *               -> store categories -> store products -> cart -> checkout
 *
 * Every product, category, offer and banner below is scoped to the single
 * active store, and the whole page re-resolves when the delivery location
 * changes. With `?category=<id>` the page collapses to the native, web-parity
 * category view: a compact cream header, one store summary, a horizontal
 * category strip, filter chips and a dense product grid.
 */
export default function GroceryHomeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ category?: string }>();
  const categoryId = Number(params.category);
  const inCategory = Number.isFinite(categoryId) && categoryId > 0;
  const [locOpen, setLocOpen] = useState(false);

  // Exactly one active store, resolved from the selected delivery location.
  const {
    activeStore,
    activeStoreId,
    distanceKm,
    // Every grocery read below is requested for these coordinates, so the
    // backend resolves one zone for the whole page.
    origin,
    isLoading: storeLoading,
    isError: storeError,
    refetch: refetchStores,
    serviceability: storesServiceability,
  } = useActiveGroceryStore();

  // Store-scoped catalogue for the home shelves and for the category strip. The
  // category view runs its own per-category query, but this home fetch's
  // `category_id` list is what tells the strip which categories this store
  // actually stocks (mirroring customer-web's `buildCategoryRail`).
  const catalogue = useStoreCatalogue(activeStoreId, { perPage: 60 });
  const storeProducts = catalogue.products;

  // Discovery is shared with Food: both homes read one cached
  // `/discovery/home` envelope for the same coordinates. Only the Grocery
  // slice is used here (banners, offers and store-scoped reorder history).
  const discovery = useDiscoveryHome({ latitude: origin.latitude, longitude: origin.longitude });
  const home = { ...discovery, data: discovery.data?.grocery };

  // The Grocery hero is its own placement, fetched through the existing public
  // banner endpoint so a Food/Rides banner can never be substituted for it.
  const heroBanner = useQuery({
    queryKey: ['banners', 'grocery_home_hero'],
    queryFn: () => repositories.banners.getByPlacement('grocery', 'grocery_home_hero'),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const heroBanners = useMemo(
    () => (heroBanner.data ?? []).filter((b) => b.placement === 'grocery_home_hero'),
    [heroBanner.data],
  );
  const heroBannerId = heroBanners[0]?.id ?? null;

  // The brand-promo carousel uses its own placement, fetched with the dedicated
  // endpoint so a banner for another surface (Food, Rides) can never appear.
  // Strict equality also drops the shared `all`/null banners the endpoint
  // includes, and the active hero id is removed so the festive artwork is never
  // repeated as an ordinary promo card.
  const brandPromo = useQuery({
    queryKey: ['banners', 'grocery_home_brand_promo'],
    queryFn: () => repositories.banners.getByPlacement('grocery', 'grocery_home_brand_promo'),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const brandPromos = useMemo(
    () => (brandPromo.data ?? []).filter((b) => b.placement === 'grocery_home_brand_promo' && b.id !== heroBannerId),
    [brandPromo.data, heroBannerId],
  );

  // The festive promo cards are their own placement, fetched with the dedicated
  // endpoint so a banner for another surface can never appear in the grid.
  // Strict equality on the placement also drops the shared `all`/null banners
  // the public endpoint would otherwise include, and the active hero id is
  // removed so the festive artwork is never repeated as a promo card.
  const festivePromo = useQuery({
    queryKey: ['banners', 'grocery_home_festive_promo'],
    queryFn: () => repositories.banners.getByPlacement('grocery', 'grocery_home_festive_promo'),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const festivePromos = useMemo(
    () =>
      (festivePromo.data ?? []).filter(
        (b) => b.placement === 'grocery_home_festive_promo' && b.id !== heroBannerId,
      ),
    [festivePromo.data, heroBannerId],
  );

  const cart = useCart('grocery');
  const cartCount = (cart.data?.items ?? []).reduce((n, i) => n + i.quantity, 0);

  const data = home.data;

  const promos = useMemo<Offer[]>(
    () => ((data?.promos ?? []) as Offer[]).filter((o) => o.service === 'grocery'),
    [data?.promos],
  );

  /**
   * Admin promotional carousel. It deliberately lives after every main
   * category section, not in the hero. The dedicated brand-promo placement
   * wins; when none is configured the existing grocery offers rail is used.
   */
  const promoSection = useMemo(() => {
    if (inCategory) return null;
    if (brandPromos.length > 0) return <GroceryBrandPromoRail banners={brandPromos} />;
    if (promos.length > 0) return <GroceryPromoRail promos={promos} />;
    return null;
  }, [brandPromos, inCategory, promos]);

  const buyAgain = useMemo(() => productsOfStore(data?.buyAgain, activeStoreId), [data?.buyAgain, activeStoreId]);
  const recentlyViewed = useMemo(
    () => productsOfStore(data?.recentlyViewed, activeStoreId),
    [data?.recentlyViewed, activeStoreId],
  );

  const {
    categories: allCategories,
    topNavigation: topNavigationCategories,
    sections: categorySections,
    isLoading: categoriesLoading,
    isError: categoriesError,
    refetch: refetchCategories,
    serviceability: categoriesServiceability,
  } = useGroceryCategories();

  const deals = useMemo(
    () =>
      storeProducts
        .filter((p) => discountPercent(p) !== null)
        .sort((a, b) => (discountPercent(b) ?? 0) - (discountPercent(a) ?? 0)),
    [storeProducts],
  );

  const featured = useMemo(() => storeProducts.filter((p) => p.is_featured), [storeProducts]);

  /** Store shelves grouped by the product's own category, in backend order. */
  const shelves = useMemo(() => {
    const map = new Map<number, { category: Category; products: Product[] }>();
    for (const p of storeProducts) {
      if (!p.category_id || !p.category) continue;
      const entry = map.get(p.category_id);
      if (entry) entry.products.push(p);
      else map.set(p.category_id, { category: p.category, products: [p] });
    }
    const order = new Map(allCategories.map((c, i) => [c.id, i]));
    return [...map.values()].sort((a, b) => (order.get(a.category.id) ?? 1e9) - (order.get(b.category.id) ?? 1e9));
  }, [storeProducts, allCategories]);

  const selectCategory = (id: number | null) => {
    if (id === null) router.replace('/grocery' as never);
    else
      router.push({
        pathname: '/grocery',
        params: { category: String(id) },
      } as never);
  };

  const categoryName = useMemo(
    () => (inCategory ? (findGroceryCategory(allCategories, categoryId)?.name ?? 'Grocery') : 'Grocery'),
    [allCategories, categoryId, inCategory],
  );

  /* ------------------------------------------------------------------ */
  /* Pinned search + category navigation (Blinkit's sticky top)          */
  /* ------------------------------------------------------------------ */

  const insets = useSafeAreaInsets();
  const [scrollY, setScrollY] = useState(0);
  const [heroSearchY, setHeroSearchY] = useState<number | null>(null);
  const [heroSearchH, setHeroSearchH] = useState(0);

  // The hero publishes its own search row's offset and height, so the pinned
  // copy takes over exactly where the scrolling one sits.
  const onHeroSearchLayout = useCallback((y: number, height: number) => {
    setHeroSearchY(y);
    setHeroSearchH(height);
  }, []);

  const onScroll = useCallback((e: { nativeEvent: { contentOffset: { y: number } } }) => {
    setScrollY(e.nativeEvent.contentOffset.y);
  }, []);

  // The search row is at the safe-area edge exactly when the pinned copy
  // appears; until then it stays hidden so the two never show together.
  const pinned = !inCategory && heroSearchY !== null && heroSearchH > 0 && scrollY + insets.top + 8 >= heroSearchY;

  /**
   * The home's category navigation. The hero version is light-on-artwork and
   * sits immediately under the search; the pinned dock version is the normal
   * dark-on-cream treatment. Both use the same backend data and callback.
   */
  const renderCategoryNav = (tone: 'artwork' | 'surface') => {
    if (categoriesLoading) {
      return <GroceryCategoryRailSkeleton />;
    }
    if (categoriesError) {
      return (
        <EmptyState
          title="Couldn't load categories"
          message="Try again in a moment."
          actionLabel="Retry"
          onAction={() => refetchCategories()}
        />
      );
    }
    if (topNavigationCategories.length === 0) {
      return <EmptyState title="No categories available" message="Products are still listed below." />;
    }
    return (
      <GroceryCategoryCarousel
        categories={topNavigationCategories}
        selectedId={null}
        onSelect={selectCategory}
        tone={tone}
      />
    );
  };

  const hero = !inCategory ? (
    <GroceryHero
      banners={heroBanners}
      // The festive cards render inside the hero, so the artwork keeps running
      // behind them — the same continuous festive surface as the web home.
      festivePromos={festivePromos}
      // Light-on-artwork only when the Admin hero has an image; the cream
      // fallback keeps the normal dark tabs so labels remain legible.
      categoryNav={renderCategoryNav(heroBanners[0]?.image ? 'artwork' : 'surface')}
      onSearchLayout={onHeroSearchLayout}
    />
  ) : null;

  /**
   * The backend's verdict for this address. Every grocery query above reports
   * one, so the first available wins; until the first response arrives it stays
   * null and the screen keeps rendering its loading state instead of guessing.
   *
   * When it reports the location as unserviceable the whole screen is replaced
   * by the unavailable state — no stores, categories, shelves, carousels or
   * recommendations, and never a fallback list from a previous address.
   */
  const serviceability =
    storesServiceability ?? home.data?.serviceability ?? catalogue.serviceability ?? categoriesServiceability ?? null;
  const notServiceable = serviceability?.is_serviceable === false;

  /**
   * Shared shell for the home's error / serviceability / no-store states. The
   * home keeps the Admin hero at the top (so the header, location and search
   * stay available); the category view keeps its compact category header.
   */
  const stateScreen = (children: React.ReactNode) => (
    <Screen
      header={
        inCategory ? (
          <GroceryCategoryHeader categoryName={categoryName} onOpenLocation={() => setLocOpen(true)} />
        ) : null
      }
      background={colors.grocery[50]}
    >
      {hero}
      <View style={inCategory ? undefined : styles.stateBody}>{children}</View>
      <LocationSelector open={locOpen} onOpenChange={setLocOpen} />
    </Screen>
  );

  /* ------------------------------- states ------------------------------- */

  if (storeError) {
    return stateScreen(
      <EmptyState
        title="Couldn't load grocery stores"
        message="Please check your connection and try again."
        actionLabel="Retry"
        onAction={() => refetchStores()}
      />,
    );
  }

  // The location is outside Grocery's coverage (or Grocery is switched off in
  // its zone): render the shared unavailable state with a working way out.
  if (!storeLoading && notServiceable) {
    return stateScreen(<GroceryServiceabilityNotice serviceability={serviceability} />);
  }

  // No eligible store near the customer: never fall back to a distant store.
  if (!storeLoading && !activeStore) {
    return stateScreen(
      <EmptyState
        title="No grocery stores available near you"
        message="Try changing your delivery location."
        actionLabel="Change location"
        onAction={() => setLocOpen(true)}
      />,
    );
  }

  return (
    <Screen
      header={
        inCategory ? (
          <GroceryCategoryHeader categoryName={categoryName} onOpenLocation={() => setLocOpen(true)} />
        ) : null
      }
      bottomBar={cartCount > 0 ? <ViewCartBar type="grocery" /> : undefined}
      /* The home and category both sit on the Grocery cream page surface. */
      background={colors.grocery[50]}
      /*
       * The category screen owns its own two independently scrolling columns
       * (sidebar + product list), so the Screen must not wrap it in a single
       * page ScrollView, which would move both columns together. The home
       * branch keeps the default page scroll so the hero can scroll away.
       */
      scroll={!inCategory}
      scrollProps={{
        scrollEventThrottle: 16,
        onScroll,
      }}
      /*
       * Pinned top copy: compact search + category navigation, rendered above
       * the scroll body only after the hero's own rows scroll away. It is not
       * in flow, so there is never a second visible copy on screen.
       */
      overlay={
        pinned ? (
          <View style={[styles.pinnedTop, { paddingTop: insets.top + 8 }]}>
            <View style={styles.pinnedSearch}>
              <SearchBar variant="brand" />
            </View>
            {topNavigationCategories.length > 0 && (
              <GroceryCategoryCarousel
                categories={topNavigationCategories}
                selectedId={null}
                onSelect={selectCategory}
                tone="surface"
              />
            )}
          </View>
        ) : null
      }
    >
      {/* The Admin festive hero owns the header, search and category navigation
          on the home. It is part of the scroll content. */}
      {hero}

      {storeLoading && !activeStore ? (
        <View style={styles.page}>
          <Loader label="Finding the nearest store" />
        </View>
      ) : activeStore ? (
        inCategory ? (
          /* Category view: filter toolbar and dense grid under the shared
             header — no duplicated store card, no stale filters. */
          <GroceryCategoryView
            key={categoryId}
            store={activeStore}
            categories={allCategories}
            selectedCategoryId={categoryId}
            onSelect={selectCategory}
            onSelectAll={() => selectCategory(null)}
          />
        ) : (
          <>
            <View style={styles.pageBody}>
              {/* 1. Blinkit-style category sections: parent names are the
                  section headings and the parent's own active child categories
                  are the image tiles beneath them. Built from the backend
                  hierarchy — no flat parent-card grid, no hardcoded lists. */}
              {categoriesLoading ? (
                <GroceryCategoryGridSkeleton />
              ) : categoriesError ? (
                <EmptyState
                  title="Couldn't load categories"
                  message="Try again in a moment."
                  actionLabel="Retry"
                  onAction={() => refetchCategories()}
                />
              ) : (
                categorySections.map((s) => (
                  <GroceryCategoryGrid
                    key={s.parent.id}
                    categories={s.children}
                    title={s.parent.name}
                    onSelect={selectCategory}
                    onSelectParent={() => selectCategory(s.parent.id)}
                  />
                ))
              )}

              {/* 2. Admin promotional carousel, after the hero's festive grid
                  and before the store's product shelves. It is hidden entirely
                  when no Grocery promotion is configured. */}
              {promoSection}

              {/* 3. Product sections, all scoped to the active store. */}
              {catalogue.isError ? (
                <EmptyState
                  title="Couldn't load this store's products"
                  message={`We're having trouble loading the catalogue for ${activeStore.name}.`}
                  actionLabel="Retry"
                  onAction={() => catalogue.refetch()}
                />
              ) : catalogue.isLoading && storeProducts.length === 0 ? (
                <Loader label="Loading store products" />
              ) : (
                <>
                  <GroceryProductShelf
                    title="Recommended for you"
                    subtitle="Popular at this store"
                    products={(featured.length > 0 ? featured : storeProducts).slice(0, 12)}
                  />

                  <GroceryProductShelf
                    title="Deals for you"
                    subtitle={`Discounted picks at ${activeStore.name}`}
                    products={deals.slice(0, 12)}
                  />

                  {buyAgain.length > 0 && (
                    <GroceryProductShelf
                      title="Frequently bought"
                      subtitle="From your recent grocery orders"
                      products={buyAgain.slice(0, 10)}
                    />
                  )}

                  {shelves.map((shelf) => (
                    <GroceryProductShelf
                      key={shelf.category.id}
                      title={shelf.category.name}
                      subtitle={`${shelf.products.length} item${shelf.products.length === 1 ? '' : 's'}`}
                      products={shelf.products}
                    />
                  ))}

                  {recentlyViewed.length > 0 && (
                    <GroceryProductShelf title="Recently viewed" products={recentlyViewed.slice(0, 10)} />
                  )}

                  <GroceryStoreTerms store={activeStore} distanceKm={distanceKm} />
                </>
              )}
            </View>
          </>
        )
      ) : null}

      <LocationSelector open={locOpen} onOpenChange={setLocOpen} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 14,
    paddingBottom: 8,
    gap: 22,
  },
  /* Pinned search + category rail, overlaid at the top of the screen. */
  pinnedTop: {
    backgroundColor: colors.grocery[50],
    paddingBottom: 6,
    shadowColor: '#100e0a',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  pinnedSearch: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  /* Home sections below the hero's category navigation. */
  pageBody: {
    paddingTop: 14,
    paddingBottom: 8,
    gap: 22,
  },
  /* Insets for the shared error / serviceability / no-store state bodies. */
  stateBody: {
    paddingTop: 14,
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 16,
  },
});
