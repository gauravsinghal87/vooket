import type { Address, Product, ProductVariant, Restaurant, Store } from './catalog';

export type ServiceType = 'food' | 'grocery' | 'rides';

export interface SelectedOption {
  group_id: number;
  group_name: string;
  selection_type?: 'SINGLE' | 'MULTIPLE' | 'single' | 'multiple';
  group_is_active?: boolean;
  option_id: number;
  option_name: string;
  price?: number;
  option_price?: string | number;
  option_price_label?: string | null;
  option_is_available?: boolean;
}

export interface CartItem {
  id: number;
  cart_id: number;
  product_id: number;
  product_variant_id: number | null;
  unit_price: string;
  quantity: number;
  line_total: string;
  selected_options: SelectedOption[] | null;
  selected_addons: Record<string, unknown> | null;
  special_instructions: string | null;
  product?: Product | null;
  product_variant?: ProductVariant | null;
}

export interface Cart {
  id: number;
  user_id: number | null;
  session_id: string | null;
  cart_type: 'food' | 'grocery';
  vendor_id: number | null;
  address_id: number | null;
  delivery_mode?: 'instant' | 'scheduled';
  subtotal: string;
  discount: string;
  tax: string;
  delivery_fee: string;
  delivery_gst_percent: string;
  delivery_gst_amount: string;
  packaging_fee?: string;
  handling_fee?: string;
  delivery_distance_km?: string | null;
  total: string;
  coupon_code: string | null;
  items_count: number;
  expires_at?: string | null;
  items: CartItem[];
}

export type OrderType = 'food' | 'grocery';

export type OrderStatus =
  | 'PLACED' | 'PENDING' | 'SCHEDULED' | 'ACCEPTED' | 'CONFIRMED' | 'PREPARING'
  | 'READY' | 'PARTNER_ASSIGNED' | 'PICKED_UP' | 'OUT_FOR_DELIVERY' | 'ARRIVED'
  | 'DELIVERED' | 'CANCELLED';

export type OrderPaymentStatus =
  | 'pending' | 'partial_paid' | 'paid' | 'failed' | 'refunded' | 'partially_refunded'
  | 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED' | 'PARTIALLY_REFUNDED';

export type ProductType = 'simple' | 'variable';

export interface OrderItem {
  id: number;
  order_id: number;
  product_id: number;
  product_variant_id: number | null;
  product_name: string;
  product_image: string | null;
  sku?: string | null;
  unit_price: string;
  price_snapshot?: string;
  quantity: number;
  line_total: string;
  selected_options?: SelectedOption[] | null;
  selected_addons?: Record<string, unknown> | null;
  special_instructions?: string | null;
  meta?: Record<string, unknown> | null;
  status: string;
}

export interface OrderStatusHistory {
  id: number;
  order_id: number;
  status: string;
  notes: string | null;
  changed_by: number | null;
  changed_by_type: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
}

export interface Order {
  id: number;
  order_number: string;
  user_id: number;
  vendor_id: number | null;
  restaurant_id: number | null;
  store_id: number | null;
  order_type: OrderType;
  status: OrderStatus;
  payment_status: OrderPaymentStatus;
  help_available?: boolean;
  payment_method: 'wallet' | 'online' | 'cash_on_delivery' | 'upi' | 'card' | null;
  address_id: number | null;
  delivery_address_snapshot?: Address | null;
  subtotal: string;
  discount_amount: string;
  tax_amount: string;
  delivery_fee: string;
  delivery_gst_percent: string;
  delivery_gst_amount: string;
  packaging_fee: string;
  handling_fee: string;
  platform_fee: string;
  total_amount: string;
  wallet_used: string;
  coupon_discount: string;
  coupon_code: string | null;
  tip_amount: string;
  round_off?: string;
  customer_note: string | null;
  delivery_slot_id?: number | null;
  meta?: Record<string, unknown> | null;
  delivery_otp_verified_at?: string | null;
  delivery_payment_collected_at?: string | null;
  delivery_payment_collected_via?: string | null;
  delivery_payment_settled_at?: string | null;
  timing_type: 'instant' | 'scheduled';
  scheduled_at: string | null;
  refund_amount?: string;
  refund_status?: string | null;
  refunded_at?: string | null;
  created_at: string;
  updated_at?: string;
  items?: OrderItem[];
  statusHistory?: OrderStatusHistory[];
  status_history?: OrderStatusHistory[];
  restaurant?: Restaurant | null;
  store?: Store | null;
}

