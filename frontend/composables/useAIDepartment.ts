import { getAuthToken } from '~/utils/auth/token'
/**
 * useAIDepartment — AI Department Overview data fetching
 * Sprint 4.2.9 Phase 3
 */

import { ref } from 'vue'

const API_BASE = '/api/enterprise'

export function useAIDepartment() {
  const loading = ref(false)
  const error = ref(null)

  async function fetchOverview(tenantId) {
    loading.value = true
    error.value = null
    try {
      const token = getAuthToken() || ''
      const res = await fetch(`${API_BASE}/${tenantId}/ai-department/overview`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) throw new Error(`API ${res.status}: ai-department/overview`)
      const json = await res.json()
      return json.data
    } catch (e) {
      error.value = e.message
      return null
    } finally {
      loading.value = false
    }
  }

  return { loading, error, fetchOverview }
}
