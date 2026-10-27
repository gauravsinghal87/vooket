import { api, apiClient, apiPayload, upload } from '@/lib/api';
import type {
  AdminBanner,
  AdminCategory,
  AdminCategoryDetail,
  AdminCoupon,
  AdminDashboard,
  AdminDeliveryPartner,
  AdminDeliveryPartnerCandidate,
  AdminDeliveryPartnerDetail,
  AdminDispatchLog,
  AdminDriver,
  AdminDriverDetail,
  AdminFareRule,
  AdminFareRulePreview,
  AdminFeatureFlag,
  AdminIntegration,
  AdminIntegrationDetail,
  AdminOrder,
  AdminOrderAssignResult,
  AdminOrderRefund,
  AdminPayout,
  AdminPayoutDetail,
  AdminProduct,
  AdminRestaurant,
  AdminRole,
  AdminRoleDetail,
  AdminSetting,
  AdminStore,
  AdminUser,
  AdminVendor,
  AdminVendorDetail,
  AdminVehicleType,
  AdminWebhookSubscription,
  AdminZone,
  AdminZonePolygonPoint,
  CategoryServiceType,
  MapsClientConfig,
  PartnerReviewStatus,
  WebhookDelivery,
  WebhookEventDefinition,
} from '@/typings/models';
import type { Paginated } from '@/typings/api';

type FilterParams = {
  page?: number;
  per_page?: number;
  search?: string | null;
  status?: string | null;
  service?: 'food' | 'grocery' | 'ride' | null;
  service_type?: 'food' | 'grocery' | null;
  group?: string | null;
  placement?: string | null;
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

async function listEndpoint<T>(path: string, params: FilterParams): Promise<Paginated<T>> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.per_page) query.set('per_page', String(params.per_page));
  if (params.search) query.set('search', params.search);
  if (params.status) query.set('status', params.status);
  if (params.service) query.set('service', params.service);
  if (params.service_type) query.set('service_type', params.service_type);
  if (params.group) query.set('group', params.group);
  if (params.placement) query.set('placement', params.placement);
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

export const dashboardApi = {
  get: (days = 7): Promise<AdminDashboard> => api<AdminDashboard>(`/admin/dashboard?days=${days}`),
};

export const mapsApi = {
  config: () => api<MapsClientConfig>('/config/maps'),
};

export const adminAuthApi = {
  login: (email: string, password: string) =>
    apiClient.post<{ token: string; user: { id: number; name: string; email: string; roles?: { id: number; name: string; slug: string }[] } }>(
      '/auth/login/email',
      { email, password }
    ),
  me: () => api<AdminUser>('/admin/me'),
  logout: () => apiClient.post('/auth/logout'),
};

export const usersApi = {
  list: (params: FilterParams = {}) => listEndpoint<AdminUser>('/admin/users', params),
  get: (id: number) => api<AdminUser>(`/admin/users/${id}`),
  setStatus: (id: number, action: 'activate' | 'ban', ban_reason?: string) =>
    apiClient.put<AdminUser>(`/admin/users/${id}/status`, { action, ban_reason }),
};

export const vendorsApi = {
  list: (params: FilterParams = {}) => listEndpoint<AdminVendor>('/admin/vendors', params),
  get: (id: number) => api<AdminVendorDetail>(`/admin/vendors/${id}`),
  review: (id: number, body: { action: 'approve' | 'reject' | 'suspend' | 'reactivate'; rejection_reason?: string; suspension_reason?: string; commission_rate?: number }) =>
    apiClient.post<AdminVendor>(`/admin/vendors/${id}/review`, body),
  updateCommission: (id: number, commission_rate: number) =>
    apiClient.put<AdminVendor>(`/admin/vendors/${id}/commission`, { commission_rate }),

  /**
   * Ask the backend to start a vendor impersonation session.
   *
   * Returns a server-built handoff URL containing a short-lived, single-use
   * exchange code. No vendor credential is involved at any point: the admin
   * never supplies or receives a vendor password.
   */
  impersonate: (id: number, reason?: string) =>
    apiClient.post<{
      handoff_url: string;
      expires_at: string;
      reason: string | null;
      vendor: { id: number; business_name: string; vendor_type: string; status: string };
    }>(`/admin/vendors/${id}/impersonate`, reason ? { reason } : {}),
};

