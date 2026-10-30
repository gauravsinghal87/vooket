import { Fragment, useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type AccessibilityState,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  BadgePercent,
  Bike,
  ChevronDown,
  Heart,
  Leaf,
  MapPin,
  Search,
  ShoppingCart,
  Star,
  X,
  Zap,
} from 'lucide-react-native';
import { repositories } from '@/api/repositories';
import { MenuItemRow, ViewCartBar } from '@/components/cards';
import { Screen } from '@/components/Screen';
import { LocationSelector } from '@/components/LocationSelector';
import { AddToCartControl } from '@/components/product/AddToCart';
import { ProductImage } from '@/components/ui/ProductImage';
import { EmptyState, Loader } from '@/components/ui/primitives';
import { useCart } from '@/hooks/useCart';
import { useAppStore } from '@/stores/appStore';
import { DEFAULT_LOCATION } from '@/lib/location';
import { formatDistanceKm, haversineKm } from '@/lib/geo';
import { deliveryDistanceKm, deliveryEtaText } from '@/lib/deliveryEta';
import { discountPercent, formatINR } from '@/lib/utils';
import { colors } from '@/theme';
import type { Product } from '@/types/catalog';
import type { OrderItem } from '@/types/models';

type VegFilter = 'veg' | 'nonveg';

/** Relative age of a past order: "1 month ago", "3 days ago", "today". */
function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 31) return `${days} days ago`;
  const months = Math.max(1, Math.floor(days / 30.44));
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;
  const years = Math.max(1, Math.floor(days / 365.25));
  return `${years} year${years === 1 ? '' : 's'} ago`;
}

/** "By 37K+" — Zomato's compact rating-count caption. */
function ratingCountLabel(count: number): string {
  if (count >= 1000) {
    const k = count / 1000;
    return `By ${k >= 100 ? Math.round(k) : Math.round(k * 10) / 10}K+`;
  }
  return `By ${count}`;
}

/**
 * Pressable for chips that live inside the ScrollView's native sticky row
 * (`stickyHeaderIndices`). RN repositions a docked sticky header with a
 * native-driver `translateY`, but `Pressable`/`Pressability` measures the
 * responder region through the shadow tree, which reports the pre-transform
 * (un-docked) position — so taps land outside the press rect and are cancelled
 * once the row docks (New Architecture only; the upstream `measureAsyncOnUI`
 * fix, facebook/react-native#51835, is not in RN 0.81). Plain responder events
 * need no measurement, so the chip keeps working in both states. Letting
 * `onResponderTerminationRequest` return true hands the gesture to the parent
 * ScrollView so a swipe never triggers a press. Mirrors `CategoryPressable`
 * used by the Food home's docked category rail.
 */
function StickyPressable({
  onPress,
  style,
  accessibilityLabel,
  accessibilityState,
  children,
}: {
  onPress: () => void;
  style?: StyleProp<ViewStyle> | ((state: { pressed: boolean }) => StyleProp<ViewStyle>);
  accessibilityLabel?: string;
  accessibilityState?: AccessibilityState;
  children: ReactNode;
}) {
  const [pressed, setPressed] = useState(false);
  return (
    <View
      accessible
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessibilityState}
      onAccessibilityTap={onPress}
      onStartShouldSetResponder={() => true}
      onResponderGrant={() => setPressed(true)}
      onResponderRelease={() => {
        setPressed(false);
        onPress();
      }}
      onResponderTerminate={() => setPressed(false)}
      onResponderTerminationRequest={() => true}
      style={typeof style === 'function' ? style({ pressed }) : style}
    >
      {children}
    </View>
  );
}

const SCREEN_HEIGHT = Dimensions.get('window').height;
/** Large, device-responsive cover: ~34% of the viewport, clamped for phones/tablets. */
const COVER_HEIGHT = Math.round(Math.min(Math.max(SCREEN_HEIGHT * 0.34, 240), 360));
const PANEL_OVERLAP = 0;
/** Compact sticky-header row (back / name / actions) and its bottom padding. */
const COMPACT_ROW_H = 56;
const COMPACT_PAD_BOTTOM = 8;

