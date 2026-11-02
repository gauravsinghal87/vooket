import { useEffect, type ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { QueryProvider } from './query-provider';
import { Toaster } from '@/shared/components/ui/toast';
import { useAuthStore } from '@/features/auth/store/authStore';

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

  return (
    <QueryProvider>
      <BrowserRouter>
        {children}
        <Toaster />
      </BrowserRouter>
    </QueryProvider>
  );
}
