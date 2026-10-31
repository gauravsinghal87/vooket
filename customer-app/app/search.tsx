import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ChevronLeft, ChevronRight, Clock, Mic, Search, Store as StoreIcon, X } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { repositories } from '@/api/repositories';
import { useAppStore } from '@/stores/appStore';
import { useActiveGroceryStore } from '@/hooks/useActiveGroceryStore';
import { useStoreCatalogue } from '@/hooks/useStoreCatalogue';
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
  // Same rule as web: a search opened from inside a module
  // (/search?type=food|grocery) already knows its module, so the scope is
  // locked to the route param and the All / Food / Grocery pills are dropped.
  // Only a genuinely global /search (no type) shows them, and only there is
  // `globalScope` used. Deriving `scope` from the param on every render also
  // means re-opening search after switching modules picks up the new module
  // even when expo-router reuses this screen instance with new params.
  const moduleScoped = typeParam !== 'all';
  const [globalScope, setGlobalScope] = useState<Scope>('all');
  const scope: Scope = moduleScoped ? typeParam : globalScope;
  // Grocery gets Blinkit's search chrome (neutral pill, grocery placeholder,
  // recent-search rail with a clear action). Food and the global search keep
  // the existing Zomato styling untouched.
  const grocery = scope === 'grocery';
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

  const clearRecent = async () => {
    setRecent([]);
    try {
      await AsyncStorage.removeItem(RECENT_KEY);
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

  /**
   * Grocery search is scoped to the single active (nearest) store — the same
   * rule the web search uses. The cross-store discovery endpoint is never used
   * for that scope, so a product only another store happens to stock can never
   * appear here; results come from `GET /grocery/stores/{id}/products`, which
   * the backend already restricts to that store. Food and the global search
   * keep using the discovery endpoint exactly as before.
   */
  const { activeStore, activeStoreId } = useActiveGroceryStore();
  const storeScopedGrocery = scope === 'grocery' && activeStoreId !== null;

  const storeSearch = useStoreCatalogue(activeStoreId, {
    search: submitted,
    perPage: 40,
    enabled: storeScopedGrocery && hasQuery,
  });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['search', submitted, scope, location.latitude, location.longitude],
    queryFn: () =>
      repositories.search.search(submitted, scope === 'all' ? undefined : scope, {
        latitude: location.latitude,
        longitude: location.longitude,
      }),
    enabled: hasQuery && !storeScopedGrocery,
  });

  const loading = storeScopedGrocery ? storeSearch.isLoading : isLoading;
  const errored = storeScopedGrocery ? storeSearch.isError : isError;

  const results = useMemo(() => {
    // Store-scoped grocery: only the active store's own products, sorted
    // locally the way web sorts them. No store/restaurant groups.
    if (storeScopedGrocery) {
      const products = [...storeSearch.products];
      if (sort === 'price_low') products.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
      else if (sort === 'price_high') products.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
      return {
        restaurants: [] as Restaurant[],
        stores: [] as Store[],
        products,
        categories: [] as Category[],
      };
    }

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
  }, [data, scope, sort, submitted, storeScopedGrocery, storeSearch.products]);

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
  const serviceability = storeScopedGrocery ? null : (data?.serviceability ?? null);
  const foodNotServiceable =
    !storeScopedGrocery && scope !== 'grocery' && serviceability?.is_serviceable === false;

  // Grocery results carry their own backend verdict: the store-catalogue path
  // reads it from that request, the discovery path from `grocery_serviceability`.
  // When it reports the location as unserviceable the grocery groups are
  // replaced by the unavailable state rather than an empty/partial set.
  const groceryServiceability =
    scope === 'food'
      ? null
      : storeScopedGrocery
        ? (storeSearch.serviceability ?? null)
        : (data?.groceryServiceability ?? null);
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
    <Screen
      header={
        <SearchTopBar
          query={query}
          setQuery={setQuery}
          onSubmit={() => runSearch(query)}
          onClear={() => { setQuery(''); setSubmitted(''); }}
          scope={scope}
        />
      }
      contentStyle={grocery ? styles.contentGrocery : styles.content}
    >
      <ScrollView contentContainerStyle={styles.inner} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Module-scoped searches skip the pills: the route already says Food
            or Grocery. The node is removed, not hidden, so the inner
            ScrollView's `gap: 16` leaves no hole where the row was. */}
        {!moduleScoped && (
          <View style={styles.pills}>
            {SCOPES.map((s) => {
              const active = scope === s.value;
              return (
                <Pressable key={s.value} onPress={() => setGlobalScope(s.value)} style={[styles.pill, active && styles.pillActive]}>
                  <Text style={[styles.pillText, active && styles.pillTextActive]}>{s.label}</Text>
                </Pressable>
              );
            })}
          </View>
        )}

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
                  {!grocery && <Clock size={16} color={colors.neutral[400]} />}
                  <Text style={styles.browseTitle}>Recent searches</Text>
                  {grocery && (
                    <Pressable onPress={() => void clearRecent()} hitSlop={8} accessibilityLabel="Clear recent searches">
                      <Text style={styles.clearText}>clear</Text>
                    </Pressable>
                  )}
                </View>
                <View style={styles.chips}>
                  {recent.map((r) => (
                    <Pressable
                      key={r}
                      style={[styles.recentChip, grocery && styles.recentChipGrocery]}
                      onPress={() => runSearch(r)}
                    >
                      {grocery && <Search size={14} color={colors.neutral[500]} />}
                      <Text style={[styles.recentChipText, grocery && styles.recentChipTextGrocery]}>{r}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            <View>
              <Text style={styles.mindTitle}>{grocery ? 'CATEGORIES' : "WHAT'S ON YOUR MIND?"}</Text>
              <WhatsOnYourMind scope={scope} onPick={runSearch} />
            </View>
          </View>
        )}

        {hasTyped && loading && <Loader label="Searching…" />}

        {hasTyped && errored && (
          <EmptyState
            title="Search failed"
            message={
              storeScopedGrocery
                ? "We couldn't load products from your nearest store. Try again."
                : 'Something went wrong while searching. Try again.'
            }
            actionLabel="Retry"
            onAction={() => void (storeScopedGrocery ? storeSearch.refetch() : refetch())}
          />
        )}

        {hasTyped && foodNotServiceable && !loading && !errored && (
          <ServiceabilityNotice serviceability={serviceability} />
        )}

        {hasTyped && showGroceryNotice && !loading && !errored && (
          <GroceryServiceabilityNotice serviceability={groceryServiceability} />
        )}

        {hasTyped && !resultsBlocked && results && totalResults === 0 && !loading && !errored && (
          <EmptyState title="No results found" message={`Nothing matched “${submitted}”. Try a different search.`} />
        )}

        {hasTyped && !resultsBlocked && results && !loading && !errored && (
          <View style={styles.groups}>
            {storeScopedGrocery && activeStore && (
              <View style={styles.storeNotice}>
                <StoreIcon size={14} color={colors.success} />
                <Text style={styles.storeNoticeText}>
                  Showing results from your nearest store, {activeStore.name}
                </Text>
              </View>
            )}
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

/**
 * The search pill.
 *
 * Food keeps Zomato's chrome (red chevron and mic, food placeholder). Grocery
 * uses Blinkit's instead — neutral chevron on an off-white band, the grocery
 * placeholder, a hairline divider before the mic and dark grey icons — so the
 * grocery module reads as its own service and never as a Food screen.
 */
function SearchTopBar({
  query,
  setQuery,
  onSubmit,
  onClear,
  scope,
}: {
  query: string;
  setQuery: (v: string) => void;
  onSubmit: () => void;
  onClear: () => void;
  scope: Scope;
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const grocery = scope === 'grocery';
  const iconColor = grocery ? colors.ink[800] : colors.food[600];
  return (
    <View style={[styles.topBar, grocery && styles.topBarGrocery, { paddingTop: insets.top + 8 }]}>
      <View style={styles.searchPill}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.pillBack} accessibilityLabel="Go back">
          <ChevronLeft size={22} color={iconColor} />
        </Pressable>
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={onSubmit}
          returnKeyType="search"
          placeholder={grocery ? 'Search for atta, dal, coke and more' : 'Restaurant name or a dish...'}
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
        {grocery && <View style={styles.pillDivider} />}
        <Mic size={20} color={iconColor} />
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
      // Ask only the active module for its categories: a module-scoped search
      // never requests the other module's list just to discard it.
      if (scope === 'grocery') {
        const g = await repositories.grocery.getCategories({
          latitude: location.latitude,
          longitude: location.longitude,
        });
        return { list: g.categories, kind: 'grocery' as const };
      }
      const f = await repositories.food.getCategories();
      return { list: f, kind: 'food' as const };
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
  /* Grocery search sits on the module's cream page colour, like the rest of
     the Grocery surfaces. */
  contentGrocery: {
    backgroundColor: colors.grocery[50],
  },
  topBarGrocery: {
    backgroundColor: colors.grocery[50],
    borderBottomColor: colors.grocery[200],
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
  /* Blinkit's hairline separator between the query field and the mic. */
  pillDivider: {
    width: 1,
    height: 20,
    backgroundColor: colors.neutral[200],
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
  /* Grocery recent-search pills: a small search glyph inside the pill, like
     Blinkit's, and a slightly heavier label. */
  recentChipGrocery: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  recentChipTextGrocery: {
    fontWeight: '600',
    color: colors.ink[800],
  },
  clearText: {
    marginLeft: 'auto',
    fontSize: 13,
    fontWeight: '700',
    color: colors.success,
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
  /* "Showing results from your nearest store …" — native port of web's
     success-tinted notice above the store-scoped product list. */
  storeNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(22, 163, 74, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  storeNoticeText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    color: colors.neutral[700],
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
