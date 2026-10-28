import type { OrderHistoryPage, OrderRepository } from '../interfaces';
import type {
  Order,
  OrderTracking,
  PreparationInstructions,
  PreparationInstructionsPayload,
  ServiceType,
  UpdatePreparationInstructionsInput,
} from '@/types/models';
import type { Paginated } from '@/types/api';
import { getOrCreateCart, createOrderFromCart, mockState } from './mockState';
import { mockDeliverySlots, mockProducts } from './data';
import { MockRideRepository } from './ride';

const delay = (ms = 400) => new Promise((r) => setTimeout(r, ms));

const MOCK_INSTRUCTION_OPTIONS = [
  { key: 'make_spicy', label: 'Make it spicy', emoji: '🌶️' },
  { key: 'less_spicy', label: 'Less spicy', emoji: '🌶️' },
  { key: 'less_oil', label: 'Less oil', emoji: '🫒' },
  { key: 'less_salt', label: 'Less salt', emoji: '🧂' },
  { key: 'no_onion', label: 'No onion', emoji: '🧅' },
  { key: 'no_garlic', label: 'No garlic', emoji: '🧄' },
  { key: 'send_cutlery', label: 'Send cutlery', emoji: '🍴' },
  { key: 'extra_sauce', label: 'Send extra sauce', emoji: '🥫' },
  { key: 'extra_chutney', label: 'Send extra chutney', emoji: '🥣' },
];

function mockPreparationInstructions(
  order: Order,
  input?: UpdatePreparationInstructionsInput,
): PreparationInstructionsPayload {
  const editable = ['PENDING', 'PLACED', 'ACCEPTED', 'CONFIRMED'].includes(order.status);
  const meta = (order.meta ?? {}) as Record<string, unknown>;
  const stored = (meta.preparation_instructions ?? null) as PreparationInstructions | null;

  const selected = (input?.selected ?? stored?.selected?.map((s) => s.key) ?? []).map((key) => {
    const option = MOCK_INSTRUCTION_OPTIONS.find((o) => o.key === key);
    return option ?? { key, label: key, emoji: '' };
  });

  const note = input?.note ?? stored?.restaurant_note ?? stored?.note ?? null;

  return {
    service: 'food',
    options: MOCK_INSTRUCTION_OPTIONS,
    editable,
    editable_statuses: ['PENDING', 'PLACED', 'ACCEPTED', 'CONFIRMED'],
    max_note_length: 500,
    instructions: {
      selected,
      note,
      restaurant_note: note,
      send_cutlery: input?.selected?.includes('send_cutlery') ? true : (stored?.send_cutlery ?? null),
      updated_at: input ? new Date().toISOString() : (stored?.updated_at ?? null),
    },
    items: [],
  };
}

export class MockOrderRepository implements OrderRepository {
  /**
   * Mirrors the API: food/grocery read the order list filtered by type, rides
   * read the ride bookings — never one combined, client-filtered list.
   */
  async getHistory(module: ServiceType, page?: number): Promise<OrderHistoryPage> {
    if (module === 'rides') {
      const rides = await new MockRideRepository().getRideHistory();
      return {
        current_page: 1,
        data: rides,
        first_page_url: null,
        from: rides.length ? 1 : null,
        last_page: 1,
        last_page_url: null,
        next_page_url: null,
        path: '/orders',
        per_page: rides.length,
        prev_page_url: null,
        to: rides.length,
        total: rides.length,
      } as unknown as OrderHistoryPage;
    }

    return this.getOrders({ order_type: module, page });
  }

  async getOrders(params?: { status?: string; order_type?: string; page?: number }): Promise<Paginated<Order>> {
    await delay();
    let list = [...mockState.orders];
    if (params?.order_type) list = list.filter((o) => o.order_type === params.order_type);
    if (params?.status && params.status !== 'ALL') list = list.filter((o) => o.status === params.status);
    return {
      current_page: params?.page ?? 1,
      data: list,
      last_page: 1,
      total: list.length,
      per_page: 20,
    } as Paginated<Order>;
  }

  async getOrder(id: number): Promise<Order> {
    await delay(250);
    const order = mockState.orders.find((o) => o.id === id);
    if (!order) throw new Error('Order not found');
    return order;
  }

