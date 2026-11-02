/**
 * Public type surface for the grocery module.
 * Canonical wire shapes stay in `@/shared/types`; the module re-exports only
 * the contracts its screens and components need.
 */
export type { Store, Product, Category, Offer, Banner } from '@/shared/types/catalog';
export type { Cart, Order, ServiceType } from '@/shared/types/models';
export type { Serviceability } from '@/shared/types/api';
