import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { queryClient } from '@/shared/query/queryClient';

/**
 * Server state stays in TanStack Query. The client itself lives in
 * `shared/query` so auth transitions can clear it as well.
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
