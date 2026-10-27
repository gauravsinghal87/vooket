import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ChevronLeft, ChevronRight, Clock, Mic, Store as StoreIcon, X } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { repositories } from '@/api/repositories';
import { useAppStore } from '@/stores/appStore';
import { DEFAULT_LOCATION } from '@/lib/location';
import { coordsKey } from '@/lib/geo';
import type { Category, Product, Restaurant, Store } from '@/types/catalog';
import { ProductGridCard } from '@/components/cards';
import { Screen } from '@/components/Screen';
import { ServiceabilityNotice } from '@/components/ServiceabilityNotice';
import { GroceryServiceabilityNotice } from '@/components/GroceryServiceabilityNotice';
import { ProductImage } from '@/components/ui/ProductImage';
import { EmptyState, Loader, RatingStars } from '@/components/ui/primitives';
import { carryProduct } from '@/lib/routeState';
import { colors } from '@/theme';

type Scope = 'all' | 'food' | 'grocery';
type Sort = 'relevance' | 'rating' | 'price_low' | 'price_high';

const RECENT_KEY = 'sb-recent-searches';

const SCOPES: { value: Scope; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'food', label: 'Food' },
  { value: 'grocery', label: 'Grocery' },
];

const SORTS: { value: Sort; label: string }[] = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'rating', label: 'Top rated' },
  { value: 'price_low', label: 'Price: Low to high' },
  { value: 'price_high', label: 'Price: High to low' },
];

