import type { UserRepository } from '../interfaces';
import type { User, Address } from '@/types/catalog';
import type { Coupon } from '@/types/models';
import { mockRestaurants, mockStores, mockProducts, mockCategories, mockSavedPlaces } from './data';
import { mockState, createOrderFromCart } from './mockState';

const delay = (ms = 300) => new Promise((r) => setTimeout(r, ms));

const mockUser: User = {
  id: 1,
  name: 'Aarav Sharma',
  email: 'aarav@example.com',
  phone: '9876543210',
  country_code: '+91',
  avatar: null,
  user_type: 'customer',
  referral_code: 'AARAV10',
};

const mockAddresses: Address[] = [
  {
    id: 1, user_id: 1, label: 'Home', contact_name: 'Aarav Sharma', contact_phone: '9876543210',
    address_line_1: '12, MG Road', address_line_2: 'Near Metro Station', landmark: 'Green Park',
    city: 'New Delhi', state: 'Delhi', postal_code: '110001', country: 'India',
    latitude: '28.6139', longitude: '77.2090', type: 'delivery', is_default: true, meta: null,
  },
  {
    id: 2, user_id: 1, label: 'Work', contact_name: 'Aarav Sharma', contact_phone: '9876543210',
    address_line_1: 'Cyber City, Tower B', address_line_2: null, landmark: null,
    city: 'Gurugram', state: 'Haryana', postal_code: '122002', country: 'India',
    latitude: '28.4595', longitude: '77.0266', type: 'delivery', is_default: false, meta: null,
  },
];

const notifications = [
  { id: 1, title: 'Order delivered', body: 'Your Spice Villa order was delivered.', is_read: false, created_at: new Date(Date.now() - 3600000).toISOString() },
  { id: 2, title: '₹50 cashback', body: 'Cashback credited to your wallet. Enjoy!', is_read: false, created_at: new Date(Date.now() - 4 * 3600000).toISOString() },
  { id: 3, title: 'Welcome to SuperBasket', body: 'Get 10% off your first order.', is_read: true, created_at: new Date(Date.now() - 2 * 86400000).toISOString() },
];

const coupons: Coupon[] = [
  { id: 1, code: 'FIRST50', name: '50% off up to ₹100', description: 'On your first order of ₹249+', type: 'percentage', value: '50', max_discount: '100', min_order_amount: '249', service: 'food', starts_at: new Date(Date.now() - 7 * 86400000).toISOString(), expires_at: new Date(Date.now() + 30 * 86400000).toISOString(), first_order_only: true, is_active: true, status: 'active' },
  { id: 2, code: 'WELCOME10', name: 'Flat 10% off', description: 'Minimum order ₹299', type: 'percentage', value: '10', max_discount: '75', min_order_amount: '299', service: 'all', starts_at: new Date(Date.now() - 7 * 86400000).toISOString(), expires_at: new Date(Date.now() + 15 * 86400000).toISOString(), first_order_only: true, is_active: true, status: 'active' },
  { id: 3, code: 'GROCERY20', name: '₹20 off groceries', description: 'On grocery orders of ₹399+', type: 'fixed', value: '20', max_discount: null, min_order_amount: '399', service: 'grocery', starts_at: new Date(Date.now() - 7 * 86400000).toISOString(), expires_at: new Date(Date.now() + 10 * 86400000).toISOString(), first_order_only: false, is_active: true, status: 'active' },
  { id: 4, code: 'RIDE15', name: '15% off rides', description: 'Up to ₹60 off on your next ride', type: 'percentage', value: '15', max_discount: '60', min_order_amount: '150', service: 'ride', starts_at: new Date(Date.now() - 7 * 86400000).toISOString(), expires_at: new Date(Date.now() + 7 * 86400000).toISOString(), first_order_only: false, is_active: true, status: 'active' },
];

