import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Loader2, MapPin, Pencil, Navigation } from 'lucide-react';
import { repositories } from '@/repositories';
import { RideMap } from '@/components/rides/RideMap';
import type { MapPoint } from '@/components/rides/RideMap';
import { useRidesDraftStore } from '@/store/ridesDraftStore';
import { Button } from '@/components/ui/button';
import { Price } from '@/components/ui/price';
import { toast } from '@/components/ui/toast';

function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
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
export function RideConfirmPickupPage() {
  const navigate = useNavigate();
  const pickup = useRidesDraftStore((s) => s.pickup);
  const drop = useRidesDraftStore((s) => s.drop);
  const selectedVehicle = useRidesDraftStore((s) => s.selectedVehicle);

  const [pickupDraft, setPickupDraft] = useState<MapPoint | null>(pickup);
  const [resolving, setResolving] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const geocodeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idempotencyRef = useRef<string>(newIdempotencyKey());

  const { data: appConfig } = useQuery({
    queryKey: ['app-config'],
    queryFn: () => repositories.user.getAppConfig(),
    staleTime: 5 * 60 * 1000,
  });
  const mapsAvailable = appConfig?.maps?.enabled === true && !!appConfig?.maps?.public_key;

  // A fresh idempotency key per distinct booking intent: retrying the *same*
  // pickup/drop/vehicle reuses it (so a double-tap can't create two rides), but
  // editing any input resets it so the corrected ride is still bookable.
  useEffect(() => {
    idempotencyRef.current = newIdempotencyKey();
  }, [pickupDraft?.latitude, pickupDraft?.longitude, drop?.latitude, drop?.longitude, selectedVehicle?.id]);

  useEffect(() => {
    if (!pickup || !drop || !selectedVehicle) {
      navigate('/rides', { replace: true });
    }
  }, [pickup, drop, selectedVehicle, navigate]);

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
      // Persist the (possibly corrected) pickup so the home screen agrees.
      useRidesDraftStore.getState().setPickup(pickupDraft);
      toast('Ride requested — finding a driver');
      navigate(`/ride/${ride.id}`, { replace: true });
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
    <div className="flex min-h-dvh flex-col bg-white">
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-neutral-100 bg-white/95 px-4 py-3 backdrop-blur-sm">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-700 transition-colors hover:bg-neutral-100"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="text-lg font-extrabold tracking-tight text-neutral-900">Confirm pickup</span>
      </header>

      <div className="relative h-[48vh] min-h-[300px] w-full">
        {mapsAvailable ? (
          <RideMap
            apiKey={appConfig?.maps?.public_key ?? ''}
            pickup={pickupDraft}
            drop={drop}
            mode="pickup"
            route={route}
            hidePickOverlay
            onPendingChange={handlePendingChange}
            onPick={() => {}}
            onCancelPick={() => {}}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-neutral-100 px-8 text-center">
            <p className="text-sm font-medium text-neutral-500">
              Map preview unavailable. Drag-to-adjust is disabled, but you can still confirm your pickup below.
            </p>
          </div>
        )}

        <div className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-ink-900/90 px-3 py-1.5 text-[11px] font-bold text-white shadow-float">
            <MapPin className="h-3.5 w-3.5 text-accent-500" />
            Pickup Point
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 px-4 py-4">
        <div className="rounded-2xl border border-neutral-200 bg-white p-3.5 shadow-card">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success/10 text-success">
              <MapPin className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Pickup Point</p>
              <p className="flex items-center gap-1.5 text-sm font-semibold text-neutral-900">
                <span className="truncate">{pickupLabel}</span>
                {resolving && <Loader2 className="h-3 w-3 shrink-0 animate-spin text-neutral-400" />}
              </p>
              <p className="text-[11px] text-neutral-500">Tap the map or drag the pin to adjust your pickup.</p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/rides/destination?field=pickup')}
              className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-[11px] font-bold text-neutral-700 transition-colors hover:border-neutral-300"
            >
              <Pencil className="h-3 w-3" />
              Edit
            </button>
          </div>

          <div className="mt-3 flex items-start gap-3 border-t border-neutral-100 pt-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-500/10 text-accent-500">
              <Navigation className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Destination</p>
              <p className="truncate text-sm font-semibold text-neutral-900">{drop?.label ?? 'Destination'}</p>
              {routeQuery.data && (
                <p className="text-[11px] text-neutral-500">
                  {routeQuery.data.distance_km} km · ~{routeQuery.data.duration_min} min
                </p>
              )}
            </div>
          </div>
        </div>

        {selectedVehicle && (
          <div className="flex items-center justify-between rounded-2xl border border-neutral-200 bg-white p-3.5 shadow-card">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Your ride</p>
              <p className="truncate text-sm font-semibold text-neutral-900">{selectedVehicle.name}</p>
            </div>
            {fare ? <Price value={fare.estimated_fare} size="md" /> : <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />}
          </div>
        )}

        {confirmError && (
          <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600">{confirmError}</p>
        )}

        <div className="mt-auto">
          <Button
            size="lg"
            className="w-full rounded-2xl"
            disabled={bookMutation.isPending || !pickupDraft || !drop || !selectedVehicle}
            onClick={onConfirm}
          >
            {bookMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Confirming…
              </>
            ) : (
              <>
                <Check className="h-4 w-4" strokeWidth={3} />
                Confirm pickup
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
