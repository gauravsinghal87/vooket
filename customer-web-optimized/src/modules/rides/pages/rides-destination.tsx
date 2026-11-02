import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  MapPin,
  Navigation,
  Loader2,
  X,
  Heart,
  Clock,
} from 'lucide-react';
import { repositories } from '@/shared/repositories';
import { ridesService } from '@/modules/rides/services';
import type { PlaceResult, SavedPlace } from '@/shared/types/models';
import { useRidesDraftStore } from '@/modules/rides/store/ridesDraftStore';
import { cn } from '@/shared/utils/utils';
import { toast } from '@/shared/components/ui/toast';
import { useAuthStore } from '@/features/auth/store/authStore';

type Field = 'pickup' | 'drop';

interface SearchResultPoint {
  latitude: number;
  longitude: number;
  label: string;
  place_id?: string | null;
  formatted_address?: string | null;
  secondary?: string | null;
}

function normalizeCoords(v?: string | number | null): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : null;
}

function formatCoords(lat: number, lng: number): string {
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

export function RidesDestinationPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const pickup = useRidesDraftStore((s) => s.pickup);
  const drop = useRidesDraftStore((s) => s.drop);
  const setPickup = useRidesDraftStore((s) => s.setPickup);
  const setDrop = useRidesDraftStore((s) => s.setDrop);
  const setPendingMode = useRidesDraftStore((s) => s.setPendingMode);

  const fieldParam = params.get('field') === 'pickup' ? 'pickup' : 'drop';
  const [activeField, setActiveField] = useState<Field>(fieldParam);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setActiveField(fieldParam);
  }, [fieldParam]);

  useEffect(() => {
    // Focus the active field input when screen opens
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [activeField]);

  const savedPlaces = useQuery({
    queryKey: ['saved-places'],
    queryFn: () => ridesService.getSavedPlaces().catch(() => [] as SavedPlace[]),
  });

  const rideHistory = useQuery({
    queryKey: ['ride-history'],
    queryFn: () => ridesService.getRideHistory().catch(() => []),
  });

  const recentDestinations = useMemo(() => {
    const rides = rideHistory.data ?? [];
    const seen = new Set<string>();
    const list: Array<{ id: string; label: string; address: string; latitude: number; longitude: number }> = [];
    for (const r of rides) {
      const lat = normalizeCoords(r.destination_latitude);
      const lng = normalizeCoords(r.destination_longitude);
      const addr = (r.destination_address ?? '').trim();
      const key = `${lat ?? ''},${lng ?? ''},${addr}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (lat != null && lng != null) {
        const label = addr.length > 0 ? addr : formatCoords(lat, lng);
        list.push({ id: `${r.id}-${key}`, label, address: addr || formatCoords(lat, lng), latitude: lat, longitude: lng });
      }
      if (list.length >= 5) break;
    }
    return list;
  }, [rideHistory.data]);

  const saveMutation = useMutation({
    mutationFn: (p: { label: string; address: string; latitude: number; longitude: number }) => ridesService.savePlace(p),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-places'] });
      toast('Saved to your places');
    },
    onError: () => toast('Could not save this place', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => ridesService.deleteSavedPlace(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-places'] });
      toast('Removed from saved places');
    },
    onError: () => toast('Could not remove this place', 'error'),
  });

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
  }, []);

  const runSearch = async (term: string) => {
    if (term.trim().length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    setSearching(true);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const { results: found } = await repositories.user.searchPlaces(term);
      if (!controller.signal.aborted) {
        setResults(found);
        setSearched(true);
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
  };

  const onQueryChange = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(val), 350);
  };

  const clear = () => {
    setQuery('');
    setResults([]);
    setSearched(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    inputRef.current?.focus();
  };

  const commit = (p: SearchResultPoint) => {
    if (activeField === 'pickup') {
      setPickup({ latitude: p.latitude, longitude: p.longitude, label: p.label });
    } else {
      setDrop({ latitude: p.latitude, longitude: p.longitude, label: p.label });
    }
    navigate('/rides');
  };

  const selectPlace = (p: { latitude: number; longitude: number; label: string; address?: string }) => {
    commit({ latitude: p.latitude, longitude: p.longitude, label: p.label });
  };

  const openMap = () => {
    setPendingMode(activeField);
    navigate('/rides');
  };

  const isSaved = (p: { latitude: number; longitude: number; label: string; address?: string }) => {
    const saved = savedPlaces.data ?? [];
    return saved.some((s) => {
      const slat = normalizeCoords(s.latitude);
      const slng = normalizeCoords(s.longitude);
      return Math.abs((slat ?? 0) - p.latitude) < 0.0001 && Math.abs((slng ?? 0) - p.longitude) < 0.0001;
    });
  };

  const findSavedId = (p: { latitude: number; longitude: number }) => {
    const saved = savedPlaces.data ?? [];
    return saved.find((s) => {
      const slat = normalizeCoords(s.latitude);
      const slng = normalizeCoords(s.longitude);
      return Math.abs((slat ?? 0) - p.latitude) < 0.0001 && Math.abs((slng ?? 0) - p.longitude) < 0.0001;
    })?.id;
  };

  const toggleFavorite = (p: { latitude: number; longitude: number; label: string; address?: string }) => {
    const id = findSavedId(p);
    if (id) {
      deleteMutation.mutate(id);
    } else {
      saveMutation.mutate({
        label: p.label,
        address: p.address ?? formatCoords(p.latitude, p.longitude),
        latitude: p.latitude,
        longitude: p.longitude,
      });
    }
  };

  const renderFieldRow = (field: Field) => {
    const isActive = activeField === field;
    const value = field === 'pickup' ? pickup : drop;
    const iconDotClass = field === 'pickup' ? 'bg-success' : 'bg-accent-500';
    const accentRing = isActive ? (field === 'pickup' ? 'ring-success/30' : 'ring-brand-600/30') : 'ring-transparent';
    const rowClass = cn(
      'flex w-full items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-3 py-2.5 text-left shadow-sm transition-all',
      accentRing,
      isActive && 'ring-2'
    );
    const label = (
      <span className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400">
        {field === 'pickup' ? 'Pickup' : 'Drop location'}
      </span>
    );
    if (isActive) {
      return (
        <div className={rowClass}>
          <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', iconDotClass)} />
          <div className="min-w-0 flex-1">
            {label}
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder={field === 'pickup' ? 'Enter pickup location' : 'Enter drop location'}
              className="h-7 w-full bg-transparent text-sm font-semibold text-neutral-900 outline-none placeholder:text-neutral-400"
              autoCapitalize="none"
              autoCorrect="off"
            />
          </div>
          <button type="button" onClick={clear} className="rounded-full p-1 text-neutral-400 hover:text-neutral-600" aria-label="Clear search">
            <X className="h-4 w-4" />
          </button>
        </div>
      );
    }
    return (
      <button
        type="button"
        onClick={() => {
          setActiveField(field);
          inputRef.current?.focus();
        }}
        className={rowClass}
      >
        <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', iconDotClass)} />
        <div className="min-w-0 flex-1">
          {label}
          <span className="block truncate text-sm font-semibold text-neutral-900">
            {value?.label ?? (field === 'pickup' ? 'Set your pickup' : 'Enter drop location')}
          </span>
        </div>
      </button>
    );
  };

  const hasResults = results.length > 0;
  const showingResults = searched || hasResults || searching;

  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-100 bg-white/95 px-4 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-700 transition-colors hover:bg-neutral-100"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="text-lg font-extrabold tracking-tight text-neutral-900">
            {activeField === 'pickup' ? 'Pickup' : 'Drop location'}
          </span>
        </div>
        {user && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-[11px] font-semibold text-neutral-600">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold text-white">
              {user.name?.[0]?.toUpperCase() ?? 'Y'}
            </span>
            For me
          </span>
        )}
      </header>

      <div className="space-y-3 px-4 py-3">
        {renderFieldRow('pickup')}
        {renderFieldRow('drop')}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openMap}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-bold text-neutral-700 transition-colors hover:border-neutral-300"
          >
            <MapPin className="h-3.5 w-3.5" />
            Select on map
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6">
        {searching && (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-brand-600" />
          </div>
        )}

        {showingResults && !searching && results.length > 0 && (
          <div className="space-y-1 rounded-2xl border border-neutral-100 bg-white shadow-sm">
            {results.map((r) => {
              const lat = normalizeCoords(r.latitude);
              const lng = normalizeCoords(r.longitude);
              if (lat == null || lng == null) return null;
              const label = r.main ?? r.text ?? query;
              const secondary = r.secondary ?? r.formatted_address ?? '';
              return (
                <button
                  key={r.id ?? `${lat},${lng}`}
                  type="button"
                  onClick={() => commit({ latitude: lat, longitude: lng, label, place_id: r.place_id, formatted_address: r.formatted_address ?? undefined, secondary })}
                  className="flex w-full items-start gap-3 px-3.5 py-3 text-left transition-colors hover:bg-neutral-50"
                >
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-500">
                    <Navigation className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-neutral-900">{label}</span>
                    {secondary && <span className="block truncate text-xs text-neutral-500">{secondary}</span>}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {showingResults && !searching && results.length === 0 && query.trim().length >= 2 && (
          <div className="rounded-2xl border border-neutral-100 bg-white px-3.5 py-4 text-center text-xs text-neutral-500 shadow-sm">
            No matching locations found.
          </div>
        )}

        {!showingResults && (
          <div className="space-y-6">
            {recentDestinations.length > 0 && (
              <div>
                <div className="mb-2 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-neutral-400" />
                  <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">Recent</p>
                </div>
                <div className="divide-y divide-neutral-100 overflow-hidden rounded-2xl border border-neutral-100 bg-white shadow-sm">
                  {recentDestinations.map((p) => (
                    <div key={p.id} className="flex items-center gap-3 px-3 py-3">
                      <button
                        type="button"
                        onClick={() => selectPlace(p)}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-500">
                          <Clock className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-neutral-900">{p.label}</span>
                          <span className="block truncate text-xs text-neutral-500">{p.address}</span>
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleFavorite(p)}
                        className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-400 transition-colors hover:text-rose-500"
                        aria-label="Toggle favorite"
                      >
                        <Heart className={`h-4 w-4 ${isSaved(p) ? 'fill-rose-500 text-rose-500' : ''}`} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {savedPlaces.data && savedPlaces.data.length > 0 && (
              <div>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-neutral-400">Saved places</p>
                <div className="divide-y divide-neutral-100 overflow-hidden rounded-2xl border border-neutral-100 bg-white shadow-sm">
                  {savedPlaces.data.map((p) => {
                    const plat = normalizeCoords(p.latitude);
                    const plng = normalizeCoords(p.longitude);
                    if (plat == null || plng == null) return null;
                    const pp = { latitude: plat, longitude: plng, label: p.label, address: p.address };
                    return (
                      <div key={p.id} className="flex items-center gap-3 px-3 py-3">
                        <button
                          type="button"
                          onClick={() => selectPlace(pp)}
                          className="flex min-w-0 flex-1 items-center gap-3 text-left"
                        >
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-500">
                            <MapPin className="h-4 w-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-neutral-900">{p.label}</span>
                            <span className="block truncate text-xs text-neutral-500">{p.address}</span>
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleFavorite(pp)}
                          className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-400 transition-colors hover:text-rose-500"
                          aria-label="Toggle favorite"
                        >
                          <Heart className="h-4 w-4 fill-rose-500 text-rose-500" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {recentDestinations.length === 0 && (!savedPlaces.data || savedPlaces.data.length === 0) && (
              <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-8 text-center">
                <p className="text-sm font-medium text-neutral-700">No recent or saved places yet</p>
                <p className="mt-1 text-xs text-neutral-500">Search for a location to get started.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
