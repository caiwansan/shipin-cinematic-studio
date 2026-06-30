import { ref, watch } from 'vue'
import type { Ref } from 'vue'
import type { TimelineEvent } from '~/components/kmki-ui/Timeline/index.vue'

function getPhaseIcon(phase: string): string {
  const map: Record<string, string> = {
    optimize: '🔧',
    verify: '✅',
    publish: '🚀',
    observe: '👁️',
    indexed: '📡',
    drift: '⚠️',
    learn: '🧠',
  }
  return map[phase] || '📌'
}

function formatTime(timestamp: string | number): string {
  if (!timestamp) return ''
  const d = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return '刚刚'
  if (diffMin < 60) return `${diffMin}分钟前`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour}小时前`
  const diffDay = Math.floor(diffHour / 24)
  if (diffDay < 7) return `${diffDay}天前`
  return d.toLocaleDateString('zh-CN')
}

export function useGeoV1Timeline(projectId: Ref<string | null>) {
  const events = ref<TimelineEvent[]>([])
  const loading = ref(false)

  async function fetchTimeline() {
    if (!projectId.value) return
    loading.value = true
    try {
      const { client } = await import('~/studio-v2/workspace/brand-geo/clients/GEOApiClient')
      const res = await client.get(`/verification/timeline/${projectId.value}`)
      if (res.success) {
        events.value = (res.data || []).map((e: any) => ({
          id: e.id,
          icon: getPhaseIcon(e.phase),
          title: e.title || e.phase,
          time: formatTime(e.timestamp),
          description: e.description || '',
          status: e.status,
          phase: e.phase,
          detail: e.detail,
        }))
      }
    } catch {
      // ignore API errors
    } finally {
      loading.value = false
    }
  }

  watch(projectId, fetchTimeline, { immediate: true })

  return { events, loading, refresh: fetchTimeline }
}
