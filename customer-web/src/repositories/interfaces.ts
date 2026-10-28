import type {
  Restaurant,
  Store,
  Product,
  ProductCategory,
  Category,
  Address,
  Wallet,
  WalletTransaction,
  User,
  Banner,
  Offer,
} from '@/types/catalog';
import type {
  Cart,
  Coupon,
  Order,
  OrderTracking,
  PaymentCheckoutPayload,
  PaymentVerifyResult,
  VehicleType,
  Ride,
  RideEstimate,
  RideRoute,
  NearbyDriver,
  PreparationInstructionsPayload,
  UpdatePreparationInstructionsInput,
} from '@/types/models';
import type { Paginated, Serviceability, ServiceType } from '@/types/api';

/**
 * A paginated list plus the backend's serviceability verdict for the location
 * the list was requested for. `serviceability` is null when the endpoint did
 * not report one (e.g. a non-zone endpoint).
 */
export type ServiceablePage<T> = Paginated<T> & {
  serviceability: Serviceability | null;
};

export interface FoodRepository {
  getHome(location?: {
    latitude?: number;
    longitude?: number;
  }): Promise<{
    recommended: Restaurant[];
    popular: Restaurant[];
    top: Restaurant[];
    fast: Restaurant[];
    offers: Restaurant[];
    recentlyOrdered: Restaurant[];
    products: Product[];
    deals: Product[];
    banners: Banner[];
    /** Active Food categories, used by the discovery rail on the home page. */
    categories: Category[];
    promos: Offer[];
    /** Backend verdict for the requested delivery location. */
    serviceability: Serviceability | null;
  }>;
  getRestaurants(params?: {
    cuisine?: string;
    search?: string;
    page?: number;
    sort?: string;
    latitude?: number;
    longitude?: number;
    /** Food category ID (or slug); narrows to restaurants selling matching items. */
    category?: number | string;
  }): Promise<ServiceablePage<Restaurant>>;
  getRestaurant(id: number): Promise<Restaurant>;
  getMenu(id: number): Promise<ProductCategory[]>;
  getCategories(): Promise<Category[]>;
  getCuisines(): Promise<string[]>;
}

/**
 * Placement-scoped banner lookup.
 *
 * Every page queries only the placement it renders, keyed by placement in the
 * query cache (e.g. `['banners', 'food_home_hero']`), so a banner configured for
 * one placement can never leak into another.
 */
export interface BannerRepository {
  getByPlacement(
    service: 'all' | 'food' | 'grocery' | 'rides',
    placement: string
  ): Promise<Banner[]>;
}

export interface GroceryRepository {
  getHome(location?: {
    latitude?: number;
    longitude?: number;
  }): Promise<{
    buyAgain: Product[];
    monthlyEssentials: MonthlySuggestion[];
    recommended: Product[];
    deals: Product[];
    stores: Store[];
    categories: Category[];
    recentlyViewed: Product[];
    banners: Banner[];
    promos: Offer[];
    /**
     * Grocery verdict for the requested delivery location (`meta.
     * grocery_serviceability` on `/discovery/home`). Surfaces must render the
     * unavailable-location state when it reports `is_serviceable === false`
     * instead of falling back to the unfiltered rails.
     */
    serviceability: Serviceability | null;
  }>;
  getStores(params?: {
    search?: string;
    page?: number;
    per_page?: number;
    latitude?: number;
    longitude?: number;
  }): Promise<ServiceablePage<Store>>;
  /** `store` is null when the location cannot reach it — see `serviceability`. */
  getStore(
    id: number,
    location?: { latitude?: number; longitude?: number }
  ): Promise<{ store: Store | null; serviceability: Serviceability | null }>;
  getProducts(storeId?: number, params?: {
    category_id?: number;
    brand_id?: number;
    search?: string;
    page?: number;
    per_page?: number;
    sort?: string;
    is_veg?: boolean;
    latitude?: number;
    longitude?: number;
  }): Promise<ServiceablePage<Product>>;
  getCategories(location?: {
    latitude?: number;
    longitude?: number;
  }): Promise<{ categories: Category[]; serviceability: Serviceability | null }>;
  getBrands(location?: { latitude?: number; longitude?: number }): Promise<{ id: number; name: string }[]>;
  getMonthlySuggestions(): Promise<MonthlySuggestion[]>;
  getDeliverySlots(
    storeId: number,
    days?: number,
    location?: { latitude?: number; longitude?: number }
  ): Promise<DeliverySlot[]>;
}

export interface MonthlySuggestion {
  id: number;
  product: Product;
  recommendedQuantity: number;
  unitLabel: string;
  lastPurchased: string;
  suggestedReorderDate: string;
  isEssential: boolean;
}

export interface DeliverySlot {
  id: number;
  vendor_id: number;
  store_id: number;
  slot_date: string;
  start_time: string;
  end_time: string;
  slot_timezone: string;
  label: string;
  starts_at: string;
  ends_at: string;
  lead_time_min: number;
  max_orders: number;
  availability: number;
  is_active: boolean;
}

