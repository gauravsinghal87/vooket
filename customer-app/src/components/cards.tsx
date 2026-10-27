import { Pressable, Share, StyleSheet, Text, View, useWindowDimensions, type ViewStyle } from 'react-native';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { BadgePercent, Bike, Bookmark, ChevronRight, Clock, MapPin, Share2, Star } from 'lucide-react-native';
import type { Banner, Offer, Restaurant, Store, Product, Category } from '@/types/catalog';
import { discountPercent, formatCurrency, ratingLabel } from '@/lib/utils';
import { hasActiveOptionGroups } from '@/lib/productOptions';
import { useCart } from '@/hooks/useCart';
import { AddToCartControl } from '@/components/product/AddToCart';
import { carryProduct } from '@/lib/routeState';
import { ProductImage } from '@/components/ui/ProductImage';
import { RatingStars, VegMark } from '@/components/ui/primitives';
import { NotchRestaurantCard } from '@/components/restaurant/NotchRestaurantCard';
import { colors } from '@/theme';
import { toast } from '@/stores/toastStore';
import { getBranding } from '@/lib/branding';

/* ------------------------------------------------------------------ */
/* Saved-for-later products                                            */
/* ------------------------------------------------------------------ */

// There is no server-side wishlist endpoint, so the bookmark persists to this
// device instead of pretending to sync. `null` means "not loaded yet".
const SAVED_KEY = 'sb.saved-products';

