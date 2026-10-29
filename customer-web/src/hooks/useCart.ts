import { useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { repositories } from '@/repositories';
import { useCartStore } from '@/store/cartStore';
import { useAppStore } from '@/store/appStore';
import type { CartItem, OrderType } from '@/types/models';

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

export function useSetDeliveryAddress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ addressId, type, deliveryMode }: { addressId: number | null; type: OrderType; deliveryMode?: 'instant' | 'scheduled' }) =>
      repositories.cart.setDeliveryAddress(addressId, type, deliveryMode),
    onSuccess: (cart) => {
      syncCount(cart.cart_type, cart.items);
      queryClient.setQueryData(cartKeys.type(cart.cart_type), cart);
      queryClient.invalidateQueries({ queryKey: ['cart'] });
    },
  });
}

/**
 * Keep the cart's delivery address in step with the location the customer chose
 * on the home header.
 *
 * Every address picker writes both sides — `setLocation(loc, addressId)` for the
 * header and the cart's `address_id` for checkout — so the two only disagree
 * when the location was picked while the cart did not exist yet: the backend
 * then seeds a new cart with the default address. This re-applies the chosen
 * address as soon as the cart has items, once per address, so it reconciles
 * that case without ever overriding a later pick (which always updates both
 * sides, making the values equal).
 */
export function useSyncCartAddress(
  type: OrderType,
  cart: { address_id?: number | null; items?: unknown[] } | null | undefined
) {
  const locationAddressId = useAppStore((s) => s.locationAddressId);
  const setDeliveryAddress = useSetDeliveryAddress();
  const appliedTo = useRef<number | null>(null);

  const addressId = cart?.address_id ?? null;
  const itemsCount = cart?.items?.length ?? 0;

  useEffect(() => {
    if (itemsCount === 0 || locationAddressId === null) return;

    if (addressId === locationAddressId) {
      appliedTo.current = locationAddressId;
      return;
    }

    if (appliedTo.current === locationAddressId) return;
    appliedTo.current = locationAddressId;

    // Background reconciliation: a rejected call (cart emptied underneath us,
    // address since deleted) just leaves the cart's own address in place.
    setDeliveryAddress.mutate(
      { addressId: locationAddressId, type },
      { onError: () => undefined }
    );
    // `mutate` is stable across renders (react-query), so it is read fresh each
    // run without being a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationAddressId, addressId, itemsCount, type]);
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