export interface RideRepository {
  getVehicleTypes(): Promise<VehicleType[]>;
  getPromos(): Promise<Offer[]>;
  estimate(params: {
    pickup_latitude: number;
    pickup_longitude: number;
    destination_latitude: number;
    destination_longitude: number;
    vehicle_type_id?: number;
  }): Promise<RideEstimate[]>;
  getRoute(params: {
    pickup_latitude: number;
    pickup_longitude: number;
    destination_latitude: number;
    destination_longitude: number;
  }): Promise<RideRoute>;
  getNearbyDrivers(params: {
    latitude: number;
    longitude: number;
    vehicle_type_id?: number;
    radius_km?: number;
  }): Promise<NearbyDriver[]>;
  book(params: {
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
  }): Promise<Ride>;
  getRide(id: number): Promise<Ride>;
  getRideHistory(): Promise<Ride[]>;
  cancel(id: number, reason?: string): Promise<Ride>;
  rate(id: number, rating: number, comment?: string): Promise<void>;
  getSavedPlaces(): Promise<{ id: number; label: string; address: string; latitude?: string; longitude?: string }[]>;
  savePlace(data: { label: string; address: string; latitude: number; longitude: number; icon?: string }): Promise<import('@/types/models').SavedPlace>;
  deleteSavedPlace(id: number): Promise<void>;
}

/**
 * One page of module history: `food` / `grocery` pages carry orders, `rides`
 * pages carry ride bookings. The caller narrows with the module it asked for.
 */
export type OrderHistoryPage = Paginated<Order> | Paginated<Ride>;

export interface OrderRepository {
  /**
   * History for exactly one module. The module is sent to the API, which
   * filters in SQL (`orders.order_type`) or reads the rides table — the client
   * never receives another module's records to filter itself.
   */
  getHistory(module: ServiceType, page?: number): Promise<OrderHistoryPage>;
  getOrders(params?: { status?: string; order_type?: string; page?: number }): Promise<Paginated<Order>>;
  getOrder(id: number): Promise<Order>;
  createOrder(data: {
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
  }): Promise<Order>;
  cancelOrder(id: number, reason?: string): Promise<Order>;
  reorder(id: number): Promise<Order>;
  rateOrder(id: number, rating: number, comment?: string): Promise<void>;
  getOrderTracking(id: number): Promise<OrderTracking>;
  getDeliveryOtp(id: number): Promise<{ otp: string; expires_at: string }>;
  getPreparationInstructions(id: number): Promise<PreparationInstructionsPayload>;
  updatePreparationInstructions(id: number, input: UpdatePreparationInstructionsInput): Promise<PreparationInstructionsPayload>;
}

export interface CartRepository {
  getCart(type?: 'food' | 'grocery'): Promise<Cart | { cart: null; items: [] }>;
  getByType(type: 'food' | 'grocery'): Promise<Cart | null>;
  addItem(data: {
    product_id: number;
    quantity: number;
    cart_type?: 'food' | 'grocery';
    product_variant_id?: number | null;
    selected_options?: { group_id: number; option_id: number }[] | null;
    selected_addons?: unknown;
    special_instructions?: string;
  }): Promise<Cart>;
  updateItem(id: number, quantity: number): Promise<Cart>;
  removeItem(id: number): Promise<Cart>;
  applyCoupon(code: string): Promise<Cart>;
  removeCoupon(): Promise<Cart>;
  /**
   * Selecting a Grocery delivery mode reprices the cart against the matching
   * configuration (Instant or Scheduled) so the checkout preview matches what
   * the order will be charged.
   */
  setDeliveryAddress(addressId: number | null, type?: 'food' | 'grocery', deliveryMode?: 'instant' | 'scheduled'): Promise<Cart>;
  clear(): Promise<void>;
}

export interface WalletRepository {
  getWallet(): Promise<Wallet>;
  getTransactions(): Promise<WalletTransaction[]>;
  topup(amount: number): Promise<{ wallet?: Wallet; transaction?: WalletTransaction }>;
  verifyTopup(payload: unknown): Promise<{ balance: string }>;
}

export interface PaymentRepository {
  initiate(data: {
    payable_type: 'order' | 'ride';
    payable_id: number;
    payment_method: 'upi' | 'card' | 'net_banking' | 'wallet';
    idempotency_key?: string;
  }): Promise<PaymentCheckoutPayload>;
  verify(data: {
    payment_number: string;
    provider_payment_id: string;
    provider_order_id: string;
    signature: string;
  }): Promise<PaymentVerifyResult>;
}

export interface UserRepository {
  getProfile(): Promise<User>;
  updateProfile(data: Partial<User>): Promise<User>;
  getAddresses(): Promise<Address[]>;
  createAddress(data: Partial<Address>): Promise<Address>;
  updateAddress(id: number, data: Partial<Address>): Promise<Address>;
  deleteAddress(id: number): Promise<void>;
  setDefaultAddress(id: number): Promise<Address>;
  getNotifications(): Promise<{ id: number; title: string; body: string; is_read: boolean; created_at: string }[]>;
  getCoupons(): Promise<Coupon[]>;
  getActivity(): Promise<{ food: Order[]; grocery: Order[]; rides: Ride[] }>;
  getSavedPlaces(): Promise<{ id: number; label: string; address: string; latitude?: string; longitude?: string }[]>;
  getAppConfig(): Promise<import('@/types/models').AppConfig>;
  searchPlaces(query: string, country?: string): Promise<import('@/types/models').SearchPlacesResponse>;
  placeDetails(placeId: string): Promise<import('@/types/models').PlaceDetails>;
  reverseGeocode(latitude: number, longitude: number): Promise<import('@/types/models').ReverseGeocode>;
}

export interface SearchRepository {
  search(
    query: string,
    type?: string,
    location?: { latitude?: number; longitude?: number }
  ): Promise<{
    restaurants: Restaurant[];
    stores: Store[];
    products: Product[];
    categories: Category[];
    /** Backend verdict for the requested delivery location (Food). */
    serviceability: Serviceability | null;
    /** Grocery verdict for the same coordinates (`grocery_serviceability`). */
    groceryServiceability: Serviceability | null;
  }>;
}
