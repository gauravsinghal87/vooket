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

export interface MonthlySuggestion {
  id: number;
  product: ProductLike;
  recommendedQuantity: number;
  unitLabel: string;
  lastPurchased: string;
  suggestedReorderDate: string;
  isEssential: boolean;
}

interface ProductLike {
  id: number;
  name: string;
  image: string | null;
  price: string;
  compare_at_price: string | null;
  is_veg?: boolean | null;
  unit_label?: string | null;
}