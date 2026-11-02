import type { Category } from '@/shared/types/catalog';
import { Image } from '@/shared/components/ui/image';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { cn } from '@/shared/utils/utils';
import allCategoryImg from '@/assets/all-category.png';

function CategoryChip({
  name,
  image,
  active,
  onSelect,
}: {
  name: string;
  image?: string | null;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      aria-label={`${name} food`}
      className="group flex h-[104px] w-[84px] shrink-0 snap-start flex-col items-center gap-1 pt-1"
    >
      {/* Borderless category artwork: the PNG sits directly on the surface with
          no disc or ring, so its own shading reads as a floating 3D object —
          as in the reference. The label is a single truncated line. */}
      <span
        className={cn(
          'relative flex h-[70px] w-[70px] items-center justify-center transition-transform duration-200 group-hover:-translate-y-0.5 group-active:scale-95',
          active && 'scale-105'
        )}
      >
        <Image src={image} eager alt="" className="h-full w-full object-contain drop-shadow-sm" />
      </span>
      <span
        className={cn(
          'w-full truncate px-0.5 text-center text-[13px] leading-tight transition-colors',
          active ? 'font-bold text-food-600' : 'font-semibold text-neutral-700 group-hover:text-neutral-900'
        )}
      >
        {name}
      </span>
      {/* Active marker sits flush on the strip's bottom border, as in the
          reference — pushed down by `mt-auto` so it never floats mid-chip. */}
      <span className={cn('mt-auto h-[3px] w-8 rounded-full transition-colors', active ? 'bg-food-600' : 'bg-transparent')} />
    </button>
  );
}

export function FoodCategories({
  categories,
  loading,
  stuck,
  selectedId,
  onSelect,
}: {
  categories: Category[];
  loading?: boolean;
  /** Docks the row: paints a solid full-bleed backing and a drop shadow. */
  stuck?: boolean;
  /** Currently selected category ID; `null` means "All". */
  selectedId: number | null;
  onSelect: (categoryId: number | null) => void;
}) {
  // The scroller is its own full-bleed, horizontally scrollable element so the
  // strip can always be swiped on touch (and dragged/wheeled on desktop) — even
  // while the whole row is pinned by `position: sticky`. The solid `bg-white`
  // matches the Zomato food surface so scrolled cards never peek around the
  // docked row.
  const scrollerClass = cn(
    'edge-bleed flex gap-2 overflow-x-auto pb-0 no-scrollbar scroll-snap-x bg-white [touch-action:pan-x_pan-y] transition-shadow',
    stuck && 'shadow-[0_8px_16px_-12px_rgb(16_14_10/0.35)]'
  );

  if (loading) {
    return (
      <section aria-label="Food categories" className="w-full">
        <div className={scrollerClass}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex h-[104px] w-[84px] shrink-0 flex-col items-center gap-1 pt-1">
              <Skeleton className="h-[76px] w-[76px] rounded-2xl" />
              <Skeleton className="h-3.5 w-16 rounded-full" />
              <span className="mt-auto h-[3px] w-8 rounded-full" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (categories.length === 0) return null;

  return (
    <section aria-label="Food categories" className="w-full">
      <h2 className="sr-only">Food categories</h2>
      <div className={scrollerClass}>
        <button
          type="button"
          onClick={() => onSelect(null)}
          aria-pressed={selectedId === null}
          className="group flex h-[104px] w-[84px] shrink-0 snap-start flex-col items-center gap-1 pt-1"
          aria-label="All restaurants"
        >
          <span
            className={cn(
              'relative flex h-[76px] w-[76px] items-center justify-center transition-transform duration-200 group-hover:-translate-y-0.5 group-active:scale-95',
              selectedId === null && 'scale-105'
            )}
          >
            <Image src={allCategoryImg} eager alt="" className="h-full w-full object-contain drop-shadow-sm" />
          </span>
          <span
            className={cn(
              'w-full truncate px-0.5 text-center text-[13px] leading-tight transition-colors',
              selectedId === null ? 'font-bold text-food-600' : 'font-semibold text-neutral-700 group-hover:text-neutral-900'
            )}
          >
            All
          </span>
          <span className={cn('mt-auto h-[3px] w-9 rounded-full transition-colors', selectedId === null ? 'bg-food-600' : 'bg-transparent')} />
        </button>
        {categories.map((c) => (
          <CategoryChip
            key={c.id}
            name={c.name}
            image={c.image}
            active={selectedId === c.id}
            onSelect={() => onSelect(c.id)}
          />
        ))}
      </div>
    </section>
  );
}
