import type { GroceryRepository, MonthlySuggestion, DeliverySlot, ServiceablePage } from '../interfaces';
import { apiClient } from '@/shared/services/apiClient';
import { fetchDiscoveryHome, mapGroceryDiscovery } from '@/shared/services/discovery';
import type { Store, Product, Category } from '@/shared/types/catalog';
import type { MetaWithServiceability, Serviceability } from '@/shared/types/api';

/** Coordinate pair the backend resolves the delivery zone from. */
type Location = { latitude?: number; longitude?: number };

function withCoordinates(location?: Location): URLSearchParams {
  const qs = new URLSearchParams();
  if (location?.latitude != null) qs.set('latitude', String(location.latitude));
  if (location?.longitude != null) qs.set('longitude', String(location.longitude));
  return qs;
}

/**
 * Every grocery read below sends the requested delivery location: the backend
 * is the only authority on serviceability, and it answers with
 * `meta.serviceability` (Grocery verdict) so callers can render the
 * unavailable-location state instead of an unfiltered list.
 */
export class ApiGroceryRepository implements GroceryRepository {
  async getHome(location?: Location) {
    const { data, meta } = await fetchDiscoveryHome(location);
    return mapGroceryDiscovery(data, meta);
  }

  async getStores(params?: {
    search?: string;
    page?: number;
    per_page?: number;
    latitude?: number;
    longitude?: number;
  }): Promise<ServiceablePage<Store>> {
    const qs = withCoordinates(params);
    if (params?.search) qs.set('search', params.search);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.per_page) qs.set('per_page', String(params.per_page));
    const query = qs.toString();
    const { data, meta } = await apiClient.getWithMeta<
      ServiceablePage<Store>,
      MetaWithServiceability
    >(`/grocery/stores${query ? `?${query}` : ''}`);
    return { ...data, serviceability: meta?.serviceability ?? null };
  }

  async getStore(id: number, location?: Location): Promise<{ store: Store | null; serviceability: Serviceability | null }> {
    const query = withCoordinates(location).toString();
    const { data, meta } = await apiClient.getWithMeta<Store | null, MetaWithServiceability>(
      `/grocery/stores/${id}${query ? `?${query}` : ''}`
    );
    return { store: data ?? null, serviceability: meta?.serviceability ?? null };
  }

  async getProducts(
    storeId?: number,
    params?: {
      category_id?: number;
      brand_id?: number;
      search?: string;
      page?: number;
      per_page?: number;
      sort?: string;
      is_veg?: boolean;
      latitude?: number;
      longitude?: number;
    }
  ): Promise<ServiceablePage<Product>> {
    const qs = withCoordinates(params);
    if (params?.category_id) qs.set('category_id', String(params.category_id));
    if (params?.brand_id) qs.set('brand_id', String(params.brand_id));
    if (params?.search) qs.set('search', params.search);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.per_page) qs.set('per_page', String(params.per_page));
    if (params?.sort) qs.set('sort', params.sort);
    if (params?.is_veg !== undefined) qs.set('is_veg', params.is_veg ? '1' : '0');
    const query = qs.toString();
    const { data, meta } = await apiClient.getWithMeta<
      ServiceablePage<Product>,
      MetaWithServiceability
    >(
      storeId
        ? `/grocery/stores/${storeId}/products${query ? `?${query}` : ''}`
        : `/grocery/products${query ? `?${query}` : ''}`
    );
    return { ...data, serviceability: meta?.serviceability ?? null };
  }

  async getCategories(location?: Location): Promise<{ categories: Category[]; serviceability: Serviceability | null }> {
    const query = withCoordinates(location).toString();
    const { data, meta } = await apiClient.getWithMeta<Category[], MetaWithServiceability>(
      `/grocery/categories${query ? `?${query}` : ''}`
    );
    return { categories: data ?? [], serviceability: meta?.serviceability ?? null };
  }

  async getBrands(location?: Location): Promise<{ id: number; name: string }[]> {
    const query = withCoordinates(location).toString();
    return apiClient.get<{ id: number; name: string }[]>(
      `/grocery/brands${query ? `?${query}` : ''}`
    );
  }

  async getMonthlySuggestions(): Promise<MonthlySuggestion[]> {
    return apiClient.get<MonthlySuggestion[]>(`/ai/grocery/monthly`);
  }

  async getDeliverySlots(storeId: number, days?: number, location?: Location): Promise<DeliverySlot[]> {
    const qs = new URLSearchParams({ store_id: String(storeId) });
    if (days) qs.set('days', String(days));
    if (location?.latitude != null) qs.set('latitude', String(location.latitude));
    if (location?.longitude != null) qs.set('longitude', String(location.longitude));
    return apiClient.get<DeliverySlot[]>(`/grocery/delivery-slots?${qs.toString()}`);
  }
}
