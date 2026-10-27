import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useRouter } from 'expo-router';
import { BadgePercent, Clock, Star } from 'lucide-react-native';
import type { Restaurant } from '@/types/catalog';
import { formatDistanceKm } from '@/lib/geo';
import { deliveryDistanceKm, deliveryEtaText } from '@/lib/deliveryEta';
import { ProductImage } from '@/components/ui/ProductImage';
import { VegMark } from '@/components/ui/primitives';
import { colors, featured } from '@/theme';
import { restaurantOffer, restaurantRating } from '@/components/restaurant/restaurantCardParts';

/**
 * The large, single restaurant card — the one used by the "Restaurants
 * delivering to you" feed, recreated from the reference's featured card:
 *
 *  - a 5:3 photo with a dark dish badge over the top-left corner (the real
 *    `featured_item` name and price, prefixed by the veg mark) and the offer
 *    chip as a fallback when the kitchen has no featured item;
 *  - a white panel underneath: the name in large bold type with the green
 *    rounded rating pill hard right, the ETA | distance meta line, and the
 *    blue-icon offer row.
 *
 * The card carries no favourite button (the feed does not support
 * favourites) and no image carousel (restaurants expose a single cover), so
 * neither control is drawn — matching the reference only where Vooket has the
 * data to back it.
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

  // ETA and route distance come from the backend estimate for the customer's
  // delivery location; the client-side distance is only a fallback for when the
  // API could not return a routed estimate. The reference separates the two
  // with a pipe, not a middot.
  const etaText = deliveryEtaText(restaurant);
  const distanceLabel = formatDistanceKm(deliveryDistanceKm(restaurant) ?? distanceKm);
  const metaText = [etaText, distanceLabel].filter(Boolean).join(' | ') || '—';

  // The badge over the photo names the featured dish and its real price, as
  // in the reference; kitchens without one fall back to their offer text.
  const badgeText = featuredItem
    ? `${featuredItem.name} · ₹${Number(featuredItem.price).toLocaleString('en-IN')}`
    : offer;

  return (
    <Pressable
      onPress={() => router.push(`/restaurant/${restaurant.id}` as never)}
      style={({ pressed }) => [style, pressed && { opacity: 0.97 }]}
      accessibilityLabel={restaurant.name}
    >
      <View style={styles.card}>
        <View style={styles.media}>
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
