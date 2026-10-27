export interface Location {
  label: string;
  address: string;
  latitude: number;
  longitude: number;
  place_id?: string | null;
  formatted_address?: string | null;
  locality?: string | null;
  area?: string | null;
}

export type Service = 'food' | 'grocery' | 'rides';

export interface Banner {
  id: number;
  title: string;
  subtitle: string | null;
  image: string | null;
  cta_text: string | null;
  /**
   * Target service. `null` on legacy banners and `'all'` on banners the Admin
   * aimed at every service — both mean "show on any service home".
   */
  service: Service | 'all' | null;
  placement?: string | null;
  media_type?: 'image' | 'video' | null;
  video?: string | null;
  poster_image?: string | null;
  target_type: 'restaurant' | 'store' | 'product' | 'search' | 'service' | 'url' | null;
  target_id: number | null;
  target_url: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface Offer {
  id: number;
  title: string;
  subtitle: string | null;
  tag: string | null;
  type: 'percentage' | 'flat' | 'buy_x_get_y';
  value: number | null;
  code: string | null;
  service: Service;
  min_order: string | null;
  ends_at: string | null;
}

export interface User {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  country_code: string;
  avatar: string | null;
  referral_code: string | null;
  user_type: 'customer' | 'vendor' | 'driver' | 'delivery_partner' | 'admin';
  currency?: string;
  language?: string;
  is_verified?: boolean;
  created_at?: string;
}

export interface Address {
  id: number;
  user_id?: number;
  label: string;
  contact_name: string | null;
  contact_phone: string | null;
  address_line_1: string;
  address_line_2: string | null;
  landmark: string | null;
  city: string;
  state: string | null;
  postal_code: string | null;
  country: string;
  place_id?: string | null;
  formatted_address?: string | null;
  latitude: string | null;
  longitude: string | null;
  type: 'delivery' | 'pickup' | 'billing';
  is_default: boolean;
  meta: Record<string, unknown> | null;
}

export interface Wallet {
  id: number;
  user_id: number;
  wallet_type: string;
  balance: string;
  pending_balance: string;
  total_credited: string;
  total_debited: string;
  currency: string;
  status: 'active' | 'frozen' | 'closed';
}

export type WalletTransactionType =
  | 'CREDIT'
  | 'DEBIT'
  | 'REFUND'
  | 'COMMISSION'
  | 'PAYOUT'
  | 'SETTLEMENT'
  | 'BONUS'
  | 'INCENTIVE'
  | 'CASH_COLLECTION'
  | 'ADJUSTMENT'
  | 'REVERSAL'
  | 'TOP_UP'
  | 'PURCHASE'
  | 'WITHDRAWAL';

export interface WalletTransaction {
  id: number;
  transaction_id: string;
  wallet_id: number;
  type: WalletTransactionType;
  amount: string;
  balance_before: string;
  balance_after: string;
  currency: string;
  direction: 'credit' | 'debit';
  status: string;
  reference_type: string | null;
  reference_id: number | null;
  description: string | null;
  created_at: string;
}

export type CategoryDisplayPlacement = 'top_navigation' | 'main_content' | 'both';

export interface Category {
  id: number;
  name: string;
  slug: string;
  icon: string | null;
  image: string | null;
  navigation_icon: string | null;
  display_placement?: CategoryDisplayPlacement | null;
  description: string | null;
  parent_id: number | null;
  type: string | null;
  sort_order: number;
  is_active: boolean;
  children?: Category[];
}

export interface FeaturedItem {
  name: string;
  price: number | string;
}

/**
 * Browsing delivery estimate computed by the backend for the requesting
 * customer location. `status` is `estimated` when a range is present,
 * `closed` when the restaurant's schedule is shut, and `unavailable` when the
 * backend could not produce a trustworthy range (missing coordinates/route).
 */
export interface DeliveryEta {
  status: 'estimated' | 'partner_assigned' | 'unavailable' | 'closed';
  min_minutes: number | null;
  max_minutes: number | null;
  preparation_minutes: number;
  pickup_minutes: number | null;
  pickup_source: 'partner' | 'fallback';
  travel_minutes: number | null;
  travel_distance_km: number | null;
  route_source: string | null;
  buffer_minutes: number;
  approximate: boolean;
  reason: string | null;
  computed_at: string;
}

export interface Restaurant {
  id: number;
  vendor_id: number;
  name: string;
  slug: string;
  description: string | null;
  cuisine_type: string | null;
  address: string | null;
  latitude: string;
  longitude: string;
  phone: string | null;
  logo: string | null;
  cover_image: string | null;
  opens_at: string | null;
  closes_at: string | null;
  is_open: boolean;
  /** Schedule-based availability computed by the backend from opens_at/closes_at. */
  is_open_now?: boolean;
  /** Backend-computed browsing delivery estimate for the requesting location. */
  delivery_eta?: DeliveryEta | null;
  is_featured: boolean;
  is_veg: boolean;
  is_halal: boolean;
  dine_in: boolean;
  avg_prep_time_min: string;
  avg_delivery_time_min: string;
  rating: string;
  rating_count: number;
  min_order_amount: string;
  delivery_fee: string;
  free_delivery_above: string | null;
  order_type: 'delivery' | 'pickup' | 'both';
  avg_rating?: string | null;
  review_count?: number;
  menu?: ProductCategory[] | null;
  products?: Product[];
  featured_item?: FeaturedItem | null;
  vendor?: { id: number; business_name: string } | null;
}

export interface Store {
  id: number;
  vendor_id: number;
  name: string;
  slug: string;
  description: string | null;
  store_type: 'supermarket' | 'local' | 'convenience' | 'specialty';
  address: string | null;
  latitude: string;
  longitude: string;
  phone: string | null;
  logo: string | null;
  cover_image: string | null;
  opens_at: string | null;
  closes_at: string | null;
  is_open: boolean;
  is_featured: boolean;
  rating: string;
  rating_count: number;
  min_order_amount: string;
  delivery_fee: string;
  order_type: 'delivery' | 'pickup' | 'both';
  supports_instant_delivery: boolean;
  supports_scheduled_delivery: boolean;
  substitution_policy: 'contact' | 'auto' | 'none';
  free_delivery_above?: string | null;
  avg_rating?: string | null;
  review_count?: number;
  products?: Product[];
}

export interface Brand {
  id: number;
  name: string;
  logo?: string | null;
  description?: string | null;
  is_active?: boolean;
}

export interface Addon {
  id: number;
  name: string;
  type: 'single' | 'multiple';
  min_select?: number;
  max_select?: number;
  options?: AddonOption[];
}

export interface AddonOption {
  id: number;
  name: string;
  price: string;
  is_default?: boolean;
}

export interface ProductVariant {
  id: number;
  product_id: number;
  name: string;
  sku?: string | null;
  price: string;
  compare_at_price: string | null;
  cost_price?: string | null;
  color?: string | null;
  size?: string | null;
  weight?: string | null;
  image?: string | null;
  is_active: boolean;
  attributes?: Record<string, unknown> | null;
}

export interface ProductOption {
  id: number;
  name: string;
  price_adjustment?: string | null;
  price?: string | null;
  is_default?: boolean;
  is_available?: boolean;
  is_active?: boolean;
  sort_order?: number;
}

export interface OptionGroup {
  id: number;
  product_id?: number;
  name: string;
  type?: string;
  selection_type?: 'SINGLE' | 'MULTIPLE';
  is_multi_select?: boolean;
  is_required?: boolean;
  min_select?: number;
  max_select?: number;
  is_active?: boolean;
  sort_order?: number;
  values?: ProductOption[];
}

export interface Product {
  id: number;
  vendor_id: number;
  store_id: number | null;
  restaurant_id: number | null;
  category_id: number | null;
  brand_id: number | null;
  type: 'food' | 'grocery';
  product_type?: 'simple' | 'variable';
  name: string;
  slug: string;
  description: string | null;
  sku?: string | null;
  price: string;
  compare_at_price: string | null;
  cost_price?: string | null;
  unit_type?: string | null;
  unit_value?: string | null;
  unit_label?: string | null;
  min_order_qty: number;
  max_order_qty: number | null;
  image: string | null;
  images: string[] | null;
  is_veg: boolean | null;
  is_featured: boolean;
  is_active: boolean;
  is_available: boolean;
  tax_rate: string;
  preparation_time_min: string | null;
  nutrition_info?: Record<string, unknown> | null;
  ingredients?: string[] | null;
  expiry_date?: string | null;
  addons?: Addon[];
  variants?: ProductVariant[];
  variation_options?: OptionGroup[];
  category?: Category | null;
  brand?: Brand | null;
}

export interface ProductCategory {
  id: number;
  name: string;
  slug: string;
  products: Product[];
}
