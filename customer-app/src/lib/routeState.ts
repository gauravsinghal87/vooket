import type { Product } from '@/types/catalog';

export type ServiceType = 'food' | 'grocery';

export interface CarriedProduct {
  product: Product;
  type: ServiceType;
}

/**
 * Web passes whole product objects through router state. Expo Router params are
 * strings, so we carry the object in-memory on a per-id basis. The value is
 * read-and-removed by the product screen; callers must carry before pushing.
 */
const productCache = new Map<number, CarriedProduct>();

export function carryProduct(product: Product, type: ServiceType): void {
  productCache.set(product.id, { product, type });
}

export function takeProduct(id: number): CarriedProduct | undefined {
  const value = productCache.get(id);
  productCache.delete(id);
  return value;
}