import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, LocateFixed, MapPin, Navigation, Search, X } from 'lucide-react-native';
import { repositories } from '@/api/repositories';
import type { Address } from '@/types/catalog';
import type { PlaceResult, ReverseGeocode } from '@/types/models';
import { currentLocation } from '@/lib/location';
import { useMapDraftStore } from '@/stores/mapDraftStore';
import { toast } from '@/stores/toastStore';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { colors } from '@/theme';

const LABELS = ['Home', 'Work', 'Other'] as const;
type AddressLabel = (typeof LABELS)[number];

interface FormState {
  label: AddressLabel;
  contact_name: string;
  contact_phone: string;
  address_line_1: string;
  address_line_2: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  place_id: string | null;
  formatted_address: string | null;
}

const EMPTY: FormState = {
  label: 'Home',
  contact_name: '',
  contact_phone: '',
  address_line_1: '',
  address_line_2: '',
  city: '',
  state: '',
  postal_code: '',
  country: 'India',
  latitude: null,
  longitude: null,
  place_id: null,
  formatted_address: null,
};

function fromAddress(a: Address): FormState {
  const lat = a.latitude != null ? Number(a.latitude) : null;
  const lng = a.longitude != null ? Number(a.longitude) : null;
  return {
    label: (LABELS as readonly string[]).includes(a.label) ? (a.label as AddressLabel) : 'Other',
    contact_name: a.contact_name ?? '',
    contact_phone: a.contact_phone ?? '',
    address_line_1: a.address_line_1 ?? '',
    address_line_2: a.address_line_2 ?? '',
    city: a.city ?? '',
    state: a.state ?? '',
    postal_code: a.postal_code ?? '',
    country: a.country || 'India',
    latitude: lat != null && Number.isFinite(lat) ? lat : null,
    longitude: lng != null && Number.isFinite(lng) ? lng : null,
    place_id: a.place_id ?? null,
    formatted_address: a.formatted_address ?? null,
  };
}

interface AddAddressSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Called with the persisted address returned by the backend after a successful save. */
  onCreated?: (address: Address) => void;
  /** When provided, the sheet edits this address instead of creating a new one. */
  address?: Address | null;
}