export const payoutsApi = {
  list: (params: FilterParams = {}) => listEndpoint<AdminPayout>('/admin/payouts', params),
  get: (id: number) => api<AdminPayoutDetail>(`/admin/payouts/${id}`),
  processing: (id: number) => apiClient.post<AdminPayout>(`/admin/payouts/${id}/processing`),
  paid: (id: number, adminRemark?: string) =>
    apiClient.post<AdminPayout>(`/admin/payouts/${id}/paid`, { admin_remark: adminRemark ?? null }),
  failed: (id: number, reason?: string) => apiClient.post<AdminPayout>(`/admin/payouts/${id}/failed`, { reason }),
};

export const restaurantsApi = {
  list: (params: FilterParams = {}) => listEndpoint<AdminRestaurant>('/admin/restaurants', params),
  get: (id: number) => api<AdminRestaurant>(`/admin/restaurants/${id}`),
  toggle: (id: number, field: 'is_open' | 'is_featured' | 'dine_in' | 'is_veg' | 'is_halal') =>
    apiClient.post<AdminRestaurant>(`/admin/restaurants/${id}/toggle`, { field }),
};

export const storesApi = {
  list: (params: FilterParams = {}) => listEndpoint<AdminStore>('/admin/stores', params),
  get: (id: number) => api<AdminStore>(`/admin/stores/${id}`),
  toggle: (id: number, field: 'is_open' | 'is_featured') =>
    apiClient.post<AdminStore>(`/admin/stores/${id}/toggle`, { field }),
};

export const productsApi = {
  list: (params: FilterParams = {}) => listEndpoint<AdminProduct>('/admin/products', params),
  toggle: (id: number, field: 'is_active' | 'is_available' | 'is_featured') =>
    apiClient.post<AdminProduct>(`/admin/products/${id}/toggle`, { field }),
};

type CategoryListParams = {
  page?: number;
  per_page?: number;
  search?: string | null;
  service_type?: CategoryServiceType | null;
  status?: 'active' | 'inactive' | null;
  featured?: boolean | null;
  trashed?: boolean | null;
  parent_id?: number | string | null;
};

export const categoriesApi = {
  list: async (params: CategoryListParams = {}): Promise<Paginated<AdminCategory>> => {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.per_page) query.set('per_page', String(params.per_page));
    if (params.search) query.set('search', params.search);
    if (params.service_type) query.set('service_type', params.service_type);
    if (params.status) query.set('status', params.status);
    if (params.featured !== null && params.featured !== undefined) query.set('featured', params.featured ? '1' : '0');
    if (params.trashed) query.set('trashed', '1');
    if (params.parent_id !== null && params.parent_id !== undefined) query.set('parent_id', String(params.parent_id));
    const qs = query.toString();
    const payload = await apiPayload<AdminCategory[]>(`/admin/categories${qs ? `?${qs}` : ''}`);
    const meta = (payload.meta?.pagination ?? {}) as Partial<PaginationMeta>;
    const items = payload.data ?? [];
    return {
      data: items,
      current_page: meta.current_page ?? 1,
      last_page: meta.last_page ?? 1,
      per_page: meta.per_page ?? items.length,
      total: meta.total ?? items.length,
    };
  },
  tree: (service_type?: CategoryServiceType) =>
    api<AdminCategory[]>(`/admin/categories/tree${service_type ? `?service_type=${service_type}` : ''}`),
  get: (id: number) => api<AdminCategoryDetail>(`/admin/categories/${id}`),
  create: (body: Record<string, unknown>) => apiClient.post<AdminCategory>('/admin/categories', body),
  update: (id: number, body: Record<string, unknown>) => apiClient.put<AdminCategory>(`/admin/categories/${id}`, body),
  remove: (id: number, force = false) => apiClient.delete<{ id: number; deleted_at: string }>(`/admin/categories/${id}${force ? '?force=1' : ''}`),
  restore: (id: number) => apiClient.post<AdminCategory>(`/admin/categories/${id}/restore`),
  reorder: (items: { id: number; sort_order: number }[]) => apiClient.post<number[]>('/admin/categories/reorder', { items }),
  toggle: (id: number, cascade = false) => apiClient.post<{ id: number; is_active: boolean; affected_ids: number[] }>(`/admin/categories/${id}/toggle`, { cascade }),
  toggleFeatured: (id: number) => apiClient.post<{ id: number; is_featured: boolean }>(`/admin/categories/${id}/toggle-featured`),
  uploadImage: (file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    return upload<{ image: string }>('/admin/categories/upload-image', formData);
  },
  removeImage: (id: number) => apiClient.delete<{ id: number; image: null }>(`/admin/categories/${id}/image`),
  uploadNavigationIcon: (file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    return upload<{ navigation_icon: string }>('/admin/categories/upload-navigation-icon', formData);
  },
  removeNavigationIcon: (id: number) =>
    apiClient.delete<{ id: number; navigation_icon: null }>(`/admin/categories/${id}/navigation-icon`),
  bulk: (action: 'activate' | 'deactivate' | 'delete' | 'restore', ids: number[], cascade = false) =>
    apiClient.post<{ action: string; ids: number[] }>('/admin/categories/bulk', { action, ids, cascade }),
};

