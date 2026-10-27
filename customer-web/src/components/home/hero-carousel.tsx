import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Banner } from '@/types/catalog';
import { Image } from '@/components/ui/image';
import { bannerRoute } from '@/lib/banner';
import { cn } from '@/lib/utils';

type HeroSize = 'default' | 'large' | 'hero';

/**
 * Height is driven by aspect ratio rather than a fixed pixel height, so the
 * banner keeps its proportions from 360px phones up to desktop instead of
 * cropping badly on a narrow screen.
 */
const HERO_FRAME: Record<HeroSize, string> = {
  hero: 'aspect-[4/3] sm:aspect-[21/9]',
  large: 'aspect-[16/9] sm:aspect-[21/9]',
  default: 'aspect-[16/10] sm:aspect-[21/9]',
};

interface HeroCarouselProps {
  banners: Banner[];
  size?: HeroSize;
  /** Accent for the slide indicator and CTA, so each service keeps its theme. */
  accentClassName?: string;
  ctaClassName?: string;
  /**
   * Stays inside its container instead of bleeding past the page gutter. Used on
   * the home hero, which already sits inside the branded canvas.
   */
  contained?: boolean;
}

export function HeroSkeleton({ size = 'default', contained = false }: { size?: HeroSize; contained?: boolean }) {
  return (
    <div className={cn(!contained && 'edge-bleed')}>
      <div
        className={cn(
          'w-full animate-pulse rounded-3xl',
          // Inside the branded canvas the placeholder is a light translucent wash
          // so it reads as part of the hero rather than a grey block on blue.
          contained ? 'bg-white/15 sm:max-w-none' : 'bg-neutral-200 sm:max-w-[640px]',
          HERO_FRAME[size]
        )}
      />
    </div>
  );
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function BannerMedia({ banner, active, eager }: { banner: Banner; active: boolean; eager?: boolean }) {
  const [videoFailed, setVideoFailed] = useState(false);

  const useVideo = banner.media_type === 'video' && Boolean(banner.video) && !videoFailed && !prefersReducedMotion();

  if (useVideo) {
    return (
      <video
        src={banner.video ?? undefined}
        poster={banner.poster_image ?? banner.image ?? undefined}
        muted
        loop
        playsInline
        autoPlay
        onError={() => setVideoFailed(true)}
        ref={(el) => {
          if (!el) return;
          if (active) void el.play().catch(() => {});
          else el.pause();
        }}
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
      />
    );
  }

  return (
    <Image
      src={banner.image}
      alt=""
      eager={eager}
      className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
    />
  );
}

export function HeroCarousel({
  banners,
  size = 'default',
  accentClassName = 'bg-accent-500',
  ctaClassName = 'bg-white/90 text-ink-900',
  contained = false,
}: HeroCarouselProps) {
  const navigate = useNavigate();
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const pausedRef = useRef(false);

  const count = banners.length;

  const scrollToIndex = (i: number) => {
    const el = trackRef.current;
    if (!el) return;
    const first = el.children[0] as HTMLElement | undefined;
    const w = first ? first.offsetWidth + 12 : 0;
    el.scrollTo({ left: i * w, behavior: 'smooth' });
  };

  useEffect(() => {
    if (count <= 1 || prefersReducedMotion()) return;
    setIndex(0);
    const timer = window.setInterval(() => {
      if (pausedRef.current) return;
      setIndex((prev) => {
        const next = (prev + 1) % count;
        scrollToIndex(next);
        return next;
      });
    }, 4500);
    return () => window.clearInterval(timer);
  }, [count]);

  const onScroll = () => {
    const el = trackRef.current;
    if (!el) return;
    const first = el.children[0] as HTMLElement | undefined;
    const w = first ? first.offsetWidth + 12 : 0;
    if (w > 0) setIndex(Math.round(el.scrollLeft / w));
  };

  if (count === 0) return null;

  return (
    <section aria-roledescription="carousel" className="relative">
      <div
        ref={trackRef}
        onScroll={onScroll}
        onPointerDown={() => (pausedRef.current = true)}
        onPointerUp={() => (pausedRef.current = false)}
        className={cn(
          'flex gap-3 overflow-x-auto no-scrollbar scroll-snap-x pb-1',
          !contained && 'edge-bleed'
        )}
      >
        {banners.map((b, i) => (
          <div
            key={b.id}
            className="snap-center shrink-0"
            style={contained ? { width: '100%' } : { width: 'min(92vw, 640px)' }}
          >
            <button
              onClick={() => navigate(bannerRoute(b))}
              className={cn(
                'tap group relative block w-full overflow-hidden text-left',
                // Inside the branded canvas the banner keeps a lighter corner
                // treatment so it sits in the blue rather than boxing itself in.
                contained ? 'rounded-2xl shadow-float' : 'rounded-3xl shadow-float',
                HERO_FRAME[size]
              )}
              aria-label={b.title}
            >
              <BannerMedia banner={b} active={i === index} eager={i === 0} />
              <span className="absolute inset-0 bg-gradient-to-t from-ink-950/90 via-ink-950/30 to-transparent" />
              <span className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
                {b.cta_text && (
                  <span className={cn('mb-2 inline-block rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide backdrop-blur', ctaClassName)}>
                    {b.cta_text}
                  </span>
                )}
                <span
                  className={cn(
                    'block font-extrabold leading-tight text-white drop-shadow-sm',
                    size === 'default' ? 'text-xl sm:text-2xl' : 'text-2xl sm:text-3xl'
                  )}
                >
                  {b.title}
                </span>
                {b.subtitle && (
                  <span className="mt-1 block line-clamp-2 max-w-md text-[13px] leading-snug text-white/75">
                    {b.subtitle}
                  </span>
                )}
              </span>
            </button>
          </div>
        ))}
      </div>

      {count > 1 && (
        <div className="mt-2 flex items-center justify-center gap-1.5">
          {banners.map((_, i) => (
            <button
              key={i}
              onClick={() => {
                setIndex(i);
                scrollToIndex(i);
              }}
              aria-label={`Go to slide ${i + 1}`}
              className={cn(
                'tap h-1.5 rounded-full transition-all duration-300',
                i === index ? cn('w-5', accentClassName) : 'w-1.5 bg-neutral-300 hover:bg-neutral-400'
              )}
            />
          ))}
        </div>
      )}
    </section>
  );
}