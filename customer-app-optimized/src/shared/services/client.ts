/**
 * Central API client — ported from customer-web/src/lib/apiClient.ts.
 * Handles auth header, base URL, envelope unwrapping and error normalisation.
 */
import type { ApiResponse } from '@/shared/types';
import { getCachedToken, persistToken } from './token';

const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:8000/api/v1').replace(/\/$/, '');

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

type UnauthorizedListener = () => void;
const unauthorizedListeners = new Set<UnauthorizedListener>();

/** Web dispatches `auth:unauthorized` on `window`; here we notify subscribers. */
export function onUnauthorized(listener: UnauthorizedListener): () => void {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
}

/**
 * Multipart bodies are passed straight through so the runtime can set the
 * `multipart/form-data` boundary — setting the content type by hand breaks
 * the upload.
 */
function isFormData(body: unknown): body is FormData {
  return typeof FormData !== 'undefined' && body instanceof FormData;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<ApiResponse<T> | null> {
  const { method = 'GET', body, headers } = options;
  const token = getCachedToken();
  const multipart = isFormData(body);

  const finalHeaders: Record<string, string> = {
    Accept: 'application/json',
    ...headers,
  };
  if (token) finalHeaders.Authorization = `Bearer ${token}`;
  if (body !== undefined && !multipart) finalHeaders['Content-Type'] = 'application/json';

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: finalHeaders,
      body: body !== undefined ? (multipart ? (body as BodyInit) : JSON.stringify(body)) : undefined,
    });
  } catch {
    throw new ApiError('Could not reach the server. Check your connection and try again.', 0);
  }

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
      await persistToken(null);
      unauthorizedListeners.forEach((l) => l());
    }

    throw new ApiError(message, status, payload?.errors);
  }

  return payload;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const payload = await request<T>(path, options);
  return payload ? (payload.data as T) : ({} as T);
}

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
 * generic `api()` unwrapping is not enough there.
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
  /** Multipart POST — used for uploads (e.g. support ticket evidence). */
  postForm: <T>(path: string, form: FormData, headers?: Record<string, string>) =>
    api<T>(path, { method: 'POST', body: form, headers }),
};

export { API_BASE_URL };