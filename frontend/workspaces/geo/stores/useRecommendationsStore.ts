/**
 * GEO Recommendations Store — Pinia Store
 *
 * Manages recommendations list, execution state, and history.
 * Fetches from real API endpoint.
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { fetchRecommendations, executeRecommendation } from '../services/recommendationsService'
import type { RecommendationItem } from '../services/recommendationsService'

export interface ExecutionState {
  status: 'idle' | 'running' | 'success' | 'error'
  lastImpact: number
  errorMessage: string | null
}

export const useRecommendationsStore = defineStore('geo-recommendations', () => {
  const currentScore = ref<number>(82)
  const expectedScore = ref<number>(89)
  const recommendations = ref<RecommendationItem[]>([])
  const history = ref<Array<{
    id: string
    title: string
    impact: number
    executedAt: string
    status: string
  }>>([])
  const isLoading = ref<boolean>(false)
  const error = ref<string | null>(null)
  const execution = ref<ExecutionState>({ status: 'idle', lastImpact: 0, errorMessage: null })
  const projectId = ref<string>('default')

  const pendingRecommendations = computed(() =>
    recommendations.value.filter(r => r.status === 'pending' || !r.status)
  )
  const completedRecommendations = computed(() =>
    recommendations.value.filter(r => r.status === 'success')
  )

  async function fetchRecs(): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      const data = await fetchRecommendations(projectId.value)
      currentScore.value = data.currentScore
      expectedScore.value = data.expectedScore
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
        if (rec) rec.status = 'running'
      }
      const result = await executeRecommendation(projectId.value, ids)
      execution.value = { status: 'success', lastImpact: result.impact, errorMessage: null }
      for (const id of ids) {
        const rec = recommendations.value.find(r => r.id === id)
        if (rec) rec.status = 'success'
      }
      currentScore.value += result.impact
      expectedScore.value = currentScore.value + pendingRecommendations.value.reduce((sum, r) => sum + r.expectedImpact, 0)
    } catch (err) {
      execution.value = {
        status: 'error',
        lastImpact: 0,
        errorMessage: err instanceof Error ? err.message : 'Execution failed',
      }
      for (const id of ids) {
        const rec = recommendations.value.find(r => r.id === id)
        if (rec) rec.status = 'error'
      }
    }
  }

  function setProject(id: string) {
    projectId.value = id
  }

  return {
    currentScore, expectedScore, recommendations, history,
    isLoading, error, execution, projectId,
    pendingRecommendations, completedRecommendations,
    fetchRecs, execute, setProject,
  }
})
