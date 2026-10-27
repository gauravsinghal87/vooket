import type { PaymentCheckoutPayload, WalletTopupVerifyResult } from '@/typings/models';
import { partnerApi } from '@/repositories/partner';

const RAZORPAY_CHECKOUT_URL = 'https://checkout.razorpay.com/v1/checkout.js';

let scriptPromise: Promise<void> | null = null;

export type WalletTopupVerify = (body: {
  payment_number: string;
  provider_order_id: string;
  provider_payment_id: string;
  signature: string;
}) => Promise<WalletTopupVerifyResult>;

export function loadScript(src: string): Promise<void> {
  if (document.querySelector(`script[src="${src}"]`)) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

function loadRazorpayScript(): Promise<void> {
  if (scriptPromise) return scriptPromise;
  if (window.Razorpay) {
    scriptPromise = Promise.resolve();
    return scriptPromise;
  }
  scriptPromise = loadScript(RAZORPAY_CHECKOUT_URL);
  return scriptPromise;
}

/** Deterministic mock payment id: mirrors MockPaymentProvider::paymentIdForOrder. */
async function mockPaymentIdForOrder(orderId: string): Promise<string> {
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(orderId));
  const hex = Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return `pay_${hex.slice(0, 16)}`;
}

/**
 * Complete a wallet top-up from an already-created checkout intent and verify
 * it server-side. Returns `null` if the user dismisses the checkout modal.
 * `verify` defaults to the delivery-partner endpoint; pass the driver verify
 * function when topping up from the driver role.
 */
export async function completeWalletTopup(
  checkout: PaymentCheckoutPayload,
  verify: WalletTopupVerify = partnerApi.verifyWalletTopup,
): Promise<WalletTopupVerifyResult | null> {
  const paymentNumber = checkout.payment_number;
  const providerOrderId = checkout.provider_order_id ?? '';

  if (checkout.mock) {
    return verify({
      payment_number: paymentNumber,
      provider_order_id: providerOrderId,
      provider_payment_id: await mockPaymentIdForOrder(providerOrderId),
      signature: 'mock',
    });
  }

  await loadRazorpayScript();

  const Razorpay = window.Razorpay;
  if (!Razorpay) throw new Error('Razorpay checkout is unavailable.');

  return new Promise<WalletTopupVerifyResult | null>((resolve, reject) => {
    const checkoutModal = new Razorpay({
      key: checkout.key_id ?? '',
      amount: checkout.amount_paise,
      currency: checkout.currency,
      name: 'SuperBasket Partner',
      description: `Wallet top-up ${paymentNumber}`,
      order_id: providerOrderId,
      theme: { color: '#1b66f5' },
      modal: {
        ondismiss: () => resolve(null),
      },
      handler: async (response) => {
        try {
          const verified = await verify({
            payment_number: paymentNumber,
            provider_payment_id: response.razorpay_payment_id,
            provider_order_id: response.razorpay_order_id,
            signature: response.razorpay_signature,
          });
          resolve(verified);
        } catch (err) {
          reject(err);
        }
      },
    });
    checkoutModal.open();
  });
}