import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, LocateFixed, MapPin, Search, X } from 'lucide-react-native';
import { repositories } from '@/shared/repositories';
import { currentLocation } from '@/shared/utils/location';
import { toast } from '@/shared/stores/toastStore';
import { colors } from '@/shared/theme';
import type { Address } from '@/shared/types/catalog';
import type { PlaceResult, ReverseGeocode } from '@/shared/types/models';

type Module = 'food' | 'grocery';
type Label = 'Home' | 'Work' | 'Hotel' | 'Other';

const FOOD_LABELS: Label[] = ['Home', 'Work', 'Other'];
const GROCERY_LABELS: Label[] = ['Home', 'Work', 'Hotel', 'Other'];
const DEFAULT_REGION = { latitude: 28.6139, longitude: 77.209, latitudeDelta: 0.02, longitudeDelta: 0.02 };

interface PickedPlace {
  address: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  place_id: string | null;
  formatted_address: string | null;
}

interface Props {
  module: Module;
  initialLatitude?: number;
  initialLongitude?: number;
  /** Leave the flow and return to the picker's list. */
  onBack: () => void;
  /**
   * Called after a successful save with the address that was just created, so
   * the picker can show it — and, when the cart asked for it, make it the
   * delivery address straight away.
   */
  onDone: (address: Address) => void;
}

/**
 * The module-specific add-address screen, opened from inside the location
 * picker (never from the profile's "My addresses" page):
 *
 * - Food: map on top, then the delivery details / receiver / label sheet — the
 *   reference's "Select delivery location" layout.
 * - Grocery: map + "Delivering your order to" first; "Add more address details"
 *   opens the "Enter complete address" sheet.
 *
 * Both share one form, one reverse-geocode path and one save mutation, so the
 * two screens can never disagree about what gets stored.
 */
