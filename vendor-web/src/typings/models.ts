export type VendorType = 'restaurant' | 'grocery';
export type VendorStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

export interface VendorUser {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  country_code?: string | null;
  avatar?: string | null;
  user_type: string;
  is_active: boolean;
  is_verified: boolean;
  roles?: { id: number; name: string; slug: string }[];
  vendor: VendorProfile | null;
  wallet?: Wallet | null;
}

export interface VendorProfile {
  id: number;
  user_id: number;
  business_name: string;
  vendor_type: VendorType;
  owner_name: string | null;
  email: string | null;
  phone: string | null;
  gst_number?: string | null;
  pan_number?: string | null;
  fssai_number?: string | null;
  bank_account_name?: string | null;
  bank_account_number?: string | null;
  bank_ifsc?: string | null;
  bank_name?: string | null;
  logo?: string | null;
  cover_image?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  zone_id?: number | null;
  status: VendorStatus;
  rejection_reason?: string | null;
  commission_rate: string;
  is_active: boolean;
  rating?: number | null;
  approved_at?: string | null;
  wallet?: Wallet | null;
}

export interface Wallet {
  id: number;
  user_id: number;
  balance: string;
  wallet_type: string;
  currency?: string | null;
}

export interface VendorDashboard {
  counts: {
    vendor: {
      id: number;
      business_name: string;
      vendor_type: VendorType;
      status: string;
      commission_rate: number;
      is_active: boolean;
      rating: number;
    };
    total_orders: number;
    today_orders: number;
    pending_orders: number;
    active_orders: number;
    delivered_orders: number;
    cancelled_orders: number;
    today_revenue: number;
    total_revenue: number;
    total_products: number;
    active_products: number;
    out_of_stock: number;
    stores_count: number;
    restaurants_count: number;
  };
  revenue_series: { date: string; orders: number; revenue: number }[];
  status_distribution: { status: string; total: number }[];
  recent_orders: {
    id: number;
    order_number: string;
    order_type: string;
    status: string;
    payment_status: string;
    total_amount: number;
    created_at: string;
    user: { id: number; name: string; phone: string | null } | null;
  }[];
  top_products: {
    product_id: number;
    product_name: string;
    product_image: string | null;
    sold: number;
    revenue: number;
  }[];
}

export interface DeliverySlot {
  id: number;
  vendor_id: number;
  store_id: number;
  slot_date: string;
  start_time: string;
  end_time: string;
  shift?: string | null;
  slot_timezone: string;
  label: string;
  starts_at: string;
  ends_at: string;
  lead_time_min: number;
  max_orders: number;
  booked_orders: number;
  availability: number;
  is_active: boolean;
}

export interface DeliverySlotInput {
  store_id?: number;
  slot_date?: string;
  start_time?: string;
  end_time?: string;
  max_orders?: number;
  lead_time_min?: number;
  is_active?: boolean;
}

export interface DeliverySlotShift {
  start: string;
  end: string;
}

export interface DeliverySlotBulkInput {
  store_id: number;
  from_date: string;
  to_date: string;
  shifts: string[];
  max_orders?: number;
  lead_time_min?: number;
}

export interface DeliverySlotBulkResult {
  created: DeliverySlot[];
  skipped: { date: string; shift: string; reason: string }[];
  created_count: number;
  skipped_count: number;
}

export interface Outlet {
  id: number;
  type: 'store' | 'restaurant';
  name: string;
  slug: string;
  description?: string | null;
  cuisine_type?: string | null;
  address?: string | null;
  phone?: string | null;
  logo?: string | null;
  cover_image?: string | null;
  is_open: boolean;
  is_featured: boolean;
  opens_at?: string | null;
  closes_at?: string | null;
  avg_prep_time_min?: string | null;
  rating?: string | null;
  rating_count?: number;
  products_count: number;
  orders_count: number;
}

export interface Category {
  id: number;
  name: string;
  slug?: string;
  type?: string;
  image?: string | null;
  sort_order?: number;
}

export interface VendorCategory {
  id: number;
  vendor_id: number;
  store_id?: number | null;
  restaurant_id?: number | null;
  parent_id?: number | null;
  name: string;
  slug?: string | null;
  description?: string | null;
  image?: string | null;
  icon?: string | null;
  sort_order: number;
  is_active: boolean;
  meta?: Record<string, unknown> | null;
  children_count: number;
  products_count: number;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
  parent?: { id: number; name: string } | null;
}

export interface VendorCategoryOption {
  id: number;
  name: string;
  parent_id?: number | null;
  is_active: boolean;
}

export interface VendorCategoryDetail extends VendorCategory {
  parent: { id: number; name: string } | null;
  products: Array<{ id: number; name: string; price?: string | null; is_active: boolean; category?: { id: number; name: string } | null }>;
}

