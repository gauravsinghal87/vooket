import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { PackageOpen, Store as StoreIcon, Tag as TagIcon, Tags, Truck } from 'lucide-react';
import { repositories } from '@/shared/repositories';
import { groceryService } from '@/modules/grocery/services';
import { useAppStore } from '@/shared/stores/appStore';
import { DEFAULT_LOCATION } from '@/shared/utils/location';
import { coordsKey, formatDistanceKm } from '@/shared/utils/geo';
import { useActiveGroceryStore } from '@/modules/grocery/hooks/useActiveGroceryStore';
import { productsOfStore, useStoreCatalogue } from '@/modules/grocery/hooks/useStoreCatalogue';
import { PromoRail } from '@/shared/components/home/promo-rail';
import { discountPercent } from '@/shared/components/product/product-card';
import { ViewCartBar } from '@/features/cart/components/view-cart-bar';
import { CategoryCarousel, CategoryGrid } from '@/modules/grocery/components/category-browser';
import { BrandPromoRail } from '@/modules/grocery/components/brand-promo-rail';
import { GroceryHero } from '@/modules/grocery/components/grocery-hero';
import { SearchBar } from '@/shared/components/service/search-bar';
import { SeeAllProductsLink } from '@/modules/grocery/components/store-context';
import { ProductShelf } from '@/modules/grocery/components/product-shelf';
import { GroceryCategoryView } from '@/modules/grocery/components/category-view';
import { GroceryServiceabilityNotice } from '@/modules/grocery/components/serviceability-notice';
import { useGroceryCategories } from '@/modules/grocery/hooks/useGroceryCategories';
import { LocationSelector } from '@/shared/components/location-selector';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/shared/components/ui/state';
import { Rating } from '@/shared/components/ui/rating';
import { cn } from '@/shared/utils/utils';
import type { Category, Store } from '@/shared/types/catalog';

/**
 * Nearest-store grocery experience.
 *
 * USER LOCATION -> nearest eligible grocery store -> ACTIVE STORE
 *               -> store categories -> store products -> cart -> checkout
 *
 * There is exactly one active store at a time and every product section,
 * category and search result on this page is scoped to it.
 */
