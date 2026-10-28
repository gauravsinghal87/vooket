import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  BadgePercent,
  Beef,
  Check,
  ChevronDown,
  Heart,
  Leaf,
  MapPin,
  Search,
  ShoppingCart,
  Star,
  UtensilsCrossed,
  X,
  Zap,
} from 'lucide-react';
import { repositories } from '@/repositories';
import { Image } from '@/components/ui/image';
import { Price } from '@/components/ui/price';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/state';
import { ProductListItem } from '@/components/restaurant/product-list-item';
import { AddToCartControl } from '@/components/product/add-to-cart';
import { discountPercent } from '@/components/product/product-card';
import { ViewCartBar } from '@/components/cart/view-cart-bar';
import { LocationSelector } from '@/components/layout/location-selector';
import { Rail } from '@/components/home/section-header';
import { useCart } from '@/hooks/useCart';
import { useAppStore } from '@/store/appStore';
import { DEFAULT_LOCATION } from '@/lib/location';
import { formatDistanceKm } from '@/lib/geo';
import { deliveryDistanceKm, deliveryEtaText } from '@/lib/delivery-eta';
import { cn } from '@/lib/utils';
import type { Product } from '@/types/catalog';
import type { OrderItem } from '@/types/models';

type VegFilter = 'veg' | 'nonveg';

/** "By 37K+" — Zomato's compact rating-count caption. */
function formatRatingCount(count: number): string {
  if (count >= 1000) {
    const k = count / 1000;
    return `By ${k >= 100 ? Math.round(k) : Math.round(k * 10) / 10}K+`;
  }
  return `By ${count}`;
}

/** Relative age of a past order: "1 month ago", "3 days ago", "today". */
function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 31) return `${days} days ago`;
  const months = Math.max(1, Math.floor(days / 30.44));
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;
  const years = Math.max(1, Math.floor(days / 365.25));
  return `${years} year${years === 1 ? '' : 's'} ago`;
}

