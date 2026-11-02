import { Platform } from 'react-native';
import { apiClient } from '@/shared/services/client';
import type { MetaWithServiceability, Paginated, Serviceability } from '@/shared/types/api';
import type {
  Category, Product, ProductCategory, Restaurant, Store, User, Address,
  Banner, Offer, Wallet, WalletTransaction,
} from '@/shared/types/catalog';
import type {
  Cart, Coupon, Order, OrderTracking, PaymentCheckoutPayload, PaymentVerifyResult,
  VehicleType, Ride, RideEstimate, RideRoute, NearbyDriver, AppConfig,
  SearchPlacesResponse, PlaceDetails, ReverseGeocode,
} from '@/shared/types/models';
import type { DeliverySlot } from '@/shared/types/slots';
import type { SupportFormOptions } from '@/shared/utils/support';

const unwrapCart = (result: unknown): Cart | { cart: null; items: [] } => {
  if (Array.isArray(result)) return { cart: null, items: [] };
  if (result && typeof result === 'object') {
    const obj = result as Record<string, unknown>;
    if (obj && 'items' in obj && 'cart' in obj) return (obj.cart as Cart) ?? { cart: null, items: [] };
    if (obj && 'items' in obj && 'cart_type' in obj) return obj as unknown as Cart;
  }
  return { cart: null, items: [] };
};

const unwrapNestedCart = (result: unknown): Cart => {
  if (result && typeof result === 'object' && 'cart' in (result as Record<string, unknown>)) {
    const nested = (result as { cart: Cart }).cart;
    if (nested) return nested;
  }
  return result as Cart;
};

const unwrapArray = <T>(result: Paginated<T> | T[]): T[] => {
  if (Array.isArray(result)) return result;
  return result?.data ?? [];
};

/**
 * A paginated list plus the backend's serviceability verdict for the location
 * the list was requested for. `serviceability` is null when the endpoint did
 * not report one.
 */
export type ServiceablePage<T> = Paginated<T> & {
  serviceability: Serviceability | null;
};

export const food = {
  async getHome(location?: { latitude?: number; longitude?: number }) {
    const qs = new URLSearchParams();
    if (location?.latitude != null) qs.set('latitude', String(location.latitude));
    if (location?.longitude != null) qs.set('longitude', String(location.longitude));
    const query = qs.toString();
    const { data, meta } = await apiClient.getWithMeta<Record<string, any>, MetaWithServiceability>(
      `/discovery/home${query ? `?${query}` : ''}`
    );
    return {
      recommended: data.recommended_restaurants ?? data.food?.recommended ?? [],
      popular: data.food?.popular ?? [],
      top: data.food?.top ?? [],
      fast: data.food?.fast ?? [],
      offers: data.food?.offers ?? [],
      recentlyOrdered: data.food?.recently_ordered ?? [],
      products: (data.food?.products ?? data.food?.recommended_products ?? []) as Product[],
      deals: (data.food?.deals ?? data.food?.recommended ?? []) as Product[],
      banners: data.food?.banners ?? data.banners ?? [],
      categories: data.categories ?? [],
      promos: data.offers ?? (data.food?.offers ?? []),
      serviceability: meta?.serviceability ?? null,
    };
  },
  async getRestaurants(params?: {
    cuisine?: string; search?: string; page?: number; sort?: string;
    latitude?: number; longitude?: number; category?: number | string;
  }): Promise<ServiceablePage<Restaurant>> {
    const qs = new URLSearchParams();
    if (params?.cuisine) qs.set('cuisine', params.cuisine);
    if (params?.search) qs.set('search', params.search);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.sort) qs.set('sort', params.sort);
    if (params?.latitude != null) qs.set('latitude', String(params.latitude));
    if (params?.longitude != null) qs.set('longitude', String(params.longitude));
    if (params?.category != null && params.category !== '') qs.set('category', String(params.category));
    const query = qs.toString();
    const { data, meta } = await apiClient.getWithMeta<Paginated<Restaurant>, MetaWithServiceability>(
      `/food/restaurants${query ? `?${query}` : ''}`
    );
    return { ...data, serviceability: meta?.serviceability ?? null };
  },
  getRestaurant(id: number): Promise<Restaurant> {
    return apiClient.get(`/food/restaurants/${id}`);
  },
  getMenu(id: number): Promise<ProductCategory[]> {
    return apiClient.get(`/food/restaurants/${id}/menu`);
  },
  getCategories(): Promise<Category[]> {
    return apiClient.get(`/food/categories`);
  },
  getCuisines(): Promise<string[]> {
    return apiClient.get(`/food/cuisines`);
  },
};

