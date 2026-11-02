import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Navigation } from 'lucide-react';
import { loadGoogleMaps } from '@/shared/services/googleMaps';
import { cn } from '@/shared/utils/utils';

export interface RideTrackingPoint {
  latitude: number;
  longitude: number;
}

interface RideTrackingMapProps {
  apiKey: string;
  pickup?: RideTrackingPoint | null;
  destination?: RideTrackingPoint | null;
  driverLocation?: RideTrackingPoint | null;
  labels?: { pickup?: string; destination?: string; driver?: string };
  className?: string;
}

const FALLBACK_CENTER = { lat: 28.6139, lng: 77.209 };
const COLORS = { driver: '#2563eb', pickup: '#16a34a', destination: '#ea580c', route: '#111827' };

function validPoint(p?: RideTrackingPoint | null): p is RideTrackingPoint {
  return !!p && Number.isFinite(p.latitude) && Number.isFinite(p.longitude) && (p.latitude !== 0 || p.longitude !== 0);
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

function navigationUrl(driver: RideTrackingPoint | null, pickup: RideTrackingPoint | null, destination: RideTrackingPoint | null): string | null {
  const target = validPoint(pickup) ? pickup : validPoint(destination) ? destination : null;
  if (!target) return null;
  const from = driver ? `${driver.latitude},${driver.longitude}` : 'my location';
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(from)}&destination=${encodeURIComponent(
    `${target.latitude},${target.longitude}`,
  )}`;
}

export function RideTrackingMap({ apiKey, pickup, destination, driverLocation, labels, className }: RideTrackingMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const routeRef = useRef<google.maps.Polyline | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);

  const pickupPoint = useMemo(() => {
    if (pickup?.latitude == null || pickup?.longitude == null) return null;
    const candidate = { latitude: pickup.latitude, longitude: pickup.longitude };
    return validPoint(candidate) ? candidate : null;
  }, [pickup?.latitude, pickup?.longitude]);
  const destinationPoint = useMemo(() => {
    if (destination?.latitude == null || destination?.longitude == null) return null;
    const candidate = { latitude: destination.latitude, longitude: destination.longitude };
    return validPoint(candidate) ? candidate : null;
  }, [destination?.latitude, destination?.longitude]);
  const driverPoint = useMemo(() => {
    if (driverLocation?.latitude == null || driverLocation?.longitude == null) return null;
    const candidate = { latitude: driverLocation.latitude, longitude: driverLocation.longitude };
    return validPoint(candidate) ? candidate : null;
  }, [driverLocation?.latitude, driverLocation?.longitude]);

  const pickupRef = useRef(pickupPoint);
  useEffect(() => {
    pickupRef.current = pickupPoint;
  }, [pickupPoint]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let cancelled = false;

    loadGoogleMaps(apiKey)
      .then(() => {
        if (cancelled) return;
        const center = pickupRef.current
          ? { lat: pickupRef.current.latitude, lng: pickupRef.current.longitude }
          : FALLBACK_CENTER;
        const map = new google.maps.Map(el, {
          zoom: 14,
          center,
          disableDefaultUI: true,
          zoomControl: true,
          clickableIcons: false,
        });
        mapRef.current = map;
        setMapReady(true);
      })
      .catch(() => {
        if (!cancelled) setMapError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [apiKey]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    routeRef.current?.setMap(null);
    routeRef.current = null;

    const bounds = new google.maps.LatLngBounds();
    const addPin = (p: RideTrackingPoint, color: string) => {
      const marker = new google.maps.Marker({
        map,
        position: { lat: p.latitude, lng: p.longitude },
        icon: pinIcon(color),
      });
      markersRef.current.push(marker);
      bounds.extend({ lat: p.latitude, lng: p.longitude });
    };
    const addDot = (p: RideTrackingPoint) => {
      const marker = new google.maps.Marker({
        map,
        position: { lat: p.latitude, lng: p.longitude },
        icon: driverDot(),
        zIndex: 5,
      });
      markersRef.current.push(marker);
      bounds.extend({ lat: p.latitude, lng: p.longitude });
    };

    if (driverPoint) addDot(driverPoint);
    if (pickupPoint) addPin(pickupPoint, COLORS.pickup);
    if (destinationPoint) addPin(destinationPoint, COLORS.destination);

    const from = driverPoint ?? pickupPoint;
    const to = pickupPoint ?? destinationPoint;
    if (from && to) {
      routeRef.current = new google.maps.Polyline({
        map,
        path: [
          { lat: from.latitude, lng: from.longitude },
          { lat: to.latitude, lng: to.longitude },
        ],
        strokeColor: driverPoint ? COLORS.driver : COLORS.route,
        strokeOpacity: driverPoint ? 0.45 : 0.55,
        strokeWeight: 3,
        zIndex: 3,
        clickable: false,
      });
    }

    if (!bounds.isEmpty()) {
      map.fitBounds(bounds);
    } else if (pickupPoint) {
      map.setCenter({ lat: pickupPoint.latitude, lng: pickupPoint.longitude });
      map.setZoom(14);
    }
  }, [mapReady, pickupPoint, destinationPoint, driverPoint]);

  const navigateUrl = navigationUrl(driverPoint, pickupPoint, destinationPoint);

  if (mapError) {
    return (
      <div className={cn('flex items-center justify-center bg-neutral-100 text-sm text-neutral-500', className)}>
        Map unavailable
      </div>
    );
  }

  return (
    <div className={cn('relative overflow-hidden bg-neutral-100', className)}>
      {!mapReady && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-neutral-100">
          <Loader2 className="h-5 w-5 animate-spin text-brand-600" />
        </div>
      )}

      <div ref={containerRef} className="absolute inset-0" />

      {mapReady && (driverPoint || pickupPoint || destinationPoint) && (
        <div className="absolute left-2 top-2 z-10 flex flex-wrap items-center gap-2.5 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-semibold text-neutral-600 shadow-card">
          {driverPoint && (
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full" style={{ background: COLORS.driver }} />
              {labels?.driver ?? 'Driver'}
            </span>
          )}
          {pickupPoint && (
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full" style={{ background: COLORS.pickup }} />
              {labels?.pickup ?? 'Pickup'}
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