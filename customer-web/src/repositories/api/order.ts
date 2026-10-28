import type { OrderHistoryPage, OrderRepository } from '../interfaces';
import { apiClient } from '@/lib/apiClient';
import type {
  Order,
  OrderTracking,
  PreparationInstructionsPayload,
  ServiceType,
  UpdatePreparationInstructionsInput,
} from '@/types/models';
import type { Paginated } from '@/types/api';

export class ApiOrderRepository implements OrderRepository {
  async getHistory(module: ServiceType, page?: number): Promise<OrderHistoryPage> {
    const qs = new URLSearchParams({ module });
    if (page) qs.set('page', String(page));
    return apiClient.get<OrderHistoryPage>(`/orders?${qs.toString()}`);
  }

  async getOrders(params?: { status?: string; order_type?: string; page?: number }): Promise<Paginated<Order>> {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.order_type) qs.set('order_type', params.order_type);
    if (params?.page) qs.set('page', String(params.page));
    const query = qs.toString();
    return apiClient.get<Paginated<Order>>(`/orders${query ? `?${query}` : ''}`);
  }

  async getOrder(id: number): Promise<Order> {
    return apiClient.get<Order>(`/orders/${id}`);
  }

  async createOrder(data: {
    order_type: 'food' | 'grocery';
    address_id?: number;
    payment_method?: string;
    order_idempotency_key?: string;
    idempotency_key?: string;
    customer_note?: string;
    tip_amount?: number;
    delivery_slot_id?: number;
    /** Food only: restaurant-level note, max 500 characters. */
    restaurant_note?: string;
    /** Food only: false means "Don't send cutlery". */
    send_cutlery?: boolean;
  }): Promise<Order> {
    return apiClient.post<Order>(`/orders`, {
      ...data,
      idempotency_key: data.idempotency_key ?? data.order_idempotency_key,
    });
  }

  async cancelOrder(id: number, reason?: string): Promise<Order> {
    return apiClient.post<Order>(`/orders/${id}/cancel`, { reason });
  }

  async reorder(id: number): Promise<Order> {
    return apiClient.post<Order>(`/orders/${id}/reorder`);
  }

  async rateOrder(id: number, rating: number, comment?: string): Promise<void> {
    await apiClient.post(`/orders/${id}/rate`, { rating, comment });
  }

  async getOrderTracking(id: number): Promise<OrderTracking> {
    return apiClient.get<OrderTracking>(`/orders/${id}/tracking`);
  }

  async getDeliveryOtp(id: number): Promise<{ otp: string; expires_at: string }> {
    return apiClient.get<{ otp: string; expires_at: string }>(`/orders/${id}/delivery-otp`);
  }

  async getPreparationInstructions(id: number): Promise<PreparationInstructionsPayload> {
    return apiClient.get<PreparationInstructionsPayload>(`/orders/${id}/preparation-instructions`);
  }

  async updatePreparationInstructions(
    id: number,
    input: UpdatePreparationInstructionsInput,
  ): Promise<PreparationInstructionsPayload> {
    return apiClient.patch<PreparationInstructionsPayload>(`/orders/${id}/preparation-instructions`, input);
  }
}
