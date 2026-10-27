import type { Paginated } from '@/typings/api';

export type PartnerRole = 'driver' | 'delivery_partner';
export type DeliveryServiceType = 'food' | 'grocery';

export interface UserRole {
  id: number;
  name: string;
  slug: string;
}

export interface AuthUser {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  country_code?: string | null;
  avatar?: string | null;
  user_type?: string | null;
  is_active?: boolean;
  rating?: string | number | null;
  roles?: UserRole[];
}

export interface VehicleType {
  id: number;
  name: string;
  code: string;
  icon?: string | null;
  description?: string | null;
  capacity?: number;
  ac?: boolean;
  is_active?: boolean;
}

export interface Vehicle {
  id: number;
  driver_id: number;
  vehicle_type_id?: number | null;
  make?: string | null;
  model?: string | null;
  color?: string | null;
  year?: number | null;
  registration_number?: string | null;
  status?: string | null;
  is_active?: boolean;
  vehicle_type?: VehicleType | null;
}

export interface Driver {
  id: number;
  user_id: number;
  vehicle_type_id?: number | null;
  status?: string | null;
  vehicle_number?: string | null;
  vehicle_model?: string | null;
  vehicle_color?: string | null;
  license_number?: string | null;
  license_expiry?: string | null;
  aadhar_number?: string | null;
  pan_number?: string | null;
  bank_account_name?: string | null;
  bank_account_number?: string | null;
  bank_ifsc?: string | null;
  bank_name?: string | null;
  latitude?: string | number | null;
  longitude?: string | number | null;
  last_location_at?: string | null;
  is_online?: boolean;
  is_busy?: boolean;
  is_verified?: boolean;
  verified_at?: string | null;
  rejection_reason?: string | null;
  reviewed_at?: string | null;
  rating?: string | number | null;
  rating_count?: number;
  total_trips?: number;
  accepted_rides?: number;
  rejected_rides?: number;
  vehicle_type?: VehicleType | null;
  vehicles?: Vehicle[];
}

export interface PartnerDocument {
  type: string;
  file_path: string;
  filename: string;
  status: string;
}

export interface DeliveryPartner {
  id: number;
  user_id: number;
  status?: string | null;
  service_type?: DeliveryServiceType | null;
  vehicle_type?: string | null;
  vehicle_number?: string | null;
  vehicle_model?: string | null;
  vehicle_color?: string | null;
  license_number?: string | null;
  license_expiry?: string | null;
  aadhar_number?: string | null;
  bank_account_name?: string | null;
  bank_account_number?: string | null;
  bank_ifsc?: string | null;
  bank_name?: string | null;
  latitude?: string | number | null;
  longitude?: string | number | null;
  last_location_at?: string | null;
  is_online?: boolean;
  is_busy?: boolean;
  rejection_reason?: string | null;
  reviewed_at?: string | null;
  documents?: PartnerDocument[];
  rating?: string | number | null;
  rating_count?: number;
  total_deliveries?: number;
  total_earnings?: string | number | null;
  accepted_orders?: number;
  rejected_orders?: number;
}

export type JobProfile = Driver | DeliveryPartner;

export interface Payout {
  id: number;
  payout_number: string;
  party_type?: string | null;
  amount: string | number;
  currency: string;
  status: string;
  mode?: string | null;
  failure_reason?: string | null;
  admin_remark?: string | null;
  processed_at?: string | null;
  bank_account_name?: string | null;
  bank_account_number?: string | null;
  bank_ifsc?: string | null;
  bank_name?: string | null;
  created_at: string;
}

export type WalletService = 'food' | 'grocery' | 'ride';
export type WalletDirection = 'credit' | 'debit';

export interface WalletSummary {
  wallet_type: string;
  currency: string;
  balance: number;
  pending_balance: number;
  available_balance: number;
  total_earned: number;
  total_credited: number;
  total_debited: number;
  status: string;
}

