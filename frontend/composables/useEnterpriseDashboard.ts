import { getAuthToken } from '~/utils/auth/token'
/**
 * useEnterpriseDashboard — CEO Dashboard data fetching
 * Phase 3.3 — P0-1: Connect dashboard to real backend API
 */
import { ref } from 'vue'

const API_BASE = '/api/enterprise'

export function useEnterpriseDashboard() {
  const loading = ref(false)
  const error = ref<string | null>(null)
  const data = ref<any>(null)

  async function fetchDashboard(tenantId: string) {
    loading.value = true
    error.value = null
    try {
      const token = getAuthToken() || ''
      const res = await fetch(`${API_BASE}/${tenantId}/dashboard`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) throw new Error(`API ${res.status}: dashboard`)
      const json = await res.json()
      // Handle both { code: 0, data: ... } and direct data
      data.value = json.data || json
      return data.value
    } catch (e: any) {
      error.value = e.message
      return null
    } finally {
      loading.value = false
    }
  }

  async function fetchAIOverview(tenantId: string) {
    try {
      const token = getAuthToken() || ''
      const res = await fetch(`${API_BASE}/${tenantId}/ai-department/overview`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) throw new Error(`API ${res.status}`)
      const json = await res.json()
      return json.data
    } catch {
      return null
    }
  }

  return { loading, error, data, fetchDashboard, fetchAIOverview }
}
