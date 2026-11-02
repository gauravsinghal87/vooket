/**
 * Public type surface for the rides module.
 * Canonical wire shapes stay in `@/shared/types`; the module re-exports only
 * the contracts its screens and components need.
 */
export type { Offer } from '@/shared/types/catalog';
export type { Cart, Order, Ride, RideEstimate, RideRoute, VehicleType, NearbyDriver, SavedPlace, ServiceType } from '@/shared/types/models';
export type { Serviceability } from '@/shared/types/api';
