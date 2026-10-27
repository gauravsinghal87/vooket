import React, { useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
  type AccessibilityState,
  type LayoutChangeEvent,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  ArrowDownWideNarrow,
  BadgePercent,
  Bookmark,
  Car as CarIcon,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  IndianRupee,
  ShieldCheck,
  ShoppingBasket as ShoppingBasketIcon,
  SlidersHorizontal,
  Star,
  TicketPercent,
  Timer,
  UtensilsCrossed,
  Zap,
} from 'lucide-react-native';
import type { Banner, Category, Offer, Product, Restaurant } from '@/types/catalog';
import { discountPercent, formatCurrency } from '@/lib/utils';
import { deliveryEtaText } from '@/lib/deliveryEta';
import { carryProduct } from '@/lib/routeState';
import { bannerRoute } from '@/lib/banner';
import { serviceTheme, SERVICE_ROUTES, colors, featured, notch } from '@/theme';
import type { ServiceType } from '@/theme';
import { ProductImage } from '@/components/ui/ProductImage';
import { VegMark } from '@/components/ui/primitives';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { AddToCartControl } from '@/components/product/AddToCart';
import { NotchRestaurantCard } from '@/components/restaurant/NotchRestaurantCard';
import { FeaturedRestaurantCard } from '@/components/restaurant/FeaturedRestaurantCard';
import { restaurantOffer, restaurantRating } from '@/components/restaurant/restaurantCardParts';
import { useToastStore } from '@/stores/toastStore';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CONTENT_PAD = 16;
const HERO_WIDTH = SCREEN_WIDTH - CONTENT_PAD * 2;
const HERO_HEIGHT = Math.round(HERO_WIDTH * (9 / 16));

const DISH_CARD_WIDTH = 172;
const PROMO_CARD_WIDTH = 248;

/** Bundled "All" category artwork (transparent PNG, shown without a disc). */
const ALL_CATEGORY_IMG = require('../../assets/images/all-category.png');

/* Recommended rail: a horizontally clipped grid. Roughly two cards are fully
   visible on a phone with the third clipped at the right edge; the card width
   is derived from the screen width (never a fixed pixel value) and the grid
   wraps into rows that scroll vertically with the page. */
const GRID_PAD = CONTENT_PAD;
const GRID_GAP = 10;
const RECOMMENDED_VISIBLE = 2.5;
const RECOMMENDED_SKELETON_COLUMNS = 3;
export const RECOMMENDED_CARD_WIDTH =
  (SCREEN_WIDTH - GRID_PAD * 2 - GRID_GAP * 2) / RECOMMENDED_VISIBLE;

/* ------------------------------------------------------------------ */
/* Food hero carousel — dedicated food_home_hero placement            */
/* ------------------------------------------------------------------ */

export function FoodHeroCarousel({ banners }: { banners: Banner[] }) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const width = useRef(0);

  useEffect(() => {
    if (banners.length <= 1) return;
    setIndex(0);
    const timer = setInterval(() => {
      setIndex((prev) => {
        const next = (prev + 1) % banners.length;
        if (width.current > 0) scrollRef.current?.scrollTo({ x: next * width.current, animated: true });
        return next;
      });
    }, 4500);
    return () => clearInterval(timer);
  }, [banners.length]);

  if (banners.length === 0) return null;

  return (
    <View>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onLayout={(e) => (width.current = e.nativeEvent.layout.width)}
        onMomentumScrollEnd={(e) =>
          setIndex(Math.round(e.nativeEvent.contentOffset.x / e.nativeEvent.layoutMeasurement.width))
        }
      >
        {banners.map((b) => (
          <View key={b.id} style={{ width: HERO_WIDTH }}>
            <Pressable
              onPress={() => router.push(bannerRoute(b) as never)}
              style={({ pressed }) => [styles.heroSlide, pressed && { opacity: 0.94 }]}
            >
              <ProductImage src={b.image} style={styles.heroImg} rounded={false} />
              <View style={styles.heroShade} />
              <View style={styles.heroCopy}>
                {b.cta_text ? (
                  <View style={styles.heroCta}>
                    <Text style={styles.heroCtaText}>{b.cta_text}</Text>
                  </View>
                ) : null}
                <Text style={styles.heroTitle}>{b.title}</Text>
                {b.subtitle ? <Text style={styles.heroSubtitle} numberOfLines={2}>{b.subtitle}</Text> : null}
              </View>
            </Pressable>
          </View>
        ))}
      </ScrollView>

      {banners.length > 1 && (
        <View style={styles.dots}>
          {banners.map((_, i) => (
            <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
      )}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Food categories rail                                                */
/* ------------------------------------------------------------------ */

/**
 * Category chips live inside the Food home's native sticky header
 * (`stickyHeaderIndices`), which React Native repositions with a native-driver
 * `translateY` once it docks. React Native's `Pressable`/`Touchable` are built
 * on `Pressability`, which measures the responder region through the *shadow
 * tree* (`UIManager.measure`/`node.measure`). That measurement reports the
 * pre-transform (un-docked) position, so while the header is docked the press
 * region is wrong: a real tap always jitters at least a pixel, which
 * `Pressability` reads as leaving the press rect and cancels — so the chip works
 * before the header docks and goes dead once it is docked (New Architecture
 * only). Upstream fixes this by measuring the native view hierarchy
 * (`measureAsyncOnUI`, facebook/react-native#51835), which is not in RN 0.81.
 *
 * `measure()` is used only by `Pressability`, so driving the press with plain
 * responder events — which need no measurement — keeps taps working in both the
 * in-flow and docked states, with no second instance and the same `onPress`
 * wiring. `onResponderTerminationRequest` lets the surrounding ScrollViews take
 * over during a scroll, so a swipe never fires a navigation.
 */
function CategoryPressable({
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
  children: React.ReactNode;
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
    <CategoryPressable
      onPress={onSelect}
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [styles.catChip, pressed && { opacity: 0.9 }]}
      accessibilityLabel={`${name} food`}
    >
      {/* Borderless category artwork: the PNG sits directly on the surface with
          no disc or ring, so its own shading reads as a floating 3D object —
          as in the reference. `contain` preserves the image's proportions. */}
      <View style={[styles.catImgWrap, active && styles.catImgWrapActive]}>
        <ProductImage src={image} style={styles.catImg} rounded={false} resizeMode="contain" />
      </View>
      <Text style={[styles.catName, active && styles.catNameActive]} numberOfLines={1}>
        {name}
      </Text>
      <View style={[styles.catUnderline, active && styles.catUnderlineActive]} />
    </CategoryPressable>
  );
}

export function FoodCategories({
  categories,
  loading,
  selectedId,
  onSelect,
}: {
  categories: Category[];
  loading?: boolean;
  /** Currently selected category ID; `null` means "All". */
  selectedId: number | null;
  onSelect: (categoryId: number | null) => void;
}) {
  if (loading) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catRailPad}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <View key={i} style={[styles.catChip, { flexDirection: 'column' }]}>
            <View style={styles.skeletonCat} />
            <View style={styles.skeletonCatLabel} />
            <View style={styles.catUnderline} />
          </View>
        ))}
      </ScrollView>
    );
  }

  if (categories.length === 0) return null;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catRailPad}>
      <CategoryPressable
        onPress={() => onSelect(null)}
        accessibilityState={{ selected: selectedId === null }}
        style={({ pressed }) => [styles.catChip, pressed && { opacity: 0.9 }]}
        accessibilityLabel="All restaurants"
      >
        <View style={[styles.catImgWrapAll, selectedId === null && styles.catImgWrapActive]}>
          <Image source={ALL_CATEGORY_IMG} style={styles.catImgAll} resizeMode="contain" />
        </View>
        <Text style={[styles.catName, selectedId === null && styles.catNameActive]} numberOfLines={1}>
          All
        </Text>
        <View style={[styles.catUnderline, selectedId === null && styles.catUnderlineActive]} />
      </CategoryPressable>
      {categories.map((c) => (
        <CategoryChip
          key={c.id}
          name={c.name}
          image={c.image}
          active={selectedId === c.id}
          onSelect={() => onSelect(c.id)}
        />
      ))}
    </ScrollView>
  );
}

