import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Loader2, X } from 'lucide-react';
import { loadGoogleMaps } from '@/lib/googleMaps';
import type { NearbyDriver } from '@/types/models';

export interface MapPoint {
  latitude: number;
  longitude: number;
  label?: string;
}

export type PickMode = 'none' | 'pickup' | 'drop';

const COLORS = {
  current: '#3b82f6',
  pickup: '#16a34a',
  drop: '#ea580c',
  driver: '#1f2937',
  polyline: '#111827',
};

export interface RideMapProps {
  apiKey: string;
  currentLocation?: MapPoint | null;
  pickup?: MapPoint | null;
  drop?: MapPoint | null;
  mode: PickMode;
  route: string | null;
  drivers?: NearbyDriver[];
  driversLoading?: boolean;
  /**
   * Hide the built-in "Cancel / Confirm" pick bar while still allowing the map
   * to be tapped and the pending pin dragged. The pickup-confirmation screen
   * renders its own confirm action instead.
   */
  hidePickOverlay?: boolean;
  /**
   * Fires whenever the pending pin moves (map tap or marker drag) with the new
   * coordinate, so a host screen can mirror it (e.g. reverse-geocode the
   * address) without waiting for the built-in Confirm.
   */
  onPendingChange?: (point: MapPoint) => void;
  onPick: (kind: 'pickup' | 'drop', point: MapPoint) => void;
  onCancelPick: () => void;
  onReady?: () => void;
  onError?: (message: string) => void;
}

/** Stable identity so `drivers` defaulting never restarts the marker effect. */
const EMPTY_DRIVERS: NearbyDriver[] = [];

interface LatLngish {
  latitude: number;
  longitude: number;
}

const DEFAULT_CENTER = { latitude: 28.6139, longitude: 77.209 };

function validPoint(p?: LatLngish | null): p is LatLngish {
  return !!p && Number.isFinite(p.latitude) && Number.isFinite(p.longitude) && (p.latitude !== 0 || p.longitude !== 0);
}

function decodePolyline(encoded: string): google.maps.LatLng[] {
  return google.maps.geometry.encoding.decodePath(encoded);
}

