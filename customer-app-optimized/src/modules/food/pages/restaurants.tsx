import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Search, X } from 'lucide-react-native';
import { repositories } from '@/shared/repositories';
import { useAppStore } from '@/shared/stores/appStore';
import { DEFAULT_LOCATION } from '@/shared/utils/location';
import { imageUrl } from '@/shared/utils/images';
import { RestaurantCard } from '@/shared/components/cards';
import {
  RestaurantCardGrid,
  RestaurantCardGridItem,
} from '@/modules/food/components/restaurant/NotchRestaurantCard';
import { Screen } from '@/shared/components/Screen';
import { AppHeader } from '@/shared/components/AppHeader';
import { ServiceabilityNotice } from '@/shared/components/ServiceabilityNotice';
import { EmptyState, Loader } from '@/shared/components/ui/primitives';
import { colors } from '@/modules/food/styles/theme';

export default function RestaurantsScreen() {
  const params = useLocalSearchParams<{ cuisine?: string }>();
  const [search, setSearch] = useState('');
  const [cuisine, setCuisine] = useState<string | null>(params.cuisine ?? null);
  // Same effective location as the Food home: the saved address when there is
  // one, otherwise the shared default the header shows. Every listing surface
  // resolves the same coordinates so they can never disagree.
  const location = useAppStore((s) => s.location) ?? DEFAULT_LOCATION;

  // Web parity: customer-web RestaurantsPage never forwards the `cuisine` URL
  // param to the API — the listing is the full serviceable set regardless of
  // which Food category linked here (`/restaurants?cuisine=X` is decorative
  // on web). The cuisine is kept in the query key so category-to-category
  // navigation never reuses a stale cache (react-query cache separation).
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['restaurants', cuisine, search, location.latitude, location.longitude],
    queryFn: () =>
      repositories.food.getRestaurants({
        search: search || undefined,
        latitude: location.latitude,
        longitude: location.longitude,
      }),
  });

  const list = data?.data ?? [];
  const serviceability = data?.serviceability ?? null;
  const notServiceable = serviceability?.is_serviceable === false;

  if (__DEV__ && list.length > 0) {
    console.log('[RESTAURANTS]', {
      cuisine,
      count: list.length,
      firstImage: imageUrl((list[0].cover_image ?? list[0].logo) as string),
    });
  }

  return (
    <Screen header={<AppHeader variant="dark" title="Restaurants" />}>
      <View style={styles.wrap}>
        <View>
          <Text style={styles.title}>Restaurants</Text>
          <Text style={styles.subtitle}>Find something delicious near you.</Text>
        </View>

        <View style={styles.searchWrap}>
          <Search size={16} color={colors.neutral[400]} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search restaurants…"
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

        {cuisine && (
          <Pressable style={styles.cuisineChip} onPress={() => setCuisine(null)}>
            <Text style={styles.cuisineChipText}>Showing: {cuisine}</Text>
            <X size={13} color={colors.food[700]} />
          </Pressable>
        )}

        {isLoading && <Loader label="Loading restaurants…" />}

        {isError && (
          <EmptyState
            title="Couldn't load restaurants"
            message="Something went wrong while fetching restaurants."
            actionLabel="Retry"
            onAction={() => refetch()}
          />
        )}

        {!isLoading && !isError && notServiceable && (
          <ServiceabilityNotice serviceability={serviceability} />
        )}

        {!isLoading && !isError && !notServiceable && list.length === 0 && (
          <EmptyState title="No restaurants found" message={search ? `No matches for “${search}”.` : 'No restaurants in this area yet.'} />
        )}

        {!isLoading && !isError && !notServiceable && list.length > 0 && (
          <RestaurantCardGrid>
            {list.map((r) => (
              <RestaurantCardGridItem key={r.id}>
                <RestaurantCard restaurant={r} />
              </RestaurantCardGridItem>
            ))}
          </RestaurantCardGrid>
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
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 20,
    color: colors.ink[900],
  },
  subtitle: {
    fontFamily: 'Outfit_400Regular',
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
    fontFamily: 'Outfit_400Regular',
    flex: 1,
    fontSize: 14,
    color: colors.ink[900],
    paddingVertical: 0,
  },
  cuisineChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: colors.food[50],
    borderWidth: 1,
    borderColor: colors.food[200],
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  cuisineChipText: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 12,
    color: colors.food[700],
  },
});