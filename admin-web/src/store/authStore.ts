import { create } from 'zustand';
import { setToken } from '@/lib/api';
import { adminAuthApi } from '@/repositories/admin';
import type { AdminUser } from '@/typings/models';

interface AuthState {
  token: string | null;
  profile: AdminUser | null;
  initialized: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  profile: null,
  initialized: false,
  isAuthenticated: false,

  login: async (email, password) => {
    const result = await adminAuthApi.login(email.trim(), password);
    setToken(result.token);
    try {
      const profile = await adminAuthApi.me();
      set({ token: result.token, profile, isAuthenticated: true });
    } catch (err) {
      setToken(null);
      set({ token: null, profile: null, isAuthenticated: false });
      throw err;
    }
  },

  logout: async () => {
    try {
      await adminAuthApi.logout();
    } catch {
      // ignore network failures on logout
    }
    setToken(null);
    set({ token: null, profile: null, isAuthenticated: false });
  },

  initialize: async () => {
    const stored = localStorage.getItem('sa-token');
    if (!stored) {
      set({ initialized: true, isAuthenticated: false });
      return;
    }
    set({ token: stored });
    try {
      const profile = await adminAuthApi.me();
      set({ profile, isAuthenticated: true, initialized: true });
    } catch {
      setToken(null);
      set({ token: null, profile: null, isAuthenticated: false, initialized: true });
    }
  },
}));