import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  Animated,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  ArrowUpDown,
  Bike,
  Car,
  CarTaxiFront,
  Check,
  Heart,
  LocateFixed,
  MapPin,
  Search,
  TicketPercent,
  Wallet,
} from 'lucide-react-native';
import { repositories } from '@/shared/repositories';
import type { NearbyDriver, ReverseGeocode, RideEstimate, VehicleType } from '@/shared/types/models';
import { RideMap, type MapPoint, type PickMode } from '@/modules/rides/components/RideMap';
import { RidesPromoMosaic } from '@/modules/rides/components/PromoMosaic';
import { useRidesDraftStore } from '@/modules/rides/store/ridesDraftStore';
import { Screen } from '@/shared/components/Screen';
import { PromoCard } from '@/shared/components/cards';
import { currentLocation } from '@/shared/utils/location';
import { formatCurrency } from '@/shared/utils/utils';
import { colors, withAlpha } from '@/modules/rides/styles/theme';

function vehicleIcon(vt: VehicleType) {
  switch (vt.code) {
    case 'bike':
      return Bike;
    case 'auto':
      return CarTaxiFront;
    default:
      return Car;
  }
}

function vehicleColor(vt: VehicleType): string {
  switch (vt.code) {
    case 'bike':
      return colors.success;
    case 'auto':
      return '#f59e0b';
    default:
      return colors.brand[700];
  }
}

const VEHICLE_CATEGORY: Record<string, string> = {
  bike: 'Bike taxi',
  auto: 'Auto ride',
  cab: 'Cab',
  cab_xl: 'Cab XL',
};

function vehicleCategory(vt: VehicleType): string {
  return vt.description?.trim() || VEHICLE_CATEGORY[vt.code] || 'Ride';
}

function fareFor(e: RideEstimate): number {
  return parseFloat(e.estimated_fare);
}

function readableAddress(rg: ReverseGeocode | null | undefined): string | null {
  if (!rg) return null;
  const primary = rg.address?.trim() || rg.formatted_address?.trim();
  if (primary) return primary;
  const parts = [rg.locality ?? rg.area, rg.city, rg.state].filter(
    (p): p is string => typeof p === 'string' && p.trim().length > 0
  );
  return parts.length > 0 ? parts.join(', ') : null;
}

const SHEET_COLLAPSED = 300;
/** Always keep at least this much of the map visible above the sheet. */
const MIN_MAP_HEIGHT = 220;

