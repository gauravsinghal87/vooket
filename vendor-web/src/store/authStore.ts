import { create } from 'zustand';
import { getImpersonationToken, setImpersonationToken, setToken } from '@/lib/api';
import { impersonationApi, vendorAuthApi } from '@/repositories/vendor';
import type { ImpersonationContext } from '@/repositories/vendor';
import type { VendorUser } from '@/typings/models';

interface AuthState {
  token: string | null;
  profile: VendorUser | null;
  initialized: boolean;
  isAuthenticated: boolean;
  /** Non-null only while an admin is driving this vendor session. */
  impersonation: ImpersonationContext | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  initialize: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  /** Redeem an admin handoff code and adopt the resulting vendor session. */
  acceptImpersonation: (code: string) => Promise<void>;
  /** End the impersonation session and return to the admin panel. */
  endImpersonation: () => Promise<string | null>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  profile: null,
  initialized: false,
  isAuthenticated: false,
  impersonation: null,

  login: async (email, password) => {
    const result = await vendorAuthApi.login(email.trim(), password);
    // A normal login supersedes any impersonation session for this browser.
    setImpersonationToken(null);
    setToken(result.token);
    try {
      const profile = await vendorAuthApi.me();
      set({ token: result.token, profile, isAuthenticated: true, impersonation: null });
    } catch (err) {
      setToken(null);
      set({ token: null, profile: null, isAuthenticated: false, impersonation: null });
      throw err;
    }
  },

  logout: async () => {
    try {
      await vendorAuthApi.logout();
    } catch {
      // ignore network failures on logout
    }
    setImpersonationToken(null);
    setToken(null);
    set({ token: null, profile: null, isAuthenticated: false, impersonation: null });
  },

  /**
   * Load the existing session, then ask the backend whether it is an
   * impersonation session.
   *
   * The context is read from the server for the current token, so the banner
   * cannot be spoofed or forged by editing localStorage.
   */
  initialize: async () => {
    const impersonationToken = getImpersonationToken();
    const stored = localStorage.getItem('sv-token') ?? impersonationToken;
    if (!stored) {
      set({ initialized: true, isAuthenticated: false });
      return;
    }
    set({ token: stored });
    try {
      const profile = await vendorAuthApi.me();
      const vendor = profile.vendor;
      if (!vendor) {
        setToken(null);
        setImpersonationToken(null);
        set({ token: null, profile: null, isAuthenticated: false, initialized: true });
        return;
      }

      // Only an impersonation session reports a context. A normal vendor
      // login gets null here and no banner.
      let impersonation: ImpersonationContext | null = null;
      if (impersonationToken && !localStorage.getItem('sv-token')) {
        try {
          impersonation = await impersonationApi.context();
        } catch {
          impersonation = null;
        }
      }

      set({ profile, isAuthenticated: true, impersonation, initialized: true });
    } catch {
      setToken(null);
      setImpersonationToken(null);
      set({ token: null, profile: null, isAuthenticated: false, impersonation: null, initialized: true });
    }
  },

  refreshProfile: async () => {
    try {
      const profile = await vendorAuthApi.me();
      if (!profile.vendor) {
        set({ profile: null, isAuthenticated: false });
        return;
      }
      set({ profile, isAuthenticated: true });
    } catch {
      set({ isAuthenticated: false });
    }
  },

  acceptImpersonation: async (code) => {
    const result = await vendorAuthApi.exchangeImpersonation(code);

    // Stored under the impersonation key only - never as sv-token, so the
    // vendor's own normal session slot is untouched.
    setImpersonationToken(result.token);

    try {
      const profile = await vendorAuthApi.me();
      if (!profile.vendor) throw new Error('Vendor profile not found');
      set({
        token: result.token,
        profile,
        isAuthenticated: true,
        impersonation: result.impersonation ?? null,
        initialized: true,
      });
    } catch (err) {
      setImpersonationToken(null);
      set({ token: null, profile: null, isAuthenticated: false, impersonation: null });
      throw err;
    }
  },

  endImpersonation: async (): Promise<string | null> => {
    // Read through get() rather than the module-level store so the type
    // inference for this store does not depend on its own initializer.
    const returnUrl = get().impersonation?.return_url ?? null;
    try {
      // Revokes only the impersonation token server-side. The admin's own
      // token is a different row and is never touched.
      await impersonationApi.end();
    } catch {
      // Even if the revoke call fails, drop the local credential.
    }
    setImpersonationToken(null);
    set({ token: null, profile: null, isAuthenticated: false, impersonation: null, initialized: true });
    return returnUrl;
  },
}));
