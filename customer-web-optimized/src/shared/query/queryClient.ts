import { QueryClient } from '@tanstack/react-query';

/**
 * One QueryClient per browser session.
 *
 * It lives in the shared layer (instead of inside the provider component) so
 * the auth store can drop every cached response when the signed-in user
 * changes. User-specific discovery sections such as `recently_ordered` must
 * never survive a logout or a 401.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60, retry: 1 },
  },
});

/** Drops all cached server state. Called on login, logout and a 401. */
export function resetQueryCache(): void {
  queryClient.clear();
}