export default function RidesScreen() {
  const { height: windowHeight } = useWindowDimensions();
  const [bodyHeight, setBodyHeight] = useState(0);

  const pickup = useRidesDraftStore((s) => s.pickup);
  const drop = useRidesDraftStore((s) => s.drop);
  const setPickup = useRidesDraftStore((s) => s.setPickup);
  const setDrop = useRidesDraftStore((s) => s.setDrop);
  const pendingMode = useRidesDraftStore((s) => s.pendingMode);
  const setPendingMode = useRidesDraftStore((s) => s.setPendingMode);
  const selectedVt = useRidesDraftStore((s) => s.selectedVehicle);
  const setSelectedVt = useRidesDraftStore((s) => s.setSelectedVehicle);
  const [mode, setMode] = useState<PickMode>('none');
  const [locating, setLocating] = useState(false);
  const [resolvingAddress, setResolvingAddress] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [currentCenter, setCurrentCenter] = useState<MapPoint | null>(null);
  const [showOffers, setShowOffers] = useState(false);
  const locateOnceRef = useRef(false);

  const sheetHeight = useRef(new Animated.Value(SHEET_COLLAPSED)).current;
  const sheetTarget = useRef(SHEET_COLLAPSED);
  const dragStart = useRef(SHEET_COLLAPSED);
  const sheetMin = useRef(SHEET_COLLAPSED);
  const sheetMax = useRef(SHEET_COLLAPSED);

  // Snap points derive from the *measured* map+sheet body — not the raw window —
  // so the sheet can never grow tall enough to crush the `flex: 1` map to zero.
  const metrics = useMemo(() => {
    const h = bodyHeight || windowHeight;
    const max = Math.max(200, h - MIN_MAP_HEIGHT);
    const collapsed = Math.min(SHEET_COLLAPSED, max);
    const expanded = Math.max(collapsed, Math.min(Math.round(h * 0.6), max));
    return { collapsed, expanded };
  }, [bodyHeight, windowHeight]);

  const snapSheet = useCallback(
    (to: number) => {
      sheetTarget.current = to;
      Animated.timing(sheetHeight, { toValue: to, duration: 220, useNativeDriver: false }).start();
    },
    [sheetHeight]
  );

  useEffect(() => {
    sheetMin.current = metrics.collapsed;
    sheetMax.current = metrics.expanded;
  }, [metrics]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 4,
      onPanResponderGrant: () => {
        dragStart.current = sheetTarget.current;
      },
      onPanResponderMove: (_, g) => {
        const next = Math.max(sheetMin.current, Math.min(sheetMax.current, dragStart.current - g.dy));
        sheetTarget.current = next;
        sheetHeight.setValue(next);
      },
      onPanResponderRelease: () => {
        const to =
          sheetTarget.current > (sheetMin.current + sheetMax.current) / 2 ? sheetMax.current : sheetMin.current;
        snapSheet(to);
      },
    })
  ).current;

  const promos = useQuery({
    queryKey: ['ride-promos'],
    queryFn: () => repositories.rides.getPromos(),
  });

  // The Rides "Everything in Minutes" mosaic is its own placement, fetched with
  // the dedicated endpoint+key so a banner for another surface can never appear
  // in it. Strict equality on the placement also drops shared `all`/null banners
  // the public endpoint would otherwise include.
  const ridePromoQuery = useQuery({
    queryKey: ['banners', 'rides_promotions'],
    queryFn: () => repositories.banners.getByPlacement('rides', 'rides_promotions'),
  });
  const ridePromoCards = useMemo(
    () => (ridePromoQuery.data ?? []).filter((b) => b.placement === 'rides_promotions'),
    [ridePromoQuery.data]
  );

  const savedPlaces = useQuery({
    queryKey: ['saved-places'],
    queryFn: () => repositories.rides.getSavedPlaces().catch(() => []),
  });

  const locate = useCallback(async () => {
    setLocating(true);
    setLocationError(null);
    try {
      const res = await currentLocation();
      if (!res.ok || !res.location) {
        setLocationError(res.error ?? 'Could not determine your location.');
        return;
      }
      const { latitude, longitude } = res.location;
      setCurrentCenter({ latitude, longitude });
      setPickup({ latitude, longitude, label: 'Current location' });
      setMode('none');

      setResolvingAddress(true);
      repositories.user
        .reverseGeocode(latitude, longitude)
        .then((rg) => {
          const label = readableAddress(rg);
          if (!label) return;
          setPickup((prev) =>
            prev && prev.latitude === latitude && prev.longitude === longitude ? { ...prev, label } : prev
          );
        })
        .catch(() => {})
        .finally(() => setResolvingAddress(false));
    } finally {
      setLocating(false);
    }
  }, [setPickup]);

  useEffect(() => {
    if (locateOnceRef.current) return;
    locateOnceRef.current = true;
    if (!useRidesDraftStore.getState().pickup) locate();
  }, [locate]);

  useEffect(() => {
    if (pendingMode === 'none') return;
    setMode(pendingMode);
    setPendingMode('none');
  }, [pendingMode, setPendingMode]);

  const coordsKey = useMemo(() => {
    if (!pickup || !drop) return null;
    return {
      pickup_latitude: pickup.latitude,
      pickup_longitude: pickup.longitude,
      destination_latitude: drop.latitude,
      destination_longitude: drop.longitude,
    };
  }, [pickup, drop]);

  const routeQuery = useQuery({
    queryKey: ['ride-route', coordsKey],
    queryFn: () => repositories.rides.getRoute(coordsKey!),
    enabled: !!coordsKey,
    staleTime: 60 * 1000,
  });

  const estimateQuery = useQuery({
    queryKey: ['ride-estimates', coordsKey],
    queryFn: () => repositories.rides.estimate(coordsKey!),
    enabled: !!coordsKey,
    staleTime: 60 * 1000,
  });

  useEffect(() => {
    const data = estimateQuery.data;
    if (!data || data.length === 0) return;
    if (!selectedVt || !data.some((e) => e.vehicle_type.id === selectedVt.id)) {
      setSelectedVt(data.reduce((a, b) => (fareFor(a) <= fareFor(b) ? a : b)).vehicle_type);
    }
  }, [estimateQuery.data, selectedVt, setSelectedVt]);

  // Availability across every vehicle type so each row reports its own real
  // nearest-driver ETA rather than only the currently selected category.
  const driversQuery = useQuery({
    queryKey: ['nearby-drivers', pickup?.latitude, pickup?.longitude],
    queryFn: () =>
      repositories.rides.getNearbyDrivers({
        latitude: pickup!.latitude,
        longitude: pickup!.longitude,
      }),
    enabled: !!pickup,
    staleTime: 15 * 1000,
    refetchInterval: 30 * 1000,
  });
  const nearbyDrivers = useMemo<NearbyDriver[]>(() => driversQuery.data ?? [], [driversQuery.data]);
  const driversResolved = driversQuery.data !== undefined;

  const availabilityFor = useCallback(
    (vehicleTypeId: number): { count: number; eta: number | null; loading: boolean } => {
      const list = nearbyDrivers.filter((d) => d.vehicle_type_id === vehicleTypeId);
      if (list.length === 0) return { count: 0, eta: null, loading: !driversResolved };
      return { count: list.length, eta: Math.min(...list.map((d) => d.eta_min)), loading: false };
    },
    [nearbyDrivers, driversResolved]
  );

  const confirmMapPick = useCallback(
    (kind: 'pickup' | 'drop', point: MapPoint) => {
      const setFar = kind === 'pickup' ? setPickup : setDrop;
      const normalized: MapPoint = { ...point, label: point.label ?? 'Selected location' };
      setFar(normalized);
      setMode('none');
      repositories.user
        .reverseGeocode(point.latitude, point.longitude)
        .then((rg) => {
          if (rg?.address) {
            setFar((prev) =>
              prev && prev.latitude === point.latitude && prev.longitude === point.longitude
                ? { ...prev, label: rg.address }
                : prev
            );
          }
        })
        .catch(() => {});
    },
    [setDrop, setPickup]
  );

  const estimates = useMemo<RideEstimate[]>(() => estimateQuery.data ?? [], [estimateQuery.data]);

  const cheapestId = useMemo(() => {
    const data = estimateQuery.data;
    if (!data || data.length === 0) return null;
    return data.reduce((a, b) => (fareFor(a) <= fareFor(b) ? a : b)).vehicle_type.id;
  }, [estimateQuery.data]);

  const selectedEstimate = useMemo(
    () => estimates.find((e) => e.vehicle_type.id === selectedVt?.id) ?? null,
    [estimates, selectedVt?.id]
  );
  const selectedAvailability = selectedVt ? availabilityFor(selectedVt.id) : null;

  // Keep the floating pickup card sitting just above the sheet as it drags.
  const pillBottom = useMemo(() => Animated.add(sheetHeight, 12), [sheetHeight]);

  // Snap the sheet to the right stop once the body has been measured, and grow
  // it when a destination exists so the ride options are visible.
  useEffect(() => {
    if (!bodyHeight) return;
    snapSheet(drop ? metrics.expanded : metrics.collapsed);
  }, [drop, bodyHeight, metrics.collapsed, metrics.expanded, snapSheet]);

  const mapFlow = useMemo(() => {
    if (locating) return 'locating';
    if (locationError && !pickup) return 'location-error';
    if (mode === 'pickup') return 'placing-pickup';
    if (mode === 'drop') return 'placing-drop';
    if (routeQuery.isFetching || estimateQuery.isFetching) return 'calculating';
    if (estimates.length > 0) return 'route-ready';
    return 'idle';
  }, [locating, locationError, pickup, mode, routeQuery.isFetching, estimateQuery.isFetching, estimates.length]);

  const flowLabel: Record<string, string> = {
    locating: 'Finding your location…',
    'location-error': locationError ?? 'Location unavailable',
    'placing-pickup': 'Tap the map to set pickup',
    'placing-drop': 'Tap the map to set destination',
    calculating: 'Calculating route…',
    'route-ready': 'Route ready',
    idle: 'Where would you like to go?',
  };

  const swap = () => {
    setPickup(drop);
    setDrop(pickup);
  };

  const routeSubtitle = routeQuery.data
    ? `${routeQuery.data.distance_km} km · ~${routeQuery.data.duration_min} min`
    : undefined;

  const saved = savedPlaces.data ?? [];
  const promoList = promos.data ?? [];

  const pickSaved = (place: { id: number; label: string; address: string; latitude?: string; longitude?: string }) => {
    setDrop({
      latitude: parseFloat(place.latitude ?? '0') || 0,
      longitude: parseFloat(place.longitude ?? '0') || 0,
      label: place.label,
    });
    setMode('none');
  };

  return (
    <Screen
      scroll={false}
      padded={false}
      bottomBar={
        selectedVt && pickup && drop ? (
          <View style={styles.bookBar}>
            <View style={styles.bookFare}>
              <Text style={styles.bookFareValue}>
                {selectedEstimate ? formatCurrency(selectedEstimate.estimated_fare) : '—'}
              </Text>
              <Text style={styles.bookFareSub} numberOfLines={1}>
                {selectedVt.name}
                {selectedAvailability?.eta != null ? ` · ${selectedAvailability.eta} min away` : ''}
              </Text>
            </View>
            <Pressable
              style={styles.bookBtn}
              onPress={() => router.push('/rides/confirm-pickup' as never)}
            >
              <Text style={styles.bookBtnText}>Book {selectedVt.name}</Text>
            </Pressable>
          </View>
        ) : undefined
      }
    >
      <View
        style={styles.root}
        onLayout={(e) => {
          const h = Math.round(e.nativeEvent.layout.height);
          setBodyHeight((prev) => (prev === h ? prev : h));
        }}
      >
        <View style={styles.mapArea}>
          <RideMap
            currentLocation={currentCenter}
            pickup={pickup}
            drop={drop}
            mode={mode}
            route={routeQuery.data?.polyline ?? null}
            bottomInset={metrics.expanded}
            drivers={nearbyDrivers}
            onPick={(p) => confirmMapPick(mode === 'none' ? 'pickup' : mode, p)}
          />

          <View style={styles.flowPill}>
            <View style={styles.flowDot} />
            <Text style={styles.flowText}>{flowLabel[mapFlow] ?? flowLabel.idle}</Text>
          </View>

          {mode === 'none' && (
            <Pressable style={styles.locateBtn} onPress={locate} disabled={locating}>
              {locating ? (
                <ActivityIndicator size="small" color={colors.neutral[500]} />
              ) : (
                <LocateFixed size={16} color={colors.neutral[700]} />
              )}
            </Pressable>
          )}

          {mode === 'none' && (
            <Animated.View style={[styles.pickupPill, { bottom: pillBottom }]}>
              <Pressable style={styles.pickupPillPress} onPress={() => setMode('pickup')}>
                <View style={styles.pickupPillIcon}>
                  <MapPin size={16} color={colors.success} />
                </View>
                <View style={styles.pickupPillText}>
                  <Text style={styles.pickupPillLabel}>Pickup</Text>
                  {resolvingAddress ? (
                    <View style={styles.pickupPillResolving}>
                      <ActivityIndicator size="small" color={colors.neutral[400]} />
                      <Text style={styles.pickupPillValue} numberOfLines={1}>
                        {pickup?.label ?? 'Current location'}
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.pickupPillValue} numberOfLines={1}>
                      {pickup?.label ?? 'Set your pickup'}
                    </Text>
                  )}
                </View>
              </Pressable>
            </Animated.View>
          )}
        </View>

        <Animated.View style={[styles.sheet, { height: sheetHeight }]}>
          <View {...panResponder.panHandlers} style={styles.handleArea}>
            <View style={styles.handle} />
          </View>

          <ScrollView
            style={styles.sheetScroll}
            contentContainerStyle={styles.sheetContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {!drop ? (
              <>
                <View>
                  <Text style={styles.sheetTitle}>Where do you want to go?</Text>
                  <Text style={styles.sheetSubtitle}>Search a destination or pick one of your saved places.</Text>
                </View>

                <Pressable
                  style={styles.destSearch}
                  onPress={() => router.push('/rides/destination?field=drop' as never)}
                >
                  <Search size={16} color={colors.neutral[500]} />
                  <Text style={styles.destSearchText} numberOfLines={1}>
                    Where do you want to go?
                  </Text>
                </Pressable>

                {saved.length > 0 && (
                  <View style={styles.savedBlock}>
                    <Text style={styles.blockLabel}>Saved places</Text>
                    <View style={styles.savedCard}>
                      {saved.map((p, idx) => (
                        <Pressable
                          key={p.id}
                          onPress={() => pickSaved(p)}
                          style={[styles.savedRow, idx > 0 && styles.savedRowBorder]}
                        >
                          <View style={styles.savedIcon}>
                            <MapPin size={16} color={colors.neutral[500]} />
                          </View>
                          <View style={styles.savedText}>
                            <Text style={styles.savedLabel} numberOfLines={1}>
                              {p.label}
                            </Text>
                            {!!p.address && (
                              <Text style={styles.savedAddress} numberOfLines={1}>
                                {p.address}
                              </Text>
                            )}
                          </View>
                          <Heart size={16} color="#fb7185" fill="#fb7185" />
                        </Pressable>
                      ))}
                    </View>
                  </View>
                )}

                <RidesPromoMosaic
                  banners={ridePromoCards}
                  onCardPress={() => router.push('/rides/destination?field=drop' as never)}
                />

                {promoList.length > 0 && (
                  <View style={styles.promoBlock}>
                    <View style={styles.blockLabelRow}>
                      <TicketPercent size={13} color={colors.neutral[400]} />
                      <Text style={styles.blockLabelFlat}>Offers for you</Text>
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.promoRow}>
                      {promoList.map((o) => (
                        <PromoCard key={o.id ?? o.code} offer={o} compact />
                      ))}
                    </ScrollView>
                  </View>
                )}
              </>
            ) : (
              <>
                <View style={styles.summaryCard}>
                  <View style={styles.summaryRail}>
                    <View style={styles.dotSuccess} />
                    <View style={styles.railLine} />
                    <View style={styles.dotAccent} />
                  </View>
                  <View style={styles.summaryBody}>
                    <Pressable
                      style={styles.summaryRow}
                      onPress={() => setMode(mode === 'pickup' ? 'none' : 'pickup')}
                    >
                      <Text style={styles.summaryLabel}>
                        Pickup{mode === 'pickup' ? ' · tap map' : ''}
                      </Text>
                      <Text style={styles.summaryValue} numberOfLines={1}>
                        {pickup?.label ?? 'Set your pickup'}
                      </Text>
                    </Pressable>
                    <Pressable
                      style={styles.summaryRow}
                      onPress={() => router.push('/rides/destination?field=drop' as never)}
                    >
                      <Text style={styles.summaryLabel}>Destination · change</Text>
                      <Text style={styles.summaryValue} numberOfLines={1}>
                        {drop.label ?? 'Destination'}
                      </Text>
                    </Pressable>
                  </View>
                  <Pressable style={styles.swapBtn} onPress={swap} disabled={!pickup}>
                    <ArrowUpDown size={14} color="#fff" />
                  </Pressable>
                </View>

                <View style={styles.sectionHead}>
                  <Text style={styles.sectionTitle}>Choose a ride</Text>
                  {routeSubtitle ? <Text style={styles.sectionSub}>{routeSubtitle}</Text> : null}
                </View>

                {estimateQuery.isFetching && !estimateQuery.data && estimates.length === 0 && (
                  <View style={styles.rows}>
                    {[0, 1, 2, 3].map((i) => (
                      <View key={i} style={styles.skeletonRow} />
                    ))}
                  </View>
                )}

                {estimates.length > 0 && (
                  <View style={styles.rows}>
                    {estimates.map((e) => (
                      <VehicleRow
                        key={e.vehicle_type.id}
                        estimate={e}
                        active={selectedVt?.id === e.vehicle_type.id}
                        cheapest={cheapestId === e.vehicle_type.id}
                        availability={availabilityFor(e.vehicle_type.id)}
                        onSelect={() => setSelectedVt(e.vehicle_type)}
                      />
                    ))}
                  </View>
                )}

                {promoList.length > 0 && (
                  <View style={styles.payRow}>
                    <View style={styles.payLeft}>
                      <Wallet size={16} color={colors.neutral[400]} />
                      <Text style={styles.payText}>Pay online</Text>
                    </View>
                    <Pressable onPress={() => setShowOffers((v) => !v)} style={styles.offersBtn}>
                      <TicketPercent size={14} color={colors.brand[600]} />
                      <Text style={styles.offersBtnText}>
                        {showOffers ? 'Hide offers' : `${promoList.length} offer${promoList.length > 1 ? 's' : ''}`}
                      </Text>
                    </Pressable>
                  </View>
                )}

                {showOffers && promoList.length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.promoRow}>
                    {promoList.map((o) => (
                      <PromoCard key={o.id ?? o.code} offer={o} compact />
                    ))}
                  </ScrollView>
                )}
              </>
            )}
          </ScrollView>
        </Animated.View>
      </View>
    </Screen>
  );
}

