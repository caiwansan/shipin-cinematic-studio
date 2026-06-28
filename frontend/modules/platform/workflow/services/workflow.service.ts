// ============================================================
// Frontend Workflow Service (KMKI-PLAT-011)
// HTTP client for Workflow Runtime API
// ============================================================

import type {
  WorkflowDefinition,
  WorkflowInstance,
  InstanceDetail,
  WorkflowCheckpoint,
  WorkflowTemplate,
  HumanResponsePayload,
} from '../types/index.js'

const API_BASE = '/api/platform/workflow'

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `HTTP ${res.status}: ${res.statusText}`)
  }

  const body = await res.json()
  return body.data ?? body
}

async function requestRaw<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `HTTP ${res.status}: ${res.statusText}`)
  }

  return res.json() as Promise<T>
}

export class WorkflowService {
  // ─── Definitions ───

  async listDefinitions(filter?: { status?: string; category?: string }): Promise<WorkflowDefinition[]> {
    const params = new URLSearchParams()
    if (filter?.status) params.set('status', filter.status)
    if (filter?.category) params.set('category', filter.category)
    const qs = params.toString()
    return request<WorkflowDefinition[]>(`/definitions${qs ? `?${qs}` : ''}`)
  }

  async getDefinition(idOrCode: string): Promise<WorkflowDefinition> {
    return request<WorkflowDefinition>(`/definitions/${idOrCode}`)
  }

  async createDefinition(data: WorkflowDefinition): Promise<WorkflowDefinition> {
    return request<WorkflowDefinition>('/definitions', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateDefinition(id: string, data: Partial<WorkflowDefinition>): Promise<WorkflowDefinition> {
    return request<WorkflowDefinition>(`/definitions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteDefinition(id: string): Promise<void> {
    await request<void>(`/definitions/${id}`, { method: 'DELETE' })
  }

  // ─── Instances ───

  async listInstances(filter?: { workflowId?: string; workspaceId?: string; status?: string }): Promise<WorkflowInstance[]> {
    const params = new URLSearchParams()
    if (filter?.workflowId) params.set('workflowId', filter.workflowId)
    if (filter?.workspaceId) params.set('workspaceId', filter.workspaceId)
    if (filter?.status) params.set('status', filter.status)
    const qs = params.toString()
    return request<WorkflowInstance[]>(`/instances${qs ? `?${qs}` : ''}`)
  }

  async getInstance(id: string): Promise<WorkflowInstance> {
    return request<WorkflowInstance>(`/instances/${id}`)
  }

  async describeInstance(id: string): Promise<InstanceDetail> {
    return request<InstanceDetail>(`/instances/${id}/describe`)
  }

  async createInstance(workflowCode: string, workspaceId: string, input?: Record<string, any>): Promise<WorkflowInstance> {
    return request<WorkflowInstance>('/instances', {
      method: 'POST',
      body: JSON.stringify({ workflowCode, workspaceId, input }),
    })
  }

  // ─── Execution ───

  async execute(instanceId: string): Promise<WorkflowInstance> {
    return request<WorkflowInstance>(`/executions/${instanceId}/execute`, { method: 'POST' })
  }

  async pause(instanceId: string): Promise<WorkflowInstance> {
    return request<WorkflowInstance>(`/executions/${instanceId}/pause`, { method: 'POST' })
  }

  async resume(instanceId: string): Promise<WorkflowInstance> {
    return request<WorkflowInstance>(`/executions/${instanceId}/resume`, { method: 'POST' })
  }

  async cancel(instanceId: string): Promise<WorkflowInstance> {
    return request<WorkflowInstance>(`/executions/${instanceId}/cancel`, { method: 'POST' })
  }

  async replay(instanceId: string, options?: { fromNode?: string; failedOnly?: boolean }): Promise<WorkflowInstance> {
    if (options?.fromNode) {
      return request<WorkflowInstance>(`/replays/${instanceId}/from-node/${options.fromNode}`, { method: 'POST' })
    }
    if (options?.failedOnly) {
      return request<WorkflowInstance>(`/replays/${instanceId}/failed`, { method: 'POST' })
    }
    return request<WorkflowInstance>(`/replays/${instanceId}/full`, { method: 'POST' })
  }

  // ─── Checkpoints ───

  async saveCheckpoint(instanceId: string, nodeId: string): Promise<WorkflowCheckpoint> {
    return request<WorkflowCheckpoint>(`/checkpoints/${instanceId}/save`, {
      method: 'POST',
      body: JSON.stringify({ nodeId }),
    })
  }

  async listCheckpoints(instanceId: string): Promise<WorkflowCheckpoint[]> {
    return request<WorkflowCheckpoint[]>(`/checkpoints/${instanceId}`)
  }

  // ─── Templates ───

  async listTemplates(category?: string): Promise<WorkflowTemplate[]> {
    const qs = category ? `?category=${category}` : ''
    return request<WorkflowTemplate[]>(`/templates${qs}`)
  }

  async createTemplate(data: WorkflowTemplate): Promise<WorkflowTemplate> {
    return request<WorkflowTemplate>('/templates', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  // ─── Human Response ───

  async submitHumanResponse(instanceId: string, nodeType: string, action: string, data?: Record<string, any>): Promise<void> {
    await request<void>(`/human/${instanceId}/respond`, {
      method: 'POST',
      body: JSON.stringify({ nodeType, action, data }),
    })
  }

  async approve(instanceId: string, data?: Record<string, any>): Promise<void> {
    await request<void>(`/human/${instanceId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ data }),
    })
  }

  async reject(instanceId: string, data?: Record<string, any>): Promise<void> {
    await request<void>(`/human/${instanceId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ data }),
    })
  }

  // ─── Health ───

  async health(): Promise<any> {
    return requestRaw<any>(`/api/platform/workflow/health`)
  }
}

export const workflowService = new WorkflowService()
