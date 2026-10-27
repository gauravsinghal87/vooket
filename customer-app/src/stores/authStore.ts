import { create } from 'zustand';
import type { User } from '@/types/catalog';
import { IS_MOCK } from '@/config/dataSource';
import { onUnauthorized } from '@/api/client';
import { auth, user } from '@/api/repositories';
import { loadToken, persistToken } from '@/api/token';

const MOCK_USER: User = {
  id: 1,
  name: 'Aarav Sharma',
  email: 'aarav@example.com',
  phone: '9876543210',
  country_code: '+91',
  avatar: null,
  user_type: 'customer',
  referral_code: 'AARAV10',
};

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  initialized: boolean;
  otpToken: string | null;
  sendOtp: (phone: string) => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  loginWithPhone: (phone: string, password: string) => Promise<void>;
  loginWithOtp: (phone: string, otp: string) => Promise<void>;
  loginWithGoogle: (credential: string) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  forgotPassword: (email: string) => Promise<string>;
  resetPassword: (payload: ResetPasswordPayload) => Promise<void>;
  logout: () => Promise<void>;
  fetchProfile: () => Promise<void>;
  setUser: (user: User) => void;
  initialize: () => Promise<void>;
}

export interface RegisterPayload {
  name: string;
  phone: string;
  email?: string;
  password: string;
  password_confirmation: string;
  country_code?: string;
}

export interface ResetPasswordPayload {
  token: string;
  email: string;
  password: string;
  password_confirmation: string;
}

const delay = (ms = 500) => new Promise((r) => setTimeout(r, ms));

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  initialized: false,
  otpToken: null,

  sendOtp: async (phone) => {
    if (IS_MOCK) {
      await delay();
      set({ otpToken: 'mock-token' });
      return;
    }
    const data = await auth.sendOtp(phone);
    set({ otpToken: data.token });
  },

  loginWithEmail: async (email, password) => {
    if (IS_MOCK) {
      await delay();
      await persistToken('mock-token');
      set({ user: MOCK_USER, isAuthenticated: true, initialized: true });
      return;
    }
    const data = await auth.loginWithEmail(email, password);
    await persistToken(data.token);
    set({ user: data.user, isAuthenticated: true, initialized: true });
  },

  loginWithPhone: async (phone, password) => {
    if (IS_MOCK) {
      await delay();
      await persistToken('mock-token');
      set({ user: MOCK_USER, isAuthenticated: true, initialized: true });
      return;
    }
    const data = await auth.loginWithPhone(phone, password);
    await persistToken(data.token);
    set({ user: data.user, isAuthenticated: true, initialized: true });
  },

  loginWithOtp: async (phone, otp) => {
    const state = useAuthStore.getState();
    if (IS_MOCK) {
      await delay();
      await persistToken('mock-token');
      set({ user: MOCK_USER, isAuthenticated: true, initialized: true });
      return;
    }
    if (!state.otpToken) {
      throw new Error('Please request an OTP first.');
    }
    const data = await auth.loginWithOtp(phone, otp, state.otpToken);
    await persistToken(data.token);
    set({ user: data.user, isAuthenticated: true, initialized: true, otpToken: null });
  },

  loginWithGoogle: async (credential) => {
    if (IS_MOCK) {
      await delay();
      await persistToken('mock-token');
      set({ user: MOCK_USER, isAuthenticated: true, initialized: true });
      return;
    }
    const data = await auth.loginWithGoogle(credential);
    await persistToken(data.token);
    set({ user: data.user, isAuthenticated: true, initialized: true });
  },

  register: async (payload) => {
    if (IS_MOCK) {
      await delay();
      await persistToken('mock-token');
      set({
        user: { ...MOCK_USER, name: payload.name, phone: payload.phone, email: payload.email ?? MOCK_USER.email },
        isAuthenticated: true,
        initialized: true,
      });
      return;
    }
    const data = await auth.register(payload);
    await persistToken(data.token);
    set({ user: data.user, isAuthenticated: true, initialized: true });
  },

  forgotPassword: async (email) => {
    if (IS_MOCK) {
      await delay();
      return 'If an account exists for this email and uses a password, a password reset link has been sent. Please check your inbox.';
    }
    const { message } = await auth.forgotPassword(email);
    return message;
  },

  resetPassword: async (payload) => {
    if (IS_MOCK) {
      await delay();
      return;
    }
    await auth.resetPassword(payload);
  },

  logout: async () => {
    if (!IS_MOCK) {
      try {
        await auth.logout();
      } catch {
        // ignore
      }
    }
    await persistToken(null);
    set({ user: null, isAuthenticated: false, initialized: true });
  },

  fetchProfile: async () => {
    if (IS_MOCK) {
      await delay();
      set({ user: MOCK_USER, isAuthenticated: true, initialized: true });
      return;
    }
    const profile = await user.getProfile();
    set({ user: profile, isAuthenticated: true, initialized: true });
  },

  setUser: (user) => set({ user, isAuthenticated: true }),

  initialize: async () => {
    if (IS_MOCK) {
      set({ initialized: true });
      return;
    }
    const token = await loadToken();
    if (!token) {
      set({ initialized: true });
      return;
    }
    try {
      const profile = await user.getProfile();
      set({ user: profile, isAuthenticated: true, initialized: true });
    } catch {
      await persistToken(null);
      set({ user: null, isAuthenticated: false, initialized: true });
    }
  },
}));

onUnauthorized(() => {
  useAuthStore.setState({ user: null, isAuthenticated: false, initialized: true });
});