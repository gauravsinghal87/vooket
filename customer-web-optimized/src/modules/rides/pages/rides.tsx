import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  MapPin,
  Loader2,
  Check,
  Bike,
  Car,
  CarTaxiFront,
  ArrowUpDown,
  Map,
  Search,
  LocateFixed,
  Heart,
  TicketPercent,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { repositories } from '@/shared/repositories';
import { ridesService } from '@/modules/rides/services';
import type { RideEstimate, VehicleType, NearbyDriver } from '@/shared/types/models';
import { RideMap } from '@/modules/rides/components/RideMap';
import type { MapPoint, PickMode } from '@/modules/rides/components/RideMap';
import { RidesPromoMosaic } from '@/modules/rides/components/promo-mosaic';
import { PromoRail } from '@/shared/components/home/promo-rail';
import { Price } from '@/shared/components/ui/price';
import { Button } from '@/shared/components/ui/button';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { ErrorState } from '@/shared/components/ui/state';
import { currentLocation as getCurrentLocation } from '@/shared/utils/location';
import { useRidesDraftStore } from '@/modules/rides/store/ridesDraftStore';
import { cn } from '@/shared/utils/utils';
import { toast } from '@/shared/components/ui/toast';

const VEHICLE_META: Record<string, { icon: LucideIcon; tile: string }> = {
  bike: { icon: Bike, tile: 'bg-success/10 text-success' },
  auto: { icon: CarTaxiFront, tile: 'bg-warning/10 text-warning' },
  cab: { icon: Car, tile: 'bg-brand-50 text-brand-700' },
  cab_xl: { icon: Car, tile: 'bg-brand-50 text-brand-700' },
};

const VEHICLE_CATEGORY: Record<string, string> = {
  bike: 'Bike taxi',
  auto: 'Auto ride',
  cab: 'Cab',
  cab_xl: 'Cab XL',
};

function vehicleMeta(vt: VehicleType) {
  return VEHICLE_META[vt.code] ?? VEHICLE_META.cab;
}

function vehicleCategory(vt: VehicleType): string {
  return vt.description?.trim() || VEHICLE_CATEGORY[vt.code] || 'Ride';
}

function fareFor(e: RideEstimate): number {
  return parseFloat(e.estimated_fare);
}

type MapFlowState =
  | 'boot'
  | 'disabled'
  | 'initializing'
  | 'locating'
  | 'location-error'
  | 'idle'
  | 'placing-pickup'
  | 'placing-drop'
  | 'calculating'
  | 'route-ready'
  | 'error';

const MAP_FLOW_LABEL: Record<MapFlowState, string> = {
  boot: 'Loading app…',
  disabled: 'Maps are currently unavailable',
  initializing: 'Loading map…',
  locating: 'Finding your location…',
  'location-error': 'Location unavailable',
  idle: 'Where would you like to go?',
  'placing-pickup': 'Tap the map to set pickup',
  'placing-drop': 'Tap the map to set destination',
  calculating: 'Calculating route…',
  'route-ready': 'Route ready',
  error: 'Map could not be loaded',
};

interface SavedPlace {
  id: number;
  label: string;
  address: string;
  latitude?: string;
  longitude?: string;
}

