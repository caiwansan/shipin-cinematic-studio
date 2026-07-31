<template>
  <div class="min-h-screen" style="background: #070B16">
    <div class="max-w-[1400px] mx-auto px-5 py-6 space-y-5">

      <!-- ═══ 顶部标题 ═══ -->
      <div class="flex items-end justify-between">
        <div>
          <h1 class="text-lg font-bold text-white/90 tracking-wide">昆仑镜 AI Operating Center</h1>
          <p class="text-[10px] text-gray-500 mt-1 font-mono">平台经营驾驶舱 · {{ todayStr }} · 真实 DB 聚合（无 mock）</p>
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
        <!-- ═══ 第一层：核心经营指标（数字大屏） ═══ -->
        <div class="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl p-4">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-xs font-semibold text-white/80 flex items-center gap-2">📊 核心经营指标</h3>
            <span class="text-[9px] text-gray-600">CEO 视角 · 实时</span>
          </div>
          <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <MetricCard label="用户总数" icon="👥" :value="fmt(m?.users.total)" color="#60a5fa"
              :sub="`今日 +${m?.users.todayNew ?? 0} · DAU ${m?.users.dau ?? 0}`"
              :sub-highlight="`VIP ${m?.users.vip ?? 0}`" :loading="loading" />
            <MetricCard label="企业客户" icon="🏢" :value="fmt(m?.enterprises.total)" color="#34d399"
              :sub="`活跃 ${m?.enterprises.active ?? 0} 家 · 订阅 ${m?.enterprises.subscriptions ?? 0}`"
              :sub-highlight="`${m?.enterprises.monthNew ?? 0} 家本月新增`" :loading="loading" />
            <MetricCard label="VIP 会员" icon="💎" :value="fmt(m?.users.vip)" color="#fbbf24"
              :sub="`付费用户 ${m?.users.paidUsers ?? 0}`"
              :sub-highlight="`本月 +${m?.enterprises.monthNew ?? 0} 订阅`" :loading="loading" />
            <MetricCard label="累计收入" icon="💰" :value="`¥${fmtMoney(m?.revenue.total)}`" color="#22d3ee"
              :sub="`本月 ¥${fmtMoney(m?.revenue.month)}`"
              :sub-highlight="`订单 ${m?.revenue.orders ?? 0}`" :loading="loading" />
            <MetricCard label="AI 员工" icon="🤖" :value="fmt(m?.agents.total)" color="#a78bfa"
              :sub="`活跃 ${m?.agents.active ?? 0} 个`"
              :sub-highlight="`成功率 ${overview?.agents.successRate ?? 100}%`" :loading="loading" />
            <MetricCard label="Workspace" icon="🗂️" :value="fmt(m?.workspaces.total ?? m?.workspaces.orgs ?? 0)" color="#f472b6"
              :sub="`组织 ${m?.workspaces.orgs ?? 0} 家`"
              :sub-highlight="`AI 调用 ${fmt(overview?.ai.monthCalls)}`" :loading="loading" />
          </div>
        </div>

        <!-- ═══ 第二层：AI 基础设施 ═══ -->
        <div class="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl p-5">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-xs font-semibold text-white/80 flex items-center gap-2">⚡ AI 基础设施</h3>
            <span class="text-[9px] text-gray-600">调用趋势 · Token · 成本 · Provider</span>
          </div>
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div class="lg:col-span-2 space-y-4">
              <div>
                <div class="text-[10px] text-gray-500 uppercase tracking-wider mb-2">模型调用趋势（近 14 天）</div>
                <div ref="trendEl" class="h-44 w-full"></div>
              </div>
              <div>
                <div class="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Token 消耗趋势（近 14 天）</div>
                <div ref="tokenEl" class="h-24 w-full"></div>
              </div>
            </div>
            <AiHealthPanel :providers="health?.providers || []" :runtime="runtime" :dirty-data="health?.dirtyData" :health="health" />
          </div>
        </div>

        <!-- ═══ 第三/四层：Agent 运营中心 + Workspace 生态地图 ═══ -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <AgentRanking :agents="agents?.agents || []" :active-enterprises="agents?.activeEnterprises" />
          <WorkspaceChart :ranking="workspaces?.ranking || []" :data="workspaces" />
        </div>

        <!-- ═══ 第五/六层：商业增长 + 系统健康 ═══ -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <RevenuePanel :data="revenue" />
          <SystemHealthPanel :data="systemHealth" />
        </div>

        <!-- ═══ 第七层：实时事件流 ═══ -->
        <ActivityTimeline :events="activity?.events || []" />

        <div class="text-center text-[9px] text-gray-700 pb-4">
          昆仑镜 v1.3 · ADMIN-IA-REALITY-04-A 经营驾驶舱 · 治理规则 docs/reality/ADMIN-IA-GOVERNANCE-RULE.md · 脏数据自动排除
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import * as echarts from 'echarts'
// 【安全】项目标准：token 从 token-cache（内存→localStorage auth_token）获取，禁止自定义 key
import { getToken } from '~/utils/token-cache'

