import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  ArrowUpDown,
  Check,
  ChevronDown,
  Leaf,
  SlidersHorizontal,
  Tag as TagIcon,
  Tags,
} from 'lucide-react-native';
import type { Category, Product, Store } from '@/types/catalog';
import { discountPercent, formatCurrency } from '@/lib/utils';
import { carryProduct } from '@/lib/routeState';
import { resolveCategoryNav } from '@/lib/groceryCategories';
import { useStoreCatalogue } from '@/hooks/useStoreCatalogue';
import { AddToCartControl } from '@/components/product/AddToCart';
import { ProductImage } from '@/components/ui/ProductImage';
import { EmptyState, VegMark } from '@/components/ui/primitives';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { colors, shadows, withAlpha } from '@/theme';

type SortKey = 'name' | 'price_asc' | 'price_desc' | 'discount';
type VegFilter = 'all' | 'veg' | 'nonveg';
type SheetName = 'filters' | 'sort' | 'veg' | 'brand' | null;

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'name', label: 'Name (A to Z)' },
  { key: 'price_asc', label: 'Price: low to high' },
  { key: 'price_desc', label: 'Price: high to low' },
];

const PAGE_SIZE = 24;
const GUTTER = 16;
/**
 * The web shell caps grocery content at `max-w-5xl` (1024px) and centres it;
 * the category screen mirrors that so wide tablets fill one column instead of
 * leaving the grid short of the right edge. Also the width the grid maths uses.
 */
export const CATEGORY_CONTENT_MAX = 1024;

interface GroceryCategoryViewProps {
  store: Store;
  /** Top-level categories with nested children, from `GET /grocery/categories`. */
  categories: Category[];
  selectedCategoryId: number;
  onSelect: (categoryId: number) => void;
  onSelectAll: () => void;
}

/**
 * Quick-commerce category screen for `?category=<id>` — native port of the web
 * `GroceryCategoryView`.
 *
 * The product grid is fetched from the existing store-scoped endpoint with the
 * category filter applied server-side, exactly like the web. `is_veg`, brand,
 * offers and sort are applied to the fetched page, so every control maps to
 * real data and no control is ever a dead end. The filter/sort toolbar sits
 * directly above the product grid to match Blinkit. The view is keyed by
 * category id by the caller, so switching categories resets the filters.
 */
