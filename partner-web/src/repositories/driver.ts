import { api, uploadForm, queryString } from '@/lib/api';
import type { Paginated } from '@/typings/api';
import type {
  Availability,
  Driver,
  EarningsSummary,
  MapsClientConfig,
  Payout,
  PaymentCheckoutPayload,
  Ride,
  RideCashResponse,
  RideRequest,
  RideSettleResponse,
  VehicleType,
  WalletSummary,
  Zone,
  WalletTopupVerifyResult,
  WalletTransactionEntry,
  WalletDirection,
} from '@/typings/models';

export const driverApi = {
  profile: () => api<Driver>('/driver/profile'),
  update: (body: Record<string, unknown>) => api<Driver>('/driver/profile', { method: 'PUT', body }),
  updateBank: (body: Record<string, unknown>) => api<Driver>('/driver/bank-details', { method: 'POST', body }),
  uploadDocuments: (documents: { type: string; file: File }[]) => {
    const form = new FormData();
    documents.forEach((doc, i) => {
      form.append(`documents[${i}][type]`, doc.type);
      form.append(`documents[${i}][file]`, doc.file);
    });
    return uploadForm<unknown>('/driver/documents', form);
  },
  toggleAvailability: () => api<Availability>('/driver/availability', { method: 'POST' }),
  updateLocation: (latitude: number, longitude: number) =>
    api<null>('/driver/location', { method: 'POST', body: { latitude, longitude } }),
  incomingRequests: () => api<RideRequest[]>('/driver/incoming-requests'),
  acceptRequest: (id: number) => api<Ride>(`/driver/requests/${id}/accept`, { method: 'POST' }),
  rejectRequest: (id: number) => api<null>(`/driver/requests/${id}/reject`, { method: 'POST' }),
  activeTrip: () => api<Ride | null>('/driver/trips/active'),
  updateTripStatus: (rideId: number, status: string) =>
    api<Ride>(`/driver/trips/${rideId}/status`, { method: 'POST', body: { status } }),
  verifyOtp: (rideId: number, otp: string) =>
    api<Ride>(`/driver/rides/${rideId}/verify-customer-otp`, { method: 'POST', body: { otp } }),
  cashCollect: (rideId: number, method: 'cash') =>
    api<RideCashResponse>(`/driver/rides/${rideId}/cash-collect`, { method: 'POST', body: { method } }),
  settleCash: (rideId: number) =>
    api<RideSettleResponse>(`/driver/rides/${rideId}/cash-settle`, { method: 'POST' }),
  earnings: () => api<EarningsSummary>('/driver/earnings'),
  withdrawals: (params: { page?: number; per_page?: number }) =>
    api<Paginated<Payout>>(`/driver/withdrawals${queryString(params)}`),
  requestWithdrawal: (amount: number) =>
    api<Payout>('/driver/withdrawals', { method: 'POST', body: { amount } }),
  wallet: () => api<WalletSummary>('/driver/wallet'),
  walletTopup: (amount: number, paymentMethod: string, idempotencyKey: string) =>
    api<PaymentCheckoutPayload>('/driver/wallet/topup', {
      method: 'POST',
      body: { amount, payment_method: paymentMethod, idempotency_key: idempotencyKey },
    }),
  verifyWalletTopup: (body: {
    payment_number: string;
    provider_order_id: string;
    provider_payment_id: string;
    signature: string;
  }) => api<WalletTopupVerifyResult>('/driver/wallet/verify-topup', { method: 'POST', body }),
  walletTransactions: (params?: {
    service?: 'food' | 'grocery' | 'ride';
    direction?: WalletDirection;
    page?: number;
    per_page?: number;
  }) => api<Paginated<WalletTransactionEntry>>(`/driver/wallet/transactions${queryString(params)}`),
};

export const vehicleApi = {
  list: () => api<VehicleType[]>('/vehicle-types'),
};

export const zonesApi = {
  list: () => api<Zone[]>('/zones'),
};

export const configApi = {
  maps: () => api<MapsClientConfig>('/config/maps'),
};