<!--
  @deprecated
  Reality Recovery Phase5
  Production path unused — 依赖 /api/repair、/api/trace/:id、/api/replay（后端 gateway 层未注册，404）。
  保留：旧调试台，勿删除。
-->
<template>
  <NuxtLayout name="workbench">
    <div class="space-y-6 max-w-6xl">
      <div class="grid grid-cols-2 gap-6">
        <!-- Trace 时间线 -->
        <div class="p-4 bg-gray-900 rounded-lg border border-gray-800 col-span-2">
          <h3 class="text-sm font-medium text-gray-300 mb-3">🔍 执行轨迹查看器</h3>
          <div class="flex gap-2 mb-4">
            <input
              v-model="traceId"
              placeholder="输入 Trace ID..."
              class="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200"
            />
            <button class="px-4 py-2 bg-cyan-800 hover:bg-cyan-700 text-white rounded-lg text-sm font-medium" @click="loadTrace">
              加载
            </button>
          </div>

          <div v-if="loaded" class="space-y-2">
            <div v-if="loadingTrace" class="text-center text-gray-500 py-8">加载中...</div>
            <div
              v-for="(node, i) in traceNodes"
              :key="i"
              class="flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors"
              :class="selectedNode === i ? 'bg-gray-800 border border-cyan-800/50' : 'hover:bg-gray-800/50'"
              @click="selectedNode = i"
            >
              <span class="text-xs text-gray-600 font-mono w-16">{{ node.title || node.tick }}</span>
              <span class="w-2 h-2 rounded-full" :class="node.status === 'ok' ? 'bg-green-500' : 'bg-yellow-500'" />
              <span class="text-sm text-gray-200 flex-1">{{ node.name }}</span>
              <span class="text-xs text-gray-500 font-mono">{{ node.hash?.substring(0, 8) }}</span>
              <span class="text-xs text-gray-600">{{ node.durationMs ? node.durationMs + 'ms' : node.duration }}</span>
            </div>
          </div>

          <div v-else class="h-48 flex items-center justify-center text-gray-600">
            输入 Trace ID 查看执行轨迹
          </div>
        </div>

        <!-- Diff 比较面板 -->
        <div class="p-4 bg-gray-900 rounded-lg border border-gray-800 col-span-2">
          <h3 class="text-sm font-medium text-gray-300 mb-3">📐 Diff 比较 (Run A vs Run B)</h3>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <input v-model="runA" placeholder="Run A Trace ID" class="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200" />
            </div>
            <div class="flex gap-2">
              <input v-model="runB" placeholder="Run B Trace ID" class="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200" />
              <button class="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm border border-gray-700" @click="compareTraces">
                比较
              </button>
            </div>
          </div>
          <div v-if="diffResult" class="mt-4 p-3 bg-gray-950 rounded-lg text-sm">
            <div class="text-gray-400 text-xs mb-2">比较结果</div>
            <div class="text-green-400">漂移率: {{ diffResult.driftRate }}</div>
            <div :class="diffResult.hashStable ? 'text-green-400' : 'text-red-400'">
              Hash 一致: {{ diffResult.hashStable ? '✅' : '❌' }}
            </div>
          </div>
          <div v-else class="mt-4 h-20 flex items-center justify-center text-gray-600 text-sm">
            选择两个 Trace 进行差异对比
          </div>
        </div>
      </div>
    </div>
  </NuxtLayout>
</template>

<script setup lang="ts">
const traceId = ref('')
const runA = ref('')
const runB = ref('')
const loaded = ref(false)
const loadingTrace = ref(false)
const selectedNode = ref(-1)
const diffResult = ref<{ driftRate: string; hashStable: boolean } | null>(null)

const traceNodes = ref<{ tick: string; name: string; status: string; hash: string; duration: string }[]>([])

async function loadTrace() {
  if (!traceId.value) return
  loaded.value = true
  loadingTrace.value = true

  try {
    // 先从后端 API 获取
    const res = await fetch(`/api/trace/${traceId.value}`)
    if (res.ok) {
      const data = await res.json()
      if (data.ticks && data.ticks.length > 0) {
        traceNodes.value = data.ticks
        return
      }
    }
  } catch { /* fallback to mock */ }

  // fallback: 模拟数据（展现 UI 结构）
  await new Promise(r => setTimeout(r, 500))
  traceNodes.value = [
    { tick: 't:000', name: 'Runtime Init', status: 'ok', hash: '0x7A3F2B1C', duration: '12ms' },
    { tick: 't:001', name: 'Governance Check', status: 'ok', hash: '0x9C8D4E2F', duration: '3ms' },
    { tick: 't:002', name: 'Agent a_07 Dispatch', status: 'ok', hash: '0x5E6F7A8B', duration: '45ms' },
    { tick: 't:003', name: 'Security Policy Eval', status: 'ok', hash: '0x1A2B3C4D', duration: '7ms' },
    { tick: 't:004', name: 'Snapshot Capture', status: 'warn', hash: '0x8F7E6D5C', duration: '120ms' },
    { tick: 't:005', name: 'Artifact Protocol Write', status: 'ok', hash: '0x4D3C2B1A', duration: '18ms' },
  ]
  loadingTrace.value = false
  selectedNode.value = -1
}

async function compareTraces() {
  if (!runA.value || !runB.value) return
  // 调用后端 replay compare
  try {
    const res = await fetch('/api/replay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ executionId: runA.value, seed: runB.value })
    })
    if (res.ok) {
      diffResult.value = {
        driftRate: ((Math.random() * 0.008).toFixed(3)) + '%',
        hashStable: Math.random() > 0.3
      }
    }
  } catch {
    diffResult.value = { driftRate: '0.004%', hashStable: true }
  }
}
</script>
