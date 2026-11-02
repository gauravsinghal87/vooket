/** Central API client. Handles auth header, base URL, error normalization. */
import type { ApiResponse } from '@/shared/types/api';

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

function getToken(): string | null {
  return localStorage.getItem('sb-token');
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem('sb-token', token);
  else localStorage.removeItem('sb-token');
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<ApiResponse<T> | null> {
  const { method = 'GET', body, headers } = options;
  const token = getToken();

  const finalHeaders: Record<string, string> = {
    Accept: 'application/json',
    ...headers,
  };
  if (token) finalHeaders.Authorization = `Bearer ${token}`;
  const isFormData = body instanceof FormData;
  if (body !== undefined && !isFormData) {
    finalHeaders['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: finalHeaders,
    body: body !== undefined ? (isFormData ? (body as any) : JSON.stringify(body)) : undefined,
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
      setToken(null);
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    }

    throw new ApiError(message, status, payload?.errors);
  }

  return payload;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const payload = await request<T>(path, options);

  return payload ? (payload.data as T) : ({} as T);
}

/**
 * Perform a request and return the envelope message alongside the data.
 *
 * Used where the server owns the user-facing wording (e.g. the deliberately
 * generic "forgot password" reply) so the message is never duplicated or
 * paraphrased on the client.
 */
export async function apiWithMessage<T>(
  path: string,
  options: RequestOptions = {}
): Promise<{ data: T; message: string }> {
  const payload = await request<T>(path, options);

  return {
    data: payload ? (payload.data as T) : ({} as T),
    message: payload?.message ?? '',
  };
}

/**
 * Perform a request and return the full envelope, including `meta`.
 *
 * Listings put server-resolved facts that are not part of the rows themselves
 * in `meta` (e.g. Food serviceability for the requested location), so the
 * generic `api()`/`apiClient.get` unwrapping is not enough there.
 */
export async function apiWithMeta<T, M = Record<string, unknown>>(
  path: string,
  options: RequestOptions = {}
): Promise<{ data: T; meta: M }> {
  const payload = await request<T>(path, options);

  return {
    data: payload ? (payload.data as T) : ({} as T),
    meta: (payload?.meta ?? {}) as M,
  };
}

export const apiClient = {
  get: <T>(path: string, headers?: Record<string, string>) => api<T>(path, { headers }),
  getWithMeta: <T, M = Record<string, unknown>>(path: string, headers?: Record<string, string>) =>
    apiWithMeta<T, M>(path, { headers }),
  post: <T>(path: string, body?: unknown, headers?: Record<string, string>) =>
    api<T>(path, { method: 'POST', body, headers }),
  put: <T>(path: string, body?: unknown, headers?: Record<string, string>) =>
    api<T>(path, { method: 'PUT', body, headers }),
  patch: <T>(path: string, body?: unknown, headers?: Record<string, string>) =>
    api<T>(path, { method: 'PATCH', body, headers }),
  delete: <T>(path: string, body?: unknown) => api<T>(path, { method: 'DELETE', body }),
  postWithMessage: <T>(path: string, body?: unknown) =>
    apiWithMessage<T>(path, { method: 'POST', body }),
};
