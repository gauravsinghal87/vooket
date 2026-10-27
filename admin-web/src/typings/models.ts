export type ServiceType = 'food' | 'grocery' | 'rides';

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  country_code?: string | null;
  avatar?: string | null;
  user_type?: string | null;
  is_active: boolean;
  is_verified?: boolean;
  banned_at?: string | null;
  ban_reason?: string | null;
  referral_code?: string | null;
  last_login_at?: string | null;
  email_verified_at?: string | null;
  phone_verified_at?: string | null;
  rating?: string | null;
  rating_count?: number;
  created_at: string;
  updated_at?: string;
  roles?: { id: number; name: string; slug: string }[];
  orders_count?: number;
  rides_count?: number;
  wallet?: { id: number; balance: string; wallet_type?: string } | null;
  vendor?: { id: number; user_id: number; business_name: string; vendor_type: string; status: string } | null;
}

export type VendorStatus = 'pending' | 'approved' | 'rejected' | 'suspended';
export type VendorType = 'restaurant' | 'grocery';

export interface AdminVendor {
  id: number;
  business_name: string;
  vendor_type: VendorType;
  owner_name: string | null;
  email: string | null;
  phone: string | null;
  status: VendorStatus;
  rejection_reason?: string | null;
  commission_rate: number;
  approved_at?: string | null;
  is_active: boolean;
  logo?: string | null;
  cover_image?: string | null;
  restaurants_count?: number;
  stores_count?: number;
  products_count?: number;
  orders_count?: number;
  gross_order_value?: number;
  commission?: number;
  created_at: string;
  user?: { id: number; name?: string; email?: string; phone?: string | null } | null;
}

export interface AdminVendorDetail extends AdminVendor {
  address?: string | null;
  gst_number?: string | null;
  pan_number?: string | null;
  fssai_number?: string | null;
  bank_account_name?: string | null;
  bank_account_number?: string | null;
  bank_ifsc?: string | null;
  bank_name?: string | null;
  latitude?: string | null;
  longitude?: string | null;
  products_count?: number;
  orders_count?: number;
  restaurants?: { id: number; name: string; cuisine_type?: string | null; is_open: boolean }[];
  stores?: { id: number; name: string; store_type?: string | null; is_open: boolean }[];
  vendorDocuments?: {
    id: number;
    type: string;
    file_path: string;
    filename: string;
    status: string;
    rejection_reason?: string | null;
    reviewed_at?: string | null;
  }[];
  user?: { id: number; name?: string; email?: string; phone?: string | null } | null;
}

export interface AdminOrder {
  id: number;
  order_number: string;
  order_type: ServiceType;
  status: string;
  payment_status: string;
  payment_method?: string | null;
  total_amount: string;
  subtotal?: string;
  discount_amount?: string;
  tax_amount?: string;
  delivery_fee?: string;
  coupon_code?: string | null;
  timing_type?: 'instant' | 'scheduled';
  scheduled_at?: string | null;
  created_at: string;
  user?: { id: number; name: string; email?: string; phone?: string | null } | null;
  vendor?: { id: number; business_name: string; vendor_type: VendorType } | null;
  service?: 'food' | 'grocery' | 'ride';
  completed_at?: string | null;
  driver?: { id: number; name?: string | null; phone?: string | null; vehicle_number?: string | null } | null;
  vehicle_type?: string | null;
  pickup?: { address?: string | null; latitude?: number | null; longitude?: number | null } | null;
  drop?: { address?: string | null; latitude?: number | null; longitude?: number | null } | null;
  distance_km?: number | null;
  duration_min?: number | null;
  base_fare?: string | null;
  distance_charge?: string | null;
  time_charge?: string | null;
  waiting_charge?: string | null;
  platform_fee?: string | null;
  estimated_fare?: string | null;
  final_fare?: string | null;
  driver_earning?: string | null;
  admin_commission?: string | null;
  commission_percentage?: number | null;
  items?: AdminOrderItem[];
  packaging_fee?: string;
  handling_fee?: string;
  tip_amount?: string;
  wallet_used?: string;
  round_off?: string;
  delivery_partner?: { id: number; name?: string | null; phone?: string | null } | null;
  manual_assignable?: boolean;
  active_dispatch_offer?: AdminDispatchOffer | null;
  commission_fee?: string | null;
  net_vendor_payout?: string | null;
  vendor_payout_status?: string | null;
  vendor_payout_at?: string | null;
  partner_payout?: string | null;
  partner_payout_status?: string | null;
  partner_payout_at?: string | null;
  refund_amount?: string | null;
  refund_status?: string | null;
  refunded_at?: string | null;
  financial?: AdminOrderFinancial;
}

