import { api, apiClient, apiPayload, upload } from '@/lib/api';
import type {
  Category,
  DeliverySlot,
  DeliverySlotInput,
  DeliverySlotBulkInput,
  DeliverySlotBulkResult,
  EarningsOverview,
  Outlet,
  Payout,
  PlatformCategoryView,
  Settlement,
  VendorCategory,
  VendorCategoryDetail,
  VendorCategoryOption,
  VendorCoupon,
  VendorDashboard,
  VendorDeliveryPartnerCandidate,
  VendorOrder,
  VendorOrderAssignResult,
  VendorProduct,
  VendorProfile,
  VendorUser,
  MapsClientConfig,
  ReverseGeocode,
  SearchPlacesResponse,
  ServiceabilityResult,
} from '@/typings/models';
import type { Paginated } from '@/typings/api';

type FilterParams = {
  page?: number;
  per_page?: number;
  search?: string | null;
  status?: string | null;
  category_id?: number | null;
  from?: string | null;
  to?: string | null;
};

type PaginationMeta = { current_page: number; last_page: number; per_page: number; total: number };

type LaravelPaginator<T> = PaginationMeta & { data: T[] };

function isPaginator<T>(value: unknown): value is LaravelPaginator<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as { data?: unknown }).data) &&
    typeof (value as { total?: unknown }).total === 'number'
  );
}

async function listEndpoint<T>(path: string, params: FilterParams = {}): Promise<Paginated<T>> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.per_page) query.set('per_page', String(params.per_page));
  if (params.search) query.set('search', params.search);
  if (params.status) query.set('status', params.status);
  if (params.category_id) query.set('category_id', String(params.category_id));
  if (params.from) query.set('from', params.from);
  if (params.to) query.set('to', params.to);
  const qs = query.toString();
  const payload = await apiPayload<T[]>(`${path}${qs ? `?${qs}` : ''}`);
  const raw = payload.data;
  const paginator = isPaginator<T>(raw) ? raw : null;
  const items: T[] = paginator ? paginator.data : (raw as T[]);
  const meta = (payload.meta?.pagination ?? {}) as Partial<PaginationMeta>;
  return {
    data: items,
    current_page: meta.current_page ?? paginator?.current_page ?? 1,
    last_page: meta.last_page ?? paginator?.last_page ?? 1,
    per_page: meta.per_page ?? paginator?.per_page ?? items.length,
    total: meta.total ?? paginator?.total ?? items.length,
    meta: payload.meta && typeof payload.meta === 'object' && !Array.isArray(payload.meta) ? payload.meta : undefined,
  };
}

export interface VendorRegistrationPayload {
  vendor_type: 'restaurant' | 'grocery';
  business_name: string;
  owner_name: string;
  email: string;
  phone: string;
  password: string;
  country_code?: string;
  address?: string;
  gst_number?: string;
  pan_number?: string;
  fssai_number?: string;
  bank_account_name?: string;
  bank_account_number?: string;
  bank_ifsc?: string;
  bank_name?: string;
  latitude?: number;
  longitude?: number;
  /** Food restaurants only — minutes before an order is ready for pickup. */
  avg_prep_time_min?: number;
  /** Restaurant-only local operating window, 24h "HH:MM" (overnight supported). */
  opens_at?: string;
  closes_at?: string;
}

export const vendorAuthApi = {
  login: (email: string, password: string) =>
    apiClient.post<{ token: string; user: VendorUser }>('/auth/login/email', { email, password }),
  me: () => api<VendorUser>('/vendor/me'),
  logout: () => apiClient.post('/auth/logout'),
  register: (body: VendorRegistrationPayload) => apiPayload<{ user: VendorUser; profile: VendorProfile }>('/auth/vendor/register', { method: 'POST', body }),
  reapply: (body: Partial<VendorRegistrationPayload>) => apiPayload<VendorProfile>('/auth/vendor/reapply', { method: 'POST', body }),

  /**
   * Redeem an admin impersonation handoff code for a short-lived vendor token.
   *
   * Unauthenticated on purpose: the single-use code is the credential. The
   * returned token is stored separately from a real login token so the two can
   * never be confused.
   */
  exchangeImpersonation: (code: string) =>
    apiClient.post<{ token: string; user: VendorUser; impersonation: ImpersonationContext }>(
      '/auth/vendor/impersonate/exchange',
      { code },
    ),
};

/**
 * Who is driving the current vendor session. Always supplied by the backend,
 * never asserted by the browser.
 */
