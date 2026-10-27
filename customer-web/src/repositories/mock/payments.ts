import type { PaymentRepository } from '../interfaces';
import type { PaymentCheckoutPayload, PaymentVerifyResult } from '@/types/models';

const delay = (ms = 400) => new Promise((r) => setTimeout(r, ms));

let mockCounter = 0;

export class MockPaymentRepository implements PaymentRepository {
  async initiate(data: {
    payable_type: 'order' | 'ride';
    payable_id: number;
    payment_method: 'upi' | 'card' | 'net_banking' | 'wallet';
    idempotency_key?: string;
  }): Promise<PaymentCheckoutPayload> {
    await delay(400);
    mockCounter += 1;
    return {
      payment_number: `PAY_${Date.now()}_MOCK${mockCounter}`,
      provider_order_id: `order_mock_${data.payable_id}_${mockCounter}`,
      amount_paise: 0,
      amount: 0,
      currency: 'INR',
      method: data.payment_method,
      key_id: 'mock',
      mock: true,
    };
  }

  async verify(): Promise<PaymentVerifyResult> {
    await delay(300);
    return {
      status: 'SUCCESS',
      already_processed: false,
      payment_number: `PAY_${Date.now()}_MOCK`,
      paid_at: new Date().toISOString(),
    };
  }
}