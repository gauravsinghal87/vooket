import type { Address, Ride } from '@/typings/models';

/** VendorLite runtime shape (server also serializes lat/lng, typed loosely here). */
export interface PickupPoint {
  address?: string | null;
  business_name?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
}

type HasCoords = PickupPoint | Address | null | undefined;

const GMAPS = 'https://www.google.com/maps';

function coordsOf(x: HasCoords): { lat: number; lng: number } | null {
  if (!x) return null;
  const lat = Number(x.latitude);
  const lng = Number(x.longitude);
  if (Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0) return { lat, lng };
  return null;
}

/** Exposed coordinate helper so embedded maps can reuse the same parsing. */
export function pointCoords(x: HasCoords): { lat: number; lng: number } | null {
  return coordsOf(x);
}

/** Ride pickup point as { lat, lng } when the ride carries coordinates. */
export function rideOrigin(ride: Ride): { lat: number; lng: number } | null {
  return coordsOf({ latitude: ride.pickup_latitude, longitude: ride.pickup_longitude } as PickupPoint);
}

/** Ride destination as { lat, lng } when the ride carries coordinates. */
export function rideDestination(ride: Ride): { lat: number; lng: number } | null {
  return coordsOf({ latitude: ride.destination_latitude, longitude: ride.destination_longitude } as PickupPoint);
}

/** Driving directions for a ride — pickup to destination, falls back to address text. */
export function rideDirectionsUrl(ride: Ride): string | null {
  const o = coordsOf({ latitude: ride.pickup_latitude, longitude: ride.pickup_longitude } as PickupPoint);
  const d = coordsOf({ latitude: ride.destination_latitude, longitude: ride.destination_longitude } as PickupPoint);

  if (o && d) {
    const midLat = ((o.lat + d.lat) / 2).toFixed(5);
    const midLng = ((o.lng + d.lng) / 2).toFixed(5);
    return `${GMAPS}/dir/${o.lat},${o.lng}/${d.lat},${d.lng}/@${midLat},${midLng},14z/data=!3m1!4b1!4m2!4m1!3e0`;
  }

  const origin = ride.pickup_address?.trim() || 'Pickup point';
  const destination = ride.destination_address?.trim() || 'Destination';
  const search = `{"origin":{"text":"${origin}"},"destination":{"text":"${destination}"}}`;
  return `${GMAPS}/search/${encodeURIComponent(search)}`;
}

/** Full store (pickup) address. Prefers the full street text. */
export function fullPickupAddress(pickup: PickupPoint | null | undefined): string {
  if (!pickup) return 'Store';
  const a = pickup.address?.trim();
  if (a) return a;
  return pickup.business_name?.trim() || 'Store';
}

/** Full customer (drop) address — all lines + landmark + city/state/pincode. */
export function fullDropAddress(address?: Address | null): string {
  if (!address) return '—';
  const parts = [
    address.address_line_1,
    address.address_line_2,
    address.landmark,
    address.city,
    address.state,
    address.postal_code,
  ].filter((p): p is string => typeof p === 'string' && p.trim() !== '');
  return parts.length ? parts.join(', ') : `#${address.id}`;
}

/**
 * Google Maps driving directions — the shortest driving route from the store
 * (pickup) to the customer (drop). Prefers real coordinates; falls back to
 * the full address text so the link always works.
 */
export function mapsDirectionsUrl(pickup: PickupPoint | null | undefined, drop: Address | null | undefined): string | null {
  const o = coordsOf(pickup);
  const d = coordsOf(drop);

  if (o && d) {
    const midLat = ((o.lat + d.lat) / 2).toFixed(5);
    const midLng = ((o.lng + d.lng) / 2).toFixed(5);
    return `${GMAPS}/dir/${o.lat},${o.lng}/${d.lat},${d.lng}/@${midLat},${midLng},14z/data=!3m1!4b1!4m2!4m1!3e0`;
  }

  const origin = fullPickupAddress(pickup);
  const destination = fullDropAddress(drop);
  if (destination === '—') return null;
  const search = `{"origin":{"text":"${origin}"},"destination":{"text":"${destination}"}}`;
  return `${GMAPS}/search/${encodeURIComponent(search)}`;
}

/** Google Maps URL that drops a pin at the given location (fallback text search). */
export function mapsPinUrl(x: PickupPoint | Address | null | undefined): string {
  const c = coordsOf(x);
  if (c) return `${GMAPS}/search/?api=1&query=${c.lat},${c.lng}`;
  const text = x && 'address_line_1' in x ? fullDropAddress(x as Address) : fullPickupAddress(x as PickupPoint);
  return text !== '—' ? `${GMAPS}/search/?api=1&query=${encodeURIComponent(text)}` : `${GMAPS}/search/?api=1&query=my%20location`;
}

/** Alias for consistency with the request-queue card: full store (pickup) address text. */
export function pickupText(pickup: PickupPoint | null | undefined): string {
  return fullPickupAddress(pickup);
}
export function mapsRouteUrl(pickup: PickupPoint | null | undefined, order: { address?: Address | null } | null | undefined): string | null {
  return mapsDirectionsUrl(pickup, order?.address ?? null);
}