function pinIcon(color: string, letter?: string) {
  const inner = letter
    ? `<circle cx="18" cy="16" r="8" fill="#ffffff" opacity="0.95"/><text x="18" y="20.5" text-anchor="middle" font-size="11" font-weight="700" fill="${color}" font-family="Arial, sans-serif">${letter}</text>`
    : `<circle cx="18" cy="16" r="5" fill="#ffffff" opacity="0.95"/>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="44" viewBox="0 0 36 44"><path fill="${color}" stroke="#ffffff" stroke-width="1.5" d="M18 1C9.7 1 3 7.7 3 16c0 11.2 15 27 15 27s15-15.8 15-27C33 7.7 26.3 1 18 1z"/>${inner}</svg>`
  )}`;
}

type VehicleKind = 'bike' | 'auto' | 'car';

interface VehicleGlyph {
  body: string;
  /** Ink bounding box in the glyph's own 24x24 grid, used to fit it into the pin head. */
  box: readonly [number, number, number, number];
}

/**
 * Vehicle silhouettes stroked into the white head of the driver pin. Vehicle
 * type is the only attribute the privacy-safe payload exposes, so the icon is
 * the entire label. Cab Mini / Cab Sedan / Cab SUV all read as "car" — the
 * previous design collapsed them into one letter "C", so the icon is
 * intentionally category-level rather than per-model.
 */
const VEHICLE_GLYPHS: Record<VehicleKind, VehicleGlyph> = {
  bike: {
    body: '<circle cx="5.5" cy="17.5" r="3.6"/><circle cx="18.5" cy="17.5" r="3.6"/><path d="M12 17.5V13l-3.2-2.8L13 7l2.6 3.4H19"/><path d="M15.5 4.6h2.2"/>',
    box: [1.9, 4.6, 22.1, 21.1],
  },
  auto: {
    body: '<circle cx="7.4" cy="17.4" r="2.7"/><circle cx="16.6" cy="17.4" r="2.7"/><path d="M3.4 15.6v-2.2l1.9-4.2h11.4l2 4.2v2.2"/><path d="M3.4 15.6h17.3"/><path d="M5.6 9.2 6.9 5.4h8.9l1.7 3.8"/>',
    box: [3.4, 5.4, 20.7, 20.1],
  },
  car: {
    body: '<circle cx="7.6" cy="16.4" r="2.4"/><circle cx="16.4" cy="16.4" r="2.4"/><path d="M4.2 16.2v-3.1l1.6-4.1h12.4l1.6 4.1v3.1"/><path d="M4.2 16.2h15.6"/><path d="M6 9 7.3 5.6h9.4L17.7 9"/><path d="M9.2 9.4h5.6"/>',
    box: [4.2, 5.6, 19.8, 18.8],
  },
};

function vehicleKind(name: string | null | undefined): VehicleKind {
  const label = (name ?? '').trim().toLowerCase();
  if (/bike|motor|scooter|cycle|bicy/.test(label)) return 'bike';
  if (/auto|rick|tempo|three|tuck/.test(label)) return 'auto';
  return 'car';
}

const DRIVER_HEAD_RADIUS = 9;
const DRIVER_HEAD_INSET = 0.6;
const DRIVER_STROKE = 2.6;

/** Uniform scale that fits the glyph's stroke-inclusive corner inside the white head. */
function glyphTransform(kind: VehicleKind) {
  const [minX, minY, maxX, maxY] = VEHICLE_GLYPHS[kind].box;
  const half = DRIVER_STROKE / 2;
  const diag = Math.hypot(maxX - minX + half * 2, maxY - minY + half * 2);
  const scale = (2 * (DRIVER_HEAD_RADIUS - DRIVER_HEAD_INSET)) / diag;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return `translate(${18 - cx * scale} ${16 - cy * scale}) scale(${scale})`;
}

function vehiclePinIcon(color: string, kind: VehicleKind) {
  const glyph = `<circle cx="18" cy="16" r="${DRIVER_HEAD_RADIUS}" fill="#ffffff" opacity="0.97"/><g transform="${glyphTransform(kind)}" fill="none" stroke="${color}" stroke-width="${DRIVER_STROKE}" stroke-linecap="round" stroke-linejoin="round">${VEHICLE_GLYPHS[kind].body}</g>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="44" viewBox="0 0 36 44"><path fill="${color}" stroke="#ffffff" stroke-width="1.5" d="M18 1C9.7 1 3 7.7 3 16c0 11.2 15 27 15 27s15-15.8 15-27C33 7.7 26.3 1 18 1z"/>${glyph}</svg>`
  )}`;
}

/** Marker footprint in CSS pixels — drives how far stacked drivers are fanned out. */
const DRIVER_PIN_FOOTPRINT_PX = 34;
const DRIVER_MIN_FAN_PX = 18;

interface DriverMarkerEntry {
  marker: google.maps.Marker;
  anchorLat: number;
  anchorLng: number;
  index: number;
  count: number;
}

const distanceMeters = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const R = 6371000;
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLng = (lng2 - lng1) * toRad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/** Drivers closer together than this share one anchor and get fanned around it. */
const DRIVER_STACK_METERS = 30;

/**
 * Single-pass grouping of drivers into anchor clusters. Coordinates come
 * straight from the API and are never rewritten — clustering only decides which
 * markers share a visual anchor.
 */
function clusterDrivers(drivers: NearbyDriver[]) {
  const clusters: { anchorLat: number; anchorLng: number; members: NearbyDriver[] }[] = [];
  for (const d of drivers) {
    const near = clusters.find(
      (c) => distanceMeters(c.anchorLat, c.anchorLng, d.latitude, d.longitude) <= DRIVER_STACK_METERS
    );
    if (near) near.members.push(d);
    else clusters.push({ anchorLat: d.latitude, anchorLng: d.longitude, members: [d] });
  }
  return clusters;
}