export type PlatformServiceType = 'food' | 'grocery';

export interface PlatformCategoryNode {
  id: number;
  name: string;
  slug?: string;
  type?: string;
  image?: string | null;
  sort_order?: number;
  is_active?: boolean;
  children_count?: number;
  products_count?: number;
  children?: PlatformCategoryNode[];
}

export interface PlatformCategoryView {
  service_type: PlatformServiceType;
  categories: PlatformCategoryNode[];
  selected_category_ids: number[];
  outlet: { id: number; type: 'restaurant' | 'store'; name: string } | null;
}

export interface Inventory {
  id?: number;
  quantity: number;
  reserved_quantity?: number;
  low_stock_threshold?: number;
  track_inventory?: boolean;
}

export type ProductType = 'simple' | 'variable';
export type SelectionType = 'SINGLE' | 'MULTIPLE';

export interface ProductOption {
  id: number;
  name: string;
  /** Canonical contract key; backend serializes this as `price_adjustment`. */
  price?: string | null;
  price_adjustment?: string | null;
  is_default?: boolean;
  /** Backend serialization key for availability. */
  is_available?: boolean;
  /** Canonical contract alias for availability. */
  is_active?: boolean;
  sort_order?: number;
}

export interface OptionGroup {
  id: number;
  name: string;
  /** Backend serialization key ('radio' | 'checkbox'). */
  type?: string;
  /** Canonical contract key. */
  selection_type?: SelectionType;
  /** Backend serialization key for selection mode. */
  is_multi_select?: boolean;
  is_required?: boolean;
  min_select?: number;
  max_select?: number;
  is_active?: boolean;
  sort_order?: number;
  values?: ProductOption[];
}

export interface VendorOrderItemOption {
  group_id: number;
  group_name: string;
  selection_type?: SelectionType | 'single' | 'multiple';
  group_is_active?: boolean;
  option_id: number;
  option_name: string;
  /** Backend serialization key for the option price. */
  price?: number | string | null;
  /** Canonical contract key for the option price. */
  option_price?: string | null;
  option_price_label?: string | null;
  option_is_available?: boolean;
}

export interface VendorProduct {
  id: number;
  name: string;
  slug?: string;
  sku?: string | null;
  description?: string | null;
  type?: string;
  product_type?: ProductType;
  category_id?: number | null;
  price: string;
  compare_at_price?: string | null;
  cost_price?: string | null;
  image?: string | null;
  is_veg?: boolean;
  is_featured?: boolean;
  is_active: boolean;
  is_available: boolean;
  unit_type?: string | null;
  unit_value?: string | null;
  unit_label?: string | null;
  tax_rate?: string | null;
  min_order_qty?: number;
  max_order_qty?: number | null;
  preparation_time_min?: number;
  restaurant_id?: number | null;
  store_id?: number | null;
  variants_count?: number;
  option_groups_count?: number;
  created_at?: string;
  category?: { id: number; name: string; slug?: string } | null;
  inventory?: Inventory | null;
  variants?: unknown[];
  addons?: unknown[];
  variation_options?: OptionGroup[];
}

export interface VendorOrderItem {
  id?: number;
  order_id: number;
  product_id?: number;
  product_name: string;
  quantity: number;
  unit_price: string;
  line_total: string;
  line_signature?: string | null;
  selected_options?: VendorOrderItemOption[] | null;
  meta?: Record<string, unknown> | null;
  product?: { id: number; name: string; image?: string | null };
}

export interface SelectedPreparationInstruction {
  key: string;
  label: string;
  emoji?: string;
}

export interface PreparationInstructions {
  selected: SelectedPreparationInstruction[];
  /** Legacy alias of `restaurant_note`, kept for historical orders. */
  note: string | null;
  restaurant_note: string | null;
  /** false means "Don't send cutlery". null means never specified. */
  send_cutlery: boolean | null;
  updated_at: string | null;
}

export interface VendorOrder {
  id: number;
  order_number: string;
  order_type: string;
  status: string;
  payment_status: string;
  payment_method?: string | null;
  subtotal?: string;
  discount_amount?: string;
  tax_amount?: string;
  delivery_fee?: string;
  packaging_fee?: string;
  platform_fee?: string;
  total_amount: string;
  coupon_code?: string | null;
  timing_type?: 'instant' | 'scheduled';
  scheduled_at?: string | null;
  delivery_slot_id?: number | null;
  customer_note?: string | null;
  meta?: Record<string, unknown> | null;
  preparation_time_min?: number;
  created_at: string;
  confirmed_at?: string | null;
  preparing_at?: string | null;
  ready_at?: string | null;
  out_for_delivery_at?: string | null;
  delivered_at?: string | null;
  cancelled_at?: string | null;
  cancel_reason?: string | null;
  user?: { id: number; name: string; phone: string | null } | null;
  delivery_partner_id?: number | null;
  deliveryPartner?: { id: number; user?: { id: number; name: string; phone: string | null } | null } | null;
  items?: VendorOrderItem[];
  dispatchLogs?: VendorDispatchLog[];
  statusHistory?: { id: number; status: string; notes?: string | null; changed_by_type?: string; created_at: string }[];
}

