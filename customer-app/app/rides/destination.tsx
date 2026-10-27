import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Clock, Heart, MapPin, Navigation, X } from 'lucide-react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { repositories } from '@/api/repositories';
import type { PlaceResult } from '@/types/models';
import { useRidesDraftStore } from '@/stores/ridesDraftStore';
import { useAuthStore } from '@/stores/authStore';
import { Screen } from '@/components/Screen';
import { toast } from '@/stores/toastStore';
import { colors } from '@/theme';

type Field = 'pickup' | 'drop';

interface RecentItem {
  id: string;
  label: string;
  address: string;
  latitude: number;
  longitude: number;
}

function normalizeCoords(v?: string | number | null): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : null;
}

function formatCoords(lat: number, lng: number): string {
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

export default function RidesDestinationScreen() {
  const { field } = useLocalSearchParams<{ field?: string }>();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const pickup = useRidesDraftStore((s) => s.pickup);
  const drop = useRidesDraftStore((s) => s.drop);
  const setPickup = useRidesDraftStore((s) => s.setPickup);
  const setDrop = useRidesDraftStore((s) => s.setDrop);
  const setPendingMode = useRidesDraftStore((s) => s.setPendingMode);

  const initialField: Field = field === 'pickup' ? 'pickup' : 'drop';
  const [activeField, setActiveField] = useState<Field>(initialField);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    setActiveField(initialField);
  }, [initialField]);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [activeField]);

  const savedPlaces = useQuery({
    queryKey: ['saved-places'],
    queryFn: () => repositories.rides.getSavedPlaces().catch(() => [] as any[]),
  });

  const rideHistory = useQuery({
    queryKey: ['ride-history'],
    queryFn: () => repositories.rides.getRideHistory().catch(() => [] as any[]),
  });

  const recentDestinations = useMemo<RecentItem[]>(() => {
    const rides = rideHistory.data ?? [];
    const seen = new Set<string>();
    const list: RecentItem[] = [];
    for (const r of rides) {
      const lat = normalizeCoords(r.destination_latitude);
      const lng = normalizeCoords(r.destination_longitude);
      const addr = (r.destination_address ?? '').trim();
      const key = `${lat ?? ''},${lng ?? ''},${addr}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (lat != null && lng != null) {
        const label = addr.length > 0 ? addr : formatCoords(lat, lng);
        list.push({
          id: `${r.id}-${key}`,
          label,
          address: addr || formatCoords(lat, lng),
          latitude: lat,
          longitude: lng,
        });
      }
      if (list.length >= 5) break;
    }
    return list;
  }, [rideHistory.data]);

  const saveMutation = useMutation({
    mutationFn: (p: { label: string; address: string; latitude: number; longitude: number }) =>
      repositories.rides.savePlace(p),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-places'] });
      toast('Saved to your places');
    },
    onError: () => toast('Could not save this place', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => repositories.rides.deleteSavedPlace(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-places'] });
      toast('Removed from saved places');
    },
    onError: () => toast('Could not remove this place', 'error'),
  });

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const runSearch = useCallback(async (term: string) => {
    if (term.trim().length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    setSearching(true);
    try {
      const { results: found } = await repositories.user.searchPlaces(term);
      setResults(found);
      setSearched(true);
    } catch {
      setResults([]);
      setSearched(false);
      toast('Address search is unavailable. Please try again.', 'error');
    } finally {
      setSearching(false);
    }
  }, []);

  const onQueryChange = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(val), 350);
  };

  const clear = () => {
    setQuery('');
    setResults([]);
    setSearched(false);
    inputRef.current?.focus();
  };

  const commit = (p: { latitude: number; longitude: number; label: string }) => {
    if (activeField === 'pickup') {
      setPickup({ latitude: p.latitude, longitude: p.longitude, label: p.label });
    } else {
      setDrop({ latitude: p.latitude, longitude: p.longitude, label: p.label });
    }
    router.back();
  };

  const openMap = () => {
    setPendingMode(activeField);
    router.back();
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

  const renderField = (field: Field) => {
    const isActive = activeField === field;
    const value = field === 'pickup' ? pickup : drop;
    return (
      <Pressable
        key={field}
        onPress={() => {
          setActiveField(field);
          inputRef.current?.focus();
        }}
        style={[styles.fieldBtn, isActive && styles.fieldBtnActive]}
      >
        <View style={[styles.dot, { backgroundColor: field === 'pickup' ? colors.success : colors.accent[500] }]} />
        {isActive ? (
          <View style={styles.fieldTextWrap}>
            <Text style={styles.fieldLabel}>{field === 'pickup' ? 'Pickup' : 'Drop location'}</Text>
            <TextInput
              ref={inputRef}
              value={query}
              onChangeText={onQueryChange}
              placeholder={field === 'pickup' ? 'Enter pickup location' : 'Enter drop location'}
              placeholderTextColor={colors.neutral[400]}
              style={styles.fieldInput}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
          </View>
        ) : (
          <View style={styles.fieldTextWrap}>
            <Text style={styles.fieldLabel}>{field === 'pickup' ? 'Pickup' : 'Drop location'}</Text>
            <Text style={styles.fieldValue} numberOfLines={1}>
              {value?.label ?? (field === 'pickup' ? 'Set your pickup' : 'Enter drop location')}
            </Text>
          </View>
        )}
        {isActive && (
          <Pressable onPress={clear} style={styles.clearBtn} hitSlop={8}>
            <X size={16} color={colors.neutral[400]} />
          </Pressable>
        )}
      </Pressable>
    );
  };

  const hasResults = results.length > 0;
  const showingResults = searched || hasResults || searching;
  const saved = (savedPlaces.data ?? []) as any[];

  const renderResult = ({ item }: { item: PlaceResult }) => {
    const lat = normalizeCoords(item.latitude);
    const lng = normalizeCoords(item.longitude);
    if (lat == null || lng == null) return null;
    const label = item.main ?? item.text ?? query;
    const secondary = item.secondary ?? item.formatted_address ?? '';
    return (
      <Pressable style={styles.resultRow} onPress={() => commit({ latitude: lat, longitude: lng, label })}>
        <View style={styles.resultIcon}>
          <Navigation size={16} color={colors.neutral[500]} />
        </View>
        <View style={styles.resultText}>
          <Text style={styles.resultMain} numberOfLines={1}>
            {label}
          </Text>
          {secondary && (
            <Text style={styles.resultSecondary} numberOfLines={1}>
              {secondary}
            </Text>
          )}
        </View>
      </Pressable>
    );
  };

  const renderRecent = ({ item }: { item: RecentItem }) => {
    const savedId = findSavedId(item);
    const isSaved = !!savedId;
    return (
      <View style={styles.savedRow}>
        <Pressable style={styles.savedLeft} onPress={() => commit({ latitude: item.latitude, longitude: item.longitude, label: item.label })}>
          <View style={styles.savedIcon}>
            <Clock size={16} color={colors.neutral[500]} />
          </View>
          <View style={styles.savedText}>
            <Text style={styles.savedLabel} numberOfLines={1}>
              {item.label}
            </Text>
            <Text style={styles.savedAddress} numberOfLines={1}>
              {item.address}
            </Text>
          </View>
        </Pressable>
        <Pressable
          onPress={() => toggleFavorite({ latitude: item.latitude, longitude: item.longitude, label: item.label, address: item.address })}
          hitSlop={8}
          style={styles.favBtn}
        >
          <Heart size={16} color={isSaved ? '#fb7185' : colors.neutral[400]} fill={isSaved ? '#fb7185' : 'transparent'} />
        </Pressable>
      </View>
    );
  };

  const renderSaved = ({ item }: { item: any }) => {
    const lat = normalizeCoords(item.latitude);
    const lng = normalizeCoords(item.longitude);
    if (lat == null || lng == null) return null;
    return (
      <View style={styles.savedRow}>
        <Pressable style={styles.savedLeft} onPress={() => commit({ latitude: lat, longitude: lng, label: item.label })}>
          <View style={styles.savedIcon}>
            <MapPin size={16} color={colors.neutral[500]} />
          </View>
          <View style={styles.savedText}>
            <Text style={styles.savedLabel} numberOfLines={1}>
              {item.label}
            </Text>
            <Text style={styles.savedAddress} numberOfLines={1}>
              {item.address}
            </Text>
          </View>
        </Pressable>
        <Pressable onPress={() => toggleFavorite({ latitude: lat, longitude: lng, label: item.label, address: item.address })} hitSlop={8} style={styles.favBtn}>
          <Heart size={16} color="#fb7185" fill="#fb7185" />
        </Pressable>
      </View>
    );
  };

  return (
    <Screen scroll={false} padded={false} bottomNav={false}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.root}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
            <ArrowLeft size={20} color={colors.ink[900]} />
          </Pressable>
          <Text style={styles.headerTitle}>{activeField === 'pickup' ? 'Pickup' : 'Drop location'}</Text>
          {user ? (
            <View style={styles.forMe}>
              <Text style={styles.forMeText} numberOfLines={1}>
                {user.name?.split(' ')[0] || 'Me'}
              </Text>
            </View>
          ) : (
            <View style={{ width: 40 }} />
          )}
        </View>

        <View style={styles.form}>
          {renderField('pickup')}
          {renderField('drop')}
          <Pressable onPress={openMap} style={styles.mapBtn}>
            <MapPin size={14} color={colors.neutral[500]} />
            <Text style={styles.mapBtnText}>Select on map</Text>
          </Pressable>
        </View>

        {showingResults ? (
          <FlatList
            data={results}
            keyExtractor={(item) => String(item.id ?? item.main ?? Math.random())}
            renderItem={renderResult}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              !searching && searched && query.trim().length >= 2 ? (
                <View style={styles.empty}>
                  <Text style={styles.emptyText}>No matching locations found.</Text>
                </View>
              ) : null
            }
            ListFooterComponent={searching ? <ActivityIndicator style={{ marginTop: 16 }} color={colors.brand[600]} /> : null}
          />
        ) : (
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            {recentDestinations.length > 0 && (
              <View style={styles.block}>
                <View style={styles.blockHeader}>
                  <Clock size={12} color={colors.neutral[400]} />
                  <Text style={styles.blockTitle}>Recent</Text>
                </View>
                <View style={styles.card}>
                  <FlatList
                    data={recentDestinations}
                    keyExtractor={(item) => item.id}
                    renderItem={renderRecent}
                    scrollEnabled={false}
                    ItemSeparatorComponent={() => <View style={styles.separator} />}
                  />
                </View>
              </View>
            )}

            {saved.length > 0 && (
              <View style={styles.block}>
                <Text style={styles.blockTitle}>Saved places</Text>
                <View style={styles.card}>
                  <FlatList
                    data={saved}
                    keyExtractor={(item) => String(item.id)}
                    renderItem={renderSaved}
                    scrollEnabled={false}
                    ItemSeparatorComponent={() => <View style={styles.separator} />}
                  />
                </View>
              </View>
            )}

            {recentDestinations.length === 0 && saved.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateTitle}>No recent or saved places yet</Text>
                <Text style={styles.emptyStateSub}>Search for a location to get started.</Text>
              </View>
            )}
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.ink[900],
  },
  forMe: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    maxWidth: 96,
  },
  forMeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.neutral[500],
  },
  form: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  fieldBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  fieldBtnActive: {
    borderColor: colors.brand[600],
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  fieldTextWrap: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.neutral[400],
  },
  fieldValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.ink[900],
  },
  fieldInput: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.ink[900],
    paddingVertical: 0,
    height: 18,
  },
  clearBtn: {
    padding: 6,
  },
  mapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  mapBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.neutral[500],
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  resultIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.neutral[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  resultMain: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.ink[900],
  },
  resultSecondary: {
    fontSize: 12,
    color: colors.neutral[500],
  },
  empty: {
    marginTop: 16,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: colors.neutral[500],
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 16,
  },
  block: {
    gap: 8,
  },
  blockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  blockTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.neutral[400],
  },
  card: {
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  savedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  savedLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  savedIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.neutral[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  savedLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.ink[900],
  },
  savedAddress: {
    fontSize: 12,
    color: colors.neutral[500],
  },
  favBtn: {
    padding: 8,
  },
  separator: {
    height: 1,
    backgroundColor: colors.neutral[100],
    marginLeft: 54,
  },
  emptyState: {
    marginTop: 40,
    alignItems: 'center',
    gap: 4,
  },
  emptyStateTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.ink[900],
  },
  emptyStateSub: {
    fontSize: 12,
    color: colors.neutral[500],
  },
});
