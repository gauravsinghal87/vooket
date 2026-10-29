import type { Address, Location } from '@/types/catalog';

/**
 * The header's `label + address` pair for a saved address — the single mapping
 * every picker uses, so the home header and the cart's "to … | …" line read the
 * same text for the same address, and the address id travels with the pick.
 */
export function locationFromAddress(a: Address): Location {
  return {
    label: a.label,
    address: `${a.address_line_1}${a.address_line_2 ? `, ${a.address_line_2}` : ''}, ${a.city}`,
    latitude: parseFloat(String(a.latitude ?? 0)) || 0,
    longitude: parseFloat(String(a.longitude ?? 0)) || 0,
    place_id: a.place_id ?? null,
    formatted_address: a.formatted_address ?? null,
  };
}

export const DEFAULT_LOCATION: Location = {
  label: 'Home',
  address: '12 MG Road, New Delhi',
  latitude: 28.6139,
  longitude: 77.209,
};

export const POPULAR_AREAS: Location[] = [
  { label: 'Connaught Place', address: 'Inner Circle, New Delhi', latitude: 28.6315, longitude: 77.2167 },
  { label: 'Karol Bagh', address: 'Ajmal Khan Road, New Delhi', latitude: 28.645, longitude: 77.19 },
  { label: 'Saket', address: 'District Centre, New Delhi', latitude: 28.5245, longitude: 77.206 },
  { label: 'Lajpat Nagar', address: 'Central Market, New Delhi', latitude: 28.567, longitude: 77.244 },
  { label: 'Vasant Kunj', address: 'Nelson Mandela Marg, New Delhi', latitude: 28.545, longitude: 77.178 },
];

export interface GeoLocationResult {
  ok: boolean;
  location?: Location;
  error?: string;
}

const GEOLOCATION_MESSAGES: Record<number, string> = {
  1: 'Location permission denied. Please allow location access in your browser settings and try again.',
  2: 'Your device could not determine your location. Please try again or pick an area manually.',
  3: 'Location request timed out. Please try again or pick an area manually.',
};

export function currentLocation(): Promise<GeoLocationResult> {
  if (!('geolocation' in navigator)) {
    return Promise.resolve({ ok: false, error: 'Location services are not supported on this device.' });
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          ok: true,
          location: {
            label: 'Current location',
            address: `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`,
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          },
        });
      },
      (err) => resolve({ ok: false, error: GEOLOCATION_MESSAGES[err.code] ?? err.message }),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
    );
  });
}