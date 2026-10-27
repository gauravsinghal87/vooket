import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Phone, UserCircle2 } from 'lucide-react-native';
import { ProductImage } from '@/components/ui/ProductImage';
import { formatDistance, formatEta, hasLiveLocation } from '@/lib/orderTracking';
import { colors } from '@/theme';
import type { OrderTracking } from '@/types/models';

interface DeliveryPartnerPanelProps {
  tracking: OrderTracking;
  tone: 'brand' | 'food' | 'grocery';
}

/**
 * Mask the middle of a vehicle registration so the full plate is never exposed
 * in the client UI (e.g. `DL01AB1234` -> `DL••••1234`). Falls back to the raw
 * value for anything too short to mask meaningfully.
 */
function maskVehicle(value: string): string {
  const compact = value.replace(/\s+/g, '');
  if (compact.length <= 4) return value;
  return `${compact.slice(0, 2)}••••${compact.slice(-2)}`;
}

/**
 * Compact delivery-partner panel shown directly below the live map. Rendered
 * only when a partner is actually assigned (caller guards this). Uses the real
 * dispatch payload — never fabricates a partner, phone or location.
 */
export function DeliveryPartnerPanel({ tracking, tone }: DeliveryPartnerPanelProps) {
  const partner = tracking.partner;
  if (!partner) return null;

  const soft = tone === 'food' ? colors.food[100] : tone === 'grocery' ? colors.grocery[100] : colors.brand[100];
  const softText =
    tone === 'food' ? colors.food[600] : tone === 'grocery' ? colors.grocery[800] : colors.brand[600];
  const solid = tone === 'food' ? colors.food[600] : tone === 'grocery' ? colors.grocery[500] : colors.brand[600];
  const solidText = tone === 'grocery' ? colors.ink[900] : '#fff';
  const partnerPhone = partner.phone?.trim() || null;
  const live = hasLiveLocation(tracking);
  const stale = tracking.tracking?.location_stale === true;
  const distance = formatDistance(tracking.route?.distance_km ?? null);
  const eta = formatEta(tracking.eta);

  const vehicle = partner.vehicle_number
    ? `${partner.vehicle_type ? `${partner.vehicle_type} · ` : ''}${maskVehicle(partner.vehicle_number)}`
    : partner.vehicle_type ?? 'Delivery partner';

  return (
    <View style={styles.outer}>
      <View style={styles.card}>
        <View style={[styles.avatar, { backgroundColor: soft }]}>
          {partner.photo ? (
            <ProductImage src={partner.photo} style={styles.photo} />
          ) : (
            <UserCircle2 size={22} color={softText} />
          )}
        </View>

        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>
            {partner.name}
          </Text>
          <Text style={styles.vehicle} numberOfLines={1}>
            {vehicle}
          </Text>
          <View style={styles.statusRow}>
            {live && !stale ? (
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>Live</Text>
              </View>
            ) : (
              <Text style={styles.muted}>{stale ? 'Location paused' : 'Location updating'}</Text>
            )}
            {distance ? <Text style={styles.muted}>· {distance} away</Text> : null}
            {eta ? <Text style={styles.muted}>· {eta}</Text> : null}
          </View>
        </View>

        {partnerPhone ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Call ${partner.name}`}
            onPress={() => void Linking.openURL(`tel:${partnerPhone.replace(/[^+\d]/g, '')}`)}
            hitSlop={8}
            style={[styles.callBtn, { backgroundColor: solid }]}
          >
            <Phone size={16} color={solidText} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.neutral[100],
    padding: 14,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photo: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.ink[900],
  },
  vehicle: {
    fontSize: 12,
    color: colors.neutral[500],
    marginTop: 1,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  liveText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.success,
  },
  muted: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.neutral[500],
  },
  callBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
