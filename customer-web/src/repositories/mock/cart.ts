import type { CartRepository } from '../interfaces';
import type { Cart, CartItem } from '@/types/models';
import { mockProducts } from './data';
import { getOrCreateCart, recalculateCart } from './mockState';

const delay = (ms = 300) => new Promise((r) => setTimeout(r, ms));

export class MockCartRepository implements CartRepository {
  private currentUserId = 1;

  async getCart(): Promise<Cart | { cart: null; items: [] }> {
    await delay();
    const cart = getOrCreateCart(this.currentUserId, 'food');
    return cart.items.length ? cart : { cart: null, items: [] };
  }

  async getByType(type: 'food' | 'grocery'): Promise<Cart | null> {
    await delay(150);
    const cart = getOrCreateCart(this.currentUserId, type);
    return cart.items.length ? cart : null;
  }

  async addItem({
    product_id,
    quantity,
    cart_type = 'food',
    special_instructions,
  }: {
    product_id: number;
    quantity: number;
    cart_type?: 'food' | 'grocery';
    special_instructions?: string;
  }): Promise<Cart> {
    await delay();
    const product = mockProducts.find((p) => p.id === product_id) ?? mockProducts[0];
    const productType = cart_type ?? (product.type === 'grocery' ? 'grocery' : 'food');
    const targetCart = getOrCreateCart(this.currentUserId, productType);
    const existing = targetCart.items.find((i) => i.product_id === product_id);
    if (existing) {
      existing.quantity += quantity;
      existing.line_total = (parseFloat(existing.unit_price) * existing.quantity).toFixed(2);
    } else {
      const item: CartItem = {
        id: targetCart.items.length + 1,
        cart_id: targetCart.id,
        product_id,
        product_variant_id: null,
        unit_price: product.price,
        quantity,
        line_total: (parseFloat(product.price) * quantity).toFixed(2),
        selected_options: null,
        selected_addons: null,
        special_instructions: special_instructions ?? null,
        product,
      };
      targetCart.items.push(item);
    }
    recalculateCart(targetCart);
    return targetCart;
  }

  async updateItem(id: number, quantity: number): Promise<Cart> {
    await delay();
    for (const cart of this.allCarts()) {
      const item = cart.items.find((i) => i.id === id);
      if (item) {
        item.quantity = quantity;
        item.line_total = (parseFloat(item.unit_price) * quantity).toFixed(2);
        recalculateCart(cart);
        return cart;
      }
    }
    throw new Error('Item not found');
  }

  async removeItem(id: number): Promise<Cart> {
    await delay();
    for (const cart of this.allCarts()) {
      const before = cart.items.length;
      cart.items = cart.items.filter((i) => i.id !== id);
      if (cart.items.length !== before) {
        recalculateCart(cart);
        return cart;
      }
    }
    throw new Error('Item not found');
  }

  async applyCoupon(code: string): Promise<Cart> {
    await delay(400);
    const cart = this.primaryCart();
    if (code.toLowerCase() === 'first50') {
      cart.coupon_code = code;
      cart.discount = (parseFloat(cart.subtotal) * 0.1).toFixed(2);
      recalculateCart(cart);
    } else {
      throw new Error('Invalid coupon code');
    }
    return cart;
  }

  async setDeliveryAddress(
    addressId: number | null,
    type: 'food' | 'grocery' = 'food',
    deliveryMode: 'instant' | 'scheduled' = 'instant'
  ): Promise<Cart> {
    await delay(300);
    const cart = getOrCreateCart(this.currentUserId, type);
    const distanceKm =
      addressId === 1
        ? 3.2
        : addressId === 2
          ? 7.8
          : addressId === 3
            ? 5.1
            : 0;
    cart.address_id = addressId;
    cart.delivery_distance_km = distanceKm.toFixed(2);

    if (type === 'grocery') {
      cart.delivery_mode = deliveryMode;
      if (deliveryMode === 'scheduled') {
        // Mirrors the Scheduled Free Delivery mock configuration.
        cart.delivery_fee = '0.00';
        cart.delivery_gst_percent = '0';
        cart.delivery_gst_amount = '0.00';
        cart.packaging_fee = '12.00';
        cart.handling_fee = '4.00';
        recalculateCart(cart);
        return cart;
      }
      cart.packaging_fee = '0.00';
      cart.handling_fee = '0.00';
    }

    cart.delivery_fee = (30 + 5 * distanceKm).toFixed(2);
    recalculateCart(cart);
    return cart;
  }

  async removeCoupon(): Promise<Cart> {
    await delay();
    const cart = this.primaryCart();
    cart.coupon_code = null;
    cart.discount = '0.00';
    recalculateCart(cart);
    return cart;
  }

  async clear(): Promise<void> {
    await delay(150);
    for (const cart of this.allCarts()) cart.items = [];
  }

  private primaryCart(): Cart {
    return getOrCreateCart(this.currentUserId, 'food');
  }
  private allCarts(): Cart[] {
    return [...mockStateCarts()];
  }
}

import { mockState } from './mockState';
function mockStateCarts() {
  return Array.from(mockState.carts.values());
}
