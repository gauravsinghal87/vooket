import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { BadgePercent, Clock, Star } from 'lucide-react-native';
import { repositories } from '@/shared/repositories';
import type { Product, Restaurant } from '@/shared/types/catalog';
import { formatDistanceKm } from '@/shared/utils/geo';
import { deliveryDistanceKm, deliveryEtaText } from '@/shared/utils/deliveryEta';
import { ProductImage } from '@/shared/components/ui/ProductImage';
import { VegMark } from '@/shared/components/ui/primitives';
import { colors, featured } from '@/modules/food/styles/theme';
import { restaurantOffer, restaurantRating } from '@/modules/food/components/restaurant/restaurantCardParts';

/** ₹ price in the Indian grouping, the way the reference prints it. */
const dishPrice = (price: string | number) => `₹${Number(price).toLocaleString('en-IN')}`;

/**
 * How many dish slides a card shows: enough to swipe through, few enough that
 * the rail never becomes a full menu on the home page.
 */
const MAX_DISH_SLIDES = 8;

/** How long each dish stays on screen before the rail advances by itself. */
const AUTOPLAY_MS = 3000;

/**
 * The large, single restaurant card — the one used by the "Restaurants
 * delivering to you" feed, recreated from the reference's featured card:
 *
 *  - a 5:3 media area that is a **paging slider of the kitchen's own dishes**,
 *    each slide carrying its price in the top-left corner. The dishes come
 *    from the menu endpoint (`['restaurant-menu', id]`, the same cache the
 *    cart and the detail page share);
 *  - while that loads — and for kitchens without any dish photo — the area
 *    keeps the single cover photo with the offer/dish chip over its top-left,
 *    exactly as before;
 *  - a white panel underneath: the name in large bold type with the green
 *    rounded rating pill hard right, the ETA | distance meta line, and the
 *    blue-icon offer row.
 *
 * Native has no IntersectionObserver, so unlike web the menu is requested
 * when the card mounts rather than when it nears the viewport; the results are
 * cached for five minutes and shared with every other menu screen.
 *
 * The card carries no favourite button (the feed does not support
 * favourites), so that control is not drawn.
 *
 * There is deliberately no notch here: the notched look belongs to the
 * compact grid card only (`NotchRestaurantCard`).
 *
 * Everything here is native React Native layout and styles — no web CSS.
 */
export interface FeaturedRestaurantCardProps {
  restaurant: Restaurant;
  /** Client-side distance, used only when the API returned no routed estimate. */
  distanceKm?: number | null;
  /** Extra rows rendered under the meta line. */
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function FeaturedRestaurantCard({
  restaurant,
  distanceKm,
  children,
  style,
}: FeaturedRestaurantCardProps) {
  const router = useRouter();

  const rating = restaurantRating(restaurant);
  const offer = restaurantOffer(restaurant);
  const featuredItem = restaurant.featured_item ?? null;

  // The photo area is a slider of this kitchen's dishes, so the card asks for
  // its menu — the feed payload carries no products. One query per restaurant,
  // cached under the same key the cart and detail pages already use.
  const [mediaSize, setMediaSize] = useState({ width: 0, height: 0 });
  const [slideIndex, setSlideIndex] = useState(0);

  const menu = useQuery({
    queryKey: ['restaurant-menu', restaurant.id],
    queryFn: () => repositories.food.getMenu(restaurant.id),
    staleTime: 5 * 60 * 1000,
  });

  // Dishes that actually have a photo, featured ones first so the opening
  // slide is the kitchen's signature plate.
  const slides = useMemo(() => {
    const withPhoto = (menu.data ?? []).flatMap((c) => c.products ?? []).filter((p): p is Product => !!p.image);
    return withPhoto
      .sort((a, b) => Number(b.is_featured) - Number(a.is_featured))
      .slice(0, MAX_DISH_SLIDES);
  }, [menu.data]);

  const hasSlides = slides.length > 0 && mediaSize.width > 0 && mediaSize.height > 0;
  const activeSlide = hasSlides ? Math.min(slideIndex, slides.length - 1) : 0;

  // Auto-play: a new dish every three seconds, like the reference. The index
  // also lives in a ref because the timer has to read the *current* slide, not
  // the one captured when the timer was created.
  const railRef = useRef<ScrollView>(null);
  const slideCountRef = useRef(0);
  const slideIndexRef = useRef(0);
  const draggingRef = useRef(false);
  const autoScrollingRef = useRef(false);
  const lastInteractionRef = useRef(0);

  useEffect(() => {
    slideCountRef.current = slides.length;
    if (slides.length < 2 || mediaSize.width <= 0) return;

    const width = mediaSize.width;
    const id = setInterval(() => {
      if (draggingRef.current) return;
      // Three seconds of *stillness* between slides: swiping restarts the
      // countdown, so the card never moves out from under the thumb.
      if (Date.now() - lastInteractionRef.current < AUTOPLAY_MS) return;

      const count = slideCountRef.current;
      const current = Math.min(Math.max(slideIndexRef.current, 0), count - 1);
      const next = (current + 1) % count;
      autoScrollingRef.current = true;
      slideIndexRef.current = next;
      setSlideIndex(next);
      railRef.current?.scrollTo({ x: next * width, animated: true });
      // Safety net: if a platform never reports the programmatic settle, the
      // flag must still clear — otherwise it would swallow the customer's next
      // real gesture.
      setTimeout(() => {
        autoScrollingRef.current = false;
      }, 800);
    }, AUTOPLAY_MS);

    return () => clearInterval(id);
  }, [slides.length, mediaSize.width]);

  // Dragging to the next page with no throw still settles, so the dot tracks
  // the slide on both momentum and plain release. A settle produced by the
  // auto-play scroll is not a customer gesture, so it must not restart the
  // countdown — otherwise every other slide would be skipped.
  const settleSlides = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    draggingRef.current = false;
    const page = mediaSize.width || 1;
    const index = Math.round(e.nativeEvent.contentOffset.x / page);
    slideIndexRef.current = index;
    setSlideIndex(index);

    if (autoScrollingRef.current) {
      autoScrollingRef.current = false;
      return;
    }
    lastInteractionRef.current = Date.now();
  };

