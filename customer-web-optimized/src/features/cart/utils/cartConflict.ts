import { ApiError } from '@/shared/services/apiClient';
import type { Cart, OrderType } from '@/shared/types/models';

/**
 * The backend's single-store cart rule rejects an add that would mix stores
 * with a 400 and this exact message (`CartController::addItem`). It is the only
 * signal that distinguishes a cross-store conflict from the many other 400s
 * the endpoint can return (validation, unavailable product, invalid options),
 * so the replacement flow keys off this literal rather than the status code.
 */
export const CROSS_STORE_ERROR_MESSAGE = 'Cannot add items from a different store to the cart';

/** The exact body `POST /cart/items` accepts, preserved verbatim for the retry. */
export interface CartAddInput {
  product_id: number;
  quantity: number;
  cart_type?: OrderType;
  product_variant_id?: number | null;
  selected_options?: { group_id: number; option_id: number }[];
  /** Per-item cooking request (Zomato's "Add a cooking request"). */
  special_instructions?: string;
}

/**
 * True only for the cross-store conflict. A 400 carrying any other message is
 * left to the caller's normal error handling so validation and availability
 * failures are never swallowed by the replacement dialog.
 */
export function isCrossStoreError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : '';
  if (message.trim() !== CROSS_STORE_ERROR_MESSAGE) return false;
  return error instanceof ApiError ? error.status === 400 : true;
}

/**
 * Pre-flight check so a known conflict opens the dialog without spending a
 * failed POST. Only trusted when both vendors are present and the cart actually
 * holds items; otherwise the request runs and the server response is the
 * fallback (the cart query may be stale or unloaded).
 */
export function hasCrossStoreConflict(
  cart: Cart | null | undefined,
  productVendorId: number | null | undefined
): boolean {
  if (!cart || !productVendorId) return false;
  if ((cart.items ?? []).length === 0) return false;
  return cart.vendor_id != null && cart.vendor_id !== productVendorId;
}