export const banners = {
  getByPlacement(service: 'all' | 'food' | 'grocery' | 'rides', placement: string): Promise<Banner[]> {
    const qs = new URLSearchParams({ service, placement });
    return apiClient.get(`/banners?${qs.toString()}`);
  },
};

/** Coordinate pair the backend resolves the delivery zone from. */
type DeliveryLocation = { latitude?: number; longitude?: number };

function withCoordinates(location?: DeliveryLocation): URLSearchParams {
  const qs = new URLSearchParams();
  if (location?.latitude != null) qs.set('latitude', String(location.latitude));
  if (location?.longitude != null) qs.set('longitude', String(location.longitude));
  return qs;
}

/**
 * Every grocery read below sends the requested delivery location: the backend
 * is the only authority on serviceability, and it answers with
 * `meta.serviceability` (Grocery verdict) so callers can render the
 * unavailable-location state instead of an unfiltered list. The app never
 * derives the zone itself.
 */
export const grocery = {
  async getHome(location?: DeliveryLocation) {
    const query = withCoordinates(location).toString();
    const { data, meta } = await apiClient.getWithMeta<Record<string, any>, MetaWithServiceability>(
      `/discovery/home${query ? `?${query}` : ''}`
    );
    return {
      buyAgain: data.grocery?.buy_again ?? [],
      monthlyEssentials: data.grocery?.monthly_essentials ?? [],
      recommended: data.grocery?.recommended ?? [],
      deals: data.grocery?.deals ?? [],
      stores: data.grocery?.stores ?? data.stores ?? [],
      categories: data.grocery?.categories ?? [],
      recentlyViewed: data.grocery?.recently_viewed ?? [],
      banners: data.grocery?.banners ?? data.banners ?? [],
      promos: data.offers ?? (data.grocery?.offers ?? []),
      // Shared endpoint: `meta.serviceability` belongs to Food, so the Grocery
      // verdict is read from its own key.
      serviceability: meta?.grocery_serviceability ?? null,
    };
  },
  async getStores(params?: {
    search?: string; page?: number; per_page?: number; latitude?: number; longitude?: number;
  }): Promise<ServiceablePage<Store>> {
    const qs = new URLSearchParams();
    if (params?.search) qs.set('search', params.search);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.per_page) qs.set('per_page', String(params.per_page));
    if (params?.latitude != null) qs.set('latitude', String(params.latitude));
    if (params?.longitude != null) qs.set('longitude', String(params.longitude));
    const query = qs.toString();
    const { data, meta } = await apiClient.getWithMeta<Paginated<Store>, MetaWithServiceability>(
      `/grocery/stores${query ? `?${query}` : ''}`
    );
    return { ...data, serviceability: meta?.serviceability ?? null };
  },
  /** `store` is null when the location cannot reach it — see `serviceability`. */
  async getStore(
    id: number,
    location?: DeliveryLocation
  ): Promise<{ store: Store | null; serviceability: Serviceability | null }> {
    const query = withCoordinates(location).toString();
    const { data, meta } = await apiClient.getWithMeta<Store | null, MetaWithServiceability>(
      `/grocery/stores/${id}${query ? `?${query}` : ''}`
    );
    return { store: data ?? null, serviceability: meta?.serviceability ?? null };
  },
  async getProducts(
    storeId?: number,
    params?: {
      category_id?: number; brand_id?: number; search?: string; page?: number;
      per_page?: number; sort?: string; is_veg?: boolean;
      latitude?: number; longitude?: number;
    }
  ): Promise<ServiceablePage<Product>> {
    const qs = withCoordinates(params);
    if (params?.category_id) qs.set('category_id', String(params.category_id));
    if (params?.brand_id) qs.set('brand_id', String(params.brand_id));
    if (params?.search) qs.set('search', params.search);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.per_page) qs.set('per_page', String(params.per_page));
    if (params?.sort) qs.set('sort', params.sort);
    if (params?.is_veg !== undefined) qs.set('is_veg', params.is_veg ? '1' : '0');
    const query = qs.toString();
    const { data, meta } = await apiClient.getWithMeta<Paginated<Product>, MetaWithServiceability>(
      storeId ? `/grocery/stores/${storeId}/products${query ? `?${query}` : ''}` : `/grocery/products${query ? `?${query}` : ''}`
    );
    return { ...data, serviceability: meta?.serviceability ?? null };
  },
  async getCategories(location?: DeliveryLocation): Promise<{
    categories: Category[];
    serviceability: Serviceability | null;
  }> {
    const query = withCoordinates(location).toString();
    const { data, meta } = await apiClient.getWithMeta<Category[], MetaWithServiceability>(
      `/grocery/categories${query ? `?${query}` : ''}`
    );
    return { categories: data ?? [], serviceability: meta?.serviceability ?? null };
  },
  getBrands(location?: DeliveryLocation): Promise<{ id: number; name: string }[]> {
    const query = withCoordinates(location).toString();
    return apiClient.get(`/grocery/brands${query ? `?${query}` : ''}`);
  },
  getMonthlySuggestions(): Promise<any[]> {
    return apiClient.get(`/ai/grocery/monthly`);
  },
  getDeliverySlots(storeId: number, days?: number, location?: DeliveryLocation): Promise<DeliverySlot[]> {
    const qs = new URLSearchParams({ store_id: String(storeId) });
    if (days) qs.set('days', String(days));
    if (location?.latitude != null) qs.set('latitude', String(location.latitude));
    if (location?.longitude != null) qs.set('longitude', String(location.longitude));
    return apiClient.get(`/grocery/delivery-slots?${qs.toString()}`);
  },
};

