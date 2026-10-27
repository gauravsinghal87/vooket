import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, MapPin, Navigation, User, XCircle, Star, Loader2, Phone, Search, KeyRound, BadgeCheck } from 'lucide-react';
import { repositories } from '@/repositories';
import { useRealtimeRide } from '@/lib/realtime';
import { RideTrackingMap } from '@/components/rides/RideTrackingMap';
import { RidePaymentCard } from '@/components/rides/pay-now-card';
import { StatusTracker, buildSteps } from '@/components/order/status-tracker';
import { Card } from '@/components/ui/card';
import { Price } from '@/components/ui/price';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Rating } from '@/components/ui/rating';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

const RIDE_FLOW: string[] = ['REQUESTING', 'DRIVER_ASSIGNED', 'DRIVER_ARRIVING', 'DRIVER_ARRIVED', 'IN_PROGRESS', 'COMPLETED'];
const RIDE_FLOW_LABELS: Record<string, string> = {
  REQUESTING: 'SEARCHING DRIVER',
  DRIVER_ASSIGNED: 'DRIVER ASSIGNED',
  DRIVER_ARRIVING: 'DRIVER ARRIVING',
  DRIVER_ARRIVED: 'DRIVER ARRIVED',
  IN_PROGRESS: 'TRIP STARTED',
  COMPLETED: 'TRIP COMPLETED',
};