export default function RestaurantScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const restaurantId = Number(params.id);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  // Every measured block is a direct child of the ScrollView, so each `y` is
  // already in the scroll content's coordinate space (no composing needed): the
  // menu top + per-section offset is the scroll target for the category chips,
  // and the filter bar's height is the dock reservation used by the scroll-spy.
  const menuY = useRef(0);
  const filterBarHRef = useRef(0);
  const sectionY = useRef<Record<string, number>>({});
  // Stage B: the compact header is revealed once the info panel's top edge
  // passes under it, and stays pinned until the user scrolls back up.
  const [headerStuck, setHeaderStuck] = useState(false);
  // True while a chip (`scrollTo`) animation is in flight. `onScroll` fires every
  // frame of that animation, so without this guard the scroll-spy would stomp the
  // chip we just selected with whichever section happens to pass under the sticky
  // rows — the highlight flickers and can settle on the wrong chip. While the
  // guard is set the tapped chip stays active; it is cleared when the animated
  // scroll settles (`onMomentumScrollEnd`) or after a safety timeout, and any
  // manual drag also clears it so the spy re-engages immediately.
  const programmaticScroll = useRef(false);
  const programmaticTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const restaurant = useQuery({
    queryKey: ['restaurant', restaurantId],
    queryFn: () => repositories.food.getRestaurant(restaurantId),
    enabled: Number.isFinite(restaurantId),
  });

  const menu = useQuery({
    queryKey: ['menu', restaurantId],
    queryFn: () => repositories.food.getMenu(restaurantId),
    enabled: Number.isFinite(restaurantId),
  });

  const { data: foodCart } = useCart('food');
  const cartCount = (foodCart?.items ?? []).reduce((n, i) => n + i.quantity, 0);

  const r = restaurant.data;

  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<Set<VegFilter>>(new Set());
  const [fav, setFav] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const filterMatch = useCallback(
    (p: { name: string; description?: string | null; is_veg: boolean | null }) => {
      const q = query.trim().toLowerCase();
      if (q && !p.name.toLowerCase().includes(q) && !(p.description ?? '').toLowerCase().includes(q)) return false;
      if (filters.has('veg') && p.is_veg !== true) return false;
      if (filters.has('nonveg') && p.is_veg !== false) return false;
      return true;
    },
    [query, filters]
  );

  const toggleFilter = (value: VegFilter) => {
    setFilters((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  };

  const categories = useMemo(
    () =>
      (menu.data ?? [])
        .map((cat) => ({ ...cat, products: cat.products.filter(filterMatch) }))
        .filter((cat) => cat.products.length > 0),
    [menu.data, filterMatch]
  );

  const menuById = useMemo(() => {
    const map = new Map<number, Product>();
    for (const cat of menu.data ?? []) for (const p of cat.products) map.set(p.id, p);
    return map;
  }, [menu.data]);

  /**
   * "Your Orders and Collections": this customer's most recent food order from
   * this restaurant, resolved to real menu products. The section renders only
   * when the backend returns history that still maps onto the live menu —
   * nothing is fabricated when there is no order history.
   */
  const pastOrder = useQuery({
    queryKey: ['restaurant-past-order', restaurantId],
    queryFn: async () => {
      const page = await repositories.orders.getOrders({ order_type: 'food', page: 1 });
      const list = page?.data ?? [];
      const match = list.find((o) => o.restaurant_id === restaurantId && o.status !== 'CANCELLED');
      if (!match) return null;
      if (match.items && match.items.length > 0) return match;
      try {
        return await repositories.orders.getOrder(match.id);
      } catch {
        return null;
      }
    },
    enabled: Number.isFinite(restaurantId) && !!r && !menu.isLoading,
    staleTime: 60_000,
  });

  const pastItems = useMemo(() => {
    const items = pastOrder.data?.items ?? [];
    const seen = new Set<number>();
    const out: { item: OrderItem; product: Product }[] = [];
    for (const it of items) {
      if (seen.has(it.product_id)) continue;
      const product = menuById.get(it.product_id);
      if (!product || !product.is_available) continue;
      seen.add(it.product_id);
      out.push({ item: it, product });
      if (out.length >= 3) break;
    }
    return out;
  }, [pastOrder.data, menuById]);

  const orderedAt = pastOrder.data?.created_at ?? null;

  /** "Most ordered together": the kitchen's featured dishes first, then the rest of the live menu. */
  const mostOrdered = useMemo(() => {
    const all = (menu.data ?? []).flatMap((cat) => cat.products.filter((p) => p.is_available));
    return [...all.filter((p) => p.is_featured), ...all.filter((p) => !p.is_featured)].slice(0, 8);
  }, [menu.data]);

  /** Section order for the quick-nav + scroll-spy (most ordered first, then categories). */
  const sectionOrder = useMemo(
    () => [...(mostOrdered.length > 0 ? ['recommended'] : []), ...categories.map((cat) => `cat-${cat.id}`)],
    [mostOrdered.length, categories]
  );

  // Both reference sections start expanded; their chevrons collapse them.
  const [pastOrdersOpen, setPastOrdersOpen] = useState(true);
  const [mostOrderedOpen, setMostOrderedOpen] = useState(true);

  // Height the docked compact header occupies: the status-bar inset plus its
  // fixed row. The filter row reserves exactly this above itself (so the two
  // never overlap and no content peeks through) and menu scroll targets subtract
  // it (plus the filter row's own height) so headings clear both rows.
  const headerBlockH = insets.top + COMPACT_ROW_H;

  const absY = (key: string) => menuY.current + (sectionY.current[key] ?? 0);

  const markProgrammatic = () => {
    programmaticScroll.current = true;
    if (programmaticTimer.current) clearTimeout(programmaticTimer.current);
    // Safety net: if `onMomentumScrollEnd` never fires (e.g. the row was already
    // at the target so no animation ran) the spy must still resume.
    programmaticTimer.current = setTimeout(() => {
      programmaticScroll.current = false;
      programmaticTimer.current = null;
    }, 700);
  };

  const endProgrammatic = () => {
    if (programmaticTimer.current) {
      clearTimeout(programmaticTimer.current);
      programmaticTimer.current = null;
    }
    programmaticScroll.current = false;
  };

  const scrollTo = (key: 'menu' | string) => {
    const reserved = headerBlockH + filterBarHRef.current;
    markProgrammatic();
    if (key === 'menu') {
      scrollRef.current?.scrollTo({ y: Math.max(0, menuY.current - reserved), animated: true });
      return;
    }
    // Optimistically light the tapped chip; the guard keeps `onScroll` from
    // overriding it mid-animation, so it never flickers to an intermediate
    // section or settles on the wrong one.
    setActiveSection(key);
    scrollRef.current?.scrollTo({ y: Math.max(0, absY(key) - reserved), animated: true });
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    // The restaurant's name fades into the always-visible top bar as soon as
    // the page scrolls. Guarded so it only re-renders on the transition.
    const stuck = y > 16;
    setHeaderStuck((cur) => (cur === stuck ? cur : stuck));

    // A programmatic scroll owns the active chip until it settles; letting the
    // spy run would make the highlight fight the requested scroll.
    if (programmaticScroll.current) return;
    if (sectionOrder.length === 0) return;
    const threshold = y + headerBlockH + filterBarHRef.current;
    let current: string | null = null;
    for (const key of sectionOrder) {
      if (absY(key) <= threshold) current = key;
    }
    setActiveSection(current ?? sectionOrder[0]);
  };

  const openLocationSelector = useAppStore((s) => s.openLocationSelector);
  const closeLocationSelector = useAppStore((s) => s.closeLocationSelector);
  const locOpen = useAppStore((s) => s.locationSelectorOpen);
  const origin = useAppStore((s) => s.location) ?? DEFAULT_LOCATION;

  const etaText = r ? deliveryEtaText(r) : null;
  const distanceLabel = useMemo(() => {
    if (!r) return '';
    const routed = deliveryDistanceKm(r);
    if (routed != null) return formatDistanceKm(routed);
    const lat = Number(r.latitude);
    const lng = Number(r.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return '';
    return formatDistanceKm(haversineKm(origin, { latitude: lat, longitude: lng }));
  }, [r, origin]);

  const chipActive = (key: string) => activeSection === key;

  return (
    <Screen
      header={null}
      scroll={false}
      overlay={
        // Zomato's white top bar: pinned outside the ScrollView so it is always
        // visible; the restaurant's name fades in once the page scrolls. The
        // wrapper is `box-none`, so only the controls capture touches and
        // scrolling still reaches the content beneath the transparent band.
        r ? (
          <View pointerEvents="box-none">
            <View style={[styles.compactHeader, { paddingTop: insets.top }]}>
              <View style={[styles.compactRow, { height: COMPACT_ROW_H }]}>
                <Pressable
                  onPress={() => router.back()}
                  style={styles.compactBtn}
                  hitSlop={6}
                  accessibilityLabel="Go back to restaurants"
                >
                  <ArrowLeft size={20} color={colors.ink[900]} />
                </Pressable>
                <Text numberOfLines={1} style={[styles.compactName, !headerStuck && { opacity: 0 }]}>
                  {r.name}
                </Text>
                <View style={styles.compactActions} />
              </View>
            </View>
          </View>
        ) : null
      }
      bottomBar={
        r && (
          <View>
            <View style={styles.menuBar}>
              <View style={styles.menuSearch}>
                <Search size={16} color={colors.neutral[400]} />
                <TextInput
                  ref={inputRef}
                  value={query}
                  onChangeText={setQuery}
                  placeholder={`Search in ${r.name}`}
                  placeholderTextColor={colors.neutral[400]}
                  style={styles.menuInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {query.length > 0 && (
                  <Pressable onPress={() => setQuery('')} hitSlop={8}>
                    <X size={16} color={colors.neutral[400]} />
                  </Pressable>
                )}
              </View>
              <Pressable style={styles.menuBtn} onPress={() => scrollTo('menu')}>
                <Text style={styles.menuBtnText}>Menu</Text>
              </Pressable>
            </View>
            <View style={{ marginTop: 8 }}>
              <ViewCartBar type="food" />
            </View>
          </View>
        )
      }
    >
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={endProgrammatic}
        onScrollEndDrag={endProgrammatic}
        contentContainerStyle={styles.scrollContent}
        stickyHeaderIndices={[1]}
        nestedScrollEnabled
      >
        {/* Single always-present head block: the loading skeleton, the error
            state, the cover image and the info panel. Keeping these in ONE
            direct child means the filter row is always the ScrollView's second
            child (index 1) on every platform. react-native-web keys sticky
            indices off `React.Children.map` (which counts falsy `{cond && ...}`
            children), while native uses `React.Children.toArray` (which strips
            them); grouping the conditional blocks keeps both in agreement. */}
        <View key="head" style={{ paddingTop: headerBlockH }}>
          {restaurant.isLoading && (
            <View style={styles.coverSkeleton}>
              <Loader />
            </View>
          )}

          {restaurant.isError && (
            <View style={styles.errorWrap}>
              <EmptyState
                title="Restaurant not found"
                message="This restaurant may have been removed."
                actionLabel="Go back"
                onAction={() => router.back()}
              />
            </View>
          )}

          {/* The reference has no cover photo on this screen: the white info
              panel starts directly under the top bar. */}

          {/* White info panel (top block) overlapping the cover's bottom edge. Its
            negative bottom margin cancels the sticky filter row's reserved header
            space, so no gap is left behind at rest. */}
          {r && (
            <View
              key="panel"
              style={[styles.panelTop, { marginBottom: -headerBlockH }]}
            >
              {r.is_veg && (
                <View style={styles.vegBadge}>
                  <Leaf size={13} color={colors.zGreen} />
                  <Text style={styles.vegBadgeText}>Pure Veg</Text>
                </View>
              )}

              {/* Reference layout: name hard left, the green rating block hard
                  right with its "By 37K+" underlined label beneath. */}
              <View style={styles.nameRow}>
                <Text style={styles.name} numberOfLines={3}>
                  {r.name}
                </Text>
                <View style={styles.ratingBlock}>
                  <View style={[styles.ratingPill, !r.rating && styles.ratingPillNew]}>
                    <Star size={13} color="#fff" fill="#fff" />
                    <Text style={styles.ratingPillText}>
                      {r.rating ? Number(r.rating).toFixed(1) : 'New'}
                    </Text>
                  </View>
                  {r.rating_count > 0 && (
                    <Text style={styles.byCount}>By {ratingCountLabel(r.rating_count)}+</Text>
                  )}
                </View>
              </View>

              {r.cuisine_type ? <Text style={styles.cuisine}>{r.cuisine_type}</Text> : null}

              {/* Distance · area — tapping opens the shared full-screen location
                  selector (the reference's dropdown). */}
              <Pressable
                onPress={() => openLocationSelector()}
                accessibilityLabel="Change delivery location"
                style={styles.locationRow}
              >
                <MapPin size={15} color={colors.neutral[500]} />
                <Text numberOfLines={1} style={styles.locationText}>
                  {distanceLabel ? `${distanceLabel} · ` : ''}
                  {r.address ?? origin.label}
                </Text>
                <ChevronDown size={15} color={colors.neutral[400]} />
              </Pressable>

              {/* Delivery estimate row. */}
              <View style={styles.etaRow}>
                <Zap size={15} color={colors.zGreen} fill={colors.zGreen} />
                <Text style={styles.etaText}>
                  {etaText ??
                    (r.avg_delivery_time_min
                      ? `${r.avg_delivery_time_min} mins`
                      : 'Delivery available')}
                </Text>
              </View>

              {/* "Frequently reordered" + the service facts this payload carries. */}
              <View style={styles.badgeRow}>
                {r.is_featured && (
                  <View style={styles.serviceBadge}>
                    <Text style={styles.reorderCheck}>✓</Text>
                    <Text style={styles.serviceBadgeText}>Frequently reordered</Text>
                  </View>
                )}
                {r.order_type === 'both' && (
                  <View style={styles.serviceBadge}>
                    <Bike size={14} color={colors.neutral[500]} />
                    <Text style={styles.serviceBadgeText}>Delivery & Pickup</Text>
                  </View>
                )}
                {r.dine_in && (
                  <View style={styles.serviceBadge}>
                    <MapPin size={14} color={colors.neutral[500]} />
                    <Text style={styles.serviceBadgeText}>Dine-in</Text>
                  </View>
                )}
                {r.min_order_amount && parseFloat(String(r.min_order_amount)) > 0 && (
                  <View style={styles.serviceBadge}>
                    <Text style={styles.serviceBadgeText}>
                      Min. order {formatINR(r.min_order_amount)}
                    </Text>
                  </View>
                )}
              </View>

              {/* Offer strip (the reference's offer row). */}
              {r.free_delivery_above && parseFloat(String(r.free_delivery_above)) > 0 && (
                <View style={styles.offerStrip}>
                  <BadgePercent size={16} color={colors.zInfo} />
                  <Text style={styles.offerStripText} numberOfLines={1}>
                    FREE DELIVERY above {formatINR(r.free_delivery_above)}
                  </Text>
                </View>
              )}

              {/* The reference's grey separator band before the menu. */}
              <View style={styles.greyBand} />
            </View>
          )}
        </View>

        {/* Sticky filter row — the ScrollView's single sticky child (index 1).
            Its reserved top padding (`headerBlockH`) makes the chips dock
            directly below the compact header instead of under it; only the inner
            body paints a solid backing, so nothing covers the panel until the
            row actually docks. */}
        {r && (
          <View key="filter" style={{ paddingTop: headerBlockH }}>
            <View
              style={styles.filterBar}
              onLayout={(e) => {
                filterBarHRef.current = e.nativeEvent.layout.height;
              }}
            >
              <View style={styles.filterChips}>
                <StickyPressable
                  onPress={() => toggleFilter('veg')}
                  accessibilityLabel="Veg"
                  accessibilityState={{ selected: filters.has('veg') }}
                  style={[
                    styles.filterChip,
                    filters.has('veg') ? { borderColor: colors.zGreen, backgroundColor: 'rgba(5,137,62,0.1)' } : undefined,
                  ]}
                >
                  <Leaf size={14} color={filters.has('veg') ? colors.zGreen : colors.neutral[500]} />
                  <Text style={[styles.filterChipText, filters.has('veg') ? { color: colors.zGreen } : undefined]}>Veg</Text>
                </StickyPressable>
                <StickyPressable
                  onPress={() => toggleFilter('nonveg')}
                  accessibilityLabel="Non-veg"
                  accessibilityState={{ selected: filters.has('nonveg') }}
                  style={[
                    styles.filterChip,
                    filters.has('nonveg') ? { borderColor: colors.danger, backgroundColor: 'rgba(220,38,38,0.1)' } : undefined,
                  ]}
                >
                  <Text style={{ fontSize: 12, color: filters.has('nonveg') ? colors.danger : colors.neutral[500] }}>&#9632;</Text>
                  <Text style={[styles.filterChipText, filters.has('nonveg') ? { color: colors.danger } : undefined]}>Non-veg</Text>
                </StickyPressable>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} nestedScrollEnabled contentContainerStyle={styles.catChips} keyboardShouldPersistTaps="always">
                {mostOrdered.length > 0 && (
                  <StickyPressable
                    accessibilityLabel="Most ordered"
                    accessibilityState={{ selected: chipActive('recommended') }}
                    style={[styles.catChip, chipActive('recommended') && styles.catChipActive]}
                    onPress={() => scrollTo('recommended')}
                  >
                    <Text style={[styles.catChipText, chipActive('recommended') && styles.catChipTextActive]}>Most ordered</Text>
                  </StickyPressable>
                )}
                {categories.map((cat) => (
                  <StickyPressable
                    key={cat.id}
                    accessibilityLabel={cat.name}
                    accessibilityState={{ selected: chipActive(`cat-${cat.id}`) }}
                    style={[styles.catChip, chipActive(`cat-${cat.id}`) && styles.catChipActive]}
                    onPress={() => scrollTo(`cat-${cat.id}`)}
                  >
                    <Text style={[styles.catChipText, chipActive(`cat-${cat.id}`) && styles.catChipTextActive]}>{cat.name}</Text>
                  </StickyPressable>
                ))}
              </ScrollView>
            </View>
          </View>
        )}

        {/* Menu — a direct child of the ScrollView, so the pinned filter row
            scrolls the menu contents beneath it and each heading stays clear of
            the sticky rows. */}
        {r && (
          <View
            key="menu"
            style={styles.menuWrap}
            onLayout={(e) => {
              menuY.current = e.nativeEvent.layout.y;
            }}
          >
            {menu.isLoading && <Loader label="Loading menu…" />}

            {/* Your Orders and Collections — real history, collapsible. */}
            {pastItems.length > 0 && (
              <View style={styles.section}>
                <Pressable
                  onPress={() => setPastOrdersOpen((v) => !v)}
                  style={styles.sectionHeadBtn}
                  accessibilityState={{ expanded: pastOrdersOpen }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sectionTitle}>Your Orders and Collections</Text>
                    <Text style={styles.sectionSub}>Past customisations are pre-selected</Text>
                  </View>
                  <ChevronDown
                    size={20}
                    color={colors.neutral[500]}
                    style={!pastOrdersOpen ? styles.chevRot : undefined}
                  />
                </Pressable>
                {pastOrdersOpen && (
                  <View style={{ marginTop: 4 }}>
                    {pastItems.map(({ item, product }) => (
                      <PastOrderRow
                        key={item.id}
                        item={item}
                        product={product}
                        caption={orderedAt ? `You ordered ${timeAgo(orderedAt)}` : undefined}
                      />
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Most ordered together — a horizontal dish rail with the floating
                ADD control, as in the reference. */}
            {mostOrdered.length > 0 && (
              <View
                style={styles.section}
                onLayout={(e) => {
                  sectionY.current['recommended'] = e.nativeEvent.layout.y;
                }}
              >
                <Pressable
                  onPress={() => setMostOrderedOpen((v) => !v)}
                  style={styles.sectionHeadBtn}
                  accessibilityState={{ expanded: mostOrderedOpen }}
                >
                  <Text style={styles.sectionTitle}>Most ordered together</Text>
                  <ChevronDown
                    size={20}
                    color={colors.neutral[500]}
                    style={!mostOrderedOpen ? styles.chevRot : undefined}
                  />
                </Pressable>
                {mostOrderedOpen && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.rail}
                  >
                    {mostOrdered.map((p) => (
                      <View key={p.id} style={styles.railCard}>
                        <View style={styles.railImgWrap}>
                          <ProductImage src={p.image} style={styles.railImg} rounded={false} />
                          {!p.is_available && <View style={styles.railDim} />}
                          <View style={styles.railAdd}>
                            <AddToCartControl productId={p.id} type="food" size="icon" product={p} />
                          </View>
                        </View>
                        <Text numberOfLines={1} style={styles.railName}>
                          {p.name}
                        </Text>
                        <Text style={styles.railPrice}>{formatINR(p.price)}</Text>
                      </View>
                    ))}
                  </ScrollView>
                )}
              </View>
            )}

            {categories.map((cat) => (
              <View
                key={cat.id}
                style={styles.section}
                onLayout={(e) => {
                  sectionY.current[`cat-${cat.id}`] = e.nativeEvent.layout.y;
                }}
              >
                <View style={styles.sectionHead}>
                  <Text style={styles.sectionTitle}>{cat.name}</Text>
                  <Text style={styles.sectionCount}>{cat.products.length} items</Text>
                </View>
                {cat.products.map((p, i) => (
                  <Fragment key={p.id}>
                    <MenuItemRow product={p} type="food" />
                    {i < cat.products.length - 1 ? <View style={styles.divider} /> : null}
                  </Fragment>
                ))}
              </View>
            ))}

            {!menu.isLoading && categories.length === 0 && (
              <View style={styles.noMatch}>
                <Text style={styles.noMatchText}>No items match your search or filters.</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* The reference's location dropdown resolves to this full-screen picker. */}
      <LocationSelector
        open={locOpen}
        onOpenChange={(open) => (open ? openLocationSelector() : closeLocationSelector())}
      />
    </Screen>
  );
}

/**
 * One row of "Your Orders and Collections": the dish photo with its veg mark,
 * the live price with the struck original and off-label, the relative order
 * caption, and the ADD pill for the same product.
 */
function PastOrderRow({
  item,
  product,
  caption,
}: {
  item: OrderItem;
  product: Product;
  caption?: string;
}) {
  const off = discountPercent(product);
  const compare =
    product.compare_at_price && parseFloat(product.compare_at_price) > parseFloat(product.price)
      ? formatINR(product.compare_at_price)
      : null;

  return (
    <View style={styles.pastRow}>
      <View style={styles.pastThumb}>
        <ProductImage
          src={item.product_image ?? product.image}
          style={styles.pastThumbImg}
          rounded={false}
        />
        {product.is_veg !== null && (
          <View style={[styles.vegMark, { borderColor: product.is_veg ? colors.zGreen : colors.danger }]}>
            <View
              style={{
                width: 5,
                height: 5,
                borderRadius: 2.5,
                backgroundColor: product.is_veg ? colors.zGreen : colors.danger,
              }}
            />
          </View>
        )}
      </View>

      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={styles.pastName}>
          {product.name}
        </Text>
        <View style={styles.pastPriceRow}>
          <Text style={styles.pastPrice}>{formatINR(product.price)}</Text>
          {compare ? <Text style={styles.pastCompare}>{compare}</Text> : null}
        </View>
        {off !== null && product.is_available ? (
          <Text style={styles.pastOff}>{off}% OFF</Text>
        ) : null}
        {caption ? <Text style={styles.pastCaption}>{caption}</Text> : null}
      </View>

      <View style={styles.pastActions}>
        <AddToCartControl productId={product.id} type="food" size="outline" product={product} />
        <Text style={styles.pastCustomisable}>Customisable</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 32,
  },
  errorWrap: {
    padding: 16,
  },
  coverSkeleton: {
    height: COVER_HEIGHT,
    backgroundColor: colors.neutral[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverWrap: {
    width: '100%',
    height: COVER_HEIGHT,
    position: 'relative',
    backgroundColor: colors.ink[900],
  },
  coverImg: {
    width: '100%',
    height: '100%',
  },
  coverScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  coverActions: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  overlayRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  overlayBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(16,14,10,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    backgroundColor: colors.food[600],
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayBadgeText: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 10,
    color: '#fff',
  },
  // Stage B compact header (pinned overlay). The status-bar inset is applied as
  // top padding here (mirroring the Food home's pinned search row), NOT baked
  // into a taller centred row: centring the controls inside `insets.top + row`
  // pushes them up and splits the inset above and below them, which leaves an
  // oversized blank band between the header and the docked filter chips. The
  // total height (`insets.top + COMPACT_ROW_H` + bottom border) is what the
  // sticky filter row reserves, so the two never overlap and nothing shows
  // through.
  compactHeader: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
    shadowColor: '#100e0a',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingBottom: COMPACT_PAD_BOTTOM,
  },
  compactName: {
    fontFamily: 'Outfit_800ExtraBold',
    flex: 1,
    minWidth: 0,
    fontSize: 16,
    color: colors.ink[900],
    letterSpacing: -0.3,
  },
  compactActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  compactBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelTop: {
    marginTop: -PANEL_OVERLAP,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
  },
  name: {
    /* Zomato's restaurant title is extrabold display type (text-3xl
       font-extrabold in the reference), so the name carries the page. */
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 26,
    color: colors.ink[900],
    letterSpacing: -0.5,
  },
  cuisine: {
    fontFamily: 'Outfit_500Medium',
    marginTop: 2,
    fontSize: 13,
    color: colors.neutral[500],
  },
  chipRow: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  ratingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.zGreen,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  ratingChipText: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 12,
    color: '#fff',
  },
  chipText: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 13,
    color: colors.neutral[400],
  },
  chipDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.neutral[300],
  },
  chipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  minOrder: {
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  minOrderText: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 12,
    color: colors.neutral[500],
  },
  addressRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
  },
  addressText: {
    fontFamily: 'Outfit_400Regular',
    flex: 1,
    fontSize: 13,
    color: colors.neutral[500],
  },
  freeStrip: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(226,50,66,0.10)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  freeStripText: {
    fontFamily: 'Outfit_600SemiBold',
    flex: 1,
    fontSize: 13,
    color: colors.food[700],
  },
  badgeRow: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  serviceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  serviceBadgeText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 12,
    color: colors.neutral[700],
  },
  vegBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.zGreenSoft,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  vegBadgeText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 12,
    color: colors.zGreen,
  },
  nameRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  ratingBlock: {
    alignItems: 'center',
    gap: 4,
  },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.zGreen,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  ratingPillNew: {
    backgroundColor: colors.neutral[500],
  },
  ratingPillText: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 14,
    color: '#fff',
  },
  byCount: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 11,
    color: colors.neutral[500],
    textDecorationLine: 'underline',
  },
  locationRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  locationText: {
    flex: 1,
    fontFamily: 'Outfit_500Medium',
    fontSize: 14,
    color: colors.neutral[500],
  },
  etaRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  etaText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 14,
    color: colors.ink[900],
  },
  reorderCheck: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 12,
    color: colors.zGreen,
  },
  offerStrip: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.zInfoSoft,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  offerStripText: {
    fontFamily: 'Outfit_600SemiBold',
    flex: 1,
    fontSize: 13,
    color: colors.ink[900],
  },
  greyBand: {
    marginTop: 14,
    marginHorizontal: -16,
    height: 8,
    backgroundColor: colors.neutral[100],
  },
  sectionHeadBtn: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionSub: {
    marginTop: 2,
    fontFamily: 'Outfit_400Regular',
    fontSize: 13,
    color: colors.neutral[500],
  },
  chevRot: {
    transform: [{ rotate: '180deg' }],
  },
  rail: {
    gap: 12,
    paddingVertical: 12,
    paddingRight: 16,
  },
  railCard: {
    width: 170,
  },
  railImgWrap: {
    width: 170,
    height: 128,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.neutral[100],
  },
  railImg: {
    width: '100%',
    height: '100%',
  },
  railDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(16,14,10,0.45)',
  },
  railAdd: {
    position: 'absolute',
    right: 8,
    bottom: 8,
  },
  railName: {
    marginTop: 6,
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 13,
    color: colors.ink[900],
  },
  railPrice: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 13,
    color: colors.ink[900],
  },
  pastRow: {
    flexDirection: 'row',
    gap: 14,
    paddingVertical: 14,
    alignItems: 'flex-start',
  },
  pastThumb: {
    width: 64,
    height: 64,
  },
  pastThumbImg: {
    width: 64,
    height: 64,
    borderRadius: 16,
  },
  vegMark: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 2,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pastName: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 15,
    color: colors.ink[900],
  },
  pastPriceRow: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  pastPrice: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 14,
    color: colors.ink[900],
  },
  pastCompare: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 13,
    color: colors.neutral[400],
    textDecorationLine: 'line-through',
  },
  pastOff: {
    marginTop: 2,
    fontFamily: 'Outfit_700Bold',
    fontSize: 13,
    color: colors.zInfo,
  },
  pastCaption: {
    marginTop: 4,
    fontFamily: 'Outfit_400Regular',
    fontSize: 13,
    color: colors.neutral[500],
  },
  pastActions: {
    alignItems: 'center',
    gap: 4,
    alignSelf: 'center',
  },
  pastCustomisable: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 10,
    textTransform: 'uppercase',
    color: colors.neutral[400],
    textAlign: 'center',
  },
  // Docked filter row: solid full-width backing so menu rows scroll under it.
  filterBar: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.neutral[100],
    backgroundColor: '#fff',
    gap: 8,
  },
  filterChips: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  filterChipText: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 12,
    color: colors.neutral[500],
  },
  catChips: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  catChip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  catChipActive: {
    borderBottomColor: colors.food[600],
  },
  catChipText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 13,
    color: colors.neutral[500],
  },
  catChipTextActive: {
    color: colors.food[700],
  },
  menuWrap: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 24,
  },
  section: {
    marginTop: 4,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
    paddingVertical: 12,
  },
  sectionTitle: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 17,
    color: colors.ink[900],
  },
  sectionCount: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 12,
    color: colors.neutral[400],
  },
  divider: {
    height: 1,
    backgroundColor: colors.neutral[100],
  },
  noMatch: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  noMatchText: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 14,
    color: colors.neutral[500],
  },
  menuBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 6,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  menuSearch: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.ink[50],
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  menuInput: {
    fontFamily: 'Outfit_400Regular',
    flex: 1,
    fontSize: 14,
    color: colors.ink[900],
    paddingVertical: 10,
  },
  menuBtn: {
    backgroundColor: colors.food[600],
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  menuBtnText: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 12,
    color: '#fff',
  },
});