async function readSaved(): Promise<number[]> {
  try {
    const raw = await AsyncStorage.getItem(SAVED_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((n): n is number => typeof n === 'number') : [];
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ */
/* RestaurantCard                                                    */
/* ------------------------------------------------------------------ */

/**
 * The card used by the Restaurants grid (`/restaurants`).
 *
 * It shares the "notch" design with the Food grids — rounded top corners on
 * the photo, a green rating pill in the white notch cut into the photo's
 * bottom-left, and the name and the delivery estimate on the page background
 * below it. The listing-specific facts (prep time, delivery fee, minimum
 * order) stay as an extra row underneath, exactly as before.
 */
export function RestaurantCard({
  restaurant,
  horizontal = false,
}: {
  restaurant: Restaurant;
  horizontal?: boolean;
}) {
  const riskfree = parseFloat(restaurant.delivery_fee) === 0 || restaurant.free_delivery_above !== null;
  const prep = restaurant.avg_delivery_time_min || restaurant.avg_prep_time_min || '—';
  const fee = riskfree ? 'Free' : `₹${restaurant.delivery_fee}`;
  const minOrder = restaurant.min_order_amount ? `₹${restaurant.min_order_amount}+` : '—';

  return (
    <NotchRestaurantCard
      restaurant={restaurant}
      size="md"
      style={horizontal ? styles.cardH : undefined}
    >
      <View style={styles.factsRow}>
        <View style={styles.fact}>
          <Clock size={12} color={colors.neutral[400]} />
          <Text style={styles.factText}>{prep} min</Text>
        </View>
        <View style={styles.fact}>
          <Bike size={12} color={colors.neutral[400]} />
          <Text style={styles.factText}>{fee}</Text>
        </View>
        <View style={styles.fact}>
          <MapPin size={12} color={colors.neutral[400]} />
          <Text style={styles.factText}>{minOrder}</Text>
        </View>
      </View>
    </NotchRestaurantCard>
  );
}

/* ------------------------------------------------------------------ */
/* StoreCard                                                           */
/* ------------------------------------------------------------------ */

export function StoreCard({ store, horizontal = false }: { store: Store; horizontal?: boolean }) {
  const router = useRouter();
  const freeAbove = store.free_delivery_above ? parseFloat(store.free_delivery_above) : null;

  return (
    <Pressable
      onPress={() => router.push(`/store/${store.id}` as never)}
      style={({ pressed }) => [styles.card, horizontal && styles.cardH, pressed && { opacity: 0.94 }]}
    >
      <View style={styles.cover}>
        <ProductImage src={store.cover_image ?? store.logo} style={styles.coverImg} rounded={false} />
        <View style={styles.coverShade} />
        {store.is_open ? (
          <View style={[styles.offerBadge, { backgroundColor: colors.grocery[600] }]}>
            <BadgePercent size={13} color="#fff" />
            <Text style={styles.offerBadgeText}>
              {freeAbove != null ? `Free above ₹${freeAbove}` : 'Free delivery'}
            </Text>
          </View>
        ) : (
          <View style={styles.closedOverlay}>
            <Text style={styles.closedText}>Closed now</Text>
          </View>
        )}
        {store.avg_rating || store.rating ? (
          <View style={styles.ratingBadge}>
            <Text style={styles.ratingBadgeText}>{ratingLabel(store.avg_rating ?? store.rating)}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {store.name}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {store.description ?? `${store.store_type} store`}
        </Text>
        <View style={styles.metaRow}>
          <View style={styles.meta}>
            <Bike size={13} color={colors.neutral[400]} />
            <Text style={styles.metaText}>
              {parseFloat(store.delivery_fee) === 0 ? 'Free delivery' : formatCurrency(store.delivery_fee)}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/* Food product row (list) with an add/stepper control                */
/* ------------------------------------------------------------------ */

export function FoodProductRow({
  product,
  onAdd,
  stepMode,
}: {
  product: Product;
  onAdd?: () => void;
  stepMode?: boolean;
}) {
  const router = useRouter();
  const weightLabel = product.unit_label
    ? product.unit_label
    : [product.unit_value, product.unit_type].filter(Boolean).join(' ');
  const compare = product.compare_at_price ? parseFloat(product.compare_at_price) : null;
  const price = parseFloat(product.price);
  const hasDiscount = compare && compare > price;

  return (
    <Pressable
      onPress={() => {
        carryProduct(product, 'food');
        router.push(`/product/${product.id}?service=food` as never);
      }}
      style={({ pressed }) => [styles.foodRow, pressed && { opacity: 0.94 }]}
    >
      <View style={styles.foodInfo}>
        <View style={styles.foodTitleRow}>
          <VegMark isVeg={product.is_veg} size={13} />
          <Text style={styles.foodTitle} numberOfLines={2}>
            {product.name}
          </Text>
        </View>
        {product.description ? (
          <Text style={styles.foodDesc} numberOfLines={1}>
            {product.description}
          </Text>
        ) : null}
        <View style={styles.foodPriceRow}>
          <Text style={styles.foodPrice}>{formatCurrency(price)}</Text>
          {hasDiscount && <Text style={styles.comparePrice}>{formatCurrency(compare as number)}</Text>}
        </View>
      </View>
      <View style={styles.foodRight}>
        <ProductImage src={product.image} size={96} />
        {weightLabel ? <Text style={styles.unitLabel}>{weightLabel}</Text> : null}
        <View style={styles.addWrap}>
          <StepperMini
            stepMode={stepMode}
            onAdd={onAdd}
            color={colors.food[600]}
          />
        </View>
      </View>
    </Pressable>
  );
}

function StepperMini({ onAdd, color, stepMode }: { onAdd?: () => void; color: string; stepMode?: boolean }) {
  // Stateless "add" button for now; the cart screen owns quantity state.
  return (
    <Pressable
      onPress={onAdd}
      style={[
        styles.addBtn,
        { borderColor: color },
      ]}
      accessibilityLabel="Add item"
    >
      <Text style={[styles.addBtnText, { color }]}>+</Text>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/* Grocery product tile (grid) with an add/stepper                    */
/* ------------------------------------------------------------------ */

interface GroceryAddProps {
  quantity: number;
  onAdd: () => void;
  onIncrement: () => void;
  onDecrement: () => void;
  color?: string;
}

export function GroceryAddControl({ quantity, onAdd, onIncrement, onDecrement, color = colors.grocery[700] }: GroceryAddProps) {
  if (quantity <= 0) {
    return (
      <Pressable onPress={onAdd} style={[styles.groceryAdd, { borderColor: color }]} hitSlop={8}>
        <Text style={[styles.groceryAddText, { color }]}>+</Text>
      </Pressable>
    );
  }
  return (
    <View style={styles.grocerystep}>
      <Pressable onPress={onDecrement} hitSlop={8} style={styles.grocerystepBtn} accessibilityLabel="Decrease quantity">
        <Text style={styles.grocerystepText}>−</Text>
      </Pressable>
      <Text style={[styles.grocerystepCount, { color }]}>{quantity}</Text>
      <Pressable onPress={onIncrement} hitSlop={8} style={styles.grocerystepBtn} accessibilityLabel="Increase quantity">
        <Text style={styles.grocerystepText}>+</Text>
      </Pressable>
    </View>
  );
}

export function GroceryProductTile({
  product,
  quantity,
  onAdd,
  onIncrement,
  onDecrement,
  style,
}: {
  product: Product;
  quantity: number;
  onAdd: () => void;
  onIncrement: () => void;
  onDecrement: () => void;
  style?: ViewStyle;
}) {
  const router = useRouter();
  const price = parseFloat(product.price);
  const compare = product.compare_at_price ? parseFloat(product.compare_at_price) : null;
  const hasDiscount = compare && compare > price;
  const unit = product.unit_label ?? [product.unit_value, product.unit_type].filter(Boolean).join(' ');

  return (
    <Pressable
      onPress={() => {
        carryProduct(product, 'grocery');
        router.push(`/product/${product.id}?service=grocery` as never);
      }}
      style={[styles.groceryTile, style]}
    >
      <ProductImage src={product.image} size={110} />
      {hasDiscount ? (
        <View style={styles.discountBadge}>
          <Text style={styles.discountBadgeText}>
            {Math.round(((compare as number) - price) / (compare as number) * 100)}% OFF
          </Text>
        </View>
      ) : null}
      {product.is_veg != null ? (
        <View style={styles.tileVeg}>
          <VegMark isVeg={product.is_veg} size={12} />
        </View>
      ) : null}
      <Text style={styles.groceryName} numberOfLines={2}>
        {product.name}
      </Text>
      {unit ? <Text style={styles.groceryUnit} numberOfLines={1}>{unit}</Text> : null}
      <View style={styles.groceryPriceRow}>
        <Text style={styles.groceryPrice}>{formatCurrency(price)}</Text>
        <View style={styles.groceryAddBox}>
          <GroceryAddControl
            quantity={quantity}
            onAdd={onAdd}
            onIncrement={onIncrement}
            onDecrement={onDecrement}
          />
        </View>
      </View>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/* Promo / offer card                                                  */
/* ------------------------------------------------------------------ */

export function PromoCard({ offer, compact = false }: { offer: Offer; compact?: boolean }) {
  const code = offer.code ?? offer.tag ?? offer.title;
  const value =
    offer.type === 'percentage'
      ? `${offer.type === 'percentage' ? '' : ''}${offer.value ?? ''}%`
      : formatCurrency(offer.value ?? 0);
  const head = offer.type === 'percentage' ? `${offer.value ?? ''}% OFF` : `Flat ${formatCurrency(offer.value ?? 0)}`;
  return (
    <View style={[styles.promoCard, compact && { width: 210 }]}>
      <Text style={styles.promoHead} numberOfLines={1}>
        {head}
      </Text>
      <Text style={styles.promoTitle} numberOfLines={compact ? 2 : 1}>
        {offer.title}
      </Text>
      {offer.code ? (
        <View style={styles.couponChip}>
          <Text style={styles.couponChipText}>Use {offer.code}</Text>
        </View>
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Banner carousel                                                     */
/* ------------------------------------------------------------------ */

export function BannerCarousel({ banners }: { banners: Banner[] }) {
  if (banners.length === 0) return null;
  return (
    <View style={styles.bannerRail}>
      {banners.slice(0, 6).map((b, i) => (
        <Pressable
          key={b.id ?? i}
          style={styles.bannerCard}
          onPress={() => {
            if (!b.target_url) return;
          }}
        >
          <ProductImage src={b.image} style={styles.bannerImg} rounded={false} />
          <View style={styles.bannerOverlay}>
            <Text style={styles.bannerTitle} numberOfLines={1}>
              {b.title}
            </Text>
            {b.subtitle ? (
              <Text style={styles.bannerSubtitle} numberOfLines={1}>
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
/* Category chip strip                                                 */
/* ------------------------------------------------------------------ */

export function CategoryStrip({
  categories,
  onPress,
}: {
  categories: Category[];
  onPress?: (id: number, name: string) => void;
}) {
  return (
    <View style={styles.catRow}>
      {categories.slice(0, 10).map((c) => (
        <Pressable key={c.id} style={styles.catChip} onPress={() => onPress?.(c.id, c.name)}>
          <ProductImage src={c.image} size={44} rounded />
          <Text style={styles.catName} numberOfLines={1}>
            {c.name}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export { RatingStars };

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(214,211,204,0.7)',
    shadowColor: 'rgb(16 14 10)',
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
    overflow: 'hidden',
  },
  cardH: {
    width: 248,
  },
  /* The listing-specific facts of the Restaurants grid card. */
  factsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.neutral[100],
  },
  fact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  factText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.neutral[500],
  },
  cover: {
    position: 'relative',
    height: 144,
    overflow: 'hidden',
  },
  coverImg: {
    width: '100%',
    height: '100%',
  },
  coverShade: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(16,14,10,0.18)',
  },
  offerBadge: {
    position: 'absolute',
    left: 10,
    top: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.food[600],
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  offerBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  favBtn: {
    position: 'absolute',
    right: 10,
    top: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(16,14,10,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closedOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16,14,10,0.55)',
  },
  closedText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  ratingBadge: {
    position: 'absolute',
    left: 10,
    bottom: 10,
    backgroundColor: colors.success,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  ratingBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  body: {
    padding: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    color: colors.ink[900],
    letterSpacing: -0.3,
  },
  subtitle: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: '500',
    color: colors.neutral[500],
  },
  metaRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.ink[50],
    paddingTop: 10,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.neutral[500],
  },
  ratingsText: {
    fontSize: 12,
    color: colors.neutral[400],
  },
  foodRow: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 14,
  },
  foodInfo: {
    flex: 1,
  },
  foodTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  foodTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink[900],
  },
  foodDesc: {
    marginTop: 4,
    fontSize: 12.5,
    color: colors.neutral[500],
  },
  foodPriceRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  foodPrice: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.ink[900],
  },
  comparePrice: {
    fontSize: 13,
    color: colors.neutral[400],
    textDecorationLine: 'line-through',
  },
  foodRight: {
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  unitLabel: {
    fontSize: 12,
    color: colors.neutral[500],
    marginTop: 4,
    fontWeight: '700',
  },
  addWrap: {
    marginTop: 6,
  },
  addBtn: {
    width: 66,
    height: 30,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: {
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 20,
  },
  groceryTile: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 10,
    gap: 4,
    borderWidth: 1,
    borderColor: colors.ink[50],
  },
  discountBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: colors.grocery[600],
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  discountBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  tileVeg: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  groceryName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.ink[900],
    marginTop: 6,
  },
  groceryUnit: {
    fontSize: 11.5,
    color: colors.neutral[500],
  },
  groceryPriceRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  groceryPrice: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.ink[900],
  },
  groceryAddBox: {
    marginBottom: -4,
  },
  groceryAdd: {
    width: 44,
    height: 30,
    borderRadius: 10,
    borderWidth: 1.5,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  groceryAddText: {
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 22,
  },
  grocerystep: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.grocery[600],
    borderRadius: 10,
    backgroundColor: '#fff',
  },
  grocerystepBtn: {
    width: 28,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grocerystepText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.grocery[700],
  },
  grocerystepCount: {
    minWidth: 22,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '800',
  },
  promoCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    gap: 4,
    borderWidth: 1,
    borderColor: colors.ink[50],
    minWidth: 150,
    flex: 1,
  },
  promoHead: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.food[600],
  },
  promoTitle: {
    fontSize: 13,
    color: colors.ink[700],
    fontWeight: '600',
  },
  couponChip: {
    alignSelf: 'flex-start',
    marginTop: 6,
    backgroundColor: colors.ink[50],
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  couponChipText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.ink[700],
  },
  bannerRail: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
  },
  bannerCard: {
    width: 240,
    height: 120,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  bannerImg: {
    width: '100%',
    height: '100%',
  },
  bannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    padding: 12,
    backgroundColor: 'rgba(16,14,10,0.25)',
  },
  bannerTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  bannerSubtitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
  },
  catRow: {
    flexDirection: 'row',
    gap: 14,
    paddingHorizontal: 16,
  },
  catChip: {
    alignItems: 'center',
    gap: 6,
    width: 66,
  },
  catName: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink[700],
    textAlign: 'center',
  },
});

/* ------------------------------------------------------------------ */
/* MenuItemRow (product list item in restaurant/store detail)        */
/* ------------------------------------------------------------------ */

export function MenuItemRow({ product, type = 'food' }: { product: Product; type?: 'food' | 'grocery' }) {
  const router = useRouter();
  const off = discountPercent(product);
  const variable = product.product_type === 'variable' || hasActiveOptionGroups(product);
  const compare = product.compare_at_price ? parseFloat(product.compare_at_price) : null;
  const price = parseFloat(product.price);
  const hasDiscount = compare !== null && compare > price;

  const [saved, setSaved] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    void readSaved().then((ids) => alive && setSaved(ids.includes(product.id)));
    return () => {
      alive = false;
    };
  }, [product.id]);

  const goProduct = () => {
    carryProduct(product, type);
    router.push(`/product/${product.id}?service=${type}` as never);
  };

  const toggleSaved = async () => {
    const ids = await readSaved();
    const next = ids.includes(product.id) ? ids.filter((id) => id !== product.id) : [...ids, product.id];
    try {
      await AsyncStorage.setItem(SAVED_KEY, JSON.stringify(next));
    } catch {
      /* Storage may be unavailable; the state below still reflects the tap. */
    }
    const nowSaved = next.includes(product.id);
    setSaved(nowSaved);
    toast(nowSaved ? 'Saved for later' : 'Removed from saved items');
  };

  const shareItem = () => {
    void Share.share({ message: `${product.name} on ${getBranding().name}` }).catch(() => undefined);
  };

  /*
   * Zomato's menu row, mirrored: the veg mark, name, price and description
   * stack in the left column with the save/share actions underneath, while the
   * dish photo sits on the right with the ADD pill straddling its bottom edge
   * and the `customisable` caption beneath it.
   */
  return (
    <Pressable onPress={goProduct} style={({ pressed }) => [itemStyles.itemRow, pressed && { opacity: 0.94 }]}>
      <View style={itemStyles.info}>
        {product.is_veg !== null && (
          <View style={itemStyles.vegRow}>
            <VegMark isVeg={product.is_veg} size={16} />
          </View>
        )}

        <Text style={itemStyles.name}>{product.name}</Text>

        {product.is_featured ? (
          <View style={itemStyles.bestBadge}>
            <Star size={10} color="#b45309" fill="#f59e0b" strokeWidth={0} />
            <Text style={itemStyles.bestText}>Bestseller</Text>
          </View>
        ) : null}

        <View style={itemStyles.priceRow}>
          <Text style={itemStyles.price}>{formatCurrency(price)}</Text>
          {hasDiscount && <Text style={itemStyles.compare}>{formatCurrency(compare as number)}</Text>}
        </View>
        {off !== null && product.is_available && (
          <Text style={[itemStyles.offLine, { color: colors.zInfo ?? colors.food[600] }]}>{off}% OFF</Text>
        )}
        {product.description ? (
          <Text style={itemStyles.desc} numberOfLines={2}>
            {product.description}
          </Text>
        ) : null}
        {!product.is_available && <Text style={itemStyles.outOfStock}>Out of stock</Text>}

        {/* Save and share, as circular hairline buttons under the copy. */}
        <View style={itemStyles.rowActions}>
          <Pressable
            onPress={() => void toggleSaved()}
            accessibilityRole="button"
            accessibilityState={{ selected: saved === true }}
            accessibilityLabel={
              saved ? `Remove ${product.name} from saved items` : `Save ${product.name} for later`
            }
            style={[
              itemStyles.actionBtn,
              saved === true && { borderColor: colors.food[600], backgroundColor: colors.food[50] },
            ]}
            hitSlop={6}
          >
            <Bookmark
              size={16}
              color={saved === true ? colors.food[600] : colors.neutral[500]}
              fill={saved === true ? colors.food[600] : 'transparent'}
              strokeWidth={1.8}
            />
          </Pressable>
          <Pressable
            onPress={shareItem}
            accessibilityRole="button"
            accessibilityLabel={`Share ${product.name}`}
            style={itemStyles.actionBtn}
            hitSlop={6}
          >
            <Share2 size={16} color={colors.neutral[500]} strokeWidth={1.8} />
          </Pressable>
        </View>
      </View>

      {/* Right — the dish photo with the ADD pill straddling its lower edge. */}
      <View style={itemStyles.thumbColRight}>
        <View style={itemStyles.thumbRight}>
          {/* The photo is clipped in its own inner box; the ADD pill lives in
              the outer (unclipped) wrapper so it can hang off the bottom edge
              exactly as it does on the web. */}
          <View style={itemStyles.thumbFace}>
            <ProductImage src={product.image} style={itemStyles.thumbImg} rounded={false} />
            {!product.is_available && <View style={itemStyles.thumbShade} />}
          </View>
          <View style={itemStyles.addOverlay}>
            <AddToCartControl productId={product.id} type={type} size="outline" product={product} />
          </View>
        </View>
        {variable ? <Text style={itemStyles.customLabel}>customisable</Text> : null}
      </View>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/* ViewCartBar (floating bar shown when a cart has items)            */
/* ------------------------------------------------------------------ */

export function ViewCartBar({ type }: { type: 'food' | 'grocery' }) {
  const router = useRouter();
  const { data: cart } = useCart(type);
  const count = (cart?.items ?? []).reduce((n, i) => n + i.quantity, 0);
  if (!cart || count === 0) return null;

  const grocery = type === 'grocery';
  const barColor = grocery ? colors.grocery[500] : colors.food[600];
  const label = `${count} ${count === 1 ? 'item' : 'items'}`;

  return (
    <Pressable
      onPress={() => router.push(`/cart?type=${type}` as never)}
      style={[itemStyles.vcBar, { backgroundColor: barColor }]}
      accessibilityLabel={`View cart, ${label}, total ${formatCurrency(cart.total)}`}
    >
      <Text
        style={[
          itemStyles.vcLabel,
          grocery ? { color: colors.ink[900] } : { color: '#fff' },
        ]}
      >
        {label}
      </Text>
      <Text
        style={[
          itemStyles.vcTotal,
          grocery ? { color: colors.ink[900] } : { color: '#fff' },
        ]}
      >
        {formatCurrency(cart.total)}
      </Text>
      <View
        style={[
          itemStyles.vcChip,
          grocery ? { backgroundColor: 'rgba(0,0,0,0.12)' } : { backgroundColor: 'rgba(255,255,255,0.2)' },
        ]}
      >
        <Text style={[itemStyles.vcChipText, grocery ? { color: colors.ink[900] } : { color: '#fff' }]}>
          View Cart
        </Text>
        <ChevronRight size={14} color={grocery ? colors.ink[900] : '#fff'} />
      </View>
    </Pressable>
  );
}

const itemStyles = StyleSheet.create({
  itemRow: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 16,
  },
  info: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  offBadge: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  offText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#fff',
  },
  bestText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: '#b45309',
  },
  name: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.ink[900],
    lineHeight: 22,
  },
  vegRow: {
    marginBottom: 8,
  },
  bestBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginTop: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.3)',
    backgroundColor: 'rgba(245,158,11,0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginTop: 4,
  },
  price: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink[900],
  },
  compare: {
    fontSize: 12,
    color: colors.neutral[400],
    textDecorationLine: 'line-through',
  },
  desc: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 19,
    color: colors.neutral[500],
    maxWidth: 240,
  },
  /* Save + share, as circular hairline buttons under the copy. */
  rowActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  outOfStock: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.danger,
  },
  thumbCol: {
    alignSelf: 'flex-start',
    alignItems: 'center',
  },
  thumb: {
    position: 'relative',
    // Reserves room for the overhanging selector so the next row / divider can
    // never be covered by it.
    marginBottom: 18,
  },
  thumbImg: {
    width: '100%',
    height: '100%',
    borderRadius: 14,
  },
  thumbShade: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 14,
    backgroundColor: 'rgba(16,14,10,0.45)',
  },
  /* The photo column: square, sized so three of them stay comfortable beside
     the copy, with the ADD pill hanging half off its lower edge. */
  thumbColRight: {
    width: 150,
    alignSelf: 'flex-start',
  },
  thumbRight: {
    width: '100%',
    aspectRatio: 1,
    // Deliberately NOT clipped: the ADD pill overhangs this box on purpose.
    position: 'relative',
    // Reserves the pill's 22pt overhang in layout, so the row's own height
    // always clears the divider below it.
    marginBottom: 22,
  },
  // The clipping parent for the photo itself.
  thumbFace: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: colors.neutral[100],
  },
  addOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    // Straddles the photo's bottom edge: half in, half out, as in the
    // reference. It is centred rather than flush, so the pill never spills past
    // the row on narrow screens.
    bottom: -22,
    alignItems: 'center',
    zIndex: 2,
  },
  customLabel: {
    marginTop: 6,
    fontSize: 12,
    color: colors.neutral[400],
    textAlign: 'center',
  },
  /* Zomato row: photo left (veg mark on its corner), ADD column right */
  thumbColLeft: {
    alignSelf: 'flex-start',
  },
  thumbLeft: {
    width: 84,
    height: 84,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: colors.neutral[100],
  },
  cornerVeg: {
    position: 'absolute',
    top: 5,
    left: 5,
    backgroundColor: '#fff',
    borderRadius: 4,
    padding: 2,
  },
  addCol: {
    width: 104,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  offLine: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: '700',
  },
  vcBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  vcLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  vcTotal: {
    marginLeft: 'auto',
    fontSize: 14,
    fontWeight: '800',
  },
  vcChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  vcChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
});

