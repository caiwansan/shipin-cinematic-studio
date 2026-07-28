import { getAuthToken } from '~/utils/auth/token'
/**
 * useEnterpriseAgents — AI 员工数据获取 Composable
 * Sprint 4.2.9 Phase 2
 *
 * 数据来源：/api/enterprise/agent-identity/*
 */

import { ref } from 'vue'

const API_BASE = '/api/enterprise/agent-identity'

export function useEnterpriseAgents() {
  const loading = ref(false)
  const error = ref(null)

  async function fetchJSON(path) {
    const token = getAuthToken() || ''
    const res = await fetch(`${API_BASE}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!res.ok) throw new Error(`API ${res.status}: ${path}`)
    const json = await res.json()
    return json.data
  }

  /**
   * 获取企业所有 AI 员工（含运行时身份）
   */
  async function fetchAgentList(tenantId) {
    loading.value = true
    error.value = null
    try {
      // Step 1: 获取 employee profiles
      const employeesRes = await fetch(`/api/enterprise/agent-profiles`, {
        headers: { Authorization: `Bearer ${getAuthToken() || ''}` },
      })
      const employees = employeesRes.ok ? (await employeesRes.json()).data || [] : []

      // Step 2: 获取每个 employee 的 health + instance
      const agents = await Promise.all(
        employees.map(async (emp) => {
          try {
            const health = await fetchJSON(`/employees/${emp.id}/health`)
            return { ...emp, ...health.data }
          } catch {
            return emp
          }
        })
      )
      return agents
    } catch (e) {
      error.value = e.message
      return []
    } finally {
      loading.value = false
    }
  }

  /**
   * 获取 AI 员工完整详情
   */
  async function fetchAgentDetail(employeeId) {
    loading.value = true
    error.value = null
    try {
      return await fetchJSON(`/employees/${employeeId}/full`)
    } catch (e) {
      error.value = e.message
      return null
    } finally {
      loading.value = false
    }
  }

  /**
   * 获取任务时间线
   */
  async function fetchTaskTimeline(instanceId, limit = 20) {
    return await fetchJSON(`/instances/${instanceId}/tasks?limit=${limit}`)
  }

  /**
   * 暂停/恢复 Agent
   */
  async function toggleAgent(instanceId, status) {
    const token = getAuthToken() || ''
    const res = await fetch(`${API_BASE}/instances/${instanceId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status }),
    })
    if (!res.ok) throw new Error(`API ${res.status}`)
    return await res.json()
  }

  return {
    loading,
    error,
    fetchAgentList,
    fetchAgentDetail,
    fetchTaskTimeline,
    toggleAgent,
  }
}
