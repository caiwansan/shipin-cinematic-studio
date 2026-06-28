<template>
  <div class="trace-console">
    <!-- Header -->
    <div class="flex items-center justify-between mb-4">
      <div>
        <h1 class="text-sm font-semibold text-white/90">Prompt Debug Mode</h1>
        <p class="text-[10px] text-gray-500 mt-0.5">
          Trace Replay — 单次 Prompt 链路的完整回放
        </p>
      </div>
      <button
        @click="loadRecentTraces"
        :disabled="loading"
        class="px-3 py-1.5 text-[10px] rounded bg-blue-500/20 text-blue-400 border border-blue-500/30
               hover:bg-blue-500/30 disabled:opacity-40 transition cursor-pointer"
      >
        {{ loading ? '加载中...' : '⟳ 刷新列表' }}
      </button>
    </div>

    <!-- Empty State -->
    <div v-if="recentTraces.length === 0 && !loading" class="p-6 rounded-lg bg-[#0D1328] border border-[#1A2240] flex flex-col items-center gap-2">
      <span class="text-xl">🧪</span>
      <span class="text-xs text-gray-500">等待数据...</span>
      <span class="text-[10px] text-gray-600">尚无 Prompt 调用记录，系统处于冷观测阶段</span>
    </div>

    <!-- Two-column layout: list + detail -->
    <div v-else class="flex gap-3" style="min-height: 400px">
      <!-- Left: Trace list -->
      <div class="w-64 shrink-0 overflow-y-auto space-y-1 pr-2" style="max-height: 600px">
        <div
          v-for="t in recentTraces" :key="t.requestId"
          @click="loadTrace(t.requestId)"
          class="p-3 rounded-lg border cursor-pointer transition"
          :class="selectedId === t.requestId
            ? 'bg-blue-500/10 border-blue-500/40'
            : 'bg-[#0D1328] border-[#1A2240] hover:border-gray-700'"
        >
          <div class="flex items-center justify-between">
            <span class="text-[11px] font-mono text-white/70 truncate max-w-[140px]">{{ t.promptName }}</span>
            <span class="text-[10px] px-1.5 py-0.5 rounded"
              :class="t.success ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'"
            >{{ t.success ? 'OK' : 'FAIL' }}</span>
          </div>
          <div class="flex items-center gap-2 mt-1.5 text-[10px] text-gray-600">
            <span>v{{ t.version }}</span>
            <span>·</span>
            <span :class="routingColor(t.routingMode)">{{ t.routingMode }}</span>
            <span>·</span>
            <span>{{ t.latencyMs }}ms</span>
          </div>
          <div class="text-[10px] text-gray-700 mt-1">{{ formatTime(t.timestamp) }}</div>
        </div>
      </div>

      <!-- Right: Trace detail -->
      <div class="flex-1 overflow-y-auto">
        <div v-if="!selectedTrace" class="h-full flex items-center justify-center text-[11px] text-gray-600">
          选择左侧一条 trace 查看详情
        </div>

        <div v-else-if="'error' in selectedTrace" class="p-6 rounded-lg bg-red-500/5 border border-red-500/20 text-[11px] text-red-400">
          {{ selectedTrace.error }}
        </div>

        <template v-else>
          <div class="grid grid-cols-3 gap-4 mb-4">
            <!-- Timeline -->
            <div class="p-4 rounded-lg bg-[#0D1328] border border-[#1A2240] col-span-2">
              <h3 class="text-[11px] font-semibold text-white/70 mb-3 uppercase tracking-wider">Timeline</h3>
              <div class="space-y-0">
                <div v-for="(node, i) in selectedTrace.timeline" :key="i" class="flex items-start gap-3 py-2 border-l-2 pl-3 relative"
                  :class="node.status === 'completed' ? 'border-green-500/40' : node.status === 'failed' ? 'border-red-500/40' : 'border-gray-700'"
                >
                  <!-- Dot -->
                  <div class="absolute -left-[5px] top-3 w-2 h-2 rounded-full"
                    :class="node.status === 'completed' ? 'bg-green-500' : node.status === 'failed' ? 'bg-red-500' : 'bg-gray-600'"
                  ></div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                      <span class="text-xs text-white/80 font-medium">{{ node.step }}</span>
                      <span class="text-[10px] text-gray-600">{{ node.elapsedMs }}ms</span>
                      <span v-if="node.status === 'skipped'" class="text-[10px] text-gray-500">(skipped)</span>
                    </div>
                    <div v-if="node.detail" class="text-[10px] text-gray-600 mt-0.5 font-mono truncate">
                      {{ JSON.stringify(node.detail) }}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Routing Tree -->
            <div class="p-4 rounded-lg bg-[#0D1328] border border-[#1A2240]">
              <h3 class="text-[11px] font-semibold text-white/70 mb-3 uppercase tracking-wider">Routing Tree</h3>
              <div class="space-y-2">
                <div class="p-2 rounded bg-[#060A18] text-[11px] font-mono text-gray-300">
                  input
                </div>
                <div class="text-center text-[10px] text-gray-600">↓</div>
                <div class="p-2 rounded bg-[#060A18] text-[11px] font-mono text-blue-400 border border-blue-500/30">
                  router
                </div>
                <div class="grid grid-cols-3 gap-1 text-center">
                  <div class="p-1.5 rounded text-[10px] font-mono"
                    :class="selectedTrace.routing.mode === 'stable' ? 'bg-green-500/20 border border-green-500/40 text-green-400' : 'bg-[#060A18] text-gray-600'"
                  >stable</div>
                  <div class="p-1.5 rounded text-[10px] font-mono"
                    :class="selectedTrace.routing.mode === 'canary' ? 'bg-yellow-500/20 border border-yellow-500/40 text-yellow-400' : 'bg-[#060A18] text-gray-600'"
                  >canary</div>
                  <div class="p-1.5 rounded text-[10px] font-mono"
                    :class="selectedTrace.routing.mode === 'override' ? 'bg-red-500/20 border border-red-500/40 text-red-400' : 'bg-[#060A18] text-gray-600'"
                  >override</div>
                </div>
                <div class="text-center text-[10px] text-gray-600">↓</div>
                <div class="p-2 rounded bg-[#060A18] text-[11px] font-mono text-purple-400 border border-purple-500/30">
                  v{{ selectedTrace.routing.version }}
                </div>
              </div>
            </div>
          </div>

          <!-- Execution Output -->
          <div class="grid grid-cols-2 gap-4 mb-4">
            <div class="p-4 rounded-lg bg-[#0D1328] border border-[#1A2240]">
              <h3 class="text-[11px] font-semibold text-white/70 mb-2 uppercase tracking-wider">Final Prompt</h3>
              <pre v-if="selectedTrace.execution.finalPrompt" class="text-[10px] text-gray-400 font-mono whitespace-pre-wrap max-h-48 overflow-y-auto">{{ selectedTrace.execution.finalPrompt }}</pre>
              <div v-else class="text-[10px] text-gray-600 italic">未存储（可选的上下文数据）</div>
            </div>
            <div class="p-4 rounded-lg bg-[#0D1328] border border-[#1A2240]">
              <h3 class="text-[11px] font-semibold text-white/70 mb-2 uppercase tracking-wider">Output</h3>
              <pre v-if="selectedTrace.output.text" class="text-[10px] text-gray-400 font-mono whitespace-pre-wrap max-h-48 overflow-y-auto">{{ selectedTrace.output.text }}</pre>
              <div v-else class="text-[10px] text-gray-600 italic">未存储（可选的上下文数据）</div>
            </div>
          </div>

          <!-- Telemetry Inspector -->
          <div class="p-4 rounded-lg bg-[#0D1328] border border-[#1A2240]">
            <h3 class="text-[11px] font-semibold text-white/70 mb-3 uppercase tracking-wider">Telemetry Inspector</h3>
            <div class="grid grid-cols-4 gap-4">
              <div>
                <div class="text-[10px] text-gray-500">Latency</div>
                <div class="text-sm font-mono font-bold text-white">{{ selectedTrace.output.latencyMs }}ms</div>
              </div>
              <div>
                <div class="text-[10px] text-gray-500">Status</div>
                <div class="text-sm font-mono font-bold" :class="selectedTrace.output.success ? 'text-green-400' : 'text-red-400'">
                  {{ selectedTrace.output.success ? 'Success' : 'Failed' }}
                </div>
              </div>
              <div>
                <div class="text-[10px] text-gray-500">Route</div>
                <div class="text-sm font-mono font-bold"
                  :class="selectedTrace.routing.mode === 'stable' ? 'text-green-400' : selectedTrace.routing.mode === 'canary' ? 'text-yellow-400' : 'text-red-400'"
                >{{ selectedTrace.routing.mode }}</div>
              </div>
              <div>
                <div class="text-[10px] text-gray-500">Prompt</div>
                <div class="text-sm font-mono font-bold text-blue-400">{{ selectedTrace.routing.promptName }}</div>
              </div>
            </div>
            <div class="grid grid-cols-4 gap-4 mt-4 pt-4 border-t border-[#1A2240]">
              <div>
                <div class="text-[10px] text-gray-500">Version</div>
                <div class="text-sm font-mono text-purple-400">{{ selectedTrace.routing.version }}</div>
              </div>
              <div>
                <div class="text-[10px] text-gray-500">Reason</div>
                <div class="text-[11px] font-mono text-gray-400 truncate">{{ selectedTrace.routing.reason }}</div>
              </div>
              <div>
                <div class="text-[10px] text-gray-500">Context Hash</div>
                <div class="text-[11px] font-mono text-gray-500 truncate">{{ selectedTrace.input.contextHash || '—' }}</div>
              </div>
              <div>
                <div class="text-[10px] text-gray-500">Log ID</div>
                <div class="text-[10px] font-mono text-gray-500 truncate" :title="selectedTrace.telemetry.logId">{{ selectedTrace.telemetry.logId.slice(0, 8) }}...</div>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

