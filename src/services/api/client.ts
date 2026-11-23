/**
 * Second Brain API Client
 * Centralized native fetch client with automatic JSON parsing and Bearer token authorization.
 */

export const TOKEN_STORAGE_KEY = 'second_brain_token';

interface GlobalStorageHolder {
  localStorage?: Storage;
  Headers?: typeof Headers;
  fetch?: typeof fetch;
}

export function getStoredToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  }
  const globalObj = globalThis as unknown as GlobalStorageHolder;
  if (globalObj.localStorage) {
    return globalObj.localStorage.getItem(TOKEN_STORAGE_KEY);
  }
  return null;
}

export function setStoredToken(token: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    return;
  }
  const globalObj = globalThis as unknown as GlobalStorageHolder;
  if (globalObj.localStorage) {
    globalObj.localStorage.setItem(TOKEN_STORAGE_KEY, token);
  }
}

export function removeStoredToken(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    return;
  }
  const globalObj = globalThis as unknown as GlobalStorageHolder;
  if (globalObj.localStorage) {
    globalObj.localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

export class ApiClientError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.data = data;
  }
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = (
      baseUrl ||
      process.env.NEXT_PUBLIC_API_URL ||
      'http://127.0.0.1:8000'
    ).replace(/\/+$/, '');
  }

  private getHeaders(customHeaders?: HeadersInit, isFormData = false): Headers {
    const globalObj = globalThis as unknown as GlobalStorageHolder;
    const HeadersClass = typeof Headers !== 'undefined' ? Headers : (globalObj.Headers || Headers);
    const headers = new HeadersClass(customHeaders);
    if (!isFormData && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    const token = getStoredToken();
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${this.baseUrl}${cleanEndpoint}`;
    const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;

    const config: RequestInit = {
      ...options,
      headers: this.getHeaders(options.headers, isFormData),
    };

    const globalObj = globalThis as unknown as GlobalStorageHolder;
    const fetchFn = typeof fetch !== 'undefined' ? fetch : (globalObj.fetch || fetch);
    const response = await fetchFn(url, config);

    if (!response.ok) {
      let errorData: Record<string, unknown> | null = null;
      let errorMessage = `HTTP error ${response.status}: ${response.statusText}`;

      try {
        errorData = await response.json();
        if (errorData && typeof errorData.detail === 'string') {
          errorMessage = errorData.detail;
        } else if (errorData && typeof errorData.message === 'string') {
          errorMessage = errorData.message;
        }
      } catch {
        // Fallback to default status text if not JSON
      }

      throw new ApiClientError(errorMessage, response.status, errorData);
    }

    if (response.status === 204) {
      return null as T;
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return (await response.json()) as T;
    }

    return (await response.text()) as unknown as T;
  }

  get<T>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  post<T>(endpoint: string, body?: unknown, options?: RequestInit): Promise<T> {
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: isFormData ? (body as FormData) : (body !== undefined ? JSON.stringify(body) : undefined),
    });
  }

  put<T>(endpoint: string, body?: unknown, options?: RequestInit): Promise<T> {
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: isFormData ? (body as FormData) : (body !== undefined ? JSON.stringify(body) : undefined),
    });
  }

  patch<T>(endpoint: string, body?: unknown, options?: RequestInit): Promise<T> {
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: isFormData ? (body as FormData) : (body !== undefined ? JSON.stringify(body) : undefined),
    });
  }

  delete<T>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();
