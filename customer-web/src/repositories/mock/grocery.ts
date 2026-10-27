import type { GroceryRepository, MonthlySuggestion, DeliverySlot } from '../interfaces';
import type { Paginated } from '@/types/api';
import {
  mockStores,
  mockProducts,
  mockCategories,
  mockGroceryHome,
  mockMonthlySuggestions,
  mockDeliverySlots,
} from './data';

const delay = (ms = 350) => new Promise((r) => setTimeout(r, ms));

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

export class MockGroceryRepository implements GroceryRepository {
  async getHome() {
    await delay();
    // `serviceability: null` = "the endpoint did not report a verdict", so the
    // mock keeps rendering its data instead of the unavailable-location state.
    return { ...mockGroceryHome, serviceability: null };
  }

  async getStores(params?: { search?: string; page?: number }) {
    await delay();
    let list = [...mockStores];
    if (params?.search) list = list.filter((s) => s.name.toLowerCase().includes(params.search!.toLowerCase()));
    return { ...paginate(list, params?.page ?? 1, 10), serviceability: null };
  }

  async getStore(id: number) {
    await delay(200);
    const s = mockStores.find((x) => x.id === id);
    if (!s) throw new Error('Store not found');
    return {
      store: { ...s, products: mockProducts.filter((p) => p.store_id === id) },
      serviceability: null,
    };
  }

  async getProducts(
    storeId?: number,
    params?: { category_id?: number; brand_id?: number; search?: string; page?: number; sort?: string }
  ) {
    await delay();
    let list = storeId ? mockProducts.filter((p) => p.store_id === storeId) : [...mockProducts];
    if (params?.category_id) list = list.filter((p) => p.category_id === params.category_id);
    if (params?.search) list = list.filter((p) => p.name.toLowerCase().includes(params.search!.toLowerCase()));
    if (params?.sort === 'low') list.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
    if (params?.sort === 'high') list.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
    return { ...paginate(list, params?.page ?? 1, 20), serviceability: null };
  }

  async getCategories() {
    await delay(150);
    return {
      categories: mockCategories.filter((c) => c.type === 'grocery' || c.type === null),
      serviceability: null,
    };
  }

  async getBrands() {
    await delay(100);
    return [
      { id: 1, name: 'Aashirvaad' },
      { id: 2, name: 'Amul' },
      { id: 3, name: 'Fortune' },
      { id: 4, name: 'Tata' },
      { id: 5, name: 'Surf Excel' },
    ];
  }

  async getMonthlySuggestions(): Promise<MonthlySuggestion[]> {
    await delay(400);
    return [...mockMonthlySuggestions];
  }

  async getDeliverySlots(storeId: number, days = 7): Promise<DeliverySlot[]> {
    await delay(200);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + days);
    const cutoffDate = cutoff.toISOString().slice(0, 10);

    return mockDeliverySlots.filter(
      (slot) => slot.store_id === storeId && slot.is_active && slot.availability > 0 && slot.slot_date <= cutoffDate
    );
  }
}