export function RestaurantPage() {
  const { id } = useParams();
  const restaurantId = Number(id);
  const searchRef = useRef<HTMLInputElement>(null);
  const infoSentinelRef = useRef<HTMLDivElement>(null);

  const restaurant = useQuery({
    queryKey: ['restaurant', restaurantId],
    queryFn: () => repositories.food.getRestaurant(restaurantId),
    enabled: Number.isFinite(restaurantId),
  });

  const menu = useQuery({
    queryKey: ['menu', restaurantId],
    queryFn: () => repositories.food.getMenu(restaurantId),
    enabled: Number.isFinite(restaurantId),
  });

  const r = restaurant.data;
  const { data: foodCart } = useCart('food');
  const cartCount = (foodCart?.items ?? []).reduce((n, i) => n + i.quantity, 0);
  const hasFoodItems = (foodCart?.items ?? []).length > 0;

  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<Set<VegFilter>>(new Set());
  const [fav, setFav] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  // The compact header bar is always mounted (Zomato's white top bar); the
  // restaurant's name fades into it once the info panel scrolls under the bar,
  // driven by an IntersectionObserver on a 1px sentinel at the panel's top edge.
  const [nameVisible, setNameVisible] = useState(false);
  // The two promo sections collapse like the reference's section chevrons.
  const [pastOrdersOpen, setPastOrdersOpen] = useState(true);
  const [mostOrderedOpen, setMostOrderedOpen] = useState(true);

  // The location row on this screen opens the same shared selector the header
  // uses — the header itself is dropped on this route, so the page mounts it.
  const locOpen = useAppStore((s) => s.locationSelectorOpen);
  const openLocationSelector = useAppStore((s) => s.openLocationSelector);
  const closeLocationSelector = useAppStore((s) => s.closeLocationSelector);
  const origin = useAppStore((s) => s.location) ?? DEFAULT_LOCATION;

  const filterMatch = (p: { name: string; description?: string | null; is_veg: boolean | null }) => {
    const q = query.trim().toLowerCase();
    if (q && !p.name.toLowerCase().includes(q) && !(p.description ?? '').toLowerCase().includes(q)) return false;
    if (filters.has('veg') && p.is_veg !== true) return false;
    if (filters.has('nonveg') && p.is_veg !== false) return false;
    return true;
  };

  const toggleFilter = (value: VegFilter) => {
    setFilters((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  };

  const categories = useMemo(
    () =>
      (menu.data ?? [])
        .map((cat) => ({ ...cat, products: cat.products.filter(filterMatch) }))
        .filter((cat) => cat.products.length > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [menu.data, query, filters]
  );

  const menuById = useMemo(() => {
    const map = new Map<number, Product>();
    for (const cat of menu.data ?? []) for (const p of cat.products) map.set(p.id, p);
    return map;
  }, [menu.data]);

  /**
   * "Your Orders and Collections": this customer's most recent food order from
   * this restaurant, resolved to real menu products. The section renders only
   * when the backend returns history that still maps onto the live menu —
   * nothing is fabricated when there is no order history.
   */
  const pastOrder = useQuery({
    queryKey: ['restaurant-past-order', restaurantId],
    queryFn: async () => {
      const page = await repositories.orders.getOrders({ order_type: 'food', page: 1 });
      const list = page?.data ?? [];
      const match = list.find((o) => o.restaurant_id === restaurantId && o.status !== 'CANCELLED');
      if (!match) return null;
      if (match.items && match.items.length > 0) return match;
      try {
        return await repositories.orders.getOrder(match.id);
      } catch {
        return null;
      }
    },
    enabled: Number.isFinite(restaurantId) && !!r && !menu.isLoading,
    staleTime: 60_000,
  });

  const pastItems = useMemo(() => {
    const items = pastOrder.data?.items ?? [];
    const seen = new Set<number>();
    const out: { item: OrderItem; product: Product }[] = [];
    for (const it of items) {
      if (seen.has(it.product_id)) continue;
      const product = menuById.get(it.product_id);
      if (!product || !product.is_available) continue;
      seen.add(it.product_id);
      out.push({ item: it, product });
      if (out.length >= 3) break;
    }
    return out;
  }, [pastOrder.data, menuById]);

  const orderedAt = pastOrder.data?.created_at ?? null;

  // "Most ordered together": the kitchen's featured dishes first, then the rest
  // of the live menu — a real, ordered selection from this restaurant only.
  const mostOrdered = useMemo(() => {
    const all = (menu.data ?? []).flatMap((cat) => cat.products.filter((p) => p.is_available));
    return [...all.filter((p) => p.is_featured), ...all.filter((p) => !p.is_featured)].slice(0, 8);
  }, [menu.data]);

  const scrollToMenu = () => {
    document.getElementById('restaurant-menu')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const scrollToSection = (elementId: string) => {
    setActiveSection(elementId);
    document.getElementById(elementId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const focusSearch = () => {
    scrollToMenu();
    window.setTimeout(() => searchRef.current?.focus(), 300);
  };

  // Scroll-spy: keep the matching menu-category chip highlighted as the menu
  // scrolls, so the selector always reflects the section in view.
  useEffect(() => {
    const ids = [
      ...(mostOrdered.length > 0 || pastItems.length > 0 ? ['section-recommended'] : []),
      ...categories.map((cat) => `category-${cat.id}`),
    ];
    if (ids.length === 0) return;
    const onScroll = () => {
      const threshold = 168;
      let current: string | null = null;
      for (const sectionId of ids) {
        const el = document.getElementById(sectionId);
        if (el && el.getBoundingClientRect().top <= threshold) current = sectionId;
      }
      setActiveSection(current ?? ids[0]);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [mostOrdered.length, pastItems.length, categories]);

  // Reveal the restaurant name in the top bar once the info panel's top edge
  // passes the bar line (56px).
  useEffect(() => {
    const el = infoSentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setNameVisible(!entry.isIntersecting),
      { rootMargin: '-56px 0px 0px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [r]);

  const etaText = r ? deliveryEtaText(r) : null;
  const distanceKm = r ? (deliveryDistanceKm(r) ?? null) : null;
  const straightLineKm = useMemo(() => {
    if (!r || distanceKm != null) return null;
    const lat = Number(r.latitude);
    const lng = Number(r.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return null;
    const R = 6371;
    const dLat = ((lat - origin.latitude) * Math.PI) / 180;
    const dLng = ((lng - origin.longitude) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((origin.latitude * Math.PI) / 180) *
        Math.cos((lat * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }, [r, distanceKm, origin]);
  const distanceLabel = formatDistanceKm(distanceKm ?? straightLineKm);

  return (
    <div
      className={cn(
        'w-full',
        hasFoodItems
          ? 'pb-[calc(var(--bottom-dock-h)+7.5rem+env(safe-area-inset-bottom))] md:pb-[calc(var(--bottom-dock-h)+3.5rem)]'
          : 'pb-[calc(var(--bottom-dock-h)+6.5rem+env(safe-area-inset-bottom))] md:pb-[calc(var(--bottom-dock-h)+3.5rem)]'
      )}
    >
      {restaurant.isLoading && (
        <div className="mx-auto w-full max-w-3xl px-[var(--page-gutter)] pt-4">
          <Skeleton className="h-56 w-full" />
        </div>
      )}

      {restaurant.isError && (
        <div className="mx-auto w-full max-w-3xl px-[var(--page-gutter)] pt-4">
          <ErrorState title="Restaurant not found" action={{ label: 'Go back', onClick: () => history.back() }} />
        </div>
      )}

      {r && (
        <>
          {/* Zomato's white top bar: back at the left, the restaurant's name
              faded in once the info panel scrolls beneath it, actions right. */}
          <div className="sticky top-0 z-40 bg-white">
            <div className="mx-auto flex h-14 max-w-3xl items-center gap-2 px-[var(--page-gutter)]">
              <Link
                to="/restaurants"
                aria-label="Go back to restaurants"
                className="tap -ml-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-neutral-700 transition-colors hover:bg-neutral-100"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <h2
                className={cn(
                  'min-w-0 flex-1 truncate text-lg font-bold tracking-tight text-neutral-900 transition-opacity duration-200',
                  nameVisible ? 'opacity-100' : 'pointer-events-none opacity-0'
                )}
              >
                {r.name}
              </h2>
              <div className="flex shrink-0 items-center gap-1" />
            </div>
          </div>

          {/* White information panel, flush under the bar as in the reference. */}
          <div className="relative z-10 bg-white">
            <div className="mx-auto w-full max-w-3xl px-[var(--page-gutter)] pt-3">
              {/* 1px sentinel at the panel's top edge: the observer flips the
                  name in the top bar on exactly when this passes the bar line. */}
              <div ref={infoSentinelRef} aria-hidden className="h-px w-full" />

              {r.is_veg && (
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-z-green/10 px-2 py-1 text-[13px] font-bold text-z-green">
                  <Leaf className="h-3.5 w-3.5" /> Pure Veg
                </span>
              )}

              {/* Name hard left, Zomato's green rating block hard right. */}
              <div className="mt-2 flex items-start justify-between gap-3">
                <h1 className="min-w-0 text-[26px] font-extrabold leading-tight tracking-tight text-neutral-900">
                  {r.name}
                </h1>
                <div className="shrink-0 text-right">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-extrabold text-white',
                      r.rating ? 'bg-z-green' : 'bg-neutral-500'
                    )}
                  >
                    <Star className="h-3.5 w-3.5 fill-current" />
                    {r.rating ? Number(r.rating).toFixed(1) : 'New'}
                  </span>
                  {r.rating_count > 0 && (
                    <p className="mt-1 text-[11px] font-semibold text-neutral-500 underline decoration-dotted">
                      {formatRatingCount(r.rating_count)}
                    </p>
                  )}
                </div>
              </div>

              {/* Distance · area, opening the shared location selector. */}
              <button
                type="button"
                onClick={openLocationSelector}
                className="tap mt-2 flex w-full items-center gap-1.5 text-left text-[15px] font-medium text-neutral-700"
                aria-label="Change delivery location"
              >
                <MapPin className="h-4 w-4 shrink-0 text-neutral-500" />
                <span className="truncate">
                  {distanceLabel ? `${distanceLabel} · ` : ''}
                  {r.address ?? origin.label}
                </span>
                <ChevronDown className="h-4 w-4 shrink-0 text-neutral-400" />
              </button>

              {/* Delivery estimate row. */}
              <p className="mt-1.5 flex items-center gap-1.5 text-[15px] font-medium text-neutral-700">
                <Zap className="h-4 w-4 shrink-0 fill-z-green text-z-green" />
                {etaText ? (
                  <span className="font-semibold text-z-green">{etaText}</span>
                ) : (
                  <span className="font-semibold text-z-green">
                    {r.avg_delivery_time_min ? `${r.avg_delivery_time_min} mins` : 'Delivery available'}
                  </span>
                )}
              </p>

              {/* Small badges: the reference's "Frequently reordered" chip plus
                  the facts this payload really carries. */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {r.is_featured && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-[13px] font-semibold text-neutral-700">
                    <Check className="h-3.5 w-3.5 text-z-green" /> Frequently reordered
                  </span>
                )}
                {r.order_type === 'both' && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-[13px] font-semibold text-neutral-700">
                    Delivery &amp; Pickup
                  </span>
                )}
                {r.dine_in && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-[13px] font-semibold text-neutral-700">
                    Dine-in
                  </span>
                )}
                {r.min_order_amount && parseFloat(String(r.min_order_amount)) > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-[13px] font-semibold text-neutral-700">
                    Min. order ₹{Number(r.min_order_amount).toLocaleString('en-IN')}
                  </span>
                )}
              </div>

              {/* Offer strip — the reference's offer row with the count on the right. */}
              {r.free_delivery_above && parseFloat(String(r.free_delivery_above)) > 0 && (
                <div className="-mx-[var(--page-gutter)] mt-3.5 flex items-center gap-2.5 border-y border-neutral-100 bg-white px-[var(--page-gutter)] py-3">
                  <BadgePercent className="h-4.5 w-4.5 shrink-0 text-z-info" />
                  <p className="min-w-0 flex-1 truncate text-[15px] font-bold text-neutral-900">
                    FREE DELIVERY above ₹{Number(r.free_delivery_above).toLocaleString('en-IN')}
                  </p>
                </div>
              )}

              {/* Zomato's signature grey band between the info and the menu. */}
              <div aria-hidden className="-mx-[var(--page-gutter)] mt-4 border-b-8 border-neutral-100" />

              {/* Sticky quick-filter + menu-category tabs, styled as the
                  reference's outlined chips and red-underline text tabs. */}
              <div className="sticky top-14 z-30 -mx-4 mb-1 mt-1 border-b border-neutral-100 bg-white/95 px-4 py-1.5 backdrop-blur sm:mx-0 sm:px-0">
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                  <button
                    type="button"
                    onClick={() => toggleFilter('veg')}
                    aria-pressed={filters.has('veg')}
                    className={cn(
                      'inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors',
                      filters.has('veg')
                        ? 'border-z-green bg-z-green/10 text-z-green'
                        : 'border-neutral-200 text-neutral-600 hover:border-neutral-300'
                    )}
                  >
                    <Leaf className="h-3.5 w-3.5" /> Veg
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleFilter('nonveg')}
                    aria-pressed={filters.has('nonveg')}
                    className={cn(
                      'inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors',
                      filters.has('nonveg')
                        ? 'border-danger bg-danger/10 text-danger'
                        : 'border-neutral-200 text-neutral-600 hover:border-neutral-300'
                    )}
                  >
                    <Beef className="h-3.5 w-3.5" /> Non-veg
                  </button>
                  <span className="mx-1 h-4 w-px shrink-0 bg-neutral-200" />
                  {mostOrdered.length > 0 && (
                    <button
                      type="button"
                      onClick={() => scrollToSection('section-recommended')}
                      className={cn(
                        'shrink-0 border-b-2 px-3 py-2 text-[13px] font-semibold transition-colors',
                        activeSection === 'section-recommended'
                          ? 'border-food-600 text-food-600'
                          : 'border-transparent text-neutral-600 hover:text-neutral-900'
                      )}
                    >
                      Most ordered
                    </button>
                  )}
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => scrollToSection(`category-${cat.id}`)}
                      className={cn(
                        'shrink-0 border-b-2 px-3 py-2 text-[13px] font-semibold transition-colors',
                        activeSection === `category-${cat.id}`
                          ? 'border-food-600 text-food-600'
                          : 'border-transparent text-neutral-600 hover:text-neutral-900'
                      )}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Menu */}
              <div id="restaurant-menu" className="scroll-mt-[7.5rem]">
                {menu.isLoading && <Skeleton className="h-40 w-full rounded-2xl" />}

                {/* Your Orders and Collections — real history, collapsible. */}
                {pastItems.length > 0 && (
                  <section className="border-b border-neutral-100 py-3.5">
                    <button
                      type="button"
                      onClick={() => setPastOrdersOpen((v) => !v)}
                      className="flex w-full items-start justify-between gap-3 text-left"
                    >
                      <span>
                        <h3 className="text-[19px] font-extrabold leading-tight tracking-tight text-neutral-900">
                          Your Orders and Collections
                        </h3>
                        <p className="mt-0.5 text-[13px] text-neutral-500">
                          Past customisations are pre-selected
                        </p>
                      </span>
                      <ChevronDown
                        className={cn(
                          'mt-1 h-5 w-5 shrink-0 text-neutral-500 transition-transform duration-200',
                          !pastOrdersOpen && '-rotate-180'
                        )}
                      />
                    </button>
                    {pastOrdersOpen && (
                      <div className="mt-1">
                        {pastItems.map(({ item, product }) => (
                          <PastOrderRow
                            key={item.id}
                            item={item}
                            product={product}
                            caption={orderedAt ? `You ordered ${timeAgo(orderedAt)}` : undefined}
                          />
                        ))}
                      </div>
                    )}
                  </section>
                )}

                {/* Most ordered together — a horizontal dish rail with the
                    floating ADD control, as in the reference. */}
                {mostOrdered.length > 0 && (
                  <section id="section-recommended" className="scroll-mt-[7.5rem] border-b border-neutral-100 py-3.5">
                    <button
                      type="button"
                      onClick={() => setMostOrderedOpen((v) => !v)}
                      className="flex w-full items-start justify-between gap-3 text-left"
                    >
                      <h3 className="text-[19px] font-extrabold leading-tight tracking-tight text-neutral-900">
                        Most ordered together
                      </h3>
                      <ChevronDown
                        className={cn(
                          'mt-1 h-5 w-5 shrink-0 text-neutral-500 transition-transform duration-200',
                          !mostOrderedOpen && '-rotate-180'
                        )}
                      />
                    </button>
                    {mostOrderedOpen && (
                      <Rail className="mt-3">
                        {mostOrdered.map((p) => (
                          <div key={p.id} className="w-[170px] shrink-0">
                            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-neutral-100">
                              <Image src={p.image} alt="" className="h-full w-full object-cover" />
                              {!p.is_available && <span className="absolute inset-0 bg-ink-900/45" />}
                              <div className="absolute bottom-1.5 right-1.5">
                                <AddToCartControl productId={p.id} type="food" size="add" product={p} />
                              </div>
                            </div>
                            <p className="mt-1.5 truncate text-[13px] font-bold text-neutral-900" title={p.name}>
                              {p.name}
                            </p>
                            <Price value={p.price} size="sm" />
                          </div>
                        ))}
                      </Rail>
                    )}
                  </section>
                )}

                {categories.map((cat) => (
                  <section key={cat.id} id={`category-${cat.id}`} className="scroll-mt-[7.5rem]">
                    <h3 className="flex items-center justify-between border-b border-neutral-100 py-3.5 text-[17px] font-semibold tracking-tight text-neutral-900">
                      {cat.name}
                      <span className="text-xs font-medium text-neutral-400">{cat.products.length} items</span>
                    </h3>
                    {cat.products.map((p, i) => (
                      <Fragment key={p.id}>
                        <ProductListItem product={p} type="food" />
                        <div aria-hidden className={cn('h-px w-full bg-neutral-100', i === cat.products.length - 1 && 'mb-4')} />
                      </Fragment>
                    ))}
                  </section>
                ))}

                {!menu.isLoading && categories.length === 0 && pastItems.length === 0 && mostOrdered.length === 0 && (
                  <div className="py-12 text-center text-sm text-neutral-500">No items match your search or filters.</div>
                )}
                {!menu.isLoading && categories.length === 0 && (pastItems.length > 0 || mostOrdered.length > 0) && (
                  <div className="py-8 text-center text-sm text-neutral-500">No more items match your search or filters.</div>
                )}
              </div>
            </div>
          </div>

          <LocationSelector
            open={locOpen}
            onOpenChange={(open) => (open ? openLocationSelector() : closeLocationSelector())}
          />
        </>
      )}

      {/* Bottom search + menu bar (fixed on mobile, in-flow on desktop) */}
      {r && (
        <div className="fixed inset-x-0 bottom-[calc(var(--bottom-dock-h)+env(safe-area-inset-bottom)+var(--spacing)*3)] z-30 px-[var(--page-gutter)] md:static md:z-auto md:mx-auto md:mt-5 md:max-w-3xl md:px-0">
          <div className="mx-auto flex max-w-3xl items-center gap-2 rounded-2xl border border-neutral-200 bg-white p-1.5 shadow-[0_-2px_16px_rgb(12_10_9/0.08)] md:shadow-card">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-food-600" />
              <input
                ref={searchRef}
                type="search"
                inputMode="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search in ${r.name}`}
                aria-label={`Search in ${r.name}`}
                className="w-full rounded-xl bg-neutral-50 py-2.5 pl-9 pr-8 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 focus:bg-white"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={scrollToMenu}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-ink-900 px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-ink-800"
            >
              <UtensilsCrossed className="h-4 w-4" /> Menu
            </button>
          </div>
        </div>
      )}

      <ViewCartBar
        type="food"
        bottomClass="bottom-[calc(var(--bottom-dock-h)+4rem+env(safe-area-inset-bottom)+var(--spacing)*6)]"
      />
    </div>
  );
}

/**
 * One row of "Your Orders and Collections": the dish photo with its veg mark,
 * the live price with the struck original and off-label, the relative order
 * caption, and the ADD pill for the same product.
 */
function PastOrderRow({
  item,
  product,
  caption,
}: {
  item: OrderItem;
  product: Product;
  caption?: string;
}) {
  const off = discountPercent(product);
  const discounted =
    product.compare_at_price && parseFloat(product.compare_at_price) > parseFloat(product.price);

  return (
    <div className="flex gap-3.5 py-3.5">
      <Link
        to={`/product/${product.id}`}
        state={{ product, type: 'food' }}
        className="relative block h-16 w-16 shrink-0 sm:h-20 sm:w-20"
        aria-label={product.name}
      >
        <span className="relative block h-full w-full overflow-hidden rounded-2xl bg-neutral-100">
          <Image src={item.product_image ?? product.image} alt="" className="h-full w-full object-cover" />
        </span>
        {product.is_veg !== null && (
          <span className="absolute left-1 top-1 rounded-[3px] bg-white p-[2px] shadow-sm">
            <span
              className={cn(
                'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[2px] border-2 bg-white',
                product.is_veg ? 'border-success' : 'border-danger'
              )}
            >
              <span className={cn('h-1 w-1 rounded-full', product.is_veg ? 'bg-success' : 'bg-danger')} />
            </span>
          </span>
        )}
      </Link>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold leading-snug text-neutral-900">{product.name}</p>
        <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
          <Price value={product.price} size="md" />
          {discounted && (
            <span className="text-xs text-neutral-400 line-through">
              ₹{Number(product.compare_at_price).toLocaleString('en-IN')}
            </span>
          )}
        </div>
        {off !== null && product.is_available && (
          <p className="mt-0.5 text-[13px] font-bold text-z-info">{off}% OFF</p>
        )}
        {caption && <p className="mt-1 text-[13px] text-neutral-500">{caption}</p>}
      </div>

      <div className="flex shrink-0 flex-col items-center justify-center gap-1.5 self-center">
        <AddToCartControl productId={product.id} type="food" size="outline" product={product} />
        <span className="text-center text-[10px] font-medium uppercase tracking-wide text-neutral-400">
          Customisable
        </span>
      </div>
    </div>
  );
}