export interface PreparationInstructionOption {
  key: string;
  label: string;
  emoji: string;
}

export interface SelectedPreparationInstruction {
  key: string;
  label: string;
  emoji: string;
}

export interface PreparationInstructions {
  selected: SelectedPreparationInstruction[];
  note: string | null;
  restaurant_note: string | null;
  send_cutlery: boolean | null;
  updated_at: string | null;
}

export interface OrderItemPreparationInstructions extends PreparationInstructions {
  order_item_id: number;
}

export interface PreparationInstructionsPayload {
  service: OrderType;
  options: PreparationInstructionOption[];
  editable: boolean;
  editable_statuses: string[];
  max_note_length: number;
  instructions: PreparationInstructions;
  items: OrderItemPreparationInstructions[];
}

export interface UpdatePreparationInstructionsInput {
  selected: string[];
  note?: string | null;
  items?: { order_item_id: number; selected: string[]; note?: string | null }[];
}

export interface PaymentCheckoutPayload {
  payment_number: string;
  provider_order_id: string | null;
  amount_paise: number;
  amount: number;
  currency: string;
  method: string;
  key_id: string | null;
  mock: boolean;
}

export interface PaymentVerifyResult {
  status: 'SUCCESS' | 'FAILED' | string;
  already_processed: boolean;
  payment_number: string;
  paid_at: string | null;
}

export type CouponType = 'percentage' | 'fixed' | 'shipping';
export type CouponService = 'food' | 'grocery' | 'ride' | 'all' | null;

export interface Coupon {
  id: number;
  code: string;
  name: string;
  description: string | null;
  type: CouponType;
  value: string;
  max_discount: string | null;
  min_order_amount: string;
  service: CouponService;
  starts_at: string | null;
  expires_at: string | null;
  first_order_only: boolean;
  is_active: boolean;
  status: string;
}

export type RideStatus =
  | 'REQUESTING' | 'REQUESTED' | 'SEARCHING_DRIVER' | 'DRIVER_ASSIGNED'
  | 'DRIVER_ARRIVING' | 'DRIVER_ARRIVED' | 'TRIP_STARTED' | 'TRIP_IN_PROGRESS'
  | 'IN_PROGRESS' | 'TRIP_COMPLETED' | 'COMPLETED' | 'CANCELLED' | 'NO_DRIVER_FOUND';

export interface VehicleType {
  id: number;
  name: string;
  code: string;
  icon: string | null;
  description: string | null;
  capacity: number;
  ac: boolean;
  is_active: boolean;
  sort_order: number;
}

export interface RideEstimate {
  vehicle_type: VehicleType;
  distance_km: number;
  duration_min: number;
  base_fare: string;
  distance_charge: string;
  time_charge: string;
  booking_fee: string;
  platform_fee: string;
  tax_amount: string;
  estimated_fare: string;
  fare_rule_id: number;
}

