import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import {
  ArrowLeft,
  BadgeCheck,
  CreditCard as CreditCardIcon,
  HelpCircle,
  KeyRound,
  Loader,
  MapPin,
  Navigation,
  Phone,
  RefreshCw,
  Search,
  Star,
  User,
  XCircle,
} from 'lucide-react-native';
import { repositories } from '@/api/repositories';
import { useRealtimeRide } from '@/lib/realtime';
import { StatusTracker, buildSteps } from '@/components/order/StatusTracker';
import { createUsableCheckout, completeOrderPayment } from '@/lib/payments';
import { Screen } from '@/components/Screen';
import { AppHeader } from '@/components/AppHeader';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { SupportRequestSheet } from '@/components/support/SupportRequestSheet';
import { EmptyState, Loader as Spinner, RatingStars } from '@/components/ui/primitives';
import { toast } from '@/stores/toastStore';
import { formatCurrency } from '@/lib/utils';
import { colors, withAlpha } from '@/theme';
import type { Ride } from '@/types/models';

const RIDE_FLOW = ['REQUESTING', 'DRIVER_ASSIGNED', 'DRIVER_ARRIVING', 'DRIVER_ARRIVED', 'IN_PROGRESS', 'COMPLETED'] as const;
const RIDE_FLOW_LABELS: Record<string, string> = {
  REQUESTING: 'SEARCHING DRIVER',
  DRIVER_ASSIGNED: 'DRIVER ASSIGNED',
  DRIVER_ARRIVING: 'DRIVER ARRIVING',
  DRIVER_ARRIVED: 'DRIVER ARRIVED',
  IN_PROGRESS: 'TRIP STARTED',
  COMPLETED: 'TRIP COMPLETED',
};

interface Point {
  latitude: number;
  longitude: number;
}

function toPoint(lat: string | null | undefined, lng: string | null | undefined): Point | null {
  if (!lat || !lng) return null;
  const la = parseFloat(lat);
  const lo = parseFloat(lng);
  return Number.isFinite(la) && Number.isFinite(lo) && (la !== 0 || lo !== 0) ? { latitude: la, longitude: lo } : null;
}

