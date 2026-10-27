import { create } from 'zustand';
import type { Cart } from '@/types/models';
import type { CartAddInput } from '@/lib/cartConflict';

/**
 * A single add-to-cart request that was blocked because the cart already holds
 * items from another restaurant. It is preserved intact — including the exact
 * selected options and quantity the customer chose — until the replacement is
 * resolved, so the customization flow never has to be reopened or guessed.
 */
export interface PendingCartAdd {
  payload: CartAddInput;
  productName?: string;
  /** Fired after a successful clear-and-add so the origin UI can reconcile. */
  onAdded?: (cart: Cart) => void;
}

interface CartConflictState {
  pending: PendingCartAdd | null;
  processing: boolean;
  open: (pending: PendingCartAdd) => void;
  close: () => void;
  setProcessing: (processing: boolean) => void;
}

/**
 * Ephemeral UI state for the cross-restaurant replacement dialog. It is not a
 * second cart: quantities, totals and items still come solely from the shared
 * `['cart']` query cache. Only the paused request lives here.
 */
export const useCartConflictStore = create<CartConflictState>((set) => ({
  pending: null,
  processing: false,
  open: (pending) => set({ pending, processing: false }),
  close: () => set({ pending: null, processing: false }),
  setProcessing: (processing) => set({ processing }),
}));
