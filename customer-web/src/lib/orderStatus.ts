import type { OrderStatus, OrderType } from '@/types/models';

/**
 * Canonical Food order-tracking steps shown in the progress indicator.
 *
 * Backend statuses are many-to-one against these steps (e.g. PENDING and the
 * legacy PLACED both render as the first "Placed" step; ACCEPTED and CONFIRMED
 * both render as "Accepted"), so the tracker never jumps or shows a step the
 * customer never saw.
 */
export const FOOD_TRACKING_FLOW = [
  'PLACED',
  'ACCEPTED',
  'PREPARING',
  'READY',
  'PARTNER_ASSIGNED',
  'PICKED_UP',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
] as const;

export type FoodTrackingStepKey = (typeof FOOD_TRACKING_FLOW)[number];

export const STEP_LABELS: Record<FoodTrackingStepKey, string> = {
  PLACED: 'Placed',
  ACCEPTED: 'Accepted',
  PREPARING: 'Preparing',
  READY: 'Ready',
  PARTNER_ASSIGNED: 'Partner assigned',
  PICKED_UP: 'Picked up',
  OUT_FOR_DELIVERY: 'On the way',
  DELIVERED: 'Delivered',
};

/** Map any backend order status onto its canonical tracking step. */
export function normalizeFoodStatus(status: OrderStatus | string | null | undefined): FoodTrackingStepKey {
  switch (status) {
    case 'ACCEPTED':
    case 'CONFIRMED':
      return 'ACCEPTED';
    case 'PREPARING':
    case 'PICKING':
    case 'PROCESSING':
    case 'PACKED':
      return 'PREPARING';
    case 'READY':
      return 'READY';
    case 'PARTNER_ASSIGNED':
      return 'PARTNER_ASSIGNED';
    case 'PICKED_UP':
      return 'PICKED_UP';
    case 'OUT_FOR_DELIVERY':
    case 'ARRIVED':
      return 'OUT_FOR_DELIVERY';
    case 'DELIVERED':
      return 'DELIVERED';
    // PENDING / PLACED / SCHEDULED and anything unknown are pre-acceptance.
    default:
      return 'PLACED';
  }
}

export interface OrderStep {
  key: string;
  label: string;
  state: 'done' | 'current' | 'todo';
}

/** Build the tracker steps for the current status (cancelled = no step active). */
export function buildOrderSteps(status: OrderStatus | string, cancelled = false): OrderStep[] {
  const currentStep = normalizeFoodStatus(status);
  const currentIndex = FOOD_TRACKING_FLOW.indexOf(currentStep);
  return FOOD_TRACKING_FLOW.map((key, idx) => {
    let state: OrderStep['state'] = 'todo';
    if (!cancelled) {
      if (idx < currentIndex) state = 'done';
      else if (idx === currentIndex && status === 'DELIVERED') state = 'done';
      else if (idx === currentIndex) state = 'current';
    }
    return { key, label: STEP_LABELS[key], state };
  });
}

export interface OrderProgress {
  currentKey: FoodTrackingStepKey;
  currentLabel: string;
  /** 0-based index of the current step within the flow. */
  index: number;
  total: number;
  /** 0-100, used by the compact non-scrolling progress bar. */
  percent: number;
}

/**
 * Compact progress derived from the real backend status. Replaces the old
 * horizontally-scrolling timeline: callers render a single current label plus a
 * short progress bar instead of every step.
 */
export function orderProgress(status: OrderStatus | string, cancelled = false): OrderProgress {
  const currentKey = normalizeFoodStatus(status);
  const total = FOOD_TRACKING_FLOW.length;
  const index = Math.max(0, FOOD_TRACKING_FLOW.indexOf(currentKey));
  const stepReached = status === 'DELIVERED' ? total : index + 1;
  const percent = cancelled ? 0 : Math.round((stepReached / total) * 100);
  return {
    currentKey,
    currentLabel: STEP_LABELS[currentKey],
    index,
    total,
    percent,
  };
}

/**
 * Prominent status heading for the tracking hero. Food copy is Zomato-style;
 * grocery reuses the same shape with store-oriented nouns so the shared screen
 * stays coherent for both services.
 */
export function orderStatusHeading(status: OrderStatus | string, orderType: OrderType | string): string {
  if (status === 'CANCELLED') return 'Order cancelled';
  const store = orderType === 'grocery' ? 'store' : 'restaurant';
  switch (status) {
    case 'SCHEDULED':
      return 'Your order is scheduled';
    case 'PENDING':
    case 'PLACED':
      return `Waiting for ${store} confirmation`;
    case 'ACCEPTED':
    case 'CONFIRMED':
      return `${orderType === 'grocery' ? 'Store' : 'Restaurant'} has accepted your order`;
    case 'PREPARING':
    case 'PICKING':
    case 'PROCESSING':
    case 'PACKED':
      return 'Preparing your order';
    case 'READY':
      return 'Your order is ready for pickup';
    case 'PARTNER_ASSIGNED':
      return 'Your delivery partner is waiting to pick up your order';
    case 'PICKED_UP':
      return 'Your order has been picked up';
    case 'OUT_FOR_DELIVERY':
      return 'Your order is on its way';
    case 'ARRIVED':
      return 'Your delivery partner has arrived';
    case 'DELIVERED':
      return orderType === 'grocery' ? 'Order delivered' : 'Enjoy your meal! Order delivered';
    default:
      return 'Tracking your order';
  }
}

/**
 * Delivery-partner banner copy. Shown only while a partner is assigned to a
 * non-terminal order; the message changes as the order moves through dispatch.
 */
export function partnerBannerMessage(status: OrderStatus | string): string | null {
  switch (status) {
    case 'PARTNER_ASSIGNED':
      return 'Your delivery partner is waiting to pick up your order';
    case 'PICKED_UP':
      return 'Your delivery partner has picked up your order';
    case 'OUT_FOR_DELIVERY':
      return 'Your delivery partner is heading to you';
    case 'ARRIVED':
      return 'Your delivery partner has arrived';
    default:
      return null;
  }
}

export function isTerminalStatus(status: OrderStatus | string): boolean {
  const normalized = String(status).toUpperCase();
  return normalized === 'DELIVERED' || normalized === 'CANCELLED';
}