export function AddAddressSheet({ visible, onClose, onCreated, address = null }: AddAddressSheetProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const draftPoint = useMapDraftStore((s) => s.point);
  const setDraftPoint = useMapDraftStore((s) => s.setPoint);

  const [form, setForm] = useState<FormState>(EMPTY);
  const [locationPicked, setLocationPicked] = useState(false);
  const [locating, setLocating] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [mapHidden, setMapHidden] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pickingRef = useRef(false);
  const addressId = address?.id ?? null;

  // Initialise the form each time the sheet is freshly opened (edit vs add).
  useEffect(() => {
    if (!visible) return;
    setForm(address ? fromAddress(address) : EMPTY);
    setLocationPicked(!!(address?.latitude && address?.longitude));
    setQuery('');
    setResults([]);
    setSearched(false);
    setDraftPoint(null, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, addressId]);

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  const applyResolved = useCallback((resolved: ReverseGeocode, lat: number, lng: number) => {
    setForm((f) => ({
      ...f,
      latitude: lat,
      longitude: lng,
      address_line_1: f.address_line_1 || resolved.street || resolved.address || '',
      city: resolved.city || f.city,
      state: resolved.state || f.state,
      postal_code: resolved.postal_code || f.postal_code,
      country: resolved.country || f.country || 'India',
      formatted_address: resolved.formatted_address ?? f.formatted_address,
    }));
  }, []);

  const applyCoords = useCallback(
    async (lat: number, lng: number) => {
      setForm((f) => ({ ...f, latitude: lat, longitude: lng }));
      setLocationPicked(true);
      try {
        const resolved = await repositories.user.reverseGeocode(lat, lng);
        applyResolved(resolved, lat, lng);
      } catch {
        // Keep the coordinates; the customer can still enter the address details manually.
      }
    },
    [applyResolved]
  );

  // Pick up a location chosen on the full-screen map picker.
  useEffect(() => {
    if (!draftPoint) return;
    setDraftPoint(null, null);
    void applyCoords(draftPoint.latitude, draftPoint.longitude);
  }, [draftPoint, applyCoords, setDraftPoint]);

  // Reopen the sheet when returning from the map picker.
  useFocusEffect(
    useCallback(() => {
      if (pickingRef.current) {
        pickingRef.current = false;
        setMapHidden(false);
      }
    }, [])
  );

  const openMap = () => {
    if (form.latitude != null && form.longitude != null) {
      setDraftPoint({ latitude: form.latitude, longitude: form.longitude }, null);
    }
    pickingRef.current = true;
    setMapHidden(true);
    router.push('/map-picker' as never);
  };

  const locateMe = async () => {
    setLocating(true);
    const res = await currentLocation();
    setLocating(false);
    if (!res.ok || !res.location) {
      toast(res.error ?? 'Could not get your location.', 'error');
      return;
    }
    await applyCoords(res.location.latitude, res.location.longitude);
  };

  const runSearch = async (term: string) => {
    if (term.trim().length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    setSearching(true);
    try {
      const response = await repositories.user.searchPlaces(term, 'IN');
      setResults(response.results);
      setSearched(true);
    } catch {
      setResults([]);
      setSearched(false);
      toast('Address search is unavailable. Please try again.', 'error');
    } finally {
      setSearching(false);
    }
  };

  const onQueryChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void runSearch(value), 350);
  };

  const chooseResult = async (result: PlaceResult) => {
    setResults([]);
    setQuery(result.main);
    setLoadingDetails(true);
    try {
      let lat = result.latitude;
      let lng = result.longitude;
      let line1 = result.main;
      let city = result.city ?? '';
      let state = result.state ?? '';
      let postal = result.postal_code ?? '';
      let country = result.country ?? '';
      let placeId = result.place_id ?? result.id;
      let formatted = result.formatted_address ?? result.text;

      try {
        const details = await repositories.user.placeDetails(result.id);
        if (details.latitude != null && details.longitude != null) {
          lat = details.latitude;
          lng = details.longitude;
          city = details.city ?? city;
          state = details.state ?? state;
          postal = details.postal_code ?? postal;
          country = details.country ?? country;
          placeId = details.place_id ?? placeId;
          formatted = details.formatted_address ?? details.address ?? formatted;
          line1 = line1 || details.address;
        }
      } catch {
        // The search result already carries the data we need.
      }

      if (lat == null || lng == null) {
        toast('Could not resolve that location. Try another.', 'error');
        return;
      }

      setForm((f) => ({
        ...f,
        address_line_1: f.address_line_1 || line1,
        city: city || f.city,
        state: state || f.state,
        postal_code: postal || f.postal_code,
        country: country || f.country || 'India',
        latitude: lat,
        longitude: lng,
        place_id: placeId,
        formatted_address: formatted,
      }));
      setLocationPicked(true);
    } catch {
      toast('Could not resolve that location. Try another.', 'error');
    } finally {
      setLoadingDetails(false);
    }
  };

  const save = useMutation({
    mutationFn: () => {
      if (form.latitude == null || form.longitude == null) {
        throw new Error('Please pick your location on the map first.');
      }
      if (!form.address_line_1.trim()) {
        throw new Error('Please enter your address.');
      }
      if (!form.city.trim()) {
        throw new Error('Please select a location so the city can be filled.');
      }
      const payload: Partial<Address> = {
        label: form.label,
        contact_name: form.contact_name.trim() || null,
        contact_phone: form.contact_phone.trim() || null,
        address_line_1: form.address_line_1.trim(),
        address_line_2: form.address_line_2.trim() || null,
        city: form.city.trim(),
        state: form.state.trim() || null,
        postal_code: form.postal_code.trim() || null,
        country: form.country.trim() || 'India',
        latitude: String(form.latitude),
        longitude: String(form.longitude),
        place_id: form.place_id,
        formatted_address: form.formatted_address,
      };
      return address
        ? repositories.user.updateAddress(address.id, payload)
        : repositories.user.createAddress(payload);
    },
    onSuccess: (saved) => {
      queryClient.setQueryData<Address[]>(['addresses'], (prev) => {
        if (!prev) return prev;
        const exists = prev.some((a) => a.id === saved.id);
        return exists ? prev.map((a) => (a.id === saved.id ? saved : a)) : [...prev, saved];
      });
      queryClient.invalidateQueries({ queryKey: ['addresses'] });
      toast(address ? 'Address updated' : 'Address added');
      setDraftPoint(null, null);
      onCreated?.(saved);
      onClose();
    },
    onError: (err) => toast(err instanceof Error ? err.message : "Couldn't save address", 'error'),
  });

  const valid =
    locationPicked && form.address_line_1.trim().length > 0 && form.city.trim().length > 0;
  const busy = save.isPending;

  return (
    <BottomSheet
      visible={visible && !mapHidden}
      onClose={onClose}
      title={address ? 'Edit address' : 'Add address'}
      scrollable
      keyboardAware
      maxHeight="92%"
      footer={
        <Pressable
          style={[styles.primaryBtn, (!valid || busy) && styles.primaryBtnDisabled]}
          onPress={() => save.mutate()}
          disabled={!valid || busy}
        >
          {busy ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Check size={16} color="#fff" />
              <Text style={styles.primaryBtnText}>{address ? 'Save changes' : 'Add'}</Text>
            </>
          )}
        </Pressable>
      }
    >
      <View style={styles.form}>
        <View style={styles.labelRow}>
          {LABELS.map((l) => {
            const active = form.label === l;
            return (
              <Pressable
                key={l}
                style={[styles.labelChip, active && styles.labelChipActive]}
                onPress={() => setForm((f) => ({ ...f, label: l }))}
              >
                <Text style={[styles.labelChipText, active && styles.labelChipTextActive]}>{l}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.row2}>
          <View style={styles.row2Col}>
            <Text style={styles.fieldLabel}>Contact name</Text>
            <TextInput
              value={form.contact_name}
              onChangeText={(v) => setForm((f) => ({ ...f, contact_name: v }))}
              placeholder="Receiver name"
              placeholderTextColor={colors.neutral[400]}
              style={styles.input}
              autoCapitalize="words"
            />
          </View>
          <View style={styles.row2Col}>
            <Text style={styles.fieldLabel}>Contact phone</Text>
            <TextInput
              value={form.contact_phone}
              onChangeText={(v) => setForm((f) => ({ ...f, contact_phone: v }))}
              placeholder="Phone number"
              placeholderTextColor={colors.neutral[400]}
              style={styles.input}
              keyboardType="phone-pad"
            />
          </View>
        </View>

        <View style={styles.locationCard}>
          <View style={styles.locationHead}>
            <Text style={styles.locationTitle}>Select location</Text>
            {locationPicked && <Text style={styles.locationSet}>Location set</Text>}
          </View>

          <View style={styles.searchWrap}>
            <Search size={16} color={colors.neutral[400]} />
            <TextInput
              value={query}
              onChangeText={onQueryChange}
              placeholder="Search for an address…"
              placeholderTextColor={colors.neutral[400]}
              style={styles.searchInput}
            />
            {searching || loadingDetails ? (
              <ActivityIndicator size="small" color={colors.neutral[400]} />
            ) : query ? (
              <Pressable onPress={() => { setQuery(''); setResults([]); setSearched(false); }} hitSlop={8}>
                <X size={16} color={colors.neutral[400]} />
              </Pressable>
            ) : null}
          </View>

          {results.length > 0 && (
            <View style={styles.results}>
              {results.map((r) => (
                <Pressable key={r.id} style={styles.resultRow} onPress={() => void chooseResult(r)}>
                  <MapPin size={15} color={colors.neutral[400]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.resultMain} numberOfLines={1}>{r.main}</Text>
                    {r.secondary ? <Text style={styles.resultSecondary} numberOfLines={1}>{r.secondary}</Text> : null}
                  </View>
                </Pressable>
              ))}
            </View>
          )}
          {searched && !searching && results.length === 0 && (
            <Text style={styles.noResults}>No matching locations found.</Text>
          )}

          <View style={styles.locationActions}>
            <Pressable style={styles.secondaryBtn} onPress={() => void locateMe()} disabled={locating}>
              {locating ? (
                <ActivityIndicator size="small" color={colors.brand[700]} />
              ) : (
                <LocateFixed size={15} color={colors.brand[700]} />
              )}
              <Text style={styles.secondaryBtnText}>My location</Text>
            </Pressable>
            <Pressable style={styles.secondaryBtn} onPress={openMap}>
              <Navigation size={15} color={colors.brand[700]} />
              <Text style={styles.secondaryBtnText}>{locationPicked ? 'Change on map' : 'Pick on map'}</Text>
            </Pressable>
          </View>

          {locationPicked && form.latitude != null && form.longitude != null && (
            <Text style={styles.coordsText}>
              {form.latitude.toFixed(5)}, {form.longitude.toFixed(5)}
            </Text>
          )}
        </View>

        <Text style={styles.fieldLabel}>Address / House no., Building</Text>
        <TextInput
          value={form.address_line_1}
          onChangeText={(v) => setForm((f) => ({ ...f, address_line_1: v }))}
          placeholder="House no, building, street"
          placeholderTextColor={colors.neutral[400]}
          style={[styles.input, styles.inputMultiline]}
          multiline
        />

        <Text style={styles.fieldLabel}>Landmark</Text>
        <TextInput
          value={form.address_line_2}
          onChangeText={(v) => setForm((f) => ({ ...f, address_line_2: v }))}
          placeholder="Nearby landmark (optional)"
          placeholderTextColor={colors.neutral[400]}
          style={styles.input}
        />

        <View style={styles.row2}>
          <View style={styles.row2Col}>
            <Text style={styles.fieldLabel}>City</Text>
            <TextInput
              value={form.city}
              onChangeText={(v) => setForm((f) => ({ ...f, city: v }))}
              placeholder="City"
              placeholderTextColor={colors.neutral[400]}
              style={styles.input}
            />
          </View>
          <View style={styles.row2Col}>
            <Text style={styles.fieldLabel}>State</Text>
            <TextInput
              value={form.state}
              onChangeText={(v) => setForm((f) => ({ ...f, state: v }))}
              placeholder="State"
              placeholderTextColor={colors.neutral[400]}
              style={styles.input}
            />
          </View>
        </View>

        <View style={styles.row2}>
          <View style={styles.row2Col}>
            <Text style={styles.fieldLabel}>Postal code</Text>
            <TextInput
              value={form.postal_code}
              onChangeText={(v) => setForm((f) => ({ ...f, postal_code: v }))}
              placeholder="PIN"
              placeholderTextColor={colors.neutral[400]}
              style={styles.input}
              keyboardType="number-pad"
            />
          </View>
          <View style={styles.row2Col}>
            <Text style={styles.fieldLabel}>Country</Text>
            <TextInput
              value={form.country}
              onChangeText={(v) => setForm((f) => ({ ...f, country: v }))}
              placeholder="Country"
              placeholderTextColor={colors.neutral[400]}
              style={styles.input}
            />
          </View>
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 10,
    paddingBottom: 8,
  },
  labelRow: {
    flexDirection: 'row',
    gap: 8,
  },
  labelChip: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    alignItems: 'center',
    paddingVertical: 9,
  },
  labelChipActive: {
    borderColor: colors.brand[600],
    backgroundColor: colors.brand[50],
  },
  labelChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.neutral[500],
  },
  labelChipTextActive: {
    color: colors.brand[700],
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.neutral[500],
    marginTop: 2,
  },
  input: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.ink[900],
    minHeight: 44,
  },
  inputMultiline: {
    minHeight: 64,
    textAlignVertical: 'top',
  },
  row2: {
    flexDirection: 'row',
    gap: 10,
  },
  row2Col: {
    flex: 1,
  },
  locationCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    padding: 12,
    gap: 10,
    backgroundColor: colors.ink[50],
  },
  locationHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  locationTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
    color: colors.neutral[500],
  },
  locationSet: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.success,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    minHeight: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.ink[900],
    paddingVertical: 10,
  },
  results: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  resultMain: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.ink[900],
  },
  resultSecondary: {
    fontSize: 12,
    color: colors.neutral[500],
    marginTop: 1,
  },
  noResults: {
    fontSize: 12.5,
    color: colors.neutral[500],
  },
  locationActions: {
    flexDirection: 'row',
    gap: 8,
  },
  secondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.brand[200],
    backgroundColor: colors.brand[50],
    paddingVertical: 11,
  },
  secondaryBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.brand[700],
  },
  coordsText: {
    fontSize: 11,
    color: colors.neutral[500],
    fontVariant: ['tabular-nums'],
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 999,
    backgroundColor: colors.ink[900],
    paddingVertical: 14,
    marginBottom: 4,
  },
  primaryBtnDisabled: {
    opacity: 0.5,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
  },
});
