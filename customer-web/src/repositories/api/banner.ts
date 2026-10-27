import type { BannerRepository } from '../interfaces';
import { apiClient } from '@/lib/apiClient';
import type { Banner } from '@/types/catalog';

export class ApiBannerRepository implements BannerRepository {
  async getByPlacement(service: 'all' | 'food' | 'grocery' | 'rides', placement: string): Promise<Banner[]> {
    const qs = new URLSearchParams({ service, placement });
    return apiClient.get<Banner[]>(`/banners?${qs.toString()}`);
  }
}