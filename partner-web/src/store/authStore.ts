import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { authApi } from '@/repositories/auth';
import { driverApi } from '@/repositories/driver';
import { partnerApi } from '@/repositories/partner';
import { setToken } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { useJobStore } from '@/store/jobStore';
import type { AuthUser, JobProfile, PartnerRole } from '@/typings/models';

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  role: PartnerRole | null;
  profile: JobProfile | null;
  initialized: boolean;
  initialize: () => Promise<void>;
  login: (email: string, password: string) => Promise<PartnerRole>;
  switchRole: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  setOnline: (isOnline: boolean) => void;
  logout: () => void;
  clearSessionState: () => void;
}

function roleFromUser(user: AuthUser, preferred: PartnerRole | null): PartnerRole | null {
  const slugs = user.roles?.map((r) => r.slug) ?? [];
  const hasDriver = slugs.includes('driver');
  const hasPartner = slugs.includes('delivery_partner');
  if (preferred === 'driver' && hasDriver) return 'driver';
  if (preferred === 'delivery_partner' && hasPartner) return 'delivery_partner';
  if (hasPartner) return 'delivery_partner';
  if (hasDriver) return 'driver';
  return null;
}

async function fetchProfile(role: PartnerRole): Promise<JobProfile> {
  return role === 'driver' ? driverApi.profile() : partnerApi.profile();
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      role: null,
      profile: null,
      initialized: false,

      clearSessionState: () => {
        queryClient.clear();
        useJobStore.getState().clear();
      },

      initialize: async () => {
        const { token, role } = get();
        if (!token || !role) {
          setToken(null);
          set({ initialized: true });
          return;
        }
        setToken(token);
        try {
          const profile = await fetchProfile(role);
          set({ profile, initialized: true });
        } catch {
          set({ token: null, user: null, role: null, profile: null, initialized: true });
        }
      },

      login: async (email, password) => {
        const { user, token } = await authApi.login(email, password);
        const preferred = get().role;
        const role = roleFromUser(user, preferred);
        if (!role) {
          throw new Error('This account is not a driver or delivery partner.');
        }
        get().clearSessionState();
        setToken(token);
        const profile = await fetchProfile(role);
        set({ token, user, role, profile, initialized: true });
        return role;
      },

      switchRole: async () => {
        const { user, role } = get();
        const slugs = user?.roles?.map((r) => r.slug) ?? [];
        const next: PartnerRole =
          role === 'driver' && slugs.includes('delivery_partner')
            ? 'delivery_partner'
            : role === 'delivery_partner' && slugs.includes('driver')
              ? 'driver'
              : role ?? 'driver';
        if (next === role) return;
        get().clearSessionState();
        const profile = await fetchProfile(next);
        set({ role: next, profile });
      },

      refreshProfile: async () => {
        const { role, token } = get();
        if (!role || !token) return;
        setToken(token);
        const profile = await fetchProfile(role);
        set({ profile });
      },

      setOnline: (isOnline) => {
        const { profile } = get();
        if (!profile) return;
        set({ profile: { ...profile, is_online: isOnline } });
      },

      logout: () => {
        get().clearSessionState();
        setToken(null);
        set({ token: null, user: null, role: null, profile: null, initialized: true });
      },
    }),
    {
      name: 'pt-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ token: state.token, user: state.user, role: state.role, profile: state.profile }),
    }
  )
);