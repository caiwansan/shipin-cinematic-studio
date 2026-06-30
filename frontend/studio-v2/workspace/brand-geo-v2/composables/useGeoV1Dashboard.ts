import { ref, watch } from 'vue'
import type { Ref } from 'vue'

export function useGeoV1Dashboard(projectId: Ref<string | null>) {
  const geoScore = ref(0)
  const lastDelta = ref(0)
  const publishHealth = ref(0)
  const indexedRate = ref(0)
  const successRate = ref(0)
  const activeRecommendations = ref(0)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchDashboard() {
    if (!projectId.value) return
    loading.value = true
    error.value = null
    try {
      const { client } = await import('~/studio-v2/workspace/brand-geo/clients/GEOApiClient')
      const res = await client.get(`/monitor/dashboard/${projectId.value}`)
      if (res.success) {
        geoScore.value = res.data.currentScore || 0
        publishHealth.value = res.data.publishingHealth?.verified || 0
        indexedRate.value = res.data.publishingHealth?.indexedPercentage || 0
        successRate.value = res.data.publishingHealth?.total > 0
          ? Math.round((res.data.publishingHealth.verified / res.data.publishingHealth.total) * 100)
          : 0
      }
    } catch (err: any) {
      error.value = err.message
    } finally {
      loading.value = false
    }
  }

  watch(projectId, fetchDashboard, { immediate: true })

  return {
    geoScore,
    lastDelta,
    publishHealth,
    indexedRate,
    successRate,
    activeRecommendations,
    loading,
    error,
    refresh: fetchDashboard,
  }
}
