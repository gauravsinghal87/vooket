import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BadgePercent, Clock, Star } from 'lucide-react';
import { repositories } from '@/repositories';
import type { Product, Restaurant } from '@/types/catalog';
import { Image } from '@/components/ui/image';
import { formatDistanceKm } from '@/lib/geo';
import { deliveryDistanceKm, deliveryEtaText } from '@/lib/delivery-eta';
import { cn } from '@/lib/utils';
import { RestaurantVegMark, restaurantOffer, restaurantRating } from '@/components/restaurant/restaurant-card-parts';

/** ₹ price in the Indian grouping, the way the reference prints it. */
const dishPrice = (price: string | number) => `₹${Number(price).toLocaleString('en-IN')}`;

/**
 * How many dish slides a card shows: enough to swipe through, few enough that
 * the rail never becomes a full menu on the home page.
 */
const MAX_DISH_SLIDES = 8;

/** How long each dish stays on screen before the rail advances by itself. */
const AUTOPLAY_MS = 3000;

/**
 * The large, single restaurant card — the one used by the "Restaurants
 * delivering to you" feed, recreated from the reference's featured card:
 *
 *  - a 5:3 media area that is a **slider of the kitchen's own dishes**, each
 *    slide carrying its price in the top-left corner (the reference sells the
 *    food, not the storefront). The dish images come from the menu endpoint,
 *    fetched once the card nears the viewport and cached per restaurant;
 *  - while those load — and for kitchens without any dish photo — the area
 *    keeps the single cover photo with the offer/dish chip over its top-left,
 *    exactly as before;
 *  - a white panel underneath: the name in large bold type with the green
 *    rounded rating pill hard right, the ETA | distance meta line, and the
 *    offer row with the blue coupon icon.
 *
 * The card carries no favourite button (the feed does not support
 * favourites), so that control is not drawn — matching the reference only
 * where Vooket has the data to back it.
 *
 * The rating, offer and veg marker come from `restaurant-card-parts`, so this
 * layout and the compact grid card always show the same real values.
 */
export interface FeaturedRestaurantCardProps {
  restaurant: Restaurant;
  /** Client-side distance, used only when the API returned no routed estimate. */
  distanceKm?: number | null;
  /** Load the image eagerly instead of lazily. */
  eager?: boolean;
  /** Extra rows rendered under the meta line. */
  children?: ReactNode;
  className?: string;
}