export function AddAddressFlow({ module, initialLatitude, initialLongitude, onBack, onDone }: Props) {
  const queryClient = useQueryClient();
  const grocery = module === 'grocery';

  const [step, setStep] = useState<'map' | 'details'>('map');
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(
    initialLatitude != null && initialLongitude != null
      ? { latitude: initialLatitude, longitude: initialLongitude }
      : null
  );
  const [place, setPlace] = useState<PickedPlace | null>(null);
  const [label, setLabel] = useState<Label>('Home');
  const [orderingFor, setOrderingFor] = useState<'myself' | 'someone'>('myself');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [landmark, setLandmark] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [locating, setLocating] = useState(false);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRef = useRef<TextInput>(null);

  const accent = grocery ? colors.success : colors.food[600];

  /** Reverse-geocode a point and publish it to the sheet. */
  const resolveAt = async (latitude: number, longitude: number) => {
    setCoords({ latitude, longitude });
    try {
      const r: ReverseGeocode = await repositories.user.reverseGeocode(latitude, longitude);
      setPlace({
        address: r.formatted_address ?? r.address,
        city: r.city ?? '',
        state: r.state ?? '',
        postal_code: r.postal_code ?? '',
        country: r.country || 'India',
        place_id: null,
        formatted_address: r.formatted_address ?? r.address,
      });
    } catch {
      // Coordinates are enough to keep going; the fields stay editable.
      setPlace((p) => p ?? null);
    }
  };

  // Open the map on the customer's current area and resolve it once.
  useEffect(() => {
    let alive = true;
    if (coords) {
      void (async () => {
        try {
          const r: ReverseGeocode = await repositories.user.reverseGeocode(coords.latitude, coords.longitude);
          if (!alive) return;
          setPlace({
            address: r.formatted_address ?? r.address,
            city: r.city ?? '',
            state: r.state ?? '',
            postal_code: r.postal_code ?? '',
            country: r.country || 'India',
            place_id: null,
            formatted_address: r.formatted_address ?? r.address,
          });
        } catch {
          /* map still usable without the label */
        }
      })();
    }
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

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
    let latitude = result.latitude;
    let longitude = result.longitude;
    let city = result.city ?? '';
    let state = result.state ?? '';
    let postal = result.postal_code ?? '';
    let country = result.country ?? '';
    let placeId = result.place_id ?? result.id;
    let formatted = result.formatted_address ?? result.text;
    try {
      const details = await repositories.user.placeDetails(result.id);
      if (details.latitude != null && details.longitude != null) {
        latitude = details.latitude;
        longitude = details.longitude;
        city = details.city ?? city;
        state = details.state ?? state;
        postal = details.postal_code ?? postal;
        country = details.country ?? country;
        placeId = details.place_id ?? placeId;
        formatted = details.formatted_address ?? details.address ?? formatted;
      }
    } catch {
      // The search result already carries what we need.
    }
    if (latitude == null || longitude == null) {
      toast('Could not resolve that location. Try another.', 'error');
      return;
    }
    setCoords({ latitude, longitude });
    setPlace({
      address: formatted,
      city,
      state,
      postal_code: postal,
      country: country || 'India',
      place_id: placeId ?? null,
      formatted_address: formatted,
    });
  };

  const handleUseGps = async () => {
    setLocating(true);
    const res = await currentLocation();
    setLocating(false);
    if (!res.ok || !res.location) {
      toast(res.error ?? 'Could not get your location.', 'error');
      return;
    }
    await resolveAt(res.location.latitude, res.location.longitude);
  };

  const city = place?.city ?? '';
  const valid = coords != null && addressLine1.trim().length > 0 && city.trim().length > 0;

  const save = useMutation({
    mutationFn: () => {
      if (!coords) throw new Error('Please pick your location on the map first.');
      if (!addressLine1.trim()) throw new Error('Please enter your address.');
      if (!city.trim()) throw new Error('Please select a location so the city can be filled.');
      const payload: Partial<Address> = {
        label,
        contact_name: contactName.trim() || null,
        contact_phone: contactPhone.trim() || null,
        address_line_1: addressLine1.trim(),
        address_line_2: addressLine2.trim() || null,
        landmark: landmark.trim() || null,
        city: city.trim(),
        state: place?.state || null,
        postal_code: place?.postal_code || null,
        country: place?.country || 'India',
        latitude: String(coords.latitude),
        longitude: String(coords.longitude),
        place_id: place?.place_id ?? null,
        formatted_address: place?.formatted_address ?? null,
      };
      return repositories.user.createAddress(payload);
    },
    onSuccess: (saved: Address) => {
      queryClient.invalidateQueries({ queryKey: ['addresses'] });
      toast('Address added');
      onDone(saved);
    },
    onError: (err) => toast(err instanceof Error ? err.message : "Couldn't save address", 'error'),
  });

  const labels = grocery ? GROCERY_LABELS : FOOD_LABELS;
  const [placeHead, placeRest] = (place?.address ?? '').split(',');
  const areaText = place?.address || 'Area / Sector / Locality';

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Search sits above the map, as in both references. */}
      <View style={styles.searchWrap}>
        <Search size={17} color={colors.neutral[400]} />
        <TextInput
          ref={searchRef}
          value={query}
          onChangeText={onQueryChange}
          placeholder={grocery ? 'Search for a new area, locality...' : 'Search for area, street name...'}
          placeholderTextColor={colors.neutral[400]}
          style={styles.searchInput}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {searching ? (
          <ActivityIndicator size="small" color={colors.neutral[400]} />
        ) : query ? (
          <Pressable
            hitSlop={8}
            onPress={() => {
              setQuery('');
              setResults([]);
              setSearched(false);
            }}
            accessibilityLabel="Clear search"
          >
            <X size={16} color={colors.neutral[400]} />
          </Pressable>
        ) : null}

        {results.length > 0 && (
          <View style={styles.results}>
            {results.map((r) => (
              <Pressable key={r.id} style={styles.resultRow} onPress={() => void chooseResult(r)}>
                <MapPin size={15} color={colors.neutral[400]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.resultMain} numberOfLines={1}>
                    {r.main}
                  </Text>
                  {r.secondary ? (
                    <Text style={styles.resultSecondary} numberOfLines={1}>
                      {r.secondary}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            ))}
          </View>
        )}
        {searched && !searching && results.length === 0 ? (
          <View style={styles.results}>
            <Text style={styles.noResults}>No matching locations found.</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.mapWrap}>
        <MapView
          provider={PROVIDER_DEFAULT}
          style={styles.map}
          initialRegion={{
            latitude: coords?.latitude ?? DEFAULT_REGION.latitude,
            longitude: coords?.longitude ?? DEFAULT_REGION.longitude,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
          }}
          onPress={(e) => {
            const c = e.nativeEvent.coordinate;
            void resolveAt(c.latitude, c.longitude);
          }}
          showsUserLocation
        >
          {coords && <Marker coordinate={coords} pinColor={grocery ? colors.success : colors.food[600]} />}
        </MapView>

        <View style={styles.tooltip} pointerEvents="none">
          <Text style={styles.tooltipText} numberOfLines={1}>
            {grocery ? 'Move the pin to adjust your location' : 'Move pin to your exact delivery location'}
          </Text>
        </View>

        <Pressable
          style={[styles.gpsPill, { borderColor: accent }]}
          onPress={() => void handleUseGps()}
          disabled={locating}
          accessibilityLabel="Use current location"
        >
          {locating ? (
            <ActivityIndicator size="small" color={accent} />
          ) : (
            <LocateFixed size={15} color={accent} />
          )}
          <Text style={[styles.gpsPillText, { color: accent }]}>Use current location</Text>
        </Pressable>
      </View>

      {step === 'map' && !grocery ? (
        /* ---------------------------- FOOD SHEET ---------------------------- */
        <View style={styles.sheet}>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.handle} />
            <Text style={styles.sectionLabel}>Delivery details</Text>
            <View style={styles.placeRow}>
              <View style={[styles.placeIcon, { backgroundColor: `${colors.food[600]}1a` }]}>
                <MapPin size={16} color={colors.food[600]} />
              </View>
              <Text style={styles.placeText} numberOfLines={2}>
                {place?.address ?? 'Move the pin or use your current location'}
              </Text>
            </View>

            <TextInput
              value={addressLine1}
              onChangeText={setAddressLine1}
              placeholder="Address details*"
              placeholderTextColor={colors.neutral[400]}
              style={styles.input}
            />
            <Text style={styles.hint}>E.g. Floor, House no.</Text>

            <Text style={[styles.sectionLabel, { marginTop: 14 }]}>Receiver details for this address</Text>
            <View style={styles.row2}>
              <TextInput
                value={contactName}
                onChangeText={setContactName}
                placeholder="Contact name"
                placeholderTextColor={colors.neutral[400]}
                style={[styles.input, styles.row2Col]}
                autoCapitalize="words"
              />
              <TextInput
                value={contactPhone}
                onChangeText={setContactPhone}
                placeholder="Contact phone"
                placeholderTextColor={colors.neutral[400]}
                style={[styles.input, styles.row2Col]}
                keyboardType="phone-pad"
              />
            </View>

            <Text style={[styles.sectionLabel, { marginTop: 14 }]}>Save address as</Text>
            <View style={styles.pillRow}>
              {labels.map((l) => (
                <Pressable
                  key={l}
                  onPress={() => setLabel(l)}
                  style={[styles.pill, label === l && { borderColor: colors.food[600], backgroundColor: `${colors.food[600]}14` }]}
                >
                  <Text style={[styles.pillText, label === l && { color: colors.food[600] }]}>{l}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>

          <View style={styles.actionRow}>
            <Pressable style={styles.ghostBtn} onPress={() => void handleUseGps()} disabled={locating}>
              {locating ? (
                <ActivityIndicator size="small" color={colors.neutral[500]} />
              ) : (
                <LocateFixed size={15} color={colors.ink[700]} />
              )}
              <Text style={styles.ghostBtnText}>Use current location</Text>
            </Pressable>
            <Pressable
              style={[styles.primaryBtn, { backgroundColor: colors.food[600] }, !valid && styles.btnDisabled]}
              disabled={!valid || save.isPending}
              onPress={() => save.mutate()}
            >
              {save.isPending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.primaryBtnText}>Save address</Text>
              )}
            </Pressable>
          </View>
        </View>
      ) : step === 'map' ? (
        /* -------------------------- GROCERY STEP 1 -------------------------- */
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>Delivering your order to</Text>
          <View style={styles.placeRow}>
            <View style={[styles.placeIcon, { backgroundColor: `${colors.success}1a` }]}>
              <MapPin size={16} color={colors.success} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.placeHead} numberOfLines={1}>
                {placeHead || 'Move the pin to adjust your location'}
              </Text>
              <Text style={styles.placeSub} numberOfLines={1}>
                {placeRest?.trim() || place?.city || 'Search above or use your current location'}
              </Text>
            </View>
            <Pressable
              style={styles.changeBtn}
              onPress={() => searchRef.current?.focus()}
              accessibilityLabel="Change area"
            >
              <Text style={styles.changeBtnText}>Change</Text>
            </Pressable>
          </View>

          <Pressable
            style={[styles.primaryBtn, { backgroundColor: colors.success }, !coords && styles.btnDisabled]}
            disabled={!coords}
            onPress={() => setStep('details')}
          >
            <Text style={styles.primaryBtnText}>Add more address details</Text>
            <ChevronRight size={16} color="#fff" />
          </Pressable>

          <View style={styles.linkColumn}>
            <Pressable onPress={() => void handleUseGps()} disabled={locating}>
              <Text style={[styles.link, { color: colors.success }]}>
                {locating ? 'Locating…' : 'Use current location'}
              </Text>
            </Pressable>
            <Pressable onPress={() => setStep('details')}>
              <Text style={styles.linkDashed}>I don&apos;t know the exact location on map</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        /* -------------------------- GROCERY STEP 2 -------------------------- */
        <View style={[styles.sheet, styles.sheetTall]}>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.handle} />
            <View style={styles.sheetHeadRow}>
              <Text style={styles.sheetTitle}>Enter complete address</Text>
              <Pressable
                onPress={() => setStep('map')}
                style={styles.closeBtn}
                accessibilityLabel="Back to map"
              >
                <X size={16} color={colors.neutral[500]} />
              </Pressable>
            </View>

            <Text style={styles.sectionLabel}>Who you are ordering for?</Text>
            <View style={styles.radioRow}>
              {(
                [
                  ['myself', 'Myself'],
                  ['someone', 'Someone else'],
                ] as const
              ).map(([value, text]) => (
                <Pressable
                  key={value}
                  onPress={() => {
                    setOrderingFor(value);
                    if (value === 'myself') {
                      setContactName((n) => n);
                    } else {
                      setContactName('');
                      setContactPhone('');
                    }
                  }}
                  style={styles.radio}
                >
                  <View style={[styles.radioDot, orderingFor === value && styles.radioDotOn]}>
                    {orderingFor === value && <View style={styles.radioDotInner} />}
                  </View>
                  <Text style={styles.radioText}>{text}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={[styles.sectionLabel, { marginTop: 14 }]}>Save address as *</Text>
            <View style={styles.pillRow}>
              {labels.map((l) => (
                <Pressable
                  key={l}
                  onPress={() => setLabel(l)}
                  style={[styles.pill, label === l && { borderColor: colors.success, backgroundColor: `${colors.success}14` }]}
                >
                  <Text style={[styles.pillText, label === l && { color: colors.success }]}>{l}</Text>
                </Pressable>
              ))}
            </View>

            <TextInput
              value={addressLine1}
              onChangeText={setAddressLine1}
              placeholder="Flat / House no / Building name *"
              placeholderTextColor={colors.neutral[400]}
              style={[styles.input, { marginTop: 14 }]}
            />
            <TextInput
              value={addressLine2}
              onChangeText={setAddressLine2}
              placeholder="Floor (optional)"
              placeholderTextColor={colors.neutral[400]}
              style={styles.input}
            />
            <View style={styles.areaRow}>
              <Text style={styles.areaText} numberOfLines={1}>
                {areaText}
              </Text>
              <Pressable
                style={styles.changeBtn}
                onPress={() => setStep('map')}
                accessibilityLabel="Change area"
              >
                <Text style={styles.changeBtnText}>Change</Text>
              </Pressable>
            </View>
            <TextInput
              value={landmark}
              onChangeText={setLandmark}
              placeholder="Nearby landmark (optional)"
              placeholderTextColor={colors.neutral[400]}
              style={styles.input}
            />

            <Text style={[styles.sectionLabel, { marginTop: 14 }]}>
              Enter your details for seamless delivery experience
            </Text>
            <View style={styles.row2}>
              <TextInput
                value={contactName}
                onChangeText={setContactName}
                placeholder="Your name *"
                placeholderTextColor={colors.neutral[400]}
                style={[styles.input, styles.row2Col]}
                autoCapitalize="words"
              />
              <TextInput
                value={contactPhone}
                onChangeText={setContactPhone}
                placeholder="Your phone number (optional)"
                placeholderTextColor={colors.neutral[400]}
                style={[styles.input, styles.row2Col]}
                keyboardType="phone-pad"
              />
            </View>

            <Pressable
              style={[styles.primaryBtn, styles.saveWide, { backgroundColor: colors.success }, !valid && styles.btnDisabled]}
              disabled={!valid || save.isPending}
              onPress={() => save.mutate()}
            >
              {save.isPending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.primaryBtnText}>Save address</Text>
              )}
            </Pressable>
          </ScrollView>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  searchWrap: {
    marginHorizontal: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    minHeight: 46,
    zIndex: 5,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.ink[900],
    paddingVertical: 10,
  },
  results: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    backgroundColor: '#fff',
    overflow: 'hidden',
    zIndex: 10,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
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
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 12.5,
    color: colors.neutral[500],
  },
  mapWrap: {
    flex: 1,
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.ink[100],
  },
  map: {
    flex: 1,
  },
  tooltip: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    backgroundColor: 'rgba(23,20,15,0.92)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: '86%',
  },
  tooltipText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#fff',
  },
  gpsPill: {
    position: 'absolute',
    bottom: 14,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  gpsPillText: {
    fontSize: 13,
    fontWeight: '800',
  },
  sheet: {
    marginTop: 10,
    backgroundColor: '#fff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    maxHeight: '58%',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  sheetTall: {
    maxHeight: '64%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.neutral[200],
    marginBottom: 10,
  },
  sheetHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.ink[900],
    marginBottom: 8,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabel: {
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.neutral[500],
    marginBottom: 8,
  },
  placeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: 14,
    padding: 10,
    marginBottom: 10,
  },
  placeIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeText: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '600',
    color: colors.ink[900],
  },
  placeHead: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.ink[900],
  },
  placeSub: {
    fontSize: 12.5,
    color: colors.neutral[500],
    marginTop: 1,
  },
  input: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.ink[900],
    backgroundColor: '#fff',
    marginBottom: 8,
  },
  hint: {
    fontSize: 11.5,
    color: colors.neutral[500],
    marginBottom: 4,
  },
  row2: {
    flexDirection: 'row',
    gap: 8,
  },
  row2Col: {
    flex: 1,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    paddingHorizontal: 16,
    paddingVertical: 9,
    backgroundColor: '#fff',
  },
  pillText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.neutral[500],
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.ink[50],
  },
  ghostBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    paddingHorizontal: 12,
    paddingVertical: 13,
  },
  ghostBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink[800],
  },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 4,
  },
  saveWide: {
    marginTop: 16,
    marginBottom: 4,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
  },
  btnDisabled: {
    opacity: 0.45,
  },
  changeBtn: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.success,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  changeBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.success,
  },
  linkColumn: {
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  link: {
    fontSize: 13,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  linkDashed: {
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.ink[700],
    textDecorationLine: 'underline',
    textDecorationStyle: 'dashed',
  },
  radioRow: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 4,
  },
  radio: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  radioDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: colors.neutral[300],
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDotOn: {
    borderColor: colors.success,
  },
  radioDotInner: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.success,
  },
  radioText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: colors.ink[800],
  },
  areaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    backgroundColor: colors.ink[50],
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 8,
  },
  areaText: {
    flex: 1,
    fontSize: 13.5,
    color: colors.ink[800],
  },
});