export const cart = {
  async getCart(): Promise<Cart | { cart: null; items: [] }> {
    const result = await apiClient.get<unknown>(`/cart`);
    return unwrapCart(result);
  },
  getByType(type: 'food' | 'grocery'): Promise<Cart | null> {
    const qs = new URLSearchParams({ type });
    return apiClient.get<unknown>(`/cart?${qs.toString()}`).then((result) => {
      const c = unwrapCart(result);
      return 'cart' in c ? (c.cart as Cart | null) : c;
    });
  },
  async addItem(data: {
    product_id: number;
    product_variant_id?: number | null;
    quantity: number;
    cart_type?: 'food' | 'grocery';
    selected_options?: { group_id: number; option_id: number }[] | null;
    selected_addons?: unknown;
    special_instructions?: string;
  }): Promise<Cart> {
    const result = await apiClient.post<unknown>(`/cart/items`, data);
    return unwrapNestedCart(result);
  },
  async updateItem(id: number, quantity: number): Promise<Cart> {
    const result = await apiClient.put<unknown>(`/cart/items/${id}`, { quantity });
    return unwrapNestedCart(result);
  },
  async removeItem(id: number): Promise<Cart> {
    const result = await apiClient.delete<unknown>(`/cart/items/${id}`);
    return unwrapNestedCart(result);
  },
  async applyCoupon(code: string): Promise<Cart> {
    const result = await apiClient.post<unknown>(`/cart/coupon`, { code });
    return unwrapNestedCart(result);
  },
  async removeCoupon(): Promise<Cart> {
    const result = await apiClient.delete<unknown>(`/cart/coupon`);
    return unwrapNestedCart(result);
  },
  async setDeliveryAddress(
    addressId: number | null,
    type: 'food' | 'grocery' = 'food',
    deliveryMode?: 'instant' | 'scheduled'
  ): Promise<Cart> {
    const result = await apiClient.post<unknown>(`/cart/delivery-address`, {
      address_id: addressId,
      cart_type: type,
      ...(type === 'grocery' && deliveryMode ? { delivery_mode: deliveryMode } : {}),
    });
    return unwrapNestedCart(result);
  },
  async clear(): Promise<void> {
    await apiClient.delete(`/cart`);
  },
};