  async createOrder(data: {
    order_type: 'food' | 'grocery';
    address_id?: number;
    payment_method?: 'wallet' | 'online' | 'cash_on_delivery' | 'upi' | 'card';
    customer_note?: string;
    tip_amount?: number;
    delivery_slot_id?: number;
  }): Promise<Order> {
    await delay(600);
    const cart = getOrCreateCart(1, data.order_type);
    if (!cart.items.length) throw new Error('Cart is empty');
    const order = createOrderFromCart(cart);
    order.payment_method = data.payment_method ?? 'wallet';
    order.payment_status = data.payment_method === 'cash_on_delivery' ? 'PENDING' : 'PAID';

    if (data.order_type === 'grocery' && data.delivery_slot_id) {
      const slot = mockDeliverySlots.find((s) => s.id === data.delivery_slot_id);
      if (!slot) throw new Error('This delivery slot is no longer available.');
      order.status = 'SCHEDULED';
      order.timing_type = 'scheduled';
      order.delivery_slot_id = slot.id;
      order.scheduled_at = slot.starts_at;
      order.meta = {
        ...(order.meta ?? {}),
        delivery_schedule: {
          delivery_mode: 'scheduled',
          slot_id: slot.id,
          slot_date: slot.slot_date,
          start_time: slot.start_time,
          end_time: slot.end_time,
          label: slot.label,
          timezone: slot.slot_timezone,
          starts_at: slot.starts_at,
          ends_at: slot.ends_at,
        },
      };
    } else {
      order.status = 'PENDING';
    }
    cart.items = [];
    recalc(cart);
    return order;
  }

  async cancelOrder(id: number, _reason?: string): Promise<Order> {
    await delay(400);
    const order = mockState.orders.find((o) => o.id === id);
    if (!order) throw new Error('Order not found');
    order.status = 'CANCELLED';
    return order;
  }

  async reorder(id: number): Promise<Order> {
    await delay(400);
    const order = mockState.orders.find((o) => o.id === id);
    if (!order) throw new Error('Order not found');
    const cart = getOrCreateCart(1, order.order_type);
    cart.items = (order.items ?? []).map((i) => ({
      id: cart.items.length + 1,
      cart_id: cart.id,
      product_id: i.product_id,
      product_variant_id: null,
      unit_price: i.unit_price,
      quantity: i.quantity,
      line_total: i.line_total,
      selected_options: null,
      selected_addons: null,
      special_instructions: null,
      product: mockProducts.find((p) => p.id === i.product_id) ?? null,
    }));
    recalc(cart);
    return order;
  }

  async rateOrder(_id: number, _rating: number, _comment?: string) {
    await delay(300);
  }

  async getDeliveryOtp(_id: number): Promise<{ otp: string; expires_at: string }> {
    await delay(200);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    return { otp: '123456', expires_at: expiresAt.toISOString() };
  }

  async getOrderTracking(id: number): Promise<OrderTracking> {
    await delay(150);
    const order = mockState.orders.find((o) => o.id === id);
    if (!order) throw new Error('Order not found');

    const active = ['PARTNER_ASSIGNED', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'ARRIVED'].includes(order.status);
    const now = new Date().toISOString();

    return {
      order: {
        id: order.id,
        order_number: order.order_number,
        status: order.status,
        pickup: {
          latitude: 28.6139,
          longitude: 77.209,
          name: 'Mock Restaurant',
          address: 'MG Road, New Delhi',
        },
        dropoff: {
          latitude: 28.5245,
          longitude: 77.206,
          address: order.delivery_address_snapshot?.address_line_1 ?? 'Saket, New Delhi',
        },
      },
      partner: active
        ? { id: 3, name: 'Ravi Kumar', phone: '9000000003', vehicle_number: 'DL-01-AB-1234' }
        : null,
      location: active
        ? { lat: 28.57, lng: 77.21, heading: 90, speed: 12, accuracy: 8, recorded_at: now, is_stale: false }
        : null,
      route: { polyline: null, distance_km: 4.2, duration_min: 18, status: 'idle' },
      eta: active ? 18 : null,
      tracking: {
        enabled: active,
        in_progress: active,
        source: 'polling',
        last_updated_at: now,
        location_stale: !active,
      },
    };
  }

  async getPreparationInstructions(id: number): Promise<PreparationInstructionsPayload> {
    await delay();
    const order = mockState.orders.find((o) => o.id === id);
    if (!order) throw new Error('Order not found');
    if (order.order_type !== 'food') {
      throw new Error('Food preparation instructions are only available for food orders');
    }
    return mockPreparationInstructions(order);
  }

  async updatePreparationInstructions(
    id: number,
    input: UpdatePreparationInstructionsInput,
  ): Promise<PreparationInstructionsPayload> {
    await delay();
    const order = mockState.orders.find((o) => o.id === id);
    if (!order) throw new Error('Order not found');
    if (order.order_type !== 'food') {
      throw new Error('Food preparation instructions are only available for food orders');
    }
    if (!['PENDING', 'PLACED', 'ACCEPTED', 'CONFIRMED'].includes(order.status)) {
      throw new Error(
        'Preparation instructions can no longer be changed because the restaurant has started preparing your order.',
      );
    }
    return mockPreparationInstructions(order, input);
  }
}

function recalc(cart: { subtotal: string; tax: string; total: string; items_count: number; items: { line_total: string; quantity: number }[] }) {
  let subtotal = 0;
  for (const i of cart.items) subtotal += parseFloat(i.line_total);
  cart.subtotal = subtotal.toFixed(2);
  cart.tax = (subtotal * 0.05).toFixed(2);
  cart.total = (subtotal + parseFloat(cart.tax)).toFixed(2);
  cart.items_count = cart.items.reduce((n, i) => n + i.quantity, 0);
}
