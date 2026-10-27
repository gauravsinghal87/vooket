import type { RideRepository } from '../interfaces';
import { apiClient } from '@/lib/apiClient';
import type { VehicleType, RideEstimate, Ride, RideRoute, NearbyDriver, SavedPlace } from '@/types/models';
import type { Paginated } from '@/types/api';
import type { Offer } from '@/types/catalog';

export class ApiRideRepository implements RideRepository {
  async getPromos(): Promise<Offer[]> {
    return apiClient.get<Offer[]>(`/rides/promos`).catch(() => []);
  }
  async getVehicleTypes(): Promise<VehicleType[]> {
    return apiClient.get<VehicleType[]>(`/vehicle-types`);
  }

  async estimate(params: {
    pickup_latitude: number;
    pickup_longitude: number;
    destination_latitude: number;
    destination_longitude: number;
    vehicle_type_id?: number;
  }): Promise<RideEstimate[]> {
    return apiClient.post<RideEstimate[]>(`/rides/estimate`, params);
  }

  async getRoute(params: {
    pickup_latitude: number;
    pickup_longitude: number;
    destination_latitude: number;
    destination_longitude: number;
  }): Promise<RideRoute> {
    return apiClient.post<RideRoute>(`/rides/route`, params);
  }

  async getNearbyDrivers(params: {
    latitude: number;
    longitude: number;
    vehicle_type_id?: number;
    radius_km?: number;
  }): Promise<NearbyDriver[]> {
    const query = new URLSearchParams({
      latitude: String(params.latitude),
      longitude: String(params.longitude),
    });
    if (params.vehicle_type_id != null) query.set('vehicle_type_id', String(params.vehicle_type_id));
    if (params.radius_km != null) query.set('radius_km', String(params.radius_km));
    return apiClient.get<NearbyDriver[]>(`/rides/nearby-drivers?${query.toString()}`);
  }

  async book(params: {
    pickup_latitude: number;
    pickup_longitude: number;
    destination_latitude: number;
    destination_longitude: number;
    vehicle_type_id: number;
    pickup_address?: string;
    destination_address?: string;
    payment_method?: 'cash' | 'wallet' | 'online';
    scheduled_at?: string;
    idempotency_key?: string;
  }): Promise<Ride> {
    return apiClient.post<Ride>(`/rides`, params);
  }

  async getRide(id: number): Promise<Ride> {
    return apiClient.get<Ride>(`/rides/${id}`);
  }

  async getRideHistory(): Promise<Ride[]> {
    const result = await apiClient.get<Paginated<Ride> | Ride[]>(`/rides`);
    if (Array.isArray(result)) return result;
    return result?.data ?? [];
  }

  async cancel(id: number, reason?: string): Promise<Ride> {
    return apiClient.post<Ride>(`/rides/${id}/cancel`, { reason });
  }

  async rate(id: number, rating: number, comment?: string): Promise<void> {
    await apiClient.post(`/rides/${id}/rate`, { rating, comment });
  }

  async getSavedPlaces(): Promise<{ id: number; label: string; address: string; latitude?: string; longitude?: string }[]> {
    return apiClient.get<{ id: number; label: string; address: string; latitude?: string; longitude?: string }[]>(`/saved-places`);
  }

  async savePlace(data: { label: string; address: string; latitude: number; longitude: number; icon?: string }): Promise<SavedPlace> {
    return apiClient.post<SavedPlace>(`/saved-places`, data);
  }

  async deleteSavedPlace(id: number): Promise<void> {
    await apiClient.delete(`/saved-places/${id}`);
  }
}
