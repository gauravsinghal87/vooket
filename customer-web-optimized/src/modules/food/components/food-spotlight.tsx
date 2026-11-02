import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, TicketPercent } from 'lucide-react';
import type { Offer } from '@/shared/types/catalog';
import { SERVICE_ROUTES, serviceTheme } from '@/shared/components/service/service-theme';
import type { ServiceType } from '@/shared/types/models';
import { toast } from '@/shared/components/ui/toast';
import { cn } from '@/shared/utils/utils';

/**
 * Compose the reference's red offer line ("₹80 OFF above ₹149 ›") from the
 * offer's real fields. `flat` → "₹N OFF", `percentage` → "N% OFF", and
 * `min_order` appends the threshold. Returns null when the offer carries
 * neither a value nor a minimum (nothing to say), so no copy is invented.
 */
export function spotLightOfferLine(offer: Offer): string | null {
  const value = offer.value ?? null;
  const min = offer.min_order ? parseFloat(offer.min_order) : null;
  let head: string | null = null;
  if (value !== null && offer.type === 'percentage') head = `${value}% OFF`;
  else if (value !== null && offer.type === 'flat') head = `₹${value} OFF`;
  if (head && min !== null && Number.isFinite(min) && min > 0) {
    return `${head} above ₹${min.toLocaleString('en-IN')}`;
  }
  return head;
}

interface FoodSpotlightProps {
  promos: Offer[];
}

/**
 * The "IN THE SPOTLIGHT" block — the reference's full-width promo card
 * carousel: a wide, softly tinted card with the offer title in large bold
 * type, a muted subtitle, the red offer line, a circular badge on the right
 * (the reference shows the brand logo there; Vooket offers carry no artwork,
 * so the service-tinted offer badge stands in), and page dots below that track
 * the horizontal scroll position.
 *
 * Every tap keeps the reference behavior: offers with a code copy it to the
 * clipboard, offers without one navigate to their service home. Data comes
 * straight from the Food home payload's `promos` — nothing is hardcoded.
 */
export function FoodSpotlight({ promos }: FoodSpotlightProps) {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [index, setIndex] = useState(0);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const card = el.firstElementChild as HTMLElement | null;
    if (!card) return;
    const stride = card.offsetWidth + 12;
    setIndex(Math.max(0, Math.min(promos.length - 1, Math.round(el.scrollLeft / stride))));
  }, [promos.length]);

  // Keep the dot in sync when the list changes (e.g. after refetch).
  useEffect(() => setIndex(0), [promos.length]);

  if (promos.length === 0) return null;

  // The block sits inside the page's "IN THE SPOTLIGHT" section (which owns
  // the titled heading), so it renders a plain region rather than a second
  // landmark around the carousel.
  return (
    <div aria-label="In the spotlight">
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="no-scrollbar -mr-[var(--page-gutter)] flex snap-x snap-mandatory gap-3 overflow-x-auto pr-[var(--page-gutter)]"
      >
        {promos.map((offer) => {
          const theme = serviceTheme(offer.service as ServiceType);
          const line = spotLightOfferLine(offer);
          return (
            <button
              key={offer.id}
              type="button"
              onClick={() => {
                if (offer.code) toast(`Code ${offer.code} copied to clipboard`);
                else navigate(SERVICE_ROUTES[offer.service as ServiceType]);
              }}
              className="tap group relative w-[calc(100vw-2*var(--page-gutter))] max-w-[560px] shrink-0 snap-start overflow-hidden rounded-2xl border border-neutral-200/70 bg-gradient-to-br from-neutral-50 via-white to-food-50/40 p-5 text-left shadow-card transition-transform duration-200 hover:-translate-y-0.5 active:scale-[0.99] sm:w-auto sm:min-w-[420px]"
              aria-label={offer.title}
            >
              <div className="flex items-start gap-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-2xl font-bold leading-tight text-neutral-900">
                    {offer.title}
                  </p>
                  {offer.subtitle && (
                    <p className="mt-1.5 line-clamp-2 text-base leading-snug text-neutral-500">
                      {offer.subtitle}
                    </p>
                  )}
                  {line && (
                    <p className="mt-4 flex items-center gap-1 text-sm font-semibold text-food-600">
                      {line}
                      <ChevronRight className="h-4 w-4" strokeWidth={2.5} />
                    </p>
                  )}
                </div>

                {/* The reference puts the brand's round logo here. Food offers
                    carry no image, so the service-tinted badge with the real
                    offer tag holds the same corner of the composition. */}
                <span
                  className={cn(
                    'grid h-16 w-16 shrink-0 place-items-center rounded-full border border-neutral-200/80 bg-white text-center shadow-sm',
                    theme.strong
                  )}
                  aria-hidden
                >
                  <TicketPercent className="h-7 w-7" strokeWidth={1.8} />
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {promos.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 pt-3" aria-hidden>
          {promos.map((promo, i) => (
            <span
              key={promo.id}
              className={cn(
                'h-1.5 rounded-full bg-neutral-300 transition-all duration-200',
                i === index ? 'w-4 bg-food-600' : 'w-1.5'
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