export const ordersApi = {
  list: (params: FilterParams = {}) => listEndpoint<AdminOrder>('/admin/orders', params),
  get: (id: number) => api<AdminOrder>(`/admin/orders/${id}`),
  setStatus: (id: number, status: string, note?: string) =>
    apiClient.put<AdminOrder>(`/admin/orders/${id}/status`, { status, note }),
  eligibleDeliveryPartners: (id: number) =>
    api<AdminDeliveryPartnerCandidate[]>(`/admin/orders/${id}/eligible-delivery-partners`),
  assignDeliveryPartner: (id: number, deliveryPartnerId: number, note?: string) =>
    apiClient.post<AdminOrderAssignResult>(`/admin/orders/${id}/assign-delivery-partner`, {
      delivery_partner_id: deliveryPartnerId,
      note,
    }),
};

export const dispatchApi = {
  logs: (params: FilterParams = {}) => listEndpoint<AdminDispatchLog>('/admin/dispatch-logs', params),
};

export const couponsApi = {
  list: (params: FilterParams = {}) => listEndpoint<AdminCoupon>('/admin/coupons', params),
  get: (id: number) => api<AdminCoupon>(`/admin/coupons/${id}`),
  create: (body: Record<string, unknown>) => apiClient.post<AdminCoupon>('/admin/coupons', body),
  update: (id: number, body: Record<string, unknown>) => apiClient.put<AdminCoupon>(`/admin/coupons/${id}`, body),
  setActive: (id: number, is_active: boolean) => apiClient.put<AdminCoupon>(`/admin/coupons/${id}`, { is_active }),
  remove: (id: number) => apiClient.delete(`/admin/coupons/${id}`),
};

export const bannersApi = {
  list: (params: FilterParams = {}) => listEndpoint<AdminBanner>('/admin/banners', params),
  get: (id: number) => api<AdminBanner>(`/admin/banners/${id}`),
  create: (body: Record<string, unknown>) => apiClient.post<AdminBanner>('/admin/banners', body),
  update: (id: number, body: Record<string, unknown>) => apiClient.put<AdminBanner>(`/admin/banners/${id}`, body),
  toggle: (id: number) => apiClient.post<AdminBanner>(`/admin/banners/${id}/toggle`),
  remove: (id: number) => apiClient.delete(`/admin/banners/${id}`),
  uploadImage: (file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    return upload<{ image: string }>('/admin/banners/upload', formData);
  },
  uploadVideo: (file: File) => {
    const formData = new FormData();
    formData.append('video', file);
    return upload<{ video: string }>('/admin/banners/upload-video', formData);
  },
};

export const featureFlagsApi = {
  list: () => api<AdminFeatureFlag[]>('/admin/feature-flags'),
  toggle: (id: number) => apiClient.post<AdminFeatureFlag>(`/admin/feature-flags/${id}/toggle`),
};

export const rolesApi = {
  list: () => api<AdminRole[]>('/admin/roles'),
  get: (id: number) => api<AdminRoleDetail>(`/admin/roles/${id}`),
  create: (name: string) => apiClient.post<AdminRole>('/admin/roles', { name }),
  updatePermissions: (id: number, permissions: number[]) =>
    apiClient.put<AdminRole>(`/admin/roles/${id}/permissions`, { permissions }),
  modules: () => api<string[]>('/admin/roles/modules'),
};

