import { useNavigate } from 'react-router-dom';
import type { Banner } from '@/types/catalog';
import { Rail } from '@/components/home/section-header';
import { Image } from '@/components/ui/image';
import { bannerRoute } from '@/lib/banner';

/**
 * Compact horizontal brand-promotion carousel for the Grocery home.
 *
 * Renders only the Admin-managed `grocery_home_brand_promo` placement, so a
 * banner for another surface (Food hero, Rides, Home) can never appear here.
 * Cards stay small enough that two or three are visible at once on a phone and
 * widen naturally on desktop, matching the quick-commerce reference layout.
 */
export function BrandPromoRail({ banners }: { banners: Banner[] }) {
  const navigate = useNavigate();
  if (banners.length === 0) return null;

  return (
    <section aria-label="Grocery brand promotions">
      <Rail className="gap-3">
        {banners.map((b) => (
          <button
            key={b.id}
            onClick={() => navigate(bannerRoute(b))}
            aria-label={b.title}
            className="tap group relative aspect-[16/9] w-[64vw] max-w-[300px] shrink-0 snap-start overflow-hidden rounded-2xl shadow-card transition-shadow hover:shadow-float sm:w-[300px]"
          >
            <Image
              src={b.image}
              alt=""
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <span className="absolute inset-0 bg-gradient-to-t from-ink-950/85 via-ink-950/20 to-transparent" />
            <span className="absolute inset-x-0 bottom-0 p-3 text-left">
              {b.cta_text && (
                <span className="mb-1.5 inline-block rounded-full bg-grocery-500 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-ink-900">
                  {b.cta_text}
                </span>
              )}
              <span className="block line-clamp-2 text-base font-extrabold leading-tight text-white drop-shadow-sm">
                {b.title}
              </span>
              {b.subtitle && (
                <span className="mt-0.5 block line-clamp-2 text-xs leading-snug text-white/75">
                  {b.subtitle}
                </span>
              )}
            </span>
          </button>
        ))}
      </Rail>
    </section>
  );
}
