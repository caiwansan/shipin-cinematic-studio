<!--
  @deprecated
  Reality Recovery Phase5
  Production path unused — 调用 /api/workbench/*（后端未注册，404）。
  保留：未完成未来层（叙事导演工作台），勿删除。
-->
<template>
  <div class="min-h-screen bg-[#0a0a0f] text-gray-200 flex flex-col">
    <!-- 标题栏 -->
    <header class="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
      <div>
        <h1 class="text-lg font-semibold text-indigo-300">🔭 执行天文台</h1>
        <p class="text-xs text-gray-500 mt-0.5">Execution Observatory — DAG 可视化回放</p>
      </div>
      <button
        @click="loadObservatory"
        :disabled="loading"
        class="px-4 py-1.5 text-xs rounded-lg bg-indigo-600/20 text-indigo-300 border border-indigo-800/30
               hover:bg-indigo-600/30 transition-colors disabled:opacity-40"
      >
        {{ loading ? '加载中...' : '加载最新' }}
      </button>
    </header>

    <!-- 主区 -->
    <div class="flex-1 flex flex-col p-4 gap-4">
      <!-- 输入栏 -->
      <div class="flex gap-2">
        <input
          v-model="traceInput"
          placeholder="输入 traceId..."
          class="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm
                 text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500"
        />
        <button
          @click="loadByTraceId"
          class="px-4 py-2 text-xs rounded-lg bg-indigo-600/20 text-indigo-300 border border-indigo-800/30
                 hover:bg-indigo-600/30 transition-colors whitespace-nowrap"
        >
          查询
        </button>
      </div>

      <!-- 统计栏 -->
      <div v-if="observatory" class="flex gap-4 text-xs text-gray-400">
        <span>节点: <strong class="text-gray-200">{{ observatory.nodes.length }}</strong></span>
        <span>边: <strong class="text-gray-200">{{ observatory.edges.length }}</strong></span>
        <span>traceId: <code class="text-indigo-400">{{ observatory.traceId }}</code></span>
      </div>

      <!-- DAG 视图 -->
      <div class="flex-1 relative bg-gray-950/50 rounded-xl border border-gray-800/50 overflow-hidden min-h-[400px]">
        <DagView
          v-if="observatory"
          :nodes="observatory.nodes"
          :edges="observatory.edges"
          :frame="frame"
        />
        <div v-else class="absolute inset-0 flex items-center justify-center text-gray-600 text-sm">
          输入 traceId 加载执行图谱
        </div>
      </div>

      <!-- 回放滑块 -->
      <ReplaySlider v-if="observatory" v-model="frame" :max="100" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import DagView from '~/studio-v2/workspace/director-workbench/observatory/DagView.vue'
import ReplaySlider from '~/studio-v2/workspace/director-workbench/observatory/ReplaySlider.vue'

const traceInput = ref('')
const observatory = ref<{ traceId: string; nodes: any[]; edges: any[] } | null>(null)
const loading = ref(false)
const frame = ref(0)

async function loadObservatory() {
  loading.value = true
  try {
    // 先获取最近的 render job，拿到 traceId
    const jobsRes = await fetch('/api/workbench/jobs')
    // 如果 job 列表不可用，回到手动输入
    observatory.value = null
  } finally {
    loading.value = false
  }
}

async function loadByTraceId() {
  const id = traceInput.value.trim()
  if (!id) return

  loading.value = true
  try {
    const res = await fetch(`/api/workbench/observatory/${id}`)
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: '未知错误' }))
      alert(err.error || `HTTP ${res.status}`)
      return
    }
    const data = await res.json()
    observatory.value = data.observatory
  } catch (e: any) {
    alert('加载失败: ' + e.message)
  } finally {
    loading.value = false
  }
}
</script>
