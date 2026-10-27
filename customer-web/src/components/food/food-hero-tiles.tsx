import { useNavigate } from 'react-router-dom';
import type { Category } from '@/types/catalog';
import { Image } from '@/components/ui/image';
import { bannerRoute } from '@/lib/banner';
import type { Banner } from '@/types/catalog';

/**
 * The promotional tiles that overlap the lower edge of the reference hero —
 * the four image tiles ("Mithai Hamper", "Assorted Hamper", …) sitting half
 * over the hero artwork and half over the white surface below.
 *
 * Sources, in priority order, both real:
 *  1. The active hero banner's `target` — when the Admin banner points at a
 *     restaurant/search/url the tile opens it through `bannerRoute`.
 *  2. Otherwise the first food categories, which select their category
 *     through the page's existing handler.
 *
 * Nothing is hardcoded; with no banner and no categories the row renders
 * nothing at all.
 */
export function FoodHeroTiles({
  banner,
  categories,
  onSelectCategory,
}: {
  banner: Banner | undefined;
  categories: Category[];
  onSelectCategory?: (categoryId: number | null) => void;
}) {
  const navigate = useNavigate();

  const tiles: { key: string; label: string; image: string | null; onClick: () => void }[] = [];

  if (banner) {
    tiles.push({
      key: `banner-${banner.id}`,
      label: banner.title,
      image: banner.poster_image ?? banner.image,
      onClick: () => navigate(bannerRoute(banner)),
    });
  }

  for (const c of categories.slice(0, banner ? 3 : 4)) {
    tiles.push({
      key: `cat-${c.id}`,
      label: c.name,
      image: c.image,
      onClick: () => onSelectCategory?.(c.id),
    });
  }

  if (tiles.length === 0) return null;

  return (
    <div className="no-scrollbar -mx-[var(--page-gutter)] flex gap-2.5 overflow-x-auto px-[var(--page-gutter)] pb-1">
      {tiles.map((tile) => (
        <button
          key={tile.key}
          type="button"
          onClick={tile.onClick}
          className="tap flex w-[100px] shrink-0 flex-col items-center gap-1.5 rounded-2xl bg-gradient-to-b from-white/25 to-white/10 px-2 pb-2.5 pt-3 text-center backdrop-blur-sm transition-transform duration-200 hover:-translate-y-0.5 active:scale-95"
        >
          <span className="grid h-14 w-14 place-items-center overflow-hidden rounded-xl bg-white/90">
            {tile.image ? (
              <Image src={tile.image} eager alt="" className="h-full w-full object-cover" />
            ) : null}
          </span>
          <span className="line-clamp-2 min-h-[30px] text-[12px] font-bold leading-tight text-white">
            {tile.label}
          </span>
        </button>
      ))}
    </div>
  );
}
