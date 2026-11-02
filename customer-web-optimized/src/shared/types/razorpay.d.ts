interface RazorpayPaymentResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface RazorpayCheckoutOptions {
  key: string;
  amount: number;
  currency?: string;
  name?: string;
  description?: string;
  order_id?: string;
  notes?: Record<string, string>;
  theme?: { color?: string };
  modal?: { ondismiss?: () => void };
  handler?: (response: RazorpayPaymentResponse) => void;
  prefill?: { name?: string; email?: string; contact?: string };
}

interface RazorpayCheckout {
  open: () => void;
  close: () => void;
}

interface RazorpayStatic {
  new (options: RazorpayCheckoutOptions): RazorpayCheckout;
}

interface Window {
  Razorpay?: RazorpayStatic;
}