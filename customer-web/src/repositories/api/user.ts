import type { UserRepository } from '../interfaces';
import { apiClient } from '@/lib/apiClient';
import type { User, Address } from '@/types/catalog';
import type { Coupon, Order, Ride } from '@/types/models';
import type { Paginated } from '@/types/api';

type NotificationItem = { id: number; title: string; body: string; is_read: boolean; created_at: string };

export class ApiUserRepository implements UserRepository {
  async getProfile(): Promise<User> {
    return apiClient.get<User>(`/profile`);
  }

  async updateProfile(data: Partial<User>): Promise<User> {
    return apiClient.put<User>(`/profile`, data);
  }

  async getAddresses(): Promise<Address[]> {
    return apiClient.get<Address[]>(`/addresses`);
  }

  async createAddress(data: Partial<Address>): Promise<Address> {
    return apiClient.post<Address>(`/addresses`, data);
  }

  async updateAddress(id: number, data: Partial<Address>): Promise<Address> {
    return apiClient.put<Address>(`/addresses/${id}`, data);
  }

  async deleteAddress(id: number): Promise<void> {
    await apiClient.delete(`/addresses/${id}`);
  }

  async setDefaultAddress(id: number): Promise<Address> {
    return apiClient.post<Address>(`/addresses/${id}/default`);
  }

  async getNotifications(): Promise<NotificationItem[]> {
    const result = await apiClient.get<Paginated<NotificationItem> | NotificationItem[]>(`/notifications`);
    if (Array.isArray(result)) return result;
    return result?.data ?? [];
  }

  async getCoupons(): Promise<Coupon[]> {
    const result = await apiClient.get<Paginated<Coupon> | Coupon[]>(`/coupons`);
    if (Array.isArray(result)) return result;
    return result?.data ?? [];
  }

  async getActivity(): Promise<{ food: Order[]; grocery: Order[]; rides: Ride[] }> {
    const result = await apiClient.get<{
      food?: Order[];
      grocery?: Order[];
      rides?: Ride[];
      orders?: Order[];
    }>(`/activity`);

    return {
      food: result.food ?? (result.orders ?? []).filter((o) => o.order_type === 'food'),
      grocery: result.grocery ?? (result.orders ?? []).filter((o) => o.order_type === 'grocery'),
      rides: result.rides ?? [],
    };
  }

  async getSavedPlaces(): Promise<{ id: number; label: string; address: string; latitude?: string; longitude?: string }[]> {
    return apiClient.get<{ id: number; label: string; address: string; latitude?: string; longitude?: string }[]>(`/saved-places`);
  }

  async getAppConfig() {
    return apiClient.get<import('@/types/models').AppConfig>('/app-config');
  }

  async searchPlaces(query: string, country?: string) {
    const params = new URLSearchParams({ q: query });
    if (country) params.set('country', country);
    return apiClient.get<import('@/types/models').SearchPlacesResponse>(`/geocode/search?${params.toString()}`);
  }

  async placeDetails(placeId: string) {
    const params = new URLSearchParams({ place_id: placeId });
    return apiClient.get<import('@/types/models').PlaceDetails>(`/geocode/details?${params.toString()}`);
  }

  async reverseGeocode(latitude: number, longitude: number) {
    const params = new URLSearchParams({ lat: String(latitude), lng: String(longitude) });
    return apiClient.get<import('@/types/models').ReverseGeocode>(`/geocode/reverse?${params.toString()}`);
  }
}
