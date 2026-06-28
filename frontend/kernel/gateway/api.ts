// ============================================================================
// 盘古斧 AI OS — Phase 7A Gateway Bridge
// 前端 API 桥接层：封装后端所有 Gateway 调用
// ============================================================================

const API_BASE = '/api'

interface ApiOptions {
  method?: string
  body?: any
  headers?: Record<string, string>
}

async function request(path: string, opts: ApiOptions = {}) {
  const { method = 'GET', body, headers = {} } = opts
  const config: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  }
  if (body && method !== 'GET') {
    config.body = JSON.stringify(body)
  }

  const res = await fetch(`${API_BASE}${path}`, config)
  if (!res.ok) {
    throw new Error(`Gateway API error: ${res.status} ${res.statusText}`)
  }
  return res.json()
}

// ── 公有 API ─────────────────────────────────────────────────────────────

export const gatewayAPI = {
  // Execution
  execute: (dagId: string, input: any, seed?: string) =>
    request('/execute', { method: 'POST', body: { dagId, input, seed } }),

  getExecution: (id: string) =>
    request(`/execute/${id}`),

  // DAG
  getDAG: (id: string) =>
    request(`/dag/${id}`),

  createDAG: (dag: any) =>
    request('/dag', { method: 'POST', body: dag }),

  // Trace & Replay
  getTrace: (id: string) =>
    request(`/trace/${id}`),

  triggerReplay: (executionId: string, seed?: string) =>
    request('/replay', { method: 'POST', body: { executionId, seed } }),

  // Repair
  triggerRepair: (issue: string, nodeId?: string, autoApprove?: boolean) =>
    request('/repair', { method: 'POST', body: { issue, nodeId, autoApprove } }),

  // Health
  getHealth: () =>
    request('/health'),

  // Admin
  getUsers: () =>
    request('/admin/users'),

  getAgents: () =>
    request('/admin/agents'),

  getGovernanceRules: () =>
    request('/admin/governance/rules'),

  getAuditLogs: () =>
    request('/admin/audit/logs'),
}

export default gatewayAPI
