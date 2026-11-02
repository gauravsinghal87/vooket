import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Banner } from '@/shared/types/catalog';
import { Image } from '@/shared/components/ui/image';
import { bannerRoute } from '@/shared/utils/banner';
import { cn } from '@/shared/utils/utils';

interface OrderTrackingPromoProps {
  banners: Banner[];
  /** First-load state, so the banner area can hold its shape before data lands. */
  loading?: boolean;
}

/**
 * One-banner-per-slide promotional carousel for the order-tracking page.
 *
 * Renders only the Admin-managed `order_tracking` placement for the order's
 * service, so a banner aimed at a home hero (or another service's slot) can
 * never appear here. It is intentionally edge-to-edge (the order page renders
 * it outside the `max-w-2xl` content container, with no rounding), so the
 * artwork reads as a full-width hero band rather than a card. Each slide is
 * exactly the full viewport width — there is no partial "next banner" preview —
 * and the centered pagination dots overlay the bottom of the image, just above
 * the compact tracking card that overlaps this section. Horizontal swipe works
 * natively; pointer devices get prev/next controls. Targeting, tap actions and
 * loading/empty behaviour are preserved.
 *
 * The dots sit `bottom-9` above the image's bottom edge so they clear the card's
 * `-mt-5` overlap and stay visible between the banner and the card.
 */
export function OrderTrackingPromo({ banners, loading = false }: OrderTrackingPromoProps) {
  const navigate = useNavigate();
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  const count = banners.length;
  const showChrome = count > 1;

  const scrollToIndex = (i: number) => {
    const el = trackRef.current;
    if (!el) return;
    const clamped = Math.max(0, Math.min(i, count - 1));
    const child = el.children[clamped] as HTMLElement | undefined;
    if (child) el.scrollTo({ left: child.offsetLeft, behavior: 'smooth' });
    setIndex(clamped);
  };

  // Derive the active slide from the scroll offset so the dots also update while
  // the user swipes, not only when they tap a dot/arrow.
  const onScroll = () => {
    const el = trackRef.current;
    if (!el) return;
    let nearest = 0;
    let nearestDist = Infinity;
    for (let i = 0; i < el.children.length; i++) {
      const dist = Math.abs((el.children[i] as HTMLElement).offsetLeft - el.scrollLeft);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = i;
      }
    }
    setIndex(nearest);
  };

  if (count === 0) {
    if (!loading) return null;
    return (
      <section aria-label="Promotions" aria-busy="true" className="w-full">
        <div className="aspect-[2/1] w-full animate-pulse bg-neutral-200 sm:aspect-[21/9]" />
      </section>
    );
  }

  return (
    <section aria-roledescription="carousel" aria-label="Promotions" className="relative w-full">
      <div
        ref={trackRef}
        onScroll={onScroll}
        className="flex w-full scroll-snap-x overflow-x-auto no-scrollbar"
      >
        {banners.map((b, i) => (
          <div
            key={b.id}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${count}`}
            className="w-full shrink-0 basis-full snap-center"
          >
            <button
              type="button"
              onClick={() => navigate(bannerRoute(b))}
              aria-label={b.title}
              className="tap group relative block aspect-[2/1] w-full overflow-hidden transition-shadow sm:aspect-[21/9]"
            >
              <Image
                src={b.image}
                alt=""
                eager={i === 0}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              {/* Top-weighted scrim keeps the copy legible, and the light
                  bottom scrim keeps the pagination dots readable over bright
                  imagery — the lower edge stays open for the overlapping card. */}
              <span className="absolute inset-0 bg-gradient-to-b from-ink-950/85 via-ink-950/25 to-transparent" />
              <span className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-ink-950/55 to-transparent" />
              <span className="absolute inset-x-0 top-0 p-4 text-left">
                {b.cta_text && (
                  <span className="mb-1.5 inline-block rounded-full bg-white/90 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-ink-900 backdrop-blur">
                    {b.cta_text}
                  </span>
                )}
                <span className="block line-clamp-2 text-base font-extrabold leading-tight text-white drop-shadow-sm sm:text-lg">
                  {b.title}
                </span>
                {b.subtitle && (
                  <span className="mt-0.5 block line-clamp-2 text-xs leading-snug text-white/80">{b.subtitle}</span>
                )}
              </span>
            </button>
          </div>
        ))}
      </div>

      {showChrome && (
        <div className="pointer-events-none absolute inset-x-0 bottom-9 z-20 flex justify-center gap-1.5">
          {banners.map((b, i) => (
            <button
              key={b.id}
              type="button"
              onClick={() => scrollToIndex(i)}
              aria-label={`Go to slide ${i + 1}`}
              aria-current={i === index}
              className={cn(
                'tap pointer-events-auto h-1.5 rounded-full transition-all duration-300',
                i === index ? 'w-5 bg-white' : 'w-1.5 bg-white/50 hover:bg-white/80'
              )}
            />
          ))}
        </div>
      )}

      {showChrome && (
        <>
          <button
            type="button"
            onClick={() => scrollToIndex(index - 1)}
            disabled={index === 0}
            aria-label="Previous promotion"
            className="absolute left-2 top-1/2 z-20 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-ink-950/50 text-white backdrop-blur transition hover:bg-ink-950/70 disabled:pointer-events-none disabled:opacity-0 sm:flex"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => scrollToIndex(index + 1)}
            disabled={index >= count - 1}
            aria-label="Next promotion"
            className="absolute right-2 top-1/2 z-20 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-ink-950/50 text-white backdrop-blur transition hover:bg-ink-950/70 disabled:pointer-events-none disabled:opacity-0 sm:flex"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </>
      )}
    </section>
  );
}
