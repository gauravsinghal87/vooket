import type { FoodRepository, ServiceablePage } from '../interfaces';
import type { Restaurant, ProductCategory, Category } from '@/types/catalog';
import type { Paginated, Serviceability } from '@/types/api';
import { mockRestaurants, mockCategories, mockMenu, mockFoodHome } from './data';

const delay = (ms = 350) => new Promise((r) => setTimeout(r, ms));

/**
 * The mock repository has no backend to ask, so it always reports a
 * serviceable location (the dev-only mock data is treated as in-zone).
 */
const mockServiceability: Serviceability = {
  is_serviceable: true,
  reason: null,
  service: 'food',
  zone_id: 1,
  zone_name: 'Mock Zone',
  search_radius_km: 20,
  allows_cross_zone_food_delivery: false,
};

function paginate<T>(items: T[], page: number, perPage: number): Paginated<T> {
  const total = items.length;
  const start = (page - 1) * perPage;
  const data = items.slice(start, start + perPage);
  const lastPage = Math.max(1, Math.ceil(total / perPage));
  return {
    current_page: page,
    data,
    first_page_url: null,
    from: start + 1,
    last_page: lastPage,
    last_page_url: null,
    next_page_url: page < lastPage ? 'next' : null,
    path: '/',
    per_page: perPage,
    prev_page_url: page > 1 ? 'prev' : null,
    to: start + data.length,
    total,
  };
}

export class MockFoodRepository implements FoodRepository {
  async getHome(_location?: { latitude?: number; longitude?: number }) {
    await delay();
    return { ...mockFoodHome, serviceability: mockServiceability };
  }

  async getRestaurants(params?: { cuisine?: string; search?: string; page?: number; sort?: string; category?: number | string }): Promise<ServiceablePage<Restaurant>> {
    await delay();
    let list = [...mockRestaurants];
    if (params?.cuisine) list = list.filter((r) => r.cuisine_type?.includes(params.cuisine!));
    if (params?.search) list = list.filter((r) => r.name.toLowerCase().includes(params.search!.toLowerCase()));
    return { ...paginate(list, params?.page ?? 1, 10), serviceability: mockServiceability };
  }

  async getRestaurant(id: number): Promise<Restaurant> {
    await delay(200);
    const r = mockRestaurants.find((x) => x.id === id);
    if (!r) throw new Error('Restaurant not found');
    return {
      ...r,
      menu: mockMenu.map((c) => ({ ...c, products: c.products.filter((p) => p.restaurant_id === id) })),
    };
  }

  async getMenu(id: number): Promise<ProductCategory[]> {
    await delay();
    return [
      ...mockMenu,
      {
        id: 100, name: 'Biryani', slug: 'biryani',
        products: [
          {
            id: 90, vendor_id: 1, store_id: null, restaurant_id: id, category_id: 1, brand_id: null,
            type: 'food', name: 'Hyderabadi Chicken Biryani', slug: 'chicken-biryani',
            description: 'Fragrant basmati rice layered with spicy chicken, served with raita.',
            price: '349', compare_at_price: '399', image: 'https://images.unsplash.com/photo-1563379926898-05f4575a45d8?auto=format&fit=crop&w=400&q=80',
            images: [], is_veg: false, is_featured: true, is_active: true, is_available: true,
            min_order_qty: 1, max_order_qty: null,
            tax_rate: '5', preparation_time_min: '25', addons: [], variants: [],
          },
        ],
      },
    ];
  }

  async getCategories(): Promise<Category[]> {
    await delay(150);
    return mockCategories.filter((c) => c.type === 'food' || c.type === null);
  }

  async getCuisines(): Promise<string[]> {
    await delay(100);
    return ['North Indian', 'Biryani', 'South Indian', 'Pizza & Fast Food', 'Healthy'];
  }
}
