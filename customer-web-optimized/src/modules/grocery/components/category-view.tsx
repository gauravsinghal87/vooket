import { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUpDown,
  ChevronDown,
  Leaf,
  PackageOpen,
  SlidersHorizontal,
  Tag as TagIcon,
  Tags,
} from 'lucide-react';
import type { Category, Product, Store } from '@/shared/types/catalog';
import { useStoreCatalogue } from '@/modules/grocery/hooks/useStoreCatalogue';
import { resolveCategoryNav } from '@/modules/grocery/utils/groceryCategories';
import { AddToCartControl } from '@/shared/components/product/add-to-cart';
import { discountPercent } from '@/shared/components/product/product-card';
import { Image } from '@/shared/components/ui/image';
import { Price } from '@/shared/components/ui/price';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { BottomSheet } from '@/shared/components/ui/bottom-sheet';
import { EmptyState, ErrorState } from '@/shared/components/ui/state';
import { cn } from '@/shared/utils/utils';

type SortKey = 'name' | 'price_asc' | 'price_desc' | 'discount';
type VegFilter = 'all' | 'veg' | 'nonveg';
type SheetName = 'filters' | 'sort' | 'veg' | 'brand' | null;

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'name', label: 'Name (A to Z)' },
  { key: 'price_asc', label: 'Price: low to high' },
  { key: 'price_desc', label: 'Price: high to low' },
];

const PAGE_SIZE = 24;

interface GroceryCategoryViewProps {
  store: Store;
  /** Top-level categories with nested children, from `GET /grocery/categories`. */
  categories: Category[];
  selectedCategoryId: number;
  onSelect: (categoryId: number) => void;
  onSelectAll: () => void;
}

/**
 * Quick-commerce category screen for `?category=<id>`.
 *
 * Everything on it comes from endpoints this page already uses: the category
 * tree for the left rail and `GET /grocery/stores/{id}/products` for the grid.
 * The filter/sort toolbar sits directly above the product grid to match
 * Blinkit. Only filters the data can honour are offered: `is_veg` is sent to
 * the API, while brand / offers / sort are applied to the fetched page because
 * the store endpoint does not expose them, so no control here can ever be a
 * dead end.
 */