export interface Ride {
  id: number;
  ride_number: string;
  user_id: number;
  driver_id: number | null;
  vehicle_id: number | null;
  vehicle_type_id: number | null;
  status: RideStatus;
  pickup_address: string | null;
  pickup_latitude: string;
  pickup_longitude: string;
  destination_address: string | null;
  destination_latitude: string;
  destination_longitude: string;
  distance_km: string | null;
  duration_min: number | null;
  base_fare: string;
  distance_charge: string;
  time_charge: string;
  booking_fee: string;
  platform_fee: string;
  surge_multiplier?: string;
  surge_amount?: string;
  waiting_charge?: string;
  tip_amount?: string;
  discount_amount?: string;
  tax_amount?: string;
  estimated_fare: string;
  final_fare: string | null;
  coupon_code: string | null;
  wallet_used?: string;
  payment_method: string | null;
  payment_status: string;
  cash_collected?: boolean;
  cash_collected_amount?: string | null;
  cash_collected_at?: string | null;
  cash_collected_via?: string | null;
  cash_settled?: boolean;
  cash_settled_at?: string | null;
  otp?: string;
  otp_verified?: boolean;
  is_scheduled?: boolean;
  scheduled_at: string | null;
  driver_assigned_at: string | null;
  driver_arriving_at: string | null;
  driver_arrived_at: string | null;
  trip_started_at: string | null;
  trip_completed_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  created_at: string;
  vehicle_type?: VehicleType | null;
  driver?: {
    id: number;
    name?: string;
    phone?: string | null;
    rating?: string | null;
    latitude?: string | null;
    longitude?: string | null;
    last_location_at?: string | null;
    user?: { id: number; name: string; phone?: string | null; avatar?: string | null } | null;
  } | null;
}

export interface AppConfig {
  maps: { enabled: boolean; provider: string | null; public_key: string | null };
  delivery?: { per_km_fee: number; free_delivery_above: number | null; free_delivery_km: number | null };
  captcha?: { enabled: boolean; site_key?: string | null };
  analytics?: { enabled: boolean; key?: string | null };
  media?: { enabled: boolean; cloud_name?: string | null };
  payments?: { enabled?: boolean; provider?: string | null; mode?: string | null; key_id?: string | null };
  google?: { enabled?: boolean; provider?: string | null; client_id?: string | null };
  branding?: {
    name?: string;
    logo?: string | null;
    currency?: string;
    support_phone?: string | null;
    support_email?: string | null;
  };
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

export interface PlaceDetails {
  latitude: number;
  longitude: number;
  address: string;
  place_id?: string | null;
  name?: string | null;
  provider?: string | null;
  formatted_address?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
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

export interface RideRoute {
  distance_km: number;
  duration_min: number;
  polyline: string | null;
  source: string;
  status: string;
}

export interface NearbyDriver {
  id: number;
  vehicle_type_id: number;
  vehicle_type_name: string | null;
  latitude: number;
  longitude: number;
  distance_km: number;
  eta_min: number;
  rating: number;
}

export interface OrderTrackingPickup {
  latitude: number;
  longitude: number;
  name: string;
  address: string | null;
}

export interface OrderTrackingDropoff {
  latitude: number;
  longitude: number;
  address: string;
}

export interface OrderTrackingOrder {
  id: number;
  order_number: string;
  service_type?: OrderType;
  status: string;
  status_label?: string;
  pickup: OrderTrackingPickup | null;
  dropoff: OrderTrackingDropoff | null;
  timestamps?: Record<string, string>;
  cancel_reason?: string | null;
}

export interface OrderTrackingPartner {
  id: number;
  name: string;
  phone: string | null;
  vehicle_type?: string | null;
  vehicle_number: string | null;
  photo?: string | null;
  rating?: number | null;
}

export interface OrderTrackingLocation {
  lat: number | null;
  lng: number | null;
  heading: number | null;
  speed: number | null;
  accuracy: number | null;
  recorded_at: string | null;
  is_stale: boolean;
}

export interface OrderTrackingRoute {
  polyline: string | null;
  distance_km: number | null;
  duration_min: number | null;
  status: string;
}

export interface OrderTrackingStatus {
  enabled: boolean;
  in_progress: boolean;
  source: 'realtime' | 'polling';
  last_updated_at: string | null;
  location_stale: boolean;
}

export interface OrderTracking {
  order: OrderTrackingOrder;
  partner: OrderTrackingPartner | null;
  location: OrderTrackingLocation | null;
  route: OrderTrackingRoute;
  eta: number | null;
  tracking: OrderTrackingStatus;
}