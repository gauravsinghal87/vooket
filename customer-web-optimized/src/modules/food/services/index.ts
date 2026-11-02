import { repositories } from '@/shared/repositories';
import type { FoodRepository } from '@/shared/repositories/interfaces';

/**
 * Food discovery, restaurant, menu and category reads.
 *
 * The module owns this surface. Screens and components import `foodService`
 * instead of reaching into the shared repository registry directly, so the
 * module's API contract can evolve (or be swapped for another transport) behind
 * one boundary. The repository still owns HTTP and the Laravel contract.
 */
export const foodService: FoodRepository = repositories.food;
