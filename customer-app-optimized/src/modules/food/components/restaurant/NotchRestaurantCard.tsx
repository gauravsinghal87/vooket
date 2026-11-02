import React, { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { Clock, Star } from 'lucide-react-native';
import type { Restaurant } from '@/shared/types/catalog';
import { formatDistanceKm } from '@/shared/utils/geo';
import { deliveryDistanceKm, deliveryEtaText } from '@/shared/utils/deliveryEta';
import { ProductImage } from '@/shared/components/ui/ProductImage';
import { VegMark } from '@/shared/components/ui/primitives';
import { colors, notch } from '@/modules/food/styles/theme';
import { restaurantOffer, restaurantRating } from '@/modules/food/components/restaurant/restaurantCardParts';

/**
 * The compact restaurant card used by every restaurant grid and by the Food
 * recommendation rail.
 *
 * The design is the Swiggy-style "notched" card: a photo with rounded top
 * corners, an offer chip in the top-left corner and a green rating pill
 * sitting in a white notch cut into the bottom-left of the photo.
 *
 * The card is NOT a tile: it has no background, no shadow and no border, so
 * the page background shows through around the photo and around the info area
 * below it. Only the notch keeps a surface of its own (`notch.surface`), which
 * is what makes the cut-out in the photo's bottom-left corner read as a notch.
 *
 * This component is opt-in: it is used by the Food recommendation rail and
 * the Restaurants grid. The large, single restaurant cards use
 * `FeaturedRestaurantCard` instead, which has no notch. Nothing else in the
 * app is affected by either of them.
 *
 * The card carries no favourite button: the listing cards show the offer,
 * the rating and the delivery estimate only.
 */

export { restaurantOffer, restaurantRating };

/**
 * The outline of the white notch that is cut into the bottom-left of the
 * photo — the same shape the web card paints with CSS pseudo-elements.
 *
 * The shape is a flat-topped block whose top-right corner is rounded, closed
 * on the left by a concave bite out of the photo and on the right by the
 * sweep of the second curve.
 *
 * `width` is the width of the white block (the rating pill plus the gap that
 * keeps it off the right edge), `height` the height of the block (the pill
 * plus the gap that keeps it off the top edge) and `curve` the radius of
 * both curves.
 *
 * The coordinates are local to the SVG box: the box starts one curve above
 * the block (where the concave bite lives) and ends exactly on the block's
 * bottom edge.
 */
export function notchPath(width: number, height: number, curve: number): string {
  const r = curve;
  return [
    `M 0 ${r + height}`,
    `L 0 0`,
    `A ${r} ${r} 0 0 0 ${r} ${r}`,
    `L ${width - r} ${r}`,
    `A ${r} ${r} 0 0 1 ${width} ${2 * r}`,
    `L ${width} ${height}`,
    `A ${r} ${r} 0 0 0 ${width + r} ${r + height}`,
    'Z',
  ].join(' ');
}

export interface NotchRestaurantCardProps {
  restaurant: Restaurant;
  /** Client-side distance, used only when the API returned no routed estimate. */
  distanceKm?: number | null;
  /** `sm` is the narrow recommendation rail, `md` the restaurant grids. */
  size?: 'sm' | 'md';
  /** Extra rows rendered under the ETA line. */
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * A two-column grid for restaurant cards.
 *
 * The notched card keeps a fixed photo aspect ratio, so it is designed to sit
 * in a narrow column: two cards per row keep the photo proportional instead of
 * stretching it across the whole screen. The columns are percentages, so the
 * grid follows the width of whatever section it is dropped into.
 */
export function RestaurantCardGrid({ children }: { children: React.ReactNode }) {
  return <View style={styles.grid}>{children}</View>;
}

/** The wrapper every card in a `RestaurantCardGrid` has to carry. */
export function RestaurantCardGridItem({ children }: { children: React.ReactNode }) {
  return <View style={styles.gridItem}>{children}</View>;
}

export function NotchRestaurantCard({
  restaurant,
  distanceKm,
  size = 'md',
  children,
  style,
}: NotchRestaurantCardProps) {
  const router = useRouter();
  // Width of the rating pill once it has been laid out. The white notch is as
  // wide as the pill plus a short tail, so the photo and the notch always
  // agree no matter how wide the rating renders.
  const [pillWidth, setPillWidth] = useState(0);

  const cfg = size === 'sm' ? notch.sm : notch.md;
  const curve = cfg.curve;

  const rating = restaurantRating(restaurant);
  const offer = restaurantOffer(restaurant);

  // ETA and route distance come from the backend estimate for the customer's
  // delivery location; the client-side distance is only a fallback for when
  // the API could not return a routed estimate.
  const etaText = deliveryEtaText(restaurant);
  const distanceLabel = formatDistanceKm(deliveryDistanceKm(restaurant) ?? distanceKm);
  const metaText = [etaText, distanceLabel].filter(Boolean).join(' · ') || '—';

  // The notch block: the rating pill plus the gap that keeps it off the
  // right edge, and never narrower than the two curves it is built from.
  // Its height is the pill's height plus the gap that keeps it off the top
  // edge, so the pill sits exactly `notch.gap` below the top of the cutout
  // and `notch.gap` left of its right edge.
  const blockWidth = Math.max((pillWidth || 48) + notch.gap, curve * 2 + notch.gap);
  const blockHeight = curve * 2 + notch.gap;

  const onPillLayout = (e: LayoutChangeEvent) => {
    const width = e.nativeEvent.layout.width;
    if (width > 0 && Math.abs(width - pillWidth) > 0.5) setPillWidth(width);
  };

  return (
    <Pressable
      onPress={() => router.push(`/restaurant/${restaurant.id}` as never)}
      style={({ pressed }) => [styles.pressable, style, pressed && { opacity: 0.94 }]}
      accessibilityLabel={restaurant.name}
    >
      <View style={[styles.card, { borderRadius: cfg.radius }]}>
        <View style={[styles.media, { aspectRatio: cfg.aspect }]}>
          <ProductImage
            src={restaurant.cover_image ?? restaurant.logo}
            style={[
              styles.image,
              { borderTopLeftRadius: cfg.radius, borderTopRightRadius: cfg.radius },
            ]}
            rounded={false}
          />
          <View style={styles.shade} pointerEvents="none" />

          {offer ? (
            <View
              style={[
                styles.offer,
                {
                  paddingHorizontal: cfg.offerPadX,
                  paddingVertical: cfg.offerPadY,
                },
              ]}
              pointerEvents="none"
            >
              <Text style={[styles.offerText, { fontSize: cfg.offerSize, lineHeight: cfg.offerSize + 2 }]} numberOfLines={1}>
                {offer}
              </Text>
            </View>
          ) : null}

          {!restaurant.is_open && (
            <View style={styles.closed} pointerEvents="none">
              <Text style={styles.closedText}>Closed</Text>
            </View>
          )}

          {/* The notch: a white shape cut into the bottom-left of the photo.
              It keeps its own surface so the cut-out reads against the photo
              and the rating pill sits in it. */}
          {rating !== null && (
            <Svg
              width={blockWidth + curve}
              height={blockHeight + curve}
              viewBox={`0 0 ${blockWidth + curve} ${blockHeight + curve}`}
              style={[styles.notch, { bottom: -notch.overhang }]}
              pointerEvents="none"
            >
              <Path d={notchPath(blockWidth, blockHeight, curve)} fill={notch.surface} />
            </Svg>
          )}

          {/* The green rating pill, sitting in the notch and dipping a few
              pixels below the photo so it reads as "on the boundary". */}
          {rating !== null && (
            <View
              style={[
                styles.pill,
                {
                  bottom: -notch.overhang,
                  paddingHorizontal: cfg.pillPadX,
                  paddingVertical: cfg.pillPadY,
                },
              ]}
              onLayout={onPillLayout}
            >
              <Star size={cfg.pillSize} color="#fff" fill="#fff" strokeWidth={0} />
              <Text
                style={[
                  styles.pillText,
                  // The pill is exactly as tall as the notch block it sits in
                  // (2 x curve), so it never pokes out over the photo.
                  { fontSize: cfg.pillSize, lineHeight: 2 * curve - 2 * cfg.pillPadY },
                ]}
              >
                {rating.toFixed(1)}
              </Text>
            </View>
          )}
        </View>

        {/* The info area. It is transparent on purpose: the page background shows
            through it, so the card never reads as a separate white tile. */}
        <View style={[styles.body, { paddingHorizontal: cfg.padX, paddingVertical: cfg.padY }]}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, { fontSize: cfg.nameSize }]} numberOfLines={1}>
              {restaurant.name}
            </Text>
            <VegMark isVeg={restaurant.is_veg} size={size === 'sm' ? 11 : 13} bordered={size === 'sm'} />
          </View>

          <View style={styles.metaRow}>
            <Clock size={cfg.metaSize} color={colors.neutral[400]} />
            <Text style={[styles.meta, { fontSize: cfg.metaSize }]} numberOfLines={1}>
              {metaText}
            </Text>
          </View>

          {children}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  gridItem: {
    width: '48%',
  },
  pressable: {
    width: '100%',
  },
  card: {
    width: '100%',
    overflow: 'hidden',
    // No tile: the page background shows through around the photo and the
    // info area. Only the notch below carries a surface of its own.
    backgroundColor: 'transparent',
    borderRadius: notch.md.radius,
  },
  media: {
    width: '100%',
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
  shade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(16,14,10,0.18)',
  },
  offer: {
    position: 'absolute',
    left: 8,
    top: 8,
    maxWidth: '92%',
    backgroundColor: 'rgba(16,14,10,0.72)',
    borderRadius: 6,
  },
  offerText: {
    fontFamily: 'Outfit_800ExtraBold',
    color: '#fff',
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
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  notch: {
    position: 'absolute',
    left: 0,
  },
  pill: {
    position: 'absolute',
    left: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: notch.ratingBg,
    borderRadius: 999,
  },
  pillText: {
    fontFamily: 'Outfit_800ExtraBold',
    color: '#fff',
  },
  body: {
    width: '100%',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    fontFamily: 'Outfit_700Bold',
    flexShrink: 1,
    color: colors.ink[900],
    letterSpacing: -0.2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  meta: {
    fontFamily: 'Outfit_600SemiBold',
    flexShrink: 1,
    color: colors.neutral[500],
  },
});
