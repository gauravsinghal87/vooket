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
  return window.localStorage.getItem('pt-token');
}

export function setToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  if (token) window.localStorage.setItem('pt-token', token);
  else window.localStorage.removeItem('pt-token');
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  isForm?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
  const { method = 'GET', body, headers, isForm } = options;
  const token = getToken();

  const finalHeaders: Record<string, string> = {
    Accept: 'application/json',
    ...headers,
  };
  if (token) finalHeaders.Authorization = `Bearer ${token}`;
  if (body !== undefined && !isForm) finalHeaders['Content-Type'] = 'application/json';

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: finalHeaders,
    body: body !== undefined ? (isForm ? (body as FormData) : JSON.stringify(body)) : undefined,
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
  const payload = await request<T>(path, options);
  return payload.data as T;
}

export function uploadForm<T>(path: string, form: FormData, method: 'POST' = 'POST'): Promise<T> {
  return api<T>(path, { method, body: form, isForm: true });
}

export function queryString(params: Record<string, string | number | null | undefined> = {}): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  }
  const str = search.toString();
  return str ? `?${str}` : '';
}