export function GroceryCategoryView({
  store,
  categories,
  selectedCategoryId,
  onSelect,
  onSelectAll,
}: GroceryCategoryViewProps) {
  const [sort, setSort] = useState<SortKey>('name');
  const [veg, setVeg] = useState<VegFilter>('all');
  const [brandId, setBrandId] = useState<number | null>(null);
  const [offersOnly, setOffersOnly] = useState(false);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [sheet, setSheet] = useState<SheetName>(null);

  const nav = useMemo(
    () => resolveCategoryNav(categories, selectedCategoryId),
    [categories, selectedCategoryId]
  );

  const query = useStoreCatalogue(store.id, {
    categoryId: nav.activeCategoryId,
    perPage: pageSize,
    isVeg: veg === 'all' ? null : veg === 'veg',
  });

  const products = query.products;
  const loading = query.isLoading;

  /** Only offer what the products actually returned can filter. */
  const vegAvailable = products.some((p) => p.is_veg !== null);
  const brands = useMemo(() => {
    const map = new Map<number, string>();
    for (const p of products) {
      if (p.brand?.id != null) map.set(p.brand.id, p.brand.name);
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [products]);
  const hasOffers = products.some((p) => discountPercent(p) !== null);

  /** A brand that vanished from the result must not silently hide every product. */
  const activeBrandId = brandId !== null && brands.some(([id]) => id === brandId) ? brandId : null;
  const activeBrandName = brands.find(([id]) => id === activeBrandId)?.[1] ?? null;

  const visible = useMemo(() => {
    let list = products.filter((p) => activeBrandId === null || p.brand?.id === activeBrandId);
    if (offersOnly) list = list.filter((p) => discountPercent(p) !== null);

    const sorted = [...list];
    if (sort === 'price_asc') sorted.sort((a, b) => Number(a.price) - Number(b.price));
    else if (sort === 'price_desc') sorted.sort((a, b) => Number(b.price) - Number(a.price));
    else if (sort === 'discount')
      sorted.sort((a, b) => (discountPercent(b) ?? 0) - (discountPercent(a) ?? 0));
    else sorted.sort((a, b) => a.name.localeCompare(b.name));
    return sorted;
  }, [products, activeBrandId, offersOnly, sort]);

  const activeCount = (offersOnly ? 1 : 0) + (activeBrandId !== null ? 1 : 0) + (veg !== 'all' ? 1 : 0);

  const clearFilters = () => {
    setOffersOnly(false);
    setBrandId(null);
    setVeg('all');
  };

  return (
    <div className="pb-8 md:pb-20">
      <div className="flex items-start gap-2.5 sm:gap-3">
        {!nav.isLeaf && (
          <CategoryRail
            items={nav.subcategories}
            selectedId={nav.activeCategoryId}
            loading={loading}
            onSelect={onSelect}
          />
        )}

        <div className="min-w-0 flex-1 space-y-3">
          {/*
           * Filter/sort toolbar sits directly above the product grid (the space
           * the old category summary card used to occupy). It stays on one line
           * and scrolls sideways, so it never wraps or overflows the column.
           */}
          <CategoryFilterBar
            sort={sort}
            veg={veg}
            vegAvailable={vegAvailable}
            brands={brands}
            activeBrandId={activeBrandId}
            brandLabel={activeBrandName}
            offersOnly={offersOnly}
            hasOffers={hasOffers}
            activeCount={activeCount}
            loading={loading}
            sheet={sheet}
            onSheet={setSheet}
            onSort={setSort}
            onVeg={setVeg}
            onBrand={setBrandId}
            onOffers={setOffersOnly}
            onClear={clearFilters}
          />

          {loading ? (
            <ProductGridSkeleton />
          ) : query.isError ? (
            <ErrorState
              title="Couldn't load this category"
              description={`We're having trouble loading products from ${store.name}. Try again.`}
              action={{ label: 'Retry', onClick: () => void query.refetch() }}
            />
          ) : visible.length === 0 ? (
            <EmptyState
              icon={PackageOpen}
              title="No products available in this category"
              description={
                activeCount > 0
                  ? 'No products match the filters you picked. Try clearing them.'
                  : `${store.name} has no products in this category right now.`
              }
              action={
                activeCount > 0
                  ? { label: 'Clear filters', onClick: clearFilters }
                  : { label: 'Browse all categories', onClick: onSelectAll }
              }
            />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4 xl:grid-cols-5">
                {visible.map((p) => (
                  <GroceryProductCard key={p.id} product={p} />
                ))}
              </div>

              {products.length < query.total && (
                <button
                  onClick={() => setPageSize((n) => n + PAGE_SIZE)}
                  className="tap w-full rounded-xl border border-grocery-300 bg-white py-2.5 text-sm font-bold text-grocery-700 transition-colors hover:bg-grocery-100"
                >
                  Show more products ({query.total - products.length} left)
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- filter bar ------------------------------ */

interface FilterBarProps {
  sort: SortKey;
  veg: VegFilter;
  vegAvailable: boolean;
  brands: [number, string][];
  activeBrandId: number | null;
  brandLabel: string | null;
  offersOnly: boolean;
  hasOffers: boolean;
  activeCount: number;
  loading: boolean;
  sheet: SheetName;
  onSheet: (sheet: SheetName) => void;
  onSort: (sort: SortKey) => void;
  onVeg: (veg: VegFilter) => void;
  onBrand: (brandId: number | null) => void;
  onOffers: (offersOnly: boolean) => void;
  onClear: () => void;
}

function FilterChip({
  icon: Icon,
  label,
  active,
  open,
  onClick,
}: {
  icon: typeof SlidersHorizontal;
  label: string;
  active?: boolean;
  open?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'tap flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-bold transition-colors',
        active ? 'border-grocery-600 bg-grocery-100 text-grocery-800' : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300',
        open && 'border-grocery-500 text-grocery-700'
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
      <ChevronDown className="h-3.5 w-3.5" />
    </button>
  );
}

function OptionRow({
  label,
  hint,
  selected,
  onClick,
}: {
  label: string;
  hint?: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 border-b border-neutral-100 py-3 text-left last:border-0"
    >
      <span className="min-w-0">
        <span
          className={cn(
            'block text-[15px]',
            selected ? 'font-extrabold text-grocery-700' : 'font-medium text-neutral-800'
          )}
        >
          {label}
        </span>
        {hint && <span className="mt-0.5 block text-xs text-neutral-500">{hint}</span>}
      </span>
      <span
        aria-hidden
        className={cn(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
          selected ? 'border-grocery-600 bg-grocery-500' : 'border-neutral-300'
        )}
      >
        {selected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
      </span>
    </button>
  );
}

function CategoryFilterBar(props: FilterBarProps) {
  const {
    sort,
    veg,
    vegAvailable,
    brands,
    activeBrandId,
    brandLabel,
    offersOnly,
    hasOffers,
    activeCount,
    loading,
    sheet,
    onSheet,
    onSort,
    onVeg,
    onBrand,
    onOffers,
    onClear,
  } = props;

  const sortOptions = useMemo(
    () => (hasOffers ? [...SORT_OPTIONS, { key: 'discount' as SortKey, label: 'Biggest discount' }] : SORT_OPTIONS),
    [hasOffers]
  );

  if (loading) {
    return (
      <div aria-label="Product filters" role="group" className="no-scrollbar -mx-0.5 overflow-x-auto px-0.5">
        <div className="flex w-max items-center gap-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-9 w-24 shrink-0 rounded-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      {/* One row only: this strip scrolls sideways, the page never does. */}
      <div aria-label="Product filters" role="group" className="no-scrollbar -mx-0.5 overflow-x-auto px-0.5">
        <div className="flex w-max items-center gap-2 pb-0.5">
          <FilterChip
            icon={SlidersHorizontal}
            label={activeCount > 0 ? `Filters (${activeCount})` : 'Filters'}
            active={activeCount > 0}
            open={sheet === 'filters'}
            onClick={() => onSheet(sheet === 'filters' ? null : 'filters')}
          />
          <FilterChip
            icon={ArrowUpDown}
            label={sortOptions.find((o) => o.key === sort)?.label ?? 'Sort'}
            active={sort !== 'name'}
            open={sheet === 'sort'}
            onClick={() => onSheet(sheet === 'sort' ? null : 'sort')}
          />
          {vegAvailable && (
            <FilterChip
              icon={Leaf}
              label={veg === 'all' ? 'Type' : veg === 'veg' ? 'Veg' : 'Non-veg'}
              active={veg !== 'all'}
              open={sheet === 'veg'}
              onClick={() => onSheet(sheet === 'veg' ? null : 'veg')}
            />
          )}
          {brands.length > 0 && (
            <FilterChip
              icon={TagIcon}
              label={brandLabel ?? 'Brand'}
              active={activeBrandId !== null}
              open={sheet === 'brand'}
              onClick={() => onSheet(sheet === 'brand' ? null : 'brand')}
            />
          )}
          {hasOffers && (
            <button
              type="button"
              aria-pressed={offersOnly}
              onClick={() => onOffers(!offersOnly)}
              className={cn(
                'tap flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-bold transition-colors',
                offersOnly
                  ? 'border-grocery-600 bg-grocery-100 text-grocery-800'
                  : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300'
              )}
            >
              Offers only
            </button>
          )}
        </div>
      </div>

      <BottomSheet open={sheet === 'filters'} onOpenChange={(o) => !o && onSheet(null)} title="Filters">
        <p className="text-xs text-neutral-500">
          Only the filters this category's data supports are listed here.
        </p>
        <div className="mt-1">
          <OptionRow
            label="Discounted items only"
            hint="Items that have a real compare-at price"
            selected={offersOnly}
            onClick={() => onOffers(!offersOnly)}
          />
          {vegAvailable && (
            <OptionRow
              label="Veg only"
              hint="Filtered by the is_veg field on the product"
              selected={veg === 'veg'}
              onClick={() => onVeg(veg === 'veg' ? 'all' : 'veg')}
            />
          )}
          {brands.length > 0 && (
            <OptionRow label="All brands" selected={activeBrandId === null} onClick={() => onBrand(null)} />
          )}
        </div>
        <button
          type="button"
          onClick={onClear}
          className="tap mt-3 w-full rounded-xl border border-neutral-200 py-2.5 text-sm font-bold text-neutral-600 transition-colors hover:border-neutral-300"
        >
          Clear all filters
        </button>
      </BottomSheet>

      <BottomSheet open={sheet === 'sort'} onOpenChange={(o) => !o && onSheet(null)} title="Sort by">
        {sortOptions.map((o) => (
          <OptionRow
            key={o.key}
            label={o.label}
            selected={sort === o.key}
            onClick={() => {
              onSort(o.key);
              onSheet(null);
            }}
          />
        ))}
      </BottomSheet>

      <BottomSheet open={sheet === 'veg'} onOpenChange={(o) => !o && onSheet(null)} title="Type">
        {(
          [
            { key: 'all', label: 'All items' },
            { key: 'veg', label: 'Veg' },
            { key: 'nonveg', label: 'Non-veg' },
          ] as { key: VegFilter; label: string }[]
        ).map((o) => (
          <OptionRow
            key={o.key}
            label={o.label}
            selected={veg === o.key}
            onClick={() => {
              onVeg(o.key);
              onSheet(null);
            }}
          />
        ))}
      </BottomSheet>

      <BottomSheet open={sheet === 'brand'} onOpenChange={(o) => !o && onSheet(null)} title="Brand">
        <OptionRow
          label="All brands"
          selected={activeBrandId === null}
          onClick={() => {
            onBrand(null);
            onSheet(null);
          }}
        />
        {brands.map(([id, name]) => (
          <OptionRow
            key={id}
            label={name}
            selected={activeBrandId === id}
            onClick={() => {
              onBrand(id);
              onSheet(null);
            }}
          />
        ))}
      </BottomSheet>
    </>
  );
}

/* --------------------------------- rail ---------------------------------- */

function CategoryRail({
  items,
  selectedId,
  loading,
  onSelect,
}: {
  items: Category[];
  selectedId: number;
  loading: boolean;
  onSelect: (id: number) => void;
}) {
  const activeRef = useRef<HTMLButtonElement | null>(null);

  /**
   * Keep the active subcategory visible in the independently scrolling rail:
   * opening a parent selects the first child, and switching to an off-screen
   * child scrolls it into view without moving the product column.
   */
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedId, items]);

  return (
    <nav
      aria-label="Grocery subcategories"
      className="w-[92px] shrink-0 sm:w-[124px] lg:sticky lg:top-28 lg:w-[176px] lg:self-start"
    >
      <div className="no-scrollbar flex max-h-[68dvh] flex-col gap-0.5 overflow-y-auto overscroll-contain rounded-2xl border border-neutral-200/70 bg-white p-1 shadow-card lg:max-h-[calc(100dvh-9rem)]">
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-1.5 px-1 py-2">
              <Skeleton className="h-9 w-9 rounded-lg" />
              <Skeleton className="h-2 w-12" />
            </div>
          ))
        ) : (
          items.map((c) => (
            <RailButton
              key={c.id}
              label={c.name}
              image={c.image ?? c.navigation_icon}
              active={c.id === selectedId}
              onClick={() => onSelect(c.id)}
              ref={c.id === selectedId ? activeRef : undefined}
            />
          ))
        )}
      </div>
    </nav>
  );
}

const RailButton = forwardRef<
  HTMLButtonElement,
  {
    label: string;
    image: string | null;
    active: boolean;
    onClick: () => void;
  }
>(function RailButton({ label, image, active, onClick }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'tap relative flex w-full flex-col items-center gap-1 rounded-xl px-1 py-2 text-center transition-colors',
        active ? 'bg-grocery-100' : 'hover:bg-neutral-50'
      )}
    >
      {active && (
        <span aria-hidden className="absolute left-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r-full bg-grocery-600" />
      )}
      {image ? (
        <Image src={image} alt="" className="h-9 w-9 rounded-lg bg-white object-contain" />
      ) : (
        <span
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-lg',
            active ? 'bg-grocery-200 text-grocery-700' : 'bg-neutral-100 text-neutral-400'
          )}
        >
          <Tags className="h-4 w-4" />
        </span>
      )}
      <span
        className={cn(
          'line-clamp-2 text-[10px] font-semibold leading-tight',
          active ? 'text-grocery-800' : 'text-neutral-600'
        )}
      >
        {label}
      </span>
    </button>
  );
});

