export type RoleSlug = 'super_admin' | 'admin' | 'operations_admin' | 'finance_admin' | string;

export interface Role {
  id: number;
  name: string;
  slug: string;
  is_system: boolean;
  users_count?: number;
  permissions?: Permission[];
}

export interface Permission {
  id: number;
  name: string;
  slug: string;
  module: string;
}

export interface User {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  country_code?: string | null;
  avatar?: string | null;
  user_type: string;
  is_active: boolean;
  is_verified?: boolean;
  banned_at?: string | null;
  ban_reason?: string | null;
  referral_code?: string | null;
  rating?: string | number | null;
  last_login_at?: string | null;
  created_at: string;
  roles?: Role[];
  orders_count?: number;
  rides_count?: number;
  vendor?: {
    id: number;
    business_name: string;
    vendor_type: 'restaurant' | 'grocery' | string;
    status: string;
  } | null;
  wallet?: Wallet | null;
}

export interface Wallet {
  id: number;
  wallet_type: string;
  balance: string | number;
  pending_balance: string | number;
  total_credited: string | number;
  total_debited: string | number;
  currency: string;
  status: string;
}

export interface WalletTransaction {
  id: number;
  transaction_id: string;
  type: string;
  amount: string | number;
  balance_before: string | number;
  balance_after: string | number;
  direction: 'credit' | 'debit';
  status: string;
  description?: string | null;
  reference_type?: string | null;
  created_at: string;
}

export interface Vendor {
  id: number;
  business_name: string;
  vendor_type: 'restaurant' | 'grocery' | string;
  owner_name: string;
  email?: string | null;
  phone: string;
  gst_number?: string | null;
  pan_number?: string | null;
  fssai_number?: string | null;
  bank_account_name?: string | null;
  bank_account_number?: string | null;
  bank_ifsc?: string | null;
  bank_name?: string | null;
  logo?: string | null;
  cover_image?: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'suspended' | string;
  rejection_reason?: string | null;
  commission_rate: string | number;
  approved_at?: string | null;
  is_active: boolean;
  address?: string | null;
  created_at: string;
  restaurants_count?: number;
  stores_count?: number;
  products_count?: number;
  orders_count?: number;
  gross_order_value?: string | number;
  commission?: string | number;
  user?: User | null;
  restaurants?: Restaurant[];
  stores?: Store[];
}

export interface Restaurant {
  id: number;
  name: string;
  slug?: string;
  description?: string | null;
  cuisine_type?: string | null;
  address?: string | null;
  phone?: string | null;
  logo?: string | null;
  cover_image?: string | null;
  is_open: boolean;
  is_featured: boolean;
  dine_in?: boolean;
  is_veg?: boolean;
  opens_at?: string | null;
  closes_at?: string | null;
  rating?: string | number | null;
  rating_count?: number;
  min_order_amount?: string | number | null;
  delivery_fee?: string | number | null;
  products_count?: number;
  orders_count?: number;
  revenue?: string | number;
  vendor?: { id: number; business_name: string } | null;
}

export interface Store {
  id: number;
  name: string;
  slug?: string;
  store_type?: string;
  description?: string | null;
  address?: string | null;
  phone?: string | null;
  logo?: string | null;
  cover_image?: string | null;
  is_open: boolean;
  is_featured: boolean;
  opens_at?: string | null;
  closes_at?: string | null;
  rating?: string | number | null;
  rating_count?: number;
  products_count?: number;
  orders_count?: number;
  revenue?: string | number;
  vendor?: { id: number; business_name: string } | null;
}

export interface Inventory {
  id: number;
  quantity: string | number;
  reserved_quantity: string | number;
  low_stock_threshold: string | number;
  track_inventory: boolean;
}

export interface Product {
  id: number;
  name: string;
  slug?: string;
  description?: string | null;
  sku?: string | null;
  price: string | number;
  compare_at_price?: string | number | null;
  cost_price?: string | number | null;
  unit_type?: string | null;
  unit_value?: string | number | null;
  unit_label?: string | null;
  image?: string | null;
  is_veg?: boolean;
  is_featured?: boolean;
  is_active: boolean;
  is_available: boolean;
  tax_rate?: string | number | null;
  min_order_qty?: number;
  max_order_qty?: number;
  preparation_time_min?: number;
  created_at?: string;
  type?: string;
  category?: { id: number; name: string; slug?: string } | null;
  vendor?: { id: number; business_name: string; vendor_type?: string } | null;
  restaurant?: { id: number; name: string } | null;
  store?: { id: number; name: string } | null;
  inventory?: Inventory | null;
}

export interface OrderItem {
  id: number;
  product_id: number;
  product_name: string;
  product_image?: string | null;
  unit_price: string | number;
  quantity: number;
  line_total: string | number;
  status?: string;
}

export interface OrderStatusHistory {
  id: number;
  status: string;
  notes?: string | null;
  changed_by_type?: string | null;
  created_at: string;
}

