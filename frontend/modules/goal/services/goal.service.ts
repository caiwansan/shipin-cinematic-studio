// ============================================================
// Goal Service — API calls to backend
// ============================================================

import type {
  Goal, Strategy, Workflow, WorkflowStage, Task, Action,
  Execution, ExecutionResult, Review, GoalStats, GoalFilter,
  PaginatedResponse,
} from '../types/index'

function apiBase(): string {
  return '/api/goal'
}

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  try {
    const token = window.localStorage.getItem('auth_token') || ''
    if (token) headers['Authorization'] = `Bearer ${token}`
  } catch { /* ignore */ }
  return headers
}

async function apiFetch<T = any>(path: string, options?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(`${apiBase()}${path}`, {
      headers: getAuthHeaders(),
      ...options,
    })
    if (!res.ok) throw new Error(`API error ${res.status}`)
    const json = await res.json()
    return json as T
  } catch (err: any) {
    console.error('[GoalService]', err.message)
    return null
  }
}

export const goalService = {
  // ─── Goals ───

  async listGoals(filter: GoalFilter): Promise<PaginatedResponse<Goal>> {
    const params = new URLSearchParams()
    params.set('projectId', filter.projectId)
    if (filter.status) params.set('status', filter.status)
    if (filter.priority) params.set('priority', String(filter.priority))
    if (filter.search) params.set('search', filter.search)
    if (filter.limit) params.set('limit', String(filter.limit))
    if (filter.offset) params.set('offset', String(filter.offset))
    const result = await apiFetch<{ success: boolean; data: PaginatedResponse<Goal> }>(`?${params.toString()}`)
    return result?.data || { items: [], total: 0 }
  },

  async getGoal(id: string): Promise<Goal | null> {
    const result = await apiFetch<{ success: boolean; data: Goal }>(`/${id}`)
    return result?.data || null
  },

  async createGoal(data: { projectId: string; title: string; description?: string; successCriteria?: string; targetMetric?: string; deadline?: string; priority?: number }): Promise<Goal | null> {
    const result = await apiFetch<{ success: boolean; data: Goal }>('', {
      method: 'POST',
      body: JSON.stringify(data),
    })
    return result?.data || null
  },

  async updateGoal(id: string, data: Partial<Goal>): Promise<Goal | null> {
    const result = await apiFetch<{ success: boolean; data: Goal }>(`/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
    return result?.data || null
  },

  async deleteGoal(id: string): Promise<boolean> {
    const result = await apiFetch<{ success: boolean }>(`/${id}`, { method: 'DELETE' })
    return result?.success || false
  },

  // ─── Strategies ───

  async generateStrategies(goalId: string): Promise<Strategy[]> {
    const result = await apiFetch<{ success: boolean; data: { strategies: Strategy[] } }>(`/strategy/generate/${goalId}`, { method: 'POST' })
    return result?.data?.strategies || []
  },

  async listStrategies(goalId?: string, type?: string, status?: string): Promise<PaginatedResponse<Strategy>> {
    const params = new URLSearchParams()
    if (goalId) params.set('goalId', goalId)
    if (type) params.set('type', type)
    if (status) params.set('status', status)
    const result = await apiFetch<{ success: boolean; data: PaginatedResponse<Strategy> }>(`/strategy?${params.toString()}`)
    return result?.data || { items: [], total: 0 }
  },

  async createStrategy(data: { goalId: string; name: string; type: string; description?: string }): Promise<Strategy | null> {
    const result = await apiFetch<{ success: boolean; data: Strategy }>('/strategy', {
      method: 'POST',
      body: JSON.stringify(data),
    })
    return result?.data || null
  },

  // ─── Workflows ───

  async generateWorkflows(strategyId: string): Promise<Workflow[]> {
    const result = await apiFetch<{ success: boolean; data: { workflows: Array<{ workflow: Workflow; stages: WorkflowStage[] }> } }>(`/workflow/generate/${strategyId}`, { method: 'POST' })
    return (result?.data?.workflows || []).map(w => ({ ...w.workflow, stages: w.stages }))
  },

  async listWorkflows(strategyId: string): Promise<Workflow[]> {
    const result = await apiFetch<{ success: boolean; data: { items: Workflow[] } }>(`/workflow?strategyId=${strategyId}`)
    return result?.data?.items || []
  },

  async getWorkflow(id: string): Promise<{ workflow: Workflow; stages: WorkflowStage[] } | null> {
    const result = await apiFetch<{ success: boolean; data: { workflow: Workflow; stages: WorkflowStage[] } }>(`/workflow/${id}`)
    return result?.data || null
  },

  // ─── Tasks ───

  async generateTasks(strategyId: string, workflowId?: string): Promise<Task[]> {
    let url = `/task/generate/${strategyId}`
    if (workflowId) url += `?workflowId=${workflowId}`
    const result = await apiFetch<{ success: boolean; data: { tasks: Task[] } }>(url, { method: 'POST' })
    return result?.data?.tasks || []
  },

  async listTasks(filter?: { goalId?: string; strategyId?: string; workflowId?: string; status?: string; limit?: number }): Promise<PaginatedResponse<Task>> {
    const params = new URLSearchParams()
    if (filter?.goalId) params.set('goalId', filter.goalId)
    if (filter?.strategyId) params.set('strategyId', filter.strategyId)
    if (filter?.workflowId) params.set('workflowId', filter.workflowId)
    if (filter?.status) params.set('status', filter.status)
    if (filter?.limit) params.set('limit', String(filter.limit))
    const result = await apiFetch<{ success: boolean; data: PaginatedResponse<Task> }>(`/task?${params.toString()}`)
    return result?.data || { items: [], total: 0 }
  },

  async listExecutableTasks(limit = 20): Promise<Task[]> {
    const result = await apiFetch<{ success: boolean; data: { items: Task[] } }>(`/task/executable?limit=${limit}`)
    return result?.data?.items || []
  },

  // ─── Actions ───

  async listActions(): Promise<Action[]> {
    const result = await apiFetch<{ success: boolean; data: { items: Action[] } }>('/action')
    return result?.data?.items || []
  },

  async listRegistryHandlers(): Promise<Array<{ name: string; description: string; provider: string }>> {
    const result = await apiFetch<{ success: boolean; data: { handlers: any[] } }>('/action/registry')
    return result?.data?.handlers || []
  },

  // ─── Executions ───

  async triggerExecution(taskId: string): Promise<{ execution: Execution; results: ExecutionResult[] } | null> {
    const result = await apiFetch<{ success: boolean; data: { execution: Execution; results: ExecutionResult[] } }>(`/execution/trigger/${taskId}`, { method: 'POST' })
    return result?.data || null
  },

  async listExecutions(taskId?: string, status?: string): Promise<PaginatedResponse<Execution>> {
    const params = new URLSearchParams()
    if (taskId) params.set('taskId', taskId)
    if (status) params.set('status', status)
    const result = await apiFetch<{ success: boolean; data: PaginatedResponse<Execution> }>(`/execution?${params.toString()}`)
    return result?.data || { items: [], total: 0 }
  },

  async getExecution(id: string): Promise<{ execution: Execution; results: ExecutionResult[] } | null> {
    const result = await apiFetch<{ success: boolean; data: { execution: Execution; results: ExecutionResult[] } }>(`/execution/${id}`)
    return result?.data || null
  },

  // ─── Reviews ───

  async createReview(executionId: string): Promise<Review | null> {
    const result = await apiFetch<{ success: boolean; data: Review }>('/review', {
      method: 'POST',
      body: JSON.stringify({ executionId }),
    })
    return result?.data || null
  },

  async approveReview(id: string, comments?: string, score?: number): Promise<any> {
    const result = await apiFetch<{ success: boolean; data: any }>(`/review/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ comments, score }),
    })
    return result?.data || null
  },

  async rejectReview(id: string, comments?: string): Promise<any> {
    const result = await apiFetch<{ success: boolean; data: any }>(`/review/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ comments }),
    })
    return result?.data || null
  },

  async listReviews(executionId?: string): Promise<Review[]> {
    const params = executionId ? `?executionId=${executionId}` : ''
    const result = await apiFetch<{ success: boolean; data: { items: Review[] } }>(`/review${params}`)
    return result?.data?.items || []
  },

  // ─── Pipeline ───

  async runPipeline(projectId: string, title: string, options?: { description?: string; successCriteria?: string; targetMetric?: string }): Promise<any> {
    const result = await apiFetch<{ success: boolean; data: any }>('/run', {
      method: 'POST',
      body: JSON.stringify({ projectId, title, ...options }),
    })
    return result?.data || null
  },

  async getGoalStats(projectId: string): Promise<GoalStats | null> {
    const result = await apiFetch<{ success: boolean; data: GoalStats }>(`/stats/${projectId}`)
    return result?.data || null
  },

  async closeGoal(goalId: string): Promise<Goal | null> {
    const result = await apiFetch<{ success: boolean; data: Goal }>(`/${goalId}/close`, { method: 'POST' })
    return result?.data || null
  },
}
