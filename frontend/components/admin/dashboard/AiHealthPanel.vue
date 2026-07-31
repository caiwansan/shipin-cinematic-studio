<template>
  <div class="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl p-5">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-xs font-semibold text-white/80 flex items-center gap-2">🩺 AI 基础设施</h3>
      <span class="text-[9px] text-gray-600">近 24h · 实时</span>
    </div>

    <!-- 模型成功率 + 平均响应 -->
    <div class="grid grid-cols-2 gap-2 mb-4">
      <div class="px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.05]">
        <div class="text-[9px] text-gray-500">模型成功率</div>
        <div class="text-lg font-bold text-emerald-400 font-mono mt-0.5">{{ taskHealth.successRate }}%</div>
        <div class="text-[9px] text-gray-600">{{ taskHealth.total }} 次任务</div>
      </div>
      <div class="px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.05]">
        <div class="text-[9px] text-gray-500">平均响应时间</div>
        <div class="text-lg font-bold text-cyan-400 font-mono mt-0.5">{{ fmtMs(taskHealth.avgDurationMs) }}</div>
        <div class="text-[9px] text-gray-600">累计成本 ¥{{ taskHealth.cost?.toFixed?.(2) ?? '0.00' }}</div>
      </div>
    </div>

    <!-- Token 消耗趋势 -->
    <div class="mb-4">
      <div class="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Token 消耗趋势（近 14 天）</div>
      <div ref="tokenEl" class="h-20 w-full"></div>
    </div>

    <!-- 模型成本排行 -->
    <div class="mb-4">
      <div class="text-[10px] text-gray-500 uppercase tracking-wider mb-2">模型成本排行（近 30 天）</div>
      <div class="space-y-1.5">
        <div v-for="(c, i) in costRankTop" :key="c.provider"
          class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.05]">
          <span class="w-4 text-center text-[10px]">{{ ['🥇','🥈','🥉'][i] || '·' }}</span>
          <span class="text-[10px] text-white/70 flex-1 truncate">{{ providerName(c.provider) }}</span>
          <span class="text-[9px] text-gray-500">{{ c.calls }} 次</span>
          <span class="text-[10px] text-amber-400 font-mono">¥{{ c.cost.toFixed(2) }}</span>
        </div>
        <div v-if="costRankTop.length === 0" class="text-center text-[10px] text-gray-600 py-2">近 30 天无调用</div>
      </div>
    </div>

    <!-- Model Provider -->
    <div class="mb-4">
      <div class="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Model Provider · {{ providers.length }}</div>
      <div class="grid grid-cols-2 gap-2">
        <div v-for="p in providers.slice(0, 8)" :key="p.id"
          class="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.05]">
          <div class="flex items-center gap-2">
            <span class="w-1.5 h-1.5 rounded-full" :class="statusDot(p.status)"></span>
            <span class="text-[11px] text-white/70">{{ p.name }}</span>
          </div>
          <span class="text-[9px] text-gray-600">{{ statusLabel(p.status) }}</span>
        </div>
        <div v-if="providers.length === 0" class="col-span-2 text-center text-[10px] text-gray-600 py-4">暂无 Provider 数据</div>
      </div>
    </div>

    <!-- Runtime -->
    <div>
      <div class="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Agent Runtime</div>
      <div class="grid grid-cols-4 gap-2 text-center">
        <div class="px-2 py-3 rounded-lg bg-white/[0.03] border border-white/[0.05]">
          <div class="text-lg font-bold text-emerald-400 font-mono">{{ runtime.active }}</div>
          <div class="text-[9px] text-gray-600 mt-0.5">活跃</div>
        </div>
        <div class="px-2 py-3 rounded-lg bg-white/[0.03] border border-white/[0.05]">
          <div class="text-lg font-bold text-amber-400 font-mono">{{ runtime.paused }}</div>
          <div class="text-[9px] text-gray-600 mt-0.5">暂停</div>
        </div>
        <div class="px-2 py-3 rounded-lg bg-white/[0.03] border border-white/[0.05]">
          <div class="text-lg font-bold text-gray-400 font-mono">{{ runtime.stopped }}</div>
          <div class="text-[9px] text-gray-600 mt-0.5">停止</div>
        </div>
        <div class="px-2 py-3 rounded-lg bg-white/[0.03] border border-white/[0.05]">
          <div class="text-lg font-bold text-blue-400 font-mono">{{ runtime.totalTasks }}</div>
          <div class="text-[9px] text-gray-600 mt-0.5">累计任务</div>
        </div>
      </div>
      <div v-if="dirtyData?.dagExecutionCount > 0" class="mt-3 px-3 py-2 rounded-lg bg-amber-500/[0.06] border border-amber-500/20 text-[9px] text-amber-400/80">
        ⚠️ 已排除 {{ dirtyData.dagExecutionCount.toLocaleString() }} 条盘古斧调试台脏数据（dag_execution）
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import * as echarts from 'echarts'

