/**
 * GEO Discovery Store — Pinia Store
 *
 * P0-T005 — AI Discovery Lab MVP
 * P0-T006 — Opportunity Engine (First Edition) — 扩展机会分类
 * P0-T007 — Action Plan Engine — 新增 Action Plan 状态管理
 *
 * Manages discovery report state for the Discovery Lab page.
 * Action Plan status is managed in local state (no DB).
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { fetchDiscoveryReport, fetchActionPlans } from '../services/discoveryService'
import type { DiscoveryReport, DiscoveryScenario, DiscoveryOpportunity, ActionPlanItem } from '../services/discoveryService'

export const useDiscoveryStore = defineStore('geo-discovery', () => {
  const report = ref<DiscoveryReport | null>(null)
  const actionPlans = ref<ActionPlanItem[]>([])
  const isLoading = ref(false)
  const isActionPlansLoading = ref(false)
  const error = ref<string | null>(null)

  // ── Local state for Action Plan status & step progress ──
  // Map: planId → status
  const actionPlanStatuses = ref<Record<string, 'pending' | 'completed' | 'skipped' | 'later'>>({})
  // Map: planId → checked step IDs
  const actionPlanCheckedSteps = ref<Record<string, string[]>>({})

  const hasData = computed(() => report.value !== null)

  const highPriorityOpportunities = computed(() =>
    report.value?.opportunities.filter((o) => o.priority === 'high') ?? []
  )

  const mediumPriorityOpportunities = computed(() =>
    report.value?.opportunities.filter((o) => o.priority === 'medium') ?? []
  )

  const lowPriorityOpportunities = computed(() =>
    report.value?.opportunities.filter((o) => o.priority === 'low') ?? []
  )

  const coveredScenarios = computed(() =>
    report.value?.scenarios.filter((s) => s.entityCoverage) ?? []
  )

  const uncoveredScenarios = computed(() =>
    report.value?.scenarios.filter((s) => !s.entityCoverage) ?? []
  )

  const topScenarios = computed(() =>
    [...(report.value?.scenarios ?? [])]
      .sort((a, b) => b.coverageScore - a.coverageScore)
      .slice(0, 5)
  )

  const bottomScenarios = computed(() =>
    [...(report.value?.scenarios ?? [])]
      .sort((a, b) => a.coverageScore - b.coverageScore)
      .slice(0, 5)
  )

  const totalActionPlanImpact = computed(() =>
    actionPlans.value.reduce((sum, ap) => sum + ap.estimatedImpact, 0)
  )

  async function evaluateEntity(entity: string): Promise<void> {
    if (!entity || entity.trim().length === 0) {
      error.value = '请输入实体名称'
      return
    }

    isLoading.value = true
    error.value = null
    report.value = null
    actionPlans.value = []
    actionPlanStatuses.value = {}
    actionPlanCheckedSteps.value = {}

    try {
      const result = await fetchDiscoveryReport(entity.trim())
      report.value = result

      // Also fetch action plans
      await loadActionPlans(entity.trim())
    } catch (err: any) {
      if (err?.response?.status === 400) {
        error.value = '请输入有效的实体名称'
      } else {
        error.value = err instanceof Error ? err.message : '发现评估失败，请稍后重试'
      }
    } finally {
      isLoading.value = false
    }
  }

  async function loadActionPlans(entity: string): Promise<void> {
    isActionPlansLoading.value = true
    try {
      const plans = await fetchActionPlans(entity)
      actionPlans.value = plans

      // Initialize statuses for new plans
      for (const plan of plans) {
        if (!(plan.id in actionPlanStatuses.value)) {
          actionPlanStatuses.value[plan.id] = 'pending'
        }
        if (!(plan.id in actionPlanCheckedSteps.value)) {
          actionPlanCheckedSteps.value[plan.id] = []
        }
      }
    } catch (err: any) {
      // Action plan loading failure is non-critical
      console.warn('Failed to load action plans:', err)
    } finally {
      isActionPlansLoading.value = false
    }
  }

  function updateActionPlanStatus(planId: string, newStatus: 'pending' | 'completed' | 'skipped' | 'later') {
    actionPlanStatuses.value[planId] = newStatus
  }

  function updateActionPlanCheckedSteps(planId: string, checkedSteps: string[]) {
    actionPlanCheckedSteps.value[planId] = checkedSteps
  }

  function reset() {
    report.value = null
    actionPlans.value = []
    actionPlanStatuses.value = {}
    actionPlanCheckedSteps.value = {}
    isLoading.value = false
    isActionPlansLoading.value = false
    error.value = null
  }

  return {
    report, actionPlans, isLoading, isActionPlansLoading, error, hasData,
    actionPlanStatuses, actionPlanCheckedSteps,
    highPriorityOpportunities, mediumPriorityOpportunities, lowPriorityOpportunities,
    coveredScenarios, uncoveredScenarios,
    topScenarios, bottomScenarios,
    totalActionPlanImpact,
    evaluateEntity, loadActionPlans,
    updateActionPlanStatus, updateActionPlanCheckedSteps,
    reset,
  }
})
