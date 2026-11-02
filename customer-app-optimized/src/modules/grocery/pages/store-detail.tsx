import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { repositories } from '@/shared/repositories';
import { useAppStore } from '@/shared/stores/appStore';
import { DEFAULT_LOCATION } from '@/shared/utils/location';
import { coordsKey } from '@/shared/utils/geo';
import { GroceryServiceabilityNotice } from '@/shared/components/GroceryServiceabilityNotice';
import { ProductGridCard, ViewCartBar } from '@/shared/components/cards';
import { Screen } from '@/shared/components/Screen';
import { AppHeader } from '@/shared/components/AppHeader';
import { ProductImage } from '@/shared/components/ui/ProductImage';
import { EmptyState, Loader, RatingStars } from '@/shared/components/ui/primitives';
import { colors } from '@/modules/grocery/styles/theme';

export default function StoreScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const storeId = Number(params.id);

  // The store and its catalogue are resolved against the current delivery
  // address: the key includes the coordinates, so changing the address
  // refetches instead of flashing the previous address's store.
  const location = useAppStore((st) => st.location);
  const openLocationSelector = useAppStore((st) => st.openLocationSelector);
  const origin = location ?? DEFAULT_LOCATION;
  const coords = { latitude: origin.latitude, longitude: origin.longitude };

  const store = useQuery({
    queryKey: ['store', storeId, coordsKey(origin)],
    queryFn: () => repositories.grocery.getStore(storeId, coords),
    enabled: Number.isFinite(storeId),
  });

  const products = useQuery({
    queryKey: ['store-products', storeId, coordsKey(origin)],
    queryFn: () => repositories.grocery.getProducts(storeId, coords),
    enabled: Number.isFinite(storeId),
  });

  // `store` is null when the backend says this location cannot reach it — the
  // unavailable state takes over instead of a "Store not found" dead end.
  const serviceability = store.data?.serviceability ?? null;
  const unavailable = !store.isLoading && serviceability?.is_serviceable === false;
  const s = store.data?.store ?? null;

  return (
    <Screen
      header={<AppHeader variant="dark" title={s?.name ?? 'Store'} />}
      bottomBar={<ViewCartBar type="grocery" />}
    >
      <View style={styles.wrap}>
        {store.isLoading && (
          <View style={styles.loaderBox}>
            <Loader label="Loading store…" />
          </View>
        )}

        {store.isError && <EmptyState title="Store not found" message="This store may have been removed." />}

        {unavailable && <GroceryServiceabilityNotice serviceability={serviceability} />}

        {/* The endpoint answered with no store: this delivery address cannot
            reach it (same wording the backend returns). It is a location
            problem, so it offers the same way out as the unavailable state — an
            id that does not exist at all is a 404 and keeps the error branch. */}
        {!store.isLoading && !store.isError && !unavailable && !s && (
          <EmptyState
            title="Store not available at this location"
            message="This store doesn't deliver to your current delivery address. Try another delivery address to see stores available near you."
            actionLabel="Change location"
            onAction={openLocationSelector}
          />
        )}

        {s && (
          <>
            <View style={styles.card}>
              <View style={styles.coverWrap}>
                <ProductImage src={s.cover_image ?? s.logo} style={styles.cover} rounded={false} />
              </View>
              <View style={styles.body}>
                <Text style={styles.name}>{s.name}</Text>
                {s.address ? <Text style={styles.address}>{s.address}</Text> : null}
                <View style={styles.ratingRow}>
                  <RatingStars rating={s.rating} count={s.rating_count} color={colors.success} />
                </View>
              </View>
            </View>

            <View style={styles.products}>
              <Text style={styles.productsTitle}>Products</Text>
              {products.isLoading && <Loader label="Loading products…" />}
              {products.data && (
                <View style={styles.grid}>
                  {products.data.data.map((p) => (
                    <View key={p.id} style={styles.gridCell}>
                      <ProductGridCard product={p} type="grocery" />
                    </View>
                  ))}
                </View>
              )}
            </View>
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: {
    padding: 16,
    gap: 20,
  },
  loaderBox: {
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.neutral[100],
    borderRadius: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  coverWrap: {
    height: 160,
  },
  cover: {
    width: '100%',
    height: '100%',
  },
  body: {
    padding: 16,
  },
  name: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.ink[900],
  },
  address: {
    fontSize: 14,
    color: colors.neutral[500],
    marginTop: 4,
  },
  ratingRow: {
    marginTop: 8,
  },
  products: {
    gap: 12,
  },
  productsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink[900],
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  gridCell: {
    width: '48.5%',
  },
});