export interface AdminOrderPayment {
  id: number;
  payment_number: string;
  amount: string;
  method?: string | null;
  gateway?: string | null;
  provider_reference?: string | null;
  status: string;
  paid_at?: string | null;
  verified_at?: string | null;
  failed_at?: string | null;
  failure_reason?: string | null;
  transaction_statuses?: string[];
}

/** The latest live (pending/accepted) dispatch offer for an order. */
export interface AdminDispatchOffer {
  id: number;
  status: string;
  partner_id: number;
  distance_km?: number | null;
  mode: string;
  assigned_by: string;
  expires_at?: string | null;
}

/** A service-matched delivery partner the admin may manually target a Food or
 * Grocery order to. The list shows EVERY approved partner of the order's
 * service (online or not, near or far, with or without a live location), so
 * `distance_km` is nullable and `available_for_assignment` tells the UI which
 * partners the assign step would actually accept. Contact details and precise
 * coordinates are never included. */
export interface AdminDeliveryPartnerCandidate {
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

export interface AdminOrderAssignResult {
  order: AdminOrder;
  offer: {
    id: number;
    status: string;
    expires_at?: string | null;
    partner_id: number;
  };
}

export interface AdminWalletTransaction {
  id: number;
  transaction_id: string;
  type: string;
  service?: string | null;
  amount: string;
  direction: string;
  status: string;
  description?: string | null;
  created_at?: string | null;
}

export interface AdminVendorSettlement {
  settlement_number: string;
  status: string;
  period_type: string;
  period_start?: string | null;
  period_end?: string | null;
  gross_earnings: string;
  total_commission: string;
  total_incentives: string;
  total_bonuses: string;
  total_adjustments: string;
  total_refunds: string;
  net_payable: string;
  paid_at?: string | null;
  payout_status?: string | null;
}

export interface AdminCommission {
  commission_number: string;
  gross_amount: string;
  commission_amount: string;
  commission_rate: string;
  net_amount: string;
  status: string;
}

export interface AdminPartnerEarning {
  earning_number: string;
  amount: string;
  type: string;
  status: string;
  paid_at?: string | null;
  payout_status?: string | null;
  customer_delivery_fee: string;
  admin_funded: string;
}

export interface AdminOrderRefund {
  refund_number: string;
  amount: string;
  status: string;
  reason?: string | null;
  approved_at?: string | null;
  processed_at?: string | null;
}

export interface AdminOrderFinancial {
  order_bill: {
    subtotal: string;
    packaging_fee: string;
    handling_fee: string;
    platform_fee: string;
    delivery_fee: string;
    tip_amount: string;
    wallet_used: string;
    discount_amount: string;
    tax_amount: string;
    round_off: string;
    coupon_code?: string | null;
    total_amount: string;
  };
  payments: AdminOrderPayment[];
  wallet_transactions: AdminWalletTransaction[];
  vendor_settlement: AdminVendorSettlement | null;
  commissions: AdminCommission[];
  partner_earnings: AdminPartnerEarning[];
  platform: {
    platform_fee: string;
    commission_fee: string | null;
    admin_funded_delivery: string;
  };
  refunds: AdminOrderRefund[];
}

export interface AdminOrderItem {
  id: number;
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price: string;
  line_total: string;
  selected_options: {
    group_id: number;
    group_name: string;
    selection_type: 'SINGLE' | 'MULTIPLE' | string;
    option_id: number;
    option_name: string;
    price: number | string;
  }[];
}

export interface AdminDispatchLog {
  id: number;
  dispatch_type?: string;
  order_id: number;
  ride_id?: number | null;
  candidate_id?: number | null;
  candidate_type: string;
  distance_km?: string | null;
  status: string;
  expires_at?: string | null;
  created_at?: string | null;
  order?: {
    id: number;
    order_number?: string;
    order_type?: string;
    status?: string;
    total_amount?: string;
    delivery_partner_id?: number | null;
  } | null;
  ride?: {
    id: number;
    ride_number?: string;
    status?: string;
    estimated_fare?: string;
  } | null;
  delivery_partner?: { id: number; user?: { id: number; name?: string; phone?: string | null } | null } | null;
  driver?: { id: number; user?: { id: number; name?: string; phone?: string | null } | null } | null;
}

export interface AdminRestaurant {
  id: number;
  vendor_id?: number | null;
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
  is_halal?: boolean;
  avg_prep_time_min?: number | null;
  avg_delivery_time_min?: number | null;
  rating?: string | null;
  rating_count?: number;
  min_order_amount?: string | null;
  delivery_fee?: string | null;
  free_delivery_above?: string | null;
  created_at: string;
  vendor?: { id: number; business_name: string; vendor_type: string } | null;
  products_count?: number;
  orders_count?: number;
  orders_sum_total_amount?: string | null;
}

export interface AdminStore {
  id: number;
  vendor_id?: number | null;
  name: string;
  slug?: string;
  store_type?: string | null;
  description?: string | null;
  address?: string | null;
  phone?: string | null;
  logo?: string | null;
  cover_image?: string | null;
  is_open: boolean;
  is_featured: boolean;
  rating?: string | null;
  rating_count?: number;
  min_order_amount?: string | null;
  delivery_fee?: string | null;
  created_at: string;
  vendor?: { id: number; business_name: string; vendor_type: string } | null;
  products_count?: number;
  orders_count?: number;
  orders_sum_total_amount?: string | null;
}

export interface AdminProduct {
  id: number;
  name: string;
  slug?: string;
  sku?: string | null;
  description?: string | null;
  type?: string | null;
  price?: string;
  compare_at_price?: string | null;
  unit_type?: string | null;
  unit_value?: string | null;
  unit_label?: string | null;
  image?: string | null;
  is_veg?: boolean;
  is_featured?: boolean;
  is_active: boolean;
  is_available: boolean;
  min_order_qty?: number;
  max_order_qty?: number | null;
  created_at?: string;
  vendor?: { id: number; business_name: string; vendor_type: string } | null;
  category?: { id: number; name: string; slug?: string } | null;
  restaurant?: { id: number; name: string } | null;
  store?: { id: number; name: string } | null;
  stock?: number;
}

export interface AdminCoupon {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  type: 'percentage' | 'fixed' | 'shipping';
  value: string;
  max_discount?: string | null;
  min_order_amount?: string | null;
  service?: ServiceType | 'all' | null;
  usage_limit?: number | null;
  per_user_limit?: number | null;
  starts_at?: string | null;
  expires_at?: string | null;
  first_order_only?: boolean;
  is_active: boolean;
  status?: 'active' | 'paused' | 'expired' | string;
  total_uses?: number;
  coupon_usages_count?: number;
  created_at?: string;
}

export interface AdminBanner {
  id: number;
  title: string;
  subtitle?: string | null;
  cta_text?: string | null;
  image: string;
  media_type?: 'image' | 'video' | null;
  video?: string | null;
  poster_image?: string | null;
  position?: string | null;
  service?: string | null;
  placement?: string | null;
  target_type?: string | null;
  target_id?: number | null;
  target_url?: string | null;
  starts_at?: string | null;
  expires_at?: string | null;
  is_active: boolean;
  sort_order: number;
  created_at?: string;
}

export interface AdminFeatureFlag {
  id: number;
  key: string;
  name: string;
  description?: string | null;
  enabled: boolean;
  meta?: Record<string, unknown> | null;
  updated_at?: string | null;
}

export type CategoryServiceType = 'food' | 'grocery' | 'rides';

export type CategoryDisplayPlacement = 'top_navigation' | 'main_content' | 'both';

export interface AdminCategory {
  id: number;
  name: string;
  slug: string;
  parent_id: number | null;
  type: CategoryServiceType;
  icon?: string | null;
  image?: string | null;
  navigation_icon?: string | null;
  display_placement?: CategoryDisplayPlacement | null;
  description?: string | null;
  sort_order: number;
  is_active: boolean;
  is_featured: boolean;
  meta?: Record<string, unknown> | null;
  meta_title?: string | null;
  meta_description?: string | null;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
  children_count: number;
  products_count: number;
  vendors_count?: number;
  parent?: Pick<AdminCategory, 'id' | 'name' | 'slug' | 'type'> | null;
  children?: AdminCategory[];
}

export interface AdminCategoryDetail extends AdminCategory {
  children: AdminCategory[];
  parent: Pick<AdminCategory, 'id' | 'name' | 'slug' | 'type'> | null;
}

export type ApplicationStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

export type DriverRideStatus = 'online' | 'offline' | 'on_trip';

export type PartnerReviewStatus = ApplicationStatus | DriverRideStatus | 'on_delivery';

export interface AdminDriver {
  id: number;
  user_id: number;
  vehicle_type_id?: number | null;
  status: DriverRideStatus | ApplicationStatus | string;
  vehicle_number?: string | null;
  vehicle_model?: string | null;
  vehicle_color?: string | null;
  license_number?: string | null;
  license_expiry?: string | null;
  is_online: boolean;
  is_busy?: boolean;
  is_verified: boolean;
  verified_at?: string | null;
  rejection_reason?: string | null;
  reviewed_at?: string | null;
  rating?: string | null;
  rating_count?: number;
  total_trips?: number;
  accepted_rides?: number;
  rejected_rides?: number;
  latitude?: number | null;
  longitude?: number | null;
  last_location_at?: string | null;
  created_at: string;
  user?: { id: number; name?: string; email?: string; phone?: string | null } | null;
}

export interface AdminDeliveryPartner {
  id: number;
  user_id: number;
  status: PartnerReviewStatus | string;
  service_type?: 'food' | 'grocery' | null;
  vehicle_type?: string | null;
  vehicle_number?: string | null;
  vehicle_model?: string | null;
  vehicle_color?: string | null;
  license_number?: string | null;
  license_expiry?: string | null;
  is_online: boolean;
  is_busy?: boolean;
  rejection_reason?: string | null;
  reviewed_at?: string | null;
  rating?: string | null;
  rating_count?: number;
  total_deliveries?: number;
  total_earnings?: string | null;
  accepted_orders?: number;
  rejected_orders?: number;
  latitude?: number | null;
  longitude?: number | null;
  last_location_at?: string | null;
  created_at: string;
  user?: { id: number; name?: string; email?: string; phone?: string | null } | null;
}

export interface ReviewDocument {
  id?: number;
  type: string;
  file_path: string;
  filename: string;
  status: string;
  expiry_date?: string | null;
}

type AdminContactUser = {
  id: number;
  name?: string;
  email?: string;
  phone?: string | null;
  country_code?: string | null;
  created_at?: string | null;
  is_verified?: boolean;
};

export interface AdminDriverDetail extends AdminDriver {
  pan_number?: string | null;
  aadhar_number?: string | null;
  bank_account_name?: string | null;
  bank_account_number?: string | null;
  bank_ifsc?: string | null;
  bank_name?: string | null;
  documents?: ReviewDocument[];
  vehicle_type?: { id: number; name: string; code: string } | null;
  vehicles?: Array<{
    id: number;
    make?: string | null;
    model?: string | null;
    color?: string | null;
    year?: number | null;
    registration_number?: string | null;
  }>;
  user?: AdminContactUser | null;
}

export interface AdminDeliveryPartnerDetail extends AdminDeliveryPartner {
  aadhar_number?: string | null;
  bank_account_name?: string | null;
  bank_account_number?: string | null;
  bank_ifsc?: string | null;
  bank_name?: string | null;
  documents?: ReviewDocument[];
  user?: AdminContactUser | null;
}

export interface AdminPermission {
  id: number;
  name: string;
  slug: string;
  module?: string | null;
  description?: string | null;
}

export interface AdminRole {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  is_system?: boolean;
  users_count?: number;
  permissions?: AdminPermission[];
  created_at?: string;
}

export interface AdminRoleDetail {
  role: AdminRole;
  permissions: AdminPermission[];
}

export interface AdminSetting {
  id: number;
  group: string;
  key: string;
  label: string;
  /** Optional guidance shown under the input explaining what the value does. */
  help_text?: string | null;
  value: string | null;
  type: 'text' | 'number' | 'boolean' | 'json' | 'array' | 'select';
  is_public?: boolean;
  options?: string[] | null;
  sort_order?: number;
  created_at?: string;
  updated_at?: string;
}

export interface AdminDashboard {
  counts: {
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
    today_gross_order_value: number;
    total_gross_order_value: number;
    today_platform_revenue: number;
    total_platform_revenue: number;
    delivered_orders: number;
  };
  revenue_series: { date: string; gross_order_value: number; commission: number; orders: number }[];
  order_status_distribution: { status: string; total: number }[];
  recent_orders: AdminOrder[];
  top_vendors: {
    id: number;
    business_name: string;
    vendor_type: VendorType;
    status: string;
    orders_count: number;
    gross_order_value: number;
    commission: number;
  }[];
}

export type IntegrationEnvironment = 'test' | 'live' | 'mock';

export interface AdminIntegrationCredential {
  masked: string | null;
  configured: boolean;
}

export interface AdminIntegration {
  service: string;
  label: string;
  provider: string | null;
  configured_provider: string | null;
  enabled: boolean;
  is_configured: boolean;
  environment: IntegrationEnvironment;
  mode: string;
  reasons: string[];
  from: string;
  credentials: Record<string, string | null>;
  public_keys: string[];
  settings: Record<string, unknown>;
  last_tested_at?: string | null;
  last_test_status?: 'ok' | 'error' | null;
  last_test_message?: string | null;
}

export interface AdminIntegrationDetail {
  service: string;
  label: string;
  provider: string;
  allowed_providers: string[];
  environment: IntegrationEnvironment;
  is_enabled: boolean;
  is_configured: boolean;
  reasons: string[];
  from: string;
  public_keys: Record<string, string>;
  credentials: Record<string, AdminIntegrationCredential>;
  last_tested_at?: string | null;
  last_test_status?: 'ok' | 'error' | null;
  last_test_message?: string | null;
}

export interface AdminWebhookSubscription {
  id: number;
  target_url: string;
  events: string[];
  status: boolean;
  secret?: string | null;
  created_at: string;
}

export interface WebhookDelivery {
  id: number;
  event: string;
  status: string;
  attempts: number;
  last_error?: string | null;
  delivered_at?: string | null;
  created_at: string;
}

export interface WebhookEventDefinition {
  name: string;
  description: string;
}

export interface AdminVehicleType {
  id: number;
  name: string;
  code: string;
  icon?: string | null;
  description?: string | null;
  capacity?: number | null;
  ac?: boolean;
  is_active: boolean;
  sort_order?: number;
  meta?: Record<string, unknown> | null;
}

export interface AdminFareRule {
  id: number;
  vehicle_type_id: number;
  zone_id?: string | null;
  city?: string | null;
  base_fare: string;
  per_km: string;
  per_minute: string;
  minimum_fare: string;
  booking_fee?: string | null;
  platform_fee?: string | null;
  tax_rate?: string | null;
  surge_multiplier_max?: string | null;
  waiting_charge_per_min?: string | null;
  waiting_fee_per_minute?: string | null;
  cancellation_fee?: string | null;
  driver_earn_percentage?: string | null;
  driver_commission_percent?: number | string | null;
  is_active: boolean;
  meta?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
  vehicle_type?: Pick<AdminVehicleType, 'id' | 'name' | 'code'> | null;
}

export interface AdminFareRulePreview {
  distance_km: number;
  duration_min: number;
  vehicle_type: Pick<AdminVehicleType, 'id' | 'name' | 'code'> | null;
  currency: string;
  base_fare: number;
  distance_charge: number;
  time_charge: number;
  booking_fee: number;
  platform_fee: number;
  tax_amount: number;
  subtotal: number;
  estimated_fare: number;
}

export type AdminZoneType = 'delivery' | 'ride' | 'service_area' | 'multi';

export interface AdminZonePolygonPoint {
  latitude: number;
  longitude: number;
}

export interface AdminZone {
  id: number;
  name: string;
  code?: string | null;
  description?: string | null;
  country?: string | null;
  state?: string | null;
  city?: string | null;
  type?: AdminZoneType | string;
  food_enabled?: boolean;
  grocery_enabled?: boolean;
  ride_enabled?: boolean;
  priority?: number;
  center_latitude?: string | number | null;
  center_longitude?: string | number | null;
  radius_km?: string | number | null;
  food_partner_search_radius_km?: string | number | null;
  grocery_partner_search_radius_km?: string | number | null;
  ride_driver_search_radius_km?: string | number | null;
  polygon?: AdminZonePolygonPoint[] | null;
  allow_cross_zone_food_delivery?: boolean;
  allow_cross_zone_grocery_delivery?: boolean;
  allow_ride_drop_outside_zone?: boolean;
  is_active?: boolean;
  meta?: Record<string, unknown> | null;
  restaurant_count?: number;
  store_count?: number;
  online_food_partners?: number;
  online_grocery_partners?: number;
  online_drivers?: number;
  delivery_configs_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface MapsServiceabilityConfig {
  services: string[];
  zones_enabled: boolean;
}

export interface MapsClientConfig {
  enabled: boolean;
  provider: string | null;
  public_key: string | null;
  map_id?: string | null;
  default_center?: { latitude: number; longitude: number } | null;
  default_zoom?: number;
  serviceability?: MapsServiceabilityConfig;
}
export interface AdminPayout {
  id: number;
  payout_number: string;
  party_type: 'vendor' | 'driver' | 'delivery_partner';
  vendor_id?: number | null;
  driver_id?: number | null;
  delivery_partner_id?: number | null;
  amount: string;
  currency: string;
  mode?: string | null;
  gateway?: string | null;
  provider_reference?: string | null;
  bank_account_name?: string | null;
  bank_account_number?: string | null;
  bank_ifsc?: string | null;
  bank_name?: string | null;
  status: 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED';
  failure_reason?: string | null;
  admin_remark?: string | null;
  processed_at?: string | null;
  created_at: string;
  updated_at: string;
  vendor?: AdminVendor | null;
  driver?: { id: number; user?: { name?: string | null; phone?: string | null } | null } | null;
  delivery_partner?: { id: number; user?: { name?: string | null; phone?: string | null } | null } | null;
}

export interface AdminPayoutDetail extends AdminPayout {
  bank_account_name?: string | null;
  bank_account_number?: string | null;
  bank_ifsc?: string | null;
  bank_name?: string | null;
  settlements?: { id: number; amount: string; status: string }[];
}
