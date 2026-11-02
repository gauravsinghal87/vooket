import { useEffect, useRef, useState } from 'react';
import { loadGoogleMaps } from '@/shared/services/googleMaps';
import type { OrderTracking } from '@/shared/types/models';
import { cn } from '@/shared/utils/utils';
import { Loader2 } from 'lucide-react';

interface OrderTrackingMapProps {
  tracking: OrderTracking;
  apiKey: string;
  /** Order service, so the partner marker and route paint the right theme. */
  tone?: 'brand' | 'food' | 'grocery';
  className?: string;
}

const FALLBACK_CENTER = { lat: 28.6139, lng: 77.209 };
const MARKER_COLORS = { pickup: '#16a34a', dropoff: '#ea580c' };
// Service accent used for the partner marker and the route line, chosen dark
// enough to stay legible on the map surface.
const ACCENT_COLORS: Record<'brand' | 'food' | 'grocery', string> = {
  brand: '#2563eb',
  food: '#d42021',
  grocery: '#e0a008',
};

function circleIcon(color: string): google.maps.Symbol {
  return {
    path: google.maps.SymbolPath.CIRCLE,
    scale: 9,
    fillColor: color,
    fillOpacity: 1,
    strokeColor: '#ffffff',
    strokeWeight: 2,
  };
}

export function OrderTrackingMap({ tracking, apiKey, tone = 'brand', className }: OrderTrackingMapProps) {
  const accent = ACCENT_COLORS[tone];
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const routeRef = useRef<google.maps.Polyline | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);

  // Bootstrap the map once per apiKey.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let cancelled = false;

    loadGoogleMaps(apiKey)
      .then(() => {
        if (cancelled) return;
        const pickup = tracking.order?.pickup;
        const map = new google.maps.Map(el, {
          zoom: 14,
          center: pickup ? { lat: pickup.latitude, lng: pickup.longitude } : FALLBACK_CENTER,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once per apiKey
  }, [apiKey]);

  // Google Maps measures its container only when the map is created. The same
  // surface is shown first as a small card preview and then full-bleed in the
  // expanded layout, so observe the container and ask the existing instance to
  // re-measure whenever its box changes — the supported way to resize a live
  // map. No second map instance is ever created.
  useEffect(() => {
    const el = containerRef.current;
    const map = mapRef.current;
    if (!el || !map || !mapReady) return;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        google.maps.event.trigger(map, 'resize');
      });
    });
    observer.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [mapReady]);

  // Draw markers + route whenever the snapshot changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    routeRef.current?.setMap(null);
    routeRef.current = null;

    const pickup = tracking.order?.pickup;
    const dropoff = tracking.order?.dropoff;
    const location = tracking.location;
    const route = tracking.route?.polyline ?? null;

    const pickupPoint = pickup ? { lat: pickup.latitude, lng: pickup.longitude } : null;
    const dropoffPoint = dropoff ? { lat: dropoff.latitude, lng: dropoff.longitude } : null;
    const partnerPoint =
      location && location.lat !== null && location.lng !== null
        ? { lat: location.lat, lng: location.lng }
        : null;

    const bounds = new google.maps.LatLngBounds();
    const addMarker = (lat: number, lng: number, color: string) => {
      const marker = new google.maps.Marker({
        map,
        position: { lat, lng },
        icon: circleIcon(color),
      });
      markersRef.current.push(marker);
      bounds.extend({ lat, lng });
    };

    if (pickupPoint) addMarker(pickupPoint.lat, pickupPoint.lng, MARKER_COLORS.pickup);
    if (partnerPoint) addMarker(partnerPoint.lat, partnerPoint.lng, accent);
    if (dropoffPoint) addMarker(dropoffPoint.lat, dropoffPoint.lng, MARKER_COLORS.dropoff);

    if (route) {
      const path = google.maps.geometry.encoding.decodePath(route);
      routeRef.current = new google.maps.Polyline({
        map,
        path,
        strokeColor: accent,
        strokeOpacity: 0.85,
        strokeWeight: 4,
      });
      path.forEach((p) => bounds.extend(p));
    }

    if (!bounds.isEmpty()) {
      map.fitBounds(bounds);
    } else if (pickupPoint) {
      map.setCenter(pickupPoint);
      map.setZoom(14);
    }
  }, [mapReady, tracking, accent]);

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
          <Loader2 className={cn('h-5 w-5 animate-spin', tone === 'food' ? 'text-food-600' : tone === 'grocery' ? 'text-grocery-700' : 'text-brand-600')} />
        </div>
      )}
      <div ref={containerRef} className="absolute inset-0" />
    </div>
  );
}