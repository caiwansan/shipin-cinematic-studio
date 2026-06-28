<template>
  <div>
    <!-- Header -->
    <div class="flex items-center justify-between mb-4">
      <div>
        <h1 class="text-sm font-semibold text-white/90">Prompt OS 观测控制台</h1>
        <p class="text-[10px] text-gray-500 mt-0.5">OPOS Telemetry Console — 只读观测层</p>
      </div>
      <div class="flex items-center gap-3">
        <span v-if="lastUpdate" class="text-[10px] text-gray-600">最后更新 {{ lastUpdate }}</span>
        <button
          @click="refreshAll"
          :disabled="loading"
          class="px-3 py-1.5 text-[11px] rounded bg-blue-500/20 text-blue-400 border border-blue-500/30
                 hover:bg-blue-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
        >
          {{ loading ? '刷新中...' : '⟳ 刷新' }}
        </button>
      </div>
    </div>

    <!-- Empty State (全数据为空时) -->
    <div v-if="isEmpty" class="mb-6 p-6 rounded-lg border border-yellow-500/20 bg-yellow-500/5">
      <div class="flex items-center gap-3 text-yellow-400/80 text-xs">
        <span>⏳</span>
        <span>No telemetry data yet — System is in cold observation phase. 数据将在用户开始使用后自然流入。</span>
      </div>
    </div>

    <!-- Tab Bar -->
    <div class="flex gap-1 mb-4 border-b border-[#1A2240]">
      <button
        v-for="tab in tabs" :key="tab.id"
        @click="activeTab = tab.id"
        class="px-3 py-2 text-[11px] transition cursor-pointer border-b-2"
        :class="activeTab === tab.id
          ? 'text-blue-400 border-blue-500 bg-blue-500/5'
          : 'text-gray-500 border-transparent hover:text-gray-300 hover:border-gray-700'"
      >
        {{ tab.icon }} {{ tab.label }}
      </button>
    </div>

    <!-- Overview Panel -->
    <div v-if="activeTab === 'overview'" class="space-y-5">
      <!-- KPI Cards -->
      <div class="grid grid-cols-4 gap-4">
        <div class="p-4 rounded-lg bg-[#0D1328] border border-[#1A2240]">
          <div class="text-[10px] text-gray-500 uppercase tracking-wider">Total Calls</div>
          <div class="text-2xl font-mono font-bold text-white mt-1">{{ overview.totalCalls }}</div>
        </div>
        <div class="p-4 rounded-lg bg-[#0D1328] border border-[#1A2240]">
          <div class="text-[10px] text-gray-500 uppercase tracking-wider">Success Rate</div>
          <div class="text-2xl font-mono font-bold mt-1" :class="overview.successRate >= 0.95 ? 'text-green-400' : overview.successRate >= 0.8 ? 'text-yellow-400' : 'text-red-400'">
            {{ (overview.successRate * 100).toFixed(1) }}%
          </div>
        </div>
        <div class="p-4 rounded-lg bg-[#0D1328] border border-[#1A2240]">
          <div class="text-[10px] text-gray-500 uppercase tracking-wider">Avg Latency</div>
          <div class="text-2xl font-mono font-bold text-white mt-1">{{ overview.avgLatency }}ms</div>
        </div>
        <div class="p-4 rounded-lg bg-[#0D1328] border border-[#1A2240]">
          <div class="text-[10px] text-gray-500 uppercase tracking-wider">Active Prompts</div>
          <div class="text-2xl font-mono font-bold text-white mt-1">{{ overview.activePrompts }}</div>
        </div>
      </div>

      <!-- Top Prompts Bar Chart -->
      <div class="p-4 rounded-lg bg-[#0D1328] border border-[#1A2240]">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-xs font-semibold text-white/70">Top Prompts</h3>
          <span class="text-[10px] text-gray-600">按调用量排序</span>
        </div>
        <div v-if="overview.topPrompts.length === 0" class="h-40 flex items-center justify-center text-[11px] text-gray-600">
          等待数据...
        </div>
        <v-chart v-else :option="topPromptsChartOption" autoresize style="height:220px" />
      </div>
    </div>

    <!-- Routing Panel -->
    <div v-if="activeTab === 'routing'" class="space-y-5">
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <!-- Pie Chart -->
        <div class="p-4 rounded-lg bg-[#0D1328] border border-[#1A2240]">
          <h3 class="text-xs font-semibold text-white/70 mb-3">Routing Distribution</h3>
          <div v-if="routingData.length === 0" class="h-48 flex items-center justify-center text-[11px] text-gray-600">
            等待数据...
          </div>
          <v-chart v-else :option="routingPieOption" autoresize style="height:240px" />
        </div>
        <!-- Entropy Trend (placeholder) -->
        <div class="p-4 rounded-lg bg-[#0D1328] border border-[#1A2240]">
          <h3 class="text-xs font-semibold text-white/70 mb-3">Routing Entropy</h3>
          <div v-if="routingData.length === 0" class="h-48 flex items-center justify-center text-[11px] text-gray-600">
            等待数据...
          </div>
          <div v-else class="text-center py-16">
            <div class="text-4xl font-mono font-bold text-blue-400">{{ avgEntropy.toFixed(3) }}</div>
            <div class="text-[10px] text-gray-500 mt-2">平均 Entropy</div>
            <div class="text-[10px] text-gray-600 mt-1">较低值表示路由稳定收敛</div>
          </div>
        </div>
      </div>
      <!-- Per-prompt routing table -->
      <div class="p-4 rounded-lg bg-[#0D1328] border border-[#1A2240]">
        <h3 class="text-xs font-semibold text-white/70 mb-3">Per-Prompt Routing</h3>
        <div v-if="routingData.length === 0" class="h-20 flex items-center justify-center text-[11px] text-gray-600">
          等待数据...
        </div>
        <table v-else class="w-full text-[11px]">
          <thead>
            <tr class="text-gray-500 border-b border-[#1A2240]">
              <th class="text-left py-2 font-medium">Prompt</th>
              <th class="text-right py-2 font-medium">Stable</th>
              <th class="text-right py-2 font-medium">Canary</th>
              <th class="text-right py-2 font-medium">Override</th>
              <th class="text-right py-2 font-medium">Entropy</th>
              <th class="text-right py-2 font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in routingData" :key="r.promptName" class="border-b border-[#1A2240]/50 hover:bg-white/5">
              <td class="py-2 text-white/80 font-mono">{{ r.promptName }}</td>
              <td class="py-2 text-right text-green-400">{{ r.stablePercent }}%</td>
              <td class="py-2 text-right text-yellow-400">{{ r.canaryPercent }}%</td>
              <td class="py-2 text-right text-red-400">{{ r.overridePercent }}%</td>
              <td class="py-2 text-right font-mono text-blue-300">{{ r.entropy.toFixed(3) }}</td>
              <td class="py-2 text-right text-gray-400">{{ r.total }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Version Panel -->
    <div v-if="activeTab === 'version'" class="space-y-5">
      <div class="p-4 rounded-lg bg-[#0D1328] border border-[#1A2240]">
        <h3 class="text-xs font-semibold text-white/70 mb-3">Version Usage per Prompt</h3>
        <div v-if="versionData.length === 0" class="h-40 flex items-center justify-center text-[11px] text-gray-600">
          等待数据...
        </div>
        <v-chart v-else :option="versionStackedOption" autoresize style="height:280px" />
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div class="p-4 rounded-lg bg-[#0D1328] border border-[#1A2240]">
          <h3 class="text-xs font-semibold text-white/70 mb-3">Version Stats</h3>
          <div v-if="versionData.length === 0" class="h-20 flex items-center justify-center text-[11px] text-gray-600">
            等待数据...
          </div>
          <div v-else class="space-y-2">
            <div v-for="v in versionSummary" :key="v.version" class="flex items-center justify-between text-[11px]">
              <span class="text-gray-400">v{{ v.version }}</span>
              <span class="text-white/80 font-mono">{{ v.count }} calls</span>
              <span class="text-gray-500">{{ v.percent }}%</span>
            </div>
          </div>
        </div>
        <div class="p-4 rounded-lg bg-[#0D1328] border border-[#1A2240]">
          <h3 class="text-xs font-semibold text-white/70 mb-3">Avg Latency by Version</h3>
          <div v-if="versionData.length === 0" class="h-20 flex items-center justify-center text-[11px] text-gray-600">
            等待数据...
          </div>
          <v-chart v-else :option="latencyByVersionOption" autoresize style="height:120px" />
        </div>
      </div>
    </div>

    <!-- Failure Panel -->
    <div v-if="activeTab === 'failure'" class="space-y-5">
      <div v-if="failureData.length === 0" class="p-8 rounded-lg bg-[#0D1328] border border-[#1A2240] flex flex-col items-center justify-center gap-2">
        <span class="text-2xl">✅</span>
        <span class="text-[11px] text-gray-500">No failure clusters detected.</span>
        <span class="text-[10px] text-gray-600">系统当前无失败聚类</span>
      </div>
      <div v-else class="space-y-3">
        <div v-for="(cluster, i) in failureData" :key="i"
          class="p-4 rounded-lg bg-[#0D1328] border border-[#1A2240]"
        >
          <div class="flex items-center justify-between mb-2">
            <h4 class="text-xs font-semibold text-white/70 font-mono">{{ cluster.promptName }}</h4>
            <span class="text-[11px] text-red-400 font-mono">{{ cluster.failureCount }} fails</span>
          </div>
          <div v-if="cluster.samples" class="space-y-1 mt-2">
            <div v-for="(sample, si) in cluster.samples.slice(0, 3)" :key="si"
              class="p-2 rounded bg-[#060A18] text-[10px] text-gray-500 font-mono truncate"
            >
              {{ sample }}
            </div>
            <div v-if="cluster.samples.length > 3" class="text-[10px] text-gray-600">
              ... 还有 {{ cluster.samples.length - 3 }} 条
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Drift Timeline Panel (across all tabs) -->
    <div v-if="activeTab === 'drift'" class="space-y-5">
      <div class="p-4 rounded-lg bg-[#0D1328] border border-[#1A2240]">
        <h3 class="text-xs font-semibold text-white/70 mb-3">Version Usage Over Time</h3>
        <div v-if="driftData.length === 0" class="h-48 flex items-center justify-center text-[11px] text-gray-600">
          等待数据...
        </div>
        <v-chart v-else :option="driftLineOption" autoresize style="height:300px" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { BarChart, PieChart, LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'
import VChart from 'vue-echarts'

use([CanvasRenderer, BarChart, PieChart, LineChart, GridComponent, TooltipComponent, LegendComponent])

// ─── Types ───
interface TopPrompt { name: string; calls: number }
interface Overview { totalCalls: number; successRate: number; avgLatency: number; activePrompts: number; topPrompts: TopPrompt[] }
interface RoutingItem { promptName: string; stablePercent: number; canaryPercent: number; overridePercent: number; total: number; entropy: number }
interface VersionItem { promptName: string; version: string; totalCalls: number; successCalls: number; avgLatency: number; failureRate: number }
interface FailureCluster { promptName: string; failureCount: number; samples: string[] }
interface DriftPoint { timestamp: string; version: string; usage: number }

// ─── State ───
const loading = ref(false)
const lastUpdate = ref('')
const activeTab = ref('overview')
const isEmpty = ref(false)

const overview = ref<Overview>({ totalCalls: 0, successRate: 1, avgLatency: 0, activePrompts: 0, topPrompts: [] })
const routingData = ref<RoutingItem[]>([])
const versionData = ref<VersionItem[]>([])
const failureData = ref<FailureCluster[]>([])
const driftData = ref<DriftPoint[]>([])

const tabs = [
  { id: 'overview', label: 'Overview', icon: '📊' },
  { id: 'routing', label: 'Routing', icon: '🔀' },
  { id: 'version', label: 'Version', icon: '🧬' },
  { id: 'failure', label: 'Failure', icon: '💥' },
  { id: 'drift', label: 'Drift', icon: '📈' },
]

// ─── Computed ───
const avgEntropy = computed(() => {
  if (routingData.value.length === 0) return 0
  return routingData.value.reduce((s, r) => s + r.entropy, 0) / routingData.value.length
})

const versionSummary = computed(() => {
  const map = new Map<string, { count: number; latencies: number[] }>()
  for (const v of versionData.value) {
    if (!map.has(v.version)) map.set(v.version, { count: 0, latencies: [] })
    const entry = map.get(v.version)!
    entry.count += v.totalCalls
    entry.latencies.push(v.avgLatency)
  }
  const total = Array.from(map.values()).reduce((s, e) => s + e.count, 0)
  return Array.from(map.entries()).map(([version, data]) => ({
    version,
    count: data.count,
    avgLatency: data.latencies.length > 0 ? Math.round(data.latencies.reduce((a, b) => a + b, 0) / data.latencies.length) : 0,
    percent: total > 0 ? Math.round((data.count / total) * 10000) / 100 : 0,
  })).sort((a, b) => parseInt(a.version) - parseInt(b.version))
})

// ─── ECharts Options ───
const topPromptsChartOption = computed(() => ({
  tooltip: { trigger: 'axis' as const, axisPointer: { type: 'shadow' as const } },
  grid: { left: 20, right: 20, top: 10, bottom: 30, containLabel: true },
  xAxis: { type: 'category' as const, data: overview.value.topPrompts.map(p => p.name), axisLabel: { color: '#888', fontSize: 10, rotate: 30 }, axisLine: { show: false }, axisTick: { show: false } },
  yAxis: { type: 'value' as const, axisLabel: { color: '#666', fontSize: 10 }, splitLine: { lineStyle: { color: '#1A2240' } } },
  series: [{ type: 'bar', data: overview.value.topPrompts.map(p => p.calls), itemStyle: { color: '#3B82F6', borderRadius: [3, 3, 0, 0] }, barMaxWidth: 30 }],
}))

const routingPieOption = computed(() => {
  const totals = routingData.value.reduce((s, r) => ({
    stable: s.stable + r.stablePercent / 100 * r.total,
    canary: s.canary + r.canaryPercent / 100 * r.total,
    override: s.override + r.overridePercent / 100 * r.total,
  }), { stable: 0, canary: 0, override: 0 })
  const total = totals.stable + totals.canary + totals.override
  return {
    tooltip: { trigger: 'item' as const, formatter: '{b}: {c} ({d}%)' },
    series: [{
      type: 'pie', radius: ['45%', '70%'], center: ['50%', '50%'],
      data: [
        { name: `Stable (${Math.round(totals.stable)})`, value: Math.round(totals.stable), itemStyle: { color: '#22C55E' } },
        { name: `Canary (${Math.round(totals.canary)})`, value: Math.round(totals.canary), itemStyle: { color: '#EAB308' } },
        { name: `Override (${Math.round(totals.override)})`, value: Math.round(totals.override), itemStyle: { color: '#EF4444' } },
      ],
      label: { color: '#aaa', fontSize: 11, formatter: '{b}' },
    }],
  }
})

const versionStackedOption = computed(() => {
  const prompts = [...new Set(versionData.value.map(v => v.promptName))]
  const versions = [...new Set(versionData.value.map(v => v.version))].sort()
  return {
    tooltip: { trigger: 'axis' as const },
    legend: { data: versions.map(v => `v${v}`), textStyle: { color: '#888', fontSize: 10 } },
    grid: { left: 20, right: 20, top: 30, bottom: 30, containLabel: true },
    xAxis: { type: 'category' as const, data: prompts, axisLabel: { color: '#888', fontSize: 10, rotate: 15 } },
    yAxis: { type: 'value' as const, axisLabel: { color: '#666' }, splitLine: { lineStyle: { color: '#1A2240' } } },
    series: versions.map(v => ({
      name: `v${v}`, type: 'bar' as const, stack: 'total',
      data: prompts.map(p => versionData.value.filter(x => x.promptName === p && x.version === v).reduce((s, x) => s + x.totalCalls, 0)),
      itemStyle: { color: v === '1' ? '#3B82F6' : v === '2' ? '#8B5CF6' : '#EC4899', borderRadius: [0, 0, 0, 0] },
    })),
  }
})

const latencyByVersionOption = computed(() => ({
  tooltip: { trigger: 'axis' as const },
  grid: { left: 20, right: 20, top: 10, bottom: 25, containLabel: true },
  xAxis: { type: 'category' as const, data: versionSummary.value.map(v => `v${v.version}`), axisLabel: { color: '#888', fontSize: 10 } },
  yAxis: { type: 'value' as const, axisLabel: { color: '#666', fontSize: 10, formatter: '{value}ms' }, splitLine: { lineStyle: { color: '#1A2240' } } },
  series: [{ type: 'bar', data: versionSummary.value.map(v => v.avgLatency), itemStyle: { color: '#8B5CF6', borderRadius: [3, 3, 0, 0] }, barMaxWidth: 24 }],
}))

const driftLineOption = computed(() => {
  const versions = [...new Set(driftData.value.map(d => d.version))].sort()
  const timePoints = [...new Set(driftData.value.map(d => d.timestamp))].sort()
  return {
    tooltip: { trigger: 'axis' as const },
    legend: { data: versions.map(v => `v${v}`), textStyle: { color: '#888', fontSize: 10 } },
    grid: { left: 20, right: 20, top: 30, bottom: 30, containLabel: true },
    xAxis: { type: 'category' as const, data: timePoints.map(t => t.slice(5, 16)), axisLabel: { color: '#888', fontSize: 10, rotate: 30 } },
    yAxis: { type: 'value' as const, axisLabel: { color: '#666' }, splitLine: { lineStyle: { color: '#1A2240' } } },
    series: versions.map((v, i) => ({
      name: `v${v}`, type: 'line' as const, smooth: true,
      data: timePoints.map(t => driftData.value.filter(d => d.timestamp === t && d.version === v).reduce((s, d) => s + d.usage, 0)),
      itemStyle: { color: ['#3B82F6', '#8B5CF6', '#EC4899'][i] || '#10B981' },
      lineStyle: { width: 2 },
      symbol: 'circle', symbolSize: 4,
    })),
  }
})

// ─── API ───
async function fetchJSON<T>(url: string, fallback: T): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 3000)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) return fallback
    const json = await res.json()
    return json.data ?? json ?? fallback
  } catch {
    return fallback
  } finally {
    clearTimeout(timeout)
  }
}