export function GroceryPage() {
  const [params, setParams] = useSearchParams();
  const [locOpen, setLocOpen] = useState(false);

  // Every grocery read on this page is requested for the same effective
  // delivery location, so the backend resolves one zone for the whole page.
  const location = useAppStore((s) => s.location);
  const openLocationSelector = useAppStore((s) => s.openLocationSelector);
  const origin = location ?? DEFAULT_LOCATION;

  const selectedCategoryId = useMemo(() => {
    const raw = params.get('category');
    if (!raw) return null;
    const id = Number(raw);
    return Number.isFinite(id) && id > 0 ? id : null;
  }, [params]);

  const {
    activeStore,
    activeStoreId,
    distanceKm,
    isLoading: storeLoading,
    isError: storeError,
    refetch: refetchStores,
    serviceability: storesServiceability,
  } = useActiveGroceryStore();

  // Store catalogue: categories, shelves and the selected-category grid.
  const catalogue = useStoreCatalogue(activeStoreId, { perPage: 60 });
  const storeProducts = catalogue.products;

  // Discovery payload is only used for non-catalogue content (banners, offers)
  // and recently viewed, which is filtered down to the active store below.
  const home = useQuery({
    queryKey: ['grocery-home', coordsKey(origin)],
    queryFn: () =>
      groceryService.getHome({
        latitude: origin.latitude,
        longitude: origin.longitude,
      }),
    staleTime: 1000 * 60 * 5,
  });

  // The Grocery hero is its own placement, fetched through the existing public
  // banner endpoint. Using the dedicated query key means a Food/Rides banner
  // can never be substituted for it.
  const heroQuery = useQuery({
    queryKey: ['banners', 'grocery_home_hero'],
    queryFn: () => repositories.banners.getByPlacement('grocery', 'grocery_home_hero'),
  });
  const heroBanners = useMemo(
    () => (heroQuery.data ?? []).filter((b) => b.placement === 'grocery_home_hero'),
    [heroQuery.data],
  );
  const heroBannerId = heroBanners[0]?.id ?? null;

  // The Grocery brand-promo cards are their own placement, fetched with the
  // dedicated endpoint so a banner for another surface can never appear in it.
  // Strict equality on the placement also drops the shared `all`/null banners
  // the public endpoint would otherwise include, and the active hero id is
  // removed so the festive artwork is never repeated as a promo card.
  const brandPromoQuery = useQuery({
    queryKey: ['banners', 'grocery_home_brand_promo'],
    queryFn: () => repositories.banners.getByPlacement('grocery', 'grocery_home_brand_promo'),
  });
  const brandPromos = (brandPromoQuery.data ?? []).filter(
    (b) => b.placement === 'grocery_home_brand_promo' && b.id !== heroBannerId,
  );

  // The festive promo cards are their own placement, fetched with the dedicated
  // endpoint so a banner for another surface can never appear in the grid.
  // Strict equality on the placement also drops the shared `all`/null banners
  // the public endpoint would otherwise include.
  const festivePromoQuery = useQuery({
    queryKey: ['banners', 'grocery_home_festive_promo'],
    queryFn: () => repositories.banners.getByPlacement('grocery', 'grocery_home_festive_promo'),
  });
  const festivePromos = useMemo(
    () =>
      (festivePromoQuery.data ?? []).filter(
        (b) => b.placement === 'grocery_home_festive_promo' && b.id !== heroBannerId,
      ),
    [festivePromoQuery.data, heroBannerId],
  );

  // The home renders the shared header inside `GroceryHero`; the category view
  // keeps the compact header supplied by `AppShell`.
  const isHome = selectedCategoryId === null;

  // Blinkit's pinned top: once the hero's search row reaches the viewport top,
  // its compact copy (search + category navigation) takes over. The copy is
  // hidden and out of flow until then, so the two rows never appear together.
  const [dockVisible, setDockVisible] = useState(false);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const heroSearch = document.querySelector<HTMLElement>('[data-grocery-hero-search]');
      setDockVisible(Boolean(heroSearch && heroSearch.getBoundingClientRect().top <= 0.5));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [isHome]);

  const promos = useMemo(() => (home.data?.promos ?? []).filter((o) => o.service === 'grocery'), [home.data?.promos]);

  /**
   * Admin promotional carousel. It deliberately lives after every main
   * category section, not in the hero. The dedicated brand-promo placement
   * wins; when none is configured the existing grocery offers rail is used.
   * Both are already scoped to Grocery and ordered by the backend.
   */
  const promoSection = useMemo(() => {
    if (!isHome) return null;
    if (brandPromos.length > 0) return <BrandPromoRail banners={brandPromos} />;
    if (promos.length > 0) return <PromoRail promos={promos} />;
    return null;
  }, [brandPromos, isHome, promos]);

  const recentlyViewed = useMemo(
    () => productsOfStore(home.data?.recentlyViewed, activeStoreId),
    [home.data?.recentlyViewed, activeStoreId],
  );

  /**
   * "Frequently bought" is the customer's own grocery reorder history, served
   * by the existing discovery endpoint and narrowed to the active store so the
   * rail never links to a store the customer is not shopping from.
   */
  const buyAgain = useMemo(
    () => productsOfStore(home.data?.buyAgain, activeStoreId),
    [home.data?.buyAgain, activeStoreId],
  );

  /**
   * Categories come from the existing `GET /grocery/categories` endpoint in the
   * admin-managed order the backend returns, so a category created in Admin
   * shows up here automatically with its own image and no code change.
   */
  const {
    categories: allCategories,
    topNavigation: topNavigationCategories,
    sections: categorySections,
    isLoading: categoriesLoading,
    isError: categoriesError,
    refetch: refetchCategories,
    serviceability: categoriesServiceability,
  } = useGroceryCategories();

  /**
   * The main content area is purely section-based now (Blinkit-style): parent
   * categories are headings and their children are the image tiles, so there
   * is no separate flat parent grid to reconcile with the sections.
   */
  const deals = useMemo(
    () =>
      storeProducts
        .filter((p) => discountPercent(p) !== null)
        .sort((a, b) => (discountPercent(b) ?? 0) - (discountPercent(a) ?? 0)),
    [storeProducts],
  );

  const featured = useMemo(() => storeProducts.filter((p) => p.is_featured), [storeProducts]);

  /** Store shelves grouped by the product's own category. */
  const shelves = useMemo(() => {
    const map = new Map<number, { category: Category; products: typeof storeProducts }>();
    for (const p of storeProducts) {
      if (!p.category_id || !p.category) continue;
      const entry = map.get(p.category_id);
      if (entry) entry.products.push(p);
      else map.set(p.category_id, { category: p.category, products: [p] });
    }
    // Shelf order follows the backend category order, not the product order.
    const order = new Map(allCategories.map((c, i) => [c.id, i]));
    return [...map.values()].sort((a, b) => (order.get(a.category.id) ?? 1e9) - (order.get(b.category.id) ?? 1e9));
  }, [storeProducts, allCategories]);

  const selectCategory = (categoryId: number | null) => {
    if (categoryId === null) {
      params.delete('category');
    } else {
      params.set('category', String(categoryId));
    }
    setParams(params);
  };

  /**
   * The home's category navigation. The hero version is light-on-artwork and
   * sits immediately under the search pill; the pinned dock version is the
   * normal dark-on-cream treatment. Both are driven by the same backend data
   * and selection callback.
   */
  const renderCategoryNav = (tone: 'artwork' | 'surface') => {
    if (categoriesLoading) {
      return <CategoryCarouselSkeleton surface={tone === 'artwork' ? 'hero' : 'page'} />;
    }
    if (categoriesError) {
      return (
        <ErrorState
          title="Couldn't load categories"
          description="We're having trouble loading the grocery categories. Try again."
          action={{ label: 'Retry', onClick: () => void refetchCategories() }}
        />
      );
    }
    if (topNavigationCategories.length === 0) {
      return (
        <EmptyState
          icon={Tags}
          title="No categories available"
          description="Grocery categories have not been added yet. Products are still listed below."
        />
      );
    }
    return (
      <CategoryCarousel
        categories={topNavigationCategories}
        selectedId={selectedCategoryId}
        onSelect={selectCategory}
        surface={tone === 'artwork' ? 'hero' : 'page'}
        tone={tone}
      />
    );
  };

  // Light-on-artwork only when the Admin hero has an image. The cream fallback
  // keeps the normal dark tabs, so labels stay legible. The hero calls this for
  // the surface it is painting: the in-flow block over the festive artwork, and
  // the docked copy that pins to the top of the viewport on scroll.
  const categoryNav = (tone: 'artwork' | 'surface') => renderCategoryNav(heroBanners[0]?.image ? tone : 'surface');
  // The festive grid renders inside the hero, so the artwork runs behind it
  // (the reference keeps its promo tiles on the festive surface, not on the
  // plain page below it).
  const hero = isHome ? (
    <GroceryHero banners={heroBanners} categoryNav={categoryNav} festivePromos={festivePromos} />
  ) : null;

  /**
   * Shared shell for the home's loading/error/serviceability states. On the
   * home the hero always leads (so the header, location, search and category
   * navigation stay available); the category view keeps the current compact
   * layout.
   */
  const pageState = (children: ReactNode) =>
    isHome ? (
      <div className="pb-4">
        {hero}
        <div className="mx-auto w-full max-w-5xl px-[var(--page-gutter)] pt-6">{children}</div>
      </div>
    ) : (
      <div className="space-y-6">{children}</div>
    );

  /**
   * The backend's verdict for this address. Every grocery query above reports
   * one, so the first available wins; until the first response arrives it stays
   * null and the page keeps rendering its loading state instead of guessing.
   *
   * When it reports the location as unserviceable the whole page is replaced by
   * the unavailable state — no stores, categories, shelves, carousels or
   * recommendations, and never a fallback list from a previous address.
   */
  const serviceability =
    storesServiceability ?? home.data?.serviceability ?? catalogue.serviceability ?? categoriesServiceability ?? null;
  const notServiceable = serviceability?.is_serviceable === false;

  /* ------------------------------- states ------------------------------- */

  if (storeError) {
    return pageState(
      <div className="py-10">
        <ErrorState
          title="Couldn't load grocery stores"
          description="Please check your connection and try again."
          action={{ label: 'Retry', onClick: () => void refetchStores() }}
        />
      </div>,
    );
  }

  // The location is outside Grocery's coverage (or Grocery is switched off in
  // its zone): render the shared unavailable state with a working way out.
  if (!storeLoading && notServiceable) {
    return pageState(
      <>
        <GroceryServiceabilityNotice serviceability={serviceability} onChangeLocation={openLocationSelector} />
        <LocationSelector open={locOpen} onOpenChange={setLocOpen} />
      </>,
    );
  }

  // No eligible store near the customer: never fall back to a distant store.
  if (!storeLoading && !activeStore) {
    return pageState(
      <>
        <Skeleton className="h-28 w-full rounded-2xl" />
        <EmptyState
          icon={StoreIcon}
          title="No grocery stores available near you"
          description="Try changing your delivery location."
          action={{ label: 'Change location', onClick: () => setLocOpen(true) }}
        />
        <LocationSelector open={locOpen} onOpenChange={setLocOpen} />
      </>,
    );
  }

  return (
    <div className={cn('pb-4', !isHome && 'space-y-6')}>
      {/* On the home the full-bleed Admin hero owns the header, search and the
          only category navigation; the category view keeps the shared compact
          header. */}
      {hero}

      {/* Pinned top copy: the compact search + category navigation appears only
          after the hero's own rows scroll away, matching Blinkit's sticky top. */}
      {isHome && (
        <div
          data-grocery-sticky-top
          aria-hidden={!dockVisible}
          className={cn(
            'fixed inset-x-0 top-0 z-50 bg-grocery-50 transition-transform duration-200 will-change-transform',
            dockVisible
              ? 'translate-y-0 shadow-[0_8px_16px_-12px_rgb(16_14_10/0.35)]'
              : 'pointer-events-none invisible -translate-y-full',
          )}
        >
          <div className="mx-auto flex w-full max-w-5xl items-center px-[var(--page-gutter)] pt-2.5 pb-1">
            <SearchBar variant="brand" className="w-full [&>a]:h-[50px]" />
          </div>
          {topNavigationCategories.length > 0 && (
            <div className="mx-auto w-full max-w-5xl px-[var(--page-gutter)] pb-1">{renderCategoryNav('surface')}</div>
          )}
        </div>
      )}

      <div className={isHome ? 'mx-auto w-full max-w-5xl space-y-6 px-[var(--page-gutter)] pt-4' : undefined}>
        {/* Loading the nearest store: never show another store's products. */}
        {storeLoading && !activeStore && (
          <div className="space-y-4">
            <Skeleton className="h-11 w-full rounded-2xl" />
            <Skeleton className="h-24 w-full rounded-2xl" />
          </div>
        )}

        {activeStore && (
          <>
            {selectedCategoryId !== null ? (
              /*
               * Category screen (`/grocery?category=<id>`): compact header in the
               * Grocery header slot, then filter bar, category rail and a dense
               * product grid. Remounting per category resets the local filters.
               */
              <GroceryCategoryView
                key={selectedCategoryId}
                store={activeStore}
                categories={allCategories}
                selectedCategoryId={selectedCategoryId}
                onSelect={selectCategory}
                onSelectAll={() => selectCategory(null)}
              />
            ) : (
              <>
                {/*
                 * 1. Blinkit-style category sections: parent names are the
                 * section headings and the parent's own active child categories
                 * are the image tiles beneath them. Built from the backend
                 * hierarchy — no flat parent-card grid, no hardcoded lists.
                 */}
                {categoriesLoading ? (
                  <CategoryGridSkeleton />
                ) : categoriesError ? (
                  <ErrorState
                    title="Couldn't load categories"
                    description="We're having trouble loading the grocery categories. Try again."
                    action={{
                      label: 'Retry',
                      onClick: () => void refetchCategories(),
                    }}
                  />
                ) : (
                  categorySections.map((s) => (
                    <CategoryGrid
                      key={s.parent.id}
                      categories={s.children}
                      selectedId={selectedCategoryId}
                      onSelect={selectCategory}
                      onSelectParent={() => selectCategory(s.parent.id)}
                      title={s.parent.name}
                    />
                  ))
                )}



                {/*
                 * 3. Admin promotional carousel, after the festive grid and
                 * before the store's product shelves. It is hidden entirely
                 * when no Grocery promotion is configured.
                 */}
                {promoSection}

                <div id="grocery-catalogue" className="scroll-mt-32" />

                {/* 3. Product sections, scoped to the active store. */}
                {catalogue.isError ? (
                  <ErrorState
                    title="Couldn't load this store's products"
                    description={`We're having trouble loading the catalogue for ${activeStore.name}. Try again.`}
                    action={{
                      label: 'Retry',
                      onClick: () => void catalogue.refetch(),
                    }}
                  />
                ) : (
                  <>
                    <ProductShelf
                      title="Recommended for you"
                      subtitle="Popular at this store"
                      products={featured.length > 0 ? featured : storeProducts.slice(0, 12)}
                      loading={catalogue.isLoading}
                    />

                    <ProductShelf
                      title="Deals for you"
                      subtitle={`Discounted picks at ${activeStore.name}`}
                      products={deals.slice(0, 12)}
                      loading={catalogue.isLoading}
                      action={<SeeAllProductsLink count={deals.length} to="/search?type=grocery" />}
                    />

                    {buyAgain.length > 0 && (
                      <ProductShelf
                        title="Frequently bought"
                        subtitle="From your recent grocery orders"
                        products={buyAgain.slice(0, 10)}
                        loading={catalogue.isLoading}
                      />
                    )}

                    {shelves.map((shelf) => (
                      <ProductShelf
                        key={shelf.category.id}
                        title={shelf.category.name}
                        subtitle={`${shelf.products.length} item${shelf.products.length === 1 ? '' : 's'}`}
                        products={shelf.products}
                      />
                    ))}

                    {recentlyViewed.length > 0 && <ProductShelf title="Recently viewed" products={recentlyViewed} />}

                    <StoreTerms store={activeStore} distanceKm={distanceKm} />
                  </>
                )}
              </>
            )}
          </>
        )}
      </div>

      <ViewCartBar type="grocery" />
      <LocationSelector open={locOpen} onOpenChange={setLocOpen} />
    </div>
  );
}