  // ETA and route distance come from the backend estimate for the customer's
  // delivery location; the client-side distance is only a fallback for when the
  // API could not return a routed estimate. The reference separates the two
  // with a pipe, not a middot.
  const etaText = deliveryEtaText(restaurant);
  const distanceLabel = formatDistanceKm(deliveryDistanceKm(restaurant) ?? distanceKm);
  const metaText = [etaText, distanceLabel].filter(Boolean).join(' | ') || '—';

  // The badge over a cover photo names the featured dish and its real price, as
  // in the reference; kitchens without one fall back to their offer text. It is
  // only used when the dish slider has nothing to show.
  const badgeText = featuredItem
    ? `${featuredItem.name} · ${dishPrice(featuredItem.price)}`
    : offer;

  return (
    <Pressable
      onPress={() => router.push(`/restaurant/${restaurant.id}` as never)}
      style={({ pressed }) => [style, pressed && { opacity: 0.97 }]}
      accessibilityLabel={restaurant.name}
    >
      <View style={styles.card}>
        <View
          style={styles.media}
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout;
            setMediaSize((prev) =>
              prev.width === width && prev.height === height ? prev : { width, height }
            );
          }}
        >
          {hasSlides ? (
            <>
              {/* One dish per page, snapped by `pagingEnabled`; the price sits
                  in the left corner of the slide it belongs to, so it always
                  names the dish on screen. */}
              <ScrollView
                ref={railRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={settleSlides}
                onScrollEndDrag={settleSlides}
                onScrollBeginDrag={() => {
                  draggingRef.current = true;
                  lastInteractionRef.current = Date.now();
                }}
                scrollEventThrottle={32}
                style={styles.rail}
                contentContainerStyle={{
                  width: mediaSize.width * slides.length,
                  height: mediaSize.height,
                }}
                accessibilityLabel={`${restaurant.name} dishes`}
              >
                {slides.map((dish) => (
                  <View
                    key={dish.id}
                    style={{ width: mediaSize.width, height: mediaSize.height }}
                  >
                    <ProductImage src={dish.image} style={styles.image} rounded={false} />
                    <View style={styles.badge} pointerEvents="none">
                      {typeof dish.is_veg === 'boolean' ? <VegMark isVeg={dish.is_veg} size={13} /> : null}
                      <Text style={styles.badgeText} numberOfLines={1}>
                        {dishPrice(dish.price)}
                      </Text>
                    </View>
                  </View>
                ))}
              </ScrollView>

              {slides.length > 1 ? (
                <View style={styles.dots} pointerEvents="none">
                  {slides.map((dish, index) => (
                    <View
                      key={dish.id}
                      style={[styles.dot, index === activeSlide && styles.dotActive]}
                    />
                  ))}
                </View>
              ) : null}

              {/* The offer chip still belongs on the photo, now against the
                  free corner: the price owns the left one. */}
              {/* {offer ? (
                <View style={styles.offerChip} pointerEvents="none">
                  <Text style={styles.badgeText} numberOfLines={1}>
                    {offer}
                  </Text>
                </View>
              ) : null} */}
            </>
          ) : (
            <>
              <ProductImage
                src={restaurant.cover_image ?? restaurant.logo}
                style={styles.image}
                rounded={false}
              />

              {badgeText ? (
                <View style={styles.badge} pointerEvents="none">
                  {featuredItem ? <VegMark isVeg={restaurant.is_veg} size={13} /> : null}
                  <Text style={styles.badgeText} numberOfLines={1}>
                    {badgeText}
                  </Text>
                </View>
              ) : null}
            </>
          )}

          {!restaurant.is_open && (
            <View style={styles.closed} pointerEvents="none">
              <Text style={styles.closedText}>Closed</Text>
            </View>
          )}
        </View>

        <View style={styles.body}>
          {/* The name and the rating pill share this row: the name takes the
              free space on the left, the pill sits hard against the right
              edge — inside the white panel, never over the photo. */}
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {restaurant.name}
            </Text>
            {rating !== null ? (
              <View style={styles.rating}>
                <Star size={12} color="#fff" fill="#fff" strokeWidth={0} />
                <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.metaRow}>
            <Clock size={15} color={colors.neutral[500]} />
            <Text style={styles.meta} numberOfLines={1}>
              {metaText}
            </Text>
          </View>

          {offer ? (
            <View style={styles.offerRow}>
              <BadgePercent size={15} color={INFO_BLUE} strokeWidth={2.5} />
              <Text style={styles.offerRowText} numberOfLines={1}>
                {offer}
              </Text>
            </View>
          ) : null}

          {children}
        </View>
      </View>
    </Pressable>
  );
}

