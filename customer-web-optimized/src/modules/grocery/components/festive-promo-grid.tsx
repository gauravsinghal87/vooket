import { useNavigate } from 'react-router-dom';
import type { Banner } from '@/shared/types/catalog';
import { Image } from '@/shared/components/ui/image';
import { bannerRoute } from '@/shared/utils/banner';

/**
 * Blinkit-style festive promo grid for the Grocery home.
 *
 * Renders only the Admin-managed `grocery_home_festive_promo` placement, so a
 * banner for another surface (Food hero, Rides, brand carousel) can never
 * appear here. The cards sit directly under the main category sections — the
 * same place the reference puts its festive Diwali tiles — as a dense image
 * grid instead of a horizontal carousel.
 */
export function GroceryFestivePromoGrid({ banners }: { banners: Banner[] }) {
  const navigate = useNavigate();
  if (banners.length === 0) return null;

  return (
    <section aria-label="Festive promotions">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {banners.map((b) => (
          <button
            key={b.id}
            onClick={() => navigate(bannerRoute(b))}
            aria-label={b.title}
            /* Square, not portrait: the Admin tiles are 330 x 353, so a 4/5 box
               both enlarged them past the reference and zoomed into the photo.
               Square reads as a compact tile row and leaves the festive artwork
               visible around the cards instead of being covered by them. */
            className="tap group relative aspect-square overflow-hidden rounded-2xl shadow-card transition-shadow hover:shadow-float"
          >
            <Image
              src={b.image}
              alt=""
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-ink-950/85 via-ink-950/20 to-transparent" />
            <span className="absolute inset-x-0 top-0 p-3 text-center">
              {b.cta_text && (
                <span className="mb-1.5 inline-block rounded-full bg-grocery-500 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-ink-900">
                  {b.cta_text}
                </span>
              )}
              <span className="block line-clamp-2 text-base font-extrabold leading-tight text-white drop-shadow-sm">
                {b.title}
              </span>
              {b.subtitle && (
                <span className="mt-0.5 block line-clamp-2 text-xs leading-snug text-white/75">{b.subtitle}</span>
              )}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
