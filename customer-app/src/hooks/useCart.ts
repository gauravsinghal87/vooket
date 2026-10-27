import { useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { repositories } from '@/api/repositories';
import { useCartStore } from '@/stores/cartStore';
import { useCartConflictStore } from '@/stores/cartConflictStore';
import { isCrossStoreError, type CartAddInput } from '@/lib/cartConflict';
import type { Cart, CartItem, OrderType } from '@/types/models';

export const cartKeys = {
  all: ['cart'] as const,
  type: (type: OrderType) => ['cart', type] as const,
};

/**
 * Resolve the single real cart line that a product-level control (menu row,
 * product card, suggestion rail) should display and mutate.
 *
 * Cart lines use the backend's canonical identity: product_id +
 * product_variant_id + line_signature, where line_signature is the md5 of the
 * option selection set (ProductOptionService::selectionSignature). A simple
 * product therefore owns a single line, while a customisable product can own
 * one line per distinct variation.
 *
 * A product-level control has no variation context, so instead of fabricating a
 * combined quantity (which would wrongly merge distinct variations) it binds to
 * an actual cart entry: the most recently added line for the product. Rendering
 * and increment/decrement both use this same line, so variations stay
 * independent and every tap mutates one identifiable cart entry.
 */
export function resolveCartLine(
  items: CartItem[] | null | undefined,
  productId: number
): CartItem | null {
  let active: CartItem | null = null;
  for (const item of items ?? []) {
    if (item.product_id !== productId) continue;
    if (!active || item.id > active.id) active = item;
  }
  return active;
}

function syncCount(type: OrderType, items?: { quantity: number }[] | null) {
  const total = (items ?? []).reduce((n, i) => n + i.quantity, 0);
  useCartStore.getState().setCount(type, total);
}

export function useCart(type: OrderType) {
  return useQuery({
    queryKey: cartKeys.type(type),
    queryFn: async () => {
      const cart = await repositories.cart.getByType(type);
      syncCount(type, cart?.items);
      return cart;
    },
  });
}

export function useAddToCart() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      product_id: number;
      quantity: number;
      cart_type?: OrderType;
      product_variant_id?: number | null;
      selected_options?: { group_id: number; option_id: number }[];
      special_instructions?: string;
    }) => repositories.cart.addItem(data),
    onSuccess: (cart) => {
      syncCount(cart.cart_type, cart.items);
      queryClient.invalidateQueries({ queryKey: ['cart'] });
    },
  });
}

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

export function useSetDeliveryAddress() {
  const queryClient = useQueryClient();
  const latestRequested = useRef<number | null | undefined>(undefined);
  return useMutation({
    mutationFn: ({
      addressId,
      type,
      deliveryMode,
    }: {
      addressId: number | null;
      type: OrderType;
      deliveryMode?: 'instant' | 'scheduled';
    }) => {
      latestRequested.current = addressId;
      return repositories.cart.setDeliveryAddress(addressId, type, deliveryMode);
    },
    onMutate: async ({ addressId, type }) => {
      const key = cartKeys.type(type);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Cart>(key);
      if (previous) {
        queryClient.setQueryData<Cart>(key, { ...previous, address_id: addressId });
      }
      return { previous, key };
    },
    onError: (_err, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(context.key, context.previous);
      }
    },
    onSuccess: (cart, variables) => {
      if (latestRequested.current !== variables.addressId) return;
      syncCount(cart.cart_type, cart.items);
      queryClient.setQueryData(cartKeys.type(cart.cart_type), cart);
      queryClient.invalidateQueries({ queryKey: ['cart'] });
    },
  });
}

export function useUpdateCartItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, quantity }: { itemId: number; quantity: number }) =>
      repositories.cart.updateItem(itemId, quantity),
    onSuccess: (cart) => {
      syncCount(cart.cart_type, cart.items);
      queryClient.invalidateQueries({ queryKey: ['cart'] });
    },
  });
}

export function useRemoveCartItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemId: number) => repositories.cart.removeItem(itemId),
    onSuccess: (cart) => {
      syncCount(cart.cart_type, cart.items);
      queryClient.invalidateQueries({ queryKey: ['cart'] });
    },
  });
}

export function useApplyCoupon() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => repositories.cart.applyCoupon(code),
    onSuccess: (cart) => queryClient.invalidateQueries({ queryKey: cartKeys.type(cart.cart_type) }),
  });
}

export function useRemoveCoupon() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => repositories.cart.removeCoupon(),
    onSuccess: (cart) => queryClient.invalidateQueries({ queryKey: cartKeys.type(cart.cart_type) }),
  });
}