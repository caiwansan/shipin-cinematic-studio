<template>
  <div class="min-h-screen" style="background: #070B16">
    <div class="max-w-[1400px] mx-auto px-5 py-6 space-y-5">

      <!-- ═══ 顶部标题 ═══ -->
      <div class="flex items-end justify-between">
        <div>
          <h1 class="text-xl font-bold text-white/90 tracking-wide" style="background: linear-gradient(90deg,#fff,#60a5fa); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
            昆仑镜 CEO 数据罗盘
          </h1>
          <p class="text-[10px] text-gray-500 mt-1 font-mono">平台经营生命体 · {{ todayStr }} · 全部真实 DB 聚合（无 mock）</p>
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
        <!-- ═══ 第一层：平台核心经营指标 ═══ -->
        <KpiOverview :m="overview?.metrics" :loading="loading" />

        <!-- ═══ 第二层：用户增长中心 ═══ -->
        <UserGrowthPanel :data="users" />

        <!-- ═══ 第三层：商业经营中心 ═══ -->
        <RevenueCockpit :data="revenue" />

        <!-- ═══ 第四层：VIP 经营中心 ═══ -->
        <VipPanel :data="vip" />

        <!-- ═══ 第五层：Workspace 生态地图 ═══ -->
        <WorkspaceChart :ranking="workspace?.ranking || []" :data="workspace" />

        <!-- ═══ 第六层：用户区域分布 ═══ -->
        <GeographyPanel :data="geography" />

        <!-- ═══ 第七层：Agent 运营中心 ═══ -->
        <AgentRanking :agents="agents?.agents || []" :active-enterprises="agents?.activeEnterprises" />

        <!-- ═══ 第八层：AI 基础设施中心（技术指标降位） ═══ -->
        <div class="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl p-5">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-xs font-semibold text-white/80 flex items-center gap-2">⚡ AI 基础设施 + 系统健康</h3>
            <span class="text-[9px] text-gray-600">第八层 · 技术指标</span>
          </div>
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div class="lg:col-span-2">
              <div>
                <div class="text-[10px] text-gray-500 uppercase tracking-wider mb-2">模型调用趋势（近 14 天）</div>
                <div ref="trendEl" class="h-40 w-full"></div>
              </div>
              <div class="mt-4">
                <AiHealthPanel :providers="infra?.providers || []" :runtime="runtime" :dirty-data="infra?.dirtyData" :data="infra" />
              </div>
            </div>
            <SystemHealthPanel :data="infra" />
          </div>
        </div>

        <!-- ═══ 第九层：实时运营事件流 ═══ -->
        <ActivityTimeline :events="events?.events || []" />

        <div class="text-center text-[9px] text-gray-700 pb-4">
          昆仑镜 v1.4 · ADMIN-IA-REALITY-04-B CEO 数据罗盘 · 9 端点 · 治理规则 docs/reality/ADMIN-IA-GOVERNANCE-RULE.md
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
const users = ref<any>(null)
const revenue = ref<any>(null)
const vip = ref<any>(null)
const workspace = ref<any>(null)
const geography = ref<any>(null)
const agents = ref<any>(null)
const infra = ref<any>(null)
const events = ref<any>(null)

const trendEl = ref<HTMLDivElement | null>(null)
let trendChart: echarts.ECharts | null = null

const todayStr = computed(() => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})

const runtime = computed(() => {
  const r = infra.value?.runtime || {}
  return {
    active: r.active ?? 0,
    paused: r.paused ?? 0,
    stopped: r.stopped ?? 0,
    totalTasks: r.totalTasks ?? 0,
  }
})

const fmt = (n: any) => (n == null ? '0' : Number(n).toLocaleString('zh-CN'))

async function refresh() {
  loading.value = true
  error.value = ''
  try {
    const auth = { headers: { Authorization: `Bearer ${getToken()}` } }
    const [o, u, r, v, w, g, a, i, e] = await Promise.all([
      fetch('/api/admin/dashboard/overview', auth).then((x) => x.json()),
      fetch('/api/admin/dashboard/users', auth).then((x) => x.json()),
      fetch('/api/admin/dashboard/revenue', auth).then((x) => x.json()),
      fetch('/api/admin/dashboard/vip', auth).then((x) => x.json()),
      fetch('/api/admin/dashboard/workspace', auth).then((x) => x.json()),
      fetch('/api/admin/dashboard/geography', auth).then((x) => x.json()),
      fetch('/api/admin/dashboard/agents', auth).then((x) => x.json()),
      fetch('/api/admin/dashboard/infrastructure', auth).then((x) => x.json()),
      fetch('/api/admin/dashboard/events', auth).then((x) => x.json()),
    ])
    if (o.code !== 0) throw new Error(o.message || 'overview 加载失败')
    overview.value = o.data
    users.value = u.data
    revenue.value = r.data
    vip.value = v.data
    workspace.value = w.data
    geography.value = g.data
    agents.value = a.data
    infra.value = i.data
    events.value = e.data
    renderTrend()
  } catch (e: any) {
    error.value = e.message || '加载失败'
  } finally {
    loading.value = false
  }
}

function renderTrend() {
  if (!trendEl.value || !infra.value?.tokenTrend) return
  if (!trendChart) trendChart = echarts.init(trendEl.value)
  const trend = infra.value.tokenTrend || []
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
      data: trend.map((t: any) => t.day.slice(5)),
      axisLabel: { color: '#6b7280', fontSize: 9 },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
      axisTick: { show: false },
    },
    yAxis: [
      {
        type: 'value',
        name: '调用',
        axisLabel: { color: '#6b7280', fontSize: 9 },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
      },
      {
        type: 'value',
        name: 'Tokens',
        axisLabel: { color: '#6b7280', fontSize: 9, formatter: (v: number) => v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : v >= 1e3 ? (v / 1e3).toFixed(0) + 'K' : v },
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
        name: 'Tokens',
        type: 'line',
        yAxisIndex: 1,
        data: trend.map((t: any) => Number(t.tokens)),
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