export interface ImpersonationContext {
  session_id: number;
  impersonated_by_admin_id: number;
  impersonated_admin_name: string | null;
  impersonated_admin_email: string | null;
  impersonated_vendor_id: number;
  impersonated_vendor_user_id: number;
  vendor_business_name: string | null;
  vendor_type: string | null;
  vendor_status: string | null;
  started_at: string | null;
  expires_at: string | null;
  reason: string | null;
  return_url: string;
}

export const impersonationApi = {
  context: () => api<ImpersonationContext | null>('/vendor/impersonation'),
  end: () => apiClient.post('/vendor/impersonation/end'),
};

export const profileApi = {
  me: () => api<VendorUser>('/vendor/me'),
  update: (body: Record<string, unknown>) => apiClient.put<VendorProfile>('/vendor/profile', body),
  uploadImage: (file: File, type: 'logo' | 'cover_image') => {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('type', type);
    return upload<{ logo?: string; cover_image?: string }>('/vendor/profile/upload-image', formData);
  },
};

export const dashboardApi = {
  get: (days = 7): Promise<VendorDashboard> => api<VendorDashboard>(`/vendor/dashboard?days=${days}`),
};

export const mapApi = {
  config: (): Promise<MapsClientConfig> => api<MapsClientConfig>('/config/maps'),
  searchPlaces: (query: string, country?: string): Promise<SearchPlacesResponse> => {
    const params = new URLSearchParams({ q: query });
    if (country) params.set('country', country);
    return api<SearchPlacesResponse>(`/geocode/search?${params.toString()}`);
  },
  reverseGeocode: (latitude: number, longitude: number): Promise<ReverseGeocode> => {
    const params = new URLSearchParams({ lat: String(latitude), lng: String(longitude) });
    return api<ReverseGeocode>(`/geocode/reverse?${params.toString()}`);
  },
  serviceability: (latitude: number, longitude: number, service: string): Promise<ServiceabilityResult> => {
    const params = new URLSearchParams({ latitude: String(latitude), longitude: String(longitude), service });
    return api<ServiceabilityResult>(`/serviceability?${params.toString()}`);
  },
};

export const outletsApi = {
  list: (): Promise<Outlet[]> => api<Outlet[]>('/vendor/outlets'),
};

export const deliverySlotsApi = {
  list: (params: { from?: string; to?: string } = {}): Promise<DeliverySlot[]> => {
    const qs = new URLSearchParams();
    if (params.from) qs.set('from', params.from);
    if (params.to) qs.set('to', params.to);
    return api<DeliverySlot[]>(`/vendor/delivery-slots${qs.toString() ? `?${qs.toString()}` : ''}`);
  },
  shifts: () => api<Record<string, { start: string; end: string }>>('/vendor/delivery-slots/shifts'),
  create: (body: DeliverySlotInput) => apiClient.post<DeliverySlot>('/vendor/delivery-slots', body),
  bulkCreate: (body: DeliverySlotBulkInput) => apiClient.post<DeliverySlotBulkResult>('/vendor/delivery-slots/bulk', body),
  update: (id: number, body: DeliverySlotInput) => apiClient.put<DeliverySlot>(`/vendor/delivery-slots/${id}`, body),
  remove: (id: number) => apiClient.delete(`/vendor/delivery-slots/${id}`),
};

export const productsApi = {
  list: (params: FilterParams = {}) => listEndpoint<VendorProduct>('/vendor/products', params),
  get: (id: number) => api<VendorProduct>(`/vendor/products/${id}`),
  create: (body: Record<string, unknown>) => apiClient.post<VendorProduct>('/vendor/products', body),
  update: (id: number, body: Record<string, unknown>) => apiClient.put<VendorProduct>(`/vendor/products/${id}`, body),
  remove: (id: number) => apiClient.delete(`/vendor/products/${id}`),
  toggle: (id: number) => apiClient.post<VendorProduct>(`/vendor/products/${id}/toggle-availability`),
  inventory: (id: number, body: { quantity: number; low_stock_threshold?: number; track_inventory?: boolean }) =>
    apiClient.put(`/vendor/products/${id}/inventory`, body),
  uploadImage: (file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    return upload<{ image: string }>('/vendor/products/upload-image', formData);
  },
  removeImage: (id: number) => apiClient.delete<VendorProduct>(`/vendor/products/${id}/image`),
  categories: (): Promise<Category[]> => api<Category[]>('/vendor/products/categories'),
};

