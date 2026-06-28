// ============================================================
// Frontend Agent Service — KMKI-PLAT-010
// ============================================================

import type {
  AgentDefinition,
  AgentSession,
  DispatchResult,
  AgentMemoryItem,
  AgentSchedulePlan,
} from '../types/index'

const API_BASE = '/api/platform'

async function request(path: string, options?: RequestInit): Promise<any> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  const json = await response.json()
  if (!json.success) {
    throw new Error(json.error || 'Request failed')
  }
  return json.data
}

export const agentService = {
  // ─── Agent CRUD ───

  async listAgents(): Promise<AgentDefinition[]> {
    return request('/agents')
  },

  async getAgent(code: string): Promise<AgentDefinition> {
    return request(`/agents/${code}`)
  },

  async registerAgent(definition: Partial<AgentDefinition>): Promise<AgentDefinition> {
    return request('/agents', {
      method: 'POST',
      body: JSON.stringify(definition),
    })
  },

  async unregisterAgent(code: string): Promise<void> {
    return request(`/agents/${code}`, { method: 'DELETE' })
  },

  async executeAgent(code: string, input: any): Promise<DispatchResult> {
    return request(`/agents/${code}/execute`, {
      method: 'POST',
      body: JSON.stringify({ input }),
    })
  },

  // ─── Sessions ───

  async listSessions(filter?: { status?: string; agentCode?: string }): Promise<AgentSession[]> {
    const params = new URLSearchParams()
    if (filter?.status) params.set('status', filter.status)
    if (filter?.agentCode) params.set('agentCode', filter.agentCode)
    const qs = params.toString()
    return request(`/agent-sessions${qs ? `?${qs}` : ''}`)
  },

  async getSession(id: string): Promise<AgentSession> {
    return request(`/agent-sessions/${id}`)
  },

  // ─── Dispatch ───

  async dispatch(agentCode: string, input: any): Promise<DispatchResult> {
    return request('/agent-dispatch', {
      method: 'POST',
      body: JSON.stringify({ agentCode, input }),
    })
  },

  async dispatchMultiple(agents: Array<{ code: string; input: any; dependsOn?: string[] }>): Promise<DispatchResult[]> {
    return request('/agent-dispatch/multiple', {
      method: 'POST',
      body: JSON.stringify({ agents }),
    })
  },

  // ─── Schedule ───

  async schedule(plan: AgentSchedulePlan): Promise<any> {
    return request('/agent-schedule', {
      method: 'POST',
      body: JSON.stringify(plan),
    })
  },

  async listSchedules(): Promise<any[]> {
    return request('/agent-schedule')
  },

  async cancelSchedule(id: string): Promise<void> {
    return request(`/agent-schedule/${id}/cancel`, { method: 'POST' })
  },

  // ─── Memory ───

  async storeMemory(sessionId: string, type: string, content: any): Promise<void> {
    return request('/agent-memory', {
      method: 'POST',
      body: JSON.stringify({ sessionId, type, content }),
    })
  },

  async retrieveMemory(sessionId: string, type?: string): Promise<AgentMemoryItem[]> {
    const params = new URLSearchParams({ sessionId })
    if (type) params.set('type', type)
    return request(`/agent-memory?${params}`)
  },

  async summarizeMemory(sessionId: string): Promise<string> {
    const data = await request(`/agent-memory/${sessionId}/summary`)
    return data.summary
  },
}