/** The reference's coupon-row blue (`--color-z-info`). */
const INFO_BLUE = '#296cd8';

const styles = StyleSheet.create({
  card: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: colors.white,
    borderRadius: featured.radius,
    borderWidth: 1,
    borderColor: 'rgba(16,14,10,0.08)',
    ...featured.shadow,
  },
  media: {
    width: '100%',
    aspectRatio: featured.aspect,
    position: 'relative',
    backgroundColor: colors.neutral[100],
  },
  image: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  },
  badge: {
    position: 'absolute',
    left: 12,
    top: 12,
    maxWidth: '82%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(16,14,10,0.8)',
  },
  badgeText: {
    fontFamily: 'Outfit_500Medium',
    flexShrink: 1,
    color: '#fff',
    fontSize: 13,
    lineHeight: 16,
  },
  offerChip: {
    position: 'absolute',
    right: 12,
    top: 12,
    maxWidth: '58%',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(16,14,10,0.8)',
  },
  rail: {
    ...StyleSheet.absoluteFillObject,
  },
  dots: {
    position: 'absolute',
    left: 0,
    right: 10,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  dotActive: {
    width: 16,
    backgroundColor: '#fff',
  },
  closed: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16,14,10,0.55)',
  },
  closedText: {
    fontFamily: 'Outfit_800ExtraBold',
    color: '#fff',
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  body: {
    width: '100%',
    padding: featured.padX,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  name: {
    fontFamily: 'Outfit_700Bold',
    flexShrink: 1,
    fontSize: 22,
    color: colors.ink[900],
    letterSpacing: -0.4,
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.zGreen,
  },
  ratingText: {
    fontFamily: 'Outfit_700Bold',
    color: '#fff',
    fontSize: 13,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  meta: {
    fontFamily: 'Outfit_500Medium',
    flexShrink: 1,
    fontSize: 14,
    color: colors.neutral[500],
  },
  offerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  offerRowText: {
    fontFamily: 'Outfit_600SemiBold',
    flexShrink: 1,
    fontSize: 14,
    color: INFO_BLUE,
  },
});
