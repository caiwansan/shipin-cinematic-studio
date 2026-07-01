/**
 * GEO Health Store — Pinia Store
 *
 * Manages Brand Health state mapped from API to Product Language.
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { fetchHealth } from '../services/healthService'
import type { BrandHealthData } from '../services/healthService'

export const useHealthStore = defineStore('geo-health', () => {
  const brandHealth = ref<BrandHealthData['score']>(0)
  const scoreChange = ref<BrandHealthData['scoreChange']>(0)
  const trend = ref<BrandHealthData['trend']>('stable')
  const brand = ref<BrandHealthData['brand']>({ name: '', website: '', industry: '', status: '' })
  const dimensions = ref<BrandHealthData['dimensions']>([])
  const explanation = ref<BrandHealthData['explanation']>({ summary: '', nextFocus: '' })
  const coverage = ref<BrandHealthData['coverage']>({ evidenceCount: 0, entityCount: 0, claimCount: 0 })
  const recentChanges = ref<BrandHealthData['recentChanges']>([])
  const quickActions = ref<BrandHealthData['quickActions']>([])

  const isLoading = ref<boolean>(false)
  const error = ref<string | null>(null)
  const lastUpdated = ref<number | null>(null)
  const projectId = ref<string>('default')

  const hasData = computed(() => brand.value.name !== '')
  const healthLabel = computed(() => {
    if (brandHealth.value >= 80) return 'Excellent'
    if (brandHealth.value >= 60) return 'Good'
    if (brandHealth.value >= 40) return 'Needs Attention'
    return 'Critical'
  })

  async function fetchHealthData(): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      const data = await fetchHealth(projectId.value)
      brandHealth.value = data.score
      scoreChange.value = data.scoreChange
      trend.value = data.trend
      brand.value = data.brand
      dimensions.value = data.dimensions
      explanation.value = data.explanation
      coverage.value = data.coverage
      recentChanges.value = data.recentChanges
      quickActions.value = data.quickActions
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
    brandHealth, scoreChange, trend, brand,
    dimensions, explanation, coverage,
    recentChanges, quickActions,
    isLoading, error, lastUpdated, projectId,
    hasData, healthLabel,
    fetchHealth: fetchHealthData, refresh, setProject,
  }
})
