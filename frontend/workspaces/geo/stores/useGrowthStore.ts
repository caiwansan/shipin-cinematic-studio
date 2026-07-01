/**
 * GEO Growth Store — Pinia Store
 *
 * Manages growth/progress data: trend, growthSummary, improvements, milestones, effectiveActions.
 * Fetches from real API endpoint.
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { fetchGrowth } from '../services/growthService'
import type {
  GrowthData,
  GrowthTrend,
  GrowthSummary,
  GrowthImprovement,
  GrowthMilestone,
  EffectiveAction,
  GrowthOpportunity,
} from '../services/growthService'

export const useGrowthStore = defineStore('geo-growth', () => {
  const trend = ref<GrowthTrend>({ current: 0, previous: 0, change: 0, direction: 'stable', history: [] })
  const growthSummary = ref<GrowthSummary>({ direction: 'stable', totalActions: 0, successfulActions: 0, overallChange: 0 })
  const improvements = ref<GrowthImprovement[]>([])
  const milestones = ref<GrowthMilestone[]>([])
  const mostEffectiveActions = ref<EffectiveAction[]>([])
  const opportunity = ref<GrowthOpportunity | null>(null)

  // Backward compatible derived fields
  const direction = computed(() => ({
    beforeScore: trend.value.previous,
    afterScore: trend.value.current,
    delta: trend.value.change,
    period: 'All time',
  }))
  const sources = computed(() =>
    improvements.value.map(imp => ({
      name: imp.action ?? 'Unknown',
      delta: imp.impact ?? '0 pts',
      before: 0,
      after: trend.value.current,
      suffix: undefined as string | undefined,
      learnContent: `${imp.impact} improvement in ${imp.action}` as string | undefined,
    }))
  )
  const learnings = computed(() =>
    mostEffectiveActions.value.map(ea => ({
      action: ea.action ?? 'Optimization',
      impact: ea.impact ?? 0,
    }))
  )
  const trendPoints = computed(() =>
    (trend.value.history ?? []).map(h => h.score ?? 0)
  )

  const isLoading = ref<boolean>(false)
  const error = ref<string | null>(null)
  const projectId = ref<string>('default')

  const hasData = computed(() => trend.value.current > 0 || trend.value.history.length > 0)
  const hasMilestones = computed(() => milestones.value.length > 0)
  const hasOpportunity = computed(() => opportunity.value !== null && opportunity.value.actions.length > 0)

  async function fetchGrowthData(): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      const data = await fetchGrowth(projectId.value)
      trend.value = data.trend
      growthSummary.value = data.growthSummary
      improvements.value = data.improvements
      milestones.value = data.milestones
      mostEffectiveActions.value = data.mostEffectiveActions
      opportunity.value = data.opportunity
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load growth data'
    } finally {
      isLoading.value = false
    }
  }

  function setProject(id: string) {
    projectId.value = id
  }

  return {
    trend, growthSummary, improvements, milestones, mostEffectiveActions, opportunity,
    direction, sources, learnings, trendPoints,
    isLoading, error, projectId,
    hasData, hasMilestones, hasOpportunity,
    fetchGrowth: fetchGrowthData, setProject,
  }
})