export function FeaturedRestaurantCard({
  restaurant,
  distanceKm,
  eager = true,
  children,
  className,
}: FeaturedRestaurantCardProps) {
  const rating = restaurantRating(restaurant);
  const offer = restaurantOffer(restaurant);
  const featuredItem = restaurant.featured_item ?? null;

  // The photo area is a slider of this kitchen's dishes, so the menu is needed
  // on the card itself — the feed payload carries no products. It is fetched
  // only once the card approaches the viewport (400px lead), shared through the
  // same `restaurant-menu` cache the cart page already uses, and never blocks
  // the card: until it lands, the cover photo shows.
  const slideHostRef = useRef<HTMLDivElement>(null);
  const [nearViewport, setNearViewport] = useState(false);
  const [slideIndex, setSlideIndex] = useState(0);

  useEffect(() => {
    const el = slideHostRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setNearViewport(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNearViewport(true);
          observer.disconnect();
        }
      },
      { rootMargin: '400px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const menu = useQuery({
    queryKey: ['restaurant-menu', restaurant.id],
    queryFn: () => repositories.food.getMenu(restaurant.id),
    enabled: nearViewport,
    staleTime: 5 * 60 * 1000,
  });

  // Dishes that actually have a photo, featured ones first so the opening
  // slide is the kitchen's signature plate.
  const slides = useMemo(() => {
    const withPhoto = (menu.data ?? []).flatMap((c) => c.products ?? []).filter((p): p is Product => !!p.image);
    return withPhoto
      .sort((a, b) => Number(b.is_featured) - Number(a.is_featured))
      .slice(0, MAX_DISH_SLIDES);
  }, [menu.data]);

  const activeSlide = slides.length > 0 ? Math.min(slideIndex, slides.length - 1) : 0;

  /* ---------------------------------------------------------------- */
  /* Auto-play — a new dish every three seconds                       */
  /* ---------------------------------------------------------------- */

  const railRef = useRef<HTMLDivElement>(null);
  const slideCountRef = useRef(0);
  const pointerDownRef = useRef(false);
  const lastInteractionRef = useRef(0);

  const noteInteraction = () => {
    lastInteractionRef.current = Date.now();
  };

  useEffect(() => {
    slideCountRef.current = slides.length;
    if (slides.length < 2) return;

    const id = window.setInterval(() => {
      const el = railRef.current;
      if (!el || document.hidden || pointerDownRef.current) return;
      // Three seconds of *stillness* between slides: grabbing the rail (or
      // wheeling over it) restarts the countdown, so the card never slides
      // out from under the customer's finger.
      if (Date.now() - lastInteractionRef.current < AUTOPLAY_MS) return;

      const width = el.clientWidth || 1;
      const count = slideCountRef.current;
      const current = Math.round(el.scrollLeft / width);
      el.scrollTo({ left: ((current + 1) % count) * width, behavior: 'smooth' });
    }, AUTOPLAY_MS);

    return () => window.clearInterval(id);
  }, [slides.length]);

  // ETA and route distance come from the backend estimate for the customer's
  // delivery location; the client-side distance is only a fallback for when the
  // API could not return a routed estimate. The reference separates the two
  // with a pipe, not a middot.
  const etaText = deliveryEtaText(restaurant);
  const distanceLabel = formatDistanceKm(deliveryDistanceKm(restaurant) ?? distanceKm);
  const metaText = [etaText, distanceLabel].filter(Boolean).join(' | ') || '—';

  // The badge over a cover photo names the featured dish and its real price, as
  // in the reference; kitchens without one fall back to their offer text. It is
  // only used when the dish slider has nothing to show.
  const badgeText = featuredItem
    ? `${featuredItem.name} · ${dishPrice(featuredItem.price)}`
    : offer;

  return (
    <Link
      to={`/restaurant/${restaurant.id}`}
      className={cn('group block', className)}
      aria-label={restaurant.name}
    >
      <article className="overflow-hidden rounded-3xl border border-neutral-200/80 bg-white shadow-card transition-transform duration-200 hover:-translate-y-0.5">
        <div
          ref={slideHostRef}
          className="relative aspect-[5/3] w-full overflow-hidden bg-neutral-100"
        >
          {slides.length > 0 ? (
            <>
              {/* One dish per screen, scroll-snapped like the reference; the
                  price sits in the left corner of the slide it belongs to, so
                  it always names the dish on screen. */}
              <div
                ref={railRef}
                className="no-scrollbar flex h-full w-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain"
                onScroll={(e) => {
                  const el = e.currentTarget;
                  const width = el.clientWidth || 1;
                  setSlideIndex(Math.round(el.scrollLeft / width));
                }}
                onPointerDown={() => {
                  pointerDownRef.current = true;
                  noteInteraction();
                }}
                onPointerUp={() => {
                  pointerDownRef.current = false;
                  noteInteraction();
                }}
                onPointerCancel={() => {
                  pointerDownRef.current = false;
                  noteInteraction();
                }}
                onWheel={noteInteraction}
                aria-label={`${restaurant.name} dishes`}
              >
                {slides.map((dish, index) => (
                  <div key={dish.id} className="relative h-full w-full shrink-0 snap-center">
                    <Image
                      src={dish.image}
                      eager={eager && index === 0}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                    <span className="absolute left-3 top-3 z-10 flex items-center gap-1.5 rounded-md bg-ink-950/80 px-2 py-1 text-[13px] font-semibold leading-tight text-white backdrop-blur-sm">
                      {typeof dish.is_veg === 'boolean' && (
                        <RestaurantVegMark isVeg={dish.is_veg} size={13} />
                      )}
                      {dishPrice(dish.price)}
                    </span>
                  </div>
                ))}
              </div>

              {slides.length > 1 && (
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 bottom-2.5 z-10 flex justify-end gap-1.5 mr-2"
                >
                  {slides.map((dish, index) => (
                    <span
                      key={dish.id}
                      className={cn(
                        'h-1.5 rounded-full transition-all duration-200',
                        index === activeSlide ? 'w-4 bg-white' : 'w-1.5 bg-white/60'
                      )}
                    />
                  ))}
                </div>
              )}

              {/* The offer chip still belongs on the photo, now against the
                  free corner: the price owns the left one. */}
              {/* {offer && (
                <span className="absolute right-3 top-3 z-10 flex max-w-[calc(100%-140px)] items-center gap-1.5 rounded-md bg-ink-950/80 px-2 py-1 text-[13px] font-medium leading-tight text-white backdrop-blur-sm">
                  <span className="truncate">{offer}</span>
                </span>
              )} */}
            </>
          ) : (
            <>
              <Image
                src={restaurant.cover_image ?? restaurant.logo}
                eager={eager}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              />

              {badgeText && (
                <span className="absolute left-3 top-3 z-10 flex max-w-[calc(100%-64px)] items-center gap-1.5 rounded-md bg-ink-950/80 px-2 py-1 text-[13px] font-medium leading-tight text-white backdrop-blur-sm">
                  {featuredItem && <RestaurantVegMark isVeg={restaurant.is_veg} size={13} />}
                  <span className="truncate">{badgeText}</span>
                </span>
              )}
            </>
          )}

          {!restaurant.is_open && (
            <span className="absolute inset-0 z-10 flex items-center justify-center bg-ink-900/55 text-[11px] font-extrabold uppercase tracking-widest text-white backdrop-blur-sm">
              Closed
            </span>
          )}
        </div>

        <div className="min-w-0 p-4">
          {/* The name and the rating pill share this row: the name takes the
              free space on the left, the pill sits hard against the right
              edge — inside the white panel, never over the photo. */}
          <div className="flex items-start justify-between gap-3">
            <h3 className="min-w-0 flex-1 truncate text-2xl font-bold leading-tight tracking-tight text-neutral-900">
              {restaurant.name}
            </h3>
            {rating !== null && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-z-green px-2.5 py-1 text-[13px] font-bold leading-none text-white">
                <Star className="h-3.5 w-3.5 fill-white" strokeWidth={0} />
                {rating.toFixed(1)}
              </span>
            )}
          </div>

          <p className="mt-1.5 flex items-center gap-1.5 text-sm font-medium text-neutral-500">
            <Clock className="h-4 w-4 shrink-0" />
            <span className="truncate">{metaText}</span>
          </p>

          {offer && (
            <p className="mt-1.5 flex items-center gap-1.5 text-sm font-semibold text-z-info">
              <BadgePercent className="h-4 w-4 shrink-0" />
              <span className="truncate">{offer}</span>
            </p>
          )}

          {children}
        </div>
      </article>
    </Link>
  );
}
