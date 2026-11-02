import { useCallback } from 'react';
import { useAddToCart } from '@/features/cart/hooks/useCart';
import { useCartConflictStore } from '@/features/cart/store/cartConflictStore';
import { isCrossStoreError, type CartAddInput } from '@/features/cart/utils/cartConflict';
import type { Cart } from '@/shared/types/models';

interface CartAddOptions {
  /** Shown in the replacement dialog so the pending item is identifiable. */
  productName?: string;
  onSuccess?: (cart: Cart) => void;
  onError?: (error: unknown) => void;
}

/**
 * Add-to-cart entry point that understands the single-store cart rule.
 *
 * A normal add behaves exactly like `useAddToCart`. If the server rejects the
 * request because the cart already belongs to another restaurant, the exact
 * payload is parked in the conflict store and the replacement dialog opens
 * instead of surfacing a raw error. All other failures fall through to
 * `onError`, so validation messages and availability errors are unaffected.
 */
export function useCartAdd() {
  const add = useAddToCart();
  const openConflict = useCartConflictStore((s) => s.open);

  const submit = useCallback(
    (payload: CartAddInput, options?: CartAddOptions) => {
      add.mutate(payload, {
        onSuccess: (cart) => options?.onSuccess?.(cart),
        onError: (error) => {
          if (isCrossStoreError(error)) {
            openConflict({
              payload,
              productName: options?.productName,
              onAdded: options?.onSuccess,
            });
            return;
          }
          options?.onError?.(error);
        },
      });
    },
    [add, openConflict]
  );

  return { submit, isPending: add.isPending };
}
