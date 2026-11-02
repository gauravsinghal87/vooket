import type { BannerRepository } from '../interfaces';
import { apiClient } from '@/shared/services/apiClient';
import type { Banner } from '@/shared/types/catalog';

export class ApiBannerRepository implements BannerRepository {
  async getByPlacement(service: 'all' | 'food' | 'grocery' | 'rides', placement: string): Promise<Banner[]> {
    const qs = new URLSearchParams({ service, placement });
    return apiClient.get<Banner[]>(`/banners?${qs.toString()}`);
  }
}