/**
 * Display-only fan for markers that would sit on top of each other. The radius
 * is derived from the pin footprint in screen pixels, converted to metres at the
 * current zoom, so the spread stays legible while zooming. Latitude/longitude
 * of the marker is nudged for display; the true coordinate remains the cluster
 * anchor and the connector line points back at it.
 */
function fanOffset(index: number, count: number, lat: number, zoom: number) {
  if (count <= 1) return { dLat: 0, dLng: 0 };
  const radiusPx = Math.max(DRIVER_MIN_FAN_PX, (count * DRIVER_PIN_FOOTPRINT_PX) / (2 * Math.PI) + 8);
  const cosLat = Math.max(0.01, Math.cos((lat * Math.PI) / 180));
  const radiusM = radiusPx * ((156543.03392 * cosLat) / 2 ** zoom);
  const angle = (2 * Math.PI * index) / count - Math.PI / 2;
  return {
    dLat: (radiusM * Math.cos(angle)) / 111320,
    dLng: (radiusM * Math.sin(angle)) / (111320 * cosLat),
  };
}

const makeCurrentDot = (): google.maps.Symbol => ({
  path: google.maps.SymbolPath.CIRCLE,
  scale: 8,
  fillColor: COLORS.current,
  fillOpacity: 1,
  strokeColor: '#ffffff',
  strokeWeight: 2.5,
});

