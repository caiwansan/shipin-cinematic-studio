<template>
  <div class="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl p-5">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-xs font-semibold text-white/80 flex items-center gap-2">💰 商业经营中心</h3>
      <span class="text-[9px] text-gray-600">PaymentOrder · Subscription</span>
    </div>

    <div v-if="!data" class="text-center py-10 text-[10px] text-gray-600">加载中...</div>

    <template v-else>
      <!-- 收入大数 -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
        <div class="px-3 py-3 rounded-lg bg-white/[0.03] border border-white/[0.05]">
          <div class="text-[9px] text-gray-500">今日收入</div>
          <div class="text-lg font-bold text-white/90 font-mono mt-0.5">¥{{ data.todayRevenue.toFixed(2) }}</div>
        </div>
        <div class="px-3 py-3 rounded-lg bg-white/[0.03] border border-white/[0.05]">
          <div class="text-[9px] text-gray-500">本月收入</div>
          <div class="text-lg font-bold text-cyan-400 font-mono mt-0.5">¥{{ data.monthRevenue.toFixed(2) }}</div>
        </div>
        <div class="px-3 py-3 rounded-lg bg-white/[0.03] border border-white/[0.05]">
          <div class="text-[9px] text-gray-500">年收入</div>
          <div class="text-lg font-bold text-white/90 font-mono mt-0.5">¥{{ data.yearRevenue.toFixed(2) }}</div>
        </div>
        <div class="px-3 py-3 rounded-lg bg-white/[0.03] border border-white/[0.05]">
          <div class="text-[9px] text-gray-500">累计收入</div>
          <div class="text-lg font-bold text-emerald-400 font-mono mt-0.5">¥{{ data.totalRevenue.toFixed(2) }}</div>
        </div>
      </div>

      <!-- ARPU + 付费用户 + 续费率 -->
      <div class="grid grid-cols-3 gap-2 mb-4">
        <div class="px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.05] text-center">
          <div class="text-base font-bold text-indigo-400 font-mono">¥{{ data.arpu }}</div>
          <div class="text-[8px] text-gray-600 mt-0.5">ARPU</div>
        </div>
        <div class="px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.05] text-center">
          <div class="text-base font-bold text-white/90 font-mono">{{ data.paidUsers }}</div>
          <div class="text-[8px] text-gray-600 mt-0.5">付费用户</div>
        </div>
        <div class="px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.05] text-center">
          <div class="text-base font-bold text-emerald-400 font-mono">{{ data.enterprise.renewalRate }}%</div>
          <div class="text-[8px] text-gray-600 mt-0.5">企业续费率</div>
        </div>
      </div>

      <!-- 收入来源构成 -->
      <div class="mb-4">
        <div class="text-[10px] text-gray-500 uppercase tracking-wider mb-2">收入来源构成</div>
        <div class="space-y-1.5">
          <div v-for="(s, i) in data.sources" :key="s.key"
            class="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.05]">
            <span class="text-sm">{{ ['🏢', '💎', '🤖', '🛒'][i] }}</span>
            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between">
                <span class="text-[10px] text-white/70">{{ s.name }}</span>
                <span class="text-[10px] text-amber-400 font-mono">¥{{ s.amount.toFixed(2) }}</span>
              </div>
              <div class="mt-1 h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                <div class="h-full rounded-full" :style="{ width: srcWidth(s.amount), background: srcColor(i) }"></div>
              </div>
              <div class="text-[8px] text-gray-600 mt-0.5">{{ s.desc }} · {{ srcPct(s.amount) }}%</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 企业订阅详情 -->
      <div class="mb-4 px-3 py-2.5 rounded-lg bg-indigo-500/[0.05] border border-indigo-500/15">
        <div class="flex items-center justify-between">
          <span class="text-[10px] text-white/70">🏢 企业订阅</span>
          <span class="text-[9px] text-indigo-300/80 font-mono">{{ data.enterprise.active }} 活跃 / {{ data.enterprise.total }} 总</span>
        </div>
        <div class="grid grid-cols-3 gap-2 mt-2 text-center">
          <div class="px-2 py-1.5 rounded bg-white/[0.03]">
            <div class="text-sm font-bold text-emerald-400 font-mono">{{ data.enterprise.renewalRate }}%</div>
            <div class="text-[8px] text-gray-600 mt-0.5">续费率</div>
          </div>
          <div class="px-2 py-1.5 rounded bg-white/[0.03]">
            <div class="text-sm font-bold text-cyan-400 font-mono">{{ data.enterprise.avgLifecycleDays }}天</div>
            <div class="text-[8px] text-gray-600 mt-0.5">平均周期</div>
          </div>
          <div class="px-2 py-1.5 rounded bg-white/[0.03]">
            <div class="text-sm font-bold text-amber-400 font-mono">¥{{ data.enterprise.revenue.toFixed(0) }}</div>
            <div class="text-[8px] text-gray-600 mt-0.5">活跃订阅收入</div>
          </div>
        </div>
        <div class="flex flex-wrap gap-1.5 mt-2">
          <span v-for="p in data.enterprise.planBreakdown" :key="p.name"
            class="text-[9px] px-2 py-1 rounded-full border border-white/[0.08] bg-white/[0.03] text-white/60">
            {{ p.name }} × {{ p.count }} · ¥{{ p.revenue.toFixed(0) }}
          </span>
        </div>
      </div>

      <!-- 月度趋势 -->
      <div>
        <div class="text-[10px] text-gray-500 uppercase tracking-wider mb-2">月度收入趋势（近 6 月）</div>
        <div ref="trendEl" class="h-28 w-full"></div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue'