const props = defineProps<{
  providers: any[]
  runtime: { active: number; paused: number; stopped: number; totalTasks: number }
  dirtyData?: { dagExecutionCount: number }
  health?: any
}>()

const tokenEl = ref<HTMLDivElement | null>(null)
let tokenChart: echarts.ECharts | null = null

const taskHealth = computed(() => props.health?.taskHealth || { successRate: 100, total: 0, avgDurationMs: 0, cost: 0 })
const costRankTop = computed(() => (props.health?.costRank || []).slice(0, 5))

const fmtMs = (ms: number) => {
  if (!ms) return '—'
  if (ms < 1000) return ms + 'ms'
  return (ms / 1000).toFixed(1) + 's'
}

const providerName = (code: string) => {
  const map: Record<string, string> = { deepseek: 'DeepSeek', zhipu: '智谱 GLM', openai: 'OpenAI', qwen: '通义千问', longcat: 'LongCat', user_byok: '用户 BYOK' }
  return map[code] || code
}

const statusDot = (s: string) => ({
  ok: 'bg-emerald-400',
  healthy: 'bg-emerald-400',
  failed: 'bg-red-400',
  decrypt_error: 'bg-red-400',
  disabled: 'bg-gray-500',
  untested: 'bg-amber-400',
}[s] || 'bg-gray-500')

const statusLabel = (s: string) => ({
  ok: '正常',
  healthy: '正常',
  failed: '失败',
  decrypt_error: '解密失败',
  disabled: '禁用',
  untested: '未测',
}[s] || s || '—')

function renderToken() {
  if (!tokenEl.value) return
  if (!tokenChart) tokenChart = echarts.init(tokenEl.value)
  const trend = props.health?.tokenTrend || []
  tokenChart.setOption({
    grid: { left: 4, right: 4, top: 8, bottom: 0, containLabel: true },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(13,19,40,0.95)',
      borderColor: 'rgba(99,102,241,0.3)',
      textStyle: { color: '#fff', fontSize: 9 },
      formatter: (p: any) => {
        const i = p[0].dataIndex
        const t = trend[i]
        return t ? `${t.day}<br/>调用 ${t.calls} 次<br/>Tokens ${t.tokens.toLocaleString()}` : ''
      },
    },
    xAxis: {
      type: 'category',
      data: trend.map((t: any) => t.day.slice(5)),
      axisLabel: { color: '#6b7280', fontSize: 8, interval: 2 },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#6b7280', fontSize: 8, formatter: (v: number) => v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : v >= 1e3 ? (v / 1e3).toFixed(0) + 'K' : v },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
    },
    series: [{
      type: 'line',
      data: trend.map((t: any) => t.tokens),
      smooth: true,
      symbol: 'none',
      lineStyle: { color: '#a78bfa', width: 1.5 },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(167,139,250,0.25)' },
          { offset: 1, color: 'rgba(167,139,250,0)' },
        ]),
      },
    }],
  })
}

const onResize = () => tokenChart?.resize()
watch(() => props.health, renderToken, { deep: true })

onMounted(() => {
  renderToken()
  window.addEventListener('resize', onResize)
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  tokenChart?.dispose()
})
</script>
