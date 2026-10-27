export type { ServiceType } from './models';

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data: T;
  meta?: Record<string, unknown>;
  errors?: Record<string, string[]>;
}

export interface Paginated<T> {
  current_page: number;
  data: T[];
  first_page_url: string | null;
  from: number | null;
  last_page: number;
  last_page_url: string | null;
  next_page_url: string | null;
  path: string;
  per_page: number;
  prev_page_url: string | null;
  to: number | null;
  total: number;
}

/**
 * Backend-resolved serviceability for the requested delivery location. The
 * server is the single source of truth: clients render an unavailable state
 * when `is_serviceable` is false and never infer the zone themselves.
 */
export interface Serviceability {
  is_serviceable: boolean;
  reason: string | null;
  service: string;
  zone_id: number | null;
  zone_name: string | null;
  search_radius_km: number | null;
  /** Food verdicts only (`meta.serviceability` on Food endpoints). */
  allows_cross_zone_food_delivery?: boolean;
  /** Grocery verdicts only (`meta.grocery_serviceability`). */
  allows_cross_zone_grocery_delivery?: boolean;
  zone_version?: number;
}

export interface MetaWithServiceability {
  serviceability?: Serviceability;
  /**
   * Grocery verdict published alongside the Food one on shared discovery
   * endpoints (`/discovery/home`, `/discovery/search`, `/discovery/featured`).
   * Grocery-only endpoints reuse `meta.serviceability` for the same payload.
   */
  grocery_serviceability?: Serviceability;
}
