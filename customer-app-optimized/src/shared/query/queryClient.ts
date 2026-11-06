import { QueryClient } from '@tanstack/react-query';

/**
 * One QueryClient per app session.
 *
 * Lives outside the root layout so the auth store can clear cached server state
 * when the signed-in customer changes. Discovery includes user-specific rails
 * (`recently_ordered`, `buy_again`), which must never survive a logout or 401.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

/** Drops all cached server state. Called on login, logout and a 401. */
export function resetQueryCache(): void {
  queryClient.clear();
}
