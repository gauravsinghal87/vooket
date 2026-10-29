import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
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
  MessageCircle,
  MoreHorizontal,
  Plus,
  Search,
  Share2,
  Trash2,
  X,
} from 'lucide-react';
import { repositories } from '@/repositories';
import { activeService } from '@/components/service/service-theme';
import { useAppStore } from '@/store/appStore';
import { useAuthStore } from '@/store/authStore';
import { DEFAULT_LOCATION, POPULAR_AREAS, currentLocation, locationFromAddress } from '@/lib/location';
import { formatDistanceKm, haversineKm } from '@/lib/geo';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import type { Location } from '@/types/catalog';
import { useSetDeliveryAddress } from '@/hooks/useCart';
import { MapPicker, type SelectedPlace } from '@/components/map/MapPicker';
import { Modal } from '@/components/ui/modal';

interface LocationSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const RECENT_LOCATIONS_KEY = 'sb-recent-locations';
const SHARE_BANNER_KEY = 'sb-address-share-banner-dismissed';
const REQUEST_ADDRESS_MESSAGE =
  'Hi! Please share your delivery address so I can send your order across.';

interface RecentLocation {
  label: string;
  address: string;
  latitude: number;
  longitude: number;
  place_id?: string | null;
  formatted_address?: string | null;
}

/** Local history of the addresses this picker has placed, shown on the grocery
 *  screen as "Recently searched locations". Written on every pick and read each
 *  time the panel opens, capped so the list never grows without bound. */
function readRecentLocations(): RecentLocation[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_LOCATIONS_KEY) ?? '[]');
    return Array.isArray(parsed) ? (parsed as RecentLocation[]) : [];
  } catch {
    return [];
  }
}