/* -------------------------------- product -------------------------------- */

function VegMark({ isVeg }: { isVeg: boolean | null }) {
  if (isVeg === null) return null;
  return (
    <span
      aria-label={isVeg ? 'Veg' : 'Non-veg'}
      className={cn('flex h-3 w-3 shrink-0 items-center justify-center rounded-[3px] border', isVeg ? 'border-success' : 'border-danger')}
    >
      <span className={cn('h-1 w-1 rounded-full', isVeg ? 'bg-success' : 'bg-danger')} />
    </span>
  );
}

/**
 * Dense grocery card for the category grid.
 *
 * Product data, pricing, stock, the ADD button and the quantity stepper all
 * come from the existing product and cart components, so variable products
 * still open the shared configurator and the cart is never duplicated. Pack
 * shots use `object-contain` so nothing is cropped.
 */
function GroceryProductCard({ product }: { product: Product }) {
  const off = discountPercent(product);

  return (
    <article className="flex flex-col rounded-xl border border-neutral-200/70 bg-white p-1.5 shadow-card">
      <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-neutral-50">
        <Image src={product.image} alt={product.name} className="h-full w-full object-contain" />
        {off !== null && (
          <span className="absolute left-1 top-1 rounded-md bg-success px-1.5 py-0.5 text-[10px] font-extrabold leading-none text-white">
            {off}% off
          </span>
        )}
      </div>

      <div className="mt-1.5 flex min-w-0 flex-1 flex-col px-0.5">
        {product.brand?.name && (
          <p className="truncate text-[9px] font-bold uppercase tracking-wide text-neutral-400">
            {product.brand.name}
          </p>
        )}
        <h3 className="line-clamp-2 text-[12px] font-semibold leading-snug text-neutral-900">{product.name}</h3>
        <p className="mt-0.5 flex items-center gap-1 text-[10px] text-neutral-500">
          {product.unit_label && <span className="truncate">{product.unit_label}</span>}
          <VegMark isVeg={product.is_veg} />
        </p>

        <div className="mt-1">
          <Price
            value={product.price}
            compareAt={product.compare_at_price}
            size="sm"
            className="flex items-baseline gap-1"
          />
        </div>
        <p className={cn('mt-0.5 text-[10px] font-medium', product.is_available ? 'text-success' : 'text-danger')}>
          {product.is_available ? 'In stock' : 'Out of stock'}
        </p>

        <div className="mt-auto flex items-end justify-end pt-1.5">
          <AddToCartControl productId={product.id} type="grocery" product={product} size="icon" />
        </div>
      </div>
    </article>
  );
}

/* ------------------------------- skeletons ------------------------------- */

function ProductGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4 xl:grid-cols-5">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-neutral-200/70 bg-white p-1.5">
          <Skeleton className="aspect-square w-full rounded-lg" />
          <Skeleton className="mt-1.5 h-2.5 w-4/5" />
          <Skeleton className="mt-1.5 h-2.5 w-2/5" />
          <Skeleton className="mt-2 h-6 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}
