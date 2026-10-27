import type { SearchRepository } from '../interfaces';
import { apiClient } from '@/lib/apiClient';
import type { Restaurant, Store, Product, Category } from '@/types/catalog';
import type { MetaWithServiceability } from '@/types/api';

export class ApiSearchRepository implements SearchRepository {
  async search(query: string, type?: string, location?: { latitude?: number; longitude?: number }) {
    const qs = new URLSearchParams({ query });
    if (type) qs.set('type', type);
    if (location?.latitude != null) qs.set('latitude', String(location.latitude));
    if (location?.longitude != null) qs.set('longitude', String(location.longitude));

    const { data, meta } = await apiClient.getWithMeta<
      {
        restaurants?: Restaurant[];
        stores?: Store[];
        products?: Product[];
        categories?: Category[];
        food?: Restaurant[];
        grocery?: Store[];
      },
      MetaWithServiceability
    >(`/discovery/search?${qs.toString()}`);

    return {
      restaurants: (data.restaurants ?? data.food ?? []) as Restaurant[],
      stores: (data.stores ?? data.grocery ?? []) as Store[],
      products: (data.products ?? []) as Product[],
      categories: (data.categories ?? []) as Category[],
      serviceability: meta?.serviceability ?? null,
      groceryServiceability: meta?.grocery_serviceability ?? null,
    };
  }
}
