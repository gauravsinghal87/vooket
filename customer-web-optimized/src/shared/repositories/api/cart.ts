import type { CartRepository } from '../interfaces';
import { apiClient } from '@/shared/services/apiClient';
import type { Cart } from '@/shared/types/models';

function unwrapCart(result: unknown): Cart | { cart: null; items: [] } {
  if (Array.isArray(result)) return { cart: null, items: [] };
  if (result && typeof result === 'object') {
    const obj = result as Record<string, unknown>;
    if (obj && typeof obj === 'object' && 'items' in obj && 'cart' in obj) {
      return (obj.cart as Cart) ?? { cart: null, items: [] };
    }
    if (obj && 'items' in obj && 'cart_type' in obj) {
      return obj as unknown as Cart;
    }
  }
  return { cart: null, items: [] };
}

export class ApiCartRepository implements CartRepository {
  async getCart(): Promise<Cart | { cart: null; items: [] }> {
    const result = await apiClient.get<unknown>(`/cart`);
    return unwrapCart(result);
  }

  async getByType(type: 'food' | 'grocery'): Promise<Cart | null> {
    const qs = new URLSearchParams({ type });
    const result = await apiClient.get<unknown>(`/cart?${qs.toString()}`);
    const cart = unwrapCart(result);
    return 'cart' in cart ? (cart.cart as Cart | null) : cart;
  }

  async addItem(data: {
    product_id: number;
    product_variant_id?: number | null;
    quantity: number;
    cart_type?: 'food' | 'grocery';
    selected_options?: { group_id: number; option_id: number }[] | null;
    special_instructions?: string;
  }): Promise<Cart> {
    const result = await apiClient.post<unknown>(`/cart/items`, data);
    if (result && typeof result === 'object' && 'cart' in (result as Record<string, unknown>)) {
      const nested = (result as { cart: Cart }).cart;
      if (nested) return nested;
    }
    return result as Cart;
  }

  async updateItem(id: number, quantity: number): Promise<Cart> {
    const result = await apiClient.put<unknown>(`/cart/items/${id}`, { quantity });
    if (result && typeof result === 'object' && 'cart' in (result as Record<string, unknown>)) {
      const nested = (result as { cart: Cart }).cart;
      if (nested) return nested;
    }
    return result as Cart;
  }

  async removeItem(id: number): Promise<Cart> {
    const result = await apiClient.delete<unknown>(`/cart/items/${id}`);
    if (result && typeof result === 'object' && 'cart' in (result as Record<string, unknown>)) {
      const nested = (result as { cart: Cart }).cart;
      if (nested) return nested;
    }
    return result as Cart;
  }

  async applyCoupon(code: string): Promise<Cart> {
    const result = await apiClient.post<unknown>(`/cart/coupon`, { code });
    if (result && typeof result === 'object' && 'cart' in (result as Record<string, unknown>)) {
      const nested = (result as { cart: Cart }).cart;
      if (nested) return nested;
    }
    return result as Cart;
  }

  async setDeliveryAddress(
    addressId: number | null,
    type: 'food' | 'grocery' = 'food',
    deliveryMode?: 'instant' | 'scheduled'
  ): Promise<Cart> {
    const result = await apiClient.post<unknown>(`/cart/delivery-address`, {
      address_id: addressId,
      cart_type: type,
      ...(type === 'grocery' && deliveryMode ? { delivery_mode: deliveryMode } : {}),
    });
    if (result && typeof result === 'object' && 'cart' in (result as Record<string, unknown>)) {
      const nested = (result as { cart: Cart }).cart;
      if (nested) return nested;
    }
    return result as Cart;
  }

  async removeCoupon(): Promise<Cart> {
    const result = await apiClient.delete<unknown>(`/cart/coupon`);
    if (result && typeof result === 'object' && 'cart' in (result as Record<string, unknown>)) {
      const nested = (result as { cart: Cart }).cart;
      if (nested) return nested;
    }
    return result as Cart;
  }

  async clear(): Promise<void> {
    await apiClient.delete(`/cart`);
  }
}