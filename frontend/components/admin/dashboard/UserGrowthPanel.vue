<template>
  <div class="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl p-5">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-xs font-semibold text-white/80 flex items-center gap-2">📈 用户增长中心</h3>
      <span class="text-[9px] text-gray-600">近 30 天 · 真实注册数据</span>
    </div>

    <div v-if="!data" class="text-center py-10 text-[10px] text-gray-600">加载中...</div>

    <template v-else>
      <!-- 增长指标 -->
      <div class="grid grid-cols-3 md:grid-cols-6 gap-2 mb-4">
        <div class="px-2 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.05] text-center">
          <div class="text-base font-bold text-white/90 font-mono">{{ fmt(data.summary.total) }}</div>
          <div class="text-[8px] text-gray-600 mt-0.5">总用户</div>
        </div>
        <div class="px-2 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.05] text-center">
          <div class="text-base font-bold text-blue-400 font-mono">{{ fmt(data.summary.todayNew) }}</div>
          <div class="text-[8px] text-gray-600 mt-0.5">今日新增</div>
        </div>
        <div class="px-2 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.05] text-center">
          <div class="text-base font-bold text-cyan-400 font-mono">{{ fmt(data.summary.weekNew) }}</div>
          <div class="text-[8px] text-gray-600 mt-0.5">周新增</div>
        </div>
        <div class="px-2 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.05] text-center">
          <div class="text-base font-bold text-emerald-400 font-mono">{{ fmt(data.summary.monthNew) }}</div>
          <div class="text-[8px] text-gray-600 mt-0.5">月新增</div>
        </div>
        <div class="px-2 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.05] text-center">
          <div class="text-base font-bold text-orange-400 font-mono">{{ fmt(data.summary.active30) }}</div>
          <div class="text-[8px] text-gray-600 mt-0.5">30日活跃</div>
        </div>
        <div class="px-2 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.05] text-center">
          <div class="text-base font-bold text-purple-400 font-mono">{{ fmt(data.summary.returned) }}</div>
          <div class="text-[8px] text-gray-600 mt-0.5">回流用户</div>
        </div>
      </div>

      <!-- 30 天注册趋势 -->
      <div class="mb-5">
        <div class="text-[10px] text-gray-500 uppercase tracking-wider mb-2">注册趋势（近 30 天）</div>
        <div ref="trendEl" class="h-32 w-full"></div>
      </div>

      <!-- 用户生命周期漏斗 -->
      <div>
        <div class="text-[10px] text-gray-500 uppercase tracking-wider mb-3">用户生命周期漏斗</div>
        <div class="space-y-2">
          <div v-for="(f, i) in data.funnel" :key="f.stage" class="flex items-center gap-3">
            <span class="w-20 text-[9px] text-gray-500 shrink-0">{{ f.stage }}</span>
            <div class="flex-1 h-6 rounded-lg bg-white/[0.03] border border-white/[0.05] relative overflow-hidden">
              <div class="h-full rounded-lg transition-all duration-700"
                :style="{ width: funnelWidth(i), background: funnelColor(i) }"></div>
              <span class="absolute inset-0 flex items-center px-2.5 text-[10px] text-white/70 font-mono">
                {{ f.value == null ? '暂无数据' : fmt(f.value) }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import * as echarts from 'echarts'

const props = defineProps<{ data: any }>()
const trendEl = ref<HTMLDivElement | null>(null)
let chart: echarts.ECharts | null = null

const fmt = (n: any) => (n == null ? '—' : Number(n).toLocaleString('zh-CN'))

const funnelWidth = (i: number) => {
  if (!props.data) return '0%'
  const vals = props.data.funnel.map((f: any) => f.value).filter((v: any) => v != null)
  const max = Math.max(...vals, 1)
  const v = props.data.funnel[i].value
  return v == null ? '100%' : Math.max((v / max) * 100, 4) + '%'
}
const funnelColor = (i: number) => [
  'linear-gradient(90deg,rgba(148,163,184,0.25),rgba(148,163,184,0.05))',
  'linear-gradient(90deg,#60a5fa,#3b82f6)',
  'linear-gradient(90deg,#34d399,#10b981)',
  'linear-gradient(90deg,#a78bfa,#8b5cf6)',
  'linear-gradient(90deg,#fbbf24,#f59e0b)',
  'linear-gradient(90deg,#f472b6,#ec4899)',
][i % 6]

function render() {
  if (!trendEl.value || !props.data) return
  if (!chart) chart = echarts.init(trendEl.value)
  const trend = props.data.trend || []
  chart.setOption({
    grid: { left: 8, right: 8, top: 16, bottom: 4, containLabel: true },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(13,19,40,0.95)',
      borderColor: 'rgba(96,165,250,0.3)',
      textStyle: { color: '#fff', fontSize: 9 },
    },
    xAxis: {
      type: 'category',
      data: trend.map((t: any) => t.date.slice(5)),
      axisLabel: { color: '#6b7280', fontSize: 8, interval: 3 },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#6b7280', fontSize: 8 },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
    },
    series: [{
      type: 'line',
      data: trend.map((t: any) => t.registrations),
      smooth: true,
      symbol: 'circle',
      symbolSize: 3,
      lineStyle: { color: '#60a5fa', width: 1.5 },
      itemStyle: { color: '#60a5fa' },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(96,165,250,0.25)' },
          { offset: 1, color: 'rgba(96,165,250,0)' },
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