export interface SupportTicketPayload {
  ticket_type: string;
  subject: string;
  description: string;
  reference_type: string;
  reference_id: number;
  issue_category: string;
  refund_destination: string;
  requested_refund_amount?: number;
}

export const support = {
  /**
   * The issue categories a customer may pick for a module. The API owns this
   * mapping so the app always offers exactly what the ticket endpoint accepts.
   */
  getIssueCategories(module: string): Promise<SupportFormOptions> {
    return apiClient.get(`/support-tickets/issue-categories?module=${encodeURIComponent(module)}`);
  },
  createTicket(body: SupportTicketPayload): Promise<any> {
    return apiClient.post('/support-tickets', body);
  },
  /** Same ticket payload as the web form, sent as multipart with evidence. */
  async createTicketWithAttachments(
    body: SupportTicketPayload,
    attachments: { uri: string; name: string; type: string }[]
  ): Promise<any> {
    const form = new FormData();
    form.append('ticket_type', body.ticket_type);
    form.append('subject', body.subject);
    form.append('description', body.description);
    form.append('reference_type', body.reference_type);
    form.append('reference_id', String(body.reference_id));
    form.append('issue_category', body.issue_category);
    form.append('refund_destination', body.refund_destination);
    if (body.requested_refund_amount !== undefined) {
      form.append('requested_refund_amount', String(body.requested_refund_amount));
    }
    for (const file of attachments) {
      if (Platform.OS === 'web') {
        // The browser's FormData only accepts a Blob, so the local file is
        // read back before it is attached.
        const response = await fetch(file.uri);
        form.append('attachments[]', await response.blob(), file.name);
        continue;
      }
      // React Native's FormData accepts a file descriptor for local files.
      form.append('attachments[]', {
        uri: file.uri,
        name: file.name,
        type: file.type,
      } as unknown as Blob);
    }
    return apiClient.postForm('/support-tickets', form);
  },
};

