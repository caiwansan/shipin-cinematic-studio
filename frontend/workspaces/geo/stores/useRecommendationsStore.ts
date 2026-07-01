/**
 * GEO Recommendations Store — Pinia Store
 *
 * Manages recommendations list, execution state, and history.
 * Fetches from real API endpoint.
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { fetchRecommendations, executeRecommendation } from '../services/recommendationsService'
import type {
  RecommendationItem,
  RecommendationsSummary,
  RecommendationHistoryItem,
} from '../services/recommendationsService'

export interface ExecutionState {
  status: 'idle' | 'running' | 'success' | 'error'
  lastImpact: number
  errorMessage: string | null
}

export const useRecommendationsStore = defineStore('geo-recommendations', () => {
  const summary = ref<RecommendationsSummary>({ total: 0, highPriority: 0, mediumPriority: 0, lowPriority: 0, totalExpectedGain: 0 })
  const recommendations = ref<RecommendationItem[]>([])
  const history = ref<RecommendationHistoryItem[]>([])
  const isLoading = ref<boolean>(false)
  const error = ref<string | null>(null)
  const execution = ref<ExecutionState>({ status: 'idle', lastImpact: 0, errorMessage: null })
  const projectId = ref<string>('default')

  // Derived properties for backward compatibility with pages
  const currentScore = computed(() => 60) // baseline, not from API
  const expectedScore = computed(() => 60 + summary.value.totalExpectedGain)
  const hasRecs = computed(() => recommendations.value.length > 0 || summary.value.total > 0)

  const pendingRecommendations = computed(() =>
    recommendations.value.filter(r => r.status === 'ready' || r.status === ('pending' as any))
  )
  const completedRecommendations = computed(() =>
    recommendations.value.filter(r => r.status === 'success')
  )

  async function fetchRecs(): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      const data = await fetchRecommendations(projectId.value)
      summary.value = data.summary
      recommendations.value = data.recommendations
      history.value = data.history
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load recommendations'
    } finally {
      isLoading.value = false
    }
  }

  async function execute(ids: string[]): Promise<void> {
    execution.value = { status: 'running', lastImpact: 0, errorMessage: null }
    try {
      for (const id of ids) {
        const rec = recommendations.value.find(r => r.id === id)
        if (rec) rec.status = 'running' as any
      }
      const result = await executeRecommendation(projectId.value, ids)
      execution.value = { status: 'success', lastImpact: result.impact, errorMessage: null }
      for (const id of ids) {
        const rec = recommendations.value.find(r => r.id === id)
        if (rec) rec.status = 'success' as any
      }
    } catch (err) {
      execution.value = {
        status: 'error',
        lastImpact: 0,
        errorMessage: err instanceof Error ? err.message : 'Execution failed',
      }
      for (const id of ids) {
        const rec = recommendations.value.find(r => r.id === id)
        if (rec) rec.status = 'error' as any
      }
    }
  }

  function setProject(id: string) {
    projectId.value = id
  }

  return {
    summary, recommendations, history,
    isLoading, error, execution, projectId,
    currentScore, expectedScore, hasRecs,
    pendingRecommendations, completedRecommendations,
    fetchRecs, execute, setProject,
  }
})
