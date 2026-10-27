import { LayoutGrid, type LucideIcon } from 'lucide-react';
import type { Category } from '@/types/catalog';
import { Image } from '@/components/ui/image';
import { categoryTileColor } from '@/lib/groceryCategories';
import { cn } from '@/lib/utils';

interface CategoryCarouselProps {
  categories: Category[];
  selectedId: number | null;
  onSelect: (categoryId: number | null) => void;
  /**
   * Docks the strip: paints the solid page backing and a tight drop shadow
   * while the row is pinned under the header. The scroller owns the full-bleed
   * backing so tabs stay swipeable and never peek around the docked row.
   */
  stuck?: boolean;
}

/**
 * Compact Blinkit-style category navigation, the first content under the
 * header: a single horizontally scrollable strip of icon-plus-label tabs on the
 * same warm off-white as the page, with a thin dark underline marking the
 * active one.
 *
 * Every tab is a real grocery category from `GET /grocery/categories` in the
 * order the backend returned it. The leading "All" item only clears the filter;
 * it is UI state, not a database category.
 */
export function CategoryCarousel({ categories, selectedId, onSelect, stuck }: CategoryCarouselProps) {
  if (categories.length === 0) return null;

  const allActive = selectedId === null;

  const scrollerClass = cn(
    'edge-bleed flex items-stretch gap-1 overflow-x-auto bg-grocery-50 pt-1.5 no-scrollbar scroll-snap-x [touch-action:pan-x_pan-y] transition-shadow',
    stuck && 'shadow-[0_8px_16px_-14px_rgb(16_14_10/0.4)]'
  );

  return (
    <section aria-label="Grocery categories" className="w-full">
      <h2 className="sr-only">Grocery categories</h2>
      <div className={scrollerClass}>
        <CategoryTab icon={LayoutGrid} label="All" active={allActive} onClick={() => onSelect(null)} />

        {categories.map((c) => {
          const active = selectedId === c.id;
          return (
            <CategoryTab
              key={c.id}
              label={c.name}
              active={active}
              image={c.navigation_icon}
              onClick={() => onSelect(active ? null : c.id)}
            />
          );
        })}
      </div>
    </section>
  );
}

/**
 * One category tab: a small icon (or a neatly contained image thumbnail when no
 * icon is available) above a single-line label, with the active underline
 * pinned to the bottom edge of the strip.
 */
function CategoryTab({
  label,
  icon: Icon,
  image,
  active,
  onClick,
}: {
  label: string;
  icon?: LucideIcon | null;
  image?: string | null;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      className="group relative flex w-[68px] shrink-0 snap-start flex-col items-center gap-1 px-1 pb-3 pt-0.5 transition-transform active:scale-[0.97]"
    >
      <span className="flex h-7 w-7 items-center justify-center overflow-hidden">
        {Icon ? (
          <Icon
            strokeWidth={1.75}
            aria-hidden
            className={cn('h-[22px] w-[22px]', active ? 'text-grocery-700' : 'text-neutral-600')}
          />
        ) : image ? (
          <Image src={image} alt="" className="h-6 w-6 object-contain" />
        ) : (
          <span
            aria-hidden
            className={cn(
              'flex h-6 w-6 items-center justify-center rounded-md text-[11px] font-bold',
              active ? 'bg-grocery-100 text-grocery-700' : 'bg-neutral-100 text-neutral-500'
            )}
          >
            {label.trim().charAt(0).toUpperCase()}
          </span>
        )}
      </span>
      <span
        className={cn(
          'line-clamp-1 w-full text-center text-[11px] leading-tight',
          active ? 'font-bold text-ink-900' : 'font-semibold text-neutral-600'
        )}
      >
        {label}
      </span>
      <span
        aria-hidden
        className={cn(
          'absolute inset-x-2 bottom-0 h-[2.5px] rounded-full transition-colors',
          active ? 'bg-ink-900' : 'bg-transparent group-hover:bg-neutral-300'
        )}
      />
    </button>
  );
}

interface CategoryGridProps {
  categories: Category[];
  selectedId?: number | null;
  onSelect?: (categoryId: number) => void;
  title?: string;
  subtitle?: string;
  /**
   * When set, the section title becomes a link to the parent category, so the
   * customer can open the parent and browse all of its subcategories.
   */
  onSelectParent?: () => void;
}

/**
 * Dense Blinkit-style image-tile grid of grocery categories.
 *
 * Each item is a bare two-part stack: a soft, category-tinted square tile
 * holding only the illustration (contained, never cropped or stretched), with
 * the category name centred underneath — no outer white card, border or heavy
 * shadow. 4 columns on mobile, widening on larger screens; the name clamps to
 * two lines so long labels wrap instead of being cut off.
 */
export function CategoryGrid({
  categories,
  selectedId = null,
  onSelect,
  title = 'Shop by category',
  subtitle,
  onSelectParent,
}: CategoryGridProps) {
  if (categories.length === 0) return null;

  return (
    <section>
      <div className="mb-3">
        {onSelectParent ? (
          <button
            type="button"
            onClick={onSelectParent}
            className="tap inline-flex items-center gap-1 text-left"
          >
            <h2 className="text-[17px] font-extrabold tracking-tight text-neutral-900 sm:text-lg">
              {title}
            </h2>
          </button>
        ) : (
          <h2 className="text-[17px] font-extrabold tracking-tight text-neutral-900 sm:text-lg">
            {title}
          </h2>
        )}
        {subtitle && <p className="mt-0.5 text-xs text-neutral-500">{subtitle}</p>}
      </div>

      <div className="grid grid-cols-4 gap-x-3 gap-y-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8">
        {categories.map((c) => {
          const active = selectedId === c.id;
          return (
            <button
              key={c.id}
              onClick={() => onSelect?.(c.id)}
              aria-label={c.name}
              aria-pressed={active}
              className="tap flex flex-col items-center gap-2 transition-transform duration-200 active:scale-[0.97]"
            >
              <span
                style={{ backgroundColor: categoryTileColor(c) }}
                className={cn(
                  'flex aspect-square w-full items-center justify-center overflow-hidden rounded-2xl p-2.5',
                  active && 'ring-2 ring-grocery-500/70'
                )}
              >
                <Image src={c.image} alt="" className="h-full w-full object-contain" />
              </span>
              <span
                className={cn(
                  'line-clamp-2 w-full text-center text-[13px] font-semibold leading-tight',
                  active ? 'text-grocery-700' : 'text-neutral-800'
                )}
              >
                {c.name}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
