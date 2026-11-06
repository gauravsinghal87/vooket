import type { FoodRepository, ServiceablePage } from '../interfaces';
import { apiClient } from '@/shared/services/apiClient';
import { fetchDiscoveryHome, mapFoodDiscovery } from '@/shared/services/discovery';
import type { Restaurant, ProductCategory, Category } from '@/shared/types/catalog';
import type { MetaWithServiceability } from '@/shared/types/api';

export class ApiFoodRepository implements FoodRepository {
  async getHome(location?: { latitude?: number; longitude?: number }) {
    const { data, meta } = await fetchDiscoveryHome(location);
    return mapFoodDiscovery(data, meta);
  }

  async getRestaurants(params?: { cuisine?: string; search?: string; page?: number; sort?: string; latitude?: number; longitude?: number; category?: number | string }): Promise<ServiceablePage<Restaurant>> {
    const qs = new URLSearchParams();
    if (params?.cuisine) qs.set('cuisine', params.cuisine);
    if (params?.search) qs.set('search', params.search);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.sort) qs.set('sort', params.sort);
    if (params?.latitude != null) qs.set('latitude', String(params.latitude));
    if (params?.longitude != null) qs.set('longitude', String(params.longitude));
    if (params?.category != null && params.category !== '') qs.set('category', String(params.category));
    const query = qs.toString();
    const { data, meta } = await apiClient.getWithMeta<ServiceablePage<Restaurant>, MetaWithServiceability>(
      `/food/restaurants${query ? `?${query}` : ''}`
    );

    return { ...data, serviceability: meta?.serviceability ?? null };
  }

  async getRestaurant(id: number): Promise<Restaurant> {
    return apiClient.get<Restaurant>(`/food/restaurants/${id}`);
  }

  async getMenu(id: number): Promise<ProductCategory[]> {
    return apiClient.get<ProductCategory[]>(`/food/restaurants/${id}/menu`);
  }

  async getCategories(): Promise<Category[]> {
    return apiClient.get<Category[]>(`/food/categories`);
  }

  async getCuisines(): Promise<string[]> {
    return apiClient.get<string[]>(`/food/cuisines`);
  }
}
