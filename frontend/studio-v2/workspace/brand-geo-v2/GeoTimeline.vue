<script setup lang="ts">
import { ref, watch } from 'vue'
import Timeline from '~/components/kmki-ui/Timeline/index.vue'
import type { TimelineEvent } from '~/components/kmki-ui/Timeline/index.vue'

const props = defineProps<{ projectId: string | null }>()

const events = ref<TimelineEvent[]>([])

function getPhaseIcon(phase: string): string {
  const map: Record<string, string> = {
    optimize: '🔧', verify: '✅', publish: '🚀',
    observe: '👁️', indexed: '📡', drift: '⚠️', learn: '🧠',
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

watch(() => props.projectId, async (id) => {
  if (!id) return
  try {
    const res: any = await $fetch(`/api/geo/verification/timeline/${id}`)
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
  }
}, { immediate: true })
</script>

<template>
  <div>
    <div v-if="events.length === 0" class="text-center text-gray-400 py-12">暂无数据</div>
    <Timeline v-else :events="events" />
  </div>
</template>