/* ------------------------------------------------------------------ */
/* Promo rail (web PromoRail port)                                     */
/* ------------------------------------------------------------------ */

const SERVICE_ICONS: Record<ServiceType, React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>> = {
  food: UtensilsCrossed,
  grocery: ShoppingBasketIcon,
  rides: CarIcon,
};

export function FoodPromoRail({ promos }: { promos: Offer[] }) {
  const router = useRouter();
  const showToast = useToastStore((s) => s.showToast);

  if (promos.length === 0) return null;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.railPad}>
      {promos.map((offer) => {
        const theme = serviceTheme(offer.service);
        const Icon = SERVICE_ICONS[offer.service];
        return (
          <Pressable
            key={offer.id}
            onPress={() => {
              if (offer.code) showToast(`Code ${offer.code} copied to clipboard`, 'success');
              else router.push(SERVICE_ROUTES[offer.service] as never);
            }}
            style={({ pressed }) => [styles.promoCard, pressed && styles.promoCardPressed]}
            accessibilityLabel={offer.title}
          >
            <View style={[styles.promoAccent, { backgroundColor: theme.solid }]} />
            <View style={styles.promoIconRow}>
              <View style={[styles.promoIcon, { backgroundColor: theme.soft }]}>
                <Icon size={16} color={theme.strong} strokeWidth={2.2} />
              </View>
              {offer.tag ? (
                <View style={[styles.promoTag, { backgroundColor: theme.soft }]}>
                  <Text style={[styles.promoTagText, { color: theme.strong }]}>{offer.tag}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.promoTitle}>{offer.title}</Text>
            {offer.subtitle ? <Text style={styles.promoSubtitle} numberOfLines={2}>{offer.subtitle}</Text> : null}
            <View style={styles.promoFoot}>
              {offer.code ? (
                <>
                  <Copy size={12} color={colors.neutral[400]} />
                  <View style={styles.promoCode}>
                    <Text style={styles.promoCodeText}>{offer.code}</Text>
                  </View>
                </>
              ) : (
                <View style={styles.promoExplore}>
                  <TicketPercent size={14} color={colors.food[600]} />
                  <Text style={styles.promoExploreText}>Tap to explore</Text>
                </View>
              )}
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/* ------------------------------------------------------------------ */
/* Filter chips                                                       */
/* ------------------------------------------------------------------ */

export function FoodFilterChips({
  filters,
  onChange,
  onOpenFilters,
}: {
  filters: FoodFilters;
  onChange: (next: FoodFilters) => void;
  onOpenFilters: () => void;
}) {
  const count = activeFoodFilterCount(filters);
  const quick: { key: string; label: string; active: boolean; toggle: () => void }[] = [
    {
      key: 'rating',
      label: 'Top rated',
      active: filters.sort === 'rating',
      toggle: () => onChange({ ...filters, sort: filters.sort === 'rating' ? 'recommended' : 'rating' }),
    },
    {
      key: 'fast',
      label: 'Fastest delivery',
      active: filters.sort === 'fast',
      toggle: () => onChange({ ...filters, sort: filters.sort === 'fast' ? 'recommended' : 'fast' }),
    },
    {
      key: 'offers',
      label: 'Free delivery',
      active: filters.freeDelivery,
      toggle: () => onChange({ ...filters, freeDelivery: !filters.freeDelivery }),
    },
    {
      key: 'veg',
      label: 'Pure veg',
      active: filters.veg,
      toggle: () => onChange({ ...filters, veg: !filters.veg }),
    },
  ];

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
      <Pressable
        onPress={onOpenFilters}
        accessibilityRole="button"
        accessibilityLabel={count > 0 ? `Filters, ${count} active` : 'Filters'}
        style={[styles.filterChip, styles.filterButton, count > 0 ? styles.filterChipActive : styles.filterChipIdle]}
      >
        <SlidersHorizontal size={14} color={count > 0 ? colors.food[700] : colors.neutral[700]} strokeWidth={2.4} />
        <Text style={[styles.filterChipText, count > 0 && styles.filterChipTextActive]}>
          {count > 0 ? `Filters (${count})` : 'Filters'}
        </Text>
        <ChevronDown size={14} color={count > 0 ? colors.food[700] : colors.neutral[700]} strokeWidth={2.4} />
      </Pressable>

      <View style={styles.filterDivider} />

      {quick.map((q) => (
        <Pressable
          key={q.key}
          onPress={q.toggle}
          accessibilityState={{ selected: q.active }}
          style={[styles.filterChip, q.active ? styles.filterChipActive : styles.filterChipIdle]}
        >
          <Text style={[styles.filterChipText, q.active && styles.filterChipTextActive]}>{q.label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.filterSection}>
      <Text style={styles.filterSectionTitle}>{title}</Text>
      <View style={styles.filterSectionPanel}>{children}</View>
    </View>
  );
}

/** One selectable option tile: white card, glyph left, red radio hard right. */
function OptionTile({
  active,
  onPress,
  label,
  icon,
}: {
  active: boolean;
  onPress: () => void;
  label: string;
  icon?: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityState={{ selected: active }}
      style={[styles.optTile, active && styles.optTileOn]}
    >
      <View style={styles.optTileLabelRow}>
        {icon ? <View style={styles.optTileIcon}>{icon}</View> : null}
        <Text style={[styles.optTileLabel, active && styles.optTileLabelOn]} numberOfLines={2}>
          {label}
        </Text>
      </View>
      <View style={[styles.optRadio, active && styles.optRadioOn]}>
        {active ? <View style={styles.optRadioDot} /> : null}
      </View>
    </Pressable>
  );
}

const SORT_OPTIONS: { id: FoodSortId; label: string }[] = [
  { id: 'recommended', label: 'Relevance' },
  { id: 'rating', label: 'Rating: high to low' },
  { id: 'fast', label: 'Delivery time' },
];

const TIME_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: 'Any time' },
  { value: 30, label: 'Under 30 mins' },
  { value: 45, label: 'Under 45 mins' },
];

const RATING_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: 'Any' },
  { value: 3.5, label: 'Rated 3.5+' },
  { value: 4, label: 'Rated 4.0+' },
  { value: 4.5, label: 'Rated 4.5+' },
];

/** Section ids in visual order — the rail scrolls the right pane to them. */
const FILTER_TABS = [
  { id: 'sort', label: 'Sort By', Icon: ArrowDownWideNarrow },
  { id: 'time', label: 'Time', Icon: Timer },
  { id: 'rating', label: 'Rating', Icon: Star },
  { id: 'offers', label: 'Offers', Icon: BadgePercent },
  { id: 'price', label: 'Dish Price', Icon: IndianRupee },
  { id: 'trust', label: 'Trust Markers', Icon: ShieldCheck },
  { id: 'collections', label: 'Collections', Icon: Bookmark },
] as const;

/** Height of the two-pane body: bounded so the sheet never covers the screen. */
const FILTER_PANE_H = Math.max(380, Math.min(560, Math.round(Dimensions.get('window').height * 0.6)));

/**
 * Zomato's "Filters and sorting" sheet (native port): a vertical tab rail on
 * the left and one scrolling column of grouped option cards on the right.
 * Tapping a rail tab scrolls the column to that section, and the rail marks the
 * section in view while scrolling. Edits happen on a draft copy — `Close`
 * discards, `Show results` commits, and it stays disabled until something is
 * selected, exactly like the reference.
 */
export function FoodFilterSheet({
  visible,
  onClose,
  filters,
  onApply,
}: {
  visible: boolean;
  onClose: () => void;
  filters: FoodFilters;
  onApply: (next: FoodFilters) => void;
}) {
  const [draft, setDraft] = useState<FoodFilters>(filters);
  const [activeTab, setActiveTab] = useState<string>('sort');
  const scrollRef = useRef<ScrollView>(null);
  const offsets = useRef<Record<string, number>>({});

  useEffect(() => {
    if (visible) {
      setDraft(filters);
      setActiveTab('sort');
      scrollRef.current?.scrollTo({ y: 0 });
    }
  }, [visible, filters]);

  const count = activeFoodFilterCount(draft);

  const scrollToTab = (id: string) => {
    setActiveTab(id);
    scrollRef.current?.scrollTo({ y: offsets.current[id] ?? 0, animated: true });
  };

  const onScroll = (e: { nativeEvent: { contentOffset: { y: number } } }) => {
    const y = e.nativeEvent.contentOffset.y + 12;
    let current: string = FILTER_TABS[0].id;
    for (const tab of FILTER_TABS) {
      if ((offsets.current[tab.id] ?? 0) <= y) current = tab.id;
    }
    if (current !== activeTab) setActiveTab(current);
  };

  const sectionProps = (id: string) => ({
    onLayout: (e: LayoutChangeEvent) => {
      offsets.current[id] = e.nativeEvent.layout.y;
    },
  });

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Filters and sorting"
      maxHeight="94%"
      headerRight={
        <Pressable
          onPress={() => setDraft(DEFAULT_FOOD_FILTERS)}
          disabled={count === 0}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Clear all filters"
          style={styles.clearAll}
        >
          <Text style={[styles.clearAllText, count === 0 && styles.clearAllTextDisabled]}>Clear all</Text>
        </Pressable>
      }
      footer={
        <View style={styles.sheetFooter}>
          <Pressable onPress={onClose} style={[styles.sheetBtn, styles.sheetBtnGhost]} accessibilityRole="button">
            <Text style={styles.sheetBtnGhostText}>Close</Text>
          </Pressable>
          <Pressable
            onPress={() => count > 0 && onApply(draft)}
            disabled={count === 0}
            style={[styles.sheetBtn, styles.sheetBtnPrimary, count === 0 && styles.sheetBtnPrimaryOff]}
            accessibilityRole="button"
          >
            <Text style={[styles.sheetBtnPrimaryText, count === 0 && styles.sheetBtnPrimaryOffText]}>
              {count > 0 ? `Show results (${count})` : 'Show results'}
            </Text>
          </Pressable>
        </View>
      }
    >
      <View style={styles.filterPanes}>
        {/* The rail: icon over label, red rule on the active tab. */}
        <View style={styles.rail}>
          {FILTER_TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <Pressable
                key={tab.id}
                onPress={() => scrollToTab(tab.id)}
                accessibilityState={{ selected: active }}
                style={[styles.railTab, active && styles.railTabOn]}
              >
                <tab.Icon size={18} color={active ? colors.food[600] : colors.neutral[500]} />
                <Text style={[styles.railTabText, active && styles.railTabTextOn]} numberOfLines={2}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* One continuously scrolling column of grouped option cards. */}
        <ScrollView
          ref={scrollRef}
          style={styles.paneScroll}
          contentContainerStyle={styles.paneScrollContent}
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={32}
        >
          <View {...sectionProps('sort')}>
            <View style={styles.sortHeaderRow}>
              <Text style={styles.sortHeaderTitle}>Sort by</Text>
              <Text style={styles.sortHeaderValue}>
                {SORT_OPTIONS.find((o) => o.id === draft.sort)?.label ?? 'Relevance'}
              </Text>
            </View>
            <View style={styles.filterSectionPanel}>
              {SORT_OPTIONS.map((o) => (
                <OptionTile
                  key={o.id}
                  active={draft.sort === o.id}
                  onPress={() => setDraft((d) => ({ ...d, sort: o.id }))}
                  label={o.label}
                />
              ))}
            </View>
          </View>

          <View {...sectionProps('time')}>
            <FilterSection title="Time">
              {TIME_OPTIONS.map((o) => (
                <OptionTile
                  key={String(o.value)}
                  active={draft.maxDelivery === o.value}
                  onPress={() => setDraft((d) => ({ ...d, maxDelivery: o.value }))}
                  label={o.label}
                  icon={<Timer size={16} color={colors.neutral[700]} />}
                />
              ))}
            </FilterSection>
          </View>

          <View {...sectionProps('rating')}>
            <FilterSection title="Restaurant Rating">
              {RATING_OPTIONS.map((o) => (
                <OptionTile
                  key={String(o.value)}
                  active={draft.minRating === o.value}
                  onPress={() => setDraft((d) => ({ ...d, minRating: o.value }))}
                  label={o.label}
                  icon={<Star size={16} color={colors.zGreen} />}
                />
              ))}
            </FilterSection>
          </View>

          <View {...sectionProps('offers')}>
            <FilterSection title="Offers">
              <OptionTile
                active={draft.freeDelivery}
                onPress={() => setDraft((d) => ({ ...d, freeDelivery: !d.freeDelivery }))}
                label="Free delivery"
                icon={<BadgePercent size={16} color={colors.neutral[700]} />}
              />
              <OptionTile
                active={draft.featured}
                onPress={() => setDraft((d) => ({ ...d, featured: !d.featured }))}
                label="Deals of the Day"
                icon={<BadgePercent size={16} color={colors.neutral[700]} />}
              />
            </FilterSection>
          </View>

          <View {...sectionProps('price')}>
            <FilterSection title="Dish Price">
              {DISH_PRICE_BANDS.map((band) => (
                <OptionTile
                  key={band.id}
                  active={draft.dishPrice === band.id}
                  onPress={() =>
                    setDraft((d) => ({ ...d, dishPrice: d.dishPrice === band.id ? null : band.id }))
                  }
                  label={band.label}
                  icon={<Text style={styles.rupeeSymbols}>{band.symbols}</Text>}
                />
              ))}
            </FilterSection>
          </View>

          <View {...sectionProps('trust')}>
            <FilterSection title="Trust Markers">
              <OptionTile
                active={draft.halal}
                onPress={() => setDraft((d) => ({ ...d, halal: !d.halal }))}
                label="Halal"
                icon={<ShieldCheck size={16} color={colors.neutral[700]} />}
              />
              <OptionTile
                active={draft.dineIn}
                onPress={() => setDraft((d) => ({ ...d, dineIn: !d.dineIn }))}
                label="Dine-in"
                icon={<ShieldCheck size={16} color={colors.neutral[700]} />}
              />
              <OptionTile
                active={draft.veg}
                onPress={() => setDraft((d) => ({ ...d, veg: !d.veg }))}
                label="Pure veg only"
                icon={<ShieldCheck size={16} color={colors.neutral[700]} />}
              />
            </FilterSection>
          </View>

          <View {...sectionProps('collections')}>
            <FilterSection title="Collections">
              <OptionTile
                active={draft.featured}
                onPress={() => setDraft((d) => ({ ...d, featured: !d.featured }))}
                label="Featured kitchens"
                icon={<Bookmark size={16} color={colors.neutral[700]} />}
              />
            </FilterSection>
          </View>
        </ScrollView>
      </View>
    </BottomSheet>
  );
}

/* ------------------------------------------------------------------ */
/* Veg Mode toggle (web VegModeToggle port)                            */
/* ------------------------------------------------------------------ */

/**
 * Food "Veg Mode" control. Sits beside the sticky search field and is a real
 * filter: turning it on narrows the Food home's recommendations and restaurant
 * feed to pure-veg kitchens (`is_veg`), using the same predicate as the "Pure
 * veg" filter chip. The green treatment mirrors the veg mark used across the
 * app so the control reads as "vegetarian only" at a glance.
 */
export function VegModeToggle({
  enabled,
  onChange,
  onDark = false,
}: {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  /** Lay the label/track out for the dark Food hero instead of the light page. */
  onDark?: boolean;
}) {
  return (
    <Pressable
      onPress={() => onChange(!enabled)}
      accessibilityRole="switch"
      accessibilityState={{ checked: enabled }}
      accessibilityLabel="Veg Mode — show pure veg restaurants only"
      style={({ pressed }) => [styles.vegToggle, pressed && { opacity: 0.9 }]}
    >

      <Text style={[styles.vegToggleText, onDark && styles.vegToggleTextOnDark]} numberOfLines={1}>
        VEG
      </Text>
      <Text style={[styles.vegModeToggleText, onDark && styles.vegToggleTextOnDark]} numberOfLines={1}>
        MODE
      </Text>
      <View style={[styles.vegTrack, enabled ? styles.vegTrackOn : onDark ? styles.vegTrackOffDark : styles.vegTrackOff]}>
        <View style={[styles.vegThumb, enabled ? styles.vegThumbOn : styles.vegThumbOff]} />
      </View>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/* Popular dishes / deals horizontal card                              */
/* ------------------------------------------------------------------ */

export function FoodDishCard({ product }: { product: Product }) {
  const router = useRouter();
  const off = discountPercent(product);
  const soldOut = !product.is_available;
  const compare = product.compare_at_price ? parseFloat(product.compare_at_price) : null;
  const price = parseFloat(product.price);

  const goProduct = () => {
    carryProduct(product, 'food');
    router.push(`/product/${product.id}?service=food` as never);
  };

  return (
    <Pressable
      onPress={goProduct}
      style={({ pressed }) => [styles.dishCard, pressed && { opacity: 0.94 }]}
      accessibilityLabel={product.name}
    >
      <View style={styles.dishImgWrap}>
        <ProductImage src={product.image} style={styles.dishImg} rounded={false} />
        {off !== null && !soldOut && (
          <View style={styles.dishOffBadge}>
            <Text style={styles.dishOffText}>{off}% off</Text>
          </View>
        )}
        {soldOut && (
          <View style={styles.dishSoldOut}>
            <Text style={styles.dishSoldOutText}>Sold out</Text>
          </View>
        )}
      </View>

      <View style={styles.dishBody}>
        <Text style={styles.dishName} numberOfLines={2}>
          {product.name}
        </Text>

        <View style={styles.dishMetaRow}>
          <Text style={styles.dishUnit}>
            {product.unit_label ?? (product.is_available ? 'Available' : 'Out of stock')}
          </Text>
          {product.is_veg !== null && <VegMark isVeg={product.is_veg} size={11} />}
          {!soldOut && product.is_available && (
            <View style={styles.dishStock}>
              <Star size={10} color={colors.warning} fill={colors.warning} strokeWidth={0} />
              <Text style={styles.dishStockText}>In stock</Text>
            </View>
          )}
        </View>

        <View style={styles.dishPriceRow}>
          <View style={styles.dishPrices}>
            <Text style={styles.dishPrice}>{formatCurrency(price)}</Text>
            {compare && compare > price && (
              <Text style={styles.dishCompare}>₹{compare.toLocaleString('en-IN')}</Text>
            )}
          </View>
          <View style={styles.dishAdd}>
            <AddToCartControl productId={product.id} type="food" size="icon" product={product} />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/* Recommended carousel: horizontally scrolling two-row (column pairs) */
/* ------------------------------------------------------------------ */

// Restaurants are grouped into columns of two (1&2, 3&4, …) so the rail is
// exactly two rows tall and scrolls sideways; an odd count leaves the last
// column half-full instead of spilling into a third row.
function toRecommendationColumns(items: Restaurant[]): Restaurant[][] {
  const columns: Restaurant[][] = [];
  for (let i = 0; i < items.length; i += 2) columns.push(items.slice(i, i + 2));
  return columns;
}

export function FoodRecommendedCarousel({
  restaurants,
  distanceFor,
}: {
  restaurants: Restaurant[];
  distanceFor: (restaurant: Restaurant) => number | null;
}) {
  const columns = toRecommendationColumns(restaurants);

  // One horizontal ScrollView holds every column; each column stacks two cards
  // vertically. The rail is sized to two rows only, so it scrolls horizontally
  // (no third row) while the page keeps scrolling vertically. Single horizontal
  // scroller — no nested competing rails.
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.recScroll}
      nestedScrollEnabled
      decelerationRate="fast"
    >
      <View style={styles.recRows}>
        {columns.map((column, index) => (
          <View key={index} style={styles.recColumn}>
            {column.map((restaurant) => (
              <FoodRestaurantCard
                key={restaurant.id}
                restaurant={restaurant}
                distanceKm={distanceFor(restaurant)}
                style={styles.recCardWidth}
              />
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

/* ------------------------------------------------------------------ */
/* Recommended card (compact, image-first)                             */
/* ------------------------------------------------------------------ */

/**
 * The card used by the recommendation rail.
 *
 * It is the shared "notch" card at its compact size: a photo with rounded top
 * corners, a green rating pill in the white notch cut into the bottom-left of
 * the photo, and the name plus the delivery estimate on the page background
 * underneath.
 */
export function FoodRestaurantCard({
  restaurant,
  style,
  distanceKm,
}: {
  restaurant: Restaurant;
  style?: StyleProp<ViewStyle>;
  distanceKm?: number | null;
}) {
  return (
    <NotchRestaurantCard
      restaurant={restaurant}
      distanceKm={distanceKm}
      size="sm"
      style={style}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Restaurant list card (full-width image-led "delivering to you")     */
/* ------------------------------------------------------------------ */

/**
 * The card used by the Food restaurant feed ("restaurants delivering to
 * you").
 *
 * These are the large, single, full-width cards: a 5:3 photo with rounded
 * corners, the dish/offer badge at the top-left and — in the white panel
 * underneath — the name in large bold type, the green pill rating hard right,
 * the ETA | distance line and the blue-icon offer row.
 *
 * There is deliberately no notch on this layout: the notched design belongs
 * to the compact grid card (`NotchRestaurantCard`).
 */
export function FoodRestaurantListCard({
  restaurant,
  distanceKm,
}: {
  restaurant: Restaurant;
  distanceKm?: number | null;
}) {
  return <FeaturedRestaurantCard restaurant={restaurant} distanceKm={distanceKm} />;
}

/* ------------------------------------------------------------------ */
/* Hero tiles — the reference's promo tiles overlapping the hero base   */
/* ------------------------------------------------------------------ */

/**
 * The promotional tiles that sit at the lower edge of the Food hero (the
 * reference's "Mithai Hamper" row).
 *
 * Sources, in priority order, both real:
 *  1. The active hero banner — the tile opens it through `bannerRoute`.
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
  const router = useRouter();

  const tiles: { key: string; label: string; image: string | null; onPress: () => void }[] = [];

  if (banner) {
    tiles.push({
      key: `banner-${banner.id}`,
      label: banner.title,
      image: banner.poster_image ?? banner.image,
      onPress: () => router.push(bannerRoute(banner) as never),
    });
  }

  for (const c of categories.slice(0, banner ? 3 : 4)) {
    tiles.push({
      key: `cat-${c.id}`,
      label: c.name,
      image: c.image,
      onPress: () => onSelectCategory?.(c.id),
    });
  }

  if (tiles.length === 0) return null;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tileRow}>
      {tiles.map((tile) => (
        <Pressable
          key={tile.key}
          onPress={tile.onPress}
          style={({ pressed }) => [styles.tile, pressed && { opacity: 0.85 }]}
          accessibilityLabel={tile.label}
        >
          <View style={styles.tileDisc}>
            {tile.image ? (
              <ProductImage src={tile.image} style={styles.tileImg} rounded={false} />
            ) : null}
          </View>
          <Text style={styles.tileLabel} numberOfLines={2}>
            {tile.label}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

/* ------------------------------------------------------------------ */
/* Plain food-feed section title (reference caption style)             */
/* ------------------------------------------------------------------ */

/**
 * The reference's food-feed section caption: a small, wide-tracked, muted
 * uppercase line ("RECOMMENDED FOR YOU", "IN THE SPOTLIGHT", "EXPLORE
 * MORE", "… RESTAURANTS DELIVERING TO YOU") with an optional soft subtitle.
 * Deliberately no "See all" action — the reference has none here.
 */
export function FoodSectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View>
      <Text style={styles.feedTitle}>{title}</Text>
      {subtitle ? <Text style={styles.feedSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* IN THE SPOTLIGHT — wide promo card carousel                        */
/* ------------------------------------------------------------------ */

/**
 * Compose the reference's red offer line ("₹80 OFF above ₹149 ›") from the
 * offer's real fields. `flat` → "₹N OFF", `percentage` → "N% OFF", and
 * `min_order` appends the threshold. Returns null when the offer carries
 * neither a value nor a minimum (nothing to say), so no copy is invented.
 */
export function spotLightOfferLine(offer: Offer): string | null {
  const value = offer.value ?? null;
  const min = offer.min_order ? parseFloat(offer.min_order) : null;
  let head: string | null = null;
  if (value !== null && offer.type === 'percentage') head = `${value}% OFF`;
  else if (value !== null && offer.type === 'flat') head = `₹${value} OFF`;
  if (head && min !== null && Number.isFinite(min) && min > 0) {
    return `${head} above ₹${min.toLocaleString('en-IN')}`;
  }
  return head;
}

const SPOT_CARD_WIDTH = SCREEN_WIDTH - CONTENT_PAD * 2;
const SPOT_STRIDE = SPOT_CARD_WIDTH + 12;

/**
 * The "IN THE SPOTLIGHT" block — the reference's full-width promo card
 * carousel: a wide, softly tinted card with the offer title in large bold
 * type, a muted subtitle, the red offer line, a circular badge on the right
 * (the reference shows the brand logo there; Vooket offers carry no artwork,
 * so the service-tinted ticket badge stands in), and page dots below that
 * track the scroll position.
 *
 * Taps keep the existing behavior: offers with a code show the copy toast,
 * offers without one navigate to their service home. Data comes straight
 * from the Food home payload's `promos` — nothing is hardcoded.
 */
export function FoodSpotlight({ promos }: { promos: Offer[] }) {
  const router = useRouter();
  const showToast = useToastStore((s) => s.showToast);
  const [index, setIndex] = useState(0);

  if (promos.length === 0) return null;

  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={SPOT_STRIDE}
        decelerationRate="fast"
        contentContainerStyle={styles.spotRow}
        onMomentumScrollEnd={(e) => {
          const i = Math.round(e.nativeEvent.contentOffset.x / SPOT_STRIDE);
          setIndex(Math.max(0, Math.min(promos.length - 1, i)));
        }}
      >
        {promos.map((offer) => {
          const theme = serviceTheme(offer.service);
          const line = spotLightOfferLine(offer);
          return (
            <Pressable
              key={offer.id}
              onPress={() => {
                if (offer.code) showToast(`Code ${offer.code} copied to clipboard`, 'success');
                else router.push(SERVICE_ROUTES[offer.service] as never);
              }}
              style={({ pressed }) => [styles.spotCard, pressed && { opacity: 0.95 }]}
              accessibilityLabel={offer.title}
            >
              <View style={styles.spotBody}>
                <Text style={styles.spotTitle} numberOfLines={1}>
                  {offer.title}
                </Text>
                {offer.subtitle ? (
                  <Text style={styles.spotSubtitle} numberOfLines={2}>
                    {offer.subtitle}
                  </Text>
                ) : null}
                {line ? (
                  <View style={styles.spotOfferRow}>
                    <Text style={styles.spotOffer} numberOfLines={1}>
                      {line}
                    </Text>
                    <ChevronRight size={14} color={colors.food[600]} strokeWidth={2.6} />
                  </View>
                ) : null}
              </View>

              {/* The reference puts the brand's round logo here. Food offers
                  carry no image, so the service-tinted ticket badge holds
                  the same corner of the composition. */}
              <View style={styles.spotBadge}>
                <TicketPercent size={26} color={theme.strong} strokeWidth={1.8} />
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      {promos.length > 1 && (
        <View style={styles.spotDots} accessibilityElementsHidden>
          {promos.map((promo, i) => (
            <View key={promo.id} style={[styles.spotDot, i === index && styles.spotDotActive]} />
          ))}
        </View>
      )}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* EXPLORE MORE — bordered discovery tiles                             */
/* ------------------------------------------------------------------ */

/**
 * The "EXPLORE MORE" block — the reference's row of bordered discovery tiles
 * (image on top, label below, hairline border, soft shadow, ~16px radius).
 *
 * Tiles are built from the real Food categories: each tap selects that
 * category through the same handler the round category strip uses, so the
 * feed filters in place and no navigation or backend behavior is invented.
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
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.explRow}>
      {categories.map((c) => {
        const active = selectedId === c.id;
        return (
          <Pressable
            key={c.id}
            onPress={() => onSelect(c.id)}
            accessibilityState={{ selected: active }}
            style={({ pressed }) => [
              styles.explTile,
              active && styles.explTileActive,
              pressed && { opacity: 0.9 },
            ]}
            accessibilityLabel={c.name}
          >
            <View style={styles.explImgWrap}>
              <ProductImage src={c.image} style={styles.explImg} rounded={false} resizeMode="contain" />
            </View>
            <Text
              style={[styles.explLabel, active && styles.explLabelActive]}
              numberOfLines={2}
            >
              {c.name}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/* ------------------------------------------------------------------ */
/* Recommended rail: 2-row horizontally scrollable grid, 3 per row      */
/* ------------------------------------------------------------------ */

const REC_GRID_GAP = 12;
/* Three columns fit the visible row, so each card is exactly a third of the
   content width — the rail scrolls sideways to reveal further columns. */
const REC_CARD_W = Math.floor((SCREEN_WIDTH - CONTENT_PAD * 2 - REC_GRID_GAP * 2) / 3);

/** Split a list into fixed-size chunks (used to pair restaurants into the
    rail's two-row columns). */
function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/**
 * The compact recommendation card from the reference's "RECOMMENDED FOR
 * YOU" grid: a square photo with rounded corners, the offer chip over the
 * top-left of the photo, a green rating pill that straddles the photo's
 * bottom-left edge (white ring, no notch cut-out), the restaurant name below,
 * and the delivery estimate on the last line.
 *
 * Deliberately distinct from `NotchRestaurantCard` (the notch belongs to the
 * restaurant grids) and `FeaturedRestaurantCard` (the large feed card).
 * Offer, rating and ETA are read through the same shared helpers every other
 * card uses, so the numbers can never disagree between layouts.
 */
export function FoodRecommendedCard({
  restaurant,
  distanceKm: _distanceKm,
}: {
  restaurant: Restaurant;
  distanceKm?: number | null;
}) {
  const router = useRouter();
  const rating = restaurantRating(restaurant);
  const offer = restaurantOffer(restaurant);
  // Fast kitchens get the reference's green "Near & Fast" treatment; everyone
  // else shows the backend ETA line.
  const etaMinutes = restaurant.delivery_eta?.max_minutes ?? null;
  const fast = etaMinutes !== null && etaMinutes <= 30;
  const etaText = deliveryEtaText(restaurant) ?? '—';

  return (
    <Pressable
      onPress={() => router.push(`/restaurant/${restaurant.id}` as never)}
      style={({ pressed }) => [{ width: REC_CARD_W }, pressed && { opacity: 0.95 }]}
      accessibilityLabel={restaurant.name}
    >
      <View>
        <View style={styles.recImgBox}>
          <ProductImage
            src={restaurant.cover_image ?? restaurant.logo}
            style={styles.recImg}
            rounded={false}
          />
          {!restaurant.is_open && (
            <View style={styles.recClosed}>
              <Text style={styles.recClosedText}>Closed</Text>
            </View>
          )}
        </View>

        {offer ? (
          <View style={styles.recOffer} pointerEvents="none">
            <Text style={styles.recOfferText} numberOfLines={1}>
              {offer}
            </Text>
          </View>
        ) : null}

        {rating !== null ? (
          <View style={styles.recPill} pointerEvents="none">
            <Star size={10} color="#fff" fill="#fff" strokeWidth={0} />
            <Text style={styles.recPillText}>{rating.toFixed(1)}</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.recName} numberOfLines={1}>
        {restaurant.name}
      </Text>

      <View style={styles.recEtaRow}>
        {fast ? (
          <Zap size={11} color={colors.zGreen} fill={colors.zGreen} strokeWidth={0} />
        ) : (
          <Clock size={11} color={colors.neutral[500]} />
        )}
        <Text style={[styles.recEta, fast && styles.recEtaFast]} numberOfLines={1}>
          {fast ? 'Near & Fast' : etaText}
        </Text>
      </View>
    </Pressable>
  );
}

/**
 * The Food home's recommendation block, laid out like the reference: a
 * horizontally scrollable rail of two fixed rows, filled column-by-column
 * (restaurants 1&2 form the first column, 3&4 the second, …) with three
 * restaurants visible per row. The trailing column is reached by scrolling the
 * rail sideways — never by growing a third row.
 */
export function FoodRecommendedGrid({
  restaurants,
  distanceFor,
}: {
  restaurants: Restaurant[];
  distanceFor: (restaurant: Restaurant) => number | null;
}) {
  const columns = chunk(restaurants, 2);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.recRail}
    >
      {columns.map((column, index) => (
        <View key={index} style={styles.recColumn}>
          {column.map((restaurant) => (
            <FoodRecommendedCard
              key={restaurant.id}
              restaurant={restaurant}
              distanceKm={distanceFor(restaurant)}
            />
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

export function FoodRecommendedGridSkeleton() {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.recRail}
      accessibilityElementsHidden
    >
      {chunk([0, 1, 2, 3, 4, 5], 2).map((column, index) => (
        <View key={index} style={styles.recColumn}>
          {column.map((i) => (
            <View key={i}>
              <View style={styles.recSkeletonImg} />
              <View style={{ paddingTop: 12, gap: 6 }}>
                <View style={[styles.skeletonBar, { width: '80%', height: 10 }]} />
                <View style={[styles.skeletonBar, { width: '50%', height: 10 }]} />
              </View>
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

/* ------------------------------------------------------------------ */
/* Section header + skeleton states                                    */
/* ------------------------------------------------------------------ */

export function FoodSectionHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  const router = useRouter();
  return (
    <View style={styles.secHead}>
      <View style={styles.secHeadText}>
        <Text style={styles.secTitle}>{title}</Text>
        {subtitle ? <Text style={styles.secSubtitle}>{subtitle}</Text> : null}
      </View>
      <Pressable onPress={() => router.push('/restaurants' as never)} style={styles.secSeeAll} hitSlop={8}>
        <Text style={styles.secSeeAllText}>See all</Text>
        <ChevronRight size={14} color={colors.neutral[500]} />
      </Pressable>
    </View>
  );
}

export function FoodHeroSkeleton() {
  return <View style={styles.skeletonHero} />;
}

export function DishRailSkeleton() {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.railPad}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={styles.dishSkeleton}>
          <View style={[styles.skeletonSquare, { borderRadius: 16 }]} />
          <View style={[styles.skeletonBar, { width: '75%' }]} />
          <View style={[styles.skeletonBar, { width: '50%' }]} />
        </View>
      ))}
    </ScrollView>
  );
}

export function RecommendedRailSkeleton() {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recScroll}>
      <View style={styles.recRows}>
        {Array.from({ length: RECOMMENDED_SKELETON_COLUMNS }).map((_, c) => (
          <View key={c} style={styles.recColumn}>
            {Array.from({ length: 2 }).map((_, r) => (
              <View key={r} style={[styles.recCardWidth, styles.skeletonCard, styles.skeletonCardBare]}>
                <View
                  style={[
                    styles.skeletonSquare,
                    {
                      width: RECOMMENDED_CARD_WIDTH,
                      aspectRatio: notch.sm.aspect,
                      borderTopLeftRadius: notch.sm.radius,
                      borderTopRightRadius: notch.sm.radius,
                    },
                  ]}
                />
                <View
                  style={{
                    paddingHorizontal: notch.sm.padX,
                    paddingTop: notch.sm.padY,
                    paddingBottom: notch.sm.padY,
                    gap: 6,
                  }}
                >
                  <View style={[styles.skeletonBar, { width: '70%' }]} />
                  <View style={[styles.skeletonBar, { width: '45%' }]} />
                </View>
              </View>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

export function RestaurantSkeleton() {
  // The feed shows the large, full-width cards — the skeleton mirrors that
  // silhouette (a 5:3 cover with the info panel underneath).
  return (
    <View style={styles.restList}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={[styles.skeletonCard, { borderRadius: featured.radius }]}>
          <View
            style={[
              styles.skeletonSquare,
              {
                width: '100%',
                aspectRatio: featured.aspect,
                borderTopLeftRadius: featured.radius,
                borderTopRightRadius: featured.radius,
              },
            ]}
          />
          <View style={styles.feedSkeletonBody}>
            <View style={[styles.skeletonBar, { width: '70%' }]} />
            <View style={[styles.skeletonBar, { width: '45%' }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Filtering helpers (web food-filters port)                           */
/* ------------------------------------------------------------------ */

export type FoodSortId = 'recommended' | 'rating' | 'fast';

/**
 * Dish-price band. The discovery payload carries exactly one real dish price
 * per restaurant (`featured_item.price`), so the band narrows the feed by that
 * dish — never a visual-only control (web `food-filters` port).
 */
export type FoodDishPriceBand = 'under200' | '200to350' | 'above350';

export const DISH_PRICE_BANDS: { id: FoodDishPriceBand; label: string; symbols: string }[] = [
  { id: 'under200', label: 'Under ₹200', symbols: '₹' },
  { id: '200to350', label: '₹200 - ₹350', symbols: '₹₹' },
  { id: 'above350', label: 'Above ₹350', symbols: '₹₹₹' },
];

function dishPriceMatches(price: number, band: FoodDishPriceBand): boolean {
  if (band === 'under200') return price < 200;
  if (band === '200to350') return price >= 200 && price <= 350;
  return price > 350;
}

/**
 * The Food home's filter model (web `food-filters` port). Every field maps to a
 * real attribute returned by `/food/restaurants`, so each option actually
 * narrows or reorders the results.
 */
export interface FoodFilters {
  sort: FoodSortId;
  minRating: number | null;
  maxDelivery: number | null;
  freeDelivery: boolean;
  featured: boolean;
  halal: boolean;
  dineIn: boolean;
  veg: boolean;
  /** Price band for the restaurant's featured dish. `null` = any. */
  dishPrice: FoodDishPriceBand | null;
}

export const DEFAULT_FOOD_FILTERS: FoodFilters = {
  sort: 'recommended',
  minRating: null,
  maxDelivery: null,
  freeDelivery: false,
  featured: false,
  halal: false,
  dineIn: false,
  veg: false,
  dishPrice: null,
};

export function activeFoodFilterCount(f: FoodFilters): number {
  let n = 0;
  if (f.sort !== 'recommended') n += 1;
  if (f.minRating !== null) n += 1;
  if (f.maxDelivery !== null) n += 1;
  if (f.freeDelivery) n += 1;
  if (f.featured) n += 1;
  if (f.halal) n += 1;
  if (f.dineIn) n += 1;
  if (f.veg) n += 1;
  if (f.dishPrice !== null) n += 1;
  return n;
}

const ratingOf = (r: Restaurant): number => parseFloat(r.avg_rating ?? r.rating);
// Prefer the backend ETA the card actually shows so the "Under N min" filter
// can never include a card whose displayed estimate is above the threshold.
// Falls back to the stored estimate when the API returned no ETA (mock data).
const deliveryOf = (r: Restaurant): number =>
  r.delivery_eta?.max_minutes ?? parseFloat(r.avg_delivery_time_min);

export function applyFoodFilters(list: Restaurant[], f: FoodFilters): Restaurant[] {
  let out = [...list];
  if (f.minRating !== null) out = out.filter((r) => ratingOf(r) >= f.minRating!);
  if (f.maxDelivery !== null) {
    out = out.filter((r) => Number.isFinite(deliveryOf(r)) && deliveryOf(r) <= f.maxDelivery!);
  }
  if (f.freeDelivery) out = out.filter((r) => parseFloat(r.delivery_fee) === 0 || r.free_delivery_above !== null);
  if (f.featured) out = out.filter((r) => r.is_featured === true);
  if (f.halal) out = out.filter((r) => r.is_halal === true);
  if (f.dineIn) out = out.filter((r) => r.dine_in === true);
  if (f.veg) out = out.filter((r) => r.is_veg === true);
  if (f.dishPrice !== null) {
    const band = f.dishPrice;
    out = out.filter((r) => {
      const raw = r.featured_item?.price;
      if (raw == null) return false;
      const price = Number(raw);
      return Number.isFinite(price) && dishPriceMatches(price, band);
    });
  }

  if (f.sort === 'rating') out.sort((a, b) => ratingOf(b) - ratingOf(a));
  else if (f.sort === 'fast') out.sort((a, b) => deliveryOf(a) - deliveryOf(b));
  return out;
}

export const FOOD_SORT_CAPTION: Record<FoodSortId, string> = {
  recommended: '',
  rating: 'Highest rated kitchens first',
  fast: 'Quickest delivery first',
};

/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  railPad: {
    paddingHorizontal: CONTENT_PAD,
    gap: 12,
    paddingBottom: 4,
  },
  catRailPad: {
    paddingHorizontal: CONTENT_PAD,
    gap: 8,
    paddingBottom: 0,
  },
  filterRow: {
    paddingHorizontal: CONTENT_PAD,
    gap: 8,
    alignItems: 'center',
    paddingBottom: 4,
  },
  filterDivider: {
    width: 1,
    height: 20,
    backgroundColor: colors.neutral[200],
    marginHorizontal: 2,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 12,
    paddingRight: 10,
  },
  filterChipActive: {
    borderColor: colors.food[600],
    backgroundColor: colors.food[50],
  },
  filterChipIdle: {
    borderColor: colors.neutral[200],
    backgroundColor: '#fff',
  },
  filterChipText: {
    fontFamily: 'Outfit_800Black',
    fontSize: 15,
    color: colors.neutral[700],
  },
  filterChipTextActive: {
    color: colors.food[700],
  },
  filterGroup: {
    marginBottom: 20,
  },
  filterGroupTitle: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: colors.neutral[500],
    marginBottom: 10,
  },
  filterGroupChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  optionChipIdle: {
    borderColor: colors.neutral[200],
    backgroundColor: '#fff',
  },
  optionChipActive: {
    borderColor: colors.food[600],
    backgroundColor: colors.food[50],
  },
  optionChipText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 13,
    color: colors.neutral[700],
  },
  clearAll: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  clearAllText: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 13,
    color: colors.food[700],
  },
  clearAllTextDisabled: {
    color: colors.neutral[300],
  },
  sheetFooter: {
    flexDirection: 'row',
    gap: 12,
    paddingBottom: 4,
  },
  sheetBtn: {
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetBtnGhost: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    backgroundColor: '#fff',
  },
  sheetBtnGhostText: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 14,
    color: colors.neutral[700],
  },
  sheetBtnPrimary: {
    flex: 1.4,
    backgroundColor: colors.food[600],
  },
  sheetBtnPrimaryText: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 14,
    color: '#fff',
  },
  vegToggle: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: 46,
    gap: 3,
    flexShrink: 0,
    flexGrow: 0,
  },
  vegToggleText: {
    fontFamily: 'Outfit_900Black',
    fontSize: 13,
    lineHeight: 11,
    letterSpacing: 0.4,
    color: colors.neutral[700],
  },
  vegModeToggleText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 10,
    lineHeight: 11,
    letterSpacing: 0.4,
    color: colors.neutral[700],
  },
  vegToggleTextOnDark: {
    color: '#fff',
  },
  vegTrack: {
    width: 30,
    height: 18,
    borderRadius: 999,
    justifyContent: 'center',
  },
  vegTrackOn: {
    backgroundColor: colors.zGreen,
  },
  vegTrackOff: {
    backgroundColor: colors.neutral[300],
  },
  vegTrackOffDark: {
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  vegThumb: {
    position: 'absolute',
    top: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#fff',
    shadowColor: '#100e0a',
    shadowOpacity: 0.15,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  vegThumbOn: {
    left: 14,
  },
  vegThumbOff: {
    left: 2,
  },
  heroSlide: {
    width: HERO_WIDTH,
    height: HERO_HEIGHT,
    borderRadius: 24,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#100e0a',
    shadowOpacity: 0.14,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  heroImg: {
    width: '100%',
    height: '100%',
  },
  heroShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(16,14,10,0.3)',
  },
  heroCopy: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
  },
  heroCta: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 6,
  },
  heroCtaText: {
    fontFamily: 'Outfit_800ExtraBold',
    color: colors.ink[900],
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  heroTitle: {
    fontFamily: 'Outfit_800ExtraBold',
    color: '#fff',
    fontSize: 24,
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontFamily: 'Outfit_400Regular',
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    marginTop: 2,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    height: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.neutral[300],
  },
  dotActive: {
    width: 20,
    backgroundColor: colors.food[600],
  },
  skeletonHero: {
    width: HERO_WIDTH,
    alignSelf: 'center',
    aspectRatio: 16 / 9,
    borderRadius: 24,
    backgroundColor: colors.neutral[200],
  },
  catChip: {
    width: 84,
    /* Fixed height so the active marker can be pinned to the strip's bottom
       border with `marginTop: auto`, as in the reference. */
    height: 104,
    alignItems: 'center',
    gap: 4,
    paddingTop: 4,
  },
  catImgWrap: {
    /* Matches the web chip's 70x70 artwork box exactly — the image used to be
       76px inside this 70px wrap, overflowing by 3px on each side and eating
       the whole image-to-label gap. */
    width: 70,
    height: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* The "All" chip carries the larger 76px artwork, as on the web strip. */
  catImgWrapAll: {
    width: 76,
    height: 76,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catImgWrapActive: {
    transform: [{ scale: 1.05 }],
  },
  catImg: {
    width: '100%',
    height: '100%',
  },
  catImgAll: {
    width: 76,
    height: 76,
  },
  catName: {
    fontFamily: 'Outfit_700Black',
    fontSize: 13,
    color: colors.neutral[700],
    textAlign: 'center',
    lineHeight: 16,
    width: '100%',
  },
  catNameActive: {
    fontFamily: 'Outfit_800ExtraBold',
    color: colors.food[700],
  },
  catUnderline: {
    width: 64,
    height: 3,
    borderRadius: 999,
    backgroundColor: 'transparent',
    /* Sits flush on the strip's bottom border, never floating mid-chip. */
    marginTop: 'auto',
  },
  catUnderlineActive: {
    backgroundColor: colors.food[600],
  },
  skeletonCat: {
    width: 76,
    height: 76,
    borderRadius: 20,
    backgroundColor: colors.neutral[200],
  },
  skeletonCatLabel: {
    width: 52,
    height: 14,
    borderRadius: 999,
    backgroundColor: colors.neutral[200],
  },
  promoCard: {
    width: PROMO_CARD_WIDTH,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(214,211,204,0.6)',
    padding: 14,
    overflow: 'hidden',
  },
  promoCardPressed: {
    transform: [{ scale: 0.98 }],
  },
  promoAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 6,
  },
  promoIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  promoIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promoTag: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  promoTagText: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  promoTitle: {
    fontFamily: 'Outfit_800ExtraBold',
    marginTop: 10,
    fontSize: 15,
    color: colors.ink[900],
    lineHeight: 19,
  },
  promoSubtitle: {
    fontFamily: 'Outfit_400Regular',
    marginTop: 2,
    fontSize: 12,
    lineHeight: 16,
    color: colors.neutral[500],
  },
  promoFoot: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  promoCode: {
    borderRadius: 6,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.neutral[300],
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  promoCodeText: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 11,
    letterSpacing: 0.5,
    color: colors.neutral[700],
  },
  promoExplore: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  promoExploreText: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 11,
    color: colors.food[600],
  },
  dishCard: {
    width: DISH_CARD_WIDTH,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(214,211,204,0.7)',
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  dishImgWrap: {
    width: '100%',
    aspectRatio: 1,
    position: 'relative',
    backgroundColor: colors.neutral[100],
  },
  dishImg: {
    width: '100%',
    height: '100%',
  },
  dishOffBadge: {
    position: 'absolute',
    left: 6,
    top: 6,
    backgroundColor: colors.food[600],
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  dishOffText: {
    fontFamily: 'Outfit_800ExtraBold',
    color: '#fff',
    fontSize: 10,
  },
  dishSoldOut: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16,14,10,0.45)',
  },
  dishSoldOutText: {
    fontFamily: 'Outfit_800ExtraBold',
    color: '#fff',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  dishBody: {
    padding: 10,
  },
  dishName: {
    fontFamily: 'Outfit_800ExtraBold',
    minHeight: 36,
    fontSize: 13,
    color: colors.ink[900],
    lineHeight: 18,
  },
  dishMetaRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dishUnit: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 11,
    color: colors.neutral[500],
  },
  dishStock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginLeft: 'auto',
  },
  dishStockText: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 10,
    color: colors.neutral[400],
  },
  dishPriceRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  dishPrices: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  dishPrice: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 14,
    color: colors.ink[900],
  },
  dishCompare: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 10,
    color: colors.neutral[400],
    textDecorationLine: 'line-through',
  },
  dishAdd: {
    marginBottom: -6,
  },
  recScroll: {
    paddingLeft: GRID_PAD,
    paddingBottom: 12,
  },
  recRows: {
    flexDirection: 'row',
    gap: GRID_GAP,
  },
  recCardWidth: {
    width: RECOMMENDED_CARD_WIDTH,
  },
  /* The white card the large restaurant card is built on — the skeleton
     mirrors it so the loading state has the same silhouette. */
  skeletonCard: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: notch.surface,
    borderRadius: notch.md.radius,
  },
  /* The compact notched card has no tile of its own, so its placeholder
     drops the white background too and only shows the image placeholder
     and the bars. */
  skeletonCardBare: {
    backgroundColor: 'transparent',
  },
  feedSkeletonBody: {
    padding: 12,
    gap: 8,
  },
  secHead: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  secHeadText: {
    flex: 1,
    minWidth: 0,
  },
  secTitle: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 15,
    color: colors.ink[500],
    letterSpacing: 2,
  },
  secSubtitle: {
    fontFamily: 'Outfit_400Regular',
    marginTop: 2,
    fontSize: 12,
    color: colors.neutral[500],
  },
  secSeeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  secSeeAllText: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 12,
    color: colors.neutral[500],
  },
  dishSkeleton: {
    width: DISH_CARD_WIDTH,
    gap: 8,
  },
  skeletonSquare: {
    width: DISH_CARD_WIDTH,
    aspectRatio: 1,
    backgroundColor: colors.neutral[200],
  },
  skeletonBar: {
    height: 12,
    borderRadius: 999,
    backgroundColor: colors.neutral[200],
  },
  restList: {
    paddingHorizontal: 16,
    gap: 16,
  },
  /* Hero tiles (reference promo tiles over the hero base). */
  tileRow: {
    paddingHorizontal: 16,
    gap: 10,
    paddingTop: 4,
  },
  tile: {
    width: 100,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  tileDisc: {
    width: 52,
    height: 52,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  tileImg: {
    width: '100%',
    height: '100%',
  },
  tileLabel: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 12,
    lineHeight: 15,
    color: '#fff',
    textAlign: 'center',
    minHeight: 30,
  },
  /* Plain food-feed section title. */
  feedTitle: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 13,
    letterSpacing: 3,
    color: colors.neutral[500],
    textTransform: 'uppercase',
  },
  feedSubtitle: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 14,
    color: colors.neutral[500],
    marginTop: 6,
  },
  /* IN THE SPOTLIGHT carousel. */
  spotRow: {
    paddingHorizontal: 16,
    gap: 12,
  },
  spotCard: {
    width: SPOT_CARD_WIDTH,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(16,14,10,0.06)',
    backgroundColor: '#fdfcfc',
    shadowColor: '#100e0a',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  spotBody: {
    flex: 1,
    minWidth: 0,
  },
  spotTitle: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 22,
    color: colors.ink[900],
    letterSpacing: -0.3,
  },
  spotSubtitle: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 15,
    lineHeight: 21,
    color: colors.neutral[500],
    marginTop: 6,
  },
  spotOfferRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 14,
  },
  spotOffer: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 14,
    color: colors.food[600],
  },
  spotBadge: {
    width: 56,
    height: 56,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(16,14,10,0.08)',
  },
  spotDots: {
    flexDirection: 'row',
    alignSelf: 'center',
    gap: 5,
    paddingTop: 12,
  },
  spotDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: colors.neutral[300],
  },
  spotDotActive: {
    width: 16,
    backgroundColor: colors.food[600],
  },
  /* EXPLORE MORE tiles. */
  explRow: {
    paddingHorizontal: 16,
    gap: 12,
  },
  explTile: {
    width: 104,
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.neutral[200],
    shadowColor: '#100e0a',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  explTileActive: {
    borderColor: colors.food[600],
  },
  explImgWrap: {
    width: 56,
    height: 56,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.neutral[100],
  },
  explImg: {
    width: '100%',
    height: '100%',
    padding: 4,
  },
  explLabel: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 15,
    lineHeight: 18,
    color: colors.ink[900],
    textAlign: 'center',
    minHeight: 34,
  },
  explLabelActive: {
    color: colors.food[600],
  },
  /* Recommended grid. */
  recRail: {
    paddingHorizontal: CONTENT_PAD,
    gap: REC_GRID_GAP,
    paddingVertical: 4,
  },
  recColumn: {
    width: REC_CARD_W,
    gap: REC_GRID_GAP,
  },
  recImgBox: {
    width: '100%',
    /* Matches the web card's `aspect-[1.5/1.2]` — a 1.25:1 landscape tile,
       not a square, so both platforms crop the cover photo identically. */
    aspectRatio: 1.5 / 1.2,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.neutral[100],
  },
  recImg: {
    width: '100%',
    height: '100%',
  },
  recClosed: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16,14,10,0.55)',
  },
  recClosedText: {
    fontFamily: 'Outfit_800ExtraBold',
    color: '#fff',
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  recOffer: {
    position: 'absolute',
    left: 6,
    top: 6,
    maxWidth: REC_CARD_W - 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(16,14,10,0.75)',
  },
  recOfferText: {
    fontFamily: 'Outfit_600SemiBold',
    flexShrink: 1,
    color: '#fff',
    fontSize: 10,
  },
  recPill: {
    position: 'absolute',
    left: 6,
    bottom: -8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: colors.zGreen,
    borderWidth: 2,
    borderColor: '#fff',
  },
  recPillText: {
    fontFamily: 'Outfit_700Bold',
    color: '#fff',
    fontSize: 11,
    lineHeight: 13,
  },
  recName: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 15,
    color: colors.ink[900],
    marginTop: 14,
  },
  recEtaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  recEta: {
    fontFamily: 'Outfit_500Medium',
    flexShrink: 1,
    fontSize: 12,
    color: colors.neutral[500],
  },
  recEtaFast: {
    color: colors.zGreen,
  },
  recSkeletonImg: {
    width: '100%',
    aspectRatio: 1.5 / 1.2,
    borderRadius: 16,
    backgroundColor: colors.neutral[200],
  },
  /* Zomato filter sheet — rail + grouped option tiles */
  filterPanes: {
    flexDirection: 'row',
    height: FILTER_PANE_H,
    borderTopWidth: 1,
    borderTopColor: colors.ink[50],
  },
  rail: {
    width: 94,
    borderRightWidth: 1,
    borderRightColor: colors.ink[50],
    paddingTop: 4,
    backgroundColor: '#fff',
  },
  railTab: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 6,
  },
  railTabOn: {
    backgroundColor: colors.food[50],
  },
  railTabText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 11,
    textAlign: 'center',
    color: colors.neutral[500],
  },
  railTabTextOn: {
    fontFamily: 'Outfit_700Bold',
    color: colors.food[600],
  },
  paneScroll: {
    flex: 1,
  },
  paneScrollContent: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 16,
  },
  sortHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.ink[50],
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  sortHeaderTitle: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 15,
    color: colors.ink[900],
  },
  sortHeaderValue: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 14,
    color: colors.food[600],
  },
  filterSection: {
    gap: 8,
  },
  filterSectionTitle: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 15,
    color: colors.ink[900],
  },
  filterSectionPanel: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    backgroundColor: colors.ink[50],
    borderRadius: 14,
    padding: 10,
  },
  optTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexGrow: 1,
    flexBasis: '46%',
    minWidth: 128,
  },
  optTileOn: {
    borderColor: colors.food[600],
  },
  optTileLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    minWidth: 0,
  },
  optTileIcon: {
    flexShrink: 1,
  },
  optTileLabel: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 13,
    color: colors.neutral[700],
    flexShrink: 1,
  },
  optTileLabelOn: {
    fontFamily: 'Outfit_700Bold',
    color: colors.ink[900],
  },
  optRadio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.neutral[300],
    alignItems: 'center',
    justifyContent: 'center',
  },
  optRadioOn: {
    borderColor: colors.food[600],
  },
  optRadioDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.food[600],
  },
  rupeeSymbols: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 13,
    color: colors.zGreen,
  },
  sheetBtnPrimaryOff: {
    backgroundColor: colors.neutral[100],
  },
  sheetBtnPrimaryOffText: {
    color: colors.neutral[400],
  },
});