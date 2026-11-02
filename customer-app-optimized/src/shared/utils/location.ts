import * as ExpoLocation from 'expo-location';
import type { Address, Location } from '@/shared/types/catalog';

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

/** getCurrentPositionAsync has no timeout option, so bound it here. */
const LOCATION_TIMEOUT_MS = 15000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(null), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

export async function currentLocation(): Promise<GeoLocationResult> {
  try {
    const servicesEnabled = await ExpoLocation.hasServicesEnabledAsync();
    if (!servicesEnabled) {
      return {
        ok: false,
        error: 'Location services are turned off. Please enable them in your device settings and try again.',
      };
    }

    const { granted, canAskAgain } = await ExpoLocation.requestForegroundPermissionsAsync();
    if (!granted) {
      return {
        ok: false,
        error: canAskAgain
          ? 'Location permission denied. Please allow location access and try again.'
          : 'Location permission denied. Please enable it in your device settings and try again.',
      };
    }

    const pos = await withTimeout(
      ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.Balanced }),
      LOCATION_TIMEOUT_MS
    );
    if (!pos) {
      return { ok: false, error: 'Timed out while determining your location. Please try again.' };
    }

    return {
      ok: true,
      location: {
        label: 'Current location',
        address: `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`,
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Could not determine your location.' };
  }
}