function VehicleRow({
  estimate,
  active,
  cheapest,
  availability,
  onSelect,
}: {
  estimate: RideEstimate;
  active: boolean;
  cheapest: boolean;
  availability: { count: number; eta: number | null; loading: boolean };
  onSelect: () => void;
}) {
  const vt = estimate.vehicle_type;
  const Icon = vehicleIcon(vt);
  const color = vehicleColor(vt);
  const available = availability.loading || availability.eta != null;
  const capacity = vt.capacity > 1 ? `${vt.capacity} seats` : '1 seat';

  const availabilityText = availability.loading
    ? 'Checking availability…'
    : availability.eta != null
      ? `${availability.eta} min away${availability.count > 1 ? ` · ${availability.count} nearby` : ''}`
      : 'Currently unavailable';

  return (
    <Pressable
      onPress={onSelect}
      accessibilityState={{ selected: active }}
      style={[styles.row, active ? { borderColor: colors.brand[600], backgroundColor: withAlpha(colors.brand[600], 0.05) } : null]}
    >
      <View style={[styles.rowIcon, { backgroundColor: withAlpha(color, 0.1) }, !available && styles.rowDimmed]}>
        <Icon size={20} color={color} strokeWidth={1.9} />
        {active && (
          <View style={styles.rowCheck}>
            <Check size={10} color="#fff" strokeWidth={4} />
          </View>
        )}
      </View>

      <View style={styles.rowBody}>
        <View style={styles.rowTitleLine}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {vt.name}
          </Text>
          {cheapest && (
            <View style={styles.cheapestBadge}>
              <Text style={styles.cheapestText}>Cheapest</Text>
            </View>
          )}
        </View>
        <Text
          style={[
            styles.rowMeta,
            availability.loading ? null : availability.eta != null ? { color: colors.success } : { color: '#d97706' },
          ]}
          numberOfLines={1}
        >
          {vehicleCategory(vt)} · {availabilityText}
        </Text>
        <Text style={styles.rowMetaSub} numberOfLines={1}>
          {estimate.distance_km} km · ~{estimate.duration_min} min · {capacity}
        </Text>
      </View>

      <Text style={styles.rowFare}>{formatCurrency(estimate.estimated_fare)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  mapArea: {
    flex: 1,
  },
  flowPill: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  flowDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.brand[600],
  },
  flowText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.neutral[700],
  },
  locateBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickupPill: {
    position: 'absolute',
    left: 12,
    right: 12,
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  pickupPillPress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  pickupPillIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: withAlpha(colors.success, 0.12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickupPillText: {
    flex: 1,
    minWidth: 0,
  },
  pickupPillResolving: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pickupPillLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.neutral[400],
  },
  pickupPillValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.ink[900],
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -6 },
    elevation: 12,
    overflow: 'hidden',
  },
  handleArea: {
    paddingTop: 10,
    paddingBottom: 6,
    alignItems: 'center',
  },
  handle: {
    width: 56,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.neutral[200],
  },
  sheetScroll: {
    flex: 1,
  },
  sheetContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 16,
  },
  sheetTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.ink[900],
    letterSpacing: -0.3,
  },
  sheetSubtitle: {
    fontSize: 14,
    color: colors.neutral[500],
    marginTop: 4,
  },
  destSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 56,
    backgroundColor: '#fff',
  },
  destSearchText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[500],
  },
  blockLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  blockLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.neutral[400],
    marginBottom: 6,
  },
  blockLabelFlat: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.neutral[400],
  },
  savedBlock: {
    gap: 2,
  },
  savedCard: {
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: 16,
    overflow: 'hidden',
  },
  savedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  savedRowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
  },
  savedIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.neutral[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedText: {
    flex: 1,
  },
  savedLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.ink[900],
  },
  savedAddress: {
    fontSize: 12,
    color: colors.neutral[500],
    marginTop: 1,
  },
  promoBlock: {
    backgroundColor: colors.ink[50],
    borderRadius: 16,
    padding: 12,
  },
  promoRow: {
    gap: 12,
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: 16,
    padding: 10,
  },
  summaryRail: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  dotSuccess: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.success,
  },
  railLine: {
    flex: 1,
    width: 1,
    backgroundColor: colors.neutral[200],
    marginVertical: 4,
  },
  dotAccent: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.accent[500],
  },
  summaryBody: {
    flex: 1,
    gap: 12,
  },
  summaryRow: {
    gap: 1,
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.neutral[400],
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.ink[900],
  },
  swapBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.ink[900],
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: -6,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.ink[900],
  },
  sectionSub: {
    fontSize: 11,
    color: colors.neutral[400],
  },
  rows: {
    gap: 10,
  },
  skeletonRow: {
    height: 68,
    borderRadius: 16,
    backgroundColor: colors.neutral[100],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: 16,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  rowIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowDimmed: {
    opacity: 0.5,
  },
  rowCheck: {
    position: 'absolute',
    top: -5,
    right: -5,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.brand[600],
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  rowTitleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.ink[900],
    flexShrink: 1,
  },
  rowMeta: {
    fontSize: 11,
    color: colors.neutral[500],
  },
  rowMetaSub: {
    fontSize: 11,
    color: colors.neutral[400],
  },
  rowFare: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.ink[900],
  },
  cheapestBadge: {
    backgroundColor: withAlpha(colors.success, 0.12),
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  cheapestText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.success,
    textTransform: 'uppercase',
  },
  payRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
    paddingTop: 12,
  },
  payLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  payText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.neutral[500],
  },
  offersBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  offersBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.brand[600],
  },
  bookBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bookFare: {
    flex: 1,
    minWidth: 0,
  },
  bookFareValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.ink[900],
  },
  bookFareSub: {
    fontSize: 11,
    color: colors.neutral[500],
  },
  bookBtn: {
    backgroundColor: colors.brand[600],
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  bookBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
  },
});
