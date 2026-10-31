import { useNavigate } from 'react-router-dom';
import type { Banner } from '@/types/catalog';
import { Rail } from '@/components/home/section-header';
import { Image } from '@/components/ui/image';
import { bannerRoute } from '@/lib/banner';

function PromoCard({ banner, featured = false, onOpen }: { banner: Banner; featured?: boolean; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      aria-label={banner.title}
      className={
        featured
          ? 'tap group relative aspect-[16/7] w-full shrink-0 overflow-hidden rounded-2xl shadow-card transition-shadow hover:shadow-float sm:aspect-[16/5]'
          : 'tap group relative aspect-[16/9] w-[64vw] max-w-[300px] shrink-0 snap-start overflow-hidden rounded-2xl shadow-card transition-shadow hover:shadow-float sm:w-[300px]'
      }
    >
      <Image
        src={banner.image}
        alt=""
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
      />
      <span className="absolute inset-0 bg-gradient-to-t from-ink-950/85 via-ink-950/20 to-transparent" />
      <span className="absolute inset-x-0 bottom-0 p-3 text-left">
        {banner.cta_text && (
          <span className="mb-1.5 inline-block rounded-full bg-grocery-500 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-ink-900">
            {banner.cta_text}
          </span>
        )}
        <span className="block line-clamp-2 text-base font-extrabold leading-tight text-white drop-shadow-sm">
          {banner.title}
        </span>
        {banner.subtitle && (
          <span className="mt-0.5 block line-clamp-2 text-xs leading-snug text-white/75">{banner.subtitle}</span>
        )}
      </span>
    </button>
  );
}

/**
 * Admin-driven Grocery promotional cards.
 *
 * Renders only the `grocery_home_brand_promo` placement, so a banner for
 * another surface (Food hero, Rides, Home) can never appear here. The page also
 * removes the active hero banner id, so the festive artwork is never repeated
 * as an ordinary promo card.
 *
 * A single active banner gets the full-width featured treatment after the main
 * category sections; two or more stay a swipeable rail. Everything is ordered
 * by the backend's `sort_order`, not by the client.
 */
export function BrandPromoRail({ banners }: { banners: Banner[] }) {
  const navigate = useNavigate();
  if (banners.length === 0) return null;

  if (banners.length === 1) {
    return (
      <section aria-label="Grocery promotions">
        <PromoCard banner={banners[0]} featured onOpen={() => navigate(bannerRoute(banners[0]))} />
      </section>
    );
  }

  return (
    <section aria-label="Grocery promotions">
      <Rail className="gap-3">
        {banners.map((b) => (
          <PromoCard key={b.id} banner={b} onOpen={() => navigate(bannerRoute(b))} />
        ))}
      </Rail>
    </section>
  );
}