export function RideMap({
  apiKey,
  currentLocation,
  pickup,
  drop,
  mode,
  route,
  drivers = EMPTY_DRIVERS,
  driversLoading = false,
  hidePickOverlay = false,
  onPendingChange,
  onPick,
  onCancelPick,
  onReady,
  onError,
}: RideMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  const pickupRef = useRef(pickup);
  const dropRef = useRef(drop);
  const currentRef = useRef(currentLocation);
  const routeRef = useRef(route);
  const driversRef = useRef(drivers);
  const modeRef = useRef(mode);
  const onPickRef = useRef(onPick);
  const onErrorRef = useRef(onError);
  const onReadyRef = useRef(onReady);
  const onPendingChangeRef = useRef(onPendingChange);

  const pickupMarkerRef = useRef<google.maps.Marker | null>(null);
  const dropMarkerRef = useRef<google.maps.Marker | null>(null);
  const currentMarkerRef = useRef<google.maps.Marker | null>(null);
  const pendingMarkerRef = useRef<google.maps.Marker | null>(null);
  const pendingRef = useRef<MapPoint | null>(null);
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const driverMarkersRef = useRef<DriverMarkerEntry[]>([]);
  const driverSpokeRef = useRef<google.maps.Polyline | null>(null);
  const fanDriverMarkers = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const zoom = map.getZoom() ?? 14;
    const spokes: google.maps.LatLngLiteral[] = [];
    for (const entry of driverMarkersRef.current) {
      const { dLat, dLng } = fanOffset(entry.index, entry.count, entry.anchorLat, zoom);
      entry.marker.setPosition({ lat: entry.anchorLat + dLat, lng: entry.anchorLng + dLng });
      if (entry.count > 1) {
        spokes.push({ lat: entry.anchorLat, lng: entry.anchorLng }, { lat: entry.anchorLat + dLat, lng: entry.anchorLng + dLng });
      }
    }
    driverSpokeRef.current?.setMap(null);
    driverSpokeRef.current = null;
    if (spokes.length) {
      driverSpokeRef.current = new google.maps.Polyline({
        map,
        path: spokes,
        strokeColor: COLORS.driver,
        strokeOpacity: 0.45,
        strokeWeight: 1,
        zIndex: 3,
        clickable: false,
      });
    }
  }, []);

  const mapZoomListenerRef = useRef<google.maps.MapsEventListener | null>(null);

  useEffect(() => {
    pickupRef.current = pickup;
    dropRef.current = drop;
    currentRef.current = currentLocation;
    routeRef.current = route;
    driversRef.current = drivers;
    modeRef.current = mode;
    onPickRef.current = onPick;
    onErrorRef.current = onError;
    onReadyRef.current = onReady;
    onPendingChangeRef.current = onPendingChange;
  }, [pickup, drop, currentLocation, route, drivers, mode, onPick, onError, onReady, onPendingChange]);

  useEffect(() => {
    if (mode === 'none') {
      pendingRef.current = null;
      return;
    }
    const base =
      mode === 'pickup'
        ? pickupRef.current ?? currentRef.current
        : dropRef.current ?? pickupRef.current ?? currentRef.current;
    pendingRef.current = base ?? null;
  }, [mode]);

  const movePending = useCallback((lat: number, lng: number) => {
    pendingRef.current = { latitude: lat, longitude: lng };
    pendingMarkerRef.current?.setPosition({ lat, lng });
    onPendingChangeRef.current?.({ latitude: lat, longitude: lng });
  }, []);

  const centerForFit = useCallback((): LatLngish => {
    return currentRef.current ?? pickupRef.current ?? dropRef.current ?? DEFAULT_CENTER;
  }, []);

  const handleMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    if (modeRef.current === 'none') return;
    const lat = e.latLng?.lat();
    const lng = e.latLng?.lng();
    if (lat != null && lng != null) movePending(lat, lng);
  }, [movePending]);

  useEffect(() => {
    let disposed = false;
    setStatus('loading');
    loadGoogleMaps(apiKey)
      .then(() => {
        if (disposed || !containerRef.current) return;
        const center = currentRef.current ?? pickupRef.current ?? DEFAULT_CENTER;
        const { Map } = window.google.maps;
        const map = new Map(containerRef.current, {
          center: { lat: center.latitude, lng: center.longitude },
          zoom: 14,
          mapTypeControl: false,
          fullscreenControl: false,
          streetViewControl: false,
          clickableIcons: false,
        });
        mapRef.current = map;
        map.addListener('click', handleMapClick);
        mapZoomListenerRef.current?.remove();
        mapZoomListenerRef.current = map.addListener('zoom_changed', () => fanDriverMarkers());
        setStatus('ready');
        onReadyRef.current?.();
      })
      .catch(() => {
        if (!disposed) {
          setStatus('error');
          onErrorRef.current?.('Could not load Google Maps. Please try again.');
        }
      });
    return () => {
      disposed = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  useEffect(() => {
    if (status !== 'ready' || !mapRef.current) return;
    const map = mapRef.current;

    const clearMarkers = () => {
      [pickupMarkerRef, dropMarkerRef, currentMarkerRef, pendingMarkerRef].forEach((ref) => {
        ref.current?.setMap(null);
        ref.current = null;
      });
      driverMarkersRef.current.forEach((e) => e.marker.setMap(null));
      driverMarkersRef.current = [];
      driverSpokeRef.current?.setMap(null);
      driverSpokeRef.current = null;
      polylineRef.current?.setMap(null);
      polylineRef.current = null;
    };
    clearMarkers();

    const bounds = new google.maps.LatLngBounds();
    const seenAnchors = new Set<string>();
    let anchors = 0;
    const noteAnchor = (lat: number, lng: number) => {
      const key = `${Math.round(lat * 1000)}:${Math.round(lng * 1000)}`;
      if (!seenAnchors.has(key)) {
        seenAnchors.add(key);
        anchors += 1;
      }
    };
    const pointCount = () => {
      let n = 0;
      if (validPoint(currentRef.current)) n += 1;
      if (validPoint(pickupRef.current)) n += 1;
      if (validPoint(dropRef.current)) n += 1;
      return n;
    };

    if (validPoint(currentRef.current)) {
      const p = currentRef.current;
      bounds.extend(new google.maps.LatLng(p.latitude, p.longitude));
      noteAnchor(p.latitude, p.longitude);
      const m = new google.maps.Marker({
        map,
        position: { lat: p.latitude, lng: p.longitude },
        icon: makeCurrentDot(),
        zIndex: 1,
        title: 'You are here',
      });
      currentMarkerRef.current = m;
    }

    if (validPoint(pickupRef.current)) {
      const p = pickupRef.current;
      bounds.extend(new google.maps.LatLng(p.latitude, p.longitude));
      noteAnchor(p.latitude, p.longitude);
      const m = new google.maps.Marker({
        map,
        position: { lat: p.latitude, lng: p.longitude },
        icon: pinIcon(COLORS.pickup),
        zIndex: 2,
        title: `Pickup${p.label ? `: ${p.label}` : ''}`,
      });
      pickupMarkerRef.current = m;
    }

    if (validPoint(dropRef.current)) {
      const p = dropRef.current;
      bounds.extend(new google.maps.LatLng(p.latitude, p.longitude));
      noteAnchor(p.latitude, p.longitude);
      const m = new google.maps.Marker({
        map,
        position: { lat: p.latitude, lng: p.longitude },
        icon: pinIcon(COLORS.drop),
        zIndex: 2,
        title: `Destination${p.label ? `: ${p.label}` : ''}`,
      });
      dropMarkerRef.current = m;
    }

    if (modeRef.current !== 'none') {
      const base = pendingRef.current;
      if (validPoint(base)) {
        noteAnchor(base.latitude, base.longitude);
        const m = new google.maps.Marker({
          map,
          position: { lat: base.latitude, lng: base.longitude },
          icon: pinIcon(modeRef.current === 'pickup' ? COLORS.pickup : COLORS.drop, 'P'),
          draggable: true,
          zIndex: 10,
          title: modeRef.current === 'pickup' ? 'Pickup – tap map or drag to adjust' : 'Destination – tap map or drag to adjust',
        });
        m.addListener('dragend', () => {
          const pos = m.getPosition();
          if (pos) movePending(pos.lat(), pos.lng());
        });
        pendingMarkerRef.current = m;
        bounds.extend(new google.maps.LatLng(base.latitude, base.longitude));
      }
    }

    const encodedRoute = routeRef.current;
    if (encodedRoute) {
      try {
        const path = decodePolyline(encodedRoute);
        if (path.length > 1) {
          anchors += 1;
          path.forEach((ll) => bounds.extend(ll));
          polylineRef.current = new google.maps.Polyline({
            map,
            path,
            strokeColor: COLORS.polyline,
            strokeOpacity: 0.9,
            strokeWeight: 5,
            zIndex: 3,
          });
        }
      } catch {
        polylineRef.current = null;
      }
    } else if (validPoint(pickupRef.current) && validPoint(dropRef.current) && pointCount() >= 2) {
      const p = pickupRef.current;
      const d = dropRef.current;
      anchors += 1;
      bounds.extend(new google.maps.LatLng(p.latitude, p.longitude));
      bounds.extend(new google.maps.LatLng(d.latitude, d.longitude));
      polylineRef.current = new google.maps.Polyline({
        map,
        path: [
          { lat: p.latitude, lng: p.longitude },
          { lat: d.latitude, lng: d.longitude },
        ],
        strokeColor: COLORS.polyline,
        strokeOpacity: 0.5,
        strokeWeight: 3,
        zIndex: 3,
        clickable: false,
      });
    }

    const visibleDrivers = driversRef.current.filter((d) => validPoint(d));
    const clusters = clusterDrivers(visibleDrivers);
    clusters.forEach((cluster) => {
      bounds.extend(new google.maps.LatLng(cluster.anchorLat, cluster.anchorLng));
      cluster.members.forEach((d, index) => {
        noteAnchor(d.latitude, d.longitude);
        const m = new google.maps.Marker({
          map,
          position: { lat: cluster.anchorLat, lng: cluster.anchorLng },
          icon: vehiclePinIcon(COLORS.driver, vehicleKind(d.vehicle_type_name)),
          zIndex: 4 + index,
          title: `${d.vehicle_type_name ?? 'Driver'} · ${d.distance_km.toFixed(1)} km · ETA ${d.eta_min} min`,
        });
        driverMarkersRef.current.push({
          marker: m,
          anchorLat: cluster.anchorLat,
          anchorLng: cluster.anchorLng,
          index,
          count: cluster.members.length,
        });
      });
    });
    fanDriverMarkers();

    if (!bounds.isEmpty()) {
      if (anchors > 1) {
        map.fitBounds(bounds, { top: 90, right: 90, bottom: 70, left: 90 });
      } else {
        const center = centerForFit();
        map.setCenter({ lat: center.latitude, lng: center.longitude });
        map.setZoom(15);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, currentLocation, pickup, drop, route, drivers, mode, fanDriverMarkers]);

  const confirmPick = useCallback(() => {
    if (modeRef.current === 'none' || !pendingRef.current) return;
    onPickRef.current(modeRef.current, { ...pendingRef.current });
  }, []);

  const cancelPick = useCallback(() => {
    pendingRef.current = null;
    pendingMarkerRef.current?.setMap(null);
    pendingMarkerRef.current = null;
    onCancelPick();
  }, [onCancelPick]);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div ref={containerRef} className="absolute inset-0 h-full w-full" />

      {status === 'loading' && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-neutral-100/80 backdrop-blur-sm">
          <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
          <p className="text-xs font-medium text-neutral-500">Loading map…</p>
        </div>
      )}

      {status === 'error' && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-white/90 px-6 text-center backdrop-blur-sm">
          <p className="text-sm font-semibold text-neutral-800">Map could not be loaded</p>
          <p className="text-xs text-neutral-500">Please check the Google Maps integration in admin and try again.</p>
        </div>
      )}

      {driversLoading && (
        <div className="pointer-events-none absolute bottom-24 left-1/2 z-20 -translate-x-1/2">
          <span className="flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-semibold text-neutral-600 shadow-card">
            <Loader2 className="h-3 w-3 animate-spin" />
            Finding nearby drivers…
          </span>
        </div>
      )}

      {status === 'ready' && modeRef.current === 'none' && (
        <div className="absolute bottom-3 left-3 z-20 hidden items-center gap-3 rounded-full bg-white/95 px-3 py-1.5 text-[10px] font-semibold text-neutral-600 shadow-card sm:flex">
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS.pickup }} />
            Pickup
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS.drop }} />
            Drop
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS.driver }} />
            Driver
          </span>
        </div>
      )}

      {modeRef.current !== 'none' && !hidePickOverlay && (
        <div className="absolute inset-x-3 bottom-3 z-20 sm:inset-x-auto sm:left-1/2 sm:w-[26rem] sm:-translate-x-1/2">
          <div className="flex items-center gap-2 rounded-2xl bg-white/95 p-2 shadow-float backdrop-blur-sm">
            <div className="min-w-0 flex-1 px-2">
              <p className="truncate text-sm font-bold text-neutral-900">
                {modeRef.current === 'pickup' ? 'Set pickup point' : 'Set destination'}
              </p>
              <p className="truncate text-[11px] text-neutral-500">Tap the map or drag the {modeRef.current === 'pickup' ? 'green' : 'orange'} pin</p>
            </div>
            <button
              type="button"
              onClick={cancelPick}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-neutral-200 text-neutral-600 hover:bg-neutral-50"
              aria-label="Cancel"
            >
              <X className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={confirmPick}
              disabled={!pendingRef.current}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-brand-600 px-4 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-50"
            >
              <Check className="h-4 w-4" strokeWidth={3} />
              Confirm
            </button>
          </div>
        </div>
      )}
    </div>
  );
}