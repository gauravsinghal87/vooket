import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'sb-token';

/**
 * Auth token storage.
 *
 * The web app keeps the token under `localStorage['sb-token']`. On mobile we
 * store it in the OS keychain/keystore via expo-secure-store and mirror it in
 * an in-memory cache so the request layer can read it synchronously (matching
 * the web client's behaviour of attaching `Authorization: Bearer <token>` on
 * every request).
 */
let cachedToken: string | null = null;

export async function loadToken(): Promise<string | null> {
  try {
    cachedToken = await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    cachedToken = null;
  }
  return cachedToken;
}

export function getCachedToken(): string | null {
  return cachedToken;
}

export async function persistToken(token: string | null): Promise<void> {
  cachedToken = token;
  try {
    if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
    else await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => undefined);
  } catch {
    // storage unavailable (e.g. web) — keep in-memory value
  }
}