import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Clock3 } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useJobStore } from '@/store/jobStore';
import { useNotificationSound } from '@/hooks/useNotificationSound';
import { driverApi } from '@/repositories/driver';
import { partnerApi } from '@/repositories/partner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/state';
import { toast } from '@/components/ui/toast';
import { formatCurrency } from '@/lib/utils';
import { formatAddress } from '@/lib/job-utils';
import { pickupText, mapsRouteUrl, pointCoords, rideOrigin, rideDestination } from '@/lib/maps';
import { useMapsKey } from '@/hooks/useMapsKey';
import { RouteMap } from '@/components/jobs/RouteMap';
import type { DispatchLog } from '@/typings/models';
function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

function ExpiryLabel({ expiresAt }: { expiresAt?: string | null }) {
  const now = useNow();
  if (!expiresAt) return null;
  const remaining = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now) / 1000));
  const urgent = remaining <= 30;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${urgent ? 'text-red-600' : 'text-neutral-500'}`}>
      <Clock3 className="h-3.5 w-3.5" />
      {remaining > 0 ? `${remaining}s left` : 'Expired'}
    </span>
  );
}

/**
 * The partner's expected earning for a dispatch offer, as snapshotted by the
 * backend at offer time. This is the amount that gets credited on delivery and
 * is deliberately NOT the customer's delivery fee.
 *
 * Offers created before the backend fix carry no earning snapshot, so there is
 * nothing trustworthy to show; the caller omits the chip rather than mislabel a
 * customer charge as partner income.
 */
function partnerEarning(offer: DispatchLog): number | null {
  const n = offer?.meta?.estimated_partner_earning;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

/** The customer's delivery charge, shown as secondary context only. */
function customerDeliveryFee(offer: DispatchLog): number | null {
  const fromMeta = offer?.meta?.customer_delivery_fee;
  if (typeof fromMeta === 'number' && Number.isFinite(fromMeta)) return fromMeta;
  const fee = offer?.order?.delivery_fee;
  const n = typeof fee === 'string' ? Number(fee) : typeof fee === 'number' ? fee : NaN;
  return Number.isFinite(n) ? n : null;
}

export function RequestQueue() {
  const role = useAuthStore((s) => s.role);
  return role === 'delivery_partner' ? <OrderQueue /> : <RideQueue />;
}

function RideQueue() {
  const qc = useQueryClient();
  const [responding, setResponding] = useState<number | null>(null);
  const mapsApiKey = useMapsKey();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['driver-requests'],
    queryFn: () => driverApi.incomingRequests(),
    refetchInterval: 15000,
  });
  const requests = data ?? [];

  const respond = (id: number, accept: boolean) => {
    setResponding(id);
    const action = accept ? driverApi.acceptRequest(id) : driverApi.rejectRequest(id);
    action
      .then((res) => {
  if (accept && res) {
          useJobStore.getState().setActiveRide(res);
          toast('Ride accepted');
        } else {
          toast('Request rejected');
        }
        void qc.invalidateQueries({ queryKey: ['driver-requests'] });
      })
      .catch((err) => toast(err instanceof Error ? err.message : 'Failed', 'error'))
      .finally(() => setResponding(null));
  };

  if (isLoading) {
    return (
      <Card className="flex items-center justify-center py-10 text-neutral-400">
        <Loader2 className="h-5 w-5 animate-spin" /> Checking for ride requests…
      </Card>
    );
  }
  if (isError) return <ErrorState onRetry={() => void refetch()} />;

  if (requests.length === 0) {
    return (
      <Card className="flex flex-col items-center justify-center gap-2 py-12 text-center">
        <p className="font-medium text-neutral-700">No ride requests right now</p>
        <p className="text-sm text-neutral-400">New requests appear here in real time while you're online.</p>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {requests.map((r) => {
        const ride = r.ride;
        return (
          <Card key={r.id} className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-bold text-neutral-900">{ride.ride_number}</p>
                <p className="text-xs text-neutral-400">
                  {ride.vehicle_type?.name ?? 'Ride'} · {Number(r.distance_km ?? 0).toFixed(1)} km away
                </p>
              </div>
              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
                {formatCurrency(ride.estimated_fare ?? 0)}
              </span>
            </div>
            <div className="space-y-1.5 text-sm">
              <div className="flex items-start gap-2">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                <span className="text-neutral-700">{ride.pickup_address ?? 'Pickup point'}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-600" />
                <span className="text-neutral-700">{ride.destination_address ?? 'Destination'}</span>
              </div>
            </div>
            <RouteMap
              apiKey={mapsApiKey}
              origin={rideOrigin(ride)}
              destination={rideDestination(ride)}
              showDriver
              className="h-40 w-full overflow-hidden rounded-xl ring-1 ring-ink-100"
              labels={{ origin: 'Pickup', destination: 'Drop' }}
            />
            <div className="flex items-center justify-between text-xs text-neutral-500">
              <span>{Number(ride.distance_km ?? 0).toFixed(1)} km · ~{ride.duration_min ?? '—'} min</span>
              <span className="capitalize">{ride.payment_method ?? '—'}</span>
            </div>
            <div className="mt-auto grid grid-cols-2 gap-2">
              <Button variant="success" size="sm" disabled={responding === r.id} onClick={() => respond(r.id, true)}>
                {responding === r.id ? 'Accepting…' : 'Accept'}
              </Button>
              <Button variant="danger" size="sm" disabled={responding === r.id} onClick={() => respond(r.id, false)}>
                Decline
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function OrderQueue() {
  const qc = useQueryClient();
  const profile = useAuthStore((s) => s.profile);
  const [responding, setResponding] = useState<number | null>(null);
  const mapsApiKey = useMapsKey();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['partner-orders'],
    queryFn: () => partnerApi.incomingOrders(),
    refetchInterval: 15000,
  });
  const orders = data ?? [];

  // A genuinely new delivery request (new dispatch-log offer) that arrives
  // feeds into this same existing query stream, so the sound hooks onto the
  // point where new requests already enter the app. Dedupe is id-based: an
  // accept, reject, expiry or batch-stop update never replays. While the feed
  // is still loading there is no known set yet, so pass undefined (not the
  // empty placeholder) to keep the baseline honest.
  useNotificationSound(isLoading ? undefined : orders, 'notification', profile?.id ? `dp:${profile.id}` : '');

  const respond = (id: number, accept: boolean) => {
    setResponding(id);
    const action = accept ? partnerApi.acceptOrder(id) : partnerApi.rejectOrder(id);
    action
      .then((res) => {
        void qc.invalidateQueries({ queryKey: ['partner-orders'] });
        if (accept && res?.order) {
          useJobStore.getState().setActiveOrder(res.order);
          toast('Delivery accepted');
        } else if (accept) {
          toast('This order was just taken by another partner', 'error');
          void qc.invalidateQueries({ queryKey: ['partner-orders'] });
        } else {
          toast('Delivery declined');
        }
      })
      .catch((err) => {
        if (accept) {
          const msg = err instanceof Error ? err.message : 'Failed';
          toast(msg, 'error');
          void qc.invalidateQueries({ queryKey: ['partner-orders'] });
        } else {
          toast('Delivery declined');
        }
      })
      .finally(() => setResponding(null));
  };

  if (isLoading) {
    return (
      <Card className="flex items-center justify-center py-10 text-neutral-400">
        <Loader2 className="h-5 w-5 animate-spin" /> Checking for deliveries…
      </Card>
    );
  }
  if (isError) return <ErrorState onRetry={() => void refetch()} />;

  if (orders.length === 0) {
    return (
      <Card className="flex flex-col items-center justify-center gap-2 py-12 text-center">
        <p className="font-medium text-neutral-700">No deliveries right now</p>
        <p className="text-sm text-neutral-400">New orders appear here in real time while you're online.</p>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {orders.map((d) => {
        const o = d.order;
        const pickup = pickupText(o.vendor);
        const mapsRoute = mapsRouteUrl(o.vendor, o);
        return (
          <Card key={d.id} className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-bold text-neutral-900">{o.order_number}</p>
                <p className="text-xs text-neutral-400">
                  {o.vendor?.business_name ?? 'Vendor'} · {Number(d.distance_km ?? 0).toFixed(1)} km away
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                {partnerEarning(d) !== null && (
                  <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                    Your earning {formatCurrency(partnerEarning(d) as number)}
                  </span>
                )}
                {customerDeliveryFee(d) !== null && (
                  <span className="text-[11px] text-neutral-400">
                    Customer delivery fee: {formatCurrency(customerDeliveryFee(d) as number)}
                  </span>
                )}
                <ExpiryLabel expiresAt={d.expires_at} />
              </div>
            </div>
            <div className="space-y-1.5 text-sm">
              <div className="flex items-start gap-2">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-600" />
                <span className="text-neutral-700">{pickup}</span>
                {mapsRoute && (
                  <a
                    href={mapsRoute}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold text-brand-700 underline decoration-brand-300 underline-offset-2 hover:text-brand-800"
                  >
                    Route on Maps
                  </a>
                )}
              </div>
              <div className="flex items-start gap-2">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                <span className="text-neutral-700">{formatAddress(o.address)}</span>
              </div>
            </div>
            <RouteMap
              apiKey={mapsApiKey}
              origin={pointCoords(o.vendor)}
              destination={pointCoords(o.address)}
              showDriver
              className="h-40 w-full overflow-hidden rounded-xl ring-1 ring-ink-100"
              labels={{ origin: pickup || 'Store', destination: 'Customer' }}
            />
            <p className="border-t border-ink-100 pt-2 text-sm text-neutral-700">
              {o.items?.map((i) => `${i.product_name} ×${i.quantity}`).join(', ')}
            </p>
            {o.customer_note && <p className="text-xs text-neutral-500">Note · &quot;{o.customer_note}&quot;</p>}
            <div className="mt-auto grid grid-cols-2 gap-2">
              <Button variant="success" size="sm" disabled={responding === d.id} onClick={() => respond(d.id, true)}>
                {responding === d.id ? 'Accepting…' : 'Accept'}
              </Button>
              <Button variant="danger" size="sm" disabled={responding === d.id} onClick={() => respond(d.id, false)}>
                Decline
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}