import type { OrderTracking } from '@/shared/types/models';

export const TRACKING_ACTIVE_STATUSES = ['PARTNER_ASSIGNED', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'ARRIVED'];

export function isTrackingActive(tracking: OrderTracking | null | undefined): boolean {
  return !!tracking?.tracking?.enabled && !!tracking.tracking.in_progress;
}

export function hasLiveLocation(tracking: OrderTracking | null | undefined): boolean {
  return (
    !!tracking?.location &&
    tracking.location.lat !== null &&
    tracking.location.lng !== null
  );
}

export function formatEta(etaMinutes: number | null | undefined): string | null {
  if (etaMinutes === null || etaMinutes === undefined) return null;
  const mins = Math.max(1, Math.round(etaMinutes));
  return mins <= 90 ? `~${mins} min` : `~${(mins / 60).toFixed(1)} hr`;
}

export function formatDistance(km: number | null | undefined): string | null {
  if (km === null || km === undefined) return null;
  return km >= 10 ? `${km.toFixed(1)} km` : `${km.toFixed(2)} km`;
}