async function refreshAll() {
  loading.value = true
  try {
    const agg = await fetchJSON('/api/admin/prompt-telemetry/aggregate', null)
    const [ov, rt, vr, fl, df] = await Promise.all([
      fetchJSON<Overview>('/api/admin/prompt-telemetry/overview', { totalCalls: 0, successRate: 1, avgLatency: 0, activePrompts: 0, topPrompts: [] }),
      fetchJSON<RoutingItem[]>('/api/admin/prompt-telemetry/routing-behavior', []),
      fetchJSON<VersionItem[]>('/api/admin/prompt-telemetry/version-distribution', []),
      fetchJSON<FailureCluster[]>('/api/admin/prompt-telemetry/failure-clusters', []),
      fetchJSON<DriftPoint[]>('/api/admin/prompt-telemetry/drift-timeline', []),
    ])
    overview.value = ov
    routingData.value = rt
    versionData.value = vr
    failureData.value = fl
    driftData.value = df
    isEmpty.value = ov.totalCalls === 0 && rt.length === 0 && vr.length === 0 && fl.length === 0
    lastUpdate.value = new Date().toLocaleTimeString('zh-CN', { hour12: false })
  } finally {
    loading.value = false
  }
}

// ─── Auto Refresh ───
let interval: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  refreshAll()
  interval = setInterval(refreshAll, 30000)
})
onUnmounted(() => { if (interval) clearInterval(interval) })
</script>
