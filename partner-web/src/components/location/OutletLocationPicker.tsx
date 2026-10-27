import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Info, Loader2, MapPin, Navigation, Search, X } from 'lucide-react';
import { mapApi } from '@/repositories/maps';
import { loadGoogleMaps } from '@/lib/googleMaps';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { PlaceResult, ServiceabilityResult } from '@/typings/models';

interface OutletLocationPickerProps {
  publicKey: string | null;
  vendorType: 'restaurant' | 'grocery';
  latitude: string;
  longitude: string;
  address: string;
  onChange: (key: 'latitude' | 'longitude' | 'address', value: string) => void;
}

const GEOLOCATION_ERRORS: Record<number, string> = {
  1: 'Location permission denied. Enable access or search an address.',
  2: 'Your location could not be determined.',
  3: 'Location request timed out. Please try again.',
};

const REASON_LABELS: Record<string, string> = {
  OUTSIDE_SERVICE_AREA: 'Outside service area',
  SERVICE_NOT_AVAILABLE_IN_ZONE: 'Service not available here',
  ZONE_DISABLED: 'Zone is disabled',
  NO_ZONE_DEFINED: 'Service areas are not configured yet',
  INVALID_COORDINATES: 'Invalid coordinates',
};

export function OutletLocationPicker({
  publicKey,
  vendorType,
  latitude,
  longitude,
  address,
  onChange,
}: OutletLocationPickerProps) {
  const service = vendorType === 'grocery' ? 'grocery' : 'food';
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const moveHandlerRef = useRef<((lat: number, lng: number) => void) | null>(null);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const geocodeDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [ready, setReady] = useState(false);
  const [locating, setLocating] = useState(false);
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [serviceability, setServiceability] = useState<ServiceabilityResult | null>(null);
  const [checkingZone, setCheckingZone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const latStr = typeof latitude === 'string' ? latitude : latitude == null ? '' : String(latitude);
  const lngStr = typeof longitude === 'string' ? longitude : longitude == null ? '' : String(longitude);
  const lat = Number(latStr);
  const lng = Number(lngStr);
  const hasCoords = latStr.trim() !== '' && lngStr.trim() !== '' && !Number.isNaN(lat) && !Number.isNaN(lng);

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const applyLocation = useCallback((nextLat: number, nextLng: number) => {
    onChangeRef.current('latitude', nextLat.toFixed(7));
    onChangeRef.current('longitude', nextLng.toFixed(7));
  }, []);

  const reverseAndZone = useCallback(
    (nextLat: number, nextLng: number) => {
      if (geocodeDebounce.current) clearTimeout(geocodeDebounce.current);
      geocodeDebounce.current = setTimeout(async () => {
        try {
          const resolved = await mapApi.reverseGeocode(nextLat, nextLng);
          onChangeRef.current('address', resolved.formatted_address ?? resolved.address ?? '');
        } catch {
          // Coordinates remain authoritative even if reverse geocoding fails.
        }
      }, 400);

      setCheckingZone(true);
      mapApi
        .serviceability(nextLat, nextLng, service)
        .then(setServiceability)
        .catch(() => setServiceability(null))
        .finally(() => setCheckingZone(false));
    },
    [service],
  );

  const initMap = useCallback(async () => {
    if (!publicKey || !containerRef.current) return;

    try {
      await loadGoogleMaps(publicKey);
    } catch {
      setError('Could not load Google Maps.');
      return;
    }

    if (!containerRef.current || mapRef.current) return;

    const center = hasCoords ? { lat, lng } : { lat: 20.5937, lng: 78.9629 };
    const map = new window.google.maps.Map(containerRef.current, {
      center,
      zoom: hasCoords ? 15 : 5,
      mapTypeControl: false,
      fullscreenControl: true,
      streetViewControl: false,
    });

    const marker = new window.google.maps.Marker({
      map,
      position: center,
      draggable: true,
      title: 'Outlet location',
    });

    const move = (nextLat: number, nextLng: number) => {
      marker.setPosition({ lat: nextLat, lng: nextLng });
      applyLocation(nextLat, nextLng);
      reverseAndZone(nextLat, nextLng);
    };
    moveHandlerRef.current = move;

    marker.addListener('dragend', () => {
      const pos = marker.getPosition();
      if (pos) move(pos.lat(), pos.lng());
    });

    map.addListener('click', (e: google.maps.MapMouseEvent) => {
      const clickLat = e.latLng?.lat();
      const clickLng = e.latLng?.lng();
      if (clickLat != null && clickLng != null) move(clickLat, clickLng);
    });

    mapRef.current = map;
    markerRef.current = marker;
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicKey]);

  useEffect(() => {
    void initMap();

    const container = containerRef.current;

    return () => {
      markerRef.current?.setMap(null);
      markerRef.current = null;
      mapRef.current = null;
      moveHandlerRef.current = null;
      if (container) container.innerHTML = '';
      setReady(false);
    };
  }, [initMap]);

  useEffect(() => {
    if (!ready || !mapRef.current || !markerRef.current || !hasCoords) return;
    const next = { lat, lng };
    markerRef.current.setPosition(next);
    mapRef.current.panTo(next);
  }, [ready, hasCoords, lat, lng]);

  useEffect(() => {
    if (!hasCoords) {
      setServiceability(null);
      return;
    }
    setCheckingZone(true);
    mapApi
      .serviceability(lat, lng, service)
      .then(setServiceability)
      .catch(() => setServiceability(null))
      .finally(() => setCheckingZone(false));
  }, [hasCoords, lat, lng, service]);

  useEffect(() => {
    return () => {
      if (searchDebounce.current) clearTimeout(searchDebounce.current);
      if (geocodeDebounce.current) clearTimeout(geocodeDebounce.current);
      abortRef.current?.abort();
    };
  }, []);

  const runSearch = (term: string) => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    if (term.trim().length < 2) {
      setResults([]);
      return;
    }
    searchDebounce.current = setTimeout(async () => {
      setSearching(true);
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const response = await mapApi.searchPlaces(term.trim());
        if (!controller.signal.aborted) setResults(response.results ?? []);
      } catch {
        if (!controller.signal.aborted) setResults([]);
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 350);
  };

  const choosePlace = (place: PlaceResult) => {
    setResults([]);
    if (place.formatted_address ?? place.address) {
      onChange('address', (place.formatted_address ?? place.address) as string);
    } else {
      onChange('address', place.text ?? '');
    }
    if (place.latitude != null && place.longitude != null) {
      applyLocation(place.latitude, place.longitude);
      reverseAndZone(place.latitude, place.longitude);
    }
  };

  const useMyLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError('Location services are not supported in this browser.');
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const nextLat = pos.coords.latitude;
        const nextLng = pos.coords.longitude;
        applyLocation(nextLat, nextLng);
        moveHandlerRef.current?.(nextLat, nextLng);
        reverseAndZone(nextLat, nextLng);
      },
      (err) => {
        setLocating(false);
        setError(GEOLOCATION_ERRORS[err.code] ?? 'Could not determine your location.');
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const zoneBadge = () => {
    if (!hasCoords) return null;
    if (checkingZone) {
      return (
        <Badge tone="slate">
          <Loader2 className="h-3 w-3 animate-spin" /> Resolving zone…
        </Badge>
      );
    }
    if (!serviceability) return null;
    if (serviceability.serviceable && serviceability.zone) {
      return (
        <Badge tone="success">
          <CheckCircle2 className="h-3 w-3" /> {serviceability.zone.name}
        </Badge>
      );
    }
    if (serviceability.reason === 'NO_ZONE_DEFINED') {
      return (
        <Badge tone="info">
          <Info className="h-3 w-3" /> Service areas not configured
        </Badge>
      );
    }
    return (
      <Badge tone="danger">
        <Info className="h-3 w-3" /> {REASON_LABELS[serviceability.reason ?? ''] ?? 'Outside service area'}
      </Badge>
    );
  };

  return (
    <Field label="Pickup location">
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <Input
            placeholder="Search your store address…"
            value={address}
            onChange={(e) => {
              onChange('address', e.target.value);
              runSearch(e.target.value);
            }}
            className="pl-9 pr-9"
          />
          {searching && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-neutral-400" />}
          {!searching && address && (
            <button
              type="button"
              aria-label="Clear address"
              onClick={() => {
                onChange('address', '');
                setResults([]);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400"
            >
              <X className="h-4 w-4" />
            </button>
          )}

          {results.length > 0 && (
            <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg">
              {results.map((place) => (
                <button
                  key={place.id}
                  type="button"
                  onClick={() => choosePlace(place)}
                  className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-neutral-50"
                >
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-neutral-900">{place.main || place.text}</span>
                    {place.secondary && <span className="block truncate text-xs text-neutral-500">{place.secondary}</span>}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {publicKey ? (
          <div className="relative overflow-hidden rounded-xl border border-ink-100">
            <div ref={containerRef} className="h-56 w-full bg-neutral-100" />
            {!ready && !error && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/70 text-sm text-neutral-500">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading map…
              </div>
            )}
          </div>
        ) : (
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">
            Google Maps is not configured; enter coordinates manually or contact support.
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Latitude">
            <Input
              inputMode="decimal"
              placeholder="e.g. 28.6139391"
              value={latitude}
              onChange={(e) => onChange('latitude', e.target.value)}
            />
          </Field>
          <Field label="Longitude">
            <Input
              inputMode="decimal"
              placeholder="e.g. 77.2090212"
              value={longitude}
              onChange={(e) => onChange('longitude', e.target.value)}
            />
          </Field>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="outline" disabled={locating} onClick={useMyLocation}>
            <Navigation className={cn('h-4 w-4', locating && 'animate-pulse')} />
            {locating ? 'Locating…' : 'Use my current location'}
          </Button>
          {zoneBadge()}
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}
        <p className="text-xs text-neutral-400">
          Search, click the map or drag the pin. Partners are dispatched to this point, so set it to your storefront.
        </p>
      </div>
    </Field>
  );
}
