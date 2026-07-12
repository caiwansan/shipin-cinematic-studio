/**
 * GEO Workspace API — Authenticated ofetch instance
 * 
 * ofetch.create() returns a callable function, not an object with .get() methods.
 * We wrap it to provide both direct call and .get() convenience for compatibility.
 */
import { ofetch } from 'ofetch'

const API_BASE = '/api/geo'

function getAuthHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  const token = window.localStorage?.getItem('auth_token') || ''
  return token ? { Authorization: `Bearer ${token}` } : {}
}

const fetcher = ofetch.create({
  baseURL: API_BASE,
  onRequest({ options }) {
    const headers = getAuthHeaders()
    if (headers.Authorization) {
      options.headers = { ...options.headers, ...headers }
    }
  },
})

// Direct call (old services use geoApi<T>(url))
function callApi<T = any>(url: string, opts?: any): Promise<T> {
  return fetcher(url, opts)
}

// .get() / .post() convenience (new services use geoApi.get<T>(url))
const apiMethods = {
  get<T = any>(url: string): Promise<{ data: T }> {
    return fetcher(url).then((data: T) => ({ data }))
  },
  post<T = any>(url: string, body?: any): Promise<{ data: T }> {
    return fetcher(url, { method: 'POST', body }).then((data: T) => ({ data }))
  },
  put<T = any>(url: string, body?: any): Promise<{ data: T }> {
    return fetcher(url, { method: 'PUT', body }).then((data: T) => ({ data }))
  },
  delete<T = any>(url: string): Promise<{ data: T }> {
    return fetcher(url, { method: 'DELETE' }).then((data: T) => ({ data }))
  },
}

// Proxy: allows both geoApi<T>(url) and geoApi.get<T>(url)
const geoApi = new Proxy(callApi, {
  get(target, prop, receiver) {
    if (prop in apiMethods) {
      return (apiMethods as any)[prop]
    }
    return Reflect.get(target, prop, receiver)
  }
}) as typeof callApi & typeof apiMethods

export { geoApi }
