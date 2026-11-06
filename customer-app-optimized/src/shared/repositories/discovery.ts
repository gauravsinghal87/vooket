import { apiClient } from '@/shared/services/client';
import type { MetaWithServiceability, Serviceability } from '@/shared/types/api';
import type { Banner, Category, Offer, Product, Restaurant, Store } from '@/shared/types/catalog';
import type { MonthlySuggestion } from '@/shared/types/slots';

export interface DiscoveryLocation {
  latitude?: number;
  longitude?: number;
}

export interface FoodDiscovery {
  recommended: Restaurant[];
  popular: Restaurant[];
  top: Restaurant[];
  fast: Restaurant[];
  offers: Restaurant[];
  recentlyOrdered: Restaurant[];
  products: Product[];
  deals: Product[];
  banners: Banner[];
  categories: Category[];
  promos: Offer[];
  serviceability: Serviceability | null;
}

export interface GroceryDiscovery {
  buyAgain: Product[];
  monthlyEssentials: MonthlySuggestion[];
  recommended: Product[];
  deals: Product[];
  stores: Store[];
  categories: Category[];
  recentlyViewed: Product[];
  banners: Banner[];
  promos: Offer[];
  serviceability: Serviceability | null;
}

export interface DiscoveryEnvelope {
  data: Record<string, any>;
  meta: MetaWithServiceability;
}

function queryFor(location?: DiscoveryLocation): string {
  const qs = new URLSearchParams();
  if (location?.latitude != null) qs.set('latitude', String(location.latitude));
  if (location?.longitude != null) qs.set('longitude', String(location.longitude));
  const query = qs.toString();
  return query ? `?${query}` : '';
}

/**
 * Raw `/discovery/home` read, shared by Food and Grocery. Keeping the transport
 * here lets both module screens use one TanStack Query cache entry instead of
 * downloading the same envelope twice when the customer switches modules.
 */
export async function fetchDiscoveryHome(location?: DiscoveryLocation): Promise<DiscoveryEnvelope> {
  return apiClient.getWithMeta<Record<string, any>, MetaWithServiceability>(
    `/discovery/home${queryFor(location)}`
  );
}

export function mapFoodDiscovery(data: Record<string, any>, meta: MetaWithServiceability): FoodDiscovery {
  return {
    recommended: data.recommended_restaurants ?? data.food?.recommended ?? [],
    popular: data.food?.popular ?? [],
    top: data.food?.top ?? [],
    fast: data.food?.fast ?? [],
    offers: data.food?.offers ?? [],
    recentlyOrdered: data.food?.recently_ordered ?? [],
    products: (data.food?.products ?? data.food?.recommended_products ?? []) as Product[],
    deals: (data.food?.deals ?? data.food?.recommended ?? []) as Product[],
    banners: data.food?.banners ?? data.banners ?? [],
    categories: data.categories ?? [],
    promos: data.offers ?? data.food?.offers ?? [],
    serviceability: meta?.serviceability ?? null,
  };
}

export function mapGroceryDiscovery(
  data: Record<string, any>,
  meta: MetaWithServiceability
): GroceryDiscovery {
  return {
    buyAgain: data.grocery?.buy_again ?? [],
    monthlyEssentials: data.grocery?.monthly_essentials ?? [],
    recommended: data.grocery?.recommended ?? [],
    deals: data.grocery?.deals ?? [],
    stores: data.grocery?.stores ?? data.stores ?? [],
    categories: data.grocery?.categories ?? [],
    recentlyViewed: data.grocery?.recently_viewed ?? [],
    banners: data.grocery?.banners ?? data.banners ?? [],
    promos: data.offers ?? data.grocery?.offers ?? [],
    serviceability: meta?.grocery_serviceability ?? null,
  };
}
