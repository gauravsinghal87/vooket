import type { Location, Store } from '@/types/catalog';

const EARTH_RADIUS_KM = 6371;

const toRadians = (deg: number): number => (deg * Math.PI) / 180;

/**
 * Parses a coordinate that the API may send as a number or a decimal string.
 * Returns null when the value is missing, non-numeric or out of range, so
 * callers never rank a store on garbage coordinates.
 */
export function parseCoordinate(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

export function hasValidCoordinates(
  point: { latitude?: number | string | null; longitude?: number | string | null } | null | undefined
): boolean {
  if (!point) return false;
  const lat = parseCoordinate(point.latitude);
  const lng = parseCoordinate(point.longitude);
  if (lat === null || lng === null) return false;
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

/**
 * Great-circle distance in kilometres between two lat/lng points.
 * Returns null when either coordinate pair is unusable.
 */
export function haversineKm(
  from: { latitude: number | string | null | undefined; longitude: number | string | null | undefined },
  to: { latitude: number | string | null | undefined; longitude: number | string | null | undefined }
): number | null {
  const lat1 = parseCoordinate(from.latitude);
  const lng1 = parseCoordinate(from.longitude);
  const lat2 = parseCoordinate(to.latitude);
  const lng2 = parseCoordinate(to.longitude);
  if (lat1 === null || lng1 === null || lat2 === null || lng2 === null) return null;
  if (Math.abs(lat1) > 90 || Math.abs(lng1) > 180 || Math.abs(lat2) > 90 || Math.abs(lng2) > 180) return null;

  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** A store can only serve delivery orders — pickup-only stores are skipped. */
export function canDeliverToCustomer(store: Store): boolean {
  return store.order_type !== 'pickup';
}

export interface RankedStore {
  store: Store;
  distanceKm: number;
}

/**
 * Ranks grocery stores by real distance from the customer and returns the
 * nearest eligible one. Stores that are closed, pickup-only or missing usable
 * coordinates are never eligible, so an out-of-range store can never win.
 *
 * This mirrors the web implementation exactly so both clients resolve the same
 * store for the same selected location.
 */
export function nearestEligibleStore(
  stores: Store[],
  origin: Location | null
): RankedStore | null {
  if (stores.length === 0 || !origin) return null;
  if (!hasValidCoordinates(origin)) return null;

  let best: RankedStore | null = null;

  for (const store of stores) {
    if (!store.is_open) continue;
    if (!canDeliverToCustomer(store)) continue;

    const distanceKm = haversineKm(origin, store);
    if (distanceKm === null) continue;

    if (!best || distanceKm < best.distanceKm) {
      best = { store, distanceKm };
    }
  }

  return best;
}

/** Human-readable distance, e.g. "820 m" or "1.4 km". */
export function formatDistanceKm(km: number | null | undefined): string {
  if (km === null || km === undefined || !Number.isFinite(km)) return '';
  if (km < 1) return `${Math.max(10, Math.round((km * 1000) / 10) * 10)} m`;
  return `${km.toFixed(1)} km`;
}

/** Beyond this the store is not a realistic delivery option for the estimate. */
const MAX_ESTIMATE_DISTANCE_KM = 25;

/**
 * Short "arrives in" estimate derived from the real distance.
 * Returns null when the store is too far away for a meaningful estimate,
 * so the UI never shows an absurd delivery time.
 */
export function estimateDeliveryMinutes(distanceKm: number | null | undefined): number | null {
  if (distanceKm === null || distanceKm === undefined || !Number.isFinite(distanceKm)) return null;
  if (distanceKm <= 0 || distanceKm > MAX_ESTIMATE_DISTANCE_KM) return null;
  return Math.min(60, Math.max(8, Math.round(distanceKm * 2.5) + 6));
}

/** Stable cache key fragment for a lat/lng pair. */
export function coordsKey(location: Pick<Location, 'latitude' | 'longitude'> | null): string {
  if (!location) return 'none';
  return `${location.latitude.toFixed(4)},${location.longitude.toFixed(4)}`;
}
