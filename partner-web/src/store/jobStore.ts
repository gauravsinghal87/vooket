import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { ActiveBatchJob, DeliveryOrder, Ride } from '@/typings/models';
import { isActiveBatchJob } from '@/typings/models';

export type ActiveJob = DeliveryOrder | ActiveBatchJob | null;

interface JobState {
  activeRide: Ride | null;
  activeOrder: ActiveJob;
  setActiveRide: (ride: Ride | null) => void;
  /** Accepts an updater so a single order's result can be folded into a batch
   *  without racing another stop's update. */
  setActiveOrder: (order: ActiveJob | ((current: ActiveJob) => ActiveJob)) => void;
  clear: () => void;
}

const EMPTY_JOB_STATE: { activeRide: null; activeOrder: null } = { activeRide: null, activeOrder: null };

/**
 * Order fields that ActiveJob actually consumes and that legitimately change
 * while a delivery is live. Used to decide whether a new snapshot represents a
 * meaningful update (so the store isn't churned with identical objects).
 */
export const ORDER_SYNC_FIELDS = [
  'status',
  'payment_status',
  'payment_method',
  'delivery_payment_collected_at',
  'delivery_payment_collected_via',
  'delivery_payment_settled_at',
  'delivery_otp_verified_at',
] as const;

export function activeOrderFieldsEqual(a: ActiveJob, b: ActiveJob): boolean {
  if (a === b) return true;
  if (!a || !b) return a === b;

  const aIsBatch = isActiveBatchJob(a);
  const bIsBatch = isActiveBatchJob(b);

  if (aIsBatch !== bIsBatch) return false;

  if (aIsBatch && bIsBatch) {
    if (a.batch_id !== b.batch_id) return false;
    if (a.stop_count !== b.stop_count) return false;
    if (a.status !== b.status) return false;
    if (a.stops.length !== b.stops.length) return false;

    // A stop's own lifecycle fields matter as much as its status: OTP
    // verification, cash collection and settlement all gate delivery and
    // change without touching `status`. Comparing only identities and status
    // would silently drop those updates and strand the stop's controls.
    return a.stops.every((stop, index) => {
      const other = b.stops[index];
      if (!other) return false;
      if (stop.order_id !== other.order_id || stop.sequence !== other.sequence) return false;
      if (stop.status !== other.status) return false;
      return ORDER_SYNC_FIELDS.every((key) => stop.order[key] === other.order[key]);
    });
  }

  if (isActiveBatchJob(a) || isActiveBatchJob(b)) return false;

  const orderA = a as DeliveryOrder;
  const orderB = b as DeliveryOrder;

  if (orderA.id !== orderB.id) return false;
  return ORDER_SYNC_FIELDS.every((key) => orderA[key] === orderB[key]);
}

/**
 * Fold a freshly mutated order back into the active job.
 *
 * A batch is a group of independent orders, so one stop finishing must never
 * discard the rest of the trip. A finished stop is kept and marked so the
 * partner sees it drop off their current work rather than vanish; the next
 * authoritative `active-job` poll removes it from the trip. Once nothing is
 * left to deliver the job is cleared so the partner is free again.
 */
export function applyOrderUpdate(job: ActiveJob, updated: DeliveryOrder): ActiveJob {
  if (!job) return job;

  if (isActiveBatchJob(job)) {
    if (!job.stops.some((stop) => stop.order_id === updated.id)) return job;

    const stops = job.stops.map((stop) =>
      stop.order_id === updated.id ? { ...stop, order: updated, status: updated.status } : stop,
    );

    if (stops.every((stop) => isTerminalOrderStatus(stop.order.status))) {
      return null;
    }

    return {
      ...job,
      order: job.order?.id === updated.id ? updated : job.order,
      orders: job.orders.map((order) => (order.id === updated.id ? updated : order)),
      stops,
    };
  }

  return job.id === updated.id ? updated : job;
}

/** Statuses the backend drops from an active trip the moment they are reached. */
function isTerminalOrderStatus(status?: string | null): boolean {
  return ['DELIVERED', 'CANCELLED'].includes((status ?? '').toUpperCase());
}

/**
 * Ride fields that DriverActiveJob consumes and that legitimately change while
 * a ride is live (payment arriving from the customer, cash collection and
 * settlement). Used to reconcile the store against fresh server snapshots
 * without churning identical objects. Ride-only — delivery orders use
 * ORDER_SYNC_FIELDS above.
 */
export const RIDE_SYNC_FIELDS = [
  'status',
  'payment_status',
  'payment_method',
  'cash_collected',
  'cash_collected_amount',
  'cash_collected_at',
  'cash_collected_via',
  'cash_settled',
  'cash_settled_at',
  'otp_verified',
] as const;

export function activeRideFieldsEqual(a: Ride | null | undefined, b: Ride | null | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return a === b;
  if (a.id !== b.id) return false;
  return RIDE_SYNC_FIELDS.every((key) => a[key] === b[key]);
}

export const useJobStore = create<JobState>()(
  persist(
    (set) => ({
      ...EMPTY_JOB_STATE,
      setActiveRide: (activeRide) => set({ activeRide }),
      setActiveOrder: (next) =>
        set((state) => {
          const activeOrder = typeof next === 'function' ? next(state.activeOrder) : next;
          return activeOrderFieldsEqual(state.activeOrder, activeOrder) ? state : { activeOrder };
        }),
      clear: () => set({ ...EMPTY_JOB_STATE }),
    }),
    {
      name: 'pt-job',
      version: 5,
      storage: createJSONStorage(() => sessionStorage),
      migrate: () => ({ ...EMPTY_JOB_STATE }),
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<JobState>;
        return {
          ...current,
          ...saved,
          activeRide: saved.activeRide ?? null,
          activeOrder: isPersistedJob(saved.activeOrder) ? saved.activeOrder : null,
        };
      },
    }
  )
);

/**
 * A rehydrated job is only trusted when it still has the shape the UI reads.
 * Anything else is dropped so a stale or hand-edited session cannot resurrect a
 * job the server no longer knows about.
 */
function isPersistedJob(value: unknown): value is Exclude<ActiveJob, null> {
  if (!value || typeof value !== 'object' || !('status' in value)) return false;
  if (isActiveBatchJob(value as ActiveBatchJob)) {
    return Array.isArray((value as ActiveBatchJob).stops);
  }
  return 'id' in value;
}