/* ------------------------------------------------------------------ */
/* ProductGridCard (grocery grid product card)                        */
/* ------------------------------------------------------------------ */

export function ProductGridCard({ product, type = 'grocery' }: { product: Product; type?: 'grocery' | 'food' }) {
  const router = useRouter();
  const off = discountPercent(product);
  const compare = product.compare_at_price ? parseFloat(product.compare_at_price) : null;
  const price = parseFloat(product.price);
  const hasDiscount = compare !== null && compare > price;

  return (
    <Pressable
      onPress={() => {
        carryProduct(product, type);
        router.push(`/product/${product.id}?service=${type}` as never);
      }}
      style={({ pressed }) => [gridStyles.card, pressed && { opacity: 0.94 }]}
    >
      <View style={gridStyles.imgWrap}>
        <ProductImage src={product.image} style={gridStyles.img} rounded={false} />
        {off !== null && product.is_available && (
          <View style={gridStyles.offBadge}>
            <Text style={gridStyles.offText}>{off}% off</Text>
          </View>
        )}
      </View>

      <View style={gridStyles.body}>
        {product.brand?.name ? (
          <Text style={gridStyles.brand} numberOfLines={1}>
            {product.brand.name}
          </Text>
        ) : null}
        <Text style={gridStyles.prodName} numberOfLines={2}>
          {product.name}
        </Text>
        {product.unit_label ? (
          <View style={gridStyles.unitRow}>
            <Text style={gridStyles.unit}>{product.unit_label}</Text>
            {product.is_veg !== null && <VegMark isVeg={product.is_veg} size={10} />}
          </View>
        ) : null}

        <View style={gridStyles.priceRow}>
          <Text style={gridStyles.price}>{formatCurrency(price)}</Text>
          {hasDiscount && <Text style={gridStyles.compare}>{formatCurrency(compare as number)}</Text>}
        </View>
        {product.is_available ? (
          <Text style={gridStyles.inStock}>In stock</Text>
        ) : (
          <Text style={gridStyles.outStock}>Out of stock</Text>
        )}
        <View style={gridStyles.addWrap}>
          <AddToCartControl productId={product.id} type="grocery" size="icon" product={product} />
        </View>
      </View>
    </Pressable>
  );
}

const gridStyles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    padding: 10,
  },
  imgWrap: {
    aspectRatio: 1,
    borderRadius: 12,
    backgroundColor: colors.neutral[100],
    overflow: 'hidden',
  },
  img: {
    width: '100%',
    height: '100%',
  },
  offBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: colors.food[600],
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  offText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#fff',
  },
  body: {
    paddingTop: 8,
  },
  brand: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: colors.neutral[400],
  },
  prodName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink[900],
    marginTop: 2,
    minHeight: 32,
  },
  unitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  unit: {
    fontSize: 11,
    color: colors.neutral[500],
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginTop: 6,
  },
  price: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.ink[900],
  },
  compare: {
    fontSize: 10,
    color: colors.neutral[400],
    textDecorationLine: 'line-through',
  },
  inStock: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: '700',
    color: colors.warning,
  },
  outStock: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: '700',
    color: colors.danger,
  },
  addWrap: {
    marginTop: 8,
    alignItems: 'flex-start',
  },
});