export default function SearchScreen() {
  const params = useLocalSearchParams<{ type?: string; q?: string }>();
  const typeParam: Scope = params.type === 'grocery' ? 'grocery' : params.type === 'food' ? 'food' : 'all';
  const qParam = params.q ?? '';
  const router = useRouter();

  const [query, setQuery] = useState(qParam);
  const [submitted, setSubmitted] = useState(qParam);
  const [scope, setScope] = useState<Scope>(typeParam);
  const [sort, setSort] = useState<Sort>('relevance');
  const [recent, setRecent] = useState<string[]>([]);
  const [sortOpen, setSortOpen] = useState(false);

  const readRecent = async () => {
    try {
      const raw = await AsyncStorage.getItem(RECENT_KEY);
      setRecent(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      setRecent([]);
    }
  };

  const writeRecent = async (q: string) => {
    const next = [q, ...recent.filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, 6);
    setRecent(next);
    try {
      await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    readRecent();
  }, []);

  useEffect(() => {
    if (!qParam) return;
    writeRecent(qParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasQuery = submitted.trim().length > 0;

  // Same effective location as the Food home so zone-gated food results stay
  // consistent with the rest of the Food browsing surfaces. Grocery scope is
  // store-catalogue driven and is unaffected by the food zone rule.
  const location = useAppStore((s) => s.location) ?? DEFAULT_LOCATION;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['search', submitted, scope, location.latitude, location.longitude],
    queryFn: () =>
      repositories.search.search(submitted, scope === 'all' ? undefined : scope, {
        latitude: location.latitude,
        longitude: location.longitude,
      }),
    enabled: hasQuery,
  });

  const results = useMemo(() => {
    if (!data) return null;
    let restaurants = [...data.restaurants];
    let stores = [...data.stores];
    let products = [...data.products];
    if (scope === 'all') {
      const q = submitted.toLowerCase();
      products = products.filter((p) => p.name.toLowerCase().includes(q) || (p.description ?? '').toLowerCase().includes(q));
    }
    if (scope === 'food') stores = [];
    if (scope === 'grocery') restaurants = [];
    if (sort === 'rating') {
      restaurants.sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating));
      stores.sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating));
    } else if (sort === 'price_low') {
      products.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
    } else if (sort === 'price_high') {
      products.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
    }
    return { restaurants, stores, products, categories: data.categories };
  }, [data, scope, sort, submitted]);

  const runSearch = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    writeRecent(trimmed);
    setSubmitted(trimmed);
    setQuery(trimmed);
    setSortOpen(false);
  };

  const totalResults = results ? results.restaurants.length + results.stores.length + results.products.length : 0;
  const hasTyped = submitted.trim().length > 0;

  // The backend resolves the delivery location for search too. When it reports
  // the location as unserviceable, food-scope results are replaced by the
  // unavailable-location state instead of showing a partial or empty set.
  const serviceability = data?.serviceability ?? null;
  const foodNotServiceable = scope !== 'grocery' && serviceability?.is_serviceable === false;

  // Grocery results carry their own backend verdict on the shared discovery
  // endpoint. When it reports the location as unserviceable the grocery groups
  // are replaced by the unavailable state rather than an empty/partial set.
  const groceryServiceability = scope !== 'food' ? (data?.groceryServiceability ?? null) : null;
  const groceryNotServiceable = scope !== 'food' && groceryServiceability?.is_serviceable === false;
  const showGroceryNotice = groceryNotServiceable && !foodNotServiceable;
  // Only a grocery-only search is fully replaced by the notice: in the "all"
  // scope a healthy Food side keeps its results and the grocery notice explains
  // why no stores or grocery products appear next to them.
  const resultsBlocked = foodNotServiceable || (groceryNotServiceable && scope === 'grocery');

  const goProduct = (p: Product) => {
    carryProduct(p, p.type ?? 'grocery');
    router.push(`/product/${p.id}?service=${p.type ?? 'grocery'}` as never);
  };

  return (
    <Screen header={<SearchTopBar query={query} setQuery={setQuery} onSubmit={() => runSearch(query)} onClear={() => { setQuery(''); setSubmitted(''); }} />} contentStyle={styles.content}>
      <ScrollView contentContainerStyle={styles.inner} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.pills}>
          {SCOPES.map((s) => {
            const active = scope === s.value;
            return (
              <Pressable key={s.value} onPress={() => setScope(s.value)} style={[styles.pill, active && styles.pillActive]}>
                <Text style={[styles.pillText, active && styles.pillTextActive]}>{s.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {hasTyped && !resultsBlocked && results && totalResults > 0 && (
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>{totalResults} results</Text>
            <Pressable style={styles.sortBtn} onPress={() => setSortOpen((v) => !v)}>
              <Text style={styles.sortText}>{SORTS.find((s) => s.value === sort)?.label}</Text>
              <Text style={styles.sortChevron}>{sortOpen ? '▲' : '▼'}</Text>
            </Pressable>
          </View>
        )}

        {sortOpen && (
          <View style={styles.sortMenu}>
            {SORTS.map((s) => (
              <Pressable key={s.value} onPress={() => { setSort(s.value); setSortOpen(false); }} style={[styles.sortOption, sort === s.value && { backgroundColor: colors.ink[50] }]}>
                <Text style={[styles.sortOptionText, sort === s.value && { fontWeight: '700' }]}>{s.label}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {!hasTyped && (
          <View style={styles.browse}>
            {recent.length > 0 && (
              <View>
                <View style={styles.browseHead}>
                  <Clock size={16} color={colors.neutral[400]} />
                  <Text style={styles.browseTitle}>Recent searches</Text>
                </View>
                <View style={styles.chips}>
                  {recent.map((r) => (
                    <Pressable key={r} style={styles.recentChip} onPress={() => runSearch(r)}>
                      <Text style={styles.recentChipText}>{r}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            <View>
              <Text style={styles.mindTitle}>WHAT&apos;S ON YOUR MIND?</Text>
              <WhatsOnYourMind scope={scope} onPick={runSearch} />
            </View>
          </View>
        )}

        {hasTyped && isLoading && <Loader label="Searching…" />}

        {hasTyped && isError && (
          <EmptyState title="Search failed" message="Something went wrong while searching. Try again." actionLabel="Retry" onAction={() => refetch()} />
        )}

        {hasTyped && foodNotServiceable && !isLoading && !isError && (
          <ServiceabilityNotice serviceability={serviceability} />
        )}

        {hasTyped && showGroceryNotice && !isLoading && !isError && (
          <GroceryServiceabilityNotice serviceability={groceryServiceability} />
        )}

        {hasTyped && !resultsBlocked && results && totalResults === 0 && !isLoading && !isError && (
          <EmptyState title="No results found" message={`Nothing matched “${submitted}”. Try a different search.`} />
        )}

        {hasTyped && !resultsBlocked && results && !isLoading && !isError && (
          <View style={styles.groups}>
            {scope !== 'grocery' && results.restaurants.length > 0 && (
              <ResultGroup title="Restaurants">
                {results.restaurants.map((r) => (
                  <FoodResultCard key={`r-${r.id}`} r={r} />
                ))}
              </ResultGroup>
            )}
            {scope !== 'food' && results.stores.length > 0 && (
              <ResultGroup title="Stores">
                {results.stores.map((s) => (
                  <StoreResultCard key={`s-${s.id}`} s={s} />
                ))}
              </ResultGroup>
            )}
            {results.products.length > 0 && (
              <ResultGroup title="Products">
                <View style={styles.prodGrid}>
                  {results.products.map((p) => (
                    <View key={`p-${p.id}`} style={styles.prodCell}>
                      <Pressable onPress={() => goProduct(p)}>
                        <ProductGridCard product={p} type={p.type ?? 'grocery'} />
                      </Pressable>
                    </View>
                  ))}
                </View>
              </ResultGroup>
            )}
            {results.restaurants.length === 0 && results.stores.length === 0 && results.products.length === 0 && (
              <EmptyState title="No results found" message={`Nothing matched “${submitted}”. Try a different search.`} />
            )}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

/** Zomato's search pill: back chevron, underline-free input, decorative mic. */
function SearchTopBar({
  query,
  setQuery,
  onSubmit,
  onClear,
}: {
  query: string;
  setQuery: (v: string) => void;
  onSubmit: () => void;
  onClear: () => void;
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
      <View style={styles.searchPill}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.pillBack} accessibilityLabel="Go back">
          <ChevronLeft size={22} color={colors.food[600]} />
        </Pressable>
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={onSubmit}
          returnKeyType="search"
          placeholder="Restaurant name or a dish..."
          placeholderTextColor={colors.neutral[400]}
          style={styles.pillInput}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
        />
        {query.length > 0 && (
          <Pressable onPress={onClear} hitSlop={8} style={styles.pillIcon} accessibilityLabel="Clear">
            <X size={18} color={colors.neutral[400]} />
          </Pressable>
        )}
        <Mic size={20} color={colors.food[600]} />
      </View>
    </View>
  );
}

/**
 * Zomato's "WHAT'S ON YOUR MIND" grid: a three-column wall of food imagery
 * with the label underneath. Tapping a tile runs that term through the search.
 */
function WhatsOnYourMind({ scope, onPick }: { scope: Scope; onPick: (q: string) => void }) {
  // Grocery categories are zone-gated, so they are requested for the current
  // delivery address (and keyed by it) exactly like the grocery page does.
  const location = useAppStore((s) => s.location) ?? DEFAULT_LOCATION;
  const { data } = useQuery({
    queryKey: ['search-categories', scope, coordsKey(location)],
    queryFn: async () => {
      const f = await repositories.food.getCategories();
      const g = await repositories.grocery.getCategories({
        latitude: location.latitude,
        longitude: location.longitude,
      });
      return scope === 'grocery'
        ? { list: g.categories, kind: 'grocery' as const }
        : { list: f, kind: 'food' as const };
    },
  });
  const cats: Category[] = (data?.list ?? []).slice(0, 18);
  const kind = data?.kind ?? 'food';

  if (cats.length === 0) return null;

  return (
    <View style={styles.mindGrid}>
      {cats.map((c) => (
        <Pressable key={`${kind}-${c.id}`} style={styles.mindCell} onPress={() => onPick(c.name)}>
          <View style={styles.mindImgWrap}>
            <ProductImage src={c.image} style={styles.mindImg} resizeMode="cover" />
          </View>
          <Text style={styles.mindLabel} numberOfLines={1}>
            {c.name}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function ResultGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View>
      <Text style={styles.groupTitle}>{title}</Text>
      {children}
    </View>
  );
}

function FoodResultCard({ r }: { r: Restaurant }) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push(`/restaurant/${r.id}` as never)}
      style={({ pressed }) => [styles.resultCard, pressed && { opacity: 0.94 }]}
    >
      <ProductImage src={r.cover_image ?? r.logo} size={64} />
      <View style={styles.resultBody}>
        <Text style={styles.resultName} numberOfLines={1}>
          {r.name}
        </Text>
        {r.cuisine_type ? <Text style={styles.resultSub} numberOfLines={1}>{r.cuisine_type}</Text> : null}
        <View style={styles.resultRating}>
          <RatingStars rating={r.rating} count={r.rating_count} color={colors.success} size={12} />
        </View>
      </View>
      <ChevronRight size={16} color={colors.neutral[300]} />
    </Pressable>
  );
}

function StoreResultCard({ s }: { s: Store }) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push(`/store/${s.id}` as never)}
      style={({ pressed }) => [styles.resultCard, pressed && { opacity: 0.94 }]}
    >
      <ProductImage src={s.cover_image ?? s.logo} size={64} />
      <View style={styles.resultBody}>
        <View style={styles.storeNameRow}>
          <StoreIcon size={14} color={colors.success} />
          <Text style={styles.resultName} numberOfLines={1}>
            {s.name}
          </Text>
        </View>
        {s.address ? <Text style={styles.resultSub} numberOfLines={1}>{s.address}</Text> : null}
        <View style={styles.resultRating}>
          <RatingStars rating={s.rating} count={s.rating_count} color={colors.success} size={12} />
        </View>
      </View>
      <ChevronRight size={16} color={colors.neutral[300]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    backgroundColor: '#fff',
  },
  inner: {
    padding: 16,
    gap: 16,
  },
  topBar: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.ink[50],
  },
  searchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    backgroundColor: '#fff',
    paddingLeft: 6,
    paddingRight: 16,
    height: 48,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  pillBack: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    color: colors.ink[900],
    paddingVertical: 0,
  },
  pillIcon: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pills: {
    flexDirection: 'row',
    gap: 8,
  },
  pill: {
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  pillActive: {
    backgroundColor: colors.ink[900],
    borderColor: colors.ink[900],
  },
  pillText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.neutral[500],
  },
  pillTextActive: {
    color: '#fff',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metaText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.neutral[500],
  },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  sortText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.neutral[700],
  },
  sortChevron: {
    fontSize: 9,
    color: colors.neutral[500],
  },
  sortMenu: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    overflow: 'hidden',
  },
  sortOption: {
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  sortOptionText: {
    fontSize: 13,
    color: colors.neutral[700],
  },
  browse: {
    gap: 22,
  },
  browseHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  browseTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink[900],
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  recentChip: {
    borderWidth: 1,
    borderColor: colors.neutral[200],
    backgroundColor: '#fff',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  recentChipText: {
    fontSize: 13,
    color: colors.neutral[700],
  },
  mindTitle: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.6,
    color: colors.neutral[400],
    marginBottom: 14,
  },
  mindGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 18,
  },
  mindCell: {
    width: '31%',
    alignItems: 'center',
  },
  mindImgWrap: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.ink[50],
  },
  mindImg: {
    width: '100%',
    height: '100%',
  },
  mindLabel: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '500',
    color: colors.ink[800],
  },
  groups: {
    gap: 20,
  },
  groupTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink[900],
    marginBottom: 8,
  },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    padding: 12,
    marginBottom: 8,
  },
  resultBody: {
    flex: 1,
  },
  resultName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink[900],
  },
  resultSub: {
    fontSize: 12,
    color: colors.neutral[500],
    marginTop: 2,
  },
  resultRating: {
    marginTop: 2,
  },
  storeNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  prodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  prodCell: {
    width: '48%',
  },
});