export function GroceryCategoryView({
  store,
  categories,
  selectedCategoryId,
  onSelect,
  onSelectAll,
}: GroceryCategoryViewProps) {
  const { width } = useWindowDimensions();

  const [sort, setSort] = useState<SortKey>('name');
  const [veg, setVeg] = useState<VegFilter>('all');
  const [brandId, setBrandId] = useState<number | null>(null);
  const [offersOnly, setOffersOnly] = useState(false);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [sheet, setSheet] = useState<SheetName>(null);

  /**
   * Subcategories of the selected parent (or the selected subcategory's
   * siblings), resolved from the same nested payload the home page already
   * fetched.
   */
  const nav = useMemo(
    () => resolveCategoryNav(categories, selectedCategoryId),
    [categories, selectedCategoryId]
  );

  const query = useStoreCatalogue(store.id, {
    categoryId: nav.activeCategoryId,
    perPage: pageSize,
    keepPrevious: true,
  });
  const products = query.products;
  const loading = query.isLoading;

  /** Only offer the filters the returned products can actually honour. */
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
    if (veg !== 'all') list = list.filter((p) => (veg === 'veg' ? p.is_veg === true : p.is_veg === false));

    const sorted = [...list];
    if (sort === 'price_asc') sorted.sort((a, b) => Number(a.price) - Number(b.price));
    else if (sort === 'price_desc') sorted.sort((a, b) => Number(b.price) - Number(a.price));
    else if (sort === 'discount') sorted.sort((a, b) => (discountPercent(b) ?? 0) - (discountPercent(a) ?? 0));
    else sorted.sort((a, b) => a.name.localeCompare(b.name));
    return sorted;
  }, [products, activeBrandId, offersOnly, veg, sort]);

  const activeCount = (offersOnly ? 1 : 0) + (activeBrandId !== null ? 1 : 0) + (veg !== 'all' ? 1 : 0);

  const clearFilters = () => {
    setOffersOnly(false);
    setBrandId(null);
    setVeg('all');
  };

  /*
   * Structural layout, ported from the web `GroceryCategoryView`:
   *
   *   [ left category rail ] [ right product region ]
   *                                   \-- filters + grid
   *
   * The toolbar is pinned directly above the product grid (the space the old
   * category summary card used to occupy). The web rail is 92 / 124 / 176px
   * wide at mobile / sm / lg. The product region then takes whatever is left,
   * so the grid columns are computed from that remaining width — never from the
   * full screen — and fall back to a single column when two would be too
   * cramped to read.
   */
  const contentMax = Math.min(width, CATEGORY_CONTENT_MAX);
  const sidebarW = width >= 1024 ? 168 : width >= 768 ? 128 : width >= 400 ? 96 : 84;
  const mainGap = width >= 768 ? 14 : 10;
  /** Right-hand region after row padding, the rail and the column gap. */
  const regionWidth = contentMax - GUTTER * 2 - sidebarW - mainGap;

  /** Web grid gap is `gap-2 sm:gap-3`. */
  const gridGap = width >= 640 ? 12 : 8;
  /**
   * Widest column count per breakpoint. Phones (`width < 768`) are hard-capped
   * at 2 so the product region never renders 3 cramped cards; tablets widen
   * from there (3 / 4 / 5) based on their own width.
   */
  const columnCap = width >= 1200 ? 5 : width >= 1024 ? 4 : width >= 768 ? 3 : 2;
  /** A card narrower than this is unreadable, so drop to a single column. */
  const MIN_CARD = 108;
  const columns = Math.max(
    1,
    Math.min(columnCap, Math.floor((regionWidth + gridGap) / (MIN_CARD + gridGap)))
  );
  const cardWidth = Math.max(0, Math.floor((regionWidth - gridGap * (columns - 1)) / columns));

  const canShowMore = products.length < query.total;
  const remaining = query.total - products.length;

  return (
    <View style={styles.wrap}>
      {/*
       * Main content row — the vertical category rail on the left, the filter
       * toolbar and product grid filling the remaining width on the right,
       * exactly like the web category screen. The store/location facts live in
       * the shared fixed header above, so this screen shows no duplicate store
       * card and the toolbar sits directly under the header.
       *
       * The row is `flex: 1` inside the fixed-height Screen body, so the rail
       * and the product list each own a bounded, independently scrollable
       * column: scrolling one never moves the other.
       */}
      <View style={[styles.mainRow, { gap: mainGap }]}>
        {!nav.isLeaf ? (
          <CategorySidebar
            items={nav.subcategories}
            selectedId={nav.activeCategoryId}
            loading={loading}
            width={sidebarW}
            onSelect={onSelect}
          />
        ) : null}

        <View style={styles.productRegion}>
          {/* Filter + sort toolbar — horizontally scrollable, one row, pinned
              directly above the product grid. */}
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

          <ScrollView
            style={styles.productScroll}
            contentContainerStyle={styles.productContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Product listing — grid sized to the remaining region width. */}
            {loading ? (
              <ProductGridSkeleton columns={columns} cardWidth={cardWidth} gap={gridGap} />
            ) : query.isError ? (
              <EmptyState
                title="Couldn't load this category"
                message={`We're having trouble loading products from ${store.name}. Try again.`}
                actionLabel="Retry"
                onAction={() => void query.refetch()}
              />
            ) : visible.length === 0 ? (
              <EmptyState
                title="No products available in this category"
                message={
                  activeCount > 0
                    ? 'No products match the filters you picked. Try clearing them.'
                    : `${store.name} has no products in this category right now.`
                }
                actionLabel={activeCount > 0 ? 'Clear filters' : 'Browse all categories'}
                onAction={activeCount > 0 ? clearFilters : onSelectAll}
              />
            ) : (
              <View style={styles.gridSection}>
                <View style={[styles.grid, { gap: gridGap }]}>
                  {visible.map((p) => (
                    <CategoryProductCard key={p.id} product={p} width={cardWidth} />
                  ))}
                </View>

                {canShowMore ? (
                  <Pressable
                    onPress={() => setPageSize((n) => n + PAGE_SIZE)}
                    style={({ pressed }) => [styles.showMore, pressed && { opacity: 0.9 }]}
                    accessibilityLabel={`Show more products, ${remaining} left`}
                  >
                    <Text style={styles.showMoreText}>Show more products ({remaining} left)</Text>
                  </Pressable>
                ) : null}
              </View>
            )}
          </ScrollView>
        </View>
      </View>

      {/* Sheets — same option rows as the web bottom sheets. */}
      <BottomSheet visible={sheet === 'filters'} onClose={() => setSheet(null)} title="Filters">
        <Text style={styles.sheetHint}>Only the filters this category’s data supports are listed here.</Text>
        <OptionRow
          label="Discounted items only"
          hint="Items that have a real compare-at price"
          selected={offersOnly}
          onPress={() => setOffersOnly(!offersOnly)}
        />
        {vegAvailable ? (
          <OptionRow
            label="Veg only"
            hint="Filtered by the is_veg field on the product"
            selected={veg === 'veg'}
            onPress={() => setVeg(veg === 'veg' ? 'all' : 'veg')}
          />
        ) : null}
        {brands.length > 0 ? (
          <OptionRow label="All brands" selected={activeBrandId === null} onPress={() => setBrandId(null)} />
        ) : null}
        <Pressable onPress={clearFilters} style={styles.clearAll}>
          <Text style={styles.clearAllText}>Clear all filters</Text>
        </Pressable>
      </BottomSheet>

      <BottomSheet visible={sheet === 'sort'} onClose={() => setSheet(null)} title="Sort by">
        {(hasOffers ? [...SORT_OPTIONS, { key: 'discount' as SortKey, label: 'Biggest discount' }] : SORT_OPTIONS).map(
          (o) => (
            <OptionRow
              key={o.key}
              label={o.label}
              selected={sort === o.key}
              onPress={() => {
                setSort(o.key);
                setSheet(null);
              }}
            />
          )
        )}
      </BottomSheet>

      <BottomSheet visible={sheet === 'veg'} onClose={() => setSheet(null)} title="Type">
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
            onPress={() => {
              setVeg(o.key);
              setSheet(null);
            }}
          />
        ))}
      </BottomSheet>

      <BottomSheet visible={sheet === 'brand'} onClose={() => setSheet(null)} title="Brand">
        <OptionRow
          label="All brands"
          selected={activeBrandId === null}
          onPress={() => {
            setBrandId(null);
            setSheet(null);
          }}
        />
        {brands.map(([id, name]) => (
          <OptionRow
            key={id}
            label={name}
            selected={activeBrandId === id}
            onPress={() => {
              setBrandId(id);
              setSheet(null);
            }}
          />
        ))}
      </BottomSheet>
    </View>
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

