<template>
  <div class="min-h-screen" style="background: #070B16">
    <div class="max-w-[1400px] mx-auto px-5 py-6 space-y-5">

      <!-- ═══ 顶部标题 ═══ -->
      <div class="flex items-end justify-between">
        <div>
          <h1 class="text-lg font-bold text-white/90 tracking-wide">昆仑镜 AI Operating Center</h1>
          <p class="text-[10px] text-gray-500 mt-1 font-mono">今日运行状态 · {{ todayStr }} · 数据来自真实 DB 聚合（无 mock）</p>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-[9px] px-2.5 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 flex items-center gap-1.5">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> 系统正常
          </span>
          <button @click="refresh" class="text-[10px] px-3 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] text-gray-400 hover:text-white hover:bg-white/[0.06] transition-all cursor-pointer">
            ⟳ 刷新
          </button>
        </div>
      </div>

      <div v-if="error" class="bg-red-900/20 border border-red-800/30 rounded-xl p-4 text-red-400 text-xs">
        {{ error }}
        <button @click="refresh" class="ml-2 underline cursor-pointer">重试</button>
      </div>

      <template v-else>
        <!-- ═══ 第一层：平台健康总览 ═══ -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard label="注册用户" icon="👥" :value="overview?.users.total ?? '—'" color="#60a5fa"
            :sub="`今日 +${overview?.users.todayNew ?? 0} · 本月 +${overview?.users.monthNew ?? 0}`"
            :sub-highlight="`DAU ${overview?.users.dau ?? 0}`" :loading="loading" />
          <MetricCard label="企业 & AI 员工" icon="🏢" :value="overview?.enterprises.total ?? '—'" color="#34d399"
            :sub="`活跃 ${overview?.enterprises.active ?? 0} 家 · AI 员工 ${overview?.enterprises.agents ?? 0} 个`"
            :sub-highlight="`${overview?.enterprises.activeAgents ?? 0} 活跃`" :loading="loading" />
          <MetricCard label="AI 调用（本月）" icon="⚡" :value="fmt(overview?.ai.monthCalls)" color="#818cf8"
            :sub="`今日 ${fmt(overview?.ai.todayCalls)} · 成本 ¥${(overview?.ai.monthCost ?? 0).toFixed(2)}`"
            :sub-highlight="`${fmtTokens(overview?.ai.monthTokens)} tokens`" :loading="loading" />
          <MetricCard label="AI 员工成功率" icon="🎯" :value="`${overview?.agents.successRate ?? 100}%`" color="#fbbf24"
            :sub="`任务 ${overview?.agents.tasks ?? 0} · 失败 ${overview?.agents.errors ?? 0}`"
            :badge="overview?.agents.successRate >= 90 ? '健康' : '关注'" :badge-tone="overview?.agents.successRate >= 90 ? 'ok' : 'warn'" :loading="loading" />
        </div>

        <!-- ═══ 第二层：AI 调用趋势 + 健康中心 ═══ -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div class="lg:col-span-2 rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl p-5">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-xs font-semibold text-white/80 flex items-center gap-2">📈 AI 调用趋势（近 14 天）</h3>
              <div class="flex items-center gap-3 text-[9px] text-gray-500">
                <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-sm bg-indigo-400/70"></span> 调用次数</span>
                <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-sm bg-cyan-400/70"></span> 成本（¥）</span>
              </div>
            </div>
            <div ref="trendEl" class="h-44 w-full"></div>
          </div>
          <AiHealthPanel :providers="health?.providers || []" :runtime="runtime" :dirty-data="health?.dirtyData" />
        </div>

        <!-- ═══ 第三/四层：Workspace + Agent 排行 ═══ -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <WorkspaceChart :ranking="workspaces?.ranking || []" />
          <AgentRanking :agents="agents?.agents || []" />
        </div>

        <!-- ═══ 第五/六层：商业 + 实时事件 ═══ -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <RevenuePanel :data="revenue" />
          <ActivityTimeline :events="activity?.events || []" />
        </div>

        <div class="text-center text-[9px] text-gray-700 pb-4">
          昆仑镜 v1.2 · ADMIN-IA-REALITY-04 T01 数据罗盘 · 脏数据自动排除（dag_execution）
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import * as echarts from 'echarts'