definePageMeta({ layout: 'admin-aigc' })

const loading = ref(true)
const error = ref('')
const overview = ref<any>(null)
const health = ref<any>(null)
const workspaces = ref<any>(null)
const agents = ref<any>(null)
const revenue = ref<any>(null)
const activity = ref<any>(null)
const systemHealth = ref<any>(null)

const trendEl = ref<HTMLDivElement | null>(null)
const tokenEl = ref<HTMLDivElement | null>(null)
let trendChart: echarts.ECharts | null = null
let tokenChart: echarts.ECharts | null = null

const todayStr = computed(() => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})

// 第一层指标（新结构 metrics，兼容旧结构）
const m = computed(() => overview.value?.metrics || overview.value)

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
const fmtMoney = (n: any) => {
  const v = Number(n || 0)
  if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M'
  if (v >= 1e4) return (v / 1e4).toFixed(1) + 'w'
  return v.toFixed(0)
}

async function refresh() {
  loading.value = true
  error.value = ''
  try {
    const auth = { headers: { Authorization: `Bearer ${getToken()}` } }
    const [o, h, w, a, r, ac, sh] = await Promise.all([
      fetch('/api/admin/dashboard/overview', auth).then((x) => x.json()),
      fetch('/api/admin/dashboard/ai-health', auth).then((x) => x.json()),
      fetch('/api/admin/dashboard/workspaces', auth).then((x) => x.json()),
      fetch('/api/admin/dashboard/agents', auth).then((x) => x.json()),
      fetch('/api/admin/dashboard/revenue', auth).then((x) => x.json()),
      fetch('/api/admin/dashboard/activity', auth).then((x) => x.json()),
      fetch('/api/admin/dashboard/system-health', auth).then((x) => x.json()),
    ])
    if (o.code !== 0) throw new Error(o.message || 'overview 加载失败')
    overview.value = o.data
    health.value = h.data
    workspaces.value = w.data
    agents.value = a.data
    revenue.value = r.data
    activity.value = ac.data
    systemHealth.value = sh.data
    renderCharts()
  } catch (e: any) {
    error.value = e.message || '加载失败'
  } finally {
    loading.value = false
  }
}

function renderCharts() {
  renderTrend()
  renderToken()
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

function renderToken() {
  if (!tokenEl.value || !health.value?.tokenTrend) return
  if (!tokenChart) tokenChart = echarts.init(tokenEl.value)
  const trend = health.value.tokenTrend || []
  tokenChart.setOption({
    grid: { left: 10, right: 10, top: 16, bottom: 4, containLabel: true },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(13,19,40,0.95)',
      borderColor: 'rgba(167,139,250,0.3)',
      textStyle: { color: '#fff', fontSize: 10 },
      formatter: (p: any) => {
        const i = p[0].dataIndex
        const t = trend[i]
        return t ? `${t.day}<br/>调用 ${t.calls} 次<br/>Tokens ${Number(t.tokens).toLocaleString()}<br/>成本 ¥${t.cost}` : ''
      },
    },
    xAxis: {
      type: 'category',
      data: trend.map((t: any) => t.day.slice(5)),
      axisLabel: { color: '#6b7280', fontSize: 9 },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#6b7280', fontSize: 9, formatter: (v: number) => v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : v >= 1e3 ? (v / 1e3).toFixed(0) + 'K' : v },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
    },
    series: [{
      type: 'line',
      data: trend.map((t: any) => Number(t.tokens)),
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

const onResize = () => {
  trendChart?.resize()
  tokenChart?.resize()
}

onMounted(() => {
  refresh()
  window.addEventListener('resize', onResize)
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  trendChart?.dispose()
  tokenChart?.dispose()
})
</script>
