import type { ApiResponse } from '@/typings/api';

export class ApiError extends Error {
  status: number;
  errors?: Record<string, string[]>;
  constructor(message: string, status: number, errors?: Record<string, string[]>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
  }
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

/**
 * Token keys.
 *
 * A vendor's own login lives in `sv-token`. An admin impersonation session
 * lives in a SEPARATE key so it can be told apart, revoked independently, and
 * can never silently become the vendor's permanent session. A real login
 * always wins visually: the impersonation session is only used when the vendor
 * has no normal session of their own.
 *
 * The admin panel's own token is never written to this origin.
 */
const TOKEN_KEY = 'sv-token';
const IMPERSONATION_TOKEN_KEY = 'sv-impersonation-token';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return (
    window.localStorage.getItem(TOKEN_KEY) ?? window.localStorage.getItem(IMPERSONATION_TOKEN_KEY)
  );
}

export function setToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
}

export function getImpersonationToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(IMPERSONATION_TOKEN_KEY);
}

export function setImpersonationToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  if (token) window.localStorage.setItem(IMPERSONATION_TOKEN_KEY, token);
  else window.localStorage.removeItem(IMPERSONATION_TOKEN_KEY);
}

/** Drop whichever credential is in play (normal login or impersonation). */
function clearStoredToken(): void {
  setToken(null);
  setImpersonationToken(null);
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
}

export async function apiPayload<T>(path: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
  const { method = 'GET', body, headers } = options;
  const token = getToken();

  const finalHeaders: Record<string, string> = {
    Accept: 'application/json',
    ...headers,
  };
  if (token) finalHeaders.Authorization = `Bearer ${token}`;
  if (body !== undefined) finalHeaders['Content-Type'] = 'application/json';

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: finalHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let payload: ApiResponse<T> | null = null;
  try {
    payload = (await response.json()) as ApiResponse<T>;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message =
      (payload && payload.message) ||
      (response.status === 401 ? 'Session expired. Please log in again.' : 'Something went wrong.');
    const status = response.status;

    if (status === 401) {
      clearStoredToken();
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    }

    throw new ApiError(message, status, payload?.errors);
  }

  return payload ?? ({ success: true, message: '', data: {} as T } as ApiResponse<T>);
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const payload = await apiPayload<T>(path, options);
  return payload.data as T;
}

export async function upload<T>(path: string, formData: FormData): Promise<T> {
  const token = getToken();

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });

  let payload: ApiResponse<T> | null = null;
  try {
    payload = (await response.json()) as ApiResponse<T>;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message =
      (payload && payload.message) ||
      (response.status === 401 ? 'Session expired. Please log in again.' : 'Something went wrong.');

    if (response.status === 401) {
      clearStoredToken();
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    }

    throw new ApiError(message, response.status, payload?.errors);
  }

  return (payload?.data ?? {}) as T;
}

export const apiClient = {
  get: <T>(path: string, headers?: Record<string, string>) => api<T>(path, { headers }),
  post: <T>(path: string, body?: unknown, headers?: Record<string, string>) =>
    api<T>(path, { method: 'POST', body, headers }),
  put: <T>(path: string, body?: unknown, headers?: Record<string, string>) =>
    api<T>(path, { method: 'PUT', body, headers }),
  patch: <T>(path: string, body?: unknown, headers?: Record<string, string>) =>
    api<T>(path, { method: 'PATCH', body, headers }),
  delete: <T>(path: string, body?: unknown) => api<T>(path, { method: 'DELETE', body }),
};