/**
 * GEOApiClient — Shared HTTP client for GEO workspace services.
 *
 * Wraps fetch with the standard ApiResponse envelope expected by all
 * GEO backend routes. All GEO services use this client instead of
 * calling fetch() directly.
 *
 * @package workspace/geo/services
 */

import type { ApiResponse } from '@studio/platform';

/**
 * GET / POST / PUT / DELETE client for GEO backend routes.
 */
export class GEOApiClient {
  private baseUrl: string;

  constructor(baseUrl = '/api/v1/geo') {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  /**
   * Perform a GET request.
   */
  async get<T>(path: string): Promise<ApiResponse<T>> {
    return this.request<T>('GET', path);
  }

  /**
   * Perform a POST request.
   */
  async post<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>('POST', path, body);
  }

  /**
   * Perform a PUT request.
   */
  async put<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>('PUT', path, body);
  }

  /**
   * Perform a PATCH request.
   */
  async patch<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>('PATCH', path, body);
  }

  /**
   * Perform a DELETE request.
   */
  async delete<T = void>(path: string): Promise<ApiResponse<T>> {
    return this.request<T>('DELETE', path);
  }

  /**
   * Core request handler.
   */
  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${path}`;
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (body !== undefined && method !== 'GET' && method !== 'DELETE') {
      options.body = JSON.stringify(body);
    }

    try {
      const res = await fetch(url, options);
      const json: ApiResponse<T> = await res.json();
      return json;
    } catch (err) {
      console.error(`[GEOApiClient] ${method} ${path} failed:`, err);
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: err instanceof Error ? err.message : 'Network request failed',
        },
        traceId: '',
        timestamp: new Date().toISOString(),
        version: '1.0',
      };
    }
  }
}
