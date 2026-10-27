import { useCallback, useEffect, useRef, useState } from 'react';
import { Search, LocateFixed, Loader2, MapPin, X, Info } from 'lucide-react';
import { repositories } from '@/repositories';
import { toast } from '@/components/ui/toast';
import { loadGoogleMaps } from '@/lib/googleMaps';
import type { ReverseGeocode } from '@/types/models';

export interface SelectedPlace {
  label: string;
  address_line_1: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  latitude: number;
  longitude: number;
  place_id?: string | null;
  formatted_address?: string | null;
  locality?: string | null;
  area?: string | null;
  provider?: string | null;
}

interface MapPickerProps {
  publicKey: string;
  initialLatitude: number | null;
  initialLongitude: number | null;
  initialAddressLine1?: string;
  initialCity?: string;
  countryCode?: string;
  onSelected: (place: SelectedPlace) => void;
  onCancel: () => void;
}

const GEOLOCATION_ERRORS: Record<number, string> = {
  1: 'Location permission denied. Please enable location access in your browser settings.',
  2: 'Your location could not be determined. Please try again or pick a point on the map.',
  3: 'Location request timed out. Please try again or pick a point on the map.',
};

export function MapPicker({
  publicKey,
  initialLatitude,
  initialLongitude,
  initialAddressLine1,
  initialCity,
  countryCode,
  onSelected,
  onCancel,
}: MapPickerProps) {
  const [query, setQuery] = useState(initialAddressLine1 ?? '');
  const [results, setResults] = useState<{
    id: string;
    place_id?: string | null;
    main: string;
    text: string;
    secondary: string | null;
    latitude: number | null;
    longitude: number | null;
    city?: string | null;
    state?: string | null;
    postal_code?: string | null;
    country?: string | null;
    formatted_address?: string | null;
    provider?: string | null;
  }[]>([]);
  const [fallbackNotice, setFallbackNotice] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const [locating, setLocating] = useState(false);
  const [searching, setSearching] = useState(false);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(
    initialLatitude != null && initialLongitude != null ? { latitude: initialLatitude, longitude: initialLongitude } : null,
  );
  const [resolved, setResolved] = useState<ReverseGeocode | null>(null);
  const [placeInfo, setPlaceInfo] = useState<{ place_id?: string | null; formatted_address?: string | null } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reverseDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);

  const defaultCenter = useRef(
    coords ?? { latitude: 28.6139, longitude: 77.209 },
  );

  const initGoogle = useCallback(async () => {
    try {
      await loadGoogleMaps(publicKey);
    } catch {
      toast('Could not load Google Maps', 'error');
      return;
    }

    const { Map, Marker } = window.google.maps;
    if (!mapRef.current) return;

    const center = coords
      ? { lat: coords.latitude, lng: coords.longitude }
      : { lat: defaultCenter.current.latitude, lng: defaultCenter.current.longitude };

    const newMap = new Map(mapRef.current, {
      center,
      zoom: 15,
      mapTypeControl: false,
      fullscreenControl: false,
      streetViewControl: false,
    });

    const newMarker = new Marker({
      map: newMap,
      position: center,
      draggable: true,
      title: coords ? 'Selected location' : 'Your location',
    });

    newMarker.addListener('dragend', () => {
      const pos = newMarker.getPosition();
      if (pos) scheduleReverse(pos.lat(), pos.lng());
    });

    newMap.addListener('click', (e: google.maps.MapMouseEvent) => {
      const lat = e.latLng?.lat();
      const lng = e.latLng?.lng();
      if (lat != null && lng != null) pinAt(lat, lng);
    });

    setMap(newMap);
    markerRef.current = newMarker;

    if (!coords && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          markerRef.current?.setPosition({ lat, lng });
          newMap.panTo({ lat, lng });
          newMap.setZoom(16);
          setCoords({ latitude: lat, longitude: lng });
        },
        () => {},
        { timeout: 8000 },
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicKey, coords]);

  useEffect(() => {
    initGoogle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicKey]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (reverseDebounceRef.current) clearTimeout(reverseDebounceRef.current);
      abortRef.current?.abort();
    };
  }, []);

  const pinAt = useCallback(
    (lat: number, lng: number) => {
      const pos = { lat, lng };
      setCoords({ latitude: lat, longitude: lng });
      setPlaceInfo(null);
      markerRef.current?.setPosition(pos);
      if (map) map.panTo(pos);
      scheduleReverse(lat, lng);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [map],
  );

  const reverseAt = useCallback(
    async (lat: number, lng: number) => {
      try {
        const address = await repositories.user.reverseGeocode(lat, lng);
        setResolved(address);
      } catch {
        setResolved(null);
      }
    },
    [],
  );

  const scheduleReverse = useCallback(
    (lat: number, lng: number) => {
      if (reverseDebounceRef.current) clearTimeout(reverseDebounceRef.current);
      reverseDebounceRef.current = setTimeout(() => reverseAt(lat, lng), 450);
    },
    [reverseAt],
  );

  const useMyLocation = useCallback(() => {
    if (!navigator.geolocation) {
      toast('Location services are not supported on this device.', 'error');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setLocating(false);
        pinAt(lat, lng);
      },
      (err) => {
        setLocating(false);
        toast(GEOLOCATION_ERRORS[err.code] ?? 'Could not get your location.', 'error');
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
    );
  }, [pinAt]);

  const runSearch = useCallback(
    async (term: string) => {
      if (term.trim().length < 2) {
        setResults([]);
        setFallbackNotice(null);
        setSearched(false);
        return;
      }
      setSearching(true);
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const { results: found, fallback } = await repositories.user.searchPlaces(term, countryCode);
        if (!controller.signal.aborted) {
          setResults(
            found.map((r) => ({
              id: r.id,
              place_id: r.place_id,
              main: r.main,
              text: r.text,
              secondary: r.secondary,
              latitude: r.latitude,
              longitude: r.longitude,
              city: r.city,
              state: r.state,
              postal_code: r.postal_code,
              country: r.country,
              formatted_address: r.formatted_address,
              provider: r.provider,
            })),
          );
          setSearched(true);
          setFallbackNotice(
            fallback
              ? 'Address search is temporarily using a fallback service. Results may be less accurate.'
              : null,
          );
        }
      } catch {
        if (!controller.signal.aborted) {
          setResults([]);
          setSearched(false);
          toast('Address search is unavailable. Please try again.', 'error');
        }
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    },
    [countryCode],
  );

  const onQueryChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(value), 350);
  };

  const chooseResult = async (result: {
    id: string;
    place_id?: string | null;
    main: string;
    text: string;
    secondary: string | null;
    latitude: number | null;
    longitude: number | null;
    city?: string | null;
    state?: string | null;
    postal_code?: string | null;
    country?: string | null;
    formatted_address?: string | null;
    provider?: string | null;
  }) => {
    setResults([]);
    setQuery(result.main);

    const resultDetails: ReverseGeocode = {
      provider: result.provider ?? null,
      street: result.main,
      address: result.main,
      formatted_address: result.formatted_address ?? result.text,
      city: result.city ?? null,
      state: result.state ?? null,
      postal_code: result.postal_code ?? null,
      country: result.country ?? null,
      latitude: result.latitude ?? 0,
      longitude: result.longitude ?? 0,
    };
    setResolved(resultDetails);

    if (result.latitude != null && result.longitude != null) {
      const newCoords = { latitude: result.latitude, longitude: result.longitude };
      setCoords(newCoords);
      setPlaceInfo({
        place_id: result.place_id ?? result.id,
        formatted_address: result.formatted_address ?? result.text,
      });
      markerRef.current?.setPosition({ lat: result.latitude, lng: result.longitude });
      if (map) {
        map.panTo({ lat: result.latitude, lng: result.longitude });
        map.setZoom(16);
      }
    }

    try {
      const details = await repositories.user.placeDetails(result.id);
      if (details && details.latitude != null && details.longitude != null) {
        setResolved({
          provider: details.provider ?? result.provider ?? null,
          street: null,
          address: details.address || details.formatted_address || result.text,
          formatted_address: details.formatted_address ?? details.address ?? result.text,
          city: details.city ?? result.city ?? null,
          state: details.state ?? result.state ?? null,
          postal_code: details.postal_code ?? result.postal_code ?? null,
          country: details.country ?? result.country ?? null,
          latitude: details.latitude,
          longitude: details.longitude,
        });
        setCoords({ latitude: details.latitude, longitude: details.longitude });
        setPlaceInfo({
          place_id: details.place_id ?? result.place_id ?? result.id,
          formatted_address: details.formatted_address ?? details.address ?? result.text,
        });
        markerRef.current?.setPosition({ lat: details.latitude, lng: details.longitude });
        if (map) {
          map.panTo({ lat: details.latitude, lng: details.longitude });
          map.setZoom(16);
        }
      }
    } catch {
      // Search result already carries authoritative coordinates/components.
    }
  };

  const confirm = () => {
    if (!coords) {
      toast('Pick a location on the map or use your current location', 'error');
      return;
    }
    onSelected({
      label: resolved?.street || resolved?.address || initialAddressLine1 || 'Delivered here',
      address_line_1: resolved?.street || resolved?.address || initialAddressLine1 || 'Selected location',
      city: resolved?.city ?? initialCity ?? '',
      state: resolved?.state ?? '',
      postal_code: resolved?.postal_code ?? '',
      country: resolved?.country ?? '',
      latitude: coords.latitude,
      longitude: coords.longitude,
      place_id: placeInfo?.place_id ?? null,
      formatted_address: placeInfo?.formatted_address ?? resolved?.address ?? null,
      locality: resolved?.locality ?? null,
      area: resolved?.area ?? null,
      provider: resolved?.provider ?? null,
    });
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setFallbackNotice(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search for an address…"
          className="w-full rounded-xl border border-neutral-200 bg-white py-2 pl-9 pr-9 text-sm outline-none focus:border-brand-500"
        />
        {searching ? (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-neutral-400" />
        ) : (
          query && (
            <button type="button" onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400" aria-label="Clear">
              <X className="h-4 w-4" />
            </button>
          )
        )}
        {results.length > 0 && (
          <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg">
            {results.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => chooseResult(r)}
                className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-neutral-50"
              >
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-neutral-900">{r.main}</span>
                  {r.secondary && <span className="block truncate text-xs text-neutral-500">{r.secondary}</span>}
                </span>
              </button>
            ))}
          </div>
        )}

        {searched && !searching && results.length === 0 && (
          <div className="mt-1 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-500">
            No matching locations found.
          </div>
        )}
      </div>

      {fallbackNotice && (
        <div className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{fallbackNotice}</span>
        </div>
      )}

      <div ref={mapRef} className="h-64 w-full rounded-xl border border-neutral-200" />

      <p className="text-xs text-neutral-500">
        Drag the pin or click anywhere on the map to set the exact location.
      </p>

      {resolved && (
        <div className="rounded-xl bg-neutral-50 p-3 text-sm text-neutral-700">
          <p className="font-medium text-neutral-900">{resolved.address}</p>
          <p className="mt-0.5 text-xs text-neutral-500">
            {[resolved.city, resolved.state, resolved.postal_code, resolved.country].filter(Boolean).join(', ')}
          </p>
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={useMyLocation}
          disabled={locating}
          className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 px-3 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
        >
          {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
          My location
        </button>
        <button
          type="button"
          onClick={confirm}
          className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          <MapPin className="h-4 w-4" />
          Use this address
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 px-3 py-2 text-sm font-semibold text-neutral-600 hover:bg-neutral-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}