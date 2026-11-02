/**
 * Shared helpers for the module specific support form (Food / Grocery / Ride).
 *
 * The module of a support request is always resolved from the linked record:
 * an order's `order_type` for Food and Grocery orders, the ride record itself
 * for a ride booking. It is never inferred from the merchant name, the screen
 * title, a product name or an order id.
 *
 * The issue categories themselves come from the API
 * (`GET /support-tickets/issue-categories`), which is the single source of
 * truth shared with Customer Web, so a form can never offer a category the
 * ticket endpoint would reject.
 */
import type { Order } from '@/shared/types/models';

export type SupportModule = 'food' | 'grocery' | 'ride';

export const SUPPORT_MODULES: SupportModule[] = ['food', 'grocery', 'ride'];

export interface SupportIssueCategory {
  value: string;
  label: string;
}

export interface SupportRefundDestination {
  value: string;
  label: string;
}

export interface SupportFormOptions {
  module: SupportModule;
  categories: SupportIssueCategory[];
  default_category: string;
  refund_destinations: SupportRefundDestination[];
}

/** A photo picked for the ticket, ready to be sent as multipart. */
export interface SupportAttachment {
  uri: string;
  name: string;
  type: string;
  size: number;
}

/** Maximum number of evidence photos per ticket — matches the API. */
export const MAX_SUPPORT_ATTACHMENTS = 5;

/** Maximum size of a single evidence photo — matches the API. */
export const MAX_SUPPORT_ATTACHMENT_BYTES = 5 * 1024 * 1024;

export function isSupportModule(value: unknown): value is SupportModule {
  return typeof value === 'string' && (SUPPORT_MODULES as string[]).includes(value);
}

/**
 * Resolve the support module of an order from its authoritative `order_type`.
 *
 * Returns `null` when the order type is missing or unknown so the caller can
 * surface that explicitly instead of silently defaulting every request to
 * Food or Grocery.
 */
export function resolveOrderSupportModule(
  order?: Pick<Order, 'order_type'> | null
): SupportModule | null {
  const type = order?.order_type;
  if (type === 'food' || type === 'grocery') return type;
  return null;
}

/** The human readable name of a module, used in titles and messages. */
export function supportModuleName(module: SupportModule): string {
  switch (module) {
    case 'grocery':
      return 'Grocery';
    case 'ride':
      return 'Ride';
    default:
      return 'Food';
  }
}

/**
 * The evidence guidance shown under the photo picker — same wording as
 * Customer Web, so Grocery and Ride complaints get the guidance that matches
 * their module.
 */
export function supportPhotoHint(module: SupportModule): string {
  switch (module) {
    case 'ride':
      return 'Attach photos only if relevant to your complaint (e.g., vehicle condition).';
    case 'grocery':
      return 'Attach photos of damaged/spoiled products, wrong items, or packaging issues.';
    default:
      return 'Attach photos of damaged/spoiled food, wrong items, or missing items.';
  }
}

/**
 * Pick the category a form should start on: the module default when it is
 * part of the module's categories, otherwise the first available category.
 */
export function resolveDefaultCategory(
  options: Pick<SupportFormOptions, 'categories' | 'default_category'> | undefined
): string | null {
  const categories = options?.categories ?? [];
  if (!categories.length) return null;
  const preferred = options?.default_category;
  if (preferred && categories.some((category) => category.value === preferred)) return preferred;
  return categories[0].value;
}