/** A delivery request targeting one delivery partner (DispatchLog). */
export interface VendorDispatchLog {
  id: number;
  dispatch_type?: string;
  order_id: number;
  candidate_id?: number;
  distance_km?: number | null;
  status: string;
  expires_at?: string | null;
  created_at?: string;
  meta?: Record<string, unknown> | null;
}

/** A service-matched delivery partner the vendor may manually target a Food or
 * Grocery order to. The list shows EVERY approved partner of the order's
 * service (online or not, near or far, with or without a live location), so
 * `distance_km` is nullable and `available_for_assignment` tells the UI which
 * partners the assign step would actually accept. Contact details and precise
 * coordinates are never included. */
export interface VendorDeliveryPartnerCandidate {
  id: number;
  name: string;
  distance_km: number | null;
  service?: string;
  service_label?: string;
  status?: 'online' | 'on_job' | 'offline';
  availability?: 'online' | 'on_job' | 'offline';
  is_online: boolean;
  is_busy: boolean;
  is_manual_order?: boolean;
  has_current_location?: boolean;
  available: boolean;
  available_for_assignment?: boolean;
  active_batch_order_count: number;
  vehicle_type?: string | null;
  rating: number;
  last_location_at?: string | null;
}

export interface VendorOrderAssignResult {
  order: VendorOrder;
  offer: {
    id: number;
    status: string;
    expires_at?: string | null;
    partner_id: number;
  };
}

export interface VendorCoupon {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  type: 'percent' | 'fixed';
  value: string;
  max_discount?: string | null;
  min_order_amount?: string | null;
  service?: string;
  usage_limit?: number | null;
  per_user_limit?: number | null;
  starts_at?: string | null;
  expires_at?: string | null;
  first_order_only?: boolean;
  is_active: boolean;
  status?: string;
  coupon_usages_count?: number;
  created_at?: string;
}

export interface EarningsOverview {
  vendor: { id: number; business_name: string; vendor_type: VendorType; commission_rate: number };
  wallet: Wallet | null;
  due_settlement: number;
  /**
   * Amount that must remain in the wallet after a payout, set by Super Admin.
   * This is a floor on the *remaining* balance, not on the request.
   */
  minimum_wallet_balance?: number;
  /**
   * Most that can be withdrawn right now: wallet balance less the floor, capped
   * by what the settlement balance also allows. This is the exact ceiling the
   * payout endpoint enforces.
   */
  max_withdrawable_amount?: number;
  total_settled: number;
  pending_payouts: number;
}

export interface Settlement {
  id: number;
  settlement_number: string;
  party_type: string;
  gross_earnings: string;
  total_commission: string;
  total_incentives: string;
  total_bonuses: string;
  total_adjustments: string;
  total_refunds: string;
  net_payable: string;
  status: string;
  period_start: string;
  period_end: string;
  period_type: string;
  paid_at?: string | null;
  settlement_items_count?: number;
  created_at?: string;
}

export interface Payout {
  id: number;
  payout_number: string;
  party_type: string;
  amount: string;
  currency: string;
  bank_account_name?: string | null;
  bank_ifsc?: string | null;
  bank_name?: string | null;
  status: string;
  mode?: string;
  failure_reason?: string | null;
  admin_remark?: string | null;
  processed_at?: string | null;
  created_at: string;
}
export interface PlaceResult {
  id: string;
  place_id?: string | null;
  name?: string | null;
  provider?: string | null;
  main: string;
  text: string;
  secondary: string | null;
  formatted_address?: string | null;
  address?: string | null;
  latitude: number | null;
  longitude: number | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
}

export interface SearchPlacesResponse {
  results: PlaceResult[];
  provider?: string | null;
  fallback?: boolean;
  correlation_id?: string | null;
}

export interface ReverseGeocode {
  latitude: number;
  longitude: number;
  address: string;
  formatted_address?: string | null;
  provider?: string | null;
  street: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  locality?: string | null;
  area?: string | null;
}

export interface ServiceabilityResult {
  serviceable: boolean;
  zone: { id: number; name: string } | null;
  service: string;
  reason: string | null;
}

export interface MapsClientConfig {
  enabled: boolean;
  provider: string | null;
  public_key: string | null;
  map_id?: string | null;
  default_center?: { latitude: number; longitude: number } | null;
  default_zoom?: number;
}