export interface WalletTransactionEntry {
  transaction_id: string;
  type: string;
  service: WalletService | null;
  direction: WalletDirection;
  amount: number;
  balance_before: number;
  balance_after: number;
  currency: string;
  status: string;
  reference?: number | null;
  description?: string | null;
  created_at: string;
}

export interface RideCustomer {
  id: number;
  name: string;
  phone?: string | null;
}

export interface Ride {
  id: number;
  ride_number: string;
  user_id: number;
  driver_id?: number | null;
  vehicle_type_id?: number | null;
  status: string;
  pickup_address?: string | null;
  pickup_latitude?: string | number | null;
  pickup_longitude?: string | number | null;
  destination_address?: string | null;
  destination_latitude?: string | number | null;
  destination_longitude?: string | number | null;
  distance_km?: string | number | null;
  duration_min?: number | null;
  base_fare?: string | number | null;
  distance_charge?: string | number | null;
  time_charge?: string | number | null;
  estimated_fare?: string | number | null;
  final_fare?: string | number | null;
  payment_method?: string | null;
  payment_status?: string | null;
  cash_collected?: boolean;
  cash_collected_amount?: string | number | null;
  cash_collected_at?: string | null;
  cash_collected_via?: string | null;
  cash_settled?: boolean;
  cash_settled_at?: string | null;
  otp?: string | null;
  otp_verified?: boolean;
  otp_verified_at?: string | null;
  payment?: DeliveryPaymentState;
  created_at?: string | null;
  vehicle_type?: VehicleType | null;
  user?: RideCustomer | null;
}

export interface RideRequest {
  id: number;
  ride_id: number;
  driver_id?: number | null;
  status: string;
  distance_km?: string | number | null;
  sent_at?: string | null;
  responded_at?: string | null;
  expires_at?: string | null;
  attempt?: number;
  ride: Ride;
}

export interface OrderItem {
  id?: number;
  product_id?: number | null;
  product_name: string;
  product_image?: string | null;
  unit_price?: string | number | null;
  quantity: number;
  line_total?: string | number | null;
  selected_options?: unknown;
  selected_addons?: unknown;
  special_instructions?: string | null;
}

export interface Address {
  id: number;
  label?: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  address_line_1?: string | null;
  address_line_2?: string | null;
  landmark?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
  latitude?: string | number | null;
  longitude?: string | number | null;
  type?: string | null;
}

export interface VendorLite {
  id: number;
  business_name?: string | null;
  vendor_type?: string | null;
  address?: string | null;
  logo?: string | null;
  phone?: string | null;
}

export interface DeliveryOrder {
  id: number;
  order_number: string;
  order_type?: string | null;
  status: string;
  payment_status?: string | null;
  payment_method?: string | null;
  subtotal?: string | number | null;
  discount_amount?: string | number | null;
  tax_amount?: string | number | null;
  delivery_fee?: string | number | null;
  packaging_fee?: string | number | null;
  platform_fee?: string | number | null;
  tip_amount?: string | number | null;
  total_amount?: string | number | null;
  delivery_payment_collected_at?: string | null;
  delivery_payment_collected_via?: string | null;
  delivery_payment_settled_at?: string | null;
  delivery_otp_verified_at?: string | null;
  customer_note?: string | null;
  preparation_time_min?: number | null;
  delivery_address_snapshot?: unknown;
  created_at?: string | null;
  items?: OrderItem[];
  vendor?: VendorLite | null;
  address?: Address | null;
  user?: RideCustomer | null;
}

export interface DispatchOfferMeta {
  service_type?: string | null;
  service_label?: string | null;
  /** The partner's expected earning, snapshotted at offer time by the backend. */
  estimated_earning?: string | number | null;
  /** Explicitly-named alias of estimated_earning (what will be credited). */
  estimated_partner_earning?: number | null;
  earning_breakdown?: DeliveryEarningBreakdown | null;
  /** The customer's delivery charge. Informational only - never the earning. */
  customer_delivery_fee?: number | null;
  delivery_distance_km?: string | number | null;
  offered_at?: string | null;
  /**
   * Grocery trip context for this offer. `extend` means the partner already
   * has a trip and accepting would add a stop; `open` means it starts one.
   */
  trip?: {
    mode: 'open' | 'extend' | 'single';
    current_stops?: number;
    max_stops?: number;
    can_accept?: boolean;
    reasons?: string[];
  } | null;
}

