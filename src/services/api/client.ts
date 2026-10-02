/**
 * Second Brain API Client
 * Centralized native fetch client with automatic JSON parsing and Bearer token authorization.
 */

export const TOKEN_STORAGE_KEY = 'second_brain_token';

export function getStoredToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  }
  if (typeof globalThis !== 'undefined' && (globalThis as any).localStorage) {
    return (globalThis as any).localStorage.getItem(TOKEN_STORAGE_KEY);
  }
  return null;
}

export function setStoredToken(token: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    return;
  }
  if (typeof globalThis !== 'undefined' && (globalThis as any).localStorage) {
    (globalThis as any).localStorage.setItem(TOKEN_STORAGE_KEY, token);
  }
}

export function removeStoredToken(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    return;
  }
  if (typeof globalThis !== 'undefined' && (globalThis as any).localStorage) {
    (globalThis as any).localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

export class ApiClientError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number, data?: any) {
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
    const HeadersClass = typeof Headers !== 'undefined' ? Headers : (globalThis as any).Headers;
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

    const fetchFn = typeof fetch !== 'undefined' ? fetch : (globalThis as any).fetch;
    const response = await fetchFn(url, config);

    if (!response.ok) {
      let errorData: any = null;
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

  post<T>(endpoint: string, body?: any, options?: RequestInit): Promise<T> {
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: isFormData ? body : (body !== undefined ? JSON.stringify(body) : undefined),
    });
  }

  put<T>(endpoint: string, body?: any, options?: RequestInit): Promise<T> {
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: isFormData ? body : (body !== undefined ? JSON.stringify(body) : undefined),
    });
  }

  patch<T>(endpoint: string, body?: any, options?: RequestInit): Promise<T> {
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: isFormData ? body : (body !== undefined ? JSON.stringify(body) : undefined),
    });
  }

  delete<T>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();
