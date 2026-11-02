import type { FoodRepository, ServiceablePage } from '../interfaces';
import { apiClient } from '@/shared/services/apiClient';
import type { Restaurant, ProductCategory, Category, Product } from '@/shared/types/catalog';
import type { MetaWithServiceability } from '@/shared/types/api';

export class ApiFoodRepository implements FoodRepository {
  async getHome(location?: { latitude?: number; longitude?: number }) {
    const qs = new URLSearchParams();
    if (location?.latitude != null) qs.set('latitude', String(location.latitude));
    if (location?.longitude != null) qs.set('longitude', String(location.longitude));
    const query = qs.toString();
    const { data, meta } = await apiClient.getWithMeta<any, MetaWithServiceability>(
      `/discovery/home${query ? `?${query}` : ''}`
    );
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
      promos: data.offers ?? (data.food?.offers ?? []),
      serviceability: meta?.serviceability ?? null,
    };
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