export default function RideDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const rideId = Number(params.id);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [rateOpen, setRateOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');

  const initialQuery = useQuery({
    queryKey: ['ride', rideId],
    queryFn: () => repositories.rides.getRide(rideId),
    enabled: Number.isFinite(rideId) && rideId > 0,
    retry: false,
  });
  const { data: liveRide } = useRealtimeRide(Number.isFinite(rideId) ? rideId : undefined);

  const { data: appConfig } = useQuery({
    queryKey: ['app-config'],
    queryFn: () => repositories.user.getAppConfig(),
    staleTime: 5 * 60 * 1000,
  });
  const mapsApiKey = appConfig?.maps?.enabled === true && appConfig?.maps?.public_key ? appConfig.maps.public_key : null;

  const ride = liveRide ?? initialQuery.data;

  const cancel = useMutation({
    mutationFn: () => repositories.rides.cancel(rideId, 'Customer cancelled'),
    onSuccess: () => {
      toast('Ride cancelled');
      queryClient.invalidateQueries({ queryKey: ['ride', rideId] });
    },
    onError: () => toast('Could not cancel ride', 'error'),
  });

  const rate = useMutation({
    mutationFn: () => repositories.rides.rate(rideId, rating, comment || undefined),
    onSuccess: () => {
      toast('Thanks for rating your driver!');
      setRateOpen(false);
    },
    onError: () => toast('Could not submit rating', 'error'),
  });

  if (!ride) {
    if (initialQuery.isError) {
      return (
        <Screen header={<AppHeader variant="dark" title="Ride" />}>
          <View style={styles.notFound}>
            <XCircle size={40} color={colors.danger} />
            <Text style={styles.notFoundTitle}>Ride not found</Text>
            <Text style={styles.notFoundDesc}>This ride was removed or is no longer available.</Text>
            <Pressable style={styles.outlineBtn} onPress={() => router.push('/orders' as never)}>
              <Text style={styles.outlineBtnText}>Back to rides</Text>
            </Pressable>
            <Pressable style={styles.retryBtn} onPress={() => void initialQuery.refetch()}>
              <RefreshCw size={16} color="#fff" />
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        </Screen>
      );
    }
    return (
      <Screen header={<AppHeader variant="dark" title="Ride" />}>
        <Spinner label="Loading ride…" />
      </Screen>
    );
  }

  const isCancelled = ride.status === 'CANCELLED' || ride.status === 'NO_DRIVER_FOUND';
  const steps = buildSteps(RIDE_FLOW, ride.status, isCancelled).map((s) => ({
    ...s,
    label: RIDE_FLOW_LABELS[s.key] ?? s.label,
  }));
  const cancellable =
    !isCancelled && ['REQUESTING', 'DRIVER_ASSIGNED', 'DRIVER_ARRIVING', 'DRIVER_ARRIVED'].includes(ride.status);
  const canRate = ride.status === 'TRIP_COMPLETED' || ride.status === 'COMPLETED';
  const searching = ride.status === 'REQUESTING';
  const tracking =
    !isCancelled && ['DRIVER_ASSIGNED', 'DRIVER_ARRIVING', 'DRIVER_ARRIVED', 'IN_PROGRESS'].includes(ride.status);
  const pickupPoint = toPoint(ride.pickup_latitude, ride.pickup_longitude);
  const destinationPoint = toPoint(ride.destination_latitude, ride.destination_longitude);
  const driverPoint = toPoint(ride.driver?.latitude, ride.driver?.longitude);
  const trackingCaption =
    ride.status === 'DRIVER_ARRIVING'
      ? 'Your driver is on the way to the pickup point.'
      : ride.status === 'DRIVER_ARRIVED'
        ? 'Your driver has arrived at the pickup point.'
        : ride.status === 'IN_PROGRESS'
          ? 'Your trip is in progress. Sit back and enjoy the ride.'
          : 'Your driver has been assigned and is heading your way.';
  const pendingOtp =
    !isCancelled &&
    !ride.otp_verified &&
    !!ride.driver &&
    !!ride.otp &&
    ['DRIVER_ASSIGNED', 'DRIVER_ARRIVING', 'DRIVER_ARRIVED'].includes(ride.status);
  const rideFinished = ['COMPLETED', 'TRIP_COMPLETED', 'CANCELLED', 'NO_DRIVER_FOUND'].includes(ride.status);
  const paymentSatisfied = ['paid', 'PAID'].includes(ride.payment_status?.toLowerCase() ?? '');
  const cashCollected = Boolean(ride.cash_collected);
  const cashSettled = Boolean(ride.cash_settled);
  const pendingOnlinePayment = !rideFinished && ride.payment_method === 'online' && !paymentSatisfied;

  const focus = driverPoint ?? pickupPoint ?? destinationPoint;

  return (
    <Screen header={<AppHeader variant="dark" title="Ride" />}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable style={styles.backRow} onPress={() => router.push('/orders' as never)} hitSlop={6}>
          <ArrowLeft size={16} color={colors.brand[700]} />
          <Text style={styles.backText}>Rides</Text>
        </Pressable>

        <View style={styles.card}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rideNumber}>{ride.ride_number}</Text>
              <Text style={styles.rideMeta}>
                {ride.vehicle_type?.name ?? 'Ride'} · {new Date(ride.created_at).toLocaleString('en-IN')}
              </Text>
            </View>
            <View style={[styles.badge, { backgroundColor: withAlpha(isCancelled ? colors.danger : searching ? '#b45309' : colors.brand[700], 0.12) }]}>
              <Text style={[styles.badgeText, { color: isCancelled ? colors.danger : searching ? '#b45309' : colors.brand[700] }]}>
                {RIDE_FLOW_LABELS[ride.status] ?? ride.status.replace(/_/g, ' ')}
              </Text>
            </View>
          </View>

          {searching && (
            <View style={styles.searchingBanner}>
              <View style={styles.searchingIcon}>
                <Search size={20} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.searchingTitle}>Searching for a driver…</Text>
                <Text style={styles.searchingDesc}>This usually takes a minute.</Text>
              </View>
            </View>
          )}

          {isCancelled ? (
            <View style={styles.cancelledBanner}>
              <Text style={styles.cancelledText}>
                {ride.status === 'NO_DRIVER_FOUND' ? 'No driver was found. Please try booking again.' : 'This ride was cancelled.'}
              </Text>
            </View>
          ) : (
            !searching && (
              <View style={styles.tracker}>
                <StatusTracker steps={steps} tone="brand" />
              </View>
            )
          )}
        </View>

        {tracking && mapsApiKey && (pickupPoint || destinationPoint) && (
          <View style={[styles.card, { padding: 0, gap: 0 }]}>
            {focus && (
              <MapView
                provider={PROVIDER_DEFAULT}
                style={styles.map}
                initialRegion={{ latitude: focus.latitude, longitude: focus.longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
              >
                {pickupPoint && <Marker coordinate={pickupPoint} title="Pickup" pinColor="#10b981" />}
                {destinationPoint && <Marker coordinate={destinationPoint} title="Destination" pinColor="#ea320c" />}
                {driverPoint && <Marker coordinate={driverPoint} title={ride.driver?.name ?? ride.driver?.user?.name ?? 'Driver'} pinColor={colors.brand[700]} />}
              </MapView>
            )}
            <View style={styles.trackingCaption}>
              <View style={styles.navigationIcon}>
                <Navigation size={16} color={colors.brand[700]} />
              </View>
              <Text style={styles.trackingCaptionText}>{trackingCaption}</Text>
            </View>
          </View>
        )}

        <View style={styles.card}>
          <View style={styles.routeStep}>
            <View style={styles.routeIconPickup}>
              <MapPin size={16} color={colors.brand[700]} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.routeLabel}>Pickup</Text>
              <Text style={styles.routeAddress}>{ride.pickup_address ?? 'Pickup location'}</Text>
            </View>
          </View>
          <View style={styles.routeLine} />
          <View style={styles.routeStep}>
            <View style={styles.routeIconDrop}>
              <Navigation size={16} color={colors.grocery[600]} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.routeLabel}>Destination</Text>
              <Text style={styles.routeAddress}>{ride.destination_address ?? 'Drop location'}</Text>
            </View>
          </View>
          {ride.distance_km && (
            <Text style={styles.routeDistance}>
              {ride.distance_km} km · {ride.duration_min ?? '—'} min
            </Text>
          )}
        </View>

        {ride.driver && (
          <View style={styles.driverCard}>
            <View style={styles.driverAvatar}>
              <User size={20} color={colors.neutral[500]} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.driverName} numberOfLines={1}>
                {ride.driver.name ?? ride.driver.user?.name ?? 'Your driver'}
              </Text>
              {ride.driver.rating ? (
                <RatingStars rating={ride.driver.rating} size={13} />
              ) : (
                <Text style={styles.driverMeta}>Driver</Text>
              )}
            </View>
            {ride.driver.phone && (
              <Pressable style={styles.callBtn} hitSlop={6} onPress={() => {}}>
                <Phone size={16} color="#fff" />
              </Pressable>
            )}
          </View>
        )}

        {pendingOtp && (
          <View style={styles.card}>
            <View style={styles.otpBox}>
              <View style={styles.otpIcon}>
                <KeyRound size={20} color="#fff" />
              </View>
              <Text style={styles.otpLabel}>Trip OTP</Text>
              <Text style={styles.otpCode}>{ride.otp}</Text>
              <Text style={styles.otpDesc}>
                Share this code with your driver. They will ask for it before starting the trip.
              </Text>
            </View>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Fare details</Text>
          <View style={styles.fareList}>
            <FareRow label="Base fare" value={ride.base_fare} />
            <FareRow label="Distance charge" value={ride.distance_charge} />
            <FareRow label="Time charge" value={ride.time_charge} />
            <FareRow label="Booking fee" value={ride.booking_fee} />
            <FareRow label="Platform fee" value={ride.platform_fee} />
            {parseFloat(ride.surge_amount ?? '0') > 0 && <FareRow label="Surge" value={ride.surge_amount ?? '0'} />}
            {ride.discount_amount && parseFloat(ride.discount_amount) > 0 && (
              <FareRow label="Discount" value={ride.discount_amount} positive />
            )}
            <View style={styles.fareTotalRow}>
              <Text style={styles.fareTotalLabel}>{ride.final_fare ? 'Final fare' : 'Estimated fare'}</Text>
              <Text style={styles.fareTotalValue}>{formatCurrency(ride.final_fare ?? ride.estimated_fare)}</Text>
            </View>
          </View>
        </View>

        {paymentSatisfied && ride.payment_method === 'online' && (
          <View style={styles.greenBanner}>
            <BadgeCheck size={20} color="#047857" />
            <Text style={styles.greenText}>Paid online</Text>
          </View>
        )}

        {cashCollected && !cashSettled && !rideFinished && (
          <View style={styles.amberBanner}>
            <View style={styles.amberRow}>
              <Text style={styles.amberTitle}>Cash payment</Text>
              <Text style={styles.amberValue}>{formatCurrency(ride.cash_collected_amount ?? ride.final_fare ?? ride.estimated_fare)}</Text>
            </View>
            <Text style={styles.amberDesc}>Cash payment collected by driver.</Text>
          </View>
        )}

        {cashSettled && (
          <View style={styles.greenBanner}>
            <BadgeCheck size={20} color="#047857" />
            <Text style={styles.greenText}>Payment completed</Text>
          </View>
        )}

        {pendingOnlinePayment && <RidePayNowCard ride={ride} />}

        <View style={styles.actions}>
          <Pressable style={styles.helpBtn} onPress={() => setSupportOpen(true)}>
            <HelpCircle size={16} color={colors.ink[800]} />
            <Text style={styles.helpBtnText}>Get help</Text>
          </Pressable>
          {cancellable && (
            <Pressable style={[styles.cancelBtn, cancel.isPending && { opacity: 0.6 }]} onPress={() => cancel.mutate()} disabled={cancel.isPending}>
              {cancel.isPending ? <Loader size={16} color={colors.danger} /> : <XCircle size={16} color={colors.danger} />}
              <Text style={styles.cancelBtnText}>{cancel.isPending ? 'Cancelling…' : 'Cancel ride'}</Text>
            </Pressable>
          )}
          {canRate && (
            <Pressable style={styles.rateDriverBtn} onPress={() => setRateOpen(true)}>
              <Star size={16} color="#fff" />
              <Text style={styles.rateDriverText}>Rate driver</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>

      <SupportRequestSheet
        title="Get help with this ride"
        subtitle={
          ride
            ? `Ride ${ride.ride_number} · ${ride.vehicle_type?.name ?? 'Ride'} · ${formatCurrency(ride.final_fare ?? ride.estimated_fare)}`
            : undefined
        }
        visible={supportOpen}
        onClose={() => setSupportOpen(false)}
        module="ride"
        referenceType="ride"
        referenceId={ride?.id ?? 0}
        ticketType="ride"
        subjectFallback={ride ? `Ride ${ride.ride_number} support request` : 'Ride support request'}
        totalAmount={ride ? Number(ride.final_fare ?? ride.estimated_fare ?? 0) : null}
        onSubmitted={() => toast('Request submitted', 'success')}
      />

      <BottomSheet title="Rate your driver" visible={rateOpen} onClose={() => setRateOpen(false)}>
        <View style={styles.rateStars}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Pressable key={n} onPress={() => setRating(n)} hitSlop={6}>
              <Star size={36} color={n <= rating ? '#f59e0b' : colors.neutral[200]} fill={n <= rating ? '#f59e0b' : 'transparent'} />
            </Pressable>
          ))}
        </View>
        <TextInput
          value={comment}
          onChangeText={setComment}
          placeholder="How was your trip? (optional)"
          placeholderTextColor={colors.neutral[400]}
          multiline
          style={styles.rateInput}
        />
        <Pressable style={[styles.submitBtn, rate.isPending && { opacity: 0.6 }]} onPress={() => rate.mutate()} disabled={rate.isPending}>
          <Text style={styles.submitText}>{rate.isPending ? 'Submitting…' : 'Submit'}</Text>
        </Pressable>
      </BottomSheet>
    </Screen>
  );
}

