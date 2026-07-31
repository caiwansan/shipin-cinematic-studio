<!--
  @deprecated
  Reality Recovery Phase5
  Production path unused — 依赖 /api/repair、/api/trace/:id、/api/replay（后端 gateway 层未注册，404）。
  保留：旧调试台，勿删除。
-->
<template>
  <NuxtLayout name="workbench">
    <div class="space-y-6 max-w-6xl">
      <!-- 运行控制栏 -->
      <div class="flex items-center gap-4 p-4 bg-gray-900 rounded-lg border border-gray-800">
        <button
          class="px-4 py-2 rounded-lg font-medium text-sm transition-colors"
          :class="store.runtimeState === 'running' ? 'bg-red-700 hover:bg-red-600 text-white' : 'bg-green-700 hover:bg-green-600 text-white'"
          @click="store.toggleRuntime()"
        >
          {{ store.runtimeState === 'running' ? '⏹ 停止' : '▶ 启动' }}
        </button>

        <select
          v-model="mode"
          class="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200"
          @change="store.setMode(mode)"
        >
          <option value="production">🟢 Production</option>
          <option value="debug">🔵 Debug</option>
          <option value="chaos">🔴 Chaos</option>
        </select>

        <button
          class="px-3 py-2 rounded-lg text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700"
          @click="triggerReplay"
        >
          🔁 回放
        </button>

        <div class="flex items-center gap-2 text-sm bg-gray-800 px-3 py-1.5 rounded-lg">
          <span class="w-2 h-2 rounded-full animate-pulse" :class="sse.connected.value ? 'bg-green-500' : 'bg-red-500'" />
          <span class="text-xs text-gray-400">SSE</span>
          <span class="text-xs text-gray-600 font-mono">{{ sse.eventCount.value }}</span>
        </div>

        <div class="flex-1" />

        <div class="flex items-center gap-2 text-sm">
          <span class="w-2 h-2 rounded-full" :class="store.runtimeState === 'running' ? 'bg-green-500' : 'bg-red-500'" />
          <span class="text-gray-400">{{ store.runtimeState === 'running' ? '运行中' : '已停止' }}</span>
        </div>
      </div>

      <!-- 执行按钮区：调用真实 DAG 执行 -->
      <div class="flex items-center gap-3 p-4 bg-gray-900 rounded-lg border border-gray-800">
        <select v-model="selectedDagId" class="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 flex-1">
          <option v-for="dag in dagOptions" :key="dag.id" :value="dag.id">{{ dag.label }}</option>
        </select>
        <button
          class="px-4 py-2 bg-cyan-800 hover:bg-cyan-700 text-white rounded-lg text-sm font-medium"
          @click="executeDAG"
        >
          ▶ 执行 DAG
        </button>
      </div>

      <!-- 实时事件流 (来自真实 SSE) -->
      <div class="p-4 bg-gray-900 rounded-lg border border-gray-800">
        <h3 class="text-sm font-medium text-gray-300 mb-3">
          📡 Runtime Event Stream
          <span class="text-xs text-gray-600 ml-2">(live from Event Bus · tick {{ sse.eventCount.value }})</span>
        </h3>
        <div ref="eventContainer" class="h-64 overflow-auto bg-gray-950 rounded p-3 font-mono text-xs space-y-1">
          <div v-for="(event, i) in store.events" :key="i" class="flex gap-2">
            <span class="text-gray-600 shrink-0">{{ event.time }}</span>
            <span :class="eventColor(event.level)">{{ event.msg }}</span>
          </div>
          <div v-if="store.events.length === 0" class="text-gray-600 italic">等待事件...</div>
        </div>
      </div>

      <!-- 实时指标卡片 (自动刷新) -->
      <div class="grid grid-cols-4 gap-4">
        <div class="p-4 bg-gray-900 rounded-lg border border-gray-800">
          <div class="text-xs text-gray-500">负载等级</div>
          <div class="text-xl font-bold mt-1" :class="loadTierColor(store.loadTier)">{{ store.loadTier }}</div>
        </div>
        <div class="p-4 bg-gray-900 rounded-lg border border-gray-800">
          <div class="text-xs text-gray-500">健康度</div>
          <div class="text-xl font-bold text-cyan-400 mt-1">{{ store.healthScore.toFixed(1) }}%</div>
        </div>
        <div class="p-4 bg-gray-900 rounded-lg border border-gray-800">
          <div class="text-xs text-gray-500">恢复率</div>
          <div class="text-xl font-bold mt-1" :class="store.recoveryRate >= 0.9 ? 'text-green-400' : 'text-yellow-400'">
            {{ (store.recoveryRate * 100).toFixed(1) }}%
          </div>
        </div>
        <div class="p-4 bg-gray-900 rounded-lg border border-gray-800">
          <div class="text-xs text-gray-500">漂移率</div>
          <div class="text-xl font-bold mt-1" :class="store.driftRate < 0.01 ? 'text-green-400' : 'text-red-400'">
            {{ (store.driftRate * 100).toFixed(2) }}%
          </div>
        </div>
      </div>
    </div>
  </NuxtLayout>
</template>

<script setup lang="ts">
import { useWorkbenchStore } from '~/stores/workbench'
import { useSSEStream } from '~/composables/useSSEStream'
import { onMounted, onUnmounted, ref, watch, nextTick } from 'vue'

const store = useWorkbenchStore()
const mode = ref(store.mode)
const eventContainer = ref<HTMLElement | null>(null)

// DAG 选项
const selectedDagId = ref('dag_gov_01')
const dagOptions = [
  { id: 'dag_gov_01', label: '🎯 Governance Policy Check (4 nodes)' },
  { id: 'dag_agent_02', label: '✍️ Agent Writer Dispatch (7 nodes)' },
  { id: 'dag_repair_01', label: '🔧 Snapshot Chain Repair (3 nodes)' },
  { id: 'dag_security_03', label: '🛡️ Security Audit Scan (5 nodes)' },
  { id: 'dag_trace_01', label: '🔍 Trace Replay Verification (6 nodes)' },
]

// 连接真实 SSE 事件流
const sse = useSSEStream(false)

// 页面挂载时启动健康轮询
onMounted(() => {
  // 启动 SSE（useSSEStream 已在 onMounted 自动连接，但初始轮询需要手动触发）
  store.startHealthPolling(10000)
})

onUnmounted(() => {
  store.stopHealthPolling()
})

// 执行 DAG
async function executeDAG() {
  await store.executeDAG(selectedDagId.value, { steps: ['init', 'process', 'finalize'] })
}

// 自动滚动到最新事件
watch(store.events, () => {
  nextTick(() => {
    if (eventContainer.value) {
      eventContainer.value.scrollTop = eventContainer.value.scrollHeight
    }
  })
}, { deep: true })

function triggerReplay() {
  store.triggerReplay(`exec_${Date.now()}`)
}

function eventColor(level: string) {
  switch (level) {
    case 'info': return 'text-cyan-400'
    case 'warn': return 'text-yellow-400'
    case 'error': return 'text-red-400'
    default: return 'text-gray-400'
  }
}

function loadTierColor(tier: string) {
  switch (tier) {
    case 'LIGHT': return 'text-green-400'
    case 'MODERATE': return 'text-yellow-400'
    case 'HEAVY': return 'text-red-400'
    case 'SATURATION': return 'text-gray-600'
    default: return 'text-gray-400'
  }
}
</script>