/** A single measured hop of the trip. `from_order_id` is null for the pickup leg. */
export interface BatchRouteLeg {
  from_order_id?: number | null;
  to_order_id: number;
  distance_km: number;
  duration_min: number;
}

export interface BatchRouteStop {
  order_id: number;
  order_number: string;
  label?: string | null;
  point: { lat: number; lng: number };
  leg_distance_km: number;
  leg_duration_min: number;
  status: string;
}

/**
 * A map-measured trip. Every leg was resolved through the backend maps
 * provider, so the partner navigates real distances rather than a drawn line.
 */
export interface BatchRoute {
  pickup: { lat: number; lng: number };
  pickup_label?: string | null;
  stops: BatchRouteStop[];
  legs: BatchRouteLeg[];
  total_distance_km: number;
  total_duration_min: number;
  measured_at?: string | null;
}

/** One order on the trip. Each stop keeps its own status, payment and OTP. */
export interface BatchStop {
  sequence: number | null;
  order_id: number;
  order_number: string;
  status: string;
  order: DeliveryOrder;
}

/**
 * Grocery trip envelope returned by `active-job` when the partner is carrying
 * more than one scheduled grocery order. Non-batched jobs still return a bare
 * `DeliveryOrder`, so clients must treat this as the union case.
 */
export interface ActiveBatchJob {
  batch_id: number | null;
  batch_number: string | null;
  order_type?: string | null;
  status: string;
  stop_count: number;
  /** Stops still on the trip. Drops by one each time a stop is completed. */
  remaining_stops?: number;
  /** Stops completed since this trip opened. */
  completed_stops?: number;
  /** The next stop the partner has to act on. */
  current_stop?: {
    sequence: number | null;
    order_id: number;
    order_number: string;
    status: string;
  } | null;
  max_stops: number;
  window_start?: string | null;
  window_end?: string | null;
  route: BatchRoute | null;
  stops: BatchStop[];
  /** Convenience alias for the first stop, matching the legacy payload. */
  order: DeliveryOrder | null;
  orders: DeliveryOrder[];
}

export function isActiveBatchJob(job: DeliveryOrder | ActiveBatchJob | null): job is ActiveBatchJob {
  return !!job && typeof job === 'object' && 'stops' in job && Array.isArray((job as ActiveBatchJob).stops);
}

export interface DispatchLog {
  id: number;
  dispatch_type?: string | null;
  order_id?: number | null;
  ride_id?: number | null;
  candidate_id?: number | null;
  candidate_type?: string | null;
  distance_km?: string | number | null;
  status: string;
  created_at?: string | null;
  expires_at?: string | null;
  meta?: DispatchOfferMeta | null;
  order: DeliveryOrder;
}

/**
 * Wallet figures for the payout panel, enforced server-side by
 * `partner_min_wallet_balance`. Never used as a trust boundary: the payout
 * endpoint recomputes all three.
 */
export interface PayoutOverview {
  /** Spendable wallet balance (balance less pending reservations). */
  wallet_balance: number;
  /** Amount that must REMAIN after a payout, set by Super Admin. Not a payout minimum. */
  minimum_wallet_balance: number;
  /** Exact ceiling the backend will accept: available less the floor. */
  available_withdrawable_amount: number;
}

export interface EarningsSummary {
  today: number;
  this_week: number;
  this_month: number;
  total: number;
  total_trips?: number;
  total_deliveries?: number;
  payout?: PayoutOverview;
}

