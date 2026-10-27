import type { Restaurant } from '@/types/catalog';

/**
 * Format a stored wall-clock time ("HH:MM" or "HH:MM:SS") as a 12-hour label
 * such as "9:00 AM". Returns null when the value is unusable.
 */
export function formatWallClock(time: string | null | undefined): string | null {
  if (!time) return null;

  const [hoursRaw, minutesRaw] = time.split(':');
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours > 23 || minutes > 59) {
    return null;
  }

  const period = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;

  return `${hour12}:${String(minutes).padStart(2, '0')} ${period}`;
}

const closedLabel = (restaurant: Restaurant): string => {
  const opens = formatWallClock(restaurant.opens_at);
  return opens ? `Closed · Opens at ${opens}` : 'Closed';
};

/** Rounded integer minutes from a numeric string, or null when unusable. */
const parseMinutes = (value: string | null | undefined): number | null => {
  const parsed = Math.round(Number.parseFloat(value ?? ''));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

/**
 * The minute phrase shown on a restaurant card, sourced from the backend ETA.
 *
 * - `estimated` / `partner_assigned` → "30–35 min"
 * - `closed`                          → "Closed · Opens at 9:00 AM"
 * - `unavailable`                     → null (never a fabricated number)
 *
 * The stored estimate is only used as a fallback when the API did not return a
 * `delivery_eta` payload at all (mock/legacy data source); the API always does.
 */
export function deliveryEtaText(restaurant: Restaurant): string | null {
  const eta = restaurant.delivery_eta;

  if (eta) {
    if (eta.status === 'closed') return closedLabel(restaurant);

    if (eta.status === 'estimated' || eta.status === 'partner_assigned') {
      const { min_minutes: min, max_minutes: max } = eta;
      if (min == null) return null;
      if (max == null || max <= min) return `${min} min`;
      return `${min}\u2013${max} min`;
    }

    return restaurant.is_open ? null : 'Closed';
  }

  if (!restaurant.is_open) return 'Closed';

  const minutes = parseMinutes(restaurant.avg_delivery_time_min || restaurant.avg_prep_time_min);
  return minutes == null ? null : `${minutes} min`;
}

/**
 * The genuine route distance (km) reported by the backend, when present.
 * Returns null so callers can fall back to their own distance.
 */
export function deliveryDistanceKm(restaurant: Restaurant): number | null {
  const km = restaurant.delivery_eta?.travel_distance_km;

  return typeof km === 'number' && Number.isFinite(km) && km > 0 ? km : null;
}
