// ============================================================
// Execution Service — frontend API calls to backend execution endpoints
// ============================================================

import type { ExecutionPlan, ExecutionResult, ExecutionHistoryRecord, ExecutionDashboard } from '../types/index.js'

const BASE_URL = '/api/platform/execution'

export const executionApiService = {
  /**
   * Execute a capability from its contract.
   */
  async executeFromContract(capabilityId: string, contract: any): Promise<ExecutionResult> {
    const res = await fetch(`${BASE_URL}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ capabilityId, contract }),
    })
    const json = await res.json()
    if (!json.success) throw new Error(json.error)
    return json.data
  },

  /**
   * Execute a compiled plan.
   */
  async executePlan(plan: ExecutionPlan): Promise<ExecutionResult> {
    return this.executeFromContract(plan.capabilityId, {
      id: plan.capabilityId,
      name: plan.capabilityId,
      displayName: plan.metadata?.contractDisplayName || plan.capabilityId,
      description: null,
      category: plan.metadata?.category || 'general',
      version: plan.version,
      status: 'active',
      steps: plan.steps,
    })
  },

  /**
   * Compile a contract without executing.
   */
  async compileContract(contract: any): Promise<{ plan: ExecutionPlan; warnings: string[]; compiledAt: string }> {
    const res = await fetch(`${BASE_URL}/compile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contract }),
    })
    const json = await res.json()
    if (!json.success) throw new Error(json.error)
    return json.data
  },

  /**
   * Validate a plan without executing.
   */
  async validatePlan(plan: ExecutionPlan): Promise<{ valid: boolean; errors: string[]; warnings: string[] }> {
    const res = await fetch(`${BASE_URL}/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan }),
    })
    const json = await res.json()
    return json.data
  },

  /**
   * Get a plan by ID.
   */
  async getPlan(planId: string): Promise<ExecutionPlan | null> {
    const res = await fetch(`${BASE_URL}/plans/${planId}`)
    const json = await res.json()
    return json.success ? json.data : null
  },

  /**
   * List plans.
   */
  async listPlans(params?: { capabilityId?: string; page?: number; pageSize?: number }): Promise<{ items: ExecutionPlan[]; total: number }> {
    const query = new URLSearchParams()
    if (params?.capabilityId) query.set('capabilityId', params.capabilityId)
    if (params?.page) query.set('page', String(params.page))
    if (params?.pageSize) query.set('pageSize', String(params.pageSize))

    const res = await fetch(`${BASE_URL}/plans?${query}`)
    const json = await res.json()
    return json.success ? json.data : { items: [], total: 0 }
  },

  /**
   * Delete a plan.
   */
  async deletePlan(planId: string): Promise<boolean> {
    const res = await fetch(`${BASE_URL}/plans/${planId}`, { method: 'DELETE' })
    const json = await res.json()
    return json.success
  },

  /**
   * Get execution history.
   */
  async getHistory(params?: { capabilityId?: string; status?: string; limit?: number }): Promise<{ items: ExecutionHistoryRecord[]; total: number }> {
    const query = new URLSearchParams()
    if (params?.capabilityId) query.set('capabilityId', params.capabilityId)
    if (params?.status) query.set('status', params.status)
    if (params?.limit) query.set('limit', String(params.limit))

    const res = await fetch(`${BASE_URL}/history?${query}`)
    const json = await res.json()
    return json.success ? json.data : { items: [], total: 0 }
  },

  /**
   * Get metrics.
   */
  async getMetrics(capabilityId?: string): Promise<any> {
    const query = capabilityId ? `?capabilityId=${capabilityId}` : ''
    const res = await fetch(`${BASE_URL}/metrics${query}`)
    const json = await res.json()
    return json.success ? json.data : null
  },

  /**
   * Get execution dashboard.
   */
  async getDashboard(): Promise<ExecutionDashboard | null> {
    const [metricsRes, historyRes, plansRes] = await Promise.all([
      fetch(`${BASE_URL}/metrics`),
      fetch(`${BASE_URL}/history?limit=10`),
      fetch(`${BASE_URL}/plans`),
    ])

    const metrics = await metricsRes.json()
    const history = await historyRes.json()
    const plans = await plansRes.json()

    return {
      globalMetrics: metrics.success ? metrics.data : null,
      strategyMetrics: {},
      recentExecutions: history.success ? history.data.items : [],
      totalPlans: plans.success ? plans.data.total : 0,
    }
  },
}
