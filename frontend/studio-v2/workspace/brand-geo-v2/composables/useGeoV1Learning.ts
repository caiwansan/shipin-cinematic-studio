import { ref, watch } from 'vue'
import type { Ref } from 'vue'

export function useGeoV1Learning(projectId: Ref<string | null>) {
  const signals = ref<any[]>([])
  const loading = ref(false)

  async function fetchSignals() {
    if (!projectId.value) return
    loading.value = true
    try {
      const res: any = await $fetch(`/api/geo/learning/signals?projectId=${projectId.value}`)
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