export const orders = {
  /**
   * History for exactly one module: the backend filters orders by module in
   * SQL (`orders.order_type`) or reads the rides table for `rides`, so the
   * client never receives another module's records to filter itself.
   */
  getHistory(
    module: 'food' | 'grocery' | 'rides',
    page?: number,
  ): Promise<Paginated<Order> | Paginated<Ride>> {
    const qs = new URLSearchParams({ module });
    if (page) qs.set('page', String(page));
    return apiClient.get(`/orders?${qs.toString()}`);
  },
  getOrders(params?: { status?: string; order_type?: string; page?: number }): Promise<Paginated<Order>> {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.order_type) qs.set('order_type', params.order_type);
    if (params?.page) qs.set('page', String(params.page));
    const query = qs.toString();
    return apiClient.get(`/orders${query ? `?${query}` : ''}`);
  },
  getOrder(id: number): Promise<Order> {
    return apiClient.get(`/orders/${id}`);
  },
  async createOrder(data: {
    order_type: 'food' | 'grocery';
    address_id?: number;
    payment_method?: string;
    order_idempotency_key?: string;
    idempotency_key?: string;
    customer_note?: string;
    tip_amount?: number;
    delivery_slot_id?: number;
    restaurant_note?: string;
    send_cutlery?: boolean;
  }): Promise<Order> {
    return apiClient.post(`/orders`, {
      ...data,
      idempotency_key: data.idempotency_key ?? data.order_idempotency_key,
    });
  },
  cancelOrder(id: number, reason?: string): Promise<Order> {
    return apiClient.post(`/orders/${id}/cancel`, { reason });
  },
  reorder(id: number): Promise<Order> {
    return apiClient.post(`/orders/${id}/reorder`);
  },
  rateOrder(id: number, rating: number, comment?: string): Promise<void> {
    return apiClient.post(`/orders/${id}/rate`, { rating, comment });
  },
  getOrderTracking(id: number): Promise<OrderTracking> {
    return apiClient.get(`/orders/${id}/tracking`);
  },
  getDeliveryOtp(id: number): Promise<{ otp: string; expires_at: string }> {
    return apiClient.get(`/orders/${id}/delivery-otp`);
  },
  getPreparationInstructions(id: number): Promise<any> {
    return apiClient.get(`/orders/${id}/preparation-instructions`);
  },
  updatePreparationInstructions(id: number, input: any): Promise<any> {
    return apiClient.patch(`/orders/${id}/preparation-instructions`, input);
  },
};

export const rides = {
  getPromos(): Promise<Offer[]> {
    return apiClient.get<Offer[]>(`/rides/promos`).catch((): Offer[] => []);
  },
  getVehicleTypes(): Promise<VehicleType[]> {
    return apiClient.get(`/vehicle-types`);
  },
  estimate(params: {
    pickup_latitude: number; pickup_longitude: number;
    destination_latitude: number; destination_longitude: number;
    vehicle_type_id?: number;
  }): Promise<RideEstimate[]> {
    return apiClient.post(`/rides/estimate`, params);
  },
  getRoute(params: {
    pickup_latitude: number; pickup_longitude: number;
    destination_latitude: number; destination_longitude: number;
  }): Promise<RideRoute> {
    return apiClient.post(`/rides/route`, params);
  },
  async getNearbyDrivers(params: {
    latitude: number; longitude: number; vehicle_type_id?: number; radius_km?: number;
  }): Promise<NearbyDriver[]> {
    const query = new URLSearchParams({
      latitude: String(params.latitude),
      longitude: String(params.longitude),
    });
    if (params.vehicle_type_id != null) query.set('vehicle_type_id', String(params.vehicle_type_id));
    if (params.radius_km != null) query.set('radius_km', String(params.radius_km));
    return apiClient.get(`/rides/nearby-drivers?${query.toString()}`);
  },
  book(params: {
    pickup_latitude: number; pickup_longitude: number;
    destination_latitude: number; destination_longitude: number;
    vehicle_type_id: number;
    pickup_address?: string; destination_address?: string;
    payment_method?: 'cash' | 'wallet' | 'online';
    scheduled_at?: string;
    idempotency_key?: string;
  }): Promise<Ride> {
    return apiClient.post(`/rides`, params);
  },
  getRide(id: number): Promise<Ride> {
    return apiClient.get(`/rides/${id}`);
  },
  async getRideHistory(): Promise<Ride[]> {
    const result = await apiClient.get<Paginated<Ride> | Ride[]>(`/rides`);
    if (Array.isArray(result)) return result;
    return result?.data ?? [];
  },
  cancel(id: number, reason?: string): Promise<Ride> {
    return apiClient.post(`/rides/${id}/cancel`, { reason });
  },
  rate(id: number, rating: number, comment?: string): Promise<void> {
    return apiClient.post(`/rides/${id}/rate`, { rating, comment });
  },
  getSavedPlaces(): Promise<{ id: number; label: string; address: string; latitude?: string; longitude?: string }[]> {
    return apiClient.get(`/saved-places`);
  },
  savePlace(data: { label: string; address: string; latitude: number; longitude: number; icon?: string }): Promise<{ id: number; label: string; address: string; latitude?: string; longitude?: string; icon?: string | null }> {
    return apiClient.post(`/saved-places`, data);
  },
  deleteSavedPlace(id: number): Promise<void> {
    return apiClient.delete(`/saved-places/${id}`);
  },
};

