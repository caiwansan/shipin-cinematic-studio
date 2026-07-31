<!--
  @deprecated
  Reality Recovery Phase5
  Production path unused — 依赖 /api/repair、/api/trace/:id、/api/replay（后端 gateway 层未注册，404）。
  保留：旧调试台，勿删除。
-->
<template>
  <NuxtLayout name="workbench">
    <div class="space-y-6 max-w-6xl">
      <!-- DAG tab 切换 -->
      <div class="flex gap-2 border-b border-gray-800 pb-2">
        <button
          v-for="tab in dagTabs"
          :key="tab.id"
          class="px-4 py-2 text-sm rounded-t-lg transition-colors"
          :class="activeTab === tab.id ? 'bg-gray-800 text-cyan-400 border border-gray-700 border-b-0' : 'text-gray-500 hover:text-gray-300'"
          @click="switchTab(tab.id)"
        >
          {{ tab.label }}
        </button>
      </div>

      <!-- 执行事件流 (实时) -->
      <div class="p-4 bg-gray-900 rounded-lg border border-gray-800">
        <h3 class="text-sm font-medium text-gray-300 mb-3">
          📡 DAG 执行事件流 (实时 · tick {{ sse.eventCount.value }})
          <span class="text-xs text-gray-600 ml-2">SSE: {{ sse.connected.value ? '🟢' : '🔴' }}</span>
        </h3>
        <div class="h-64 overflow-auto bg-gray-950 rounded p-3 font-mono text-xs space-y-1">
          <div v-for="(event, i) in dagEvents" :key="i" class="flex gap-2">
            <span class="text-gray-600 shrink-0 w-12">{{ event.tick }}</span>
            <span class="text-gray-500 shrink-0">{{ event.time }}</span>
            <span :class="eventColor(event.level)">{{ event.msg }}</span>
            <span v-if="event.duration" class="text-gray-700">{{ event.duration }}</span>
          </div>
          <div v-if="dagEvents.length === 0" class="text-gray-600 italic">等待 DAG 执行事件...</div>
        </div>
      </div>

      <!-- 节点信息侧栏 (实时) -->
      <div class="grid grid-cols-3 gap-4">
        <div class="p-4 bg-gray-900 rounded-lg border border-gray-800">
          <div class="text-xs text-gray-500">总执行数</div>
          <div class="text-lg font-bold text-cyan-400">{{ totalExecuted }}</div>
        </div>
        <div class="p-4 bg-gray-900 rounded-lg border border-gray-800">
          <div class="text-xs text-gray-500">成功率</div>
          <div class="text-lg font-bold" :class="successRate >= 0.9 ? 'text-green-400' : 'text-yellow-400'">{{ (successRate * 100).toFixed(0) }}%</div>
        </div>
        <div class="p-4 bg-gray-900 rounded-lg border border-gray-800">
          <div class="text-xs text-gray-500">健康度</div>
          <div class="text-lg font-bold text-cyan-400">{{ store.healthScore.toFixed(1) }}%</div>
        </div>
      </div>
    </div>
  </NuxtLayout>
</template>

<script setup lang="ts">
import { useWorkbenchStore } from '~/stores/workbench'
import { useSSEStream } from '~/composables/useSSEStream'
import { ref, computed } from 'vue'

const store = useWorkbenchStore()
const sse = useSSEStream(false)

const activeTab = ref('agent')
const dagTabs = [
  { id: 'agent', label: '🎯 Agent DAG' },
  { id: 'system', label: '⚙️ System DAG' },
  { id: 'repair', label: '🔧 Repair DAG' },
]

// 实时 DAG 事件列表（从 SSE 同步）
const dagEvents = ref<{ tick: number; time: string; level: string; msg: string; duration?: string }[]>([])
const totalExecuted = ref(0)
let dagSuccessCount = 0

// 监听 SSE 的 lastEvent 变化
import { watch } from 'vue'
watch(() => sse.lastEvent.value, (evt) => {
  if (!evt) return
  const tick = evt.tick
  const time = new Date(evt.timestamp).toLocaleTimeString()

  switch (evt.type) {
    case 'dag.execute':
      dagEvents.value.unshift({
        tick,
        time,
        level: 'info',
        msg: `▶ DAG 开始: ${(evt.data as any).dagId}`,
      })
      totalExecuted.value++
      break
    case 'dag.complete':
      dagEvents.value.unshift({
        tick,
        time,
        level: 'info',
        msg: `✅ DAG 完成: ${(evt.data as any).dagId}`,
        duration: `${(evt.data as any).durationMs}ms`,
      })
      dagSuccessCount++
      break
    case 'dag.error':
      dagEvents.value.unshift({
        tick,
        time,
        level: 'error',
        msg: `❌ DAG 失败: ${(evt.data as any).dagId}`,
      })
      break
    case 'trace.node':
      const nodeData = evt.data as any
      dagEvents.value.unshift({
        tick,
        time,
        level: nodeData.status === 'ok' ? 'info' : 'warn',
        msg: `  ${nodeData.status === 'ok' ? '●' : '◉'} ${nodeData.nodeName}`,
        duration: `${nodeData.durationMs}ms`,
      })
      break
  }

  // 只保留最近 100 条
  if (dagEvents.value.length > 100) dagEvents.value.length = 100
})

const successRate = computed(() => totalExecuted.value > 0 ? dagSuccessCount / totalExecuted.value : 1)

function switchTab(id: string) {
  activeTab.value = id
}

function eventColor(level: string) {
  switch (level) {
    case 'info': return 'text-cyan-400'
    case 'warn': return 'text-yellow-400'
    case 'error': return 'text-red-400'
    default: return 'text-gray-400'
  }
}
</script>