import * as echarts from 'echarts'

const props = defineProps<{ data: any }>()
const trendEl = ref<HTMLDivElement | null>(null)
let chart: echarts.ECharts | null = null

const totalSrc = computed(() => (props.data?.sources || []).reduce((s: number, x: any) => s + x.amount, 0) || 1)
const srcWidth = (amt: number) => Math.max((amt / totalSrc.value) * 100, amt > 0 ? 3 : 0) + '%'
const srcPct = (amt: number) => totalSrc.value > 0 ? Math.round((amt / totalSrc.value) * 1000) / 10 : 0
const srcColor = (i: number) => ['linear-gradient(90deg,#34d399,#10b981)', 'linear-gradient(90deg,#fbbf24,#f59e0b)', 'linear-gradient(90deg,#a78bfa,#8b5cf6)', 'linear-gradient(90deg,#f472b6,#ec4899)'][i]

function render() {
  if (!trendEl.value || !props.data) return
  if (!chart) chart = echarts.init(trendEl.value)
  const trend = props.data.monthlyTrend || []
  chart.setOption({
    grid: { left: 8, right: 8, top: 16, bottom: 4, containLabel: true },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(13,19,40,0.95)',
      borderColor: 'rgba(34,211,238,0.3)',
      textStyle: { color: '#fff', fontSize: 9 },
      formatter: (p: any) => `${p[0].axisValue}<br/>收入 ¥${Number(p[0].value).toFixed(2)}`,
    },
    xAxis: {
      type: 'category',
      data: trend.map((t: any) => t.month),
      axisLabel: { color: '#6b7280', fontSize: 8 },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#6b7280', fontSize: 8, formatter: (v: number) => '¥' + (v >= 1e4 ? (v / 1e4).toFixed(1) + 'w' : v) },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
    },
    series: [{
      type: 'bar',
      data: trend.map((t: any) => t.revenue),
      barWidth: 22,
      itemStyle: {
        borderRadius: [4, 4, 0, 0],
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: '#22d3ee' },
          { offset: 1, color: 'rgba(34,211,238,0.1)' },
        ]),
      },
    }],
  })
}

const onResize = () => chart?.resize()
watch(() => props.data, render, { deep: true })
onMounted(() => {
  render()
  window.addEventListener('resize', onResize)
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  chart?.dispose()
})
</script>