function CategoryFilterBar({
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
}: FilterBarProps) {
  const sortOptions = hasOffers
    ? [...SORT_OPTIONS, { key: 'discount' as SortKey, label: 'Biggest discount' }]
    : SORT_OPTIONS;
  const sortLabel = sortOptions.find((o) => o.key === sort)?.label ?? 'Sort';

  if (loading) {
    return (
      <View style={styles.filterBarWrap}>
        <View style={styles.filterBar}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={styles.chipSkeleton} />
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.filterBarWrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterBar}
        accessibilityLabel="Product filters"
      >
        <FilterChip
          icon={<SlidersHorizontal size={15} color={activeCount > 0 ? colors.grocery[700] : colors.neutral[500]} />}
          label={activeCount > 0 ? `Filters (${activeCount})` : 'Filters'}
          active={activeCount > 0}
          open={sheet === 'filters'}
          onPress={() => onSheet(sheet === 'filters' ? null : 'filters')}
        />
        <FilterChip
          icon={<ArrowUpDown size={15} color={sort !== 'name' ? colors.grocery[700] : colors.neutral[500]} />}
          label={sortLabel}
          active={sort !== 'name'}
          open={sheet === 'sort'}
          onPress={() => onSheet(sheet === 'sort' ? null : 'sort')}
        />
        {vegAvailable ? (
          <FilterChip
            icon={<Leaf size={15} color={veg !== 'all' ? colors.grocery[700] : colors.neutral[500]} />}
            label={veg === 'all' ? 'Type' : veg === 'veg' ? 'Veg' : 'Non-veg'}
            active={veg !== 'all'}
            open={sheet === 'veg'}
            onPress={() => onSheet(sheet === 'veg' ? null : 'veg')}
          />
        ) : null}
        {brands.length > 0 ? (
          <FilterChip
            icon={<TagIcon size={15} color={activeBrandId !== null ? colors.grocery[700] : colors.neutral[500]} />}
            label={brandLabel ?? 'Brand'}
            active={activeBrandId !== null}
            open={sheet === 'brand'}
            onPress={() => onSheet(sheet === 'brand' ? null : 'brand')}
          />
        ) : null}
        {hasOffers ? (
          <Pressable
            onPress={() => onOffers(!offersOnly)}
            accessibilityRole="button"
            accessibilityState={{ selected: offersOnly }}
            style={[styles.chip, offersOnly && styles.chipActive]}
          >
            <Text style={[styles.chipText, offersOnly && styles.chipTextActive]}>Offers only</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

function FilterChip({
  icon,
  label,
  active,
  open,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  open?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      style={[styles.chip, active && styles.chipActive, open && !active && styles.chipOpen]}
    >
      {icon}
      <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
        {label}
      </Text>
      <ChevronDown size={13} color={active ? colors.grocery[700] : colors.neutral[400]} />
    </Pressable>
  );
}

function OptionRow({
  label,
  hint,
  selected,
  onPress,
}: {
  label: string;
  hint?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.optionRow}>
      <View style={styles.optionText}>
        <Text style={[styles.optionLabel, selected && styles.optionLabelActive]}>{label}</Text>
        {hint ? <Text style={styles.optionHint}>{hint}</Text> : null}
      </View>
      <View style={[styles.radio, selected && styles.radioActive]}>
        {selected ? <Check size={12} color="#fff" strokeWidth={3} /> : null}
      </View>
    </Pressable>
  );
}

/* ---------------------------------- rail ---------------------------------- */

/**
 * Vertically scrollable grocery category rail — native port of the web
 * `CategoryRail` (`category-view.tsx`). Renders the leading "All" entry plus
 * every stocked category with its image/icon and name, and highlights the
 * selected one.
 *
 * The rail fills the full height of the main content row (which is itself
 * `flex: 1` between the fixed header and footer), so its own ScrollView has a
 * bounded height and scrolls independently of the product list beside it.
 */
function CategorySidebar({
  items,
  selectedId,
  loading,
  width,
  onSelect,
}: {
  items: Category[];
  selectedId: number;
  loading: boolean;
  width: number;
  onSelect: (categoryId: number) => void;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const offsets = useRef<Record<number, number>>({});

  /**
   * Keep the active subcategory visible in the independently scrolling rail:
   * opening a parent selects the first child, and switching to an off-screen
   * child scrolls it into view without moving the product column.
   */
  useEffect(() => {
    const y = offsets.current[selectedId];
    if (y == null) return;
    scrollRef.current?.scrollTo({ y: Math.max(0, y - 8), animated: true });
  }, [selectedId, items]);

  return (
    <View style={[styles.sidebar, { width }]}>
      <ScrollView
        ref={scrollRef}
        style={styles.sidebarScroll}
        contentContainerStyle={styles.sidebarContent}
        showsVerticalScrollIndicator={false}
        accessibilityLabel="Grocery subcategories"
      >
        {loading ? (
          Array.from({ length: 7 }).map((_, i) => (
            <View key={i} style={styles.sidebarSkeleton}>
              <View style={styles.sidebarSkeletonImg} />
              <View style={styles.sidebarSkeletonLabel} />
            </View>
          ))
        ) : (
          items.map((c) => (
            <SidebarButton
              key={c.id}
              label={c.name}
              image={c.image ?? c.navigation_icon}
              active={c.id === selectedId}
              onLayout={(y) => {
                offsets.current[c.id] = y;
              }}
              onPress={() => onSelect(c.id)}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

function SidebarButton({
  label,
  image,
  active,
  onLayout,
  onPress,
}: {
  label: string;
  image?: string | null;
  active: boolean;
  onLayout?: (y: number) => void;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      onLayout={(e) => onLayout?.(e.nativeEvent.layout.y)}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      style={[styles.sidebarItem, active && styles.sidebarItemActive]}
    >
      {active ? <View style={styles.sidebarIndicator} /> : null}
      {image ? (
        <ProductImage src={image} style={styles.sidebarImg} rounded={false} resizeMode="contain" />
      ) : (
        <View style={[styles.sidebarIcon, active && styles.sidebarIconActive]}>
          <Tags size={16} color={active ? colors.grocery[700] : colors.neutral[400]} />
        </View>
      )}
      <Text style={[styles.sidebarLabel, active && styles.sidebarLabelActive]} numberOfLines={3}>
        {label}
      </Text>
    </Pressable>
  );
}

/* --------------------------------- product -------------------------------- */

/**
 * Dense grocery card for the category grid — native port of the web
 * `GroceryProductCard`. Product data, pricing, stock, the ADD button and the
 * stepper all come from the existing components, so variable products still
 * open the shared configurator and the cart is never duplicated. Pack shots use
 * `contain` so nothing is cropped.
 */
function CategoryProductCard({ product, width }: { product: Product; width: number }) {
  const router = useRouter();
  const off = discountPercent(product);
  const price = parseFloat(product.price);
  const compare = product.compare_at_price ? parseFloat(product.compare_at_price) : null;
  const hasCompare = compare !== null && compare > price;

  const openProduct = () => {
    carryProduct(product, 'grocery');
    router.push(`/product/${product.id}?service=grocery` as never);
  };

  return (
    <Pressable
      onPress={openProduct}
      accessibilityRole="button"
      accessibilityLabel={product.name}
      style={({ pressed }) => [styles.pCard, { width }, pressed && { opacity: 0.94 }]}
    >
      <View style={styles.pImgWrap}>
        <ProductImage src={product.image} style={styles.pImg} resizeMode="contain" rounded={false} />
        {off !== null ? (
          <View style={styles.pOff}>
            <Text style={styles.pOffText}>{off}% off</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.pBody}>
        {product.brand?.name ? (
          <Text style={styles.pBrand} numberOfLines={1}>
            {product.brand.name}
          </Text>
        ) : null}
        <Text style={styles.pName} numberOfLines={2}>
          {product.name}
        </Text>
        {product.unit_label || product.is_veg !== null ? (
          <View style={styles.pMeta}>
            {product.unit_label ? (
              <Text style={styles.pUnit} numberOfLines={1}>
                {product.unit_label}
              </Text>
            ) : null}
            <VegMark isVeg={product.is_veg} size={12} bordered />
          </View>
        ) : null}

        <View style={styles.pPriceRow}>
          <Text style={styles.pPrice}>{formatCurrency(price)}</Text>
          {hasCompare ? <Text style={styles.pCompare}>{formatCurrency(compare as number)}</Text> : null}
        </View>
        <Text style={[styles.pStock, { color: product.is_available ? colors.success : colors.danger }]}>
          {product.is_available ? 'In stock' : 'Out of stock'}
        </Text>

        <View style={styles.pAdd}>
          <AddToCartControl productId={product.id} type="grocery" size="icon" product={product} />
        </View>
      </View>
    </Pressable>
  );
}

/* ------------------------------- skeletons ------------------------------- */

function ProductGridSkeleton({
  columns,
  cardWidth,
  gap,
}: {
  columns: number;
  cardWidth: number;
  gap: number;
}) {
  return (
    <View style={[styles.grid, { gap }]}>
      {Array.from({ length: columns * 3 }).map((_, i) => (
        <View key={i} style={{ width: cardWidth }}>
          <View style={styles.skeletonCard}>
            <View style={styles.skeletonImg} />
            <View style={styles.skeletonLineWide} />
            <View style={styles.skeletonLineNarrow} />
            <View style={styles.skeletonPill} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    minHeight: 0,
    gap: 14,
    paddingTop: 12,
    paddingBottom: 8,
    /** Mirrors the web `max-w-5xl` content column; wide tablets centre it. */
    maxWidth: CATEGORY_CONTENT_MAX,
    width: '100%',
    alignSelf: 'center',
  },
  /* Main content row: vertical rail | product region. Fills the body height. */
  mainRow: {
    flex: 1,
    minHeight: 0,
    flexDirection: 'row',
    paddingHorizontal: GUTTER,
  },
  productRegion: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
  },
  productScroll: {
    flex: 1,
  },
  productContent: {
    gap: 12,
    paddingBottom: 16,
  },
  /* Vertical category rail — fixed position, scrolls inside itself. */
  sidebar: {
    alignSelf: 'stretch',
    flexShrink: 0,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: withAlpha(colors.neutral[200], 0.7),
    backgroundColor: '#fff',
    overflow: 'hidden',
    ...shadows.card,
  },
  sidebarScroll: {
    flex: 1,
  },
  sidebarContent: {
    gap: 2,
    padding: 4,
  },
  sidebarItem: {
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 4,
    paddingVertical: 8,
    borderRadius: 12,
    overflow: 'hidden',
  },
  sidebarItemActive: {
    backgroundColor: colors.grocery[100],
  },
  sidebarItemChild: {
    paddingLeft: 8,
  },
  sidebarIndicator: {
    position: 'absolute',
    left: 0,
    top: '50%',
    marginTop: -14,
    width: 3,
    height: 28,
    borderTopRightRadius: 999,
    borderBottomRightRadius: 999,
    backgroundColor: colors.grocery[600],
  },
  sidebarImg: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  sidebarIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.neutral[100],
  },
  sidebarIconActive: {
    backgroundColor: colors.grocery[200],
  },
  sidebarLabel: {
    width: '100%',
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '600',
    lineHeight: 13,
    color: colors.neutral[700],
  },
  sidebarLabelActive: {
    color: colors.grocery[800],
  },
  sidebarSkeleton: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  sidebarSkeletonImg: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.neutral[200],
  },
  sidebarSkeletonLabel: {
    width: 44,
    height: 9,
    borderRadius: 999,
    backgroundColor: colors.neutral[200],
  },
  filterBarWrap: {
    marginTop: -2,
    marginBottom: 8,
  },
  filterBar: {
    paddingHorizontal: 2,
    paddingRight: 8,
    gap: 8,
    paddingVertical: 2,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    backgroundColor: '#fff',
  },
  chipActive: {
    borderColor: colors.grocery[600],
    backgroundColor: colors.grocery[100],
  },
  chipOpen: {
    borderColor: colors.grocery[500],
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.neutral[700],
    maxWidth: 150,
  },
  chipTextActive: {
    color: colors.grocery[800],
  },
  chipSkeleton: {
    width: 96,
    height: 36,
    borderRadius: 999,
    backgroundColor: colors.neutral[200],
  },
  gridSection: {
    gap: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  showMore: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.grocery[300],
    backgroundColor: '#fff',
    paddingVertical: 10,
    alignItems: 'center',
  },
  showMoreText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.grocery[700],
  },
  sheetHint: {
    fontSize: 12,
    color: colors.neutral[500],
    marginBottom: 4,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.ink[50],
  },
  optionText: {
    flex: 1,
    minWidth: 0,
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.ink[800],
  },
  optionLabelActive: {
    fontWeight: '800',
    color: colors.grocery[700],
  },
  optionHint: {
    marginTop: 2,
    fontSize: 12,
    color: colors.neutral[500],
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.neutral[300],
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: {
    borderColor: colors.grocery[600],
    backgroundColor: colors.grocery[500],
  },
  clearAll: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    paddingVertical: 10,
    alignItems: 'center',
  },
  clearAllText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.neutral[700],
  },
  skeletonCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: withAlpha(colors.neutral[200], 0.7),
    backgroundColor: '#fff',
    padding: 6,
    gap: 8,
  },
  skeletonImg: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
    backgroundColor: colors.neutral[200],
  },
  skeletonLineWide: {
    height: 10,
    width: '80%',
    borderRadius: 999,
    backgroundColor: colors.neutral[200],
  },
  skeletonLineNarrow: {
    height: 10,
    width: '45%',
    borderRadius: 999,
    backgroundColor: colors.neutral[200],
  },
  skeletonPill: {
    height: 24,
    width: 64,
    borderRadius: 999,
    backgroundColor: colors.neutral[200],
  },
  /* ------------------------- dense category product card ------------------------ */
  pCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: withAlpha(colors.neutral[200], 0.7),
    padding: 6,
    ...shadows.card,
  },
  pImgWrap: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
    backgroundColor: colors.ink[50],
    overflow: 'hidden',
  },
  pImg: {
    width: '100%',
    height: '100%',
  },
  pOff: {
    position: 'absolute',
    left: 4,
    top: 4,
    backgroundColor: colors.success,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  pOffText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#fff',
  },
  pBody: {
    flex: 1,
    paddingTop: 6,
    paddingHorizontal: 2,
  },
  pBrand: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    color: colors.neutral[400],
  },
  pName: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
    color: colors.ink[900],
  },
  pMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  pUnit: {
    flexShrink: 1,
    fontSize: 10,
    color: colors.neutral[500],
  },
  pPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginTop: 4,
  },
  pPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink[900],
  },
  pCompare: {
    fontSize: 12,
    color: colors.neutral[400],
    textDecorationLine: 'line-through',
  },
  pStock: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 2,
  },
  pAdd: {
    marginTop: 'auto',
    paddingTop: 6,
    alignItems: 'flex-end',
  },
});