export function RidesPage() {
  const navigate = useNavigate();
  const pickup = useRidesDraftStore((s) => s.pickup);
  const drop = useRidesDraftStore((s) => s.drop);
  const setPickup = useRidesDraftStore((s) => s.setPickup);
  const setDrop = useRidesDraftStore((s) => s.setDrop);
  const pendingMode = useRidesDraftStore((s) => s.pendingMode);
  const setPendingMode = useRidesDraftStore((s) => s.setPendingMode);
  const selectedVt = useRidesDraftStore((s) => s.selectedVehicle);
  const setSelectedVt = useRidesDraftStore((s) => s.setSelectedVehicle);
  const swap = useRidesDraftStore((s) => s.swap);
  const [mode, setMode] = useState<PickMode>('none');
  const [currentLocation, setCurrentLocation] = useState<MapPoint | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [showOffers, setShowOffers] = useState(false);
  const locateOnceRef = useRef(false);

  // The selector can ask the home screen to resume map-picking for a field.
  useEffect(() => {
    if (pendingMode === 'none') return;
    setMode(pendingMode);
    setPendingMode('none');
  }, [pendingMode, setPendingMode]);

  const { data: appConfig } = useQuery({
    queryKey: ['app-config'],
    queryFn: () => repositories.user.getAppConfig(),
    staleTime: 5 * 60 * 1000,
  });
  const mapsAvailable = appConfig?.maps?.enabled === true && !!appConfig?.maps?.public_key;
  const appConfigLoading = !appConfig;

  const promos = useQuery({
    queryKey: ['ride-promos'],
    queryFn: () => ridesService.getPromos(),
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
    queryFn: () => ridesService.getSavedPlaces().catch(() => [] as SavedPlace[]),
  });

  const locate = useCallback(
    async (applyToPickup = true) => {
      setLocating(true);
      setLocationError(null);
      const res = await getCurrentLocation();
      if (res.ok && res.location) {
        const point: MapPoint = {
          latitude: res.location.latitude,
          longitude: res.location.longitude,
          label: 'Current location',
        };
        setCurrentLocation(point);
        if (applyToPickup) {
          setPickup(point);
          setMode('none');
          // Resolve a human-readable address for the pickup pill without blocking.
          repositories.user
            .reverseGeocode(point.latitude, point.longitude)
            .then((rg) => {
              if (rg?.address) {
                setPickup((prev) =>
                  prev && prev.latitude === point.latitude && prev.longitude === point.longitude
                    ? { ...prev, label: rg.address }
                    : prev
                );
              }
            })
            .catch(() => {});
        }
      } else {
        setLocationError(res.error ?? 'Could not access your location.');
        toast('Could not access your location.', 'error');
      }
      setLocating(false);
    },
    [setPickup]
  );

  useEffect(() => {
    if (locateOnceRef.current || !mapsAvailable) return;
    locateOnceRef.current = true;
    // Don't clobber a pickup the user already chose (e.g. returning from the
    // destination selector) — only seed it when it is still empty.
    locate(!useRidesDraftStore.getState().pickup);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapsAvailable]);

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
    queryFn: () => ridesService.getRoute(coordsKey!),
    enabled: !!coordsKey,
    staleTime: 60 * 1000,
  });

  const estimateQuery = useQuery({
    queryKey: ['ride-estimates', coordsKey],
    queryFn: () => ridesService.estimate(coordsKey!),
    enabled: !!coordsKey,
    staleTime: 60 * 1000,
  });

  useEffect(() => {
    const data = estimateQuery.data;
    if (!data || data.length === 0) return;
    if (!selectedVt || !data.some((e) => e.vehicle_type.id === selectedVt.id)) {
      setSelectedVt(data.reduce((a, b) => (fareFor(a) <= fareFor(b) ? a : b)).vehicle_type);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estimateQuery.data]);

  // Availability is fetched once for every vehicle type so each row can show its
  // own real nearest-driver ETA instead of only the selected category.
  const driversQuery = useQuery({
    queryKey: ['nearby-drivers', pickup?.latitude, pickup?.longitude],
    queryFn: () =>
      ridesService.getNearbyDrivers({
        latitude: pickup!.latitude,
        longitude: pickup!.longitude,
      }),
    enabled: !!pickup,
    staleTime: 15 * 1000,
    refetchInterval: 30 * 1000,
  });
  const nearbyDrivers = useMemo<NearbyDriver[]>(() => driversQuery.data ?? [], [driversQuery.data]);
  const driversResolved = driversQuery.data !== undefined;
  const driversRefreshing = driversQuery.isFetching && !driversResolved;

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
      if (kind === 'pickup') setCurrentLocation(null);
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

  const cheapestId = useMemo(() => {
    const data = estimateQuery.data;
    if (!data || data.length === 0) return null;
    return data.reduce((a, b) => (fareFor(a) <= fareFor(b) ? a : b)).vehicle_type.id;
  }, [estimateQuery.data]);

  const mapFlow: MapFlowState = useMemo(() => {
    if (appConfigLoading) return 'boot';
    if (!mapsAvailable) return 'disabled';
    if (mapError) return 'error';
    if (!mapReady) return 'initializing';
    if (locating) return 'locating';
    if (mode === 'pickup') return 'placing-pickup';
    if (mode === 'drop') return 'placing-drop';
    if (routeQuery.isFetching || estimateQuery.isFetching) return 'calculating';
    if (estimateQuery.data && estimateQuery.data.length > 0) return 'route-ready';
    if (locationError) return 'location-error';
    return 'idle';
  }, [appConfigLoading, mapsAvailable, mapError, mapReady, locating, mode, routeQuery.isFetching, estimateQuery.isFetching, estimateQuery.data, locationError]);

  const estimates = estimateQuery.data ?? [];
  const saved: SavedPlace[] = savedPlaces.data ?? [];
  const promoList = promos.data ?? [];
  const routeSubtitle = routeQuery.data ? `${routeQuery.data.distance_km} km · ~${routeQuery.data.duration_min} min` : null;

  const pickSaved = useCallback((p: SavedPlace) => {
    setDrop({
      latitude: parseFloat(p.latitude ?? '0') || 0,
      longitude: parseFloat(p.longitude ?? '0') || 0,
      label: p.label,
    });
    setMode('none');
  }, [setDrop]);

  const renderMapArea = () => {
    if (appConfigLoading) {
      return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-neutral-100">
          <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
          <p className="text-xs font-medium text-neutral-500">Loading app…</p>
        </div>
      );
    }
    if (!mapsAvailable) {
      return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-neutral-100 px-6 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-neutral-400 shadow-sm">
            <Map className="h-6 w-6" />
          </span>
          <div>
            <p className="text-sm font-bold text-neutral-800">Maps are currently unavailable</p>
            <p className="mx-auto mt-1 max-w-xs text-xs text-neutral-500">
              You can still book a ride — search for your destination below.
            </p>
          </div>
        </div>
      );
    }
    return (
      <RideMap
        apiKey={appConfig!.maps.public_key!}
        currentLocation={currentLocation}
        pickup={pickup}
        drop={drop}
        mode={mode}
        route={routeQuery.data?.polyline ?? null}
        drivers={nearbyDrivers}
        driversLoading={driversRefreshing}
        onPick={confirmMapPick}
        onCancelPick={() => setMode('none')}
        onReady={() => setMapReady(true)}
        onError={(msg) => setMapError(msg)}
      />
    );
  };

  const showMapChrome = mapFlow !== 'boot' && mapFlow !== 'initializing' && mapFlow !== 'error' && mapFlow !== 'disabled';

  return (
    <div className="mx-auto w-full max-w-6xl px-[var(--page-gutter)] pt-4">
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,25rem)]">
        {/* Map */}
        <div className="relative h-[44dvh] min-h-[300px] overflow-hidden rounded-3xl border border-neutral-200/70 shadow-float lg:sticky lg:top-4 lg:h-[calc(100dvh-9rem)] lg:min-h-[560px]">
          {renderMapArea()}

          {showMapChrome && (
            <div className="pointer-events-none absolute left-3 top-3 z-20">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-bold text-neutral-700 shadow-card backdrop-blur-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-600" />
                {MAP_FLOW_LABEL[mapFlow]}
              </span>
            </div>
          )}

          {mode === 'none' && mapsAvailable && mapReady && (
            <button
              type="button"
              onClick={() => locate()}
              disabled={locating}
              className="absolute right-3 top-3 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-neutral-700 shadow-card transition-colors hover:bg-white disabled:opacity-60"
              aria-label="Use my location"
              title="Use my location"
            >
              {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
            </button>
          )}

          {mapsAvailable && mapReady && mode === 'none' && (
            <button
              type="button"
              onClick={() => setMode('pickup')}
              className="absolute inset-x-3 bottom-8 z-20 flex items-center gap-2.5 rounded-2xl bg-white/95 px-3 py-2.5 text-left text-neutral-900 shadow-float backdrop-blur-sm transition-colors hover:bg-white"
              aria-label="Set pickup location on map"
              title="Set pickup on map"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success/10 text-success">
                <MapPin className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400">Pickup</span>
                <span className="block truncate text-sm font-semibold">{pickup?.label ?? 'Set your pickup'}</span>
              </span>
              <span className="shrink-0 text-[11px] font-bold text-brand-600">Change</span>
            </button>
          )}
        </div>

        {/* Booking sheet */}
        <section className="relative z-10 -mt-6 flex max-h-[58dvh] flex-col overflow-hidden rounded-t-3xl bg-white shadow-[0_-10px_40px_rgb(0_0_0/0.10)] lg:mt-0 lg:max-h-[calc(100dvh-9rem)] lg:rounded-3xl lg:border lg:border-neutral-200/70">
          <div className="flex shrink-0 justify-center pb-1 pt-2.5">
            <span className="h-1.5 w-14 rounded-full bg-neutral-200" />
          </div>

          {/* Fixed header: destination prompt or route summary */}
          <div className="shrink-0 px-5 pb-3">
            {!drop ? (
              <div>
                <h2 className="text-[22px] font-extrabold tracking-tight text-neutral-900 sm:text-2xl">
                  Where do you want to go?
                </h2>
                <p className="mt-1 text-sm text-neutral-500">Search a destination or pick one of your saved places.</p>
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-2xl border border-neutral-200/70 p-2.5">
                <div className="flex flex-col items-center self-stretch py-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-success" />
                  <span className="my-1 w-px flex-1 bg-neutral-200" />
                  <span className="h-2.5 w-2.5 rounded-full bg-accent-500" />
                </div>
                <div className="min-w-0 flex-1 space-y-2.5">
                  <button type="button" onClick={() => setMode('pickup')} className="block w-full text-left">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400">Pickup</span>
                    <span className="block truncate text-sm font-semibold text-neutral-900">
                      {pickup?.label ?? 'Set your pickup'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/rides/destination?field=drop')}
                    className="block w-full text-left"
                  >
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400">Destination · change</span>
                    <span className="block truncate text-sm font-semibold text-neutral-900">{drop.label ?? 'Destination'}</span>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={swap}
                  disabled={!pickup}
                  className="tap flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink-900 text-white shadow-pill transition-colors disabled:opacity-40"
                  aria-label="Swap pickup and destination"
                  title="Swap"
                >
                  <ArrowUpDown className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Scrollable body */}
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pb-6">
            {!drop ? (
              <>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => navigate('/rides/destination?field=drop')}
                    className="tap flex h-14 min-w-0 flex-1 items-center gap-2.5 rounded-2xl border border-neutral-200 bg-white px-4 text-left transition-colors hover:border-neutral-300"
                    aria-label="Choose a destination"
                  >
                    <Search className="h-4 w-4 shrink-0 text-neutral-400" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-neutral-500">
                      Where do you want to go?
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode(mode === 'drop' ? 'none' : 'drop')}
                    className={cn(
                      'tap flex h-14 shrink-0 items-center gap-1 rounded-xl border px-3 text-[11px] font-bold transition-colors',
                      mode === 'drop'
                        ? 'border-brand-600 bg-brand-600 text-white'
                        : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300'
                    )}
                    aria-label="Set destination on map"
                  >
                    <Map className="h-3.5 w-3.5" />
                    {mode === 'drop' ? 'On map' : 'Map'}
                  </button>
                </div>

                {saved.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-neutral-400">Saved places</p>
                    <div className="divide-y divide-neutral-100 overflow-hidden rounded-2xl border border-neutral-200/70">
                      {saved.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => pickSaved(p)}
                          className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-neutral-50"
                        >
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-500">
                            <MapPin className="h-4 w-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-neutral-900">{p.label}</span>
                            {p.address && <span className="block truncate text-xs text-neutral-500">{p.address}</span>}
                          </span>
                          <Heart className="h-4 w-4 shrink-0 text-rose-400" fill="currentColor" aria-label="Saved" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <RidesPromoMosaic banners={ridePromoCards} onCardPress={() => navigate('/rides/destination?field=drop')} />

                {promoList.length > 0 && (
                  <div className="rounded-2xl bg-neutral-50 p-3">
                    <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                      <TicketPercent className="h-3.5 w-3.5" /> Offers for you
                    </p>
                    <PromoRail promos={promoList} className="-mx-1" />
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="flex items-end justify-between">
                  <h2 className="text-base font-extrabold tracking-tight text-neutral-900">Choose a ride</h2>
                  {routeSubtitle && <span className="text-[11px] font-medium text-neutral-400">{routeSubtitle}</span>}
                </div>

                {estimateQuery.isError && !estimateQuery.isFetching && (
                  <ErrorState
                    title="Couldn't estimate fares"
                    description="Check your pickup and destination and try again."
                    action={{ label: 'Retry', onClick: () => estimateQuery.refetch() }}
                  />
                )}

                {estimateQuery.isFetching && !estimateQuery.data && (
                  <div className="space-y-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="h-[68px] w-full rounded-2xl" />
                    ))}
                  </div>
                )}

                {estimates.length > 0 && (
                  <div className="space-y-2">
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
                  </div>
                )}

                {showOffers && promoList.length > 0 && (
                  <div className="rounded-2xl bg-neutral-50 p-3">
                    <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                      <TicketPercent className="h-3.5 w-3.5" /> Offers
                    </p>
                    <PromoRail promos={promoList} className="-mx-1" />
                  </div>
                )}
              </>
            )}
          </div>

          {/* Fixed footer: payment/offers row + booking button */}
          {drop && (
            <div className="shrink-0 border-t border-neutral-100 bg-white">
              <div className="flex items-center justify-between gap-2 px-4 py-2.5">
                <span className="inline-flex items-center gap-2 text-xs font-semibold text-neutral-600">
                  <Wallet className="h-4 w-4 text-neutral-400" />
                  Pay online
                </span>
                {promoList.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowOffers((v) => !v)}
                    className="inline-flex items-center gap-1 text-xs font-bold text-brand-600"
                  >
                    <TicketPercent className="h-3.5 w-3.5" />
                    {showOffers ? 'Hide offers' : `${promoList.length} offer${promoList.length > 1 ? 's' : ''}`}
                  </button>
                )}
              </div>

              <div className="px-3 pb-3">
                <Button
                  size="lg"
                  className="w-full justify-between rounded-2xl px-4"
                  disabled={!selectedVt}
                  onClick={() => navigate('/rides/confirm-pickup')}
                >
                  <span className="inline-flex items-center gap-2">
                    <Check className="h-4 w-4" strokeWidth={3} />
                    {selectedVt ? `Book ${selectedVt.name}` : 'Choose a ride'}
                  </span>
                  {selectedVt && (
                    <span className="text-sm font-bold">
                      {(() => {
                        const e = estimates.find((x) => x.vehicle_type.id === selectedVt.id);
                        return e ? `₹${Math.round(parseFloat(e.estimated_fare))}` : '';
                      })()}
                    </span>
                  )}
                </Button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
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
  const meta = vehicleMeta(vt);
  const available = availability.loading || availability.eta != null;
  const capacity = vt.capacity > 1 ? `${vt.capacity} seats` : '1 seat';

  const availabilityText = availability.loading
    ? 'Checking availability…'
    : availability.eta != null
      ? `${availability.eta} min away${availability.count > 1 ? ` · ${availability.count} nearby` : ''}`
      : 'Currently unavailable';

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={cn(
        'flex w-full items-center gap-3 rounded-2xl border bg-white px-3 py-3 text-left transition-all duration-150 active:scale-[0.99]',
        active
          ? 'border-brand-600 bg-brand-50/50 shadow-card'
          : 'border-neutral-200/80 hover:border-neutral-300 hover:bg-neutral-50'
      )}
    >
      <span className={cn('relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', meta.tile, !available && 'opacity-50')}>
        <meta.icon className="h-5 w-5" strokeWidth={1.9} />
        {active && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-brand-600 text-white ring-2 ring-white">
            <Check className="h-2.5 w-2.5" strokeWidth={4} />
          </span>
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-bold text-neutral-900">{vt.name}</span>
          {cheapest && (
            <span className="shrink-0 rounded-full bg-success/10 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-success">
              Cheapest
            </span>
          )}
        </span>
        <span
          className={cn(
            'mt-0.5 block truncate text-[11px]',
            availability.loading
              ? 'text-neutral-400'
              : availability.eta != null
                ? 'text-success'
                : 'text-amber-600'
          )}
        >
          {vehicleCategory(vt)} · {availabilityText}
        </span>
        <span className="mt-0.5 block truncate text-[11px] text-neutral-400">
          {estimate.distance_km} km · ~{estimate.duration_min} min · {capacity}
        </span>
      </span>

      <span className="shrink-0 text-right">
        <Price value={estimate.estimated_fare} size="md" />
      </span>
    </button>
  );
}