export function RideDetailPage() {
  const { id } = useParams();
  const rideId = Number(id);
  const queryClient = useQueryClient();
  const [rateOpen, setRateOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');

  const { data: initial, isError, refetch } = useQuery({
    queryKey: ['ride', rideId],
    queryFn: () => repositories.rides.getRide(rideId),
    enabled: Number.isFinite(rideId),
    retry: false,
  });
  const { data: liveRide } = useRealtimeRide(rideId);

  const { data: appConfig } = useQuery({
    queryKey: ['app-config'],
    queryFn: () => repositories.user.getAppConfig(),
    staleTime: 5 * 60 * 1000,
  });
  const mapsApiKey = appConfig?.maps?.enabled === true && appConfig?.maps?.public_key ? appConfig.maps.public_key : null;

  const ride = liveRide ?? initial;

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
    if (isError) {
      return (
        <div className="mx-auto max-w-2xl space-y-3">
          <Card className="flex flex-col items-center gap-2 p-8 text-center">
            <XCircle className="h-10 w-10 text-danger" />
            <p className="text-lg font-extrabold text-neutral-900">Ride not found</p>
            <p className="text-sm text-neutral-500">
              This ride was removed or is no longer available.
            </p>
            <div className="mt-3 flex gap-2">
              <Link to="/orders">
                <Button variant="outline">Back to rides</Button>
              </Link>
              <Button onClick={() => refetch()}>
                <Search className="h-4 w-4" /> Try again
              </Button>
            </div>
          </Card>
        </div>
      );
    }
    return (
      <div className="mx-auto max-w-2xl space-y-3">
        <Skeleton className="h-48 w-full rounded-3xl" />
        <Skeleton className="h-40 w-full rounded-3xl" />
      </div>
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
  const pickupPoint = (() => {
    const lat = parseFloat(ride.pickup_latitude);
    const lng = parseFloat(ride.pickup_longitude);
    return Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0) ? { latitude: lat, longitude: lng } : null;
  })();
  const destinationPoint = (() => {
    const lat = parseFloat(ride.destination_latitude);
    const lng = parseFloat(ride.destination_longitude);
    return Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0) ? { latitude: lat, longitude: lng } : null;
  })();
  const driverPoint = (() => {
    const lat = parseFloat(ride.driver?.latitude ?? '');
    const lng = parseFloat(ride.driver?.longitude ?? '');
    return Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0) ? { latitude: lat, longitude: lng } : null;
  })();
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
  const paymentSatisfied = ['paid', 'PAID'].includes(ride.payment_status?.toLowerCase());
  const cashCollected = Boolean(ride.cash_collected);
  const cashSettled = Boolean(ride.cash_settled);
  const pendingOnlinePayment =
    !rideFinished && ride.payment_method === 'online' && !paymentSatisfied;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link
        to="/orders"
        className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600"
      >
        <ArrowLeft className="h-4 w-4" /> Rides
      </Link>

      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-extrabold text-neutral-900">{ride.ride_number}</h1>
            <p className="mt-0.5 text-xs text-neutral-500">
              {ride.vehicle_type?.name ?? 'Ride'} · {new Date(ride.created_at).toLocaleString('en-IN')}
            </p>
          </div>
          <Badge variant={isCancelled ? 'danger' : searching ? 'warning' : 'brand'}>
            {RIDE_FLOW_LABELS[ride.status] ?? ride.status.replace(/_/g, ' ')}
          </Badge>
        </div>

        {searching && (
          <div className="mt-5 flex items-center gap-3 rounded-2xl bg-brand-50 p-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white">
              <Search className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-bold text-brand-800">Searching for a driver…</p>
              <p className="text-xs text-brand-600">This usually takes a minute.</p>
            </div>
          </div>
        )}

        {isCancelled ? (
          <div className="mt-5 rounded-2xl bg-danger/10 p-4 text-center text-sm font-semibold text-danger">
            {ride.status === 'NO_DRIVER_FOUND'
              ? 'No driver was found. Please try booking again.'
              : 'This ride was cancelled.'}
          </div>
        ) : (
          !searching && (
            <div className="mt-6">
              <StatusTracker steps={steps} />
            </div>
          )
        )}
      </Card>

      {tracking && mapsApiKey && (pickupPoint || destinationPoint) && (
        <Card className="overflow-hidden p-0">
          <RideTrackingMap
            apiKey={mapsApiKey}
            pickup={pickupPoint}
            destination={destinationPoint}
            driverLocation={driverPoint}
            className="h-56 w-full"
            labels={{
              pickup: ride.pickup_address ?? 'Pickup',
              destination: ride.destination_address ?? 'Drop',
              driver: ride.driver?.name ?? ride.driver?.user?.name ?? 'Driver',
            }}
          />
          <div className="flex items-center gap-3 p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <Navigation className="h-4 w-4" />
            </span>
            <p className="text-sm text-neutral-600">{trackingCaption}</p>
          </div>
        </Card>
      )}

      <Card className="p-4">
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-brand-50 text-brand-600">
              <MapPin className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-xs text-neutral-500">Pickup</p>
              <p className="text-sm font-semibold text-neutral-900">{ride.pickup_address ?? 'Pickup location'}</p>
            </div>
          </div>
          <div className="ml-4 h-5 w-px bg-neutral-200" />
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-success/10 text-success">
              <Navigation className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-xs text-neutral-500">Destination</p>
              <p className="text-sm font-semibold text-neutral-900">{ride.destination_address ?? 'Drop location'}</p>
            </div>
          </div>
          {ride.distance_km && (
            <p className="pl-11 text-xs text-neutral-500">
              {ride.distance_km} km · {ride.duration_min ?? '—'} min
            </p>
          )}
        </div>
      </Card>

      {ride.driver && (
        <Card className="flex items-center gap-3 p-4">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-neutral-100 text-neutral-600">
            <User className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-neutral-900">
              {ride.driver.name ?? ride.driver.user?.name ?? 'Your driver'}
            </p>
            <p className="mt-0.5">
              {ride.driver.rating ? <Rating value={ride.driver.rating} /> : <span className="text-xs text-neutral-400">Driver</span>}
            </p>
          </div>
          {ride.driver.phone && (
            <a
              href={`tel:${ride.driver.phone}`}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-600 text-white"
              aria-label="Call driver"
            >
              <Phone className="h-4 w-4" />
            </a>
          )}
        </Card>
      )}

      {pendingOtp && (
        <Card className="p-4">
          <div className="rounded-2xl bg-brand-50 px-4 py-5 text-center">
            <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white">
              <KeyRound className="h-5 w-5" />
            </span>
            <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-brand-700">Trip OTP</p>
            <p className="mt-2 font-mono text-3xl font-extrabold tracking-[0.3em] text-neutral-900">{ride.otp}</p>
            <p className="mt-2 text-xs leading-relaxed text-neutral-500">
              Share this code with your driver. They will ask for it before starting the trip.
            </p>
          </div>
        </Card>
      )}

      <Card className="p-4">
        <h2 className="mb-3 text-sm font-bold text-neutral-900">Fare details</h2>
        <div className="space-y-1.5 text-sm">
          <FareRow label="Base fare" value={ride.base_fare} />
          <FareRow label="Distance charge" value={ride.distance_charge} />
          <FareRow label="Time charge" value={ride.time_charge} />
          <FareRow label="Booking fee" value={ride.booking_fee} />
          <FareRow label="Platform fee" value={ride.platform_fee} />
          {parseFloat(ride.surge_amount ?? '0') > 0 && <FareRow label="Surge" value={ride.surge_amount ?? '0'} />}
          {ride.discount_amount && parseFloat(ride.discount_amount) > 0 && (
            <FareRow label="Discount" value={`-${ride.discount_amount}`} tone="text-success" />
          )}
          <div className="flex items-center justify-between border-t border-neutral-100 pt-2">
            <span className="font-bold text-neutral-900">
              {ride.final_fare ? 'Final fare' : 'Estimated fare'}
            </span>
            <span className="text-base font-extrabold text-neutral-900">
              <Price value={ride.final_fare ?? ride.estimated_fare} />
            </span>
          </div>
        </div>
      </Card>

      {paymentSatisfied && ride.payment_method === 'online' && (
        <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          <BadgeCheck className="h-5 w-5 shrink-0" />
          Paid online
        </div>
      )}

      {cashCollected && !cashSettled && !rideFinished && (
        <div className="rounded-2xl bg-amber-50 px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-bold text-amber-800">Cash payment</p>
            <Price value={ride.cash_collected_amount ?? ride.final_fare ?? ride.estimated_fare} size="sm" />
          </div>
          <p className="mt-0.5 text-xs text-amber-700">Cash payment collected by driver.</p>
        </div>
      )}

      {cashSettled && (
        <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          <BadgeCheck className="h-5 w-5 shrink-0" />
          Payment completed
        </div>
      )}

      {pendingOnlinePayment && <RidePaymentCard ride={ride} />}

      <div className="flex flex-wrap gap-2">
        {cancellable && (
          <Button variant="danger" onClick={() => cancel.mutate()} disabled={cancel.isPending}>
            {cancel.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
            Cancel ride
          </Button>
        )}
        {canRate && (
          <Button onClick={() => setRateOpen(true)}>
            <Star className="h-4 w-4" /> Rate driver
          </Button>
        )}
      </div>

      <BottomSheet title="Rate your driver" open={rateOpen} onOpenChange={setRateOpen}>
        <div className="space-y-4">
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} aria-label={`${n} stars`} onClick={() => setRating(n)}>
                <Star
                  className={cn(
                    'h-9 w-9 transition-transform',
                    n <= rating ? 'fill-warning text-warning' : 'text-neutral-200 hover:scale-110'
                  )}
                />
              </button>
            ))}
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="How was your trip? (optional)"
            rows={3}
            className="w-full rounded-2xl border border-neutral-200 bg-white p-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
          <Button className="w-full" onClick={() => rate.mutate()} disabled={rate.isPending}>
            {rate.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Submit
          </Button>
        </div>
      </BottomSheet>
    </div>
  );
}

function FareRow({ label, value, tone }: { label: string; value: string; tone?: string }) {
  if (value === null || value === undefined || value === '0.00' || value === '') return null;
  return (
    <div className="flex items-center justify-between">
      <span className="text-neutral-500">{label}</span>
      <span className={cn('font-medium text-neutral-800', tone)}>
        <Price value={value} size="sm" />
      </span>
    </div>
  );
}