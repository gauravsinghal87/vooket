import { useEffect, useRef, useState } from 'react';
import type React from 'react';
import { Dimensions, Pressable, ScrollView, Share, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import {
  ArrowLeft,
  Car,
  ChevronDown,
  Clock,
  Copy,
  LayoutGrid,
  MapPin,
  Navigation,
  PackageOpen,
  Search,
  Share2,
  ShoppingBasket,
  ShoppingCart,
  Star,
  Tag as TagIcon,
  TicketPercent,
  Truck,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react-native';
import type { Banner, Category, Offer, Product, Store } from '@/types/catalog';
import { discountPercent, formatCurrency } from '@/lib/utils';
import { estimateDeliveryMinutes, formatDistanceKm } from '@/lib/geo';
import { bannerRoute } from '@/lib/banner';
import { getBranding } from '@/lib/branding';
import { carryProduct } from '@/lib/routeState';
import { categoryTileColor } from '@/lib/groceryCategories';
import { imageUrl } from '@/lib/images';
import { ProductImage } from '@/components/ui/ProductImage';
import { Avatar } from '@/components/ui/Avatar';
import { AppHeader } from '@/components/AppHeader';
import { SearchBar } from '@/components/SearchBar';
import { RatingStars, VegMark } from '@/components/ui/primitives';
import { AddToCartControl } from '@/components/product/AddToCart';
import { useActiveGroceryStore } from '@/hooks/useActiveGroceryStore';
import { useAppStore } from '@/stores/appStore';
import { useAuthStore } from '@/stores/authStore';
import { useCartStore } from '@/stores/cartStore';
import { DEFAULT_LOCATION } from '@/lib/location';
import { toast } from '@/stores/toastStore';
import { SERVICE_THEMES, colors, withAlpha } from '@/theme';
import type { ServiceType } from '@/types/models';

const SCREEN_WIDTH = Dimensions.get('window').width;
const GUTTER = 16;

/* ------------------------------------------------------------------ */
/* Grocery header ETA row (nearest-store, mounted only on /grocery)    */
/* ------------------------------------------------------------------ */

/**
 * Real nearest-store ETA for the Grocery top band — native port of the web
 * `GroceryEtaRow`. Delivery time comes from `estimateDeliveryMinutes` and the
 * distance from `formatDistanceKm`, both fed by the unchanged
 * `useActiveGroceryStore` hook. The hook only mounts where this renders.
 */
export function GroceryEtaRow({ tone = 'onLight' }: { tone?: 'onLight' | 'onDark' }) {
  const { activeStore, distanceKm, isLoading } = useActiveGroceryStore();
  const eta = estimateDeliveryMinutes(distanceKm);
  const distance = formatDistanceKm(distanceKm);
  const etaText = activeStore && eta !== null ? `Delivery in ${eta} min` : 'Delivery times';
  const onDark = tone === 'onDark';
  const secondary = onDark ? 'rgba(255,255,255,0.85)' : colors.grocery[800];

  if (isLoading && !activeStore) {
    return <View style={[styles.etaSkeleton, onDark && { backgroundColor: 'rgba(255,255,255,0.3)' }]} />;
  }

  return (
    <View style={styles.etaRow}>
      {activeStore && eta !== null ? <Clock size={15} color={secondary} /> : null}
      <Text style={[styles.etaText, onDark && { color: colors.white }]} numberOfLines={1}>
        {etaText}
      </Text>
      {distance ? (
        <View style={styles.etaDistance}>
          <Navigation size={11} color={secondary} />
          <Text style={[styles.etaDistanceText, onDark && { color: secondary }]}>{distance}</Text>
        </View>
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Home hero — Admin festive artwork + overlaid header/search          */
/* ------------------------------------------------------------------ */

const HERO_MAROON = '#7a1e3b';

/**
 * The Grocery home hero.
 *
 * The Admin-uploaded `grocery_home_hero` banner is the background. `expo-image`
 * zooms into the artwork's maroon panel, so the compact header, search and
 * category navigation sit on the same saturated surface as Blinkit instead of
 * the source's cream lights strip. The view ends immediately after the
 * navigation. A top scrim guarantees the white header controls stay legible.
 *
 * `AppHeader` is rendered here in its overlay variant, so there is exactly one
 * header on screen and it reads as part of the hero. The category navigation
 * is the hero's last row, directly under the search; promotional cards are
 * rendered by the screen after the main category sections. Once those rows
 * scroll away the screen pins a compact copy over the page. Without an active
 * banner the same layout falls back to the Grocery cream gradient with dark
 * controls — no hardcoded image and no other service's artwork.
 */
export function GroceryHero({
  banners,
  categoryNav,
  festivePromos,
  onSearchLayout,
}: {
  banners: Banner[];
  /** The screen's single horizontal Grocery category navigation. */
  categoryNav?: React.ReactNode;
  /**
   * The Admin festive promo cards. They live inside the hero — not in the
   * page body — so the artwork keeps running behind them and the screen reads
   * as one continuous festive surface, the same as the reference.
   */
  festivePromos?: Banner[];
  /**
   * Reports the search row's offset inside the hero and its height, so the
   * screen can pin its compact copy (search + category navigation) exactly
   * when this row reaches the safe-area top.
   */
  onSearchLayout?: (y: number, height: number) => void;
}) {
  const banner = banners[0];
  const artwork = banner?.image ?? null;
  const hasArtwork = Boolean(artwork);
  // Geometry of the search row: the header block's offset inside the hero plus
  // the row's own offset inside that block (the block sits at the hero's top
  // edge, so the two simply add up).
  const [blockY, setBlockY] = useState(0);
  const [searchY, setSearchY] = useState(0);
  const [searchH, setSearchH] = useState(0);
  useEffect(() => {
    onSearchLayout?.(blockY + searchY, searchH);
  }, [blockY, searchY, searchH, onSearchLayout]);

  return (
    <View
      style={[
        styles.hero,
        { backgroundColor: hasArtwork ? HERO_MAROON : colors.grocery[100] },
        !hasArtwork && { minHeight: 220 },
      ]}
    >
      {hasArtwork ? (
        <>
          <ExpoImage
            source={{ uri: imageUrl(artwork) }}
            style={StyleSheet.absoluteFillObject}
            contentFit="cover"
            // Top-anchored, full-width artwork — the same framing as the web
            // hero (the old 2× zoom cropped the banner into an unreadable
            // close-up that no longer matched the reference).
            contentPosition={{ top: '0%', left: '50%' }}
            cachePolicy="memory-disk"
            transition={250}
            accessibilityIgnoresInvertColors
          />
          <LinearGradient
            // Lighter than before: the old 0.72 wash sat over the whole maroon
            // band, so the festive artwork read much duller than the web hero,
            // which keeps its banner bright. Darken only what the white status
            // bar and header actually sit on and let the artwork show through.
            colors={['rgba(16,14,10,0.60)', 'rgba(16,14,10,0.18)', 'rgba(16,14,10,0)']}
            locations={[0, 0.4, 1]}
            style={styles.heroScrim}
            // Decorative only: never intercepts taps on the header, search or
            // category controls underneath its area.
            pointerEvents="none"
          />
        </>
      ) : (
        <LinearGradient colors={[colors.grocery[300], colors.grocery[100]]} style={StyleSheet.absoluteFillObject} />
      )}

      <StatusBar style={hasArtwork ? 'light' : 'dark'} />

      <View
        onLayout={(e) => {
          setBlockY(e.nativeEvent.layout.y);
        }}
      >
        <AppHeader variant="overlay" overlayOnDark={hasArtwork} />
        <View
          style={styles.heroSearch}
          onLayout={(e) => {
            setSearchY(e.nativeEvent.layout.y);
            setSearchH(e.nativeEvent.layout.height);
          }}
        >
          <SearchBar variant="brand" />
        </View>
      </View>

      {categoryNav ? <View style={styles.heroNav}>{categoryNav}</View> : null}

      {/* Festive promo cards, still inside the hero so the artwork continues
          behind them instead of stopping at the category navigation. */}
      {festivePromos && festivePromos.length > 0 ? (
        <View style={styles.heroFestive}>
          <GroceryFestivePromoGrid banners={festivePromos} />
        </View>
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Category header — cream, compact, web parity                        */
/* ------------------------------------------------------------------ */

/**
 * Compact header for the `?category=<id>` screen — native port of the web
 * `GroceryCategoryHeader`. Cream surface, back, the real category name from
 * the backend, search, share, the live grocery cart badge and the account
 * avatar, with one delivery-location line that opens the shared selector.
 *
 * No store name / ETA / distance here: those live in the store summary card so
 * the same facts are never printed twice on one screen.
 */
export function GroceryCategoryHeader({
  categoryName,
  onOpenLocation,
}: {
  categoryName: string;
  onOpenLocation: () => void;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const groceryCount = useCartStore((s) => s.groceryCount);
  const locationState = useAppStore((s) => s.location);
  const activeLoc = locationState ?? DEFAULT_LOCATION;

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/grocery' as never);
  };

  const onShare = () => {
    void Share.share({
      message: `${categoryName} on ${getBranding().name}`,
    }).catch(() => undefined);
  };

  return (
    <View style={[styles.catHeader, { paddingTop: insets.top + 6 }]}>
      <View style={styles.catHeaderRow}>
        <Pressable onPress={goBack} hitSlop={10} style={styles.catHeaderBtn} accessibilityLabel="Back">
          <ArrowLeft size={20} color={colors.ink[800]} />
        </Pressable>

        <Text style={styles.catHeaderTitle} numberOfLines={1}>
          {categoryName}
        </Text>

        <Pressable
          onPress={() => router.push('/search?type=grocery' as never)}
          hitSlop={8}
          style={styles.catHeaderBtn}
          accessibilityLabel="Search grocery"
        >
          <Search size={20} color={colors.ink[800]} />
        </Pressable>

        <Pressable onPress={onShare} hitSlop={8} style={styles.catHeaderBtn} accessibilityLabel="Share">
          <Share2 size={19} color={colors.ink[800]} />
        </Pressable>

        <Pressable
          onPress={() => router.push('/cart?type=grocery' as never)}
          hitSlop={8}
          style={styles.catHeaderBtn}
          accessibilityLabel={`Cart, ${groceryCount} items`}
        >
          <ShoppingCart size={21} color={colors.ink[800]} />
          {groceryCount > 0 ? (
            <View style={styles.catCartBadge}>
              <Text style={styles.catCartBadgeText}>{groceryCount > 99 ? '99+' : groceryCount}</Text>
            </View>
          ) : null}
        </Pressable>

        <Pressable
          onPress={() => router.push((user ? '/profile' : '/auth/login') as never)}
          style={styles.catAvatar}
          accessibilityLabel="Account"
        >
          <Avatar name={user?.name ?? 'Guest'} size="sm" />
        </Pressable>
      </View>

      <Pressable onPress={onOpenLocation} style={styles.catLocRow} accessibilityLabel="Change delivery location">
        <MapPin size={14} color={colors.grocery[700]} strokeWidth={0} fill={colors.grocery[700]} />
        <Text style={styles.catLocMuted}>Delivering to</Text>
        <Text style={styles.catLocLabel} numberOfLines={1}>
          {activeLoc.label}
        </Text>
        <Text style={styles.catLocAddr} numberOfLines={1}>
          · {activeLoc.address}
        </Text>
        <ChevronDown size={14} color={colors.neutral[400]} />
      </Pressable>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Category carousel — compact Blinkit-style navigation                */
/* ------------------------------------------------------------------ */

const CAT_TILE_W = 68;
/** Must match the `gap` in `styles.catRail`. */
const CAT_GAP = 6;

interface CategoryCarouselProps {
  categories: Category[];
  selectedId: number | null;
  onSelect: (categoryId: number | null) => void;
  /**
   * `artwork` paints the tabs light for the dark festive hero. `surface` keeps
   * the normal dark-on-cream treatment used by the pinned search dock.
   */
  tone?: 'surface' | 'artwork';
}

/**
 * Compact horizontally scrollable category strip — native port of the web
 * `CategoryCarousel`: a single row of icon-plus-label tabs with a thin
 * underline marking the active one. On the home it sits directly under the
 * search over the festive artwork; the pinned dock and category view use the
 * dark-on-cream treatment.
 *
 * Every tab is a real grocery category from `GET /grocery/categories` in
 * backend order. The leading "All" item only clears the filter; it is UI state,
 * not a database category.
 *
 * Opening the screen with a category from the URL scrolls the strip so the
 * selected tile sits mid-view, and switching categories keeps it in view — the
 * same behaviour as the web strip's `scrollIntoView`.
 */
export function GroceryCategoryCarousel({ categories, selectedId, onSelect, tone = 'surface' }: CategoryCarouselProps) {
  const railRef = useRef<ScrollView>(null);
  const { width: windowW } = useWindowDimensions();
  /** The first content pass jumps without animation; later taps animate. */
  const laidOut = useRef(false);
  const pendingX = useRef(0);

  /** Horizontal offset that centres tile `index` ("All" is index 0). */
  const centredX = (index: number) => {
    const tileCentre = GUTTER + index * (CAT_TILE_W + CAT_GAP) + CAT_TILE_W / 2;
    const contentW = GUTTER * 2 + categories.length * CAT_TILE_W + (categories.length - 1) * CAT_GAP;
    const max = Math.max(0, contentW - windowW);
    return Math.max(0, Math.min(tileCentre - windowW / 2, max));
  };

  useEffect(() => {
    const index = selectedId === null ? 0 : categories.findIndex((c) => c.id === selectedId);
    if (index < 0 || categories.length === 0) return;
    pendingX.current = centredX(index);
    if (laidOut.current) railRef.current?.scrollTo({ x: pendingX.current, animated: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, categories, windowW]);

  const onContentSizeChange = () => {
    if (laidOut.current) return;
    laidOut.current = true;
    railRef.current?.scrollTo({ x: pendingX.current, animated: false });
  };

  if (categories.length === 0) return null;
  const allActive = selectedId === null;

  return (
    <ScrollView
      ref={railRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.catRail}
      onContentSizeChange={onContentSizeChange}
    >
      <CategoryTab label="All" Icon={LayoutGrid} active={allActive} tone={tone} onPress={() => onSelect(null)} />

      {categories.map((c) => {
        const active = selectedId === c.id;
        return (
          <CategoryTab
            key={c.id}
            label={c.name}
            image={c.navigation_icon}
            active={active}
            tone={tone}
            onPress={() => onSelect(active ? null : c.id)}
          />
        );
      })}
    </ScrollView>
  );
}

/**
 * One category tab: a small icon (or a neatly contained image thumbnail when no
 * icon is available) above a single-line label, with the active underline
 * pinned to the bottom edge of the strip.
 */
function CategoryTab({
  label,
  Icon,
  image,
  active,
  tone,
  onPress,
}: {
  label: string;
  Icon?: LucideIcon | null;
  image?: string | null;
  active: boolean;
  tone: 'surface' | 'artwork';
  onPress: () => void;
}) {
  const onArtwork = tone === 'artwork';
  const iconColor = onArtwork ? '#fff' : active ? colors.grocery[700] : colors.neutral[500];

  return (
    <Pressable
      onPress={onPress}
      style={styles.catTile}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
    >
      <View style={[styles.catIconWrap, onArtwork && image && styles.catIconPlate]}>
        {Icon ? (
          <Icon size={22} strokeWidth={1.75} color={iconColor} />
        ) : image ? (
          <ProductImage src={image} style={styles.catImg} rounded={false} resizeMode="contain" />
        ) : (
          <View
            style={[
              styles.catFallback,
              active && styles.catFallbackActive,
              onArtwork && styles.catFallbackOnArtwork,
              onArtwork && active && styles.catFallbackOnArtworkActive,
            ]}
          >
            <Text
              style={[
                styles.catFallbackText,
                active && styles.catFallbackTextActive,
                onArtwork && styles.catFallbackTextOnArtwork,
              ]}
            >
              {label.trim().charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
      </View>
      <Text
        style={[
          styles.catLabel,
          active && styles.catLabelActive,
          onArtwork && styles.catLabelOnArtwork,
          onArtwork && active && styles.catLabelOnArtworkActive,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
      <View
        style={[
          styles.catUnderline,
          active && styles.catUnderlineActive,
          onArtwork && active && styles.catUnderlineOnArtwork,
        ]}
      />
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/* Category grid — Grocery & Kitchen tiles                             */
/* ------------------------------------------------------------------ */

const GRID_GAP = 12;
const GRID_TILE_W = Math.floor((SCREEN_WIDTH - GUTTER * 2 - GRID_GAP * 3) / 4);
const GRID_TILE_PAD = 10;

interface CategoryGridProps {
  categories: Category[];
  title?: string;
  subtitle?: string;
  selectedId?: number | null;
  onSelect?: (categoryId: number) => void;
  /**
   * When set, the section title becomes a link to the parent category, so the
   * customer can open the parent and browse all of its subcategories.
   */
  onSelectParent?: () => void;
}

/**
 * Dense Blinkit-style image-tile grid of grocery categories — native port of the
 * web `CategoryGrid`. Each item is a bare two-part stack: a soft, category-tinted
 * square tile holding only the illustration (contained, never cropped or
 * stretched), with the category name centred underneath — no outer white card,
 * border or heavy shadow. Four columns on phones, matching the reference tile
 * size, spacing and two-line label clamp.
 */
export function GroceryCategoryGrid({
  categories,
  title = 'Grocery & Kitchen',
  subtitle,
  selectedId = null,
  onSelect,
  onSelectParent,
}: CategoryGridProps) {
  if (categories.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        {onSelectParent ? (
          <Pressable onPress={onSelectParent} accessibilityRole="button" accessibilityLabel={title}>
            <Text style={styles.sectionTitle}>{title}</Text>
          </Pressable>
        ) : (
          <Text style={styles.sectionTitle}>{title}</Text>
        )}
        {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      </View>

      <View style={styles.grid}>
        {categories.map((c) => {
          const active = selectedId === c.id;
          return (
            <Pressable
              key={c.id}
              onPress={() => onSelect?.(c.id)}
              style={styles.gridTile}
              accessibilityRole="button"
              accessibilityLabel={c.name}
            >
              <View
                style={[
                  styles.gridImgWrap,
                  { backgroundColor: categoryTileColor(c) },
                  active && styles.gridImgWrapActive,
                ]}
              >
                <ProductImage src={c.image} style={styles.gridImg} rounded={false} resizeMode="contain" />
              </View>
              <Text style={[styles.gridLabel, active && styles.gridLabelActive]} numberOfLines={2}>
                {c.name}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Product shelf — horizontal rail of product cards                    */
/* ------------------------------------------------------------------ */

const RAIL_CARD_W = 172;

interface ProductShelfProps {
  title: string;
  subtitle?: string;
  products: Product[];
  action?: React.ReactNode;
}

/**
 * Horizontally scrollable product shelf — native port of the web
 * `ProductShelf`. Every product has already been filtered to the active store
 * by the page; the fixed 172px card keeps names and prices readable instead of
 * collapsing into narrow columns.
 */
export function GroceryProductShelf({ title, subtitle, products, action }: ProductShelfProps) {
  if (products.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.shelfHead}>
        <View style={styles.shelfHeadText}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {subtitle ? (
            <Text style={styles.sectionSubtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {action}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.railContent}>
        {products.map((p) => (
          <GroceryProductRailCard key={p.id} product={p} />
        ))}
      </ScrollView>
    </View>
  );
}

/** Product card sized for the shelf rail — native port of the web ProductCard. */
export function GroceryProductRailCard({ product }: { product: Product }) {
  const router = useRouter();
  const off = discountPercent(product);
  const compare = product.compare_at_price ? parseFloat(product.compare_at_price) : null;
  const price = parseFloat(product.price);
  const hasDiscount = compare !== null && compare > price;

  const open = () => {
    carryProduct(product, 'grocery');
    router.push(`/product/${product.id}?service=grocery` as never);
  };

  return (
    <View style={styles.railCard}>
      <Pressable onPress={open}>
        <View style={styles.railImgWrap}>
          <ProductImage src={product.image} style={styles.railImg} rounded={false} />
          {off !== null ? (
            <View style={styles.offBadge}>
              <Text style={styles.offText}>{off}% off</Text>
            </View>
          ) : null}
        </View>
      </Pressable>

      <Pressable onPress={open}>
        {product.brand?.name ? (
          <Text style={styles.brand} numberOfLines={1}>
            {product.brand.name}
          </Text>
        ) : null}
        <Text style={styles.railName} numberOfLines={1}>
          {product.name}
        </Text>
        {product.unit_label ? (
          <View style={styles.unitRow}>
            <Text style={styles.unit} numberOfLines={1}>
              {product.unit_label}
            </Text>
            {product.is_veg !== null ? <VegMark isVeg={product.is_veg} size={11} /> : null}
          </View>
        ) : null}
      </Pressable>

      <View style={styles.railFoot}>
        <View style={styles.railPriceCol}>
          <View style={styles.priceRow}>
            <Text style={styles.price}>{formatCurrency(price)}</Text>
            {hasDiscount ? <Text style={styles.compare}>{formatCurrency(compare as number)}</Text> : null}
          </View>
          {product.is_available ? (
            <View style={styles.stockRow}>
              <Star size={10} color={colors.warning} fill={colors.warning} />
              <Text style={styles.inStock}>In stock</Text>
            </View>
          ) : (
            <Text style={styles.outStock}>Out of stock</Text>
          )}
        </View>
        <AddToCartControl productId={product.id} type="grocery" size="icon" product={product} />
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Promotions rail — offer cards                                       */
/* ------------------------------------------------------------------ */

const PROMO_CARD_W = 248;
const PROMO_ICONS: Record<ServiceType, typeof ShoppingBasket> = {
  food: UtensilsCrossed,
  grocery: ShoppingBasket,
  rides: Car,
};

/**
 * Horizontal offers rail — native port of the web `PromoRail`. Server-driven
 * offers only: the page has already filtered them to the grocery service.
 */
export function GroceryPromoRail({ promos }: { promos: Offer[] }) {
  if (promos.length === 0) return null;

  return (
    <View style={styles.section}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.railContent}>
        {promos.map((offer) => (
          <GroceryPromoCard key={offer.id} offer={offer} />
        ))}
      </ScrollView>
    </View>
  );
}

function GroceryPromoCard({ offer }: { offer: Offer }) {
  const service: ServiceType = offer.service === 'food' || offer.service === 'rides' ? offer.service : 'grocery';
  const theme = SERVICE_THEMES[service];
  const Icon = PROMO_ICONS[service];

  const onPress = () => {
    if (offer.code) toast(`Code ${offer.code} — apply at checkout`, 'success');
  };

  return (
    <Pressable onPress={onPress} style={styles.promoCard} accessibilityRole="button" accessibilityLabel={offer.title}>
      <View style={[styles.promoBar, { backgroundColor: theme.solid }]} />
      <View style={styles.promoTop}>
        <View style={[styles.promoIconPlate, { backgroundColor: theme.soft }]}>
          <Icon size={16} color={theme.strong} />
        </View>
        {offer.tag ? (
          <View style={[styles.promoTag, { backgroundColor: theme.soft }]}>
            <Text style={[styles.promoTagText, { color: theme.strong }]} numberOfLines={1}>
              {offer.tag}
            </Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.promoTitle} numberOfLines={2}>
        {offer.title}
      </Text>
      {offer.subtitle ? (
        <Text style={styles.promoSubtitle} numberOfLines={2}>
          {offer.subtitle}
        </Text>
      ) : null}

      <View style={styles.promoFoot}>
        {offer.code ? (
          <>
            <Copy size={12} color={colors.neutral[400]} />
            <View style={styles.promoCode}>
              <Text style={styles.promoCodeText}>{offer.code}</Text>
            </View>
          </>
        ) : (
          <>
            <TicketPercent size={14} color={colors.accent[600]} />
            <Text style={styles.promoExplore}>Tap to explore</Text>
          </>
        )}
      </View>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/* Banner rail (hero carousel)                                         */
/* ------------------------------------------------------------------ */

const BANNER_W = Math.min(SCREEN_WIDTH * 0.92, 560);
const BANNER_H = Math.round(BANNER_W * (10 / 16));

/**
 * Horizontally scrollable banner rail — native port of the web `HeroCarousel`
 * on grocery. Banners are already filtered to the active store by the page.
 */
export function GroceryBannerRail({ banners }: { banners: Banner[] }) {
  const router = useRouter();
  if (banners.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={BANNER_W + 12}
      decelerationRate="fast"
      contentContainerStyle={styles.bannerRail}
    >
      {banners.map((b) => (
        <Pressable
          key={b.id}
          onPress={() => router.push(bannerRoute(b) as never)}
          style={styles.bannerCard}
          accessibilityRole="button"
          accessibilityLabel={b.title}
        >
          <ProductImage src={b.image} style={styles.bannerImg} rounded={false} />
          <View style={styles.bannerShade} />
          <View style={styles.bannerCopy}>
            {b.cta_text ? (
              <View style={styles.bannerCta}>
                <Text style={styles.bannerCtaText}>{b.cta_text}</Text>
              </View>
            ) : null}
            <Text style={styles.bannerTitle} numberOfLines={2}>
              {b.title}
            </Text>
            {b.subtitle ? (
              <Text style={styles.bannerSubtitle} numberOfLines={2}>
                {b.subtitle}
              </Text>
            ) : null}
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}

/* ------------------------------------------------------------------ */
/* Brand promo carousel (grocery_home_brand_promo placement)           */
/* ------------------------------------------------------------------ */

const BRAND_W = Math.round((SCREEN_WIDTH - GUTTER * 2 - 12) / 2);
const BRAND_H = Math.round(BRAND_W * (9 / 16));

/**
 * Compact horizontal brand-promotion carousel — native port of the web
 * `BrandPromoRail`. Only the Admin-managed `grocery_home_brand_promo` placement
 * is rendered (the page filters it), so a banner for another surface can never
 * appear here. Two cards stay visible at once on a phone, matching the
 * quick-commerce reference proportions, and each card is fully tappable.
 */
export function GroceryBrandPromoRail({ banners }: { banners: Banner[] }) {
  const router = useRouter();
  if (banners.length === 0) return null;

  // One active Admin banner gets a full-width featured card in the hero's cream
  // strip; two or more stay a swipeable rail. The page already removed the
  // active hero banner id, so the festive artwork is never repeated here.
  const featured = banners.length === 1;

  const cards = banners.map((b) => (
    <Pressable
      key={b.id}
      onPress={() => router.push(bannerRoute(b) as never)}
      style={featured ? styles.brandCardFeatured : styles.brandCard}
      accessibilityRole="button"
      accessibilityLabel={b.title}
    >
      <ProductImage src={b.image} style={styles.brandImg} rounded={false} />
      <View style={styles.brandShade} />
      <View style={styles.brandCopy}>
        {b.cta_text ? (
          <View style={styles.brandCta}>
            <Text style={styles.brandCtaText} numberOfLines={1}>
              {b.cta_text}
            </Text>
          </View>
        ) : null}
        <Text style={styles.brandTitle} numberOfLines={2}>
          {b.title}
        </Text>
        {b.subtitle ? (
          <Text style={styles.brandSubtitle} numberOfLines={2}>
            {b.subtitle}
          </Text>
        ) : null}
      </View>
    </Pressable>
  ));

  if (featured) {
    return <View style={styles.brandSingle}>{cards}</View>;
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={BRAND_W + 12}
      decelerationRate="fast"
      contentContainerStyle={styles.railContent}
    >
      {cards}
    </ScrollView>
  );
}

/* ------------------------------------------------------------------ */
/* Festive promo grid (grocery_home_festive_promo placement)           */
/* ------------------------------------------------------------------ */

/* Two cards per row, exactly like the web grid. The width floors and keeps a
   1px safety margin: with `Math.round` a fractional half-pixel (odd screen
   widths such as 393) pushed `2 × width + gap` one pixel past the container,
   so every card wrapped onto its own row. */
const FESTIVE_W = Math.floor((SCREEN_WIDTH - GUTTER * 2 - 12) / 2) - 1;
/* Square, not portrait: the Admin tiles are 330 x 353 and the web grid is
   square too, so this keeps both platforms identical and stops the cards from
   growing tall enough to cover the festive artwork behind them. */
const FESTIVE_H = FESTIVE_W;

/**
 * Blinkit-style festive promo cards — native port of the web
 * `GroceryFestivePromoGrid`. A dense two-column grid of tall image cards that
 * sits directly under the main category sections. Only the Admin-managed
 * `grocery_home_festive_promo` placement is rendered (the page filters it), so
 * a banner for another surface can never appear here.
 */
export function GroceryFestivePromoGrid({ banners }: { banners: Banner[] }) {
  const router = useRouter();
  if (banners.length === 0) return null;

  return (
    <View style={styles.festiveGrid}>
      {banners.map((b) => (
        <Pressable
          key={b.id}
          onPress={() => router.push(bannerRoute(b) as never)}
          style={styles.festiveCard}
          accessibilityRole="button"
          accessibilityLabel={b.title}
        >
          <ProductImage src={b.image} style={styles.brandImg} rounded={false} />
          <View style={styles.brandShade} />
          <View style={styles.festivePromoTop}>
            {b.cta_text ? (
              <View style={styles.brandCta}>
                <Text style={styles.brandCtaText} numberOfLines={1}>
                  {b.cta_text}
                </Text>
              </View>
            ) : null}
            <Text style={styles.festivePromoTitle} numberOfLines={2}>
              {b.title}
            </Text>
            {b.subtitle ? (
              <Text style={styles.brandSubtitle} numberOfLines={2}>
                {b.subtitle}
              </Text>
            ) : null}
          </View>
        </Pressable>
      ))}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Store terms — white card with rating, distance, minimum order...     */
/* ------------------------------------------------------------------ */

/** White card with rating, distance, minimum order and delivery fee (web StoreTerms). */
export function GroceryStoreTerms({ store, distanceKm }: { store: Store; distanceKm: number | null }) {
  const distance = formatDistanceKm(distanceKm);
  const min = Number(store.min_order_amount);
  const fee = Number(store.delivery_fee);

  return (
    <View style={styles.termsCard}>
      <RatingStars rating={store.rating} count={store.rating_count} color={colors.success} size={13} />
      <View style={styles.termsItems}>
        {distance ? (
          <View style={styles.term}>
            <Truck size={13} color={colors.success} />
            <Text style={[styles.termText, styles.termSuccess]}>{distance} away</Text>
          </View>
        ) : null}
        {min > 0 ? (
          <View style={styles.term}>
            <PackageOpen size={13} color={colors.neutral[500]} />
            <Text style={styles.termText}>Min order {formatCurrency(min)}</Text>
          </View>
        ) : null}
        {fee > 0 ? (
          <View style={styles.term}>
            <TagIcon size={13} color={colors.neutral[500]} />
            <Text style={styles.termText}>Delivery {formatCurrency(fee)}</Text>
          </View>
        ) : (
          <View style={styles.term}>
            <TagIcon size={13} color={colors.success} />
            <Text style={[styles.termText, styles.termSuccess]}>Free delivery</Text>
          </View>
        )}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Skeleton placeholders                                               */
/* ------------------------------------------------------------------ */

export function GroceryCategoryRailSkeleton() {
  return (
    <View style={styles.catSkeletonRow}>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <View key={i} style={styles.catSkeletonTile}>
          <View style={styles.catSkeletonCircle} />
          <View style={styles.catSkeletonLabel} />
        </View>
      ))}
    </View>
  );
}

export function GroceryCategoryGridSkeleton() {
  return (
    <View style={styles.section}>
      <View style={styles.skeletonHeading} />
      <View style={styles.grid}>
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <View key={i} style={styles.gridTile}>
            <View style={styles.gridImgWrap} />
            <View style={styles.skeletonTileLabel} />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  /* header ETA */
  etaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  etaText: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '800',
    color: colors.ink[900],
  },
  etaDistance: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  etaDistanceText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.grocery[800],
  },
  etaSkeleton: {
    height: 16,
    width: 120,
    borderRadius: 4,
    backgroundColor: 'rgba(23,20,15,0.12)',
  },

  /* home hero */
  hero: {
    width: '100%',
    overflow: 'hidden',
  },
  /* The scrim only darkens the header / search / category strip. It used to
     fill the whole hero, which tinted the cream festive surface behind the
     promo cards grey; on the web it is likewise limited to the top area. */
  heroScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    /* Ends with the maroon band of the artwork (≈ 62% of the screen width), so
       the arch and cream body below it are never tinted. */
    height: Math.max(230, Math.round(SCREEN_WIDTH * 0.62)),
  },
  heroSearch: {
    paddingHorizontal: GUTTER,
    paddingTop: 12,
  },
  heroNav: {
    paddingTop: 8,
    paddingBottom: 6,
  },
  heroFestive: {
    /* Responsive breathing room between the category strip and the cards:
       scales with the device width so narrow and wide phones both read like
       the web's `pt-5`. */
    paddingTop: Math.max(16, Math.round(SCREEN_WIDTH * 0.20)),
    paddingBottom: Math.max(20, Math.round(SCREEN_WIDTH * 0.07)),
  },

  /* shared section chrome */
  section: {
    gap: 0,
  },
  sectionHead: {
    paddingHorizontal: GUTTER,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
    color: colors.ink[900],
  },
  sectionSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: colors.neutral[500],
  },

  /* category carousel */
  catRail: {
    paddingHorizontal: GUTTER,
    gap: CAT_GAP,
    paddingTop: 4,
  },
  catTile: {
    width: CAT_TILE_W,
    alignItems: 'center',
    gap: 4,
    paddingTop: 4,
    paddingBottom: 10,
  },
  catIconWrap: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catIconPlate: {
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.94)',
  },
  catImg: {
    width: 24,
    height: 24,
  },
  catFallback: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.neutral[100],
  },
  catFallbackActive: {
    backgroundColor: colors.grocery[100],
  },
  catFallbackText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.neutral[500],
  },
  catFallbackTextActive: {
    color: colors.grocery[700],
  },
  catFallbackOnArtwork: {
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  catFallbackOnArtworkActive: {
    backgroundColor: 'rgba(255,255,255,0.26)',
  },
  catFallbackTextOnArtwork: {
    color: '#fff',
  },
  catUnderline: {
    position: 'absolute',
    bottom: 0,
    width: 52,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: 'transparent',
  },
  catUnderlineActive: {
    backgroundColor: colors.ink[900],
  },
  catUnderlineOnArtwork: {
    backgroundColor: '#fff',
  },
  catLabel: {
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 13,
    textAlign: 'center',
    color: colors.neutral[500],
    paddingHorizontal: 2,
  },
  catLabelActive: {
    fontWeight: '700',
    color: colors.ink[900],
  },
  catLabelOnArtwork: {
    color: 'rgba(255,255,255,0.78)',
  },
  catLabelOnArtworkActive: {
    color: '#fff',
  },

  /* category grid */
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
    paddingHorizontal: GUTTER,
  },
  gridTile: {
    width: GRID_TILE_W,
    alignItems: 'center',
    gap: 8,
  },
  gridImgWrap: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 14,
    padding: GRID_TILE_PAD,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.grocery[50],
    overflow: 'hidden',
  },
  gridImgWrapActive: {
    borderWidth: 2,
    borderColor: withAlpha(colors.grocery[500], 0.7),
  },
  gridImg: {
    width: '100%',
    height: '100%',
  },
  gridLabel: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 16,
    textAlign: 'center',
    color: colors.ink[800],
  },
  gridLabelActive: {
    color: colors.grocery[700],
  },

  /* product shelf */
  shelfHead: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: GUTTER,
    marginBottom: 12,
  },
  shelfHeadText: {
    flex: 1,
    minWidth: 0,
  },
  railContent: {
    paddingHorizontal: GUTTER,
    gap: 12,
    paddingBottom: 2,
  },
  railCard: {
    width: RAIL_CARD_W,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: withAlpha(colors.neutral[200], 0.7),
    backgroundColor: '#fff',
    padding: 10,
    shadowColor: 'rgb(16 14 10)',
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  railImgWrap: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    backgroundColor: colors.neutral[100],
    overflow: 'hidden',
    marginBottom: 8,
  },
  railImg: {
    width: '100%',
    height: '100%',
  },
  offBadge: {
    position: 'absolute',
    left: 6,
    top: 6,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: colors.food[600],
  },
  offText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#fff',
  },
  brand: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.neutral[400],
  },
  railName: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink[900],
    minHeight: 17,
  },
  unitRow: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  unit: {
    flexShrink: 1,
    fontSize: 11,
    color: colors.neutral[500],
  },
  railFoot: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
  },
  railPriceCol: {
    flex: 1,
    minWidth: 0,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  price: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.ink[900],
  },
  compare: {
    fontSize: 10,
    color: colors.neutral[400],
    textDecorationLine: 'line-through',
  },
  stockRow: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  inStock: {
    fontSize: 10,
    color: colors.neutral[400],
  },
  outStock: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: '600',
    color: colors.danger,
  },

  /* promo rail */
  promoCard: {
    width: PROMO_CARD_W,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: withAlpha(colors.neutral[200], 0.6),
    backgroundColor: '#fff',
    padding: 14,
    overflow: 'hidden',
    shadowColor: 'rgb(16 14 10)',
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  promoBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 6,
  },
  promoTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  promoIconPlate: {
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
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  promoTitle: {
    marginTop: 10,
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 19,
    color: colors.ink[900],
  },
  promoSubtitle: {
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
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.neutral[300],
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  promoCodeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    color: colors.ink[700],
  },
  promoExplore: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.accent[600],
  },

  /* banner rail */
  bannerRail: {
    paddingHorizontal: GUTTER,
    gap: 12,
    paddingBottom: 2,
  },
  bannerCard: {
    width: BANNER_W,
    height: BANNER_H,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  bannerImg: {
    width: '100%',
    height: '100%',
  },
  bannerShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(16,14,10,0.22)',
  },
  bannerCopy: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 14,
  },
  bannerCta: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 6,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  bannerCtaText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.ink[900],
  },
  bannerTitle: {
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 24,
    color: '#fff',
  },
  bannerSubtitle: {
    marginTop: 2,
    fontSize: 13,
    lineHeight: 17,
    color: 'rgba(255,255,255,0.78)',
  },

  /* brand promo carousel */
  brandSingle: {
    paddingHorizontal: GUTTER,
  },
  brandCardFeatured: {
    width: '100%',
    height: 150,
    borderRadius: 18,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: colors.grocery[100],
  },
  brandCard: {
    width: BRAND_W,
    height: BRAND_H,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: colors.grocery[100],
  },
  brandImg: {
    width: '100%',
    height: '100%',
  },
  brandShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(16,14,10,0.28)',
  },
  brandCopy: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 10,
  },
  festivePromoTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  brandCta: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 4,
    backgroundColor: colors.grocery[500],
  },
  brandCtaText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.ink[900],
  },
  brandTitle: {
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 17,
    color: '#fff',
  },
  festivePromoTitle: {
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 17,
    color: '#fff',
  },
  brandSubtitle: {
    marginTop: 1,
    fontSize: 11,
    lineHeight: 14,
    color: 'rgba(255,255,255,0.8)',
  },

  /* festive promo grid */
  festiveGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: GUTTER,
  },
  festiveCard: {
    width: FESTIVE_W,
    height: FESTIVE_H,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: colors.grocery[100],
  },

  /* store terms */
  termsCard: {
    marginHorizontal: GUTTER,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.grocery[200],
    backgroundColor: '#fff',
    padding: 16,
    gap: 10,
    shadowColor: 'rgb(16 14 10)',
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  termsItems: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 14,
  },
  term: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  termText: {
    fontSize: 12,
    color: colors.neutral[500],
  },
  termSuccess: {
    fontWeight: '800',
    color: colors.success,
  },

  /* skeletons */
  catSkeletonRow: {
    flexDirection: 'row',
    gap: CAT_GAP,
    paddingHorizontal: GUTTER,
    paddingTop: 4,
  },
  catSkeletonTile: {
    width: CAT_TILE_W,
    alignItems: 'center',
    gap: 4,
    paddingTop: 4,
    paddingBottom: 10,
  },
  catSkeletonCircle: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.neutral[200],
  },
  catSkeletonLabel: {
    width: 48,
    height: 10,
    borderRadius: 999,
    backgroundColor: colors.neutral[200],
  },
  skeletonHeading: {
    marginHorizontal: GUTTER,
    marginBottom: 10,
    height: 16,
    width: 140,
    borderRadius: 999,
    backgroundColor: colors.neutral[200],
  },
  skeletonTileLabel: {
    height: 10,
    width: '70%',
    borderRadius: 999,
    backgroundColor: colors.neutral[200],
  },

  /* category header */
  catHeader: {
    paddingHorizontal: GUTTER,
    paddingBottom: 10,
    backgroundColor: colors.grocery[200],
    borderBottomWidth: 1,
    borderBottomColor: colors.grocery[300],
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  catHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  catHeaderBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catHeaderTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    fontWeight: '800',
    color: colors.ink[900],
    paddingHorizontal: 2,
  },
  catCartBadge: {
    position: 'absolute',
    top: 1,
    right: 1,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.ink[900],
  },
  catCartBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#fff',
  },
  catAvatar: {
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.grocery[200],
    marginLeft: 2,
  },
  catLocRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  catLocMuted: {
    fontSize: 12,
    color: colors.neutral[500],
  },
  catLocLabel: {
    flexShrink: 0,
    fontSize: 12,
    fontWeight: '800',
    color: colors.ink[900],
  },
  catLocAddr: {
    flex: 1,
    minWidth: 0,
    fontSize: 12,
    color: colors.neutral[500],
  },
});
