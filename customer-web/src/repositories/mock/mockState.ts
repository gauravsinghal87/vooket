// In-memory mock state shared across order/cart/wallet repos so UI flows work.
import type { Cart, Order, OrderItem } from '@/types/models';
import type { WalletTransaction } from '@/types/catalog';
import { mockProducts } from './data';

export const mockState: {
  carts: Map<string, Cart>;
  orders: Order[];
  walletBalance: number;
  walletTransactions: WalletTransaction[];
} = {
  carts: new Map(),
  orders: [],
  walletBalance: 2500,
  walletTransactions: [],
};

const MOCK_GROCERY_FREE_DELIVERY_KM = 2;

export function recalculateCart(cart: Cart): void {
  let subtotal = 0;
  for (const item of cart.items) subtotal += parseFloat(item.line_total);
  const tax = 0;
  let deliveryFee = parseFloat(cart.delivery_fee);
  if (
    cart.cart_type === 'grocery' &&
    cart.delivery_distance_km !== null &&
    cart.delivery_distance_km !== undefined &&
    parseFloat(cart.delivery_distance_km) <= MOCK_GROCERY_FREE_DELIVERY_KM
  ) {
    deliveryFee = 0;
  }
  const gstAmount = (deliveryFee * parseFloat(cart.delivery_gst_percent)) / 100;
  const packagingFee = parseFloat(cart.packaging_fee ?? '0');
  const handlingFee = parseFloat(cart.handling_fee ?? '0');
  const discount = parseFloat(cart.discount);
  cart.delivery_fee = deliveryFee.toFixed(2);
  cart.subtotal = subtotal.toFixed(2);
  cart.tax = tax.toFixed(2);
  cart.delivery_gst_amount = gstAmount.toFixed(2);
  cart.total = Math.max(
    0,
    subtotal + tax + deliveryFee + gstAmount + packagingFee + handlingFee - discount,
  ).toFixed(2);
  cart.items_count = cart.items.reduce((n, i) => n + i.quantity, 0);
}

export function getOrCreateCart(userId: number, type: 'food' | 'grocery'): Cart {
  const key = `${userId}-${type}`;
  let cart = mockState.carts.get(key);
  if (!cart) {
    cart = {
      id: mockState.carts.size + 1,
      user_id: userId,
      session_id: null,
      cart_type: type,
      vendor_id: type === 'grocery' ? 2 : 1,
      address_id: null,
      subtotal: '0.00',
      discount: '0.00',
      tax: '0.00',
      delivery_fee: type === 'grocery' ? '40.00' : '30.00',
      delivery_gst_percent: '18',
      delivery_gst_amount: '0.00',
      total: '0.00',
      coupon_code: null,
      items_count: 0,
      items: [],
    };
    mockState.carts.set(key, cart);
  }
  return cart;
}

export function createOrderFromCart(cart: Cart): Order {
  const orderItems: OrderItem[] = cart.items.map((i) => {
    const p = mockProducts.find((x) => x.id === i.product_id);
    return {
      id: cart.items.indexOf(i) + 1,
      order_id: 0,
      product_id: i.product_id,
      product_variant_id: null,
      product_name: p?.name ?? 'Item',
      product_image: p?.image ?? null,
      unit_price: i.unit_price,
      quantity: i.quantity,
      line_total: i.line_total,
      status: 'PENDING',
    };
  });
  const order: Order = {
    id: mockState.orders.length + 1,
    order_number: `ORD-${1000 + mockState.orders.length + 1}`,
    user_id: cart.user_id ?? 0,
    vendor_id: cart.vendor_id,
    restaurant_id: cart.cart_type === 'food' ? cart.vendor_id : null,
    store_id: cart.cart_type === 'grocery' ? cart.vendor_id : null,
    order_type: cart.cart_type,
    status: 'PENDING',
    payment_status: 'PENDING',
    payment_method: 'wallet',
    address_id: null,
    subtotal: cart.subtotal,
    discount_amount: cart.discount,
    tax_amount: cart.tax,
    delivery_fee: cart.delivery_fee,
    delivery_gst_percent: cart.delivery_gst_percent ?? '0',
    delivery_gst_amount: cart.delivery_gst_amount ?? '0.00',
    packaging_fee: cart.packaging_fee ?? '0.00',
    handling_fee: cart.handling_fee ?? '0.00',
    platform_fee: '0.00',
    total_amount: cart.total,
    wallet_used: '0.00',
    coupon_discount: '0.00',
    coupon_code: cart.coupon_code,
    tip_amount: '0.00',
    customer_note: null,
    scheduled_at: null,
    timing_type: 'instant',
    created_at: new Date().toISOString(),
    items: orderItems,
  };
  mockState.orders.unshift(order);
  return order;
}
