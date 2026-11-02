import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Header } from '@/app/layouts/Header';
import { SearchBar } from '@/shared/components/service/search-bar';
import { Image } from '@/shared/components/ui/image';
import { GroceryFestivePromoGrid } from '@/modules/grocery/components/festive-promo-grid';
import { cn } from '@/shared/utils/utils';
import type { Banner } from '@/shared/types/catalog';

/** Category navigation surface: over the festive artwork, or docked on cream. */
type NavTone = 'surface' | 'artwork';

/**
 * The Grocery home hero.
 *
 * The Admin-uploaded `grocery_home_hero` banner is the background — never a
 * hardcoded or bundled image. The artwork is painted at its natural width and
 * ratio, anchored to the top, and the section clips only the flat cream panel
 * below the decoration (see `.grocery-hero-shell` in `index.css`). Nothing is
 * stretched and the red panel, scallop border and ornaments all keep their
 * composition.
 *
 * The shared `Header` is rendered here (not by `AppShell`) in its overlay
 * variant, so there is exactly one header and it reads as part of the hero.
 * The large white search pill and the only category navigation sit directly
 * under it — immediately below the search, the same as the reference — with
 * light tabs while they are over the artwork.
 *
 * The search + category block is also the sticky header: the moment it reaches
 * the top of the viewport a docked copy (dark tabs on the cream page surface)
 * slides in and stays there for the rest of the scroll, so the customer always
 * keeps search and the category navigation at hand.
 *
 * With no active banner the same layout falls back to a clean cream band with
 * dark header controls — no other service's artwork and no placeholder image.
 */
export function GroceryHero({
  banners,
  categoryNav,
  festivePromos,
}: {
  banners: Banner[];
  /**
   * The page's single horizontal Grocery category navigation, rendered for the
   * surface it is painted on: `artwork` over the festive banner, `surface`
   * inside the docked bar.
   */
  categoryNav?: (tone: NavTone) => ReactNode;
  /**
   * The Admin festive promo cards. They render inside the hero — not in the
   * page body — so the artwork keeps running behind them and the section reads
   * as one continuous festive surface, the same as the reference. The banner's
   * cream body is tall enough to cover this whole block.
   */
  festivePromos?: Banner[];
}) {
  const banner = banners[0];
  const hasArtwork = Boolean(banner?.image);

  // The in-flow search + category block, and whether it has scrolled up to the
  // top of the viewport (the moment the docked copy takes over).
  const dockRef = useRef<HTMLDivElement | null>(null);
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const el = dockRef.current;
      if (!el) return;
      // Dock exactly when the block's top reaches the viewport top, so the
      // docked copy lands on top of the identical in-flow block.
      const next = el.getBoundingClientRect().top <= 0;
      setStuck((cur) => (cur === next ? cur : next));
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      <section
        className={cn(
          'relative isolate flex w-full flex-col overflow-hidden',
          hasArtwork ? 'grocery-hero-shell bg-grocery-cream' : 'grocery-hero-shell-fallback bg-grocery-100',
        )}
      >
        {hasArtwork && banner?.image && (
          <>
            {/* Artwork keeps its own aspect ratio: full width, natural height, top
                aligned. The section's overflow only trims the blank cream tail. */}
            <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-10">
              <Image src={banner.image} alt="" eager draggable={false} className="block h-auto w-full select-none" />
            </div>
            {/* Contrast scrim behind the white header / search controls. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-ink-950/70 via-ink-950/25 to-transparent"
            />
            {/* The banner is a 1125 x 2436 portrait, so it is several times
                taller than this section — the section edge alone would chop it
                off right under the promo cards. This hand-off melts its last
                stretch into the page colour instead, so the festive surface
                ends as a soft fade rather than a cut. It sits below the content
                column, which paints above it, so the cards are never dimmed. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-24 bg-gradient-to-b from-transparent to-grocery-50"
            />
          </>
        )}

        <div className="relative z-10 flex flex-1 flex-col">
          <Header variant="overlay" overlayOnDark={hasArtwork} />

          {/* Search + category navigation: the one home navigation block, and
              the block that docks to the top of the viewport on scroll. */}
          <div ref={dockRef}>
            <div className="mx-auto w-full max-w-5xl px-[var(--page-gutter)] pt-3 sm:pt-4">
              {/* The one Grocery search entry point: white, large and rounded, with
                  the Grocery-only placeholder and microphone from `serviceTheme`. */}
              <SearchBar variant="brand" className="[&>a]:h-[54px] [&>a]:rounded-2xl" />
            </div>

            {categoryNav && (
              <div className="mx-auto w-full max-w-5xl px-[var(--page-gutter)] pb-1 pt-2">{categoryNav('artwork')}</div>
            )}
          </div>

          {/* Festive promo cards, still inside the hero section so the artwork
              continues behind them instead of stopping at the navigation. */}
          {festivePromos && festivePromos.length > 0 && (
            <div className="mx-auto w-full max-w-5xl px-[var(--page-gutter)] pt-5 pb-8">
              <GroceryFestivePromoGrid banners={festivePromos} />
            </div>
          )}

          {/* The hero ends right here, so the festive panel is trimmed into a
              compact banner behind the header, search and navigation — the same
              as the reference's festive top. Without artwork the band still
              fills a comfortable height. */}
          {!hasArtwork && <div aria-hidden className="flex-1" />}
        </div>
      </section>

      {/* Docked copy of the search + category block. It is fixed and out of
          flow, so it never leaves a gap where it comes from; while inactive it
          is hidden and removed from the tab order, so the in-flow block is
          never duplicated on screen. */}
      <div
        aria-hidden={!stuck}
        className={cn(
          'fixed inset-x-0 top-0 z-50 bg-grocery-50/95 backdrop-blur transition-transform duration-200 will-change-transform',
          stuck
            ? 'translate-y-0 shadow-[0_8px_16px_-12px_rgb(16_14_10/0.35)]'
            : 'pointer-events-none invisible -translate-y-full',
        )}
      >
        <div className="mx-auto w-full max-w-5xl px-[var(--page-gutter)] pt-2.5 pb-1">
          <SearchBar variant="brand" className="[&>a]:h-[50px] [&>a]:rounded-2xl" />
        </div>
        {categoryNav && <div className="mx-auto w-full max-w-5xl px-[var(--page-gutter)] pb-0.5">{categoryNav('surface')}</div>}
      </div>
    </>
  );
}
