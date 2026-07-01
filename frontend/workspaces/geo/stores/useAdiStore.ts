/**
 * GEO ADI Store — Pinia Store
 *
 * Manages ADI (Assessment Discovery Index) state.
 * ADI is the primary KPI for the GEO Dashboard, replacing BII.
 *
 * Three sub-dimensions:
 *   - Discovery Coverage
 *   - Recommendation Share
 *   - Position Score
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { fetchAdi } from '../services/adiService'
import type { AdiData, AdiDimension } from '../services/adiService'

export const useAdiStore = defineStore('geo-adi', () => {
  const adiScore = ref<number>(0)
  const scoreChange = ref<number>(0)
  const trend = ref<'improving' | 'stable' | 'declining'>('stable')
  const brand = ref<{ name: string; website: string; industry: string }>({ name: '', website: '', industry: '' })
  const dimensions = ref<AdiDimension[]>([])
  const explanation = ref<{ summary: string; strengths: string[]; improvements: string[] }>({
    summary: '',
    strengths: [],
    improvements: [],
  })
  const lastUpdated = ref<string | null>(null)

  const isLoading = ref<boolean>(false)
  const error = ref<string | null>(null)
  const projectId = ref<string>('default')

  const hasData = computed(() => adiScore.value > 0)
  const hasDimensions = computed(() => dimensions.value.length > 0)

  const adiLabel = computed(() => {
    if (adiScore.value >= 80) return 'Excellent'
    if (adiScore.value >= 60) return 'Good'
    if (adiScore.value >= 40) return 'Needs Attention'
    return 'Critical'
  })

  const coverageScore = computed(() => {
    const dim = dimensions.value.find(d => d.id === 'coverage')
    return dim?.score ?? 0
  })

  const shareScore = computed(() => {
    const dim = dimensions.value.find(d => d.id === 'share')
    return dim?.score ?? 0
  })

  const positionScore = computed(() => {
    const dim = dimensions.value.find(d => d.id === 'position')
    return dim?.score ?? 0
  })

  async function fetchAdiData(): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      const data = await fetchAdi(projectId.value)
      adiScore.value = data.adiScore
      scoreChange.value = data.scoreChange
      trend.value = data.trend
      brand.value = data.brand
      dimensions.value = data.dimensions
      explanation.value = data.explanation
      lastUpdated.value = data.lastUpdated
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load ADI data'
    } finally {
      isLoading.value = false
    }
  }

  async function refresh(): Promise<void> {
    await fetchAdiData()
  }

  function setProject(id: string) {
    projectId.value = id
  }

  return {
    adiScore, scoreChange, trend, brand,
    dimensions, explanation, lastUpdated,
    isLoading, error, projectId,
    hasData, hasDimensions, adiLabel,
    coverageScore, shareScore, positionScore,
    fetchAdi: fetchAdiData, refresh, setProject,
  }
})
