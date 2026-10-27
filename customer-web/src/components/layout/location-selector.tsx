import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import * as Dialog from '@radix-ui/react-dialog';
import {
  Briefcase,
  ChevronDown,
  ChevronRight,
  Home,
  Info,
  LocateFixed,
  Loader2,
  MapPin,
  MoreHorizontal,
  Plus,
  Search,
  Share2,
} from 'lucide-react';
import { repositories } from '@/repositories';
import { useAppStore } from '@/store/appStore';
import { useAuthStore } from '@/store/authStore';
import { DEFAULT_LOCATION, POPULAR_AREAS, currentLocation } from '@/lib/location';
import { formatDistanceKm, haversineKm } from '@/lib/geo';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import type { Location } from '@/types/catalog';

interface LocationSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Zomato's "Select a location" screen, presented as a full-screen panel rather
 * than a small sheet: a chevron-down header, the area search, the red
 * current-location / add-address actions, and the saved-address cards with
 * distance, phone and row actions. All picking, GPS, search and saved-address
 * behaviour is unchanged from the previous sheet — only the presentation moved.
 */
export function LocationSelector({ open, onOpenChange }: LocationSelectorProps) {
  const navigate = useNavigate();
  const setLocation = useAppStore((s) => s.setLocation);
  const activeLocation = useAppStore((s) => s.location) ?? DEFAULT_LOCATION;
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [locating, setLocating] = useState(false);
  const [query, setQuery] = useState('');

  const addresses = useQuery({
    queryKey: ['location-addresses'],
    queryFn: () => repositories.user.getAddresses(),
    enabled: open && isAuthenticated,
  });

  const savedPlaces = useQuery({
    queryKey: ['location-places'],
    queryFn: () => repositories.rides.getSavedPlaces(),
    enabled: open,
  });

  const searchResults = useQuery({
    queryKey: ['location-search', query],
    queryFn: () => repositories.user.searchPlaces(query),
    enabled: open && query.trim().length >= 2,
    staleTime: 30_000,
  });

  const pick = (loc: Location) => {
    setLocation(loc);
    onOpenChange(false);
  };

  const useGPS = async () => {
    setLocating(true);
    const res = await currentLocation();
    if (!res.ok || !res.location) {
      setLocating(false);
      toast(res.error ?? 'Could not fetch your location', 'error');
      return;
    }
    try {
      const reverse = await repositories.user.reverseGeocode(res.location.latitude, res.location.longitude);
      setLocating(false);
      pick({
        label: 'Current location',
        address: reverse.city ? `${reverse.street ?? reverse.address}, ${reverse.city}` : reverse.address,
        latitude: res.location.latitude,
        longitude: res.location.longitude,
        formatted_address: reverse.formatted_address ?? reverse.address,
        locality: reverse.locality ?? null,
        area: reverse.area ?? null,
      });
      toast('Location updated');
    } catch {
      setLocating(false);
      pick({
        label: 'Current location',
        address: res.location.address,
        latitude: res.location.latitude,
        longitude: res.location.longitude,
      });
      toast('Location updated (no address details)');
    }
  };

  /**
   * Saved addresses come from two independent sources (the user's addresses and
   * the saved ride places) and each can legitimately contain several entries
   * labelled "Home", so the list key is built from the source plus the backend
   * row id. Nothing is deduplicated or dropped.
   */
  const places: {
    key: string;
    icon: typeof Home;
    label: string;
    address: string;
    phone?: string | null;
    latitude: number;
    longitude: number;
    location: Location;
  }[] = [];
  if (isAuthenticated) {
    for (const a of addresses.data ?? []) {
      places.push({
        key: `address-${a.id}`,
        icon: a.label === 'Work' ? Briefcase : Home,
        label: a.label,
        address: `${a.address_line_1}${a.address_line_2 ? `, ${a.address_line_2}` : ''}, ${a.city}`,
        phone: a.contact_phone,
        latitude: parseFloat(a.latitude ?? '0') || 0,
        longitude: parseFloat(a.longitude ?? '0') || 0,
        location: {
          label: a.label,
          address: `${a.address_line_1}, ${a.city}`,
          latitude: parseFloat(a.latitude ?? '0') || 0,
          longitude: parseFloat(a.longitude ?? '0') || 0,
          place_id: a.place_id ?? null,
          formatted_address: a.formatted_address ?? null,
        },
      });
    }
  }
  for (const p of savedPlaces.data ?? []) {
    const lat = parseFloat(p.latitude ?? '0') || 0;
    const lng = parseFloat(p.longitude ?? '0') || 0;
    places.push({
      key: `saved-place-${p.id}`,
      icon: Home,
      label: p.label,
      address: p.address,
      latitude: lat,
      longitude: lng,
      location: { label: p.label, address: p.address, latitude: lat, longitude: lng },
    });
  }

  const filteredPlaces = places.filter((p) =>
    query ? `${p.label} ${p.address}`.toLowerCase().includes(query.toLowerCase()) : true,
  );
  const filteredAreas = POPULAR_AREAS.filter((a) =>
    query ? `${a.label} ${a.address}`.toLowerCase().includes(query.toLowerCase()) : true,
  );

  const serverResults = searchResults.data?.results ?? [];
  const isFallback = searchResults.data?.fallback === true;

  const sharePlace = async (p: (typeof places)[number]) => {
    const text = `${p.label}: ${p.address}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: p.label, text });
        return;
      }
      await navigator.clipboard.writeText(text);
      toast('Address copied to clipboard');
    } catch {
      toast('Could not share this address', 'error');
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-fade-in" />
        <Dialog.Content
          className={cn(
            'fixed inset-x-0 bottom-0 top-0 z-50 flex w-full flex-col bg-ink-50 shadow-2xl focus:outline-none',
            'data-[state=open]:animate-slide-down mx-auto max-w-lg sm:rounded-none sm:border-x sm:border-neutral-200'
          )}
        >
          {/* Header: chevron-down dismisses, the title leads. */}
          <div className="flex shrink-0 items-center gap-3 bg-ink-50 px-4 pb-3 pt-5">
            <Dialog.Close
              aria-label="Close location picker"
              className="tap -ml-1 flex h-9 w-9 items-center justify-center rounded-full text-neutral-700 transition-colors hover:bg-neutral-200/70 focus:outline-2 focus:outline-brand-600"
            >
              <ChevronDown className="h-6 w-6" />
            </Dialog.Close>
            <Dialog.Title className="text-[20px] font-extrabold tracking-tight text-neutral-900">
              Select a location
            </Dialog.Title>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8">
            {/* Area search. */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-food-600" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search for area, street name..."
                aria-label="Search location"
                className="h-12 w-full rounded-2xl border border-neutral-200 bg-white pl-11 pr-4 text-sm text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 focus:border-food-400"
              />
            </div>

            {isFallback && (
              <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                <span>Address search is temporarily using a fallback service. Results may be less accurate.</span>
              </div>
            )}

            {/* Search results (server-backed) sit right under the field. */}
            {serverResults.length > 0 && (
              <section className="mt-3 overflow-hidden rounded-2xl bg-white">
                <h3 className="px-4 pb-1 pt-3 text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-400">
                  Search results
                </h3>
                {serverResults.map((r) => (
                  <button
                    key={r.id}
                    onClick={() =>
                      pick({
                        label: r.main,
                        address: r.text,
                        latitude: r.latitude ?? 0,
                        longitude: r.longitude ?? 0,
                        place_id: r.place_id ?? null,
                        formatted_address: r.formatted_address ?? r.text,
                        locality: r.city ?? null,
                        area: r.state ?? null,
                      })
                    }
                    className="tap flex w-full items-center gap-3 border-t border-neutral-100 px-4 py-3 text-left transition-colors hover:bg-neutral-50"
                  >
                    <MapPin className="h-4.5 w-4.5 shrink-0 text-neutral-400" />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-neutral-900">{r.main}</span>
                      <span className="block truncate text-xs text-neutral-500">{r.secondary ?? r.text}</span>
                    </span>
                  </button>
                ))}
              </section>
            )}

            {serverResults.length === 0 &&
              !searchResults.isFetching &&
              searchResults.isSuccess &&
              query.trim().length >= 2 && (
                <p className="px-3 py-3 text-sm text-neutral-500">No matching locations found.</p>
              )}

            {/* Current location + add address, one white card with red actions. */}
            <div className="mt-3 overflow-hidden rounded-2xl bg-white">
              <button
                onClick={useGPS}
                className="tap flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-neutral-50"
              >
                <LocateFixed className="h-5 w-5 shrink-0 text-food-600" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-bold text-food-600">Use current location</span>
                  <span className="mt-0.5 block truncate text-[13px] text-neutral-500">
                    {locating ? 'Fetching your location…' : activeLocation.address}
                  </span>
                </span>
                <ChevronRight className="h-4.5 w-4.5 shrink-0 text-neutral-300" />
              </button>

              <button
                onClick={() => {
                  onOpenChange(false);
                  navigate('/profile/addresses');
                }}
                className="tap flex w-full items-center gap-3 border-t border-neutral-100 px-4 py-3.5 text-left transition-colors hover:bg-neutral-50"
              >
                <Plus className="h-5 w-5 shrink-0 text-food-600" />
                <span className="min-w-0 flex-1 text-[15px] font-bold text-food-600">Add Address</span>
                <ChevronRight className="h-4.5 w-4.5 shrink-0 text-neutral-300" />
              </button>
            </div>

            {/* Saved addresses: divider label, then one card each with the
                distance, phone and row actions, as in the reference. */}
            {filteredPlaces.length > 0 && (
              <section className="mt-6">
                <div className="mb-3 flex items-center gap-3">
                  <span aria-hidden className="h-px flex-1 bg-neutral-300" />
                  <h3 className="text-[11px] font-bold uppercase tracking-[0.22em] text-neutral-500">
                    Saved Addresses
                  </h3>
                  <span aria-hidden className="h-px flex-1 bg-neutral-300" />
                </div>

                <div className="space-y-3">
                  {filteredPlaces.map((p) => {
                    const km = haversineKm(activeLocation, { latitude: p.latitude, longitude: p.longitude });
                    const distance = p.latitude || p.longitude ? formatDistanceKm(km) : '';
                    return (
                      <div key={p.key} className="rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgb(16_14_10/0.04)]">
                        <button
                          onClick={() => pick(p.location)}
                          className="tap flex w-full items-start gap-3.5 text-left"
                        >
                          <span className="flex w-12 shrink-0 flex-col items-center gap-1 text-neutral-600">
                            <p.icon className="h-6 w-6" strokeWidth={1.6} />
                            {distance && <span className="text-[11px] font-medium text-neutral-400">{distance}</span>}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[15px] font-bold text-neutral-900">{p.label}</span>
                            <span className="mt-1 block text-[13px] leading-snug text-neutral-600">{p.address}</span>
                            {p.phone && (
                              <span className="mt-1.5 block text-[13px] text-neutral-500">
                                Phone number: {p.phone}
                              </span>
                            )}
                          </span>
                        </button>

                        <div className="mt-3 flex items-center gap-2.5 pl-14">
                          <button
                            onClick={() => {
                              onOpenChange(false);
                              navigate('/profile/addresses');
                            }}
                            aria-label={`Manage ${p.label}`}
                            className="tap flex h-8 w-8 items-center justify-center rounded-full border border-neutral-200 text-food-600 transition-colors hover:border-food-300 hover:bg-food-50"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => sharePlace(p)}
                            aria-label={`Share ${p.label}`}
                            className="tap flex h-8 w-8 items-center justify-center rounded-full border border-neutral-200 text-food-600 transition-colors hover:border-food-300 hover:bg-food-50"
                          >
                            <Share2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Popular areas remain as the no-account fallback. */}
            <section className="mt-6">
              <h3 className="mb-2 flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.22em] text-neutral-500">
                <MapPin className="h-3.5 w-3.5" /> Popular areas
              </h3>
              <div className="overflow-hidden rounded-2xl bg-white">
                {filteredAreas.map((area, i) => (
                  <button
                    key={`area-${area.label}-${area.latitude},${area.longitude}`}
                    onClick={() => pick(area)}
                    className={cn(
                      'tap flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-neutral-50',
                      i > 0 && 'border-t border-neutral-100'
                    )}
                  >
                    <MapPin className="h-4.5 w-4.5 shrink-0 text-neutral-400" />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-neutral-900">{area.label}</span>
                      <span className="block truncate text-xs text-neutral-500">{area.address}</span>
                    </span>
                  </button>
                ))}
                {serverResults.length === 0 && filteredAreas.length === 0 && filteredPlaces.length === 0 && query && (
                  <p className="px-4 py-3 text-sm text-neutral-500">
                    No areas found for "{query}". Try a nearby landmark.
                  </p>
                )}
              </div>
            </section>

            <button
              onClick={() => pick(DEFAULT_LOCATION)}
              className="mx-auto mt-6 block py-1 text-center text-xs font-semibold text-neutral-400 underline underline-offset-2 hover:text-neutral-600"
            >
              Reset to default location
            </button>

            {locating && (
              <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-neutral-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Locating…
              </p>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
