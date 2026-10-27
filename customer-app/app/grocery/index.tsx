import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Screen } from '@/components/Screen';
import { ViewCartBar } from '@/components/cards';
import {
  GroceryBrandPromoRail,
  GroceryCategoryCarousel,
  GroceryCategoryGrid,
  GroceryCategoryGridSkeleton,
  GroceryCategoryHeader,
  GroceryCategoryRailSkeleton,
  GroceryProductShelf,
  GroceryPromoRail,
  GroceryStoreTerms,
} from '@/components/grocery';
import { GroceryCategoryView } from '@/components/groceryCategory';
import { EmptyState, Loader } from '@/components/ui/primitives';
import { LocationSelector } from '@/components/LocationSelector';
import { GroceryServiceabilityNotice } from '@/components/GroceryServiceabilityNotice';
import { repositories } from '@/api/repositories';
import { useActiveGroceryStore } from '@/hooks/useActiveGroceryStore';
import { productsOfStore, useStoreCatalogue } from '@/hooks/useStoreCatalogue';
import { useCart } from '@/hooks/useCart';
import { useGroceryCategories } from '@/hooks/useGroceryCategories';
import { findGroceryCategory } from '@/lib/groceryCategories';
import { coordsKey } from '@/lib/geo';
import { discountPercent } from '@/lib/utils';
import { colors } from '@/theme';
import type { Category, Offer, Product } from '@/types/catalog';

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

  // Discovery payload is only used for site-wide content (banners, offers) and
  // reorder history, all filtered down to the active store below.
  const home = useQuery({
    queryKey: ['grocery-home', coordsKey(origin)],
    queryFn: () => repositories.grocery.getHome({ latitude: origin.latitude, longitude: origin.longitude }),
    staleTime: 1000 * 60 * 5,
  });

  // The brand-promo carousel uses its own placement, fetched with the dedicated
  // endpoint so a banner for another surface (Food, Rides) can never appear.
  // Strict equality also drops the shared `all`/null banners the endpoint
  // includes, keeping this rail exactly the Admin-configured grocery promos.
  const brandPromo = useQuery({
    queryKey: ['banners', 'grocery_home_brand_promo'],
    queryFn: () => repositories.banners.getByPlacement('grocery', 'grocery_home_brand_promo'),
  });
  const brandPromos = useMemo(
    () => (brandPromo.data ?? []).filter((b) => b.placement === 'grocery_home_brand_promo'),
    [brandPromo.data]
  );

  const cart = useCart('grocery');
  const cartCount = (cart.data?.items ?? []).reduce((n, i) => n + i.quantity, 0);

  const data = home.data;

  const promos = useMemo<Offer[]>(
    () => ((data?.promos ?? []) as Offer[]).filter((o) => o.service === 'grocery'),
    [data?.promos]
  );

  const buyAgain = useMemo(() => productsOfStore(data?.buyAgain, activeStoreId), [data?.buyAgain, activeStoreId]);
  const recentlyViewed = useMemo(
    () => productsOfStore(data?.recentlyViewed, activeStoreId),
    [data?.recentlyViewed, activeStoreId]
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
    [storeProducts]
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
    return [...map.values()].sort(
      (a, b) => (order.get(a.category.id) ?? 1e9) - (order.get(b.category.id) ?? 1e9)
    );
  }, [storeProducts, allCategories]);

  const selectCategory = (id: number | null) => {
    if (id === null) router.replace('/grocery' as never);
    else router.push({ pathname: '/grocery', params: { category: String(id) } } as never);
  };

  const categoryName = useMemo(
    () => (inCategory ? findGroceryCategory(allCategories, categoryId)?.name ?? 'Grocery' : 'Grocery'),
    [allCategories, categoryId, inCategory]
  );

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

  /* ------------------------------- states ------------------------------- */

  if (storeError) {
    return (
      <Screen header="auto">
        <EmptyState
          title="Couldn't load grocery stores"
          message="Please check your connection and try again."
          actionLabel="Retry"
          onAction={() => refetchStores()}
        />
      </Screen>
    );
  }

  // The location is outside Grocery's coverage (or Grocery is switched off in
  // its zone): render the shared unavailable state with a working way out.
  if (!storeLoading && notServiceable) {
    return (
      <Screen header="auto">
        <GroceryServiceabilityNotice serviceability={serviceability} />
        <LocationSelector open={locOpen} onOpenChange={setLocOpen} />
      </Screen>
    );
  }

  // No eligible store near the customer: never fall back to a distant store.
  if (!storeLoading && !activeStore) {
    return (
      <Screen header="auto">
        <EmptyState
          title="No grocery stores available near you"
          message="Try changing your delivery location."
          actionLabel="Change location"
          onAction={() => setLocOpen(true)}
        />
        <LocationSelector open={locOpen} onOpenChange={setLocOpen} />
      </Screen>
    );
  }

  return (
    <Screen
      header={
        inCategory ? (
          <GroceryCategoryHeader categoryName={categoryName} onOpenLocation={() => setLocOpen(true)} />
        ) : (
          'auto'
        )
      }
      bottomBar={cartCount > 0 ? <ViewCartBar type="grocery" /> : undefined}
      /* The web category page sits on `bg-grocery-50`; the home branch keeps
         the default surface so its existing layout is untouched. */
      background={inCategory ? colors.grocery[50] : undefined}
      /*
       * The category screen owns its own two independently scrolling columns
       * (sidebar + product list), so the Screen must not wrap it in a single
       * page ScrollView, which would move both columns together. The home
       * branch keeps the default page scroll.
       */
      scroll={!inCategory}
      /*
       * The category strip is a coordinated sticky header: it renders in the
       * Screen's `stickyHeader` slot, outside the page ScrollView and pinned
       * directly below the fixed themed header (which owns the location, ETA
       * and search areas). There is always exactly one strip on screen, it
       * stays swipeable, and scrolled content can never slide beneath it — no
       * CSS position:sticky, no stickyHeaderIndices.
       */
      stickyHeader={
        activeStore && !inCategory ? (
          <View style={styles.stickyHeader}>
            {categoriesLoading ? (
              <GroceryCategoryRailSkeleton />
            ) : categoriesError ? (
              <EmptyState
                title="Couldn't load categories"
                message="Try again in a moment."
                actionLabel="Retry"
                onAction={() => refetchCategories()}
              />
            ) : topNavigationCategories.length === 0 ? (
              <EmptyState title="No categories available" message="Products are still listed below." />
            ) : (
              <GroceryCategoryCarousel
                categories={topNavigationCategories}
                selectedId={null}
                onSelect={selectCategory}
              />
            )}
          </View>
        ) : undefined
      }
    >
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

              {/* 2. Brand promotion carousel (own placement); when none is
                  configured the existing grocery offers rail is shown. */}
              {brandPromos.length > 0 ? (
                <GroceryBrandPromoRail banners={brandPromos} />
              ) : (
                <GroceryPromoRail promos={promos} />
              )}

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
  /* The coordinated sticky category strip, docked between the fixed header and
     the page scroll body. A solid page backing keeps the rail visually
     continuous on the ink-50 canvas. */
  stickyHeader: {
    backgroundColor: colors.ink[50],
    paddingTop: 8,
    paddingBottom: 6,
  },
  /* Everything below the sticky strip. */
  pageBody: {
    paddingTop: 14,
    paddingBottom: 8,
    gap: 22,
  },
});