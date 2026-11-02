import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { decodePolyline } from '@/shared/utils/polyline';
import { colors } from '@/shared/theme';
import type { OrderTracking } from '@/shared/types/models';

interface OrderTrackingMapProps {
  tracking: OrderTracking;
  mapsApiKey: string | null;
  tone: 'brand' | 'food' | 'grocery';
  /** Sizing/placement is owned by the caller (compact mini-map vs expanded map). */
  style?: StyleProp<ViewStyle>;
  /** Disabled for the compact card so it never steals the card's tap gestures. */
  interactive?: boolean;
}

/**
 * The live-tracking map. Pure renderer with no chrome: the caller decides its
 * size (compact mini-map inside the tracking card, or the expanded full-width
 * map) and owns the expand/collapse affordance. Renders real pickup/drop-off/
 * partner markers and the real route only when valid data exists; otherwise a
 * graceful inline fallback is shown. Never fabricates a location.
 */
export function OrderTrackingMap({ tracking, mapsApiKey, tone, style, interactive = true }: OrderTrackingMapProps) {
  // Service accent for the partner marker and the route line. Grocery uses the
  // darker gold so the line stays legible on the map surface.
  const accent = tone === 'food' ? colors.food[600] : tone === 'grocery' ? colors.grocery[600] : colors.brand[600];

  const pickup =
    tracking.order?.pickup && tracking.order.pickup.latitude !== null
      ? { latitude: tracking.order.pickup.latitude, longitude: tracking.order.pickup.longitude, name: tracking.order.pickup.name }
      : null;
  const drop =
    tracking.order?.dropoff && tracking.order.dropoff.latitude !== null
      ? { latitude: tracking.order.dropoff.latitude, longitude: tracking.order.dropoff.longitude }
      : null;
  const partnerLoc =
    tracking.location && tracking.location.lat !== null && tracking.location.lng !== null
      ? { latitude: tracking.location.lat, longitude: tracking.location.lng }
      : null;
  const routePoints = decodePolyline(tracking.route?.polyline);
  const focus = partnerLoc ?? pickup ?? drop;

  if (!mapsApiKey || !focus) {
    return (
      <View style={[styles.fallback, style]}>
        <Text style={styles.fallbackText}>Live map is unavailable right now.</Text>
      </View>
    );
  }

  return (
    <MapView
      provider={PROVIDER_DEFAULT}
      style={style}
      initialRegion={{ latitude: focus.latitude, longitude: focus.longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
      scrollEnabled={interactive}
      zoomEnabled={interactive}
      rotateEnabled={interactive}
      pitchEnabled={interactive}
      toolbarEnabled={false}
    >
      {pickup ? <Marker coordinate={pickup} title="Pickup" pinColor="#10b981" /> : null}
      {drop ? <Marker coordinate={drop} title="Drop-off" pinColor="#ea320c" /> : null}
      {partnerLoc ? <Marker coordinate={partnerLoc} title="Delivery partner" pinColor={accent} /> : null}
      {routePoints.length > 1 ? <Polyline coordinates={routePoints} strokeColor={accent} strokeWidth={4} /> : null}
    </MapView>
  );
}

const styles = StyleSheet.create({
  fallback: {
    minHeight: 120,
    backgroundColor: colors.neutral[100],
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  fallbackText: {
    fontSize: 13,
    color: colors.neutral[500],
    textAlign: 'center',
  },
});