function rememberLocation(loc: Location) {
  try {
    const entry: RecentLocation = {
      label: loc.label,
      address: loc.address,
      latitude: loc.latitude,
      longitude: loc.longitude,
      place_id: loc.place_id ?? null,
      formatted_address: loc.formatted_address ?? null,
    };
    const next = [entry, ...readRecentLocations().filter((r) => r.address !== entry.address)].slice(0, 5);
    localStorage.setItem(RECENT_LOCATIONS_KEY, JSON.stringify(next));
  } catch {
    // History is a convenience — never let storage failures break a pick.
  }
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
  const user = useAuthStore((s) => s.user);
  const locationSelectorContext = useAppStore((s) => s.locationSelectorContext);
  const locationSelectorCartType = useAppStore((s) => s.locationSelectorCartType);
  const closeLocationSelector = useAppStore((s) => s.closeLocationSelector);
  const [locating, setLocating] = useState(false);
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<'list' | 'add' | 'groceryMap' | 'groceryDetails'>('list');
  const [pickedPlace, setPickedPlace] = useState<SelectedPlace | null>(null);
  // Grocery's details sheet asks who the order is for; the answer seeds the
  // receiver fields rather than storing anything new.
  const [orderingFor, setOrderingFor] = useState<'myself' | 'someone'>('myself');
  const [editing, setEditing] = useState<any | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<any | null>(null);

  const [form, setForm] = useState({
    label: 'Home',
    contact_name: '',
    contact_phone: '',
    address_line_1: '',
    address_line_2: '',
    landmark: '',
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

  // The URL decides which module owns this picker — the same resolution the
  // header and search bar use — falling back to the persisted module for routes
  // that name none. So `/grocery` and `/store/:id` get the grocery address
  // screen, `/rides*` the rides flow, and everything else the Food screen it
  // has always had.
  const route = useLocation();
  const storedService = useAppStore((s) => s.service);
  const service = activeService(route.pathname, route.search) ?? storedService;
  const isGrocery = service === 'grocery';

  // Rides never shows this picker: its location control jumps straight into the
  // destination flow, which is where rides locations are chosen.
  useEffect(() => {
    if (!open || service !== 'rides') return;
    onOpenChange(false);
    navigate('/rides/destination?field=drop');
  }, [open, service, navigate, onOpenChange]);

  // Read the pick history fresh on every open so a location chosen a moment ago
  // is already listed the next time the grocery screen appears.
  const recentLocations = useMemo(
    () => (open && isGrocery ? readRecentLocations() : []),
    [open, isGrocery]
  );
  const [bannerDismissed, setBannerDismissed] = useState(() => {
    try {
      return localStorage.getItem(SHARE_BANNER_KEY) === '1';
    } catch {
      return false;
    }
  });

  const isCartSelection = locationSelectorContext === 'food-cart' || locationSelectorContext === 'grocery-cart';
  const cartType = locationSelectorCartType || (locationSelectorContext === 'grocery-cart' ? 'grocery' : 'food');

  const setDeliveryAddress = useSetDeliveryAddress();

  const { data: appConfig } = useQuery({
    queryKey: ['app-config'],
    queryFn: () => repositories.user.getAppConfig(),
    staleTime: 5 * 60 * 1000,
  });

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

  const pick = (loc: Location, addressId: number | null = null) => {
    rememberLocation(loc);
    // The header location and the module cart's delivery address are the same
    // choice, so the saved address behind the pick travels with it — that is
    // what keeps the cart's "to …" line in step with what was chosen here.
    setLocation(loc, addressId);
    onOpenChange(false);
  };

  const selectSavedAddressForCart = (a: any) => {
    const loc = locationFromAddress(a);

    if (!isCartSelection) {
      // Picked on a home screen: show it in the header immediately and point the
      // active module's cart at the same address. A cart that does not exist yet
      // is picked up later by `useSyncCartAddress`.
      pick(loc, a.id);
      const moduleType = service === 'grocery' ? 'grocery' : service === 'food' ? 'food' : null;
      if (moduleType) {
        setDeliveryAddress.mutate(
          { addressId: a.id, type: moduleType },
          { onError: () => undefined }
        );
      }
      return;
    }

    // Picked from the cart: the header follows along too.
    setLocation(loc, a.id);
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
        landmark: form.landmark || null,
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
        // The freshly saved address is also the delivery location the header
        // shows, so it is written to both sides exactly like any other pick.
        setLocation(
          {
            label: data.label,
            address: `${data.address_line_1}${data.address_line_2 ? `, ${data.address_line_2}` : ''}, ${data.city}`,
            latitude: parseFloat(String(data.latitude ?? 0)) || 0,
            longitude: parseFloat(String(data.longitude ?? 0)) || 0,
            place_id: data.place_id ?? null,
            formatted_address: data.formatted_address ?? null,
          },
          data.id
        );
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
      landmark: '',
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
      landmark: a.landmark ?? '',
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

  /** Feeds a resolved place (map pin or GPS) into the add-address form. */
  const applyPlace = (place: SelectedPlace) => {
    setPickedPlace(place);
    setLocationPicked(true);
    setForm((f) => ({
      ...f,
      latitude: String(place.latitude),
      longitude: String(place.longitude),
      city: place.city || f.city,
      state: place.state || f.state,
      postal_code: place.postal_code || f.postal_code,
      country: place.country || f.country || 'India',
      place_id: place.place_id ?? f.place_id,
      formatted_address: place.formatted_address ?? f.formatted_address,
    }));
  };

  /**
   * GPS path for the add-address sheets: reverse-geocodes and fills the form
   * without a map, so the flow still completes when the Maps key is missing.
   */
  const locateForForm = async () => {
    setLocating(true);
    const res = await currentLocation();
    if (!res.ok || !res.location) {
      setLocating(false);
      toast(res.error ?? 'Could not fetch your location', 'error');
      return;
    }
    try {
      const reverse = await repositories.user.reverseGeocode(
        res.location.latitude,
        res.location.longitude
      );
      setLocating(false);
      applyPlace({
        label: 'Current location',
        address_line_1: reverse.street ?? reverse.address,
        city: reverse.city ?? '',
        state: reverse.state ?? '',
        postal_code: reverse.postal_code ?? '',
        country: reverse.country || 'India',
        latitude: res.location.latitude,
        longitude: res.location.longitude,
        place_id: null,
        formatted_address: reverse.formatted_address ?? reverse.address,
        locality: reverse.locality ?? null,
        area: reverse.area ?? null,
        provider: reverse.provider ?? null,
      });
    } catch {
      setLocating(false);
      applyPlace({
        label: 'Current location',
        address_line_1: res.location.address || 'Current location',
        city: '',
        state: '',
        postal_code: '',
        country: 'India',
        latitude: res.location.latitude,
        longitude: res.location.longitude,
        place_id: null,
        formatted_address: null,
      });
    }
  };

  /**
   * The map block for the add-address screens. Without a Maps key the sheet
   * still completes: GPS fills the coordinates and the fields accept typing.
   */
  const mapPicker = (onCancel: () => void) =>
    appConfig?.maps?.public_key ? (
      <MapPicker
        publicKey={appConfig.maps.public_key}
        initialLatitude={form.latitude ? parseFloat(form.latitude) : null}
        initialLongitude={form.longitude ? parseFloat(form.longitude) : null}
        initialAddressLine1={form.address_line_1}
        initialCity={form.city}
        countryCode={form.country?.slice(0, 2)}
        onSelected={applyPlace}
        onPlaceChange={(place) => {
          if (place) applyPlace(place);
        }}
        onCancel={onCancel}
      />
    ) : (
      <p className="rounded-xl bg-white px-3 py-3 text-xs text-neutral-500">
        Map unavailable — use “Use current location” below, or type the address directly.
      </p>
    );

  /** Grocery's "Change" affordance: bring the map search field back into play. */
  const focusMapSearch = () => {
    const el = document.getElementById('address-map-search') as HTMLInputElement | null;
    el?.focus();
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };

  /** "Who you are ordering for?" — seeds the receiver fields, stores nothing. */
  const seedReceiver = (value: 'myself' | 'someone') => {
    setOrderingFor(value);
    setForm((f) => ({
      ...f,
      contact_name: value === 'myself' ? f.contact_name || user?.name || '' : '',
      contact_phone: value === 'myself' ? f.contact_phone : '',
    }));
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

  // Grocery's two extra address actions: asking someone for their address over
  // WhatsApp, and pulling addresses out of Zomato. Both hand off to the external
  // service — the app has no address-import API of its own.
  const requestAddressFromSomeone = () => {
    window.open(
      `https://wa.me/?text=${encodeURIComponent(REQUEST_ADDRESS_MESSAGE)}`,
      '_blank',
      'noopener,noreferrer'
    );
  };

  const importFromZomato = () => {
    window.open('https://www.zomato.com', '_blank', 'noopener,noreferrer');
  };

  const dismissShareBanner = () => {
    setBannerDismissed(true);
    try {
      localStorage.setItem(SHARE_BANNER_KEY, '1');
    } catch {
      // ignore
    }
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          setMode('list');
          setQuery('');
          setPickedPlace(null);
        }
        onOpenChange(v);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-fade-in" />
        <Dialog.Content
          className={cn(
            'fixed inset-x-0 bottom-0 top-0 z-50 flex w-full flex-col shadow-2xl focus:outline-none',
            'data-[state=open]:animate-slide-down mx-auto max-w-lg sm:rounded-none sm:border-x sm:border-neutral-200',
            // Grocery paints its own light grey-violet surface; every other
            // module keeps the warm ink canvas it had.
            isGrocery ? 'bg-[#f4f5fa]' : 'bg-ink-50'
          )}
        >
          {/* Header: chevron-down dismisses, the title leads. */}
          <div className={cn('flex shrink-0 items-center gap-3 px-4 pb-3 pt-5', isGrocery ? 'bg-[#f4f5fa]' : 'bg-ink-50')}>
            {mode !== 'list' ? (
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
              {mode === 'add'
                ? 'Select delivery location'
                : mode === 'list'
                  ? 'Select a location'
                  : 'Add address'}
            </Dialog.Title>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8">
            {mode === 'add' ? (
              /* Food's add-address screen: the map leads, the delivery,
                 receiver and label details sit in the sheet below it. MapPicker
                 reports the pinned place on every change, so the sheet always
                 shows what the pin is pointing at. */
              <div className="space-y-4">
                {mapPicker(() => {
                  setMode('list');
                  setEditing(null);
                  resetForm();
                  setLocationPicked(false);
                  setPickedPlace(null);
                })}

                <div className="space-y-4 rounded-3xl bg-white p-4 shadow-[0_1px_3px_rgb(16_14_10/0.08)]">
                  <section className="space-y-2">
                    <p className="text-xs font-semibold text-neutral-500">Delivery details</p>
                    <div className="flex items-center gap-3 rounded-xl border border-neutral-200 px-3 py-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-food-50 text-food-600">
                        <MapPin className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1 text-sm font-semibold text-neutral-900">
                        {pickedPlace
                          ? pickedPlace.formatted_address ?? pickedPlace.address_line_1
                          : 'Move the pin or use your current location'}
                      </span>
                    </div>
                    <input
                      value={form.address_line_1}
                      onChange={(e) => setForm((f) => ({ ...f, address_line_1: e.target.value }))}
                      placeholder="Address details*"
                      aria-label="Address details"
                      className="h-11 w-full rounded-xl border border-neutral-200 bg-white px-3.5 text-sm text-neutral-900 outline-none transition-colors focus:border-food-400"
                    />
                    <p className="text-xs text-neutral-400">E.g. Floor, House no.</p>
                  </section>

                  <section className="space-y-2">
                    <p className="text-xs font-semibold text-neutral-500">Receiver details for this address</p>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        value={form.contact_name}
                        onChange={(e) => setForm((f) => ({ ...f, contact_name: e.target.value }))}
                        placeholder="Contact name"
                        aria-label="Contact name"
                        className="h-11 rounded-xl border border-neutral-200 bg-white px-3.5 text-sm text-neutral-900 outline-none transition-colors focus:border-food-400"
                      />
                      <input
                        value={form.contact_phone}
                        onChange={(e) => setForm((f) => ({ ...f, contact_phone: e.target.value }))}
                        placeholder="Contact phone"
                        aria-label="Contact phone"
                        className="h-11 rounded-xl border border-neutral-200 bg-white px-3.5 text-sm text-neutral-900 outline-none transition-colors focus:border-food-400"
                      />
                    </div>
                  </section>

                  <section className="space-y-2">
                    <p className="text-xs font-semibold text-neutral-500">Save address as</p>
                    <div className="flex flex-wrap gap-2">
                      {(['Home', 'Work', 'Other'] as const).map((l) => (
                        <button
                          key={l}
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, label: l }))}
                          className={cn(
                            'rounded-full border px-4 py-2 text-sm font-semibold transition-colors',
                            form.label === l
                              ? 'border-food-600 bg-food-50 text-food-600'
                              : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
                          )}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                  </section>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void locateForForm()}
                      disabled={locating}
                      className="tap inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 px-3 py-2.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
                    >
                      {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
                      Use current location
                    </button>
                    <button
                      type="button"
                      onClick={() => save.mutate()}
                      disabled={save.isPending || !locationPicked || !form.address_line_1.trim() || !form.city}
                      className="tap flex flex-1 items-center justify-center gap-2 rounded-xl bg-food-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-food-700 disabled:opacity-50"
                    >
                      {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                      Save address
                    </button>
                  </div>
                </div>
              </div>
            ) : mode === 'groceryMap' ? (
              /* Grocery step 1: pin the delivery point on the map, then hand
                 off to the details sheet. */
              <div className="space-y-4">
                {mapPicker(() => {
                  setMode('list');
                  setEditing(null);
                  resetForm();
                  setLocationPicked(false);
                  setPickedPlace(null);
                })}

                <div className="space-y-3 rounded-3xl bg-white p-4 shadow-[0_1px_3px_rgb(16_14_10/0.08)]">
                  <p className="text-sm font-bold text-neutral-900">Delivering your order to</p>
                  <div className="flex items-center gap-3 rounded-xl border border-neutral-200 px-3 py-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success/10 text-success">
                      <MapPin className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-neutral-900">
                        {pickedPlace
                          ? (pickedPlace.formatted_address ?? pickedPlace.address_line_1).split(',')[0]
                          : 'Move the pin to adjust your location'}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-neutral-500">
                        {pickedPlace
                          ? (pickedPlace.formatted_address ?? pickedPlace.address_line_1)
                              .split(',')
                              .slice(1)
                              .join(',')
                              .trim() || pickedPlace.city
                          : 'Search above or use your current location'}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={focusMapSearch}
                      className="shrink-0 rounded-lg border border-success/40 px-3 py-1.5 text-xs font-bold text-success transition-colors hover:bg-success/5"
                    >
                      Change
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setMode('groceryDetails')}
                    className="tap flex w-full items-center justify-center gap-2 rounded-xl bg-success px-4 py-3.5 text-sm font-bold text-white transition-colors hover:bg-[#15803d]"
                  >
                    Add more address details
                    <ChevronRight className="h-4 w-4" />
                  </button>

                  <div className="flex flex-col items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void locateForForm()}
                      disabled={locating}
                      className="text-xs font-semibold text-success underline underline-offset-2 hover:text-[#15803d] disabled:opacity-60"
                    >
                      {locating ? 'Locating…' : 'Use current location'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode('groceryDetails')}
                      className="text-xs font-semibold text-neutral-500 underline decoration-dashed underline-offset-2 hover:text-neutral-700"
                    >
                      I don't know the exact location on map
                    </button>
                  </div>
                </div>
              </div>
            ) : mode === 'groceryDetails' ? (
              /* Grocery step 2: the complete-address sheet. */
              <div className="rounded-3xl bg-white p-4 shadow-[0_1px_3px_rgb(16_14_10/0.08)]">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[17px] font-extrabold text-neutral-900">Enter complete address</p>
                  <button
                    type="button"
                    aria-label="Back to map"
                    onClick={() => setMode('groceryMap')}
                    className="tap flex h-8 w-8 items-center justify-center rounded-full border border-neutral-200 text-neutral-500 transition-colors hover:bg-neutral-50"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <p className="mt-4 text-xs font-semibold text-neutral-500">Who you are ordering for?</p>
                <div className="mt-2 flex gap-5">
                  {([
                    ['myself', 'Myself'],
                    ['someone', 'Someone else'],
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => seedReceiver(value)}
                      className="flex items-center gap-2 text-sm font-semibold text-neutral-700"
                    >
                      <span
                        className={cn(
                          'flex h-4 w-4 items-center justify-center rounded-full border transition-colors',
                          orderingFor === value ? 'border-success' : 'border-neutral-300'
                        )}
                      >
                        {orderingFor === value && <span className="h-2 w-2 rounded-full bg-success" />}
                      </span>
                      {label}
                    </button>
                  ))}
                </div>

                <p className="mt-4 text-xs font-semibold text-neutral-500">Save address as *</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(['Home', 'Work', 'Hotel', 'Other'] as const).map((l) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, label: l }))}
                      className={cn(
                        'rounded-full border px-4 py-2 text-sm font-semibold transition-colors',
                        form.label === l
                          ? 'border-success bg-success/10 text-success'
                          : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
                      )}
                    >
                      {l}
                    </button>
                  ))}
                </div>

                <div className="mt-4 space-y-3">
                  <input
                    value={form.address_line_1}
                    onChange={(e) => setForm((f) => ({ ...f, address_line_1: e.target.value }))}
                    placeholder="Flat / House no / Building name *"
                    aria-label="Flat / House no / Building name"
                    className="h-11 w-full rounded-xl border border-neutral-200 bg-white px-3.5 text-sm text-neutral-900 outline-none transition-colors focus:border-success"
                  />
                  <input
                    value={form.address_line_2}
                    onChange={(e) => setForm((f) => ({ ...f, address_line_2: e.target.value }))}
                    placeholder="Floor (optional)"
                    aria-label="Floor"
                    className="h-11 w-full rounded-xl border border-neutral-200 bg-white px-3.5 text-sm text-neutral-900 outline-none transition-colors focus:border-success"
                  />
                  <div className="flex items-center gap-2 rounded-xl bg-neutral-100 px-3 py-2.5">
                    <span className="min-w-0 flex-1 truncate text-sm text-neutral-700">
                      {pickedPlace
                        ? pickedPlace.formatted_address ?? pickedPlace.address_line_1
                        : form.city || 'Area / Sector / Locality'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setMode('groceryMap')}
                      className="shrink-0 rounded-lg border border-success/40 px-3 py-1 text-xs font-bold text-success transition-colors hover:bg-success/5"
                    >
                      Change
                    </button>
                  </div>
                  <input
                    value={form.landmark}
                    onChange={(e) => setForm((f) => ({ ...f, landmark: e.target.value }))}
                    placeholder="Nearby landmark (optional)"
                    aria-label="Nearby landmark"
                    className="h-11 w-full rounded-xl border border-neutral-200 bg-white px-3.5 text-sm text-neutral-900 outline-none transition-colors focus:border-success"
                  />
                </div>

                <p className="mt-4 text-xs font-semibold text-neutral-500">
                  Enter your details for seamless delivery experience
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <input
                    value={form.contact_name}
                    onChange={(e) => setForm((f) => ({ ...f, contact_name: e.target.value }))}
                    placeholder="Your name *"
                    aria-label="Your name"
                    className="h-11 rounded-xl border border-neutral-200 bg-white px-3.5 text-sm text-neutral-900 outline-none transition-colors focus:border-success"
                  />
                  <input
                    value={form.contact_phone}
                    onChange={(e) => setForm((f) => ({ ...f, contact_phone: e.target.value }))}
                    placeholder="Your phone number (optional)"
                    aria-label="Your phone number"
                    className="h-11 rounded-xl border border-neutral-200 bg-white px-3.5 text-sm text-neutral-900 outline-none transition-colors focus:border-success"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => save.mutate()}
                  disabled={save.isPending || !locationPicked || !form.address_line_1.trim() || !form.city}
                  className="tap mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-success py-3.5 text-sm font-bold text-white transition-colors hover:bg-[#15803d] disabled:opacity-50"
                >
                  {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save address
                </button>
              </div>
            ) : (
              <>
            {/* Area search. */}
            <div className="relative">
              <Search
                className={cn(
                  'absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2',
                  isGrocery ? 'text-success' : 'text-food-600'
                )}
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search for area, street name..."
                aria-label="Search location"
                className={cn(
                  'h-12 w-full rounded-2xl border border-neutral-200 bg-white pl-11 pr-4 text-sm text-neutral-900 outline-none transition-colors placeholder:text-neutral-400',
                  isGrocery ? 'focus:border-success' : 'focus:border-food-400'
                )}
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

            {isGrocery ? (
              <>
                {/* Grocery's address screen: the same actions as Food but
                    presented as four separate cards on the grey-violet
                    surface, each leading with a tinted round icon. */}
                <div className="mt-3 space-y-2.5">
                  <button
                    onClick={useGPS}
                    className="tap flex w-full items-center gap-3 rounded-2xl bg-white px-4 py-3.5 text-left shadow-[0_1px_2px_rgb(16_14_10/0.05)] transition-colors hover:bg-neutral-50"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-success/10 text-success">
                      <LocateFixed className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-bold text-success">Use current location</span>
                      <span className="mt-0.5 block truncate text-[13px] text-neutral-500">
                        {locating ? 'Fetching your location…' : activeLocation.address}
                      </span>
                    </span>
                    <ChevronRight className="h-4.5 w-4.5 shrink-0 text-neutral-300" />
                  </button>

                  <button
                    onClick={() => {
                      setMode('groceryMap');
                      setEditing(null);
                      resetForm();
                      setLocationPicked(false);
                      setPickedPlace(null);
                    }}
                    className="tap flex w-full items-center gap-3 rounded-2xl bg-white px-4 py-3.5 text-left shadow-[0_1px_2px_rgb(16_14_10/0.05)] transition-colors hover:bg-neutral-50"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-success/10 text-success">
                      <Plus className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1 text-[15px] font-bold text-success">Add new address</span>
                    <ChevronRight className="h-4.5 w-4.5 shrink-0 text-neutral-300" />
                  </button>

                  <button
                    onClick={requestAddressFromSomeone}
                    className="tap flex w-full items-center gap-3 rounded-2xl bg-white px-4 py-3.5 text-left shadow-[0_1px_2px_rgb(16_14_10/0.05)] transition-colors hover:bg-neutral-50"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-success/10 text-success">
                      <MessageCircle className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1 text-[15px] font-bold text-neutral-900">
                      Request address from someone else
                    </span>
                    <ChevronRight className="h-4.5 w-4.5 shrink-0 text-neutral-300" />
                  </button>

                  <button
                    onClick={importFromZomato}
                    className="tap flex w-full items-center gap-3 rounded-2xl bg-white px-4 py-3.5 text-left shadow-[0_1px_2px_rgb(16_14_10/0.05)] transition-colors hover:bg-neutral-50"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-food-600 text-[13px] font-extrabold leading-none text-white">
                      Z
                    </span>
                    <span className="min-w-0 flex-1 text-[15px] font-bold text-neutral-900">
                      Import your addresses from Zomato
                    </span>
                    <ChevronRight className="h-4.5 w-4.5 shrink-0 text-neutral-300" />
                  </button>
                </div>

                {/* Saved addresses: small left-aligned label, then one card
                    each with the gold icon chip, distance in green, phone and
                    the share row — plus the share nudge on the first card. */}
                {filteredPlaces.length > 0 && (
                  <section className="mt-6">
                    <h3 className="mb-2 text-[13px] text-neutral-500">Your saved addresses</h3>
                    <div className="space-y-3">
                      {filteredPlaces.map((p, i) => {
                        const km = haversineKm(activeLocation, { latitude: p.latitude, longitude: p.longitude });
                        const distance = p.latitude || p.longitude ? formatDistanceKm(km) : '';
                        return (
                          <div
                            key={p.key}
                            className="rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgb(16_14_10/0.05)]"
                          >
                            <button
                              onClick={() => {
                                // A saved-address row is the same choice in
                                // every mode: hand it to the shared handler so
                                // the header and the cart both move together.
                                if (isAuthenticated) {
                                  const addr = (addresses.data ?? []).find(
                                    (a: any) => `address-${a.id}` === p.key
                                  );
                                  if (addr) {
                                    selectSavedAddressForCart(addr);
                                    return;
                                  }
                                }
                                pick(p.location);
                              }}
                              className="tap flex w-full items-start gap-3 text-left"
                            >
                              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-grocery-100 text-grocery-600">
                                <p.icon className="h-5.5 w-5.5" strokeWidth={1.7} />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="flex items-baseline gap-2">
                                  <span className="text-[15px] font-bold text-neutral-900">{p.label}</span>
                                  {distance && (
                                    <span className="text-[12px] font-semibold text-success">{distance} away</span>
                                  )}
                                </span>
                                <span className="mt-1 block text-[13px] leading-snug text-neutral-600">
                                  {p.address}
                                </span>
                                {p.phone && (
                                  <span className="mt-1 block text-[13px] text-neutral-500">
                                    Phone number: {p.phone}
                                  </span>
                                )}
                              </span>
                            </button>

                            <div className="mt-3 flex items-center gap-2.5 pl-14">
                              <button
                                onClick={() => {
                                  onOpenChange(false);
                                  navigate('/grocery/profile/addresses');
                                }}
                                aria-label={`Manage ${p.label}`}
                                className="tap flex h-8 w-8 items-center justify-center rounded-full border border-neutral-200 text-success transition-colors hover:border-success/40 hover:bg-success/5"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => sharePlace(p)}
                                aria-label={`Share ${p.label}`}
                                className="tap flex h-8 w-8 items-center justify-center rounded-full border border-neutral-200 text-success transition-colors hover:border-success/40 hover:bg-success/5"
                              >
                                <Share2 className="h-4 w-4" />
                              </button>
                            </div>

                            {i === 0 && !bannerDismissed && (
                              <div className="mt-3 flex items-center gap-2.5 rounded-xl bg-[#fdf3dd] px-3 py-2.5">
                                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-grocery-700">
                                  <Share2 className="h-3.5 w-3.5" />
                                </span>
                                <span className="min-w-0 flex-1 text-[12.5px] text-neutral-700">
                                  Now share your addresses with friends and family
                                </span>
                                <button
                                  onClick={dismissShareBanner}
                                  aria-label="Dismiss address sharing hint"
                                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#e9a23b] text-white transition-colors hover:bg-[#d99229]"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}

                {recentLocations.length > 0 && (
                  <section className="mt-6">
                    <h3 className="mb-2 text-[13px] text-neutral-500">Recently searched locations</h3>
                    <div className="space-y-3">
                      {recentLocations.map((r) => (
                        <button
                          key={`${r.latitude},${r.longitude},${r.address}`}
                          onClick={() => pick(r)}
                          className="tap flex w-full items-start gap-3 rounded-2xl bg-white p-4 text-left shadow-[0_1px_2px_rgb(16_14_10/0.05)] transition-colors hover:bg-neutral-50"
                        >
                          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-grocery-100 text-grocery-600">
                            <MapPin className="h-5.5 w-5.5" strokeWidth={1.7} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[15px] font-bold text-neutral-900">{r.label}</span>
                            <span className="mt-1 block text-[13px] leading-snug text-neutral-600">{r.address}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </section>
                )}
              </>
            ) : (
              <>
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
                  setMode('add');
                  setEditing(null);
                  resetForm();
                  setLocationPicked(false);
                  setPickedPlace(null);
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
                            // A saved-address row is the same choice in every
                            // mode: hand it to the shared handler so the header
                            // and the cart both move together.
                            if (isAuthenticated) {
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
                              navigate('/food/profile/addresses');
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

              </>
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