definePageMeta({ layout: 'admin-aigc' })

const loading = ref(true)
const error = ref('')
const overview = ref<any>(null)
const health = ref<any>(null)
const workspaces = ref<any>(null)
const agents = ref<any>(null)
const revenue = ref<any>(null)
const activity = ref<any>(null)

const trendEl = ref<HTMLDivElement | null>(null)
let trendChart: echarts.ECharts | null = null

const todayStr = computed(() => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})

const runtime = computed(() => {
  const r = health.value?.runtime || {}
  return {
    active: r.active ?? 0,
    paused: r.paused ?? 0,
    stopped: r.stopped ?? 0,
    totalTasks: r.totalTasks ?? 0,
  }
})

const fmt = (n: any) => (n == null ? '0' : Number(n).toLocaleString('zh-CN'))
const fmtTokens = (n: any) => {
  const v = Number(n || 0)
  if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M'
  if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K'
  return String(v)
}

async function refresh() {
  loading.value = true
  error.value = ''
  try {
    const auth = { headers: { Authorization: `Bearer ${localStorage.getItem('admin_token') || ''}` } }
    const [o, h, w, a, r, ac] = await Promise.all([
      fetch('/api/admin/dashboard/overview', auth).then((x) => x.json()),
      fetch('/api/admin/dashboard/ai-health', auth).then((x) => x.json()),
      fetch('/api/admin/dashboard/workspaces', auth).then((x) => x.json()),
      fetch('/api/admin/dashboard/agents', auth).then((x) => x.json()),
      fetch('/api/admin/dashboard/revenue', auth).then((x) => x.json()),
      fetch('/api/admin/dashboard/activity', auth).then((x) => x.json()),
    ])
    if (o.code !== 0) throw new Error(o.message || 'overview 加载失败')
    overview.value = o.data
    health.value = h.data
    workspaces.value = w.data
    agents.value = a.data
    revenue.value = r.data
    activity.value = ac.data
    renderTrend()
  } catch (e: any) {
    error.value = e.message || '加载失败'
  } finally {
    loading.value = false
  }
}

function renderTrend() {
  if (!trendEl.value || !overview.value) return
  if (!trendChart) trendChart = echarts.init(trendEl.value)
  const trend = overview.value.trend || []
  trendChart.setOption({
    grid: { left: 10, right: 10, top: 20, bottom: 4, containLabel: true },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(13,19,40,0.95)',
      borderColor: 'rgba(99,102,241,0.3)',
      textStyle: { color: '#fff', fontSize: 10 },
    },
    legend: { show: false },
    xAxis: {
      type: 'category',
      data: trend.map((t: any) => t.date.slice(5)),
      axisLabel: { color: '#6b7280', fontSize: 9 },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
      axisTick: { show: false },
    },
    yAxis: [
      {
        type: 'value',
        axisLabel: { color: '#6b7280', fontSize: 9 },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
      },
      {
        type: 'value',
        axisLabel: { color: '#6b7280', fontSize: 9, formatter: '¥{value}' },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: '调用次数',
        type: 'bar',
        data: trend.map((t: any) => t.calls),
        barWidth: 14,
        itemStyle: {
          borderRadius: [4, 4, 0, 0],
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#818cf8' },
            { offset: 1, color: 'rgba(99,102,241,0.1)' },
          ]),
        },
      },
      {
        name: '成本',
        type: 'line',
        yAxisIndex: 1,
        data: trend.map((t: any) => Number(t.cost.toFixed(2))),
        smooth: true,
        symbol: 'circle',
        symbolSize: 4,
        lineStyle: { color: '#22d3ee', width: 1.5 },
        itemStyle: { color: '#22d3ee' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(34,211,238,0.15)' },
            { offset: 1, color: 'rgba(34,211,238,0)' },
          ]),
        },
      },
    ],
  })
}

const onResize = () => trendChart?.resize()

onMounted(() => {
  refresh()
  window.addEventListener('resize', onResize)
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  trendChart?.dispose()
})
</script>
