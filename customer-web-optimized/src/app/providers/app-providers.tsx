import { useEffect, type ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { QueryProvider } from './query-provider';
import { Toaster } from '@/shared/components/ui/toast';
import { useAuthStore } from '@/features/auth/store/authStore';
import { resetQueryCache } from '@/shared/query/queryClient';

/**
 * Application providers.
 *
 * Order matters: the router is inside the query provider because screens use
 * TanStack Query and router hooks together; the auth bootstrap runs once and
 * `RequireAuth` observes the same store.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  useEffect(() => {
    void useAuthStore.getState().initialize();
  }, []);

  // The API client dispatches `auth:unauthorized` on any 401. A guest cart
  // request can legitimately 401 (the endpoint needs a session), so only a 401
  // that actually ends an authenticated session should drop the cache. When it
  // does, user-specific data and the in-memory session go immediately.
  useEffect(() => {
    const onUnauthorized = () => {
      if (!useAuthStore.getState().isAuthenticated) return;
      resetQueryCache();
      useAuthStore.setState({ user: null, isAuthenticated: false, initialized: true });
    };
    window.addEventListener('auth:unauthorized', onUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', onUnauthorized);
  }, []);

  return (
    <QueryProvider>
      <BrowserRouter>
        {children}
        <Toaster />
      </BrowserRouter>
    </QueryProvider>
  );
}
