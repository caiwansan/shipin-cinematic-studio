/**
 * GEO Workspace API — Authenticated ofetch instance
 */
import { ofetch } from 'ofetch'

const API_BASE = '/api/geo'

function getAuthHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  const token = window.localStorage?.getItem('auth_token') || ''
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export const geoApi = ofetch.create({
  baseURL: API_BASE,
  onRequest({ options }) {
    const headers = getAuthHeaders()
    if (headers.Authorization) {
      options.headers = { ...options.headers, ...headers }
    }
  },
})
