/** Central API client for the admin panel. Handles auth header, base URL, error normalization. */
import type { ApiResponse } from '@/types/api';

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

export const TOKEN_KEY = 'sb-admin-token';

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
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

    if (status === 401 || status === 403) {
      setToken(null);
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    }

    throw new ApiError(message, status, payload?.errors);
  }

  return (payload ? (payload.data as T) : ({} as T));
}

export const apiClient = {
  get: <T>(path: string, headers?: Record<string, string>) => api<T>(path, { headers }),
  post: <T>(path: string, body?: unknown, headers?: Record<string, string>) =>
    api<T>(path, { method: 'POST', body, headers }),
  put: <T>(path: string, body?: unknown, headers?: Record<string, string>) =>
    api<T>(path, { method: 'PUT', body, headers }),
  delete: <T>(path: string, body?: unknown) => api<T>(path, { method: 'DELETE', body }),
};