export const fareRulesApi = {
  list: () => api<AdminFareRule[]>('/admin/fare-rules'),
  get: (id: number) => api<AdminFareRule>(`/admin/fare-rules/${id}`),
  create: (body: Record<string, unknown>) => apiClient.post<AdminFareRule>('/admin/fare-rules', body),
  update: (id: number, body: Record<string, unknown>) => apiClient.put<AdminFareRule>(`/admin/fare-rules/${id}`, body),
  toggle: (id: number) => apiClient.post<AdminFareRule>(`/admin/fare-rules/${id}/toggle`),
  remove: (id: number) => apiClient.delete(`/admin/fare-rules/${id}`),
  preview: (body: Record<string, unknown>) => apiClient.post<AdminFareRulePreview>('/admin/fare-rules/preview', body),
};

export const settingsApi = {
  list: (group?: string) => listEndpoint<AdminSetting>('/admin/app-settings', { group: group ?? null }),
  groups: () => api<string[]>('/admin/app-setting-groups'),
  update: (id: number, value: unknown) => apiClient.put<AdminSetting>(`/admin/app-settings/${id}`, { value }),
  /** Upload a platform logo (multipart `logo` file). Persists to the setting immediately. */
  uploadLogo: (file: File) => {
    const form = new FormData();
    form.append('logo', file);
    return upload<AdminSetting>('/admin/settings/logo', form);
  },
  /** Remove the configured platform logo (deletes the stored file). */
  removeLogo: () => apiClient.delete<AdminSetting>('/admin/settings/logo'),

  // Operational config
  zones: () => apiPayload('/admin/zones'),
  vehicleTypes: () => api<AdminVehicleType[]>('/admin/vehicle-types'),
  deliveryFeeRules: () => api<Record<string, unknown>[]>('/admin/delivery-fee-rules'),
  toggleDeliveryFeeRule: (id: number) => apiClient.post(`/admin/delivery-fee-rules/${id}/toggle`),
  drivers: (params: FilterParams = {}) => listEndpoint<AdminDriver>('/admin/drivers', params),
  driver: (id: number) => apiClient.get<AdminDriverDetail>(`/admin/drivers/${id}`),
  updateDriver: (
    id: number,
    body: { status?: PartnerReviewStatus; is_verified?: boolean; rejection_reason?: string | null }
  ) => apiClient.put<AdminDriver>(`/admin/drivers/${id}`, body),
  deliveryPartners: (params: FilterParams = {}) => listEndpoint<AdminDeliveryPartner>('/admin/delivery-partners', params),
  deliveryPartner: (id: number) => apiClient.get<AdminDeliveryPartnerDetail>(`/admin/delivery-partners/${id}`),
  updateDeliveryPartner: (id: number, body: { status?: PartnerReviewStatus; rejection_reason?: string | null }) =>
    apiClient.put<AdminDeliveryPartner>(`/admin/delivery-partners/${id}`, body),
};

export const zonesApi = {
  list: (params: FilterParams = {}) => listEndpoint<AdminZone>('/admin/zones', params),
  get: (id: number) => api<AdminZone>(`/admin/zones/${id}`),
  create: (body: Record<string, unknown>) => apiClient.post<AdminZone>('/admin/zones', body),
  update: (id: number, body: Record<string, unknown>) => apiClient.put<AdminZone>(`/admin/zones/${id}`, body),
  toggleStatus: (id: number) => apiClient.post<AdminZone>(`/admin/zones/${id}/toggle`),
  remove: (id: number) => apiClient.delete(`/admin/zones/${id}`),
  validate: (polygon: AdminZonePolygonPoint[]) =>
    apiClient.post<{ valid: boolean }>('/admin/zones/validate', { polygon }),
  deliveryConfigs: {
    global: () => api<Record<string, any>>('/admin/zones/delivery-config-global'),
    status: () =>
      api<{
        zones: Array<{
          id: number;
          name: string;
          code?: string | null;
          city?: string | null;
          is_active: boolean;
          food_enabled: boolean;
          grocery_enabled: boolean;
          configured: { food: boolean; grocery_instant: boolean; grocery_scheduled: boolean };
          missing: string[];
        }>;
        missing_count: number;
      }>('/admin/zones/delivery-config-status'),
    backfill: (dryRun = false) =>
      apiClient.post<Record<string, any>>('/admin/zones/delivery-config-backfill', { dry_run: dryRun }),
    get: (zoneId: number) => api<Record<string, any>>(`/admin/zones/${zoneId}/delivery-configs`),
    upsert: (zoneId: number, body: Record<string, unknown>) =>
      apiClient.put<Record<string, any>>(`/admin/zones/${zoneId}/delivery-configs`, body),
    reset: (zoneId: number, body: { module: string; delivery_mode: string }) =>
      apiClient.delete(`/admin/zones/${zoneId}/delivery-configs`, body),
  },
};

