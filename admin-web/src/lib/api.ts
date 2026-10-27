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

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('sa-token');
}

export function setToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  if (token) window.localStorage.setItem('sa-token', token);
  else window.localStorage.removeItem('sa-token');
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
      setToken(null);
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
    const status = response.status;

    if (status === 401) {
      setToken(null);
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    }

    throw new ApiError(message, status, payload?.errors);
  }

  return (payload ?? { success: true, message: '', data: {} as T }).data as T;
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
  list: <T>(path: string, options: RequestOptions = {}) =>
    apiPayload<{ items: T[] }>(path, { ...options, headers: { 'X-No-Paginate': '1' } }),
};