export const wallet = {
  getWallet(): Promise<Wallet> {
    return apiClient.get(`/wallet`);
  },
  async getTransactions(): Promise<WalletTransaction[]> {
    const result = await apiClient.get<Paginated<WalletTransaction> | WalletTransaction[]>(`/wallet/transactions`);
    return unwrapArray(result);
  },
  topup(amount: number): Promise<{ wallet?: Wallet; transaction?: WalletTransaction }> {
    return apiClient.post(`/wallet/topup`, { amount });
  },
  async verifyTopup(payload: unknown): Promise<{ balance: string }> {
    const result = await apiClient.post<{ wallet?: { balance?: string | number } }>(`/wallet/verify-payment`, payload);
    return { balance: result.wallet?.balance != null ? String(result.wallet.balance) : '0' };
  },
};

export const payments = {
  initiate(data: {
    payable_type: 'order' | 'ride';
    payable_id: number;
    payment_method: 'upi' | 'card' | 'net_banking' | 'wallet';
    idempotency_key?: string;
  }): Promise<PaymentCheckoutPayload> {
    return apiClient.post(`/payments/initiate`, data);
  },
  verify(data: {
    payment_number: string;
    provider_payment_id: string;
    provider_order_id: string;
    signature: string;
  }): Promise<PaymentVerifyResult> {
    return apiClient.post(`/payments/verify`, data);
  },
};

type NotificationItem = { id: number; title: string; body: string; is_read: boolean; created_at: string };

export const user = {
  getProfile(): Promise<User> {
    return apiClient.get(`/profile`);
  },
  updateProfile(data: Partial<User>): Promise<User> {
    return apiClient.put(`/profile`, data);
  },
  getAddresses(): Promise<Address[]> {
    return apiClient.get(`/addresses`);
  },
  createAddress(data: Partial<Address>): Promise<Address> {
    return apiClient.post(`/addresses`, data);
  },
  updateAddress(id: number, data: Partial<Address>): Promise<Address> {
    return apiClient.put(`/addresses/${id}`, data);
  },
  deleteAddress(id: number): Promise<void> {
    return apiClient.delete(`/addresses/${id}`);
  },
  setDefaultAddress(id: number): Promise<Address> {
    return apiClient.post(`/addresses/${id}/default`);
  },
  async getNotifications(): Promise<NotificationItem[]> {
    const result = await apiClient.get<Paginated<NotificationItem> | NotificationItem[]>(`/notifications`);
    return unwrapArray(result);
  },
  async getCoupons(): Promise<Coupon[]> {
    const result = await apiClient.get<Paginated<Coupon> | Coupon[]>(`/coupons`);
    return unwrapArray(result);
  },
  async getActivity(): Promise<{ food: Order[]; grocery: Order[]; rides: Ride[] }> {
    const result = await apiClient.get<{ food?: Order[]; grocery?: Order[]; rides?: Ride[]; orders?: Order[] }>(`/activity`);
    return {
      food: result.food ?? (result.orders ?? []).filter((o) => o.order_type === 'food'),
      grocery: result.grocery ?? (result.orders ?? []).filter((o) => o.order_type === 'grocery'),
      rides: result.rides ?? [],
    };
  },
  getSavedPlaces(): Promise<{ id: number; label: string; address: string; latitude?: string; longitude?: string }[]> {
    return apiClient.get(`/saved-places`);
  },
  savePlace(data: { label: string; address: string; latitude: number; longitude: number; icon?: string }): Promise<{ id: number; label: string; address: string; latitude?: string; longitude?: string; icon?: string | null }> {
    return apiClient.post(`/saved-places`, data);
  },
  deleteSavedPlace(id: number): Promise<void> {
    return apiClient.delete(`/saved-places/${id}`);
  },
  getAppConfig(): Promise<AppConfig> {
    return apiClient.get(`/app-config`);
  },
  searchPlaces(query: string, country?: string): Promise<SearchPlacesResponse> {
    const params = new URLSearchParams({ q: query });
    if (country) params.set('country', country);
    return apiClient.get(`/geocode/search?${params.toString()}`);
  },
  placeDetails(placeId: string): Promise<PlaceDetails> {
    const params = new URLSearchParams({ place_id: placeId });
    return apiClient.get(`/geocode/details?${params.toString()}`);
  },
  reverseGeocode(latitude: number, longitude: number): Promise<ReverseGeocode> {
    const params = new URLSearchParams({ lat: String(latitude), lng: String(longitude) });
    return apiClient.get(`/geocode/reverse?${params.toString()}`);
  },
};