export const ordersApi = {
  list: (params: FilterParams = {}) => listEndpoint<VendorOrder>('/vendor/orders', params),
  get: (id: number) => api<VendorOrder>(`/vendor/orders/${id}`),
  setStatus: (id: number, status: string, note?: string) =>
    apiClient.put<VendorOrder>(`/vendor/orders/${id}/status`, { status, note }),
  eligibleDeliveryPartners: (id: number) =>
    api<VendorDeliveryPartnerCandidate[]>(`/vendor/orders/${id}/eligible-delivery-partners`),
  assignDeliveryPartner: (id: number, deliveryPartnerId: number, note?: string) =>
    apiClient.post<VendorOrderAssignResult>(`/vendor/orders/${id}/assign-delivery-partner`, {
      delivery_partner_id: deliveryPartnerId,
      note,
    }),
};

export const couponsApi = {
  list: (params: FilterParams = {}) => listEndpoint<VendorCoupon>('/vendor/coupons', params),
  create: (body: Record<string, unknown>) => apiClient.post<VendorCoupon>('/vendor/coupons', body),
  update: (id: number, body: Record<string, unknown>) => apiClient.put<VendorCoupon>(`/vendor/coupons/${id}`, body),
  remove: (id: number) => apiClient.delete(`/vendor/coupons/${id}`),
};

type VendorCategoryListParams = FilterParams & { trashed?: boolean; all?: boolean };

export const categoriesApi = {
  list: async (params: VendorCategoryListParams = {}): Promise<Paginated<VendorCategory>> => {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.per_page) query.set('per_page', String(params.per_page));
    if (params.search) query.set('search', params.search);
    if (params.status) query.set('status', params.status);
    if (params.trashed) query.set('trashed', '1');
    if (params.all) query.set('all', '1');
    const qs = query.toString();
    const payload = await apiPayload<VendorCategory[]>(`/vendor/categories${qs ? `?${qs}` : ''}`);
    const raw = payload.data;
    const paginator = isPaginator<VendorCategory>(raw) ? raw : null;
    const items: VendorCategory[] = paginator ? paginator.data : (raw as VendorCategory[]);
    const meta = (payload.meta?.pagination ?? {}) as Partial<PaginationMeta>;
    return {
      data: items,
      current_page: meta.current_page ?? paginator?.current_page ?? 1,
      last_page: meta.last_page ?? paginator?.last_page ?? 1,
      per_page: meta.per_page ?? paginator?.per_page ?? items.length,
      total: meta.total ?? paginator?.total ?? items.length,
    };
  },
  options: (): Promise<VendorCategoryOption[]> => api<VendorCategoryOption[]>('/vendor/categories/options'),
  get: (id: number) => api<VendorCategoryDetail>(`/vendor/categories/${id}`),
  create: (body: Record<string, unknown>) => apiClient.post<VendorCategory>('/vendor/categories', body),
  update: (id: number, body: Record<string, unknown>) => apiClient.put<VendorCategory>(`/vendor/categories/${id}`, body),
  remove: (id: number, force = false) => apiClient.delete<{ id: number; deleted_at: string }>(`/vendor/categories/${id}${force ? '?force=1' : ''}`),
  restore: (id: number) => apiClient.post<VendorCategory>(`/vendor/categories/${id}/restore`),
  toggle: (id: number) => apiClient.post<{ id: number; is_active: boolean }>(`/vendor/categories/${id}/toggle`),
  uploadImage: (file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    return upload<{ image: string }>('/vendor/categories/upload-image', formData);
  },
  removeImage: (id: number) => apiClient.delete<{ id: number; image: null }>(`/vendor/categories/${id}/image`),
  reorder: (items: { id: number; sort_order: number }[]) => apiClient.post<number[]>('/vendor/categories/reorder', { items }),
  platform: () => api<PlatformCategoryView>('/vendor/categories/platform'),
  syncPlatform: (categoryIds: number[]) => apiClient.post<{ selected_category_ids: number[] }>('/vendor/categories/platform', { category_ids: categoryIds }),
};

export const earningsApi = {
  overview: () => api<EarningsOverview>('/vendor/earnings'),
  settlements: (params: FilterParams = {}) => listEndpoint<Settlement>('/vendor/settlements', params),
  payouts: (params: FilterParams = {}) => listEndpoint<Payout>('/vendor/payouts', params),
  requestPayout: (amount: number) => apiClient.post<Payout>('/vendor/payouts', { amount }),
};