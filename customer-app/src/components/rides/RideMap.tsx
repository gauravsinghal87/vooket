import { useEffect, useRef, useState } from 'react';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { decodePolyline } from '@/lib/polyline';
import { colors, withAlpha } from '@/theme';
import type { NearbyDriver } from '@/types/models';

export interface MapPoint {
  latitude: number;
  longitude: number;
  label?: string;
}

export type PickMode = 'none' | 'pickup' | 'drop';

interface RideMapProps {
  currentLocation: MapPoint | null;
  pickup: MapPoint | null;
  drop: MapPoint | null;
  mode: PickMode;
  route: string | null;
  onPick: (point: MapPoint) => void;
  onReady?: () => void;
  /**
   * When provided, the map runs in "adjust the pending point" mode: taps and
   * marker drags move a draggable pin and report it here rather than committing
   * through `onPick`. Used by the pickup-confirmation screen.
   */
  onPendingChange?: (point: MapPoint) => void;
  /** Hide the built-in tap hint while an adjustable pending pin is shown. */
  hidePickOverlay?: boolean;
  /**
   * Height (px) of the sheet overlaying the bottom of the map, used as the
   * bottom edge padding when fitting the route so it stays above the sheet.
   */
  bottomInset?: number;
  /** Nearby available drivers to plot as small markers. */
  drivers?: NearbyDriver[];
}

const DELHI = { latitude: 28.6139, longitude: 77.209, latitudeDelta: 0.12, longitudeDelta: 0.12 };

/** A coordinate is usable only when both axes are finite and not the 0,0 null island. */
function validPoint(p?: MapPoint | null): p is MapPoint {
  return !!p && Number.isFinite(p.latitude) && Number.isFinite(p.longitude) && !(p.latitude === 0 && p.longitude === 0);
}

export function RideMap({
  currentLocation,
  pickup,
  drop,
  mode,
  route,
  onPick,
  onReady,
  onPendingChange,
  hidePickOverlay = false,
  bottomInset = 320,
  drivers,
}: RideMapProps) {
  const mapRef = useRef<MapView>(null);
  const routePoints = decodePolyline(route).filter((p) => validPoint(p));
  const interactivePicker = !!onPendingChange;
  const [pending, setPending] = useState<MapPoint | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const safePickup = validPoint(pickup) ? pickup : null;
  const safeDrop = validPoint(drop) ? drop : null;
  const safeCurrent = validPoint(currentLocation) ? currentLocation : null;

  const focus = safePickup ?? safeCurrent;
  const focusRegion = focus
    ? { latitude: focus.latitude, longitude: focus.longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 }
    : null;
  const initialRegion = focusRegion ?? DELHI;

  useEffect(() => {
    if (!mapRef.current) return;
    if (routePoints.length > 1) {
      mapRef.current.fitToCoordinates(routePoints, {
        edgePadding: { top: 80, right: 60, bottom: Math.max(160, bottomInset) + 24, left: 60 },
        animated: true,
      });
      return;
    }
    if (focusRegion) {
      mapRef.current.animateToRegion(focusRegion, 400);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.latitude, focus?.longitude, route]);

  useEffect(() => {
    if (mode === 'none') {
      setPending(null);
      return;
    }
    const base = mode === 'pickup' ? safePickup ?? safeCurrent : safeDrop ?? safePickup ?? safeCurrent;
    setPending(base ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const handlePress = (e: any) => {
    if (mode === 'none') return;
    const coordinate = e.nativeEvent.coordinate as { latitude: number; longitude: number };
    if (!Number.isFinite(coordinate?.latitude) || !Number.isFinite(coordinate?.longitude)) return;
    const point = { latitude: coordinate.latitude, longitude: coordinate.longitude };
    if (interactivePicker) {
      setPending(point);
      onPendingChange?.(point);
    } else {
      onPick(point);
    }
  };

  const handleDragEnd = (e: any) => {
    const coordinate = e.nativeEvent.coordinate as { latitude: number; longitude: number };
    if (!Number.isFinite(coordinate?.latitude) || !Number.isFinite(coordinate?.longitude)) return;
    const point = { latitude: coordinate.latitude, longitude: coordinate.longitude };
    setPending(point);
    onPendingChange?.(point);
  };

  return (
    <View style={styles.wrap}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_DEFAULT}
        style={styles.map}
        initialRegion={initialRegion}
        onPress={handlePress}
        showsUserLocation
        onMapReady={() => {
          setReady(true);
          setError(null);
          onReady?.();
        }}
        onMapLoaded={() => setReady(true)}
      >
        {!interactivePicker && safePickup && <Marker coordinate={safePickup} title="Pickup" pinColor="#10b981" />}
        {safeDrop && <Marker coordinate={safeDrop} title="Destination" pinColor="#ea320c" />}
        {interactivePicker && pending && (
          <Marker
            coordinate={pending}
            draggable
            title={mode === 'pickup' ? 'Pickup' : 'Destination'}
            pinColor={mode === 'pickup' ? '#10b981' : '#ea320c'}
            onDragEnd={handleDragEnd}
          />
        )}
        {routePoints.length > 1 && (
          <Polyline coordinates={routePoints} strokeColor={colors.brand[600]} strokeWidth={4} />
        )}
        {drivers?.map((d) => {
          const point = { latitude: d.latitude, longitude: d.longitude };
          if (!validPoint(point)) return null;
          return (
            <Marker key={`driver-${d.id}`} coordinate={point} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
              <View style={styles.driverDot} />
            </Marker>
          );
        })}
      </MapView>

      {!ready && !error && Platform.OS !== 'web' && (
        <View style={styles.state} pointerEvents="none">
          <ActivityIndicator color={colors.brand[600]} />
          <Text style={styles.stateText}>Loading map…</Text>
        </View>
      )}

      {error && (
        <View style={styles.state}>
          <Text style={styles.stateText}>{error}</Text>
        </View>
      )}

      {mode !== 'none' && !hidePickOverlay && (
        <View style={styles.hint}>
          <Text style={styles.hintText}>
            {mode === 'pickup' ? 'Tap the map to set pickup' : 'Tap the map to set destination'}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.ink[100],
    overflow: 'hidden',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  state: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.ink[100],
  },
  stateText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.neutral[500],
  },
  driverDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.ink[700],
    borderWidth: 2,
    borderColor: '#fff',
  },
  hint: {
    position: 'absolute',
    top: 44,
    alignSelf: 'center',
    backgroundColor: withAlpha(colors.ink[900], 0.85),
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  hintText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
});
