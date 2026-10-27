import * as Crypto from 'expo-crypto';
import { NativeModules, TurboModuleRegistry } from 'react-native';
import { repositories } from '@/api/repositories';
import { getBranding } from '@/lib/branding';
import type { PaymentCheckoutPayload, PaymentVerifyResult } from '@/types/models';

export interface OrderPaymentResult {
  status: 'paid' | 'cancelled';
  verify?: PaymentVerifyResult;
}

/**
 * Native counterpart to the web app's Razorpay Checkout flow.
 *
 * The backend decides whether a checkout intent is mock (test provider) or
 * real (Razorpay). Mock intents are auto-verified here with the same
 * deterministic payment id the web app uses, so demo orders complete. Real
 * intents open the native Razorpay Checkout (`react-native-razorpay`) with the
 * server-created order id and public key id, then verify the response
 * server-side. We never mark a payment paid without that verification. The SDK
 * is a native module, so it only exists in a development/production build; when
 * it is unavailable we raise a clear error instead of a fake cancellation.
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

  return completeRealPayment(checkout);
}

/** Deterministic mock payment id: mirrors MockPaymentProvider::paymentIdForOrder. */
async function mockPaymentIdForOrder(orderId: string): Promise<string> {
  const hex = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, orderId, {
    encoding: Crypto.CryptoEncoding.HEX,
  });
  return `pay_${hex.slice(0, 16)}`;
}

interface RazorpayCheckoutModule {
  open: (options: Record<string, unknown>) => Promise<Record<string, unknown>>;
}

/**
 * Load the native Razorpay Checkout lazily.
 *
 * `react-native-razorpay` is a native module: importing it touches
 * `NativeModules`/`TurboModuleRegistry` at module scope, which throws in Expo Go
 * (and before `pod install`). Requiring it inside a guard keeps this file
 * importable everywhere and lets us detect the missing native build without
 * crashing the app on launch.
 */
function loadRazorpayCheckout(): RazorpayCheckoutModule | undefined {
  if (!isRazorpayNativeLinked()) return undefined;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- native module is optional/lazy
    const mod = require('react-native-razorpay') as { default?: RazorpayCheckoutModule } & Partial<RazorpayCheckoutModule>;
    const candidate = mod?.default ?? mod;
    return candidate && typeof candidate.open === 'function' ? (candidate as RazorpayCheckoutModule) : undefined;
  } catch {
    return undefined;
  }
}

/** True only in a native build that linked the Razorpay module (false in Expo Go). */
function isRazorpayNativeLinked(): boolean {
  try {
    if (TurboModuleRegistry.get?.('RNRazorpayCheckout')) return true;
  } catch {
    // get() throws for unknown modules on some versions — fall through.
  }
  return Boolean((NativeModules as Record<string, unknown>).RNRazorpayCheckout);
}

/**
 * Real (provider-backed) payment. Opens Razorpay Checkout with the
 * server-created order id, then verifies the signed response on the server.
 *
 * - The native SDK is missing (Expo Go / no dev build): throw, so the caller
 *   shows an actionable message instead of a bogus cancellation.
 * - The customer dismisses Checkout: resolve `cancelled`.
 * - Anything else (declined, network, bad options): throw so the order stays
 *   unpaid and the customer can retry.
 */
async function completeRealPayment(checkout: PaymentCheckoutPayload): Promise<OrderPaymentResult> {
  const paymentNumber = checkout.payment_number;
  const providerOrderId = checkout.provider_order_id ?? '';

  if (!checkout.key_id) {
    throw new Error('Payment is not configured. Please try again later.');
  }

  const RazorpayCheckout = loadRazorpayCheckout();
  if (!RazorpayCheckout) {
    throw new Error('Online payments need the app’s development build. Install the dev build to pay online.');
  }

  let response: Record<string, unknown>;
  try {
    response = await RazorpayCheckout.open({
      key: checkout.key_id,
      amount: checkout.amount_paise,
      currency: checkout.currency,
      name: getBranding().name,
      description: `Payment ${paymentNumber}`,
      order_id: providerOrderId,
      theme: { color: '#1b66f5' },
    });
  } catch (err) {
    if (isUserCancellation(err)) return { status: 'cancelled' };
    throw new Error(paymentErrorMessage(err));
  }

  const providerPaymentId = nonEmptyString(response.razorpay_payment_id);
  const signature = nonEmptyString(response.razorpay_signature);
  const responseOrderId = nonEmptyString(response.razorpay_order_id) ?? providerOrderId;

  if (!providerPaymentId || !signature) {
    throw new Error('The payment did not return a verifiable response. Please try again.');
  }

  const verify = await repositories.payments.verify({
    payment_number: paymentNumber,
    provider_payment_id: providerPaymentId,
    provider_order_id: responseOrderId,
    signature,
  });

  return { status: 'paid', verify };
}

/** Razorpay reports a customer dismissal via `reason`/`description`, not a stable code. */
function isUserCancellation(err: unknown): boolean {
  return stringify(err).toLowerCase().includes('cancel');
}

function paymentErrorMessage(err: unknown): string {
  const e = err as { description?: unknown; error?: { description?: unknown } } | null;
  const description = firstString(e?.description) ?? firstString(e?.error?.description);
  return description ?? 'Payment could not be completed. Please try again.';
}

function stringify(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '';
    }
  }
  return '';
}

/** Pulls a non-empty description string out of a string OR a `{ description }` object. */
function firstString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return extractDescription(value);
  }
  if (value && typeof value === 'object') {
    const nested = (value as { description?: unknown }).description;
    if (typeof nested === 'string') return extractDescription(nested);
  }
  return undefined;
}

/** Razorpay sometimes serialises the error body into `description` as JSON. */
function extractDescription(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as { error?: { description?: unknown } };
      const nested = parsed?.error?.description;
      if (typeof nested === 'string' && nested.trim()) return nested.trim();
    } catch {
      // Not JSON — fall through and use the raw string.
    }
  }
  return trimmed;
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}