export type OrderStatus =
  | 'PENDING'
  | 'PLACED'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'READY'
  | 'OUT_FOR_DELIVERY'
  | 'ARRIVED'
  | 'PICKED_UP'
  | 'PARTNER_ASSIGNED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'pending'
  | 'placed'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'out_for_delivery'
  | 'arrived'
  | 'picked_up'
  | 'partner_assigned'
  | 'delivered'
  | 'cancelled';

export interface Order {
  id: number;
  order_number: string;
  order_type: 'food' | 'grocery' | string;
  status: OrderStatus;
  payment_status: string;
  payment_method?: string | null;
  subtotal?: string | number;
  discount_amount?: string | number;
  tax_amount?: string | number;
  delivery_fee?: string | number;
  packaging_fee?: string | number;
  handling_fee?: string | number;
  platform_fee?: string | number;
  total_amount: string | number;
  wallet_used?: string | number;
  coupon_code?: string | null;
  tip_amount?: string | number;
  prepared_by_note?: string | null;
  customer_note?: string | null;
  scheduled_at?: string | null;
  created_at: string;
  user?: User | null;
  vendor?: { id: number; business_name: string; vendor_type?: string } | null;
  restaurant?: { id: number; name: string } | null;
  store?: { id: number; name: string } | null;
  items?: OrderItem[];
  statusHistory?: OrderStatusHistory[];
}

export type CouponStatus = 'active' | 'paused' | 'expired' | string;

export interface Coupon {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  type: 'percent' | 'fixed';
  value: string | number;
  max_discount?: string | number | null;
  min_order_amount?: string | number | null;
  service?: string | null;
  vendor_id?: number | null;
  usage_limit?: number | null;
  per_user_limit?: number | null;
  starts_at?: string | null;
  expires_at?: string | null;
  first_order_only?: boolean;
  is_active: boolean;
  status: CouponStatus;
  total_uses?: number;
  coupon_usages_count?: number;
  created_at?: string;
}

export interface Banner {
  id: number;
  title: string;
  subtitle?: string | null;
  image: string;
  position: string;
  target_id?: number | null;
  target_type?: string | null;
  target_url?: string | null;
  starts_at?: string | null;
  expires_at?: string | null;
  is_active: boolean;
  sort_order: number;
  created_at?: string;
}

export interface AppSetting {
  id: number;
  group: string;
  key: string;
  label: string;
  value?: string | number | boolean | null;
  type: 'string' | 'number' | 'boolean' | 'json' | 'array';
  is_public: boolean;
  sort_order: number;
}

export interface FeatureFlag {
  id: number;
  key: string;
  name: string;
  description?: string | null;
  enabled: boolean;
  created_at?: string;
}

export interface DeliveryFeeRule {
  id: number;
  name: string;
  service: string;
  base_fee: string | number;
  per_km: string | number;
  peak_fee: string | number;
  surge_multiplier: string | number;
  small_order_fee: string | number;
  min_order_for_free_delivery?: string | number | null;
  platform_fee: string | number;
  is_active: boolean;
}

export interface Driver {
  id: number;
  status: string;
  is_online: boolean;
  is_busy: boolean;
  is_verified: boolean;
  vehicle_number?: string | null;
  vehicle_model?: string | null;
  vehicle_color?: string | null;
  license_number?: string | null;
  rating?: string | number | null;
  total_trips?: number;
  last_location_at?: string | null;
  user?: User | null;
}

export interface DeliveryPartner {
  id: number;
  status: string;
  is_online: boolean;
  is_busy: boolean;
  vehicle_type?: string | null;
  vehicle_number?: string | null;
  rating?: string | number | null;
  total_deliveries?: number;
  total_earnings?: string | number | null;
  user?: User | null;
}

export interface Zone {
  id: number;
  name: string;
  code?: string;
  city_id?: number | null;
  is_active?: boolean;
  created_at?: string;
}

export interface VehicleType {
  id: number;
  name: string;
  code: string;
  base_fare?: string | number;
  capacity?: number;
  is_active?: boolean;
}

export interface DashboardCounts {
  total_users: number;
  active_users: number;
  total_vendors: number;
  pending_vendors: number;
  suspended_vendors: number;
  total_restaurants: number;
  total_stores: number;
  total_products: number;
  total_orders: number;
  total_drivers: number;
  total_delivery_partners: number;
  today_orders: number;
  today_gross_order_value: string | number;
  total_gross_order_value: string | number;
  today_platform_revenue: string | number;
  total_platform_revenue: string | number;
  delivered_orders: number;
}

export interface RevenuePoint {
  date: string;
  orders: number;
  gross_order_value: string | number;
  commission: string | number;
}

export interface StatusSlice {
  status: string;
  total: number;
}

export interface AdminDashboard {
  counts: DashboardCounts;
  revenue_series: RevenuePoint[];
  order_status_distribution: StatusSlice[];
  recent_orders: Order[];
  top_vendors: {
    id: number;
    business_name: string;
    vendor_type: string;
    status: string;
    orders_count: number;
    gross_order_value: string | number;
    commission: string | number;
  }[];
}