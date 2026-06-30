// @deprecated — GEO v1.5 Legacy. Use design-system product blocks instead.
import { ref, watch } from 'vue'
import type { Ref } from 'vue'

export function useGeoV1Learning(projectId: Ref<string | null>) {
  const signals = ref<any[]>([])
  const loading = ref(false)

  async function fetchSignals() {
    if (!projectId.value) return
    loading.value = true
    try {
      const { client } = await import('~/legacy/brand-geo/clients/GEOApiClient')
      const res = await client.get(`/learning/signals?projectId=${projectId.value}`)
      if (res.success) {
        signals.value = res.data || []
      }
    } catch {
      // ignore API errors
    } finally {
      loading.value = false
    }
  }

  watch(projectId, fetchSignals, { immediate: true })

  return { signals, loading, refresh: fetchSignals }
}