/** Compact tab-shaped skeletons for the horizontal category strip. */
function CategoryCarouselSkeleton({ surface = 'band' }: { surface?: 'band' | 'page' | 'hero' }) {
  return (
    <div
      className={cn(
        'edge-bleed flex items-stretch gap-1 overflow-hidden pt-1.5',
        surface === 'band' ? 'bg-grocery-200' : surface === 'page' ? 'bg-grocery-50' : 'bg-transparent',
      )}
    >
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex w-[68px] shrink-0 flex-col items-center gap-1 px-1 pb-3 pt-0.5">
          <Skeleton className="h-7 w-7 rounded-md" />
          <Skeleton className="h-2.5 w-12" />
        </div>
      ))}
    </div>
  );
}

/** Bare tile-and-label skeletons matching the final category grid. */
function CategoryGridSkeleton() {
  return (
    <section>
      <Skeleton className="mb-3 h-4 w-32" />
      <div className="grid grid-cols-4 gap-x-3 gap-y-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className="flex flex-col items-center gap-2">
            <Skeleton className="aspect-square w-full rounded-2xl" />
            <Skeleton className="h-2.5 w-3/4" />
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * Store terms that the header does not show: rating, delivery fee and minimum
 * order. The store name, distance, ETA and the "Details" link live in the
 * Grocery header, so this row deliberately repeats none of them.
 */
function StoreTerms({ store, distanceKm }: { store: Store; distanceKm: number | null }) {
  return (
    <section className="rounded-2xl border border-grocery-200 bg-white p-4 shadow-card">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-neutral-600">
        <Rating value={store.rating} count={store.rating_count} />
        {formatDistanceKm(distanceKm) && (
          <span className="inline-flex items-center gap-1 font-semibold text-success">
            <Truck className="h-3.5 w-3.5" /> {formatDistanceKm(distanceKm)} away
          </span>
        )}
        {Number(store.min_order_amount) > 0 && (
          <span className="inline-flex items-center gap-1">
            <PackageOpen className="h-3.5 w-3.5" /> Min order ₹{Number(store.min_order_amount).toLocaleString('en-IN')}
          </span>
        )}
        {Number(store.delivery_fee) > 0 ? (
          <span className="inline-flex items-center gap-1">
            <TagIcon className="h-3.5 w-3.5" /> Delivery ₹{Number(store.delivery_fee).toLocaleString('en-IN')}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 font-semibold text-success">
            <TagIcon className="h-3.5 w-3.5" /> Free delivery
          </span>
        )}
      </div>
    </section>
  );
}
