import { api } from '@/lib/api';
import type {
  MapsClientConfig,
  ReverseGeocode,
  SearchPlacesResponse,
  ServiceabilityResult,
} from '@/typings/models';

export const mapApi = {
  config: (): Promise<MapsClientConfig> => api<MapsClientConfig>('/config/maps'),
  searchPlaces: (query: string, country?: string): Promise<SearchPlacesResponse> => {
    const params = new URLSearchParams({ q: query });
    if (country) params.set('country', country);
    return api<SearchPlacesResponse>(`/geocode/search?${params.toString()}`);
  },
  reverseGeocode: (latitude: number, longitude: number): Promise<ReverseGeocode> => {
    const params = new URLSearchParams({ lat: String(latitude), lng: String(longitude) });
    return api<ReverseGeocode>(`/geocode/reverse?${params.toString()}`);
  },
  serviceability: (latitude: number, longitude: number, service: string): Promise<ServiceabilityResult> => {
    const params = new URLSearchParams({ latitude: String(latitude), longitude: String(longitude), service });
    return api<ServiceabilityResult>(`/serviceability?${params.toString()}`);
  },
};
