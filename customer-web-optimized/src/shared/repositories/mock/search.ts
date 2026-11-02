import type { SearchRepository } from '../interfaces';
import type { Serviceability } from '@/shared/types/api';
import { mockRestaurants, mockStores, mockProducts, mockCategories } from './data';

const delay = (ms = 250) => new Promise((r) => setTimeout(r, ms));

/** The mock data has no backend to ask, so it is always treated as in-zone. */
const mockServiceability: Serviceability = {
  is_serviceable: true,
  reason: null,
  service: 'food',
  zone_id: 1,
  zone_name: 'Mock Zone',
  search_radius_km: 20,
  allows_cross_zone_food_delivery: false,
};

/** The mock data has no backend to ask, so it is always treated as in-zone. */
const mockGroceryServiceability: Serviceability = {
  is_serviceable: true,
  reason: null,
  service: 'grocery',
  zone_id: 1,
  zone_name: 'Mock Zone',
  search_radius_km: 20,
  allows_cross_zone_grocery_delivery: false,
};

export class MockSearchRepository implements SearchRepository {
  async search(query: string, type?: string, _location?: { latitude?: number; longitude?: number }) {
    await delay();
    const q = query.toLowerCase();
    const isFood = !type || type === 'food';
    const isGrocery = !type || type === 'grocery';

    const restaurants = isFood
      ? mockRestaurants.filter(
          (r) => r.name.toLowerCase().includes(q) || (r.cuisine_type ?? '').toLowerCase().includes(q)
        )
      : [];
    const stores = isGrocery ? mockStores.filter((s) => s.name.toLowerCase().includes(q)) : [];
    const products = isGrocery
      ? mockProducts.filter((p) => p.name.toLowerCase().includes(q))
      : [];
    const categories = mockCategories.filter(
      (c) =>
        c.name.toLowerCase().includes(q) &&
        ((type === 'food' && c.type === 'food') || (type === 'grocery' && c.type === 'grocery') || !type)
    );

    return {
      query,
      restaurants,
      stores,
      products,
      categories,
      serviceability: mockServiceability,
      groceryServiceability: mockGroceryServiceability,
    };
  }
}
