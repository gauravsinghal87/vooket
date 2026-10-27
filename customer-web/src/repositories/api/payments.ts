import type { PaymentRepository } from '../interfaces';
import { apiClient } from '@/lib/apiClient';
import type { PaymentCheckoutPayload, PaymentVerifyResult } from '@/types/models';

export class ApiPaymentRepository implements PaymentRepository {
  async initiate(data: {
    payable_type: 'order' | 'ride';
    payable_id: number;
    payment_method: 'upi' | 'card' | 'net_banking' | 'wallet';
    idempotency_key?: string;
  }): Promise<PaymentCheckoutPayload> {
    return apiClient.post<PaymentCheckoutPayload>(`/payments/initiate`, data);
  }

  async verify(data: {
    payment_number: string;
    provider_payment_id: string;
    provider_order_id: string;
    signature: string;
  }): Promise<PaymentVerifyResult> {
    return apiClient.post<PaymentVerifyResult>(`/payments/verify`, data);
  }
}