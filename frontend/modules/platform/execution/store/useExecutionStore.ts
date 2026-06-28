// ============================================================
// Execution Store — Pinia store for execution state management
// ============================================================

import { defineStore } from 'pinia'
import type { ExecutionPlan, ExecutionResult, ExecutionHistoryRecord, ExecutionDashboard } from '../types/index.js'

interface ExecutionState {
  // Current execution
  currentPlan: ExecutionPlan | null
  currentResult: ExecutionResult | null
  isExecuting: boolean
  executionError: string | null

  // Plans
  plans: ExecutionPlan[]
  plansTotal: number
  plansLoading: boolean

  // History
  history: ExecutionHistoryRecord[]
  historyLoading: boolean

  // Dashboard
  dashboard: ExecutionDashboard | null
  dashboardLoading: boolean
}

export const useExecutionStore = defineStore('execution', {
  state: (): ExecutionState => ({
    currentPlan: null,
    currentResult: null,
    isExecuting: false,
    executionError: null,

    plans: [],
    plansTotal: 0,
    plansLoading: false,

    history: [],
    historyLoading: false,

    dashboard: null,
    dashboardLoading: false,
  }),

  getters: {
    hasActiveExecution: (state) => state.isExecuting,
    completedSteps: (state) =>
      state.currentResult?.stepResults.filter(r => r.status === 'completed').length || 0,
    totalSteps: (state) =>
      state.currentResult?.stepResults.length || state.currentPlan?.steps.length || 0,
    progressPercent: (state): number => {
      const total = state.currentPlan?.steps.length || 1
      const completed = state.currentResult?.stepResults.filter(r =>
        r.status === 'completed' || r.status === 'failed' || r.status === 'skipped'
      ).length || 0
      return Math.round((completed / total) * 100)
    },
    recentFailures: (state): ExecutionHistoryRecord[] =>
      state.history.filter(r => r.status === 'failed').slice(0, 10),
  },

  actions: {
    async fetchPlans(params?: { capabilityId?: string; page?: number; pageSize?: number }) {
      this.plansLoading = true
      try {
        const query = new URLSearchParams()
        if (params?.capabilityId) query.set('capabilityId', params.capabilityId)
        if (params?.page) query.set('page', String(params.page))
        if (params?.pageSize) query.set('pageSize', String(params.pageSize))

        const res = await fetch(`/api/platform/execution/plans?${query}`)
        const json = await res.json()
        if (json.success) {
          this.plans = json.data.items
          this.plansTotal = json.data.total
        }
      } catch (err) {
        console.error('[ExecutionStore] Failed to fetch plans:', err)
      } finally {
        this.plansLoading = false
      }
    },

    async fetchHistory(params?: { capabilityId?: string; status?: string }) {
      this.historyLoading = true
      try {
        const query = new URLSearchParams()
        if (params?.capabilityId) query.set('capabilityId', params.capabilityId)
        if (params?.status) query.set('status', params.status)

        const res = await fetch(`/api/platform/execution/history?${query}`)
        const json = await res.json()
        if (json.success) {
          this.history = json.data.items
        }
      } catch (err) {
        console.error('[ExecutionStore] Failed to fetch history:', err)
      } finally {
        this.historyLoading = false
      }
    },

    async fetchDashboard() {
      this.dashboardLoading = true
      try {
        const [metricsRes, historyRes, plansRes] = await Promise.all([
          fetch('/api/platform/execution/metrics'),
          fetch('/api/platform/execution/history?limit=10'),
          fetch('/api/platform/execution/plans'),
        ])

        const metrics = await metricsRes.json()
        const history = await historyRes.json()
        const plans = await plansRes.json()

        this.dashboard = {
          globalMetrics: metrics.success ? metrics.data : {
            totalExecutions: 0, successfulExecutions: 0, failedExecutions: 0,
            cancelledExecutions: 0, averageDurationMs: 0, totalCost: 0, totalRetries: 0,
          },
          strategyMetrics: {},
          recentExecutions: history.success ? history.data.items : [],
          totalPlans: plans.success ? plans.data.total : 0,
        }
      } catch (err) {
        console.error('[ExecutionStore] Failed to fetch dashboard:', err)
      } finally {
        this.dashboardLoading = false
      }
    },

    async executePlan(plan: ExecutionPlan) {
      this.isExecuting = true
      this.currentPlan = plan
      this.currentResult = null
      this.executionError = null

      try {
        const res = await fetch('/api/platform/execution/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            capabilityId: plan.capabilityId,
            contract: {
              id: plan.capabilityId,
              name: plan.capabilityId,
              displayName: plan.metadata?.contractDisplayName || plan.capabilityId,
              description: plan.metadata?.contractDescription || null,
              category: plan.metadata?.category || 'general',
              version: plan.version,
              status: 'active',
              steps: plan.steps,
            },
          }),
        })

        const json = await res.json()
        if (json.success) {
          this.currentResult = json.data
        } else {
          this.executionError = json.error
        }
      } catch (err) {
        this.executionError = (err as Error).message
      } finally {
        this.isExecuting = false
      }
    },

    clearCurrent() {
      this.currentPlan = null
      this.currentResult = null
      this.isExecuting = false
      this.executionError = null
    },
  },
})