export interface DeliveryEarningBreakdown {
  service?: DeliveryServiceType | null;
  customer_delivery_fee?: number | null;
  basis?: EarningBasis | null;
  per_km?: number | null;
  /** The customer's free-delivery allowance in km. */
  free_distance_km?: number | null;
  /** Fixed partner earning guaranteed for the free-delivery portion. */
  first_distance_earning?: number | null;
  first_distance_earning_key?: string | null;
  distance_km?: number | null;
  /** Chargeable distance beyond the free-delivery allowance. */
  additional_distance_km?: number | null;
  /** Admin-funded component: additional_distance_km x per_km. */
  additional_admin_earning?: number | null;
  distance_earning?: number | null;
  platform_funded?: number | null;
}

export type EarningBasis =
  | 'customer_delivery_fee_plus_free_distance_earning'
  | 'customer_delivery_fee_plus_admin_per_km'
  | 'customer_delivery_fee_plus_admin_funded_amount'
  | 'accepted_offer_snapshot'
  | 'customer_delivery_fee'
  | 'customer_delivery_fee_distance_unavailable';

export interface DeliveryEarningEntry {
  id: number;
  earning_number: string;
  amount: string | number;
  currency?: string;
  status: string;
  paid_at?: string | null;
  created_at: string;
  delivered_at?: string | null;
  order_id?: number | null;
  order_number?: string | null;
  order_type?: DeliveryServiceType | null;
  vendor_name?: string | null;
  delivered_to?: string | null;
  breakdown?: DeliveryEarningBreakdown | null;
}

export interface DeliveryPartnerEarnings extends EarningsSummary {
  earnings?: Paginated<DeliveryEarningEntry>;
}

export type EarningPeriod = 'today' | 'week' | 'month' | 'all';

/** Serviceable zone as returned by the public `/zones` list. */
export interface Zone {
  id: number;
  name: string;
  code?: string | null;
  city?: string | null;
  food_enabled?: boolean;
  grocery_enabled?: boolean;
}

/** One address suggestion from `/geocode/search`. */
export interface PlaceResult {
  provider?: string | null;
  place_id?: string | null;
  id?: string | null;
  name?: string | null;
  main?: string | null;
  formatted_address?: string | null;
  address?: string | null;
  text?: string | null;
  secondary?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
  locality?: string | null;
  area?: string | null;
}

export interface SearchPlacesResponse {
  results: PlaceResult[];
  provider?: string | null;
  fallback?: boolean;
  correlation_id?: string | null;
}

/** Normalised address for a coordinate pair from `/geocode/reverse`. */
export interface ReverseGeocode {
  formatted_address?: string | null;
  address?: string | null;
  secondary?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
  locality?: string | null;
  area?: string | null;
  place_id?: string | null;
}

/** Zone lookup for a coordinate pair from `/serviceability`. */
export interface ServiceabilityResult {
  serviceable: boolean;
  zone: { id: number; name: string } | null;
  service: string;
  reason: string | null;
}

export interface Availability {
  is_online: boolean;
}

export interface MapsClientConfig {
  enabled: boolean;
  provider: string | null;
  public_key: string | null;
  map_id?: string | null;
  default_center?: { latitude: number; longitude: number } | null;
  default_zoom?: number;
}

export type DeliverySettlementState = 'settled' | 'pending';

export interface DeliveryPaymentState {
  amount: number;
  collected_at: string | null;
  settlement: DeliverySettlementState;
  settled_at: string | null;
  required: number;
  available: number;
  shortfall: number;
  wallet_balance: number;
}

export interface CashConfirmResponse {
  order: DeliveryOrder;
  payment: DeliveryPaymentState;
}

export interface RideCashResponse {
  ride: Ride;
  payment: DeliveryPaymentState;
}

export interface RideSettleResponse extends RideCashResponse {
  settled: boolean;
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

export interface WalletTopupVerifyResult {
  status: string;
  payment_number: string;
  already_processed: boolean;
  wallet: WalletSummary;
}