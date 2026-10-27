import { api } from '@/lib/api';
import type { AuthUser, JobProfile } from '@/typings/models';

export interface PartnerRegistrationPayload {
  role: 'driver' | 'delivery_partner';
  name: string;
  email: string;
  phone: string;
  password: string;
  country_code?: string;
  service_type?: 'food' | 'grocery';
  zone_id?: number | null;
  vehicle_type_id?: number;
  vehicle_type?: string;
  vehicle_number: string;
  vehicle_model?: string;
  vehicle_color?: string;
  license_number: string;
  license_expiry: string;
  aadhar_number: string;
  pan_number?: string;
  bank_account_name?: string;
  bank_account_number?: string;
  bank_ifsc?: string;
  bank_name?: string;
}

export const authApi = {
  login: async (email: string, password: string): Promise<{ user: AuthUser; token: string }> =>
    api('/auth/login/email', { method: 'POST', body: { email, password } }),
  register: async (body: PartnerRegistrationPayload): Promise<{ user: AuthUser; profile: JobProfile }> =>
    api('/auth/partner/register', { method: 'POST', body }),
  reapply: async (body: Partial<PartnerRegistrationPayload>) => api<JobProfile>('/auth/partner/reapply', { method: 'POST', body }),
};