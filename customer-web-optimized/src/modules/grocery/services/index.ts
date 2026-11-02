import { repositories } from '@/shared/repositories';
import type { GroceryRepository } from '@/shared/repositories/interfaces';

/**
 * Grocery store, catalogue, category and store-discovery reads.
 *
 * The module owns this surface. Screens and components import `groceryService`
 * instead of reaching into the shared repository registry directly, so the
 * module's API contract can evolve (or be swapped for another transport) behind
 * one boundary. The repository still owns HTTP and the Laravel contract.
 */
export const groceryService: GroceryRepository = repositories.grocery;
