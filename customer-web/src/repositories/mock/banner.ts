import type { BannerRepository } from '../interfaces';
import type { Banner } from '@/types/catalog';
import { mockBanners } from './data';

const delay = (ms = 200) => new Promise((r) => setTimeout(r, ms));

export class MockBannerRepository implements BannerRepository {
  async getByPlacement(service: 'all' | 'food' | 'grocery' | 'rides', placement: string): Promise<Banner[]> {
    await delay();
    return mockBanners.filter((b) => {
      if (b.placement !== placement && b.placement !== null) return false;
      return b.service === null || b.service === 'all' || b.service === service;
    });
  }
}