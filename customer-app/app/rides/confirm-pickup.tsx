import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Check, MapPin, Navigation, Pencil } from 'lucide-react-native';
import { repositories } from '@/api/repositories';
import type { MapPoint } from '@/components/rides/RideMap';
import { RideMap } from '@/components/rides/RideMap';
import { useRidesDraftStore } from '@/stores/ridesDraftStore';
import { Screen } from '@/components/Screen';
import { toast } from '@/stores/toastStore';
import { formatCurrency } from '@/lib/utils';
import { colors, withAlpha } from '@/theme';

function newIdempotencyKey(): string {
  try {
    const cryptoObj = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
    if (cryptoObj?.randomUUID) return cryptoObj.randomUUID();
  } catch {
    // fall through to the random fallback
  }
  return `ride-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function coordLabel(p: MapPoint | null): string {
  if (!p) return '';
  return `${p.latitude.toFixed(4)}, ${p.longitude.toFixed(4)}`;
}

/**
 * The last step before a ride is published. The user reviews the pickup on a
 * large map, can drag the pin to correct it (the address reverse-geocodes as
 * they go), and only presses "Confirm pickup" once. The ride is created here —
 * never on the destination or vehicle-selection screens.
 */
export default function RideConfirmPickupScreen() {
  const insets = useSafeAreaInsets();
  const pickup = useRidesDraftStore((s) => s.pickup);
  const drop = useRidesDraftStore((s) => s.drop);
  const selectedVehicle = useRidesDraftStore((s) => s.selectedVehicle);

  const [pickupDraft, setPickupDraft] = useState<MapPoint | null>(pickup);
  const [resolving, setResolving] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const geocodeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idempotencyRef = useRef<string>(newIdempotencyKey());

  useEffect(() => {
    idempotencyRef.current = newIdempotencyKey();
  }, [pickupDraft?.latitude, pickupDraft?.longitude, drop?.latitude, drop?.longitude, selectedVehicle?.id]);

  useEffect(() => {
    if (!pickup || !drop || !selectedVehicle) {
      router.replace('/rides' as never);
    }
  }, [pickup, drop, selectedVehicle]);

  const routeQuery = useQuery({
    queryKey: ['ride-route-confirm', pickupDraft?.latitude, pickupDraft?.longitude, drop?.latitude, drop?.longitude],
    queryFn: () =>
      repositories.rides.getRoute({
        pickup_latitude: pickupDraft!.latitude,
        pickup_longitude: pickupDraft!.longitude,
        destination_latitude: drop!.latitude,
        destination_longitude: drop!.longitude,
      }),
    enabled: !!pickupDraft && !!drop,
    staleTime: 60 * 1000,
  });

  const estimateQuery = useQuery({
    queryKey: ['ride-estimate-confirm', pickupDraft?.latitude, pickupDraft?.longitude, drop?.latitude, drop?.longitude],
    queryFn: () =>
      repositories.rides.estimate({
        pickup_latitude: pickupDraft!.latitude,
        pickup_longitude: pickupDraft!.longitude,
        destination_latitude: drop!.latitude,
        destination_longitude: drop!.longitude,
      }),
    enabled: !!pickupDraft && !!drop,
    staleTime: 60 * 1000,
  });

  const fare = useMemo(() => {
    const list = estimateQuery.data ?? [];
    return list.find((e) => e.vehicle_type.id === selectedVehicle?.id) ?? null;
  }, [estimateQuery.data, selectedVehicle?.id]);

  const handlePendingChange = useCallback((point: MapPoint) => {
    setPickupDraft({ ...point, label: undefined });
    setResolving(true);
    if (geocodeRef.current) clearTimeout(geocodeRef.current);
    geocodeRef.current = setTimeout(() => {
      repositories.user
        .reverseGeocode(point.latitude, point.longitude)
        .then((rg) => {
          if (rg?.address) {
            setPickupDraft((prev) =>
              prev && prev.latitude === point.latitude && prev.longitude === point.longitude
                ? { ...prev, label: rg.address }
                : prev
            );
          }
        })
        .catch(() => {})
        .finally(() => setResolving(false));
    }, 400);
  }, []);

  useEffect(() => {
    return () => {
      if (geocodeRef.current) clearTimeout(geocodeRef.current);
    };
  }, []);

  const bookMutation = useMutation({
    mutationFn: () => {
      if (!pickupDraft || !drop || !selectedVehicle) throw new Error('Incomplete booking');
      return repositories.rides.book({
        pickup_latitude: pickupDraft.latitude,
        pickup_longitude: pickupDraft.longitude,
        destination_latitude: drop.latitude,
        destination_longitude: drop.longitude,
        vehicle_type_id: selectedVehicle.id,
        pickup_address: pickupDraft.label ?? coordLabel(pickupDraft),
        destination_address: drop.label ?? 'Destination',
        payment_method: 'online',
        idempotency_key: idempotencyRef.current,
      });
    },
    onSuccess: (ride) => {
      useRidesDraftStore.getState().setPickup(pickupDraft);
      toast('Ride requested — finding a driver');
      router.replace(`/ride/${ride.id}` as never);
    },
    onError: () => {
      setConfirmError('Could not confirm your pickup. Please try again.');
      toast('Could not confirm your pickup.', 'error');
    },
  });

  const onConfirm = () => {
    setConfirmError(null);
    if (!pickupDraft || !drop || !selectedVehicle) {
      setConfirmError('Please choose a pickup, destination and vehicle first.');
      return;
    }
    if (bookMutation.isPending) return;
    bookMutation.mutate();
  };

  const pickupLabel = pickupDraft?.label ?? (pickupDraft ? coordLabel(pickupDraft) : 'Set your pickup');
  const route = routeQuery.data?.polyline ?? null;

  return (
    <Screen header={null} scroll={false} padded={false} bottomNav={false}>
      <View style={styles.root}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
            <ArrowLeft size={20} color={colors.ink[900]} />
          </Pressable>
          <Text style={styles.headerTitle}>Confirm pickup</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.mapWrap}>
          <RideMap
            currentLocation={null}
            pickup={pickupDraft}
            drop={drop}
            mode="pickup"
            route={route}
            hidePickOverlay
            onPendingChange={handlePendingChange}
            onPick={() => {}}
          />
          <View style={styles.pickupChip}>
            <MapPin size={13} color={colors.accent[500]} />
            <Text style={styles.pickupChipText}>Pickup Point</Text>
          </View>
        </View>

        <ScrollView style={styles.panel} contentContainerStyle={styles.panelContent}>
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={[styles.iconDot, { backgroundColor: withAlpha(colors.success, 0.12) }]}>
                <MapPin size={16} color={colors.success} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>Pickup Point</Text>
                <View style={styles.valueRow}>
                  <Text style={styles.rowValue} numberOfLines={1}>
                    {pickupLabel}
                  </Text>
                  {resolving && <ActivityIndicator size="small" color={colors.neutral[400]} />}
                </View>
                <Text style={styles.rowHint}>Tap the map or drag the pin to adjust your pickup.</Text>
              </View>
              <Pressable
                onPress={() => router.push('/rides/destination?field=pickup' as never)}
                hitSlop={8}
                style={styles.editBtn}
              >
                <Pencil size={12} color={colors.neutral[500]} />
                <Text style={styles.editBtnText}>Edit</Text>
              </Pressable>
            </View>

            <View style={styles.separator} />

            <View style={styles.row}>
              <View style={[styles.iconDot, { backgroundColor: withAlpha(colors.accent[500], 0.12) }]}>
                <Navigation size={16} color={colors.accent[500]} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>Destination</Text>
                <Text style={styles.rowValue} numberOfLines={1}>
                  {drop?.label ?? 'Destination'}
                </Text>
                {routeQuery.data && (
                  <Text style={styles.rowHint}>
                    {routeQuery.data.distance_km} km · ~{routeQuery.data.duration_min} min
                  </Text>
                )}
              </View>
            </View>
          </View>

          {selectedVehicle && (
            <View style={styles.fareCard}>
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>Your ride</Text>
                <Text style={styles.rowValue} numberOfLines={1}>
                  {selectedVehicle.name}
                </Text>
              </View>
              {fare ? (
                <Text style={styles.fareValue}>{formatCurrency(fare.estimated_fare)}</Text>
              ) : (
                <ActivityIndicator size="small" color={colors.neutral[400]} />
              )}
            </View>
          )}

          {confirmError && <Text style={styles.errorText}>{confirmError}</Text>}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Pressable
            onPress={onConfirm}
            disabled={bookMutation.isPending || !pickupDraft || !drop || !selectedVehicle}
            style={[styles.confirmBtn, (bookMutation.isPending || !pickupDraft || !drop || !selectedVehicle) && styles.confirmBtnDisabled]}
          >
            {bookMutation.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Check size={18} color="#fff" strokeWidth={3} />
                <Text style={styles.confirmBtnText}>Confirm pickup</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.ink[900],
  },
  mapWrap: {
    height: 280,
    backgroundColor: colors.ink[100],
  },
  pickupChip: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: withAlpha(colors.ink[900], 0.9),
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  pickupChipText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  panel: {
    flex: 1,
  },
  panelContent: {
    padding: 16,
    gap: 12,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: 18,
    backgroundColor: '#fff',
    padding: 14,
  },
  fareCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: 18,
    backgroundColor: '#fff',
    padding: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  iconDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rowLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.neutral[400],
  },
  rowValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.ink[900],
    flexShrink: 1,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rowHint: {
    fontSize: 11,
    color: colors.neutral[500],
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  editBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.neutral[500],
  },
  separator: {
    height: 1,
    backgroundColor: colors.neutral[100],
    marginVertical: 12,
  },
  fareValue: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.ink[900],
  },
  errorText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.danger,
    backgroundColor: withAlpha(colors.danger, 0.08),
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.ink[100],
    backgroundColor: '#fff',
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.brand[600],
  },
  confirmBtnDisabled: {
    opacity: 0.5,
  },
  confirmBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
});
