import { api, uploadForm, queryString } from '@/lib/api';
import type { Paginated } from '@/typings/api';
import type {
  ActiveBatchJob,
  Availability,
  CashConfirmResponse,
  DeliveryOrder,
  DeliveryPartner,
  DeliveryPartnerEarnings,
  DispatchLog,
  EarningPeriod,
  PaymentCheckoutPayload,
  Payout,
  WalletSummary,
  WalletTopupVerifyResult,
  WalletTransactionEntry,
  WalletService,
  WalletDirection,
} from '@/typings/models';

export const partnerApi = {
  profile: () => api<DeliveryPartner>('/delivery-partner/profile'),
  update: (body: Record<string, unknown>) => api<DeliveryPartner>('/delivery-partner/profile', { method: 'PUT', body }),
  updateBank: (body: Record<string, unknown>) => api<DeliveryPartner>('/delivery-partner/bank-details', { method: 'POST', body }),
  uploadDocuments: (documents: { type: string; file: File }[]) => {
    const form = new FormData();
    documents.forEach((doc, i) => {
      form.append(`documents[${i}][type]`, doc.type);
      form.append(`documents[${i}][file]`, doc.file);
    });
    return uploadForm<unknown>('/delivery-partner/documents', form);
  },
  toggleAvailability: () => api<Availability>('/delivery-partner/availability', { method: 'POST' }),
  updateLocation: (latitude: number, longitude: number) =>
    api<null>('/delivery-partner/location', { method: 'POST', body: { latitude, longitude } }),
  incomingOrders: () => api<DispatchLog[]>('/delivery-partner/incoming-orders'),
  activeJob: () => api<DeliveryOrder | ActiveBatchJob | null>('/delivery-partner/active-job'),
  acceptOrder: (dispatchLogId: number) => api<DispatchLog>(`/delivery-partner/orders/${dispatchLogId}/accept`, { method: 'POST' }),
  rejectOrder: (dispatchLogId: number) => api<null>(`/delivery-partner/orders/${dispatchLogId}/reject`, { method: 'POST' }),
  updateOrderStatus: (orderId: number, status: string) =>
    api<DeliveryOrder>(`/delivery-partner/orders/${orderId}/status`, { method: 'POST', body: { status } }),
  confirmPayment: (orderId: number, method: 'cash') =>
    api<CashConfirmResponse>(`/delivery-partner/orders/${orderId}/confirm-payment`, { method: 'POST', body: { method } }),
  settleCash: (orderId: number) =>
    api<CashConfirmResponse & { settled: boolean }>(`/delivery-partner/orders/${orderId}/settle-cash`, { method: 'POST' }),
  requestDeliveryOtp: (orderId: number) =>
    api<{ active: boolean; expires_at: string; resend_count: number; max_resend_attempts: number; limit_reached?: boolean }>(
      `/delivery-partner/orders/${orderId}/delivery-otp`,
      { method: 'POST' },
    ),
  verifyDeliveryOtp: (orderId: number, otp: string) =>
    api<DeliveryOrder>(`/delivery-partner/orders/${orderId}/verify-delivery-otp`, { method: 'POST', body: { otp } }),
  uploadProof: (orderId: number, proofImage: File, notes?: string) => {
    const form = new FormData();
    form.append('proof_image', proofImage);
    if (notes) form.append('notes', notes);
    return uploadForm<{ proof_path: string }>(`/delivery-partner/orders/${orderId}/proof`, form);
  },
  earnings: (params?: { period?: EarningPeriod; page?: number; per_page?: number }) =>
    api<DeliveryPartnerEarnings>(`/delivery-partner/earnings${queryString(params)}`),
  withdrawals: (params: { page?: number; per_page?: number }) =>
    api<Paginated<Payout>>(`/delivery-partner/withdrawals${queryString(params)}`),
  requestWithdrawal: (amount: number) =>
    api<Payout>('/delivery-partner/withdrawals', { method: 'POST', body: { amount } }),
  wallet: () => api<WalletSummary>('/delivery-partner/wallet'),
  walletTopup: (amount: number, paymentMethod: string, idempotencyKey: string) =>
    api<PaymentCheckoutPayload>('/delivery-partner/wallet/topup', {
      method: 'POST',
      body: { amount, payment_method: paymentMethod, idempotency_key: idempotencyKey },
    }),
  verifyWalletTopup: (body: {
    payment_number: string;
    provider_order_id: string;
    provider_payment_id: string;
    signature: string;
  }) => api<WalletTopupVerifyResult>('/delivery-partner/wallet/verify-topup', { method: 'POST', body }),
  walletTransactions: (params?: {
    service?: WalletService;
    direction?: WalletDirection;
    page?: number;
    per_page?: number;
  }) => api<Paginated<WalletTransactionEntry>>(`/delivery-partner/wallet/transactions${queryString(params)}`),
};