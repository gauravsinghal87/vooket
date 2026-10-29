import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname, useRouter } from 'expo-router';
import {
  ArrowLeft,
  Briefcase,
  ChevronDown,
  ChevronRight,
  Crosshair,
  House,
  LocateFixed,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Search,
  Share2,
  X,
} from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { repositories } from '@/api/repositories';
import { AddAddressFlow } from '@/components/address/AddAddressFlow';
import { useAppStore } from '@/stores/appStore';
import { useAuthStore } from '@/stores/authStore';
import { currentLocation, DEFAULT_LOCATION, POPULAR_AREAS, locationFromAddress } from '@/lib/location';
import { formatDistanceKm, haversineKm } from '@/lib/geo';
import type { Address, Location } from '@/types/catalog';
import { activeService, colors } from '@/theme';

interface LocationSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelected?: (location: Location) => void;
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

/** Local history of the addresses this picker has placed — the grocery screen
 *  lists it as "Recently searched locations". Read fresh every time the sheet
 *  opens so a pick made a moment ago is already there next time. */
async function readRecentLocations(): Promise<RecentLocation[]> {
  try {
    const raw = await AsyncStorage.getItem(RECENT_LOCATIONS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as RecentLocation[]) : [];
  } catch {
    return [];
  }
}

async function rememberLocation(loc: Location) {
  try {
    const entry: RecentLocation = {
      label: loc.label,
      address: loc.address,
      latitude: loc.latitude,
      longitude: loc.longitude,
      place_id: loc.place_id ?? null,
      formatted_address: loc.formatted_address ?? null,
    };
    const current = await readRecentLocations();
    const next = [entry, ...current.filter((r) => r.address !== entry.address)].slice(0, 5);
    await AsyncStorage.setItem(RECENT_LOCATIONS_KEY, JSON.stringify(next));
  } catch {
    // History is a convenience — never let storage failures break a pick.
  }
}

/**
 * The reference's full-screen location picker ("Select a location"): a search
 * field over the Use current location / Add Address actions, then the saved
 * address and popular area cards. The search filters both lists locally.
 */
