/**
 * GEO Health Store — Pinia Store
 *
 * Manages Brand Health state: score, dimensions, daily change, recommendations.
 * Actions: fetchHealth() loads data from healthService, refresh() reloads.
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { fetchHealth, type BrandHealthData } from '../services/healthService'

export interface HealthState {
  brandHealth: BrandHealthData['brandHealth']
  dimensions: BrandHealthData['dimensions']
  dailyChange: number
  recommendations: BrandHealthData['recommendations']
  isLoading: boolean
  error: string | null
  lastUpdated: number | null
}

export const useHealthStore = defineStore('geo-health', () => {
  // --- State ---
  const brandHealth = ref<HealthState['brandHealth']>(null)
  const dimensions = ref<HealthState['dimensions']>([])
  const dailyChange = ref<number>(0)
  const recommendations = ref<HealthState['recommendations']>([])
  const isLoading = ref<boolean>(false)
  const error = ref<string | null>(null)
  const lastUpdated = ref<number | null>(null)

  // --- Getters ---
  const hasData = computed(() => brandHealth.value !== null)
  const totalRecommendations = computed(() => recommendations.value.length)
  const hasActionsPending = computed(() => totalRecommendations.value > 0)

  // --- Actions ---
  async function fetchHealthData(): Promise<void> {
    isLoading.value = true
    error.value = null

    try {
      const data = await fetchHealth('normal')
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

  return {
    // State
    brandHealth,
    dimensions,
    dailyChange,
    recommendations,
    isLoading,
    error,
    lastUpdated,
    // Getters
    hasData,
    totalRecommendations,
    hasActionsPending,
    // Actions
    fetchHealth: fetchHealthData,
    refresh,
  }
})
