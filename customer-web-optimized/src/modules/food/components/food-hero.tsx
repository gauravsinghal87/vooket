import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/app/layouts/Header';
import { Image } from '@/shared/components/ui/image';
import { bannerRoute } from '@/shared/utils/banner';
import type { Banner } from '@/shared/types/catalog';

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * The Food hero media. The Admin-uploaded Food hero banner decides everything:
 * a `video` banner plays as the full-bleed background (muted, looping), an
 * `image` banner paints the same layout, and with no banner (or when the video
 * errors / the visitor prefers reduced motion) the branded Food gradient stands
 * in — so the hero never collapses and nothing is hardcoded.
 */
function HeroMedia({ banner }: { banner: Banner | undefined }) {
  const [videoFailed, setVideoFailed] = useState(false);

  const useVideo =
    banner?.media_type === 'video' && Boolean(banner.video) && !videoFailed && !prefersReducedMotion();

  if (useVideo && banner) {
    return (
      <video
        key={banner.id}
        src={banner.video ?? undefined}
        poster={banner.poster_image ?? banner.image ?? undefined}
        muted
        loop
        playsInline
        autoPlay
        preload="auto"
        onError={() => setVideoFailed(true)}
        className="absolute inset-0 h-full w-full object-cover z-1"
      />
    );
  }

  if (banner?.image) {
    return <Image src={banner.image} alt="" eager className="absolute inset-0 h-full w-full object-cover" />;
  }

  // No banner configured (or still loading): keep the Food branded band.
  return <div aria-hidden className="hero-header-bg absolute inset-0" />;
}

/**
 * The Food hero: a full-width, immersive block whose background is the active
 * `food_home_hero` banner (video or image) and whose content is the shared
 * header — logo, delivery location, module switcher, search, cart,
 * notifications, profile — layered straight onto that media rather than into a
 * solid red band above a standalone banner card. The banner's own headline,
 * offer text and CTA stay dynamic and clickable.
 *
 * The header is rendered here (not by `AppShell`) so there is exactly one
 * header in view; `AppShell` suppresses its sticky band on `/food`.
 *
 * The search + Veg Mode row belongs to the hero: it is passed in as `searchSlot`
 * and rendered between the shared header and the banner copy, so it scrolls
 * away with the hero. Its sticky representation (Stage A) lives in the page.
 */
export function FoodHero({
  banners,
  searchSlot,
  footerSlot,
}: {
  banners: Banner[];
  searchSlot?: ReactNode;
  /** Tiles/content rendered along the hero's lower edge (overlapping the artwork). */
  footerSlot?: ReactNode;
}) {
  const navigate = useNavigate();
  const banner = banners[0];

  return (
    <section className="relative isolate w-full overflow-hidden bg-food-900 pt-safe text-white">
      <div className="absolute inset-0">
        <HeroMedia banner={banner} />
        {/* Scrim so header text and the banner copy stay readable on any frame. */}
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-b from-ink-950/75 via-ink-950/35 to-ink-950/85"
        />
      </div>

      <div className="relative z-10 flex min-h-[330px] flex-col sm:min-h-[450px] lg:min-h-[470px]">
        <Header variant="overlay" />

        {/* The Food search + Veg Mode control sits inside the hero, directly
            under the header, as in the reference. */}
        {searchSlot && (
          <div className="mx-auto w-full max-w-5xl px-[var(--page-gutter)] pt-3 sm:pt-4">{searchSlot}</div>
        )}

        <div className="mx-auto mt-auto w-full max-w-5xl px-[var(--page-gutter)] pb-3 pt-6 sm:pt-7 justify-items-center">
          {banner && (
            <button
              type="button"
              onClick={() => navigate(bannerRoute(banner))}
              className="tap block max-w-xl text-left"
              aria-label={banner.title}
            >
              {banner.cta_text && (
                <span className="hero-cta-dark mb-2 inline-block rounded-full px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide shadow-pill">
                  {banner.cta_text}
                </span>
              )}
              {/* <span className="block text-3xl font-extrabold leading-tight drop-shadow-sm sm:text-4xl">
                {banner.title}
              </span> */}
              {banner.subtitle && (
                <span className="mt-1.5 block max-w-lg text-sm leading-snug text-white/80 sm:text-base">
                  {banner.subtitle}
                </span>
              )}
            </button>
          )}
        </div>

        {/* Promotional tiles along the hero's lower edge, as in the reference. */}
        {footerSlot && (
          <div className="mx-auto w-full max-w-5xl px-[var(--page-gutter)] pb-4">{footerSlot}</div>
        )}
      </div>
    </section>
  );
}
