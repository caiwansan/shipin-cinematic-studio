/**
 * GEOApiClient — Shared HTTP client for GEO workspace services.
 *
 * Centralizes all backend communication. All frontend services
 * use this client instead of calling fetch() directly.
 *
 * Backend routes are at /api/geo/* — baseUrl defaults accordingly.
 *
 * @package workspace/brand-geo/clients
 */

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
  traceId?: string;
  timestamp?: string;
  version?: string;
}

/**
 * GET / POST / PUT / PATCH / DELETE client for GEO backend routes.
 */
export class GEOApiClient {
  private baseUrl: string;

  constructor(baseUrl = '/api/geo') {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  /** Perform a GET request. */
  async get<T>(path: string, signal?: AbortSignal): Promise<ApiResponse<T>> {
    return this.request<T>('GET', path, undefined, signal);
  }

  /** Perform a POST request. */
  async post<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>('POST', path, body);
  }

  /** Perform a PUT request. */
  async put<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>('PUT', path, body);
  }

  /** Perform a PATCH request. */
  async patch<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>('PATCH', path, body);
  }

  /** Perform a DELETE request. */
  async delete<T = void>(path: string): Promise<ApiResponse<T>> {
    return this.request<T>('DELETE', path);
  }

  /** Core request handler with auth header injection. */
  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    signal?: AbortSignal,
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };

    // Inject auth token
    const token = this.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const options: RequestInit & { signal?: AbortSignal } = {
      method,
      headers,
      signal,
    };

    if (body !== undefined && method !== 'GET' && method !== 'DELETE') {
      options.body = JSON.stringify(body);
    }

    try {
      const res = await fetch(url, options);
      const json: ApiResponse<T> = await res.json();
      return json;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return {
          success: false,
          error: { code: 'ABORTED', message: 'Request aborted' },
        };
      }
      console.error(`[GEOApiClient] ${method} ${path} failed:`, err);
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: err instanceof Error ? err.message : 'Network request failed',
        },
      };
    }
  }

  private getToken(): string | null {
    try {
      // 1) Check localStorage first
      const ls = window.localStorage;
      for (const key of ['auth_token', 'accessToken', 'token']) {
        const val = ls.getItem(key);
        if (val) return val;
      }
      // 2) Fallback to cookie (for users who logged in before localStorage sync was added)
      const match = document.cookie.match(/(?:^|;\s*)auth_token=([^;]+)/);
      if (match) return match[1];
      return null;
    } catch {
      return null;
    }
  }
}

/** Singleton client instance for use across the GEO workspace */
export const client = new GEOApiClient()