export const integrationsApi = {
  list: () => api<AdminIntegration[]>('/admin/integrations'),
  get: (service: string) => api<AdminIntegrationDetail>(`/admin/integrations/${service}`),
  update: (service: string, body: Record<string, unknown>) =>
    apiClient.put<AdminIntegrationDetail>(`/admin/integrations/${service}`, body),
  test: (service: string) => {
    // The smtp test route sends a real email and therefore requires a
    // recipient body; use sendSmtpTestEmail for that service instead.
    if (service === 'smtp') {
      return Promise.reject(new Error('Use Send Test Email for SMTP.'));
    }
    return apiClient.post<{ message: string }>(`/admin/integrations/${service}/test`);
  },
  sendSmtpTestEmail: (email: string) =>
    apiClient.post<{ recipient: string }>('/admin/integrations/smtp/test', { email }),
  reset: (service: string) => apiClient.delete<{ service: string }>(`/admin/integrations/${service}`),
};

export const webhooksApi = {
  health: () => api<{ events: WebhookEventDefinition[] }>('/webhooks/health'),
  list: () => api<AdminWebhookSubscription[]>('/webhooks/subscriptions'),
  create: (body: { target_url: string; events: string[] }) =>
    apiClient.post<AdminWebhookSubscription>('/webhooks/subscribe', body),
  update: (id: number, body: { target_url?: string; events?: string[]; status?: boolean }) =>
    apiClient.put<AdminWebhookSubscription>(`/webhooks/subscriptions/${id}`, body),
  remove: (id: number) => apiClient.delete(`/webhooks/subscriptions/${id}`),
  ping: (id: number) => apiClient.post<{ dispatched: number }>(`/webhooks/subscriptions/${id}/ping`),
  deliveries: (id: number) => api<WebhookDelivery[]>(`/webhooks/subscriptions/${id}/deliveries`),
};

export const supportTicketsApi = {
  list: (params: { page?: number; per_page?: number; status?: string; search?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', String(params.page));
    if (params.per_page) qs.set('per_page', String(params.per_page));
    if (params.status) qs.set('status', params.status);
    if (params.search) qs.set('search', params.search);
    return api<any>(`/admin/support-tickets${qs.toString() ? `?${qs.toString()}` : ''}`);
  },
  get: (id: number) => api<any>(`/admin/support-tickets/${id}`),
  update: (id: number, body: { status?: string; admin_notes?: string; refund_id?: number }) =>
    apiClient.put(`/admin/support-tickets/${id}`, body),
  refund: (id: number, body: { amount: number; reason: string; destination?: string; notes?: string }) =>
    apiClient.post(`/admin/support-tickets/${id}/refund`, body),
};

export const refundsApi = {
  list: (params: { page?: number; per_page?: number; status?: string } = {}) =>
    api<Paginated<AdminOrderRefund>>(`/admin/refunds?${new URLSearchParams(params as any).toString()}`),
  refundCancelledOrder: (orderId: number, body: { amount?: number; reason?: string; notes?: string }) =>
    apiClient.post<AdminOrderRefund>(`/admin/orders/${orderId}/refund`, body),
  approve: (id: number) => apiClient.post(`/admin/refunds/${id}/approve`),
  process: (id: number) => apiClient.post(`/admin/refunds/${id}/process`),
  reject: (id: number) => apiClient.post(`/admin/refunds/${id}/reject`),
};