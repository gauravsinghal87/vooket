import { create } from 'zustand';
import type { User } from '@/types/catalog';
import { apiClient, setToken } from '@/lib/apiClient';
import { IS_MOCK } from '@/config/dataSource';

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
    const data = await apiClient.post<{ token: string }>('/auth/otp/send', { phone, country_code: '+91', purpose: 'login' });
    set({ otpToken: data.token });
  },

  loginWithEmail: async (email, password) => {
    if (IS_MOCK) {
      await delay();
      setToken('mock-token');
      set({ user: MOCK_USER, isAuthenticated: true, initialized: true });
      return;
    }
    const data = await apiClient.post<{ token: string; user: User }>('/auth/login/email', { email, password });
    setToken(data.token);
    set({ user: data.user, isAuthenticated: true, initialized: true });
  },

  loginWithPhone: async (phone, password) => {
    if (IS_MOCK) {
      await delay();
      setToken('mock-token');
      set({ user: MOCK_USER, isAuthenticated: true, initialized: true });
      return;
    }
    const data = await apiClient.post<{ token: string; user: User }>('/auth/login', { phone, password, country_code: '+91' });
    setToken(data.token);
    set({ user: data.user, isAuthenticated: true, initialized: true });
  },

  loginWithOtp: async (phone, otp) => {
    const state = useAuthStore.getState();
    if (IS_MOCK) {
      await delay();
      setToken('mock-token');
      set({ user: MOCK_USER, isAuthenticated: true, initialized: true });
      return;
    }
    if (!state.otpToken) {
      throw new Error('Please request an OTP first.');
    }
    const data = await apiClient.post<{ token: string; user: User }>('/auth/otp/verify', { phone, otp, token: state.otpToken, country_code: '+91' });
    setToken(data.token);
    set({ user: data.user, isAuthenticated: true, initialized: true, otpToken: null });
  },

  loginWithGoogle: async (credential) => {
    if (IS_MOCK) {
      await delay();
      setToken('mock-token');
      set({ user: MOCK_USER, isAuthenticated: true, initialized: true });
      return;
    }
    const data = await apiClient.post<{ token: string; user: User }>('/auth/google', { credential });
    setToken(data.token);
    set({ user: data.user, isAuthenticated: true, initialized: true });
  },

  register: async (payload) => {
    if (IS_MOCK) {
      await delay();
      setToken('mock-token');
      set({ user: { ...MOCK_USER, name: payload.name, phone: payload.phone, email: payload.email ?? MOCK_USER.email }, isAuthenticated: true, initialized: true });
      return;
    }
    const data = await apiClient.post<{ token: string; user: User }>('/auth/register', payload);
    setToken(data.token);
    set({ user: data.user, isAuthenticated: true, initialized: true });
  },

  forgotPassword: async (email) => {
    if (IS_MOCK) {
      await delay();
      return 'If an account exists for this email and uses a password, a password reset link has been sent. Please check your inbox.';
    }
    // The API always answers with the same generic message; it is returned
    // verbatim so the UI can never imply an account exists or not.
    const { message } = await apiClient.postWithMessage<null>('/auth/forgot-password', { email });
    return message;
  },

  resetPassword: async (payload) => {
    if (IS_MOCK) {
      await delay();
      return;
    }
    await apiClient.post<null>('/auth/reset-password', payload);
  },

  logout: async () => {
    if (!IS_MOCK) {
      try {
        await apiClient.post('/auth/logout');
      } catch {
        // ignore
      }
    }
    setToken(null);
    set({ user: null, isAuthenticated: false, initialized: true });
  },

  fetchProfile: async () => {
    if (IS_MOCK) {
      await delay();
      set({ user: MOCK_USER, isAuthenticated: true, initialized: true });
      return;
    }
    const user = await apiClient.get<User>('/profile');
    set({ user, isAuthenticated: true, initialized: true });
  },

  setUser: (user) => set({ user, isAuthenticated: true }),

  initialize: async () => {
    if (IS_MOCK) {
      set({ initialized: true });
      return;
    }
    const token = localStorage.getItem('sb-token');
    if (!token) {
      set({ initialized: true });
      return;
    }
    try {
      const user = await apiClient.get<User>('/profile');
      set({ user, isAuthenticated: true, initialized: true });
    } catch {
      setToken(null);
      set({ user: null, isAuthenticated: false, initialized: true });
    }
  },
}));
