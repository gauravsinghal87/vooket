import { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronDown, ChevronRight, Crosshair, House, MapPin, Plus, Search } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { repositories } from '@/api/repositories';
import { AddAddressSheet } from '@/components/address/AddAddressSheet';
import { useAppStore } from '@/stores/appStore';
import { useAuthStore } from '@/stores/authStore';
import { currentLocation, DEFAULT_LOCATION, POPULAR_AREAS } from '@/lib/location';
import type { Address, Location } from '@/types/catalog';
import { colors } from '@/theme';

interface LocationSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelected?: (location: Location) => void;
}

/**
 * The reference's full-screen location picker ("Select a location"): a search
 * field over the Use current location / Add Address actions, then the saved
 * address and popular area cards. The search filters both lists locally.
 */
export function LocationSelector({ open, onOpenChange, onSelected }: LocationSelectorProps) {
  const insets = useSafeAreaInsets();
  const [addOpen, setAddOpen] = useState(false);
  const [query, setQuery] = useState('');
  const setLocation = useAppStore((s) => s.setLocation);
  const locationState = useAppStore((s) => s.location);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const activeLoc = locationState ?? DEFAULT_LOCATION;

  const { data: addresses, isLoading } = useQuery({
    queryKey: ['addresses'],
    queryFn: () => repositories.user.getAddresses(),
    enabled: open && isAuthenticated,
  });

  const pick = (loc: Location) => {
    setLocation(loc);
    onSelected?.(loc);
    setQuery('');
    onOpenChange(false);
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
      <View style={[styles.root, { paddingTop: insets.top }]}>
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
              onPress={() => {
                onOpenChange(false);
                setAddOpen(true);
              }}
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
                    onPress={() =>
                      pick({
                        label: a.label,
                        address: `${a.address_line_1}${a.address_line_2 ? `, ${a.address_line_2}` : ''}`,
                        latitude: parseFloat(String(a.latitude ?? 0)) || activeLoc.latitude,
                        longitude: parseFloat(String(a.longitude ?? 0)) || activeLoc.longitude,
                        place_id: a.place_id,
                        formatted_address: a.formatted_address,
                      })
                    }
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
      </View>

      <AddAddressSheet visible={addOpen} onClose={() => setAddOpen(false)} />
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
});
