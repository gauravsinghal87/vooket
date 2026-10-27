import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Maximize2, Truck } from 'lucide-react-native';
import { ProductImage } from '@/components/ui/ProductImage';
import { colors, shadows } from '@/theme';
import type { OrderType } from '@/types/models';

interface TrackingCardProps {
  orderType: OrderType;
  restaurantName: string;
  restaurantLogo?: string | null;
  /** Live status copy from the order payload (e.g. "Your order is on its way"). */
  heading: string;
  /** Real, backend-derived ETA copy (e.g. "~12 min"); omitted when unknown. */
  etaLabel?: string | null;
  cancelled?: boolean;
  /** The live mini-map node. When omitted the card renders without the map column. */
  map?: ReactNode;
  /** Opens the expanded-map layout. Omitted when no map is available. */
  onExpand?: () => void;
}

/**
 * The compact Zomato-style tracking card shown in the collapsed layout
 * (native port of customer-web's `TrackingCard`), sitting directly below the
 * promotional banner and pulled up to overlap its bottom edge.
 *
 * Restaurant logo + name, live status and ETA pill on the left, with the live
 * mini-map and its expand affordance on the right — one intentional tracking
 * component rather than a standalone hero followed by a separate map. Every
 * value comes from the real order/tracking payload; the theme follows the order
 * service (Food red / Grocery gold).
 */
export function TrackingCard({
  orderType,
  restaurantName,
  restaurantLogo,
  heading,
  etaLabel,
  cancelled = false,
  map,
  onExpand,
}: TrackingCardProps) {
  const isGrocery = orderType === 'grocery';
  const accentText = isGrocery ? colors.grocery[800] : colors.food[700];
  const etaPill = isGrocery ? colors.grocery[100] : colors.food[50];
  const expandButton = isGrocery ? colors.grocery[500] : colors.food[600];
  const expandIcon = isGrocery ? colors.ink[900] : '#fff';

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.left}>
          <View style={styles.nameRow}>
            <View style={styles.logoBox}>
              {restaurantLogo ? (
                <ProductImage src={restaurantLogo} style={styles.logoImg} />
              ) : (
                <Truck size={16} color={colors.neutral[400]} />
              )}
            </View>
            <Text style={styles.name} numberOfLines={1}>
              {restaurantName}
            </Text>
          </View>

          <Text style={[styles.status, { color: cancelled ? colors.danger : accentText }]} numberOfLines={1}>
            {cancelled ? 'Order cancelled' : heading}
          </Text>

          {!cancelled && etaLabel ? (
            <View style={[styles.etaPill, { backgroundColor: etaPill }]}>
              <Text style={[styles.etaText, { color: accentText }]}>Arriving in {etaLabel}</Text>
            </View>
          ) : null}
        </View>

        {map ? (
          <View style={styles.mapBox}>
            {map}
            {onExpand ? (
              <Pressable
                accessibilityLabel="Expand map"
                hitSlop={6}
                onPress={onExpand}
                style={[styles.expandBtn, { backgroundColor: expandButton }]}
              >
                <Maximize2 size={16} color={expandIcon} />
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.neutral[100],
    padding: 12,
    ...shadows.float,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
  },
  left: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    gap: 6,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.neutral[100],
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoImg: {
    width: 32,
    height: 32,
    borderRadius: 10,
  },
  name: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '800',
    color: colors.ink[900],
  },
  status: {
    fontSize: 12,
    fontWeight: '700',
  },
  etaPill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  etaText: {
    fontSize: 11,
    fontWeight: '800',
  },
  mapBox: {
    position: 'relative',
    width: 96,
    height: 72,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: colors.ink[950],
  },
  expandBtn: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
});
