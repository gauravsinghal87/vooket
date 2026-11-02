import type { PaymentCheckoutPayload, PaymentVerifyResult } from '@/shared/types/models';
import { loadScript } from '@/shared/services/loadScript';
import { getBranding } from '@/shared/utils/branding';
import { repositories } from '@/shared/repositories';

const RAZORPAY_CHECKOUT_URL = 'https://checkout.razorpay.com/v1/checkout.js';

let scriptPromise: Promise<void> | null = null;

function loadRazorpayScript(): Promise<void> {
  if (scriptPromise) return scriptPromise;
  if (window.Razorpay) {
    scriptPromise = Promise.resolve();
    return scriptPromise;
  }
  scriptPromise = loadScript(RAZORPAY_CHECKOUT_URL);
  return scriptPromise;
}

export interface OrderPaymentResult {
  status: 'paid' | 'cancelled';
  verify?: PaymentVerifyResult;
}

/**
 * Create a checkout intent that Razorpay can actually run.
 *
 * A non-mock intent is only usable when the backend attached a provider
 * order id: the backend reuses an intent when the same idempotency key is
 * sent again, so a stale intent without a provider order id would otherwise
 * be reused forever. Opening Checkout without an order id makes Razorpay run
 * an order-less collection whose success response has no
 * razorpay_order_id/razorpay_signature, and verification then fails. When an
 * intent is unusable, request a fresh one under an attempt-scoped key.
 */
export async function createUsableCheckout(
  request: (idempotencyKey: string) => Promise<PaymentCheckoutPayload>,
  baseKey: string
): Promise<PaymentCheckoutPayload> {
  const checkout = await request(baseKey);

  if (checkout.mock || checkout.provider_order_id) return checkout;

  const fresh = await request(`${baseKey}:fresh`);

  if (!fresh.mock && !fresh.provider_order_id) {
    throw new Error('Could not start payment. Please try again.');
  }

  return fresh;
}

/**
 * Complete an order payment from an already-created checkout intent.
 * - mock payload: figure out the deterministic mock payment id and verify.
 * - real payload: load Razorpay Checkout, await the payment, then verify
 *   server-side. Returns `cancelled` if the user dismisses the modal.
 */
export async function completeOrderPayment(checkout: PaymentCheckoutPayload): Promise<OrderPaymentResult> {
  const paymentNumber = checkout.payment_number;
  const providerOrderId = checkout.provider_order_id ?? '';

  if (!checkout.mock && !checkout.provider_order_id) {
    throw new Error('Payment intent is incomplete. Please try again.');
  }

  if (checkout.mock) {
    const verify = await repositories.payments.verify({
      payment_number: paymentNumber,
      provider_order_id: providerOrderId,
      provider_payment_id: await mockPaymentIdForOrder(providerOrderId),
      signature: 'mock',
    });

    return { status: 'paid', verify };
  }

  await loadRazorpayScript();

  const Razorpay = window.Razorpay;
  if (!Razorpay) throw new Error('Razorpay checkout is unavailable.');

  return new Promise<OrderPaymentResult>((resolve, reject) => {
    const checkoutModal = new Razorpay({
      key: checkout.key_id ?? '',
      amount: checkout.amount_paise,
      currency: checkout.currency,
      name: getBranding().name,
      description: `Payment ${paymentNumber}`,
      order_id: providerOrderId,
      theme: { color: '#1b66f5' },
      modal: {
        ondismiss: () => resolve({ status: 'cancelled' }),
      },
      handler: async (response) => {
        try {
          const verify = await repositories.payments.verify({
            payment_number: paymentNumber,
            provider_payment_id: response.razorpay_payment_id,
            provider_order_id: response.razorpay_order_id,
            signature: response.razorpay_signature,
          });
          resolve({ status: 'paid', verify });
        } catch (err) {
          reject(err);
        }
      },
    });
    checkoutModal.open();
  });
}

/** Deterministic mock payment id: mirrors MockPaymentProvider::paymentIdForOrder. */
async function mockPaymentIdForOrder(orderId: string): Promise<string> {
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(orderId));
  const hex = Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return `pay_${hex.slice(0, 16)}`;
}