import { useEffect, useRef, useState } from 'react';
import { Loader2, Navigation } from 'lucide-react';
import { loadGoogleMaps } from '@/lib/googleMaps';
import { getCurrentPosition } from '@/lib/geo';
import { cn } from '@/lib/utils';

export interface RouteMapPoint {
  lat: number;
  lng: number;
}

export interface RouteMapStop {
  point: RouteMapPoint;
  label?: string;
  /** Measured by the backend maps provider for the leg into this stop. */
  legDistanceKm?: number | null;
  legDurationMin?: number | null;
}

interface RouteMapProps {
  apiKey: string | null;
  origin?: RouteMapPoint | null;
  destination?: RouteMapPoint | null;
  /** Multi-stop trip. When present the map draws every stop in order. */
  stops?: RouteMapStop[] | null;
  showDriver?: boolean;
  labels?: { origin?: string; destination?: string };
  className?: string;
}

const DEFAULT_CENTER = { lat: 28.6139, lng: 77.209 };
const COLORS = { driver: '#2563eb', origin: '#16a34a', destination: '#ea580c', route: '#111827' };
const STOP_PALETTE = ['#16a34a', '#ea580c', '#7c3aed', '#0891b2', '#db2777'];

function validPoint(p?: RouteMapPoint | null): p is RouteMapPoint {
  return !!p && Number.isFinite(p.lat) && Number.isFinite(p.lng) && (p.lat !== 0 || p.lng !== 0);
}

function numberedPinIcon(index: number, color: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="44" viewBox="0 0 36 44"><path fill="${color}" stroke="#ffffff" stroke-width="1.5" d="M18 1C9.7 1 3 7.7 3 16c0 11.2 15 27 15 27s15-15.8 15-27C33 7.7 26.3 1 18 1z"/><circle cx="18" cy="16" r="7" fill="#ffffff"/><text x="18" y="20" font-family="system-ui,sans-serif" font-size="11" font-weight="700" text-anchor="middle" fill="${color}">${index}</text></svg>`,
  )}`;
}

function pinIcon(color: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="44" viewBox="0 0 36 44"><path fill="${color}" stroke="#ffffff" stroke-width="1.5" d="M18 1C9.7 1 3 7.7 3 16c0 11.2 15 27 15 27s15-15.8 15-27C33 7.7 26.3 1 18 1z"/><circle cx="18" cy="16" r="5" fill="#ffffff" opacity="0.95"/></svg>`
  )}`;
}

function driverDot(): google.maps.Symbol {
  return {
    path: google.maps.SymbolPath.CIRCLE,
    scale: 8,
    fillColor: COLORS.driver,
    fillOpacity: 1,
    strokeColor: '#ffffff',
    strokeWeight: 2.5,
  };
}

function navigationUrl(
  driver: RouteMapPoint | null,
  origin: RouteMapPoint | null,
  destination: RouteMapPoint | null,
): string | null {
  const target = validPoint(origin) ? origin : validPoint(destination) ? destination : null;
  if (!target) return null;
  const from = driver ? `${driver.lat},${driver.lng}` : 'my location';
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(from)}&destination=${encodeURIComponent(
    `${target.lat},${target.lng}`,
  )}`;
}

/** Navigation target for a multi-stop trip: the next stop in sequence. */
function tripNavigationUrl(driver: RouteMapPoint | null, stops: RouteMapPoint[]): string | null {
  const next = stops[0];
  if (!next) return null;
  const from = driver ? `${driver.lat},${driver.lng}` : 'my location';
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(from)}&destination=${encodeURIComponent(
    `${next.lat},${next.lng}`,
  )}`;
}

let cachedLocation: RouteMapPoint | null = null;
let cachedAt = 0;
let locationFetch: Promise<RouteMapPoint | null> | null = null;