export function LocationSelector({ open, onOpenChange, onSelected }: LocationSelectorProps) {
  const insets = useSafeAreaInsets();
  // 'list' is the picker itself; the two add modes are the module-specific
  // add-address screens (Food: delivery-details sheet, Grocery: map →
  // complete-address sheet), opened in place instead of the profile's
  // "My addresses" page.
  const [mode, setMode] = useState<'list' | 'foodAdd' | 'groceryAdd'>('list');
  const [query, setQuery] = useState('');
  const setLocation = useAppStore((s) => s.setLocation);
  const locationState = useAppStore((s) => s.location);
  const openContext = useAppStore((s) => s.locationSelectorContext);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const activeLoc = locationState ?? DEFAULT_LOCATION;

  // The route decides which module owns this sheet — the same resolution the
  // header and search bar use — falling back to the persisted module for routes
  // that name none. So `/grocery` and `/store/:id` get the grocery address
  // screen, `/rides*` the rides flow, and everything else the Food screen it
  // has always had.
  const pathname = usePathname();
  const router = useRouter();
  const storedService = useAppStore((s) => s.service);
  const service = activeService(pathname) ?? storedService;
  const isGrocery = service === 'grocery';

  // Rides never shows this sheet: its location control jumps straight into the
  // destination flow, which is where rides locations are chosen.
  useEffect(() => {
    if (!open || service !== 'rides') return;
    onOpenChange(false);
    router.push('/rides/destination?field=drop' as never);
  }, [open, service, router, onOpenChange]);

  // Opened from the cart's "Choose address", the customer is here to add the
  // delivery address rather than browse the picker, so the sheet starts on the
  // module's add-address screen — and it always returns to the plain list the
  // next time it closes, so no other screen inherits that starting point.
  useEffect(() => {
    if (open) {
      if (openContext === 'food-cart') setMode('foodAdd');
      return;
    }
    setMode('list');
  }, [open, openContext]);

  const [recentLocations, setRecentLocations] = useState<RecentLocation[]>([]);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    readRecentLocations()
      .then((list) => {
        if (alive) setRecentLocations(list);
      })
      .catch(() => undefined);
    AsyncStorage.getItem(SHARE_BANNER_KEY)
      .then((value) => {
        if (alive) setBannerDismissed(value === '1');
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [open]);

  const { data: addresses, isLoading } = useQuery({
    queryKey: ['addresses'],
    queryFn: () => repositories.user.getAddresses(),
    enabled: open && isAuthenticated,
  });

  const pick = (loc: Location, addressId: number | null = null) => {
    void rememberLocation(loc);
    // The header location and the module cart's delivery address are the same
    // choice, so the saved address behind the pick travels with it — that is
    // what keeps the cart's "to …" line in step with what was chosen here.
    setLocation(loc, addressId);
    onSelected?.(loc);
    setQuery('');
    onOpenChange(false);
  };

  /** Same mapping the saved-address card performs, shared with the grocery card. */
  const pickAddress = (a: Address) => pick(locationFromAddress(a), a.id);

  const shareAddress = (label: string, address: string) => {
    void Share.share({ message: `${label}: ${address}` }).catch(() => undefined);
  };

  // Grocery's two extra address actions. Both hand off to the external service —
  // the app has no address-import API of its own.
  const requestAddressFromSomeone = () => {
    void Share.share({ message: REQUEST_ADDRESS_MESSAGE }).catch(() => undefined);
  };

  const importFromZomato = () => {
    void Linking.openURL('https://www.zomato.com').catch(() => undefined);
  };

  const dismissShareBanner = () => {
    setBannerDismissed(true);
    AsyncStorage.setItem(SHARE_BANNER_KEY, '1').catch(() => undefined);
  };

  const useGps = async () => {
    const res = await currentLocation();
    if (res.ok && res.location) pick(res.location);
  };

  const q = query.trim().toLowerCase();
  const match = (haystack: string) => haystack.toLowerCase().includes(q);

  const saved = (addresses ?? []).filter(
    (a) =>
      !q ||
      match(a.label) ||
      match(`${a.address_line_1}${a.address_line_2 ? `, ${a.address_line_2}` : ''}`)
  );
  const areas = POPULAR_AREAS.filter((a) => !q || match(a.label) || match(a.address));
  const nothing = saved.length === 0 && areas.length === 0;

  return (
    <Modal
      visible={open}
      animationType="slide"
      onRequestClose={() => onOpenChange(false)}
      statusBarTranslucent
    >
      <View
        style={[
          styles.root,
          { paddingTop: insets.top, backgroundColor: isGrocery ? '#f4f5fa' : colors.ink[50] },
        ]}
      >
        {mode === 'list' ? (
          <>
        <View style={styles.header}>
          <Pressable
            onPress={() => onOpenChange(false)}
            hitSlop={10}
            style={styles.headerBtn}
            accessibilityLabel="Close"
          >
            <ChevronDown size={26} color={colors.ink[900]} />
          </Pressable>
          <Text style={styles.headerTitle}>Select a location</Text>
        </View>

        <View style={styles.searchCard}>
          <Search size={18} color={colors.food[600]} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search for area, street name..."
            placeholderTextColor={colors.neutral[400]}
            style={styles.searchInput}
            autoCorrect={false}
            returnKeyType="search"
          />
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {isGrocery ? (
            <>
              {/* Grocery's address screen: the same actions as Food but
                  presented as four separate cards on the grey-violet surface. */}
              <View style={styles.gActions}>
                <Pressable style={styles.gActionCard} onPress={useGps} accessibilityLabel="Use current location">
                  <View style={styles.gActionIcon}>
                    <LocateFixed size={18} color={colors.success} />
                  </View>
                  <View style={styles.gActionBody}>
                    <Text style={styles.gActionLabelGreen}>Use current location</Text>
                    <Text numberOfLines={1} style={styles.gActionSub}>
                      {activeLoc.address}
                    </Text>
                  </View>
                  <ChevronRight size={18} color={colors.neutral[300]} />
                </Pressable>

                <Pressable
                  style={styles.gActionCard}
                  onPress={() => setMode('groceryAdd')}
                  accessibilityLabel="Add new address"
                >
                  <View style={styles.gActionIcon}>
                    <Plus size={18} color={colors.success} />
                  </View>
                  <View style={styles.gActionBody}>
                    <Text style={styles.gActionLabelGreen}>Add new address</Text>
                  </View>
                  <ChevronRight size={18} color={colors.neutral[300]} />
                </Pressable>

                <Pressable
                  style={styles.gActionCard}
                  onPress={requestAddressFromSomeone}
                  accessibilityLabel="Request address from someone else"
                >
                  <View style={styles.gActionIcon}>
                    <MessageCircle size={18} color={colors.success} />
                  </View>
                  <View style={styles.gActionBody}>
                    <Text style={styles.gActionLabel}>Request address from someone else</Text>
                  </View>
                  <ChevronRight size={18} color={colors.neutral[300]} />
                </Pressable>

                <Pressable
                  style={styles.gActionCard}
                  onPress={importFromZomato}
                  accessibilityLabel="Import your addresses from Zomato"
                >
                  <View style={styles.gZomatoChip}>
                    <Text style={styles.gZomatoText}>Z</Text>
                  </View>
                  <View style={styles.gActionBody}>
                    <Text style={styles.gActionLabel}>Import your addresses from Zomato</Text>
                  </View>
                  <ChevronRight size={18} color={colors.neutral[300]} />
                </Pressable>
              </View>

              {/* Saved addresses: small left-aligned label, then one card each
                  with the gold icon chip, green distance, phone and share row —
                  plus the share nudge on the first card. */}
              {isAuthenticated && (
                <View style={styles.gSection}>
                  <Text style={styles.gSectionTitle}>Your saved addresses</Text>
                  {isLoading ? (
                    <ActivityIndicator style={{ marginVertical: 16 }} color={colors.neutral[400]} />
                  ) : saved.length === 0 ? (
                    <Text style={styles.empty}>
                      {q ? `No saved addresses match "${query.trim()}"` : 'No saved addresses yet'}
                    </Text>
                  ) : (
                    saved.map((a: Address, i: number) => {
                      const km = haversineKm(activeLoc, {
                        latitude: a.latitude,
                        longitude: a.longitude,
                      });
                      const distance = formatDistanceKm(km);
                      const Icon = /work/i.test(a.label)
                        ? Briefcase
                        : /home/i.test(a.label)
                          ? House
                          : MapPin;
                      const address = `${a.address_line_1}${a.address_line_2 ? `, ${a.address_line_2}` : ''}`;
                      return (
                        <Pressable key={a.id} style={styles.gAddrCard} onPress={() => pickAddress(a)}>
                          <View style={styles.gAddrChip}>
                            <Icon size={18} color={colors.grocery[700]} />
                          </View>
                          <View style={styles.gAddrBody}>
                            <View style={styles.gAddrTitleRow}>
                              <Text style={styles.gAddrLabel}>{a.label}</Text>
                              {distance ? <Text style={styles.gAddrDistance}>{distance} away</Text> : null}
                            </View>
                            <Text numberOfLines={2} style={styles.gAddrLine}>
                              {address}
                            </Text>
                            {a.contact_phone ? (
                              <Text style={styles.gAddrPhone}>Phone number: {a.contact_phone}</Text>
                            ) : null}

                            <View style={styles.gAddrActions}>
                              <Pressable
                                style={styles.gIconBtn}
                                onPress={() => {
                                  onOpenChange(false);
                                  router.push('/grocery/profile/addresses' as never);
                                }}
                                accessibilityLabel={`Manage ${a.label}`}
                              >
                                <MoreHorizontal size={16} color={colors.success} />
                              </Pressable>
                              <Pressable
                                style={styles.gIconBtn}
                                onPress={() => shareAddress(a.label, address)}
                                accessibilityLabel={`Share ${a.label}`}
                              >
                                <Share2 size={16} color={colors.success} />
                              </Pressable>
                            </View>

                            {i === 0 && !bannerDismissed && (
                              <View style={styles.gBanner}>
                                <View style={styles.gBannerIcon}>
                                  <Share2 size={13} color={colors.grocery[700]} />
                                </View>
                                <Text numberOfLines={2} style={styles.gBannerText}>
                                  Now share your addresses with friends and family
                                </Text>
                                <Pressable
                                  style={styles.gBannerClose}
                                  onPress={dismissShareBanner}
                                  accessibilityLabel="Dismiss"
                                >
                                  <X size={13} color="#fff" />
                                </Pressable>
                              </View>
                            )}
                          </View>
                        </Pressable>
                      );
                    })
                  )}
                </View>
              )}

              {recentLocations.length > 0 && (
                <View style={styles.gSection}>
                  <Text style={styles.gSectionTitle}>Recently searched locations</Text>
                  {recentLocations.map((r, idx) => (
                    <Pressable
                      key={`${idx}-${r.address}`}
                      style={styles.gAddrCard}
                      onPress={() => pick(r)}
                    >
                      <View style={styles.gAddrChip}>
                        <MapPin size={18} color={colors.grocery[700]} />
                      </View>
                      <View style={styles.gAddrBody}>
                        <Text style={styles.gAddrLabel}>{r.label}</Text>
                        <Text numberOfLines={2} style={styles.gAddrLine}>
                          {r.address}
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              )}
            </>
          ) : (
            <>
          <View style={styles.card}>
            <Pressable style={styles.actionRow} onPress={useGps} accessibilityLabel="Use current location">
              <Crosshair size={20} color={colors.food[600]} />
              <View style={styles.actionBody}>
                <Text style={styles.actionLabel}>Use current location</Text>
                <Text numberOfLines={1} style={styles.actionSub}>
                  {activeLoc.address}
                </Text>
              </View>
              <ChevronRight size={18} color={colors.neutral[400]} />
            </Pressable>
            <View style={styles.rowDivider} />
            <Pressable
              style={styles.actionRow}
              onPress={() => setMode('foodAdd')}
              accessibilityLabel="Add address"
            >
              <Plus size={20} color={colors.food[600]} />
              <View style={styles.actionBody}>
                <Text style={styles.actionLabel}>Add Address</Text>
              </View>
              <ChevronRight size={18} color={colors.neutral[400]} />
            </Pressable>
          </View>

          {isAuthenticated && (
            <>
              <View style={styles.sectionLabel}>
                <View style={styles.sectionLine} />
                <Text style={styles.sectionText}>SAVED ADDRESSES</Text>
                <View style={styles.sectionLine} />
              </View>

              {isLoading ? (
                <ActivityIndicator style={{ marginVertical: 16 }} color={colors.neutral[400]} />
              ) : saved.length === 0 ? (
                <Text style={styles.empty}>
                  {q ? `No saved addresses match "${query.trim()}"` : 'No saved addresses yet'}
                </Text>
              ) : (
                saved.map((a: Address) => (
                  <Pressable
                    key={a.id}
                    style={styles.addrCard}
                    onPress={() => pickAddress(a)}
                  >
                    <View style={styles.addrIcon}>
                      {/home/i.test(a.label) ? (
                        <House size={18} color={colors.ink[700]} />
                      ) : (
                        <MapPin size={18} color={colors.ink[700]} />
                      )}
                    </View>
                    <View style={styles.addrBody}>
                      <Text style={styles.addrLabel}>{a.label}</Text>
                      <Text numberOfLines={2} style={styles.addrLine}>
                        {a.address_line_1}
                        {a.address_line_2 ? `, ${a.address_line_2}` : ''}
                      </Text>
                      {a.contact_phone ? (
                        <Text style={styles.addrPhone}>Phone number: {a.contact_phone}</Text>
                      ) : null}
                    </View>
                    <ChevronRight size={18} color={colors.neutral[400]} />
                  </Pressable>
                ))
              )}
            </>
          )}

            </>
          )}

          <View style={styles.sectionLabel}>
            <View style={styles.sectionLine} />
            <Text style={styles.sectionText}>POPULAR AREAS</Text>
            <View style={styles.sectionLine} />
          </View>

          {areas.map((area) => (
            <Pressable key={area.label} style={styles.addrCard} onPress={() => pick(area)}>
              <View style={styles.addrIcon}>
                <MapPin size={18} color={colors.ink[700]} />
              </View>
              <View style={styles.addrBody}>
                <Text style={styles.addrLabel}>{area.label}</Text>
                <Text numberOfLines={2} style={styles.addrLine}>
                  {area.address}
                </Text>
              </View>
              <ChevronRight size={18} color={colors.neutral[400]} />
            </Pressable>
          ))}

          {nothing && (
            <Text style={styles.empty}>{`No areas match “${query.trim()}”`}</Text>
          )}
        </ScrollView>
          </>
        ) : (
          <>
            <View style={styles.header}>
              <Pressable
                onPress={() => setMode('list')}
                hitSlop={10}
                style={styles.headerBtn}
                accessibilityLabel="Back"
              >
                <ArrowLeft size={24} color={colors.ink[900]} />
              </Pressable>
              <Text style={styles.headerTitle}>
                {mode === 'foodAdd' ? 'Select delivery location' : 'Add address'}
              </Text>
            </View>
            <AddAddressFlow
              module={mode === 'foodAdd' ? 'food' : 'grocery'}
              initialLatitude={activeLoc.latitude}
              initialLongitude={activeLoc.longitude}
              onBack={() => setMode('list')}
              onDone={(saved) => {
                // Saved from the cart's "Choose address": make it the delivery
                // address immediately — `pick` writes it to the header, and the
                // cart follows it through `useSyncCartAddress`.
                if (openContext === 'food-cart') {
                  pick(locationFromAddress(saved), saved.id);
                  return;
                }
                setMode('list');
              }}
            />
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.ink[50],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 22,
    color: colors.ink[900],
  },
  searchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 14,
    paddingHorizontal: 14,
    height: 50,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.ink[900],
    padding: 0,
  },
  scroll: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 12,
  },
  card: {
    borderRadius: 16,
    backgroundColor: '#fff',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  actionBody: {
    flex: 1,
  },
  actionLabel: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 16,
    color: colors.food[600],
  },
  actionSub: {
    marginTop: 3,
    fontFamily: 'Outfit_400Regular',
    fontSize: 13,
    color: colors.neutral[500],
  },
  rowDivider: {
    height: 1,
    backgroundColor: colors.ink[50],
    marginLeft: 50,
  },
  sectionLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 10,
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.neutral[200],
  },
  sectionText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 12,
    letterSpacing: 2,
    color: colors.neutral[500],
  },
  addrCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 16,
    backgroundColor: '#fff',
    padding: 16,
  },
  addrIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.ink[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  addrBody: {
    flex: 1,
  },
  addrLabel: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 15,
    color: colors.ink[900],
  },
  addrLine: {
    marginTop: 3,
    fontFamily: 'Outfit_400Regular',
    fontSize: 13.5,
    lineHeight: 19,
    color: colors.neutral[700],
  },
  addrPhone: {
    marginTop: 6,
    fontFamily: 'Outfit_400Regular',
    fontSize: 12.5,
    color: colors.neutral[500],
  },
  empty: {
    textAlign: 'center',
    paddingVertical: 18,
    fontFamily: 'Outfit_500Medium',
    fontSize: 14,
    color: colors.neutral[500],
  },
  /* ------------------------------------------------------------------ */
  /* Grocery address screen: four separate action cards on the           */
  /* grey-violet surface, gold icon chips, green accents.                */
  /* ------------------------------------------------------------------ */
  gActions: {
    gap: 10,
  },
  gActionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    shadowColor: 'rgb(16 14 10)',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  gActionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(22, 163, 74, 0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gActionBody: {
    flex: 1,
    minWidth: 0,
  },
  gActionLabelGreen: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 15,
    color: colors.success,
  },
  gActionLabel: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 15,
    color: colors.ink[900],
  },
  gActionSub: {
    marginTop: 3,
    fontFamily: 'Outfit_400Regular',
    fontSize: 13,
    color: colors.neutral[500],
  },
  gZomatoChip: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.food[600],
    alignItems: 'center',
    justifyContent: 'center',
  },
  gZomatoText: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 15,
    color: '#fff',
  },
  gSection: {
    gap: 10,
  },
  gSectionTitle: {
    marginTop: 4,
    fontFamily: 'Outfit_400Regular',
    fontSize: 13,
    color: colors.neutral[500],
  },
  gAddrCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    shadowColor: 'rgb(16 14 10)',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  gAddrChip: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.grocery[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  gAddrBody: {
    flex: 1,
    minWidth: 0,
  },
  gAddrTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  gAddrLabel: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 15,
    color: colors.ink[900],
  },
  gAddrDistance: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 12,
    color: colors.success,
  },
  gAddrLine: {
    marginTop: 3,
    fontFamily: 'Outfit_400Regular',
    fontSize: 13,
    lineHeight: 18,
    color: colors.neutral[700],
  },
  gAddrPhone: {
    marginTop: 5,
    fontFamily: 'Outfit_400Regular',
    fontSize: 12.5,
    color: colors.neutral[500],
  },
  gAddrActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  gIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    alignItems: 'center',
    justifyContent: 'center',
  },
  gBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    backgroundColor: '#fdf3dd',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  gBannerIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gBannerText: {
    flex: 1,
    minWidth: 0,
    fontFamily: 'Outfit_400Regular',
    fontSize: 12.5,
    color: colors.ink[700],
  },
  gBannerClose: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#e9a23b',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
