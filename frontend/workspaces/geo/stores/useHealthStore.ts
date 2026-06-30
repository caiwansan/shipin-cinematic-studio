/**
 * GEO Health Store — Pinia Store
 *
 * Manages Brand Health state: score, dimensions, daily change, recommendations.
 * Fetches from real API endpoint.
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { fetchHealth } from '../services/healthService'
import type { BrandHealthData } from '../services/healthService'

export const useHealthStore = defineStore('geo-health', () => {
  const brandHealth = ref<BrandHealthData['brandHealth']>(null)
  const dimensions = ref<BrandHealthData['dimensions']>([])
  const dailyChange = ref<number>(0)
  const recommendations = ref<BrandHealthData['recommendations']>([])
  const isLoading = ref<boolean>(false)
  const error = ref<string | null>(null)
  const lastUpdated = ref<number | null>(null)
  const projectId = ref<string>('default')

  const hasData = computed(() => brandHealth.value !== null)
  const totalRecommendations = computed(() => recommendations.value.length)
  const hasActionsPending = computed(() => totalRecommendations.value > 0)

  async function fetchHealthData(): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      const data = await fetchHealth(projectId.value)
      brandHealth.value = data.brandHealth
      dimensions.value = data.dimensions
      dailyChange.value = data.dailyChange
      recommendations.value = data.recommendations
      lastUpdated.value = Date.now()
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load Brand Health'
    } finally {
      isLoading.value = false
    }
  }

  async function refresh(): Promise<void> {
    await fetchHealthData()
  }

  function setProject(id: string) {
    projectId.value = id
  }

  return {
    brandHealth, dimensions, dailyChange, recommendations,
    isLoading, error, lastUpdated, projectId,
    hasData, totalRecommendations, hasActionsPending,
    fetchHealth: fetchHealthData, refresh, setProject,
  }
})
