import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import * as Dialog from '@radix-ui/react-dialog';
import {
  ArrowLeft,
  Briefcase,
  ChevronDown,
  ChevronRight,
  Home,
  Info,
  LocateFixed,
  Loader2,
  MapPin,
  MapIcon,
  MoreHorizontal,
  Plus,
  Search,
  Share2,
  Trash2,
} from 'lucide-react';
import { repositories } from '@/repositories';
import { useAppStore } from '@/store/appStore';
import { useAuthStore } from '@/store/authStore';
import { DEFAULT_LOCATION, POPULAR_AREAS, currentLocation } from '@/lib/location';
import { formatDistanceKm, haversineKm } from '@/lib/geo';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import type { Location } from '@/types/catalog';
import { useSetDeliveryAddress } from '@/hooks/useCart';
import { MapPicker } from '@/components/map/MapPicker';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';

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
  const queryClient = useQueryClient();
  const setLocation = useAppStore((s) => s.setLocation);
  const activeLocation = useAppStore((s) => s.location) ?? DEFAULT_LOCATION;
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const locationSelectorContext = useAppStore((s) => s.locationSelectorContext);
  const locationSelectorCartType = useAppStore((s) => s.locationSelectorCartType);
  const closeLocationSelector = useAppStore((s) => s.closeLocationSelector);
  const [locating, setLocating] = useState(false);
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<'list' | 'add'>('list');
  const [editing, setEditing] = useState<any | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<any | null>(null);

  const [form, setForm] = useState({
    label: 'Home',
    contact_name: '',
    contact_phone: '',
    address_line_1: '',
    address_line_2: '',
    city: '',
    state: '',
    postal_code: '',
    country: 'India',
    latitude: '',
    longitude: '',
    place_id: null as string | null,
    formatted_address: null as string | null,
  });
  const [mapOpen, setMapOpen] = useState(false);
  const [locationPicked, setLocationPicked] = useState(false);

  const isCartSelection = locationSelectorContext === 'food-cart' || locationSelectorContext === 'grocery-cart';
  const cartType = locationSelectorCartType || (locationSelectorContext === 'grocery-cart' ? 'grocery' : 'food');

  const setDeliveryAddress = useSetDeliveryAddress();

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
    if (isCartSelection && isAuthenticated) {
      // For cart selection, just set app location (some flows might want this)
      // but requirement says selecting saved address must call setDeliveryAddress
    }
    setLocation(loc);
    onOpenChange(false);
  };

  const selectSavedAddressForCart = (a: any) => {
    if (!isCartSelection) {
      pick({
        label: a.label,
        address: `${a.address_line_1}, ${a.city}`,
        latitude: parseFloat(a.latitude ?? '0') || 0,
        longitude: parseFloat(a.longitude ?? '0') || 0,
        place_id: a.place_id ?? null,
        formatted_address: a.formatted_address ?? null,
      });
      return;
    }
    setDeliveryAddress.mutate(
      { addressId: a.id, type: cartType },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['cart'] });
          queryClient.invalidateQueries({ queryKey: ['cart', cartType] });
          toast('Delivery address updated');
          onOpenChange(false);
        },
        onError: (err: unknown) => {
          toast(err instanceof Error ? err.message : 'Could not update delivery address.', 'error');
        },
      }
    );
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
      const loc: Location = {
        label: 'Current location',
        address: reverse.city ? `${reverse.street ?? reverse.address}, ${reverse.city}` : reverse.address,
        latitude: res.location.latitude,
        longitude: res.location.longitude,
        formatted_address: reverse.formatted_address ?? reverse.address,
        locality: reverse.locality ?? null,
        area: reverse.area ?? null,
      };
      if (isCartSelection) {
        setLocation(loc);
        onOpenChange(false);
        toast('Location updated');
        return;
      }
      pick(loc);
      toast('Location updated');
    } catch {
      setLocating(false);
      const loc: Location = {
        label: 'Current location',
        address: res.location.address,
        latitude: res.location.latitude,
        longitude: res.location.longitude,
      };
      if (isCartSelection) {
        setLocation(loc);
        onOpenChange(false);
        toast('Location updated (no address details)');
        return;
      }
      pick(loc);
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

  const save = useMutation({
    mutationFn: () => {
      if (!locationPicked || !form.latitude || !form.longitude) {
        throw new Error('Please pick your location on the map first.');
      }
      const payload = {
        ...form,
        contact_name: form.contact_name || null,
        contact_phone: form.contact_phone || null,
        address_line_2: form.address_line_2 || null,
        state: form.state || null,
        postal_code: form.postal_code || null,
        country: form.country || 'India',
        latitude: form.latitude,
        longitude: form.longitude,
        place_id: form.place_id,
        formatted_address: form.formatted_address,
      };
      return editing
        ? repositories.user.updateAddress(editing.id, payload)
        : repositories.user.createAddress(payload);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['location-addresses'] });
      queryClient.invalidateQueries({ queryKey: ['addresses'] });
      toast(editing ? 'Address updated' : 'Address added');
      if (isCartSelection && data?.id) {
        setDeliveryAddress.mutate(
          { addressId: data.id, type: cartType },
          {
            onSuccess: () => {
              queryClient.invalidateQueries({ queryKey: ['cart'] });
              queryClient.invalidateQueries({ queryKey: ['cart', cartType] });
              setMode('list');
              onOpenChange(false);
            },
            onError: (err: unknown) => {
              toast(err instanceof Error ? err.message : 'Could not update delivery address.', 'error');
              setMode('list');
            },
          }
        );
        return;
      }
      setMode('list');
      setEditing(null);
      resetForm();
      setLocationPicked(false);
    },
    onError: () => toast('Could not save address', 'error'),
  });

  const setDefault = useMutation({
    mutationFn: (id: number) => repositories.user.setDefaultAddress(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['location-addresses'] });
      queryClient.invalidateQueries({ queryKey: ['addresses'] });
      toast('Default address updated');
    },
  });

  const remove = useMutation({
    mutationFn: (id: number) => repositories.user.deleteAddress(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['location-addresses'] });
      queryClient.invalidateQueries({ queryKey: ['addresses'] });
      setConfirmDelete(null);
      toast('Address deleted');
    },
  });

  const resetForm = () =>
    setForm({
      label: 'Home',
      contact_name: '',
      contact_phone: '',
      address_line_1: '',
      address_line_2: '',
      city: '',
      state: '',
      postal_code: '',
      country: 'India',
      latitude: '',
      longitude: '',
      place_id: null,
      formatted_address: null,
    });

  const openAdd = () => {
    setEditing(null);
    resetForm();
    setLocationPicked(false);
    setMapOpen(true);
    setMode('add');
  };

  const openEdit = (a: any) => {
    setEditing(a);
    setForm({
      label: a.label,
      contact_name: a.contact_name ?? '',
      contact_phone: a.contact_phone ?? '',
      address_line_1: a.address_line_1,
      address_line_2: a.address_line_2 ?? '',
      city: a.city,
      state: a.state ?? '',
      postal_code: a.postal_code ?? '',
      country: a.country || 'India',
      latitude: a.latitude ?? '',
      longitude: a.longitude ?? '',
      place_id: a.place_id ?? null,
      formatted_address: a.formatted_address ?? null,
    });
    setLocationPicked(!!(a.latitude && a.longitude));
    setMapOpen(false);
    setMode('add');
  };

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
    <Dialog.Root
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          setMode('list');
          setQuery('');
        }
        onOpenChange(v);
      }}
    >
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
            {mode === 'add' ? (
              <button
                aria-label="Back"
                onClick={() => {
                  setMode('list');
                  setEditing(null);
                  resetForm();
                  setLocationPicked(false);
                  setMapOpen(false);
                }}
                className="tap -ml-1 flex h-9 w-9 items-center justify-center rounded-full text-neutral-700 transition-colors hover:bg-neutral-200/70 focus:outline-2 focus:outline-brand-600"
              >
                <ArrowLeft className="h-6 w-6" />
              </button>
            ) : (
              <Dialog.Close
                aria-label="Close location picker"
                className="tap -ml-1 flex h-9 w-9 items-center justify-center rounded-full text-neutral-700 transition-colors hover:bg-neutral-200/70 focus:outline-2 focus:outline-brand-600"
              >
                <ChevronDown className="h-6 w-6" />
              </Dialog.Close>
            )}
            <Dialog.Title className="text-[20px] font-extrabold tracking-tight text-neutral-900">
              {mode === 'add' ? (editing ? 'Edit address' : 'Add address') : 'Select a location'}
            </Dialog.Title>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8">
            {mode === 'add' ? (
              <div className="space-y-4">
                <Card className="p-4 space-y-3">
                  <div className="flex gap-2">
                    {(['Home', 'Work', 'Other'] as const).map((l) => (
                      <button
                        key={l}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, label: l }))}
                        className={cn(
                          'rounded-full px-3 py-1 text-sm font-semibold',
                          form.label === l ? 'bg-food-600 text-white' : 'bg-neutral-100 text-neutral-700'
                        )}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                  <Input placeholder="Flat / House no. / Floor / Building" value={form.address_line_1} onChange={(e) => setForm((f) => ({ ...f, address_line_1: e.target.value }))} />
                  <Input placeholder="Area / Sector / Landmark (optional)" value={form.address_line_2} onChange={(e) => setForm((f) => ({ ...f, address_line_2: e.target.value }))} />
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="City" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
                    <Input placeholder="State (optional)" value={form.state} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="Pincode (optional)" value={form.postal_code} onChange={(e) => setForm((f) => ({ ...f, postal_code: e.target.value }))} />
                    <Input placeholder="Country" value={form.country} onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))} />
                  </div>
                  <Input placeholder="Contact name (optional)" value={form.contact_name} onChange={(e) => setForm((f) => ({ ...f, contact_name: e.target.value }))} />
                  <Input placeholder="Contact phone (optional)" value={form.contact_phone} onChange={(e) => setForm((f) => ({ ...f, contact_phone: e.target.value }))} />
                </Card>
                <Card className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-neutral-900">Location on map</p>
                    {locationPicked ? <span className="text-xs text-success">Picked</span> : <span className="text-xs text-neutral-500">Required</span>}
                  </div>
                  <Button type="button" variant="outline" onClick={() => setMapOpen(true)}>
                    <MapIcon className="h-4 w-4" /> {locationPicked ? 'Change location on map' : 'Pick location on map'}
                  </Button>
                  {(form.latitude && form.longitude) && (
                    <p className="text-xs text-neutral-500">
                      {form.latitude}, {form.longitude}
                    </p>
                  )}
                </Card>
                <Button
                  disabled={save.isPending || !locationPicked || !form.address_line_1 || !form.city}
                  onClick={() => save.mutate()}
                  className="w-full"
                >
                  {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editing ? 'Save changes' : 'Save address'}
                </Button>
              </div>
            ) : (
              <>
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
                  if (isCartSelection) {
                    setMode('add');
                    setEditing(null);
                    resetForm();
                    setLocationPicked(false);
                    return;
                  }
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
                          onClick={() => {
                            if (isCartSelection && isAuthenticated) {
                              const addr = (addresses.data ?? []).find((a: any) => `address-${a.id}` === p.key);
                              if (addr) {
                                selectSavedAddressForCart(addr);
                                return;
                              }
                            }
                            pick(p.location);
                          }}
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
              </>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