// ─── Types ───
interface RecentTrace {
  requestId: string
  promptName: string
  version: string
  routingMode: string
  success: boolean
  latencyMs: number
  timestamp: number
}

interface TraceNode {
  step: string
  status: 'completed' | 'skipped' | 'failed'
  elapsedMs: number
  detail?: Record<string, any>
}

interface PromptTrace {
  requestId: string
  input: { raw?: string; contextHash?: string }
  routing: { mode: string; promptName: string; version: string; reason?: string }
  execution: { finalPrompt?: string; variables?: Record<string, any> }
  output: { text?: string; success: boolean; latencyMs: number }
  telemetry: { logId: string; entropyContribution?: number; clusterId?: string }
  timeline: TraceNode[]
  timestamp: number
}

// ─── State ───
const loading = ref(false)
const recentTraces = ref<RecentTrace[]>([])
const selectedId = ref<string | null>(null)
const selectedTrace = ref<PromptTrace | { error: string } | null>(null)

// ─── Utils ───
function formatTime(ts: number) {
  return new Date(ts).toLocaleString('zh-CN', { hour12: false })
}

function routingColor(mode: string) {
  return mode === 'stable' ? 'text-green-400' : mode === 'canary' ? 'text-yellow-400' : 'text-red-400'
}

// ─── API ───
async function fetchJSON<T>(url: string, fallback: T): Promise<T> {
  try {
    const controller = new AbortController()
    setTimeout(() => controller.abort(), 3000)
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) return fallback
    const json = await res.json()
    return json.data ?? json ?? fallback
  } catch {
    return fallback
  }
}

async function loadRecentTraces() {
  loading.value = true
  try {
    const data = await fetchJSON<RecentTrace[]>('/api/admin/prompt-telemetry/traces/recent', [])
    recentTraces.value = data
  } finally {
    loading.value = false
  }
}

async function loadTrace(requestId: string) {
  selectedId.value = requestId
  selectedTrace.value = null
  const data = await fetchJSON<PromptTrace | { error: string }>(
    `/api/admin/prompt-telemetry/trace/${requestId}`,
    { error: 'Failed to load trace' }
  )
  selectedTrace.value = data
}

// ─── Mount ───
onMounted(() => {
  loadRecentTraces()
})
</script>

<style scoped>
.trace-console {
  font-family: 'Inter', 'SF Mono', 'Fira Code', monospace;
}
</style>