function resolveDriverLocation(): Promise<RouteMapPoint | null> {
  const now = Date.now();
  if (cachedLocation && now - cachedAt < 45000) return Promise.resolve(cachedLocation);
  if (locationFetch) return locationFetch;
  locationFetch = getCurrentPosition()
    .then((c) => {
      cachedLocation = { lat: c.latitude, lng: c.longitude };
      cachedAt = Date.now();
      return cachedLocation;
    })
    .catch(() => null)
    .finally(() => {
      locationFetch = null;
    });
  return locationFetch;
}

export function RouteMap({ apiKey, origin, destination, stops, showDriver = true, labels, className }: RouteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const drawnKeyRef = useRef('');
  const [ready, setReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [driver, setDriver] = useState<RouteMapPoint | null>(null);

  const originPoint = validPoint(origin) ? origin : null;
  const destinationPoint = validPoint(destination) ? destination : null;
  // A batch trip is drawn from the backend's measured stop sequence; anything
  // without coordinates is dropped rather than pinned at (0,0).
  const tripStops = (stops ?? []).filter((s) => validPoint(s?.point));

  // Bootstrap the map once per apiKey.
  useEffect(() => {
    const el = containerRef.current;
    if (!apiKey || !el) return;
    let cancelled = false;

    loadGoogleMaps(apiKey)
      .then(() => {
        if (cancelled) return;
        const map = new google.maps.Map(el, {
          zoom: 14,
          center: DEFAULT_CENTER,
          disableDefaultUI: true,
          zoomControl: true,
          clickableIcons: false,
        });
        mapRef.current = map;
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setMapError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [apiKey]);

  // Resolve the driver's current position best-effort (shared across instances).
  useEffect(() => {
    if (!apiKey || !showDriver) return;
    let cancelled = false;
    void resolveDriverLocation().then((p) => {
      if (!cancelled) setDriver(p);
    });
    return () => {
      cancelled = true;
    };
  }, [apiKey, showDriver]);

  // Draw markers + route whenever coordinates change (skips repeats to avoid refits).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    const key = JSON.stringify([
      originPoint,
      destinationPoint,
      tripStops.map((s) => [s.point, s.label, s.legDistanceKm, s.legDurationMin]),
      showDriver && validPoint(driver) ? driver : null,
    ]);
    if (key === drawnKeyRef.current) return;
    drawnKeyRef.current = key;

    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    polylineRef.current?.setMap(null);
    polylineRef.current = null;

    const bounds = new google.maps.LatLngBounds();
    const addPin = (p: RouteMapPoint, color: string, title?: string) => {
      bounds.extend(new google.maps.LatLng(p.lat, p.lng));
      const marker = new google.maps.Marker({
        map,
        position: { lat: p.lat, lng: p.lng },
        icon: pinIcon(color),
        title,
      });
      markersRef.current.push(marker);
    };
    const addStopPin = (p: RouteMapPoint, index: number, title?: string) => {
      bounds.extend(new google.maps.LatLng(p.lat, p.lng));
      const marker = new google.maps.Marker({
        map,
        position: { lat: p.lat, lng: p.lng },
        icon: numberedPinIcon(index, STOP_PALETTE[index % STOP_PALETTE.length]),
        zIndex: 4,
        title,
      });
      markersRef.current.push(marker);
    };
    const addDot = (p: RouteMapPoint, title?: string) => {
      bounds.extend(new google.maps.LatLng(p.lat, p.lng));
      const marker = new google.maps.Marker({
        map,
        position: { lat: p.lat, lng: p.lng },
        icon: driverDot(),
        zIndex: 5,
        title,
      });
      markersRef.current.push(marker);
    };

    if (showDriver && validPoint(driver)) addDot(driver, 'Your location');

    if (tripStops.length > 0) {
      // Multi-stop trip: one numbered pin per stop, connected in sequence.
      tripStops.forEach((stop, index) => {
        addStopPin(stop.point, index + 1, stop.label ?? `Stop ${index + 1}`);
      });
      polylineRef.current = new google.maps.Polyline({
        map,
        path: tripStops.map((s) => ({ lat: s.point.lat, lng: s.point.lng })),
        strokeColor: COLORS.route,
        strokeOpacity: 0.6,
        strokeWeight: 4,
        zIndex: 3,
        clickable: false,
      });
    } else {
      if (originPoint) addPin(originPoint, COLORS.origin, labels?.origin ?? 'Pickup');
      if (destinationPoint) addPin(destinationPoint, COLORS.destination, labels?.destination ?? 'Destination');

      if (originPoint && destinationPoint) {
        polylineRef.current = new google.maps.Polyline({
          map,
          path: [
            { lat: originPoint.lat, lng: originPoint.lng },
            { lat: destinationPoint.lat, lng: destinationPoint.lng },
          ],
          strokeColor: COLORS.route,
          strokeOpacity: 0.6,
          strokeWeight: 4,
          zIndex: 3,
          clickable: false,
        });
      } else if (showDriver && validPoint(driver) && (originPoint ?? destinationPoint)) {
        const target = originPoint ?? destinationPoint;
        if (target) {
          polylineRef.current = new google.maps.Polyline({
            map,
            path: [
              { lat: driver.lat, lng: driver.lng },
              { lat: target.lat, lng: target.lng },
            ],
            strokeColor: COLORS.route,
            strokeOpacity: 0.5,
            strokeWeight: 3,
            zIndex: 3,
            clickable: false,
          });
        }
      }
    }

    if (bounds.isEmpty()) {
      map.setCenter(DEFAULT_CENTER);
      map.setZoom(14);
    } else {
      map.fitBounds(bounds);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, driver, origin, destination, stops, showDriver]);

  if (!apiKey || (!originPoint && !destinationPoint && tripStops.length === 0)) return null;

  const navigateUrl = tripStops.length
    ? tripNavigationUrl(showDriver ? driver : null, tripStops.map((s) => s.point))
    : navigationUrl(showDriver ? driver : null, originPoint, destinationPoint);

  return (
    <div className={cn('relative overflow-hidden bg-neutral-100', className)}>
      {!ready && !mapError && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-neutral-100">
          <Loader2 className="h-5 w-5 animate-spin text-brand-600" />
        </div>
      )}
      {mapError && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-neutral-100 px-4 text-center text-sm text-neutral-500">
          Map unavailable
        </div>
      )}
      <div ref={containerRef} className="absolute inset-0" />

      {ready && tripStops.length > 0 && (
        <div className="absolute left-2 top-2 z-10 flex max-w-[calc(100%-1rem)] flex-wrap items-center gap-x-2.5 gap-y-1 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-semibold text-neutral-600 shadow-card">
          {showDriver && (
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full" style={{ background: COLORS.driver }} />
              You
            </span>
          )}
          {tripStops.map((stop, index) => (
            <span key={`${stop.label ?? 'stop'}-${index}`} className="flex items-center gap-1">
              <span
                className="flex h-2.5 w-2.5 items-center justify-center rounded-full text-[8px] font-bold text-white"
                style={{ background: STOP_PALETTE[index % STOP_PALETTE.length] }}
              >
                {index + 1}
              </span>
              <span className="max-w-[9rem] truncate">{stop.label ?? `Stop ${index + 1}`}</span>
            </span>
          ))}
        </div>
      )}

      {ready && tripStops.length === 0 && (
        <div className="absolute left-2 top-2 z-10 flex items-center gap-2.5 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-semibold text-neutral-600 shadow-card">
          {showDriver && (
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full" style={{ background: COLORS.driver }} />
              You
            </span>
          )}
          {originPoint && (
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full" style={{ background: COLORS.origin }} />
              {labels?.origin ?? 'Pickup'}
            </span>
          )}
          {destinationPoint && (
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full" style={{ background: COLORS.destination }} />
              {labels?.destination ?? 'Drop'}
            </span>
          )}
        </div>
      )}

      {navigateUrl && (
        <a
          href={navigateUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="absolute bottom-2 right-2 z-10 inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-3 py-1.5 text-xs font-bold text-white shadow-card hover:bg-brand-700"
        >
          <Navigation className="h-3.5 w-3.5" />
          Navigate
        </a>
      )}
    </div>
  );
}