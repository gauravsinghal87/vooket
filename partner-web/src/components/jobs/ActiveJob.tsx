import { useEffect, useRef, useState } from 'react';
import { Phone } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { useJobStore, RIDE_SYNC_FIELDS, activeOrderFieldsEqual, activeRideFieldsEqual, applyOrderUpdate } from '@/store/jobStore';
import { driverApi } from '@/repositories/driver';
import { partnerApi } from '@/repositories/partner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/ui/status';
import { toast } from '@/components/ui/toast';
import { formatCurrency, formatMoney } from '@/lib/utils';
import { formatAddress } from '@/lib/job-utils';
import { mapsRouteUrl, pointCoords, rideOrigin, rideDestination } from '@/lib/maps';
import { useMapsKey } from '@/hooks/useMapsKey';
import { RouteMap } from '@/components/jobs/RouteMap';
import { AddMoneyModal } from '@/components/wallet/AddMoneyModal';
import { isActiveBatchJob } from '@/typings/models';
import type { ActiveBatchJob, DeliveryOrder, DeliveryPaymentState } from '@/typings/models';

export function ActiveJobPanel() {
  const role = useAuthStore((s) => s.role);
  return role === 'delivery_partner' ? <PartnerActiveJob /> : <DriverActiveJob />;
}

const DRIVER_STEPS = ['DRIVER_ASSIGNED', 'DRIVER_ARRIVING', 'DRIVER_ARRIVED', 'IN_PROGRESS', 'COMPLETED'];
const ORDER_STEPS = ['PARTNER_ASSIGNED', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'ARRIVED', 'DELIVERED'];

function Stepper({ steps, current }: { steps: string[]; current: string }) {
  const currentIdx = steps.indexOf(current);
  return (
    <div className="flex items-center gap-1">
      {steps.map((s, i) => (
        <div key={s} className="flex flex-1 flex-col items-center gap-1">
          <div className={`h-1.5 w-full rounded-full ${i <= currentIdx ? 'bg-brand-600' : 'bg-ink-100'}`} />
          <span className={`text-[10px] font-medium ${i === currentIdx ? 'text-brand-700' : 'text-neutral-400'}`}>
            {s.replace(/_/g, ' ')}
          </span>
        </div>
      ))}
    </div>
  );
}