export const search = {
  async search(query: string, type?: string, location?: { latitude?: number; longitude?: number }) {
    const qs = new URLSearchParams({ query });
    if (type) qs.set('type', type);
    if (location?.latitude != null) qs.set('latitude', String(location.latitude));
    if (location?.longitude != null) qs.set('longitude', String(location.longitude));
    const { data, meta } = await apiClient.getWithMeta<
      {
        restaurants?: Restaurant[]; stores?: Store[]; products?: Product[];
        categories?: Category[]; food?: Restaurant[]; grocery?: Store[];
      },
      MetaWithServiceability
    >(`/discovery/search?${qs.toString()}`);
    return {
      restaurants: (data.restaurants ?? data.food ?? []) as Restaurant[],
      stores: (data.stores ?? data.grocery ?? []) as Store[],
      products: (data.products ?? []) as Product[],
      categories: (data.categories ?? []) as Category[],
      serviceability: meta?.serviceability ?? null,
      groceryServiceability: meta?.grocery_serviceability ?? null,
    };
  },
};

export const auth = {
  sendOtp(phone: string): Promise<{ token: string }> {
    return apiClient.post(`/auth/otp/send`, { phone, country_code: '+91', purpose: 'login' });
  },
  loginWithEmail(email: string, password: string): Promise<{ token: string; user: User }> {
    return apiClient.post(`/auth/login/email`, { email, password });
  },
  loginWithPhone(phone: string, password: string): Promise<{ token: string; user: User }> {
    return apiClient.post(`/auth/login`, { phone, password, country_code: '+91' });
  },
  loginWithOtp(phone: string, otp: string, token: string): Promise<{ token: string; user: User }> {
    return apiClient.post(`/auth/otp/verify`, { phone, otp, token, country_code: '+91' });
  },
  loginWithGoogle(credential: string): Promise<{ token: string; user: User }> {
    return apiClient.post(`/auth/google`, { credential });
  },
  register(payload: {
    name: string; phone: string; email?: string; password: string;
    password_confirmation: string; country_code?: string;
  }): Promise<{ token: string; user: User }> {
    return apiClient.post(`/auth/register`, payload);
  },
  forgotPassword(email: string) {
    return apiClient.postWithMessage<null>(`/auth/forgot-password`, { email });
  },
  resetPassword(payload: {
    token: string; email: string; password: string; password_confirmation: string;
  }): Promise<void> {
    return apiClient.post(`/auth/reset-password`, payload);
  },
  logout(): Promise<void> {
    return apiClient.post(`/auth/logout`);
  },
};

export const repositories = { food, grocery, rides, orders, cart, wallet, payments, user, search, banners, auth, support };