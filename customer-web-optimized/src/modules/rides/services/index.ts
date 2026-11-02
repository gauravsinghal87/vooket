import { repositories } from '@/shared/repositories';
import type { RideRepository } from '@/shared/repositories/interfaces';

/**
 * Ride estimates, routes, nearby drivers, promos and ride reads.
 *
 * The module owns this surface. Screens and components import `ridesService`
 * instead of reaching into the shared repository registry directly, so the
 * module's API contract can evolve (or be swapped for another transport) behind
 * one boundary. The repository still owns HTTP and the Laravel contract.
 */
export const ridesService: RideRepository = repositories.rides;