function DriverActiveJob() {
  const qc = useQueryClient();
  const { activeRide, setActiveRide } = useJobStore();
  const [otp, setOtp] = useState('');
  const [livePaymentState, setPaymentState] = useState<DeliveryPaymentState | null>(null);
  const [addMoneyOpen, setAddMoneyOpen] = useState(false);
  const mapsApiKey = useMapsKey();

  const { data: hydratedRide } = useQuery({
    queryKey: ['driver', 'active-trip'],
    queryFn: () => driverApi.activeTrip(),
    refetchInterval: 15000,
    refetchIntervalInBackground: true,
  });

  const ride = activeRide ?? hydratedRide ?? null;
  const paymentState = livePaymentState ?? hydratedRide?.payment ?? null;

  useEffect(() => {
    setPaymentState(null);
  }, [ride?.id]);

  // Reconcile the server snapshot into the store ONLY when it differs
  // meaningfully — same pattern PartnerActiveJob uses for orders. This keeps
  // the driver panel in sync when the customer's online payment lands while
  // the ride is live (payment_status flips to "paid" -> Complete unlocks),
  // without re-rendering on every identical poll.
  useEffect(() => {
    if (hydratedRide === null) {
      const current = useJobStore.getState().activeRide;
      if (current) setActiveRide(null);
      return;
    }
    if (hydratedRide === undefined) return;

    const current = useJobStore.getState().activeRide;
    if (!current) {
      setActiveRide(hydratedRide);
      return;
    }
    if (current.id !== hydratedRide.id) {
      setActiveRide(hydratedRide);
      return;
    }
    if (activeRideFieldsEqual(current, hydratedRide)) return;

    // The sync fields have different value types, so collect them by key and
    // merge once rather than assigning through a union-typed index.
    const update: Record<string, unknown> = {};
    for (const key of RIDE_SYNC_FIELDS) {
      if (current[key] !== hydratedRide[key]) update[key] = hydratedRide[key];
    }
    if (Object.keys(update).length === 0) return;
    setActiveRide({ ...current, ...update });
  }, [hydratedRide, setActiveRide]);

  const tripMutation = useMutation({
    mutationFn: (status: string) => driverApi.updateTripStatus(ride!.id, status),
    onSuccess: (updated) => {
      if (updated.status === 'COMPLETED') {
        toast('Trip completed');
        setActiveRide(null);
        void qc.invalidateQueries({ queryKey: ['driver-requests'] });
        void qc.invalidateQueries({ queryKey: ['driver-earnings'] });
        void qc.invalidateQueries({ queryKey: ['driver', 'active-trip'] });
      } else {
        setActiveRide(updated);
      }
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Update failed', 'error'),
  });

  const otpMutation = useMutation({
    mutationFn: () => driverApi.verifyOtp(ride!.id, otp),
    onSuccess: (updated) => {
      toast('OTP verified — trip started');
      setOtp('');
      setActiveRide(updated);
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'OTP verification failed', 'error'),
  });

  const collectMutation = useMutation({
    mutationFn: () => driverApi.cashCollect(ride!.id, 'cash'),
    onSuccess: ({ ride: updated, payment }) => {
      setActiveRide(updated);
      setPaymentState(payment);
      toast('Cash collected — settle the amount in your wallet');
      void qc.invalidateQueries({ queryKey: ['driver-wallet'] });
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Cash collection failed', 'error'),
  });

  const settleMutation = useMutation({
    mutationFn: () => driverApi.settleCash(ride!.id),
    onSuccess: ({ ride: updated, payment, settled }) => {
      setActiveRide(updated);
      setPaymentState(payment);
      toast(settled ? 'Cash settlement complete' : 'Wallet balance is short of the settlement amount');
      void qc.invalidateQueries({ queryKey: ['driver-wallet'] });
      void qc.invalidateQueries({ queryKey: ['driver', 'active-trip'] });
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Cash settlement failed', 'error'),
  });

  if (!ride) return null;

  const status = ride.status.toUpperCase();

  const paidStatus = ['paid', 'PAID'].includes((ride.payment_status ?? '').toLowerCase());
  const walletRide = ride.payment_method === 'wallet';
  const cashCollected = Boolean(ride.cash_collected);
  const cashSettled = Boolean(ride.cash_settled);
  const settlementPending = cashCollected && !cashSettled;
  const paidOnline = paidStatus && !cashCollected;
  const paymentSatisfied = paidStatus && (!cashCollected || cashSettled);
  const canComplete = paymentSatisfied || (walletRide && !cashCollected);
  const fareAmount = ride.final_fare ?? ride.estimated_fare ?? 0;
  const showCollectCash =
    !paidStatus && !cashCollected && !walletRide && ['DRIVER_ARRIVED', 'IN_PROGRESS'].includes(status);
  const unpaid = !paymentSatisfied && !settlementPending;
  const settlementShortfall = paymentState?.settlement === 'pending' ? Math.max(0, Math.ceil(paymentState.shortfall || 0)) : 0;

  const action =
    status === 'DRIVER_ASSIGNED'
      ? { label: "I'm arriving", next: 'arriving' }
      : status === 'DRIVER_ARRIVING'
        ? { label: "I've arrived", next: 'arrived' }
        : null;

  return (
    <Card className="ring-2 ring-brand-600/30">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Active ride</p>
          <p className="font-bold text-neutral-900">{ride.ride_number}</p>
        </div>
        <StatusBadge status={ride.status} />
      </div>

      <Stepper steps={DRIVER_STEPS} current={status} />

      <RouteMap
        apiKey={mapsApiKey}
        origin={rideOrigin(ride)}
        destination={rideDestination(ride)}
        showDriver
        className="mt-4 h-48 w-full overflow-hidden rounded-xl ring-1 ring-ink-100"
        labels={{ origin: 'Pickup', destination: 'Drop' }}
      />

      <div className="mt-4 space-y-2 text-sm">
        <div className="flex items-start gap-2">
          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
          <span className="text-neutral-700">{ride.pickup_address ?? 'Pickup point'}</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-600" />
          <span className="text-neutral-700">{ride.destination_address ?? 'Destination'}</span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-500">
        <span>{Number(ride.distance_km ?? 0).toFixed(1)} km</span>
        <span>{ride.duration_min ?? '—'} min</span>
        <span className="capitalize">{ride.payment_method ?? '—'}</span>
        <span className="ml-auto font-semibold text-neutral-900">{formatCurrency(ride.estimated_fare ?? 0)}</span>
      </div>

      {ride.user && (
        <div className="mt-3 rounded-xl bg-ink-50 px-3 py-2 text-sm">
          <p className="font-medium text-neutral-900">{ride.user.name}</p>
          <p className="text-xs text-neutral-500">{ride.user.phone ?? ''}</p>
        </div>
      )}

      <div className="mt-4">
        {unpaid && (
          <div className="mb-3 rounded-xl bg-ink-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Payment</p>
            <p className="mt-0.5 text-lg font-bold text-neutral-900">{formatCurrency(fareAmount)}</p>
            <p className="mt-0.5 text-xs text-neutral-500">
              {walletRide
                ? 'The fare will be deducted from the customer\u2019s wallet when the trip completes.'
                : showCollectCash
                  ? 'Cash payment — collect from the customer.'
                  : 'The customer can pay online from the customer app, or in cash when you arrive.'}
            </p>
            {showCollectCash && (
              <div className="mt-2 flex gap-2">
                <Button
                  className="flex-1"
                  disabled={collectMutation.isPending || tripMutation.isPending}
                  onClick={() => collectMutation.mutate()}
                >
                  {collectMutation.isPending ? 'Recording…' : 'Collect cash'}
                </Button>
              </div>
            )}
          </div>
        )}

        {paidOnline && (
          <div className="mb-3 rounded-xl bg-emerald-50 p-3">
            <p className="text-sm font-semibold text-emerald-700">Payment received online</p>
            <p className="mt-0.5 text-xs text-emerald-600">No cash to collect — the customer paid on the app.</p>
          </div>
        )}

        {settlementPending && (
          <div className="mb-3 rounded-xl bg-amber-50 p-3">
            {settlementShortfall > 0 ? (
              <>
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Wallet balance insufficient</p>
                <p className="mt-1 text-sm text-neutral-700">
                  Required {formatMoney(paymentState?.required ?? ride.cash_collected_amount ?? 0)} · Available{' '}
                  {formatMoney(paymentState?.available ?? paymentState?.wallet_balance ?? 0)}
                </p>
                <div className="mt-2 flex gap-2">
                  <Button
                    variant="secondary"
                    className="flex-1"
                    disabled={collectMutation.isPending || settleMutation.isPending}
                    onClick={() => setAddMoneyOpen(true)}
                  >
                    Add {formatMoney(settlementShortfall)}
                  </Button>
                </div>
                <p className="mt-1.5 text-xs text-neutral-500">Add money to your wallet, then settle the collected cash.</p>
              </>
            ) : (
              <>
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Cash collected</p>
                <p className="mt-0.5 text-lg font-bold text-neutral-900">
                  {formatMoney(paymentState?.required ?? ride.cash_collected_amount ?? 0)}
                </p>
                <p className="mt-0.5 text-xs text-neutral-500">
                  Cash settlement required — settle from your wallet balance
                  {paymentState ? ` (${formatMoney(paymentState.wallet_balance)})` : ''}.
                </p>
                <div className="mt-2 flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    disabled={settleMutation.isPending || (paymentState?.settlement ?? 'pending') !== 'pending'}
                    onClick={() => settleMutation.mutate()}
                  >
                    {settleMutation.isPending ? 'Settling…' : 'Settle cash'}
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={collectMutation.isPending || settleMutation.isPending}
                    onClick={() => setAddMoneyOpen(true)}
                  >
                    Add money
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {cashSettled && (
          <div className="mb-3 rounded-xl bg-emerald-50 p-3">
            <p className="text-sm font-semibold text-emerald-700">
              Cash payment settled — {formatMoney(ride.cash_collected_amount ?? 0)}
            </p>
            <p className="mt-0.5 text-xs text-emerald-600">Collected cash settled from your wallet — the trip can be completed.</p>
          </div>
        )}

        {action ? (
          <Button
            className="w-full"
            disabled={tripMutation.isPending}
            onClick={() => tripMutation.mutate(action.next)}
          >
            {tripMutation.isPending ? 'Updating…' : action.label}
          </Button>
        ) : status === 'DRIVER_ARRIVED' ? (
          <div className="space-y-2">
            <p className="text-xs text-neutral-500">Ask the customer for the 6-digit OTP to start the trip.</p>
            <div className="flex gap-2">
              <Input
                inputMode="numeric"
                maxLength={6}
                placeholder="••••••"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                className="w-36 font-mono tracking-[0.3em]"
              />
              <Button className="flex-1" disabled={otp.length !== 6 || otpMutation.isPending} onClick={() => otpMutation.mutate()}>
                {otpMutation.isPending ? 'Starting…' : 'Start trip'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <Button
              className="w-full"
              disabled={tripMutation.isPending || !canComplete}
              onClick={() => tripMutation.mutate('completed')}
            >
              {tripMutation.isPending ? 'Completing…' : 'Complete trip'}
            </Button>
            {!canComplete && (
              <p className="text-center text-xs text-amber-600">
                {settlementPending
                  ? 'Settlement pending — settle the collected cash to complete the trip.'
                  : 'Collect cash from the customer or wait for their online payment.'}
              </p>
            )}
          </div>
        )}

        <AddMoneyModal
          open={addMoneyOpen}
          onClose={() => setAddMoneyOpen(false)}
          label="Add money to settle the cash you collected."
          suggested={settlementShortfall}
          onCredited={() => {
            void settleMutation.mutate();
          }}
        />
      </div>
    </Card>
  );
}

function PartnerActiveJob() {
  const activeOrder = useJobStore((s) => s.activeOrder);
  const setActiveOrder = useJobStore((s) => s.setActiveOrder);

  const { data: hydrated } = useQuery({
    queryKey: ['partner', 'active-job'],
    queryFn: () => partnerApi.activeJob(),
    refetchInterval: 15000,
    refetchIntervalInBackground: true,
  });

  // Reconcile the server snapshot into the store ONLY when it differs meaningfully.
  // React Query hands us a fresh object reference on every fetch, so we must not
  // write to Zustand for identical jobs — doing so re-renders this component on
  // every poll and loops. The effect depends only on the (stable) server snapshot,
  // never on the store's own value. `activeOrderFieldsEqual` understands both the
  // flat single-order payload and the batch envelope.
  useEffect(() => {
    if (hydrated === null) {
      if (useJobStore.getState().activeOrder) setActiveOrder(null);
      return;
    }
    if (hydrated === undefined) return;

    const current = useJobStore.getState().activeOrder;
    if (!current || !activeOrderFieldsEqual(current, hydrated)) {
      setActiveOrder(hydrated);
    }
  }, [hydrated, setActiveOrder]);

  const job = activeOrder ?? hydrated;
  if (!job) return null;

  if (isActiveBatchJob(job)) {
    return <BatchActiveJob batch={job} />;
  }

  return <OrderStopCard order={job} />;
}

/**
 * Trip header for a multi-stop grocery batch: the measured route totals, the
 * merged delivery window, and a numbered stop list. Every control below the
 * summary belongs to one order, so a stop can be finished without touching the
 * rest of the trip.
 */
function BatchActiveJob({ batch }: { batch: ActiveBatchJob }) {
  const mapsApiKey = useMapsKey();
  const route = batch.route;
  const stops = batch.stops ?? [];
  const pickupLabel = route?.pickup_label ?? stops[0]?.order.vendor?.business_name ?? 'Store';
  const completedStops = batch.completed_stops ?? 0;

  return (
    <Card className="ring-2 ring-brand-600/30">
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Active trip</p>
          <p className="font-bold text-neutral-900">{batch.batch_number ?? 'Batch'}</p>
          <p className="text-xs text-neutral-500">
            {completedStops} done · {batch.remaining_stops ?? batch.stop_count} of {batch.max_stops} stops left
          </p>
        </div>
        <StatusBadge status={batch.status} />
      </div>

      {batch.current_stop && (
        <div className="mb-3 flex items-center gap-2 rounded-xl bg-brand-50 px-3 py-2 text-xs text-brand-800">
          <span className="font-semibold">Next up:</span>
          <span className="font-bold">{batch.current_stop.order_number}</span>
          <StatusBadge status={batch.current_stop.status} className="ml-auto" />
        </div>
      )}

      {route && (
        <div className="mb-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-ink-50 px-2 py-1.5">
            <p className="text-[10px] font-semibold uppercase text-neutral-400">Distance</p>
            <p className="text-sm font-bold text-neutral-900">{route.total_distance_km.toFixed(1)} km</p>
          </div>
          <div className="rounded-xl bg-ink-50 px-2 py-1.5">
            <p className="text-[10px] font-semibold uppercase text-neutral-400">Drive time</p>
            <p className="text-sm font-bold text-neutral-900">{route.total_duration_min} min</p>
          </div>
          <div className="rounded-xl bg-ink-50 px-2 py-1.5">
            <p className="text-[10px] font-semibold uppercase text-neutral-400">Pickup</p>
            <p className="truncate text-sm font-bold text-neutral-900" title={pickupLabel}>
              {pickupLabel}
            </p>
          </div>
        </div>
      )}

      {batch.window_start && batch.window_end && (
        <p className="mb-3 text-xs text-neutral-500">
          Deliver between {new Date(batch.window_start).toLocaleTimeString()} and{' '}
          {new Date(batch.window_end).toLocaleTimeString()}
        </p>
      )}

      <RouteMap
        apiKey={mapsApiKey}
        stops={(route?.stops ?? []).map((stop) => ({
          point: stop.point,
          label: stop.order_number,
          legDistanceKm: stop.leg_distance_km,
          legDurationMin: stop.leg_duration_min,
        }))}
        showDriver
        className="h-56 w-full overflow-hidden rounded-xl ring-1 ring-ink-100"
      />

      <ol className="mt-4 space-y-3">
        {stops.map((stop, index) => (
          <li key={stop.order_id}>
            <div className="mb-1.5 flex items-center gap-2 px-1">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold text-white">
                {index + 1}
              </span>
              <span className="text-xs font-semibold text-neutral-700">{stop.order_number}</span>
              <StatusBadge status={stop.status} className="ml-auto" />
            </div>
            <OrderStopCard order={stop.order} embedded />
          </li>
        ))}
      </ol>
    </Card>
  );
}

function OrderStopCard({ order, embedded = false }: { order: DeliveryOrder; embedded?: boolean }) {
  const qc = useQueryClient();
  const setActiveOrder = useJobStore((s) => s.setActiveOrder);
  const [proof, setProof] = useState<File | null>(null);
  const [note, setNote] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [paymentState, setPaymentState] = useState<DeliveryPaymentState | null>(null);
  const [addMoneyOpen, setAddMoneyOpen] = useState(false);
  const otpRequested = useRef(false);
  const mapsApiKey = useMapsKey();

  // A stop's own update is folded back into the active job. On a batch this
  // touches only this stop, so completing one order never clears the trip.
  const commit = (updated: DeliveryOrder) => {
    setActiveOrder((current) => applyOrderUpdate(current, updated));
  };

  // The backend keeps OTP verification and delivery completion as two separate,
  // authorized operations. Once the OTP checks out we drive the existing
  // completion endpoint, which re-validates ownership, the state machine, cash
  // collection and the OTP itself server-side. An order that still owes cash
  // stays manual so collection is never skipped.
  const canAutoComplete = (candidate: DeliveryOrder) => {
    const cashOnDelivery = ['cash_on_delivery', 'cod'].includes((candidate.payment_method ?? '').toLowerCase());
    const paidOnline = candidate.payment_status === 'paid';
    const cashCollected = Boolean(candidate.delivery_payment_collected_at);
    const settlementPending = cashCollected && !candidate.delivery_payment_settled_at;

    return (paidOnline || (cashOnDelivery && cashCollected)) && !settlementPending;
  };


  const statusMutation = useMutation({
    mutationFn: (status: string) => partnerApi.updateOrderStatus(order!.id, status),
    onSuccess: (updated) => {
      commit(updated);
      if (updated.status === 'DELIVERED') {
        toast('Order delivered');
        void qc.invalidateQueries({ queryKey: ['partner-orders'] });
        void qc.invalidateQueries({ queryKey: ['partner-earnings'] });
      }
      // The trip itself is re-read from the server so a finished stop is
      // removed from the route and capacity.
      void qc.invalidateQueries({ queryKey: ['partner', 'active-job'] });
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Update failed', 'error'),
  });

  const proofMutation = useMutation({
    mutationFn: () => partnerApi.uploadProof(order!.id, proof!, note),
    onError: (err) => toast(err instanceof Error ? err.message : 'Proof upload failed', 'error'),
  });

  const paymentMutation = useMutation({
    mutationFn: () => partnerApi.confirmPayment(order!.id, 'cash'),
    onSuccess: ({ order: updated, payment }) => {
      commit(updated);
      setPaymentState(payment);
      toast('Cash collected — settle the amount in your wallet');
      void qc.invalidateQueries({ queryKey: ['partner-wallet'] });
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Payment collection failed', 'error'),
  });

  const settleMutation = useMutation({
    mutationFn: () => partnerApi.settleCash(order!.id),
    onSuccess: ({ order: updated, payment }) => {
      commit(updated);
      setPaymentState(payment);
      toast('Cash settlement complete');
      void qc.invalidateQueries({ queryKey: ['partner-wallet'] });
      void qc.invalidateQueries({ queryKey: ['partner', 'active-job'] });
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Cash settlement failed', 'error'),
  });

  const otpRequestMutation = useMutation({
    mutationFn: () => partnerApi.requestDeliveryOtp(order!.id),
    onSuccess: (data) => {
      setOtpSent(true);
      toast(
        data?.active
          ? 'An active OTP is already available. Ask the customer for the OTP shown on their order.'
          : 'OTP sent. Ask the customer for the latest 6-digit OTP.',
      );
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'Could not send OTP', 'error'),
  });

  const otpVerifyMutation = useMutation({
    mutationFn: () => partnerApi.verifyDeliveryOtp(order!.id, otp),
    onSuccess: async (verified) => {
      setOtp('');
      setOtpSent(true);
      commit(verified);
      toast('Delivery OTP verified');

      if (!canAutoComplete(verified)) {
        toast('Collect and settle the cash, then mark the order as delivered.', 'info');
        return;
      }

      // Completion is a separate, server-authorized step. It is idempotent, so
      // a double tap or a retried request cannot double-credit an earning or
      // disturb the rest of the trip.
      try {
        const delivered = await partnerApi.updateOrderStatus(verified.id, 'delivered');
        commit(delivered);
        toast('Order delivered');
        void qc.invalidateQueries({ queryKey: ['partner-orders'] });
        void qc.invalidateQueries({ queryKey: ['partner-earnings'] });
        void qc.invalidateQueries({ queryKey: ['partner-wallet'] });
        void qc.invalidateQueries({ queryKey: ['partner', 'active-job'] });
      } catch (err) {
        // The stop stays open and the manual button becomes available.
        toast(err instanceof Error ? err.message : 'Could not complete the delivery', 'error');
        void qc.invalidateQueries({ queryKey: ['partner', 'active-job'] });
      }
    },
    onError: (err) => toast(err instanceof Error ? err.message : 'OTP verification failed', 'error'),
  });

  // The backend auto-sends the delivery OTP when the order arrives; attempt a
  // request here too so an already-sent code is reflected. Cooldown failures
  // are silent — the customer already has the code.
  useEffect(() => {
    if (order?.status === 'ARRIVED' && !order.delivery_otp_verified_at && !otpRequested.current) {
      otpRequested.current = true;
      partnerApi
        .requestDeliveryOtp(order!.id)
        .then(() => setOtpSent(true))
        .catch(() => {});
    }
  }, [order]);

  if (!order || typeof order.status !== 'string') return null;

  const status = order.status.toUpperCase();

  const paymentDetermined = ['cash_on_delivery', 'cod'].includes((order.payment_method ?? '').toLowerCase());
  const paidOnline = order.payment_status === 'paid';
  const cashCollected = Boolean(order.delivery_payment_collected_at);
  const cashSettled = Boolean(order.delivery_payment_settled_at);
  const settlementPending = cashCollected && !cashSettled;
  const cashDue = paymentDetermined && !paidOnline && !cashCollected;
  const paymentConfirmed = paidOnline || cashCollected;
  const otpVerified = Boolean(order.delivery_otp_verified_at);
  const settlementShortfall = paymentState?.settlement === 'pending' ? Math.max(0, Math.ceil(paymentState.shortfall || 0)) : 0;

  const markDelivered = async () => {
    if (proof) {
      try {
        await proofMutation.mutateAsync();
        toast('Proof uploaded');
      } catch {
        return;
      }
    }
    statusMutation.mutate('delivered');
  };

  const nextStep =
    status === 'PARTNER_ASSIGNED'
      ? 'picked_up'
      : status === 'PICKED_UP'
        ? 'out_for_delivery'
        : status === 'OUT_FOR_DELIVERY'
          ? 'arrived'
          : null;

  // A finished stop keeps its own record but must stop offering the delivery
  // controls; the trip's next stop is the one the partner still has to do.
  if (status === 'DELIVERED' || status === 'CANCELLED') {
    return (
      <Card className={embedded ? 'bg-ink-50/40 p-3 ring-1 ring-ink-100' : 'ring-2 ring-brand-600/30'}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
              {embedded ? 'This stop' : 'Active delivery'}
            </p>
            <p className="font-bold text-neutral-900">{order.order_number}</p>
          </div>
          <StatusBadge status={status} />
        </div>
        <Stepper steps={ORDER_STEPS} current={status} />
        <div className="mt-3 rounded-xl bg-ink-50 px-3 py-2 text-sm">
          <p className="font-medium text-neutral-900">
            {status === 'DELIVERED' ? 'Delivered — nothing more to do for this order.' : 'This order was cancelled.'}
          </p>
          <p className="mt-0.5 text-xs text-neutral-500">{formatAddress(order.address)}</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className={embedded ? 'bg-ink-50/40 p-3 ring-1 ring-ink-100' : 'ring-2 ring-brand-600/30'}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
            {embedded ? 'This stop' : 'Active delivery'}
          </p>
          <p className="font-bold text-neutral-900">{order.order_number}</p>
        </div>
        <StatusBadge status={order.status} />
      </div>

      <Stepper steps={ORDER_STEPS} current={status} />

      {/* On a batch the trip map already shows every stop, so each card only
          draws its own leg. */}
      {!embedded && (
        <RouteMap
          apiKey={mapsApiKey}
          origin={pointCoords(order.vendor)}
          destination={pointCoords(order.address)}
          showDriver
          className="mt-4 h-48 w-full overflow-hidden rounded-xl ring-1 ring-ink-100"
          labels={{ origin: order.vendor?.business_name ?? 'Store', destination: 'Customer' }}
        />
      )}

      <div className="mt-4 space-y-3 text-sm">
        <div className="rounded-xl bg-ink-50 px-3 py-2">
          <p className="text-xs font-semibold uppercase text-neutral-400">Pickup</p>
          <p className="font-medium text-neutral-900">{order.vendor?.business_name ?? 'Vendor'}</p>
          {order.vendor?.address && <p className="text-xs text-neutral-500">{order.vendor.address}</p>}
        </div>
        <div className="rounded-xl bg-ink-50 px-3 py-2">
          <p className="text-xs font-semibold uppercase text-neutral-400">Drop</p>
          <p className="font-medium text-neutral-900">{formatAddress(order.address)}</p>
        </div>
        {order.user?.name && (
          <div className="rounded-xl bg-ink-50 px-3 py-2">
            <p className="text-xs font-semibold uppercase text-neutral-400">Customer</p>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium text-neutral-900">{order.user.name}</p>
                <p className={order.user.phone ? 'truncate text-xs text-neutral-500' : 'truncate text-xs text-neutral-400'}>
                  {order.user.phone ?? 'Phone number unavailable'}
                </p>
              </div>
              {order.user.phone && (
                <a
                  href={`tel:${order.user.phone.replace(/[^+\d]/g, '')}`}
                  aria-label={`Call ${order.user.name}`}
                  className="flex shrink-0 items-center gap-1.5 rounded-full bg-brand-600 px-3 py-1.5 text-xs font-bold text-white transition-opacity hover:opacity-90"
                >
                  <Phone className="h-3.5 w-3.5" />
                  Call
                </a>
              )}
            </div>
          </div>
        )}
        {(() => {
          const route = mapsRouteUrl(order.vendor, order);
          return route ? (
            <a
              href={route}
              target="_blank"
              rel="noreferrer noopener"
              className="block rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-center text-xs font-semibold text-brand-700 hover:bg-brand-100"
            >
              Open shortest route on Google Maps
            </a>
          ) : null;
        })()}
      </div>

      <div className="mt-3 space-y-1">
        {order.items?.map((i, idx) => (
          <div key={i.id ?? `${i.product_name}-${idx}`} className="flex justify-between text-sm">
            <span className="text-neutral-700">{i.product_name} ×{i.quantity}</span>
            <span className="font-medium">{formatCurrency(i.line_total ?? 0)}</span>
          </div>
        ))}
        <div className="flex justify-between border-t border-ink-100 pt-2 text-sm font-semibold text-neutral-900">
          <span>Total</span>
          <span>{formatCurrency(order.total_amount ?? 0)}</span>
        </div>
      </div>

      <div className="mt-4">
        {nextStep ? (
          <Button className="w-full" disabled={statusMutation.isPending} onClick={() => statusMutation.mutate(nextStep)}>
            {statusMutation.isPending
              ? 'Updating…'
              : status === 'PARTNER_ASSIGNED'
                ? "I've picked up"
                : status === 'PICKED_UP'
                  ? 'Out for delivery'
                  : 'Reached location'}
          </Button>
        ) : (
          <div className="space-y-3">
            {cashDue && (
              <div className="rounded-xl bg-ink-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Collect payment</p>
                <p className="mt-0.5 text-lg font-bold text-neutral-900">{formatCurrency(order.total_amount ?? 0)}</p>
                <p className="mt-0.5 text-xs text-neutral-500">Cash on delivery — collect the amount from the customer.</p>
                <div className="mt-2 flex gap-2">
                  <Button
                    className="flex-1"
                    disabled={paymentMutation.isPending || statusMutation.isPending}
                    onClick={() => paymentMutation.mutate()}
                  >
                    {paymentMutation.isPending ? 'Recording…' : 'Collect cash'}
                  </Button>
                </div>
              </div>
            )}

            {paidOnline && !cashCollected && (
              <div className="rounded-xl bg-emerald-50 p-3">
                <p className="text-sm font-semibold text-emerald-700">Payment received online</p>
                <p className="mt-0.5 text-xs text-emerald-600">No cash to collect — the customer paid on the app.</p>
              </div>
            )}

            {settlementPending && (
              <div className="rounded-xl bg-amber-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Cash collected — settlement pending</p>
                <p className="mt-1 text-sm text-neutral-700">
                  Settle {formatMoney(paymentState?.required ?? order.total_amount ?? 0)} of collected cash from your wallet balance.
                </p>
                <div className="mt-2 flex gap-2">
                  <Button
                    variant="secondary"
                    className="flex-1"
                    disabled={paymentMutation.isPending || settleMutation.isPending}
                    onClick={() => setAddMoneyOpen(true)}
                  >
                    Add {settlementShortfall > 0 ? formatMoney(settlementShortfall) : 'money'}
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    disabled={settleMutation.isPending || (paymentState?.settlement ?? 'pending') !== 'pending' || settlementShortfall > 0}
                    onClick={() => settleMutation.mutate()}
                  >
                    {settleMutation.isPending ? 'Settling…' : 'Mark settled'}
                  </Button>
                </div>
                <p className="mt-1.5 text-xs text-neutral-500">
                  Shortfall {formatMoney(settlementShortfall)} · Wallet balance {formatMoney(paymentState?.wallet_balance ?? 0)}
                </p>
                {settlementShortfall > 0 && (
                  <p className="mt-1 text-xs text-neutral-500">Add money to your wallet first, then settle.</p>
                )}
              </div>
            )}

            {!otpVerified && (
              <div className="rounded-xl bg-ink-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Delivery verification</p>
                <p className="mt-0.5 text-xs text-neutral-500">
                  Ask the customer for the 6-digit OTP sent to their phone.
                </p>
                {otpSent && <p className="mt-1 text-xs font-medium text-emerald-600">OTP sent to the customer</p>}
                <div className="mt-2 flex gap-2">
                  <Input
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="••••••"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    className="w-32 font-mono tracking-[0.3em]"
                  />
                  <Button
                    className="flex-1"
                    disabled={otp.length !== 6 || otpVerifyMutation.isPending}
                    onClick={() => otpVerifyMutation.mutate()}
                  >
                    {otpVerifyMutation.isPending ? 'Verifying…' : 'Verify OTP'}
                  </Button>
                </div>
                <button
                  type="button"
                  className="mt-2 text-xs font-semibold text-brand-700 hover:underline disabled:opacity-50"
                  disabled={otpRequestMutation.isPending || otpVerifyMutation.isPending}
                  onClick={() => otpRequestMutation.mutate()}
                >
                  {otpRequestMutation.isPending ? 'Sending…' : 'Resend OTP'}
                </button>
              </div>
            )}

            <label className="flex cursor-pointer items-center justify-between rounded-xl border border-dashed border-ink-200 px-3 py-2 text-sm text-neutral-600">
              {proof ? proof.name : 'Add delivery proof photo (optional)'}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => setProof(e.target.files?.[0] ?? null)} />
            </label>
            <Input placeholder="Delivery note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
            <Button
              className="w-full"
              disabled={statusMutation.isPending || settlementPending || !paymentConfirmed || !otpVerified}
              onClick={() => void markDelivered()}
            >
              {statusMutation.isPending ? 'Marking delivered…' : 'Mark as delivered'}
            </Button>
            {settlementPending ? (
              <p className="text-center text-xs text-amber-600">
                Settlement pending — add money to your wallet to unlock delivery.
              </p>
            ) : !paymentConfirmed ? (
              <p className="text-center text-xs text-neutral-400">Collect the payment to unlock the delivery OTP step.</p>
            ) : !otpVerified ? (
              <p className="text-center text-xs text-neutral-400">Verify the customer delivery OTP to mark this order as delivered.</p>
            ) : null}
          </div>
        )}

        <AddMoneyModal
          open={addMoneyOpen}
          onClose={() => setAddMoneyOpen(false)}
          label="Add money to settle the cash you collected."
          suggested={settlementShortfall}
          onCredited={() => {
            void paymentMutation.mutateAsync();
          }}
        />
      </div>
    </Card>
  );
}