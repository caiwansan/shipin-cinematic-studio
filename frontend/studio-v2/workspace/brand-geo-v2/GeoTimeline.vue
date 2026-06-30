<script setup lang="ts">
import { ref, watch } from 'vue'
import Timeline from '~/components/kmki-ui/Timeline/index.vue'
import type { TimelineEvent } from '~/components/kmki-ui/Timeline/index.vue'

const props = defineProps<{ projectId: string | null }>()

const events = ref<TimelineEvent[]>([])
const replaying = ref(false)
const replayResult = ref<string | null>(null)

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

async function fetchTimeline(id: string) {
  try {
    const { client } = await import('~/studio-v2/workspace/brand-geo/clients/GEOApiClient')
    const res = await client.get(`/verification/timeline/${id}`)
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
}

watch(() => props.projectId, async (id) => {
  if (!id) return
  await fetchTimeline(id)
}, { immediate: true })

async function replayVerification() {
  if (!props.projectId) return
  replaying.value = true
  replayResult.value = null
  try {
    const { client } = await import('~/studio-v2/workspace/brand-geo/clients/GEOApiClient')
    const res = await client.post('/verification/run', {
      projectId: props.projectId,
      optimizationType: 'replay',
      triggerSource: 'manual',
    })
    replayResult.value = res.success ? '✅ 验证已重跑' : '❌ 重跑失败'
    if (res.success) await fetchTimeline(props.projectId)
  } catch {
    replayResult.value = '❌ 重跑失败'
  } finally {
    replaying.value = false
  }
}
</script>

<template>
  <div>
    <div v-if="!projectId" class="text-center text-gray-400 py-12">选择一个项目开始</div>
    <template v-else>
      <div class="flex items-center justify-between mb-3">
        <span class="text-sm text-gray-500 dark:text-gray-400">验证时间线</span>
        <button
          class="text-xs px-3 py-1.5 rounded bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          :disabled="replaying"
          @click="replayVerification"
        >
          {{ replaying ? '运行中...' : '重新执行' }}
        </button>
      </div>

      <div v-if="replayResult" class="text-xs text-center py-1 mb-2" :class="replayResult.startsWith('✅') ? 'text-green-500' : 'text-red-400'">
        {{ replayResult }}
      </div>

      <div v-if="events.length === 0" class="text-center text-gray-400 py-12">暂无数据</div>
      <Timeline v-else :events="events" />
    </template>
  </div>
</template>
