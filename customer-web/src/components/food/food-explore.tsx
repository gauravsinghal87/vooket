import type { Category } from '@/types/catalog';
import { Image } from '@/components/ui/image';
import { cn } from '@/lib/utils';

/**
 * The "EXPLORE MORE" block — the reference's row of bordered discovery tiles
 * (image on top, label below, hairline border, soft shadow, ~20px radius).
 *
 * Tiles are built from the real Food categories: each tap selects that
 * category through the same handler the round category strip uses, so the
 * feed filters in place and no navigation or backend behavior is invented.
 * The reference's tiles are editorial collections ("Gourmet", "Plan a
 * party"); Vooket has no collections endpoint, so real categories fill the
 * slot — reported as a known difference.
 */
export function FoodExplore({
  categories,
  selectedId,
  onSelect,
}: {
  categories: Category[];
  selectedId: number | null;
  onSelect: (categoryId: number | null) => void;
}) {
  if (categories.length === 0) return null;

  return (
    <div
      aria-label="Explore more"
      className="no-scrollbar -mr-[var(--page-gutter)] flex gap-3 overflow-x-auto pr-[var(--page-gutter)]"
    >
      {categories.map((c) => {
        const active = selectedId === c.id;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onSelect(c.id)}
            aria-pressed={active}
            className={cn(
              'tap flex w-[104px] shrink-0 flex-col items-center gap-2.5 rounded-2xl border bg-white p-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card active:scale-[0.97]',
              active ? 'border-food-600 shadow-card' : 'border-neutral-200'
            )}
          >
            <span className="grid h-14 w-14 place-items-center overflow-hidden rounded-xl bg-neutral-50">
              <Image
                src={c.image}
                eager
                alt=""
                className="h-full w-full object-contain p-1"
              />
            </span>
            <span
              className={cn(
                'line-clamp-2 min-h-[34px] text-center text-[15px] font-semibold leading-tight',
                active ? 'text-food-600' : 'text-neutral-900'
              )}
            >
              {c.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}
