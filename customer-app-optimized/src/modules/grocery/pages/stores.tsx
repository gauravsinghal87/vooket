import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Search, Store as StoreIcon, X } from 'lucide-react-native';
import { repositories } from '@/shared/repositories';
import { useAppStore } from '@/shared/stores/appStore';
import { Screen } from '@/shared/components/Screen';
import { AppHeader } from '@/shared/components/AppHeader';
import { ProductImage } from '@/shared/components/ui/ProductImage';
import { EmptyState, Loader, RatingStars } from '@/shared/components/ui/primitives';
import { GroceryServiceabilityNotice } from '@/shared/components/GroceryServiceabilityNotice';
import { formatCurrency, ratingLabel } from '@/shared/utils/utils';
import { colors } from '@/modules/grocery/styles/theme';

export default function StoresScreen() {
  const [search, setSearch] = useState('');
  const router = useRouter();
  const location = useAppStore((s) => s.location) ?? null;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['stores', search, location?.latitude ?? null, location?.longitude ?? null],
    queryFn: () =>
      repositories.grocery.getStores({
        search: search || undefined,
        latitude: location?.latitude,
        longitude: location?.longitude,
      }),
  });

  const list = data?.data ?? [];

  // Backend verdict for this address: an unserviceable location renders the
  // unavailable state instead of an empty (or worse, unfiltered) store grid.
  const serviceability = data?.serviceability ?? null;
  const notServiceable = serviceability?.is_serviceable === false;

  return (
    <Screen header={<AppHeader variant="dark" title="Stores" />}>
      <View style={styles.wrap}>
        <View>
          <Text style={styles.title}>Stores</Text>
          <Text style={styles.subtitle}>Groceries near you.</Text>
        </View>

        <View style={styles.searchWrap}>
          <Search size={16} color={colors.neutral[400]} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search stores…"
            placeholderTextColor={colors.neutral[400]}
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')} hitSlop={8}>
              <X size={16} color={colors.neutral[400]} />
            </Pressable>
          )}
        </View>

        {isLoading && <Loader label="Loading stores…" />}

        {isError && (
          <EmptyState title="Couldn't load stores" message="Something went wrong while fetching stores." actionLabel="Retry" onAction={() => refetch()} />
        )}

        {!isLoading && !isError && notServiceable && <GroceryServiceabilityNotice serviceability={serviceability} />}

        {!isLoading && !isError && !notServiceable && list.length === 0 && (
          <EmptyState title="No stores found" message={search ? `No matches for “${search}”.` : 'No grocery stores in this area yet.'} />
        )}

        {!isLoading && !isError && !notServiceable && list.length > 0 && (
          <View style={styles.grid}>
            {list.map((store) => (
              <Pressable
                key={store.id}
                onPress={() => router.push(`/store/${store.id}` as never)}
                style={({ pressed }) => [styles.storeCard, pressed && { opacity: 0.94 }]}
              >
                <View style={styles.coverWrap}>
                  <ProductImage src={store.cover_image ?? store.logo} style={styles.cover} rounded={false} />
                </View>
                <View style={styles.storeBody}>
                  <View style={styles.storeNameRow}>
                    <StoreIcon size={16} color={colors.success} />
                    <Text style={styles.storeName} numberOfLines={1}>
                      {store.name}
                    </Text>
                  </View>
                  <View style={styles.ratingRow}>
                    <RatingStars rating={store.rating} count={store.rating_count} />
                    <Text style={styles.ratingCount}>
                      {ratingLabel(store.rating)}
                      {store.rating_count ? ` (${store.rating_count})` : ''}
                    </Text>
                  </View>
                  <Text style={styles.storeMeta}>
                    {store.supports_instant_delivery ? 'Instant delivery · ' : ''}
                    {store.delivery_fee ? `Delivery ${formatCurrency(store.delivery_fee)}` : ''}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: {
    padding: 16,
    gap: 14,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.ink[900],
  },
  subtitle: {
    fontSize: 14,
    color: colors.neutral[500],
    marginTop: 2,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.ink[900],
    paddingVertical: 0,
  },
  grid: {
    gap: 12,
  },
  storeCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  coverWrap: {
    height: 128,
  },
  cover: {
    width: '100%',
    height: '100%',
  },
  storeBody: {
    padding: 12,
  },
  storeNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  storeName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink[900],
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  ratingCount: {
    fontSize: 12,
    color: colors.neutral[500],
  },
  storeMeta: {
    marginTop: 4,
    fontSize: 11,
    color: colors.neutral[500],
  },
});