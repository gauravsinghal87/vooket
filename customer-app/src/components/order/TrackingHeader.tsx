import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { RefreshCw, X } from 'lucide-react-native';
import { colors, shadows } from '@/theme';
import type { OrderType } from '@/types/models';

interface TrackingHeaderProps {
  orderType: OrderType;
  restaurantName: string;
  heading: string;
  /** Real, backend-derived ETA copy (e.g. "~12 min"); omitted when unknown. */
  etaLabel?: string | null;
  cancelled?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Drops back to the collapsed layout (banner + compact tracking card). */
  onCollapse: () => void;
}

/**
 * The compact service-themed header shown only in the expanded-map layout
 * (native port of customer-web's `TrackingHeader`).
 *
 * It paints the same Food red / Grocery gold the order page adopts for the
 * header above it, so the two read as one continuous band directly above the
 * map. Content is centered (service label, restaurant name, live status, ETA
 * pill) with the collapse control and refresh pinned to the symmetric side
 * columns, and every value comes from the real order/tracking payload — never
 * hardcoded.
 */
export function TrackingHeader({
  orderType,
  restaurantName,
  heading,
  etaLabel,
  cancelled = false,
  refreshing = false,
  onRefresh,
  onCollapse,
}: TrackingHeaderProps) {
  const isGrocery = orderType === 'grocery';
  const gradient: [string, string] = isGrocery
    ? [colors.grocery[400], colors.grocery[500]]
    : [colors.food[600], colors.food[700]];
  const textColor = isGrocery ? colors.ink[900] : '#fff';
  const controlBg = isGrocery ? 'rgba(23,20,15,0.10)' : 'rgba(255,255,255,0.15)';
  const muted = isGrocery ? 'rgba(23,20,15,0.60)' : 'rgba(255,255,255,0.60)';

  return (
    <LinearGradient colors={gradient} style={styles.wrap}>
      <View style={styles.topRow}>
        <Pressable
          accessibilityLabel="Collapse map"
          hitSlop={6}
          onPress={onCollapse}
          style={[styles.control, { backgroundColor: controlBg }]}
        >
          <X size={20} color={textColor} />
        </Pressable>

        <View style={styles.center}>
          <Text style={[styles.kind, { color: muted }]}>{isGrocery ? 'GROCERY ORDER' : 'FOOD ORDER'}</Text>
          <Text style={[styles.name, { color: textColor }]} numberOfLines={1}>
            {restaurantName}
          </Text>
        </View>

        {onRefresh ? (
          <Pressable
            accessibilityLabel="Refresh order status"
            hitSlop={6}
            onPress={onRefresh}
            style={[styles.control, { backgroundColor: controlBg }]}
          >
            <RefreshCw size={16} color={textColor} />
          </Pressable>
        ) : (
          <View style={styles.control} />
        )}
      </View>

      <Text style={[styles.heading, { color: textColor }]} numberOfLines={1}>
        {cancelled ? 'Order cancelled' : heading}
      </Text>

      {!cancelled && etaLabel ? (
        <View style={styles.etaWrap}>
          <View style={styles.etaPill}>
            <Text style={[styles.etaText, { color: isGrocery ? colors.grocery[800] : colors.food[700] }]}>
              Arriving in {etaLabel}
            </Text>
          </View>
        </View>
      ) : null}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 10,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  control: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
  },
  kind: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  name: {
    marginTop: 2,
    fontSize: 18,
    fontWeight: '800',
  },
  heading: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '700',
  },
  etaWrap: {
    alignItems: 'center',
  },
  etaPill: {
    borderRadius: 999,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 6,
    ...shadows.pill,
  },
  etaText: {
    fontSize: 14,
    fontWeight: '800',
  },
});
