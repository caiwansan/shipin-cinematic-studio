<template>
  <div class="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl p-5">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-xs font-semibold text-white/80 flex items-center gap-2">💎 VIP 经营中心</h3>
      <span class="text-[9px] text-gray-600">Membership · 真实数据</span>
    </div>

    <div v-if="!data" class="text-center py-10 text-[10px] text-gray-600">加载中...</div>

    <template v-else>
      <!-- VIP 大数 -->
      <div class="grid grid-cols-3 gap-2 mb-4">
        <div class="px-3 py-3 rounded-lg bg-white/[0.03] border border-white/[0.05] text-center">
          <div class="text-2xl font-bold text-amber-400 font-mono">{{ data.total }}</div>
          <div class="text-[9px] text-gray-600 mt-1">VIP 总人数</div>
        </div>
        <div class="px-3 py-3 rounded-lg bg-white/[0.03] border border-white/[0.05] text-center">
          <div class="text-2xl font-bold text-emerald-400 font-mono">+{{ data.monthNew }}</div>
          <div class="text-[9px] text-gray-600 mt-1">本月新增</div>
        </div>
        <div class="px-3 py-3 rounded-lg bg-white/[0.03] border border-white/[0.05] text-center">
          <div class="text-2xl font-bold text-cyan-400 font-mono">{{ data.health.permanent }}</div>
          <div class="text-[9px] text-gray-600 mt-1">永久会员</div>
        </div>
      </div>

      <!-- 套餐分布 -->
      <div class="mb-4">
        <div class="text-[10px] text-gray-500 uppercase tracking-wider mb-2">套餐分布</div>
        <div class="space-y-1.5">
          <div v-for="(t, i) in data.tierBreakdown" :key="t.tier"
            class="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.05]">
            <span class="text-sm">{{ ['💎', '🌟', '🏢'][i] || '▪️' }}</span>
            <span class="text-[10px] text-white/70 flex-1">{{ t.name }}</span>
            <div class="w-24 h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
              <div class="h-full rounded-full bg-gradient-to-r from-amber-400 to-yellow-500" :style="{ width: tierWidth(t.count) }"></div>
            </div>
            <span class="text-[10px] text-amber-400 font-mono">{{ t.count }}</span>
          </div>
          <div v-if="data.tierBreakdown.length === 0" class="text-center text-[10px] text-gray-600 py-2">暂无 VIP 用户</div>
        </div>
      </div>

      <!-- 增长趋势 -->
      <div>
        <div class="text-[10px] text-gray-500 uppercase tracking-wider mb-2">VIP 增长趋势（近 6 月）</div>
        <div ref="trendEl" class="h-28 w-full"></div>
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

const tierWidth = (c: number) => {
  if (!props.data) return '0%'
  const max = Math.max(...props.data.tierBreakdown.map((t: any) => t.count), 1)
  return Math.max((c / max) * 100, 5) + '%'
}

function render() {
  if (!trendEl.value || !props.data) return
  if (!chart) chart = echarts.init(trendEl.value)
  const trend = props.data.growthTrend || []
  chart.setOption({
    grid: { left: 8, right: 8, top: 16, bottom: 4, containLabel: true },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(13,19,40,0.95)',
      borderColor: 'rgba(251,191,36,0.3)',
      textStyle: { color: '#fff', fontSize: 9 },
      formatter: (p: any) => `${p[0].axisValue}<br/>新增 VIP ${p[0].value} 人`,
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
      minInterval: 1,
      axisLabel: { color: '#6b7280', fontSize: 8 },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
    },
    series: [{
      type: 'line',
      data: trend.map((t: any) => t.count),
      smooth: true,
      symbol: 'circle',
      symbolSize: 4,
      lineStyle: { color: '#fbbf24', width: 1.5 },
      itemStyle: { color: '#fbbf24' },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(251,191,36,0.25)' },
          { offset: 1, color: 'rgba(251,191,36,0)' },
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