function seedOrdersForActivity() {
  if (mockState.orders.length) return mockState.orders;
  const cart = {
    cart_type: 'food' as const,
    vendor_id: 1,
    subtotal: '540.00',
    discount: '50.00',
    tax: '27.00',
    delivery_fee: '30.00',
    delivery_gst_percent: '18',
    delivery_gst_amount: '5.40',
    total: '547.00',
    coupon_code: 'FIRST50',
    items_count: 3,
    id: 1, user_id: 1, session_id: null, items: [],
  };
  mockState.orders.push(createOrderFromCart(cart as never));
  return mockState.orders;
}

export class MockUserRepository implements UserRepository {
  async getProfile(): Promise<User> {
    await delay();
    return { ...mockUser };
  }

  async updateProfile(data: Partial<User>): Promise<User> {
    await delay(300);
    Object.assign(mockUser, data);
    return { ...mockUser };
  }

  async getAddresses(): Promise<Address[]> {
    await delay(200);
    return [...mockAddresses];
  }

  async createAddress(data: Partial<Address>): Promise<Address> {
    await delay(300);
    const addr: Address = {
      id: mockAddresses.length + 1,
      user_id: 1,
      label: data.label ?? 'Other',
      contact_name: data.contact_name ?? mockUser.name,
      contact_phone: data.contact_phone ?? mockUser.phone,
      address_line_1: data.address_line_1 ?? '',
      address_line_2: data.address_line_2 ?? null,
      landmark: data.landmark ?? null,
      city: data.city ?? '',
      state: data.state ?? null,
      postal_code: data.postal_code ?? null,
      country: data.country ?? 'India',
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
      type: data.type ?? 'delivery',
      is_default: data.is_default ?? mockAddresses.length === 0,
      meta: null,
    };
    mockAddresses.push(addr);
    return addr;
  }

  async updateAddress(id: number, data: Partial<Address>): Promise<Address> {
    await delay(300);
    const idx = mockAddresses.findIndex((a) => a.id === id);
    if (idx < 0) throw new Error('Address not found');
    mockAddresses[idx] = { ...mockAddresses[idx], ...data };
    return mockAddresses[idx];
  }

  async deleteAddress(id: number): Promise<void> {
    await delay(200);
    const idx = mockAddresses.findIndex((a) => a.id === id);
    if (idx >= 0) mockAddresses.splice(idx, 1);
  }

  async setDefaultAddress(id: number): Promise<Address> {
    await delay(200);
    mockAddresses.forEach((a) => (a.is_default = a.id === id));
    return mockAddresses.find((a) => a.id === id)!;
  }

  async getNotifications() {
    await delay(200);
    return [...notifications];
  }

  async getCoupons(): Promise<Coupon[]> {
    await delay(200);
    return coupons;
  }

  async getActivity() {
    await delay(300);
    const orders = seedOrdersForActivity();
    return {
      food: orders.filter((o) => o.order_type === 'food'),
      grocery: orders.filter((o) => o.order_type === 'grocery'),
      rides: [],
    };
  }

  async getSavedPlaces() {
    await delay(150);
    return [...mockSavedPlaces];
  }

  async getAppConfig() {
    await delay(100);
    return {
      maps: { enabled: false, provider: null, public_key: null },
      captcha: { enabled: false, site_key: null },
      analytics: { enabled: false, key: null },
      media: { enabled: false, cloud_name: null },
    };
  }

  async searchPlaces() {
    await delay(100);
    return { results: [] };
  }

  async placeDetails(placeId: string): Promise<import('@/types/models').PlaceDetails> {
    void placeId;
    await delay(100);
    throw new Error('place_details_not_supported_in_mock');
  }

  async reverseGeocode(latitude: number, longitude: number): Promise<import('@/types/models').ReverseGeocode> {
    void latitude;
    void longitude;
    await delay(100);
    throw new Error('reverse_geocode_not_supported_in_mock');
  }
}

export { mockRestaurants, mockStores, mockProducts, mockCategories };