function FareRow({ label, value, positive }: { label: string; value: string | null | undefined; positive?: boolean }) {
  if (value === null || value === undefined || value === '0.00' || value === '') return null;
  return (
    <View style={styles.fareRow}>
      <Text style={styles.fareLabel}>{label}</Text>
      <Text style={[styles.fareValue, positive && { color: colors.grocery[600] }]}>
        {positive ? `-${formatCurrency(value)}` : formatCurrency(value)}
      </Text>
    </View>
  );
}

function RidePayNowCard({ ride }: { ride: Ride }) {
  const queryClient = useQueryClient();
  const pay = useMutation({
    mutationFn: async () => {
      const checkout = await createUsableCheckout(
        (idempotencyKey) =>
          repositories.payments.initiate({
            payable_type: 'ride',
            payable_id: ride.id,
            payment_method: 'card',
            idempotency_key: idempotencyKey,
          }),
        `ride:pay:${ride.id}`
      );
      return completeOrderPayment(checkout);
    },
    onSuccess: (result) => {
      if (result.status === 'paid') {
        toast('Payment successful!');
        queryClient.invalidateQueries({ queryKey: ['ride', ride.id] });
      } else {
        toast('Payment cancelled. You can pay again.', 'error');
      }
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Payment could not be completed.', 'error'),
  });

  return (
    <View style={styles.card}>
      <View style={styles.payHead}>
        <View style={styles.payIcon}>
          <CreditCardIcon />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>Payment pending</Text>
          <Text style={styles.payDesc}>
            Trip fare {formatCurrency(ride.estimated_fare)} · Complete payment to finish your trip.
          </Text>
        </View>
      </View>
      <Pressable style={[styles.payNowBtn, pay.isPending && { opacity: 0.6 }]} onPress={() => pay.mutate()} disabled={pay.isPending}>
        {pay.isPending ? <Loader size={16} color="#fff" /> : <CreditCardIcon />}
        <Text style={styles.payNowText}>{pay.isPending ? 'Processing…' : 'Pay now'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingBottom: 40,
    gap: 14,
  },
  notFound: {
    alignItems: 'center',
    gap: 10,
    padding: 24,
  },
  notFoundTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.ink[900],
  },
  notFoundDesc: {
    fontSize: 14,
    color: colors.neutral[500],
    textAlign: 'center',
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  backText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.brand[700],
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.neutral[100],
    gap: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  rideNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.ink[900],
  },
  rideMeta: {
    fontSize: 12,
    color: colors.neutral[500],
    marginTop: 2,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  searchingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    backgroundColor: withAlpha(colors.brand[50], 0.8),
    padding: 14,
  },
  searchingIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.brand[700],
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchingTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.brand[800],
  },
  searchingDesc: {
    fontSize: 12,
    color: colors.brand[700],
  },
  cancelledBanner: {
    borderRadius: 16,
    backgroundColor: withAlpha(colors.danger, 0.1),
    padding: 14,
    alignItems: 'center',
  },
  cancelledText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.danger,
  },
  tracker: {
    marginTop: 8,
  },
  map: {
    height: 224,
  },
  trackingCaption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
  },
  navigationIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: withAlpha(colors.brand[50], 0.8),
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackingCaptionText: {
    flex: 1,
    fontSize: 14,
    color: colors.neutral[500],
  },
  routeStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  routeIconPickup: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: withAlpha(colors.brand[50], 0.8),
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeIconDrop: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: withAlpha(colors.grocery[500], 0.1),
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeLabel: {
    fontSize: 12,
    color: colors.neutral[500],
  },
  routeAddress: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink[900],
  },
  routeLine: {
    height: 20,
    width: 2,
    backgroundColor: colors.neutral[200],
    marginLeft: 15,
  },
  routeDistance: {
    fontSize: 12,
    color: colors.neutral[500],
    paddingLeft: 44,
  },
  driverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.neutral[100],
    padding: 14,
  },
  driverAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.neutral[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverName: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.ink[900],
  },
  driverMeta: {
    fontSize: 12,
    color: colors.neutral[400],
  },
  callBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.brand[700],
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpBox: {
    borderRadius: 16,
    backgroundColor: withAlpha(colors.brand[50], 0.8),
    paddingVertical: 18,
    paddingHorizontal: 14,
    alignItems: 'center',
    gap: 6,
  },
  otpIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.brand[700],
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpLabel: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: colors.brand[700],
    marginTop: 4,
  },
  otpCode: {
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: 8,
    color: colors.ink[900],
  },
  otpDesc: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.neutral[500],
    textAlign: 'center',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.ink[900],
  },
  fareList: {
    gap: 6,
  },
  fareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fareLabel: {
    fontSize: 13,
    color: colors.neutral[500],
  },
  fareValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.ink[800],
  },
  fareTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.neutral[100],
    paddingTop: 8,
  },
  fareTotalLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.ink[900],
  },
  fareTotalValue: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.ink[900],
  },
  greenBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 16,
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  greenText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#047857',
  },
  amberBanner: {
    borderRadius: 16,
    backgroundColor: withAlpha('#f59e0b', 0.1),
    padding: 14,
    gap: 4,
  },
  amberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  amberTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#92400e',
  },
  amberValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#92400e',
  },
  amberDesc: {
    fontSize: 12,
    color: '#b45309',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  helpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  helpBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink[800],
  },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: withAlpha(colors.danger, 0.3),
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.danger,
  },
  rateDriverBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    backgroundColor: colors.ink[900],
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  rateDriverText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#fff',
  },
  rateStars: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  rateInput: {
    minHeight: 88,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    backgroundColor: '#fff',
    padding: 12,
    fontSize: 14,
    color: colors.ink[900],
    textAlignVertical: 'top',
  },
  submitBtn: {
    borderRadius: 999,
    backgroundColor: colors.ink[900],
    alignItems: 'center',
    paddingVertical: 14,
  },
  submitText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
  },
  payHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  payIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: withAlpha(colors.brand[700], 0.1),
    alignItems: 'center',
    justifyContent: 'center',
  },
  payDesc: {
    fontSize: 12,
    color: colors.neutral[500],
    marginTop: 1,
  },
  payNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 999,
    backgroundColor: colors.ink[900],
    paddingVertical: 13,
  },
  payNowText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
  },
  outlineBtn: {
    marginTop: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  outlineBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink[800],
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    backgroundColor: colors.ink[900],
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  retryText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#fff',
  },
});