import { useNavigate } from 'react-router-dom';
import type { Banner } from '@/types/catalog';
import { Image } from '@/components/ui/image';
import { bannerRoute } from '@/lib/banner';
import { cn } from '@/lib/utils';

/**
 * Rapido-style "Everything in Minutes" promo mosaic for the Rides home.
 *
 * Cards are Admin-managed banners from the dedicated `rides_promotions`
 * placement (the page fetches only that placement), laid into a two-column
 * asymmetric mosaic in `sort_order`. Left column takes the first half of the
 * banners, right column the rest, so four banners read as the reference layout:
 * Parcel + everyday rides on the left, Bike Taxi + All Services on the right.
 *
 * Copy (title/subtitle) and artwork come from the banner. Tapping any card
 * opens the Drop Location screen via `onCardPress` (the same navigation the
 * "Where do you want to go?" input uses); when no handler is given the tap
 * target falls back to the shared `bannerRoute` mapper — nothing is inferred
 * from the label text. Soft pastel tints are assigned per slot purely for styling.
 */
const SLOT_TINTS = ['bg-brand-50', 'bg-amber-50', 'bg-emerald-50', 'bg-violet-50'];

export function RidesPromoMosaic({
  banners,
  onCardPress,
}: {
  banners: Banner[];
  onCardPress?: () => void;
}) {
  const navigate = useNavigate();

  const cards = banners.slice(0, 4);
  if (cards.length === 0) return null;

  const half = Math.ceil(cards.length / 2);
  const columns = [cards.slice(0, half), cards.slice(half)].filter((column) => column.length > 0);

  return (
    <section aria-label="Everything in Minutes" className="pt-1">
      <h2 className="mb-3.5 text-xl font-bold tracking-tight text-ink-900">Everything in Minutes</h2>
      <div className="grid grid-cols-[1.05fr_0.95fr] gap-3">
        {columns.map((column, columnIndex) => (
          <div key={columnIndex} className="flex flex-col gap-3">
            {column.map((b, cardIndex) => (
              <button
                key={b.id}
                type="button"
                onClick={() => (onCardPress ? onCardPress() : navigate(bannerRoute(b)))}
                aria-label={b.title}
                className={cn(
                  'tap flex flex-col overflow-hidden rounded-2xl p-3 text-left transition-transform duration-150 active:scale-[0.98]',
                  SLOT_TINTS[(columnIndex * half + cardIndex) % SLOT_TINTS.length]
                )}
              >
                <span className="block text-[17px] font-bold leading-tight text-ink-900">{b.title}</span>
                {b.subtitle && (
                  <span className="mt-0.5 block text-[13px] leading-snug text-neutral-600">{b.subtitle}</span>
                )}
                {b.image && (
                  <Image src={b.image} alt="" className="mt-2 h-16 w-full object-contain object-bottom" />
                )}
              </button>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
