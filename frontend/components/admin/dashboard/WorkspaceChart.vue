<template>
  <div class="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl p-5">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-xs font-semibold text-white/80 flex items-center gap-2">🗺️ Workspace 运营地图</h3>
      <span class="text-[9px] text-gray-600">本月 · AI 调用</span>
    </div>

    <div v-if="ranking.length === 0" class="text-center py-10 text-[10px] text-gray-600">本月暂无业务线调用</div>

    <template v-else>
      <!-- 柱状图 -->
      <div ref="chartEl" class="h-40 w-full"></div>

      <!-- 排行列表 -->
      <div class="mt-3 space-y-1.5">
        <div v-for="(w, i) in ranking.slice(0, 6)" :key="w.label"
          class="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
          <span class="w-5 text-center text-[10px] font-bold" :class="['text-amber-400','text-gray-300','text-orange-400'][i] || 'text-gray-600'">{{ i + 1 }}</span>
          <span class="text-[11px] text-white/80 flex-1">{{ w.label }}</span>
          <span class="text-[10px] text-gray-500 font-mono">{{ w.calls.toLocaleString() }} 次</span>
          <span class="text-[10px] text-indigo-400/80 font-mono w-16 text-right">${{ w.cost.toFixed(2) }}</span>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import * as echarts from 'echarts'

const props = defineProps<{
  ranking: { label: string; calls: number; cost: number }[]
}>()

const chartEl = ref<HTMLDivElement | null>(null)
let chart: echarts.ECharts | null = null

const render = () => {
  if (!chartEl.value) return
  if (!chart) chart = echarts.init(chartEl.value)
  const top = props.ranking.slice(0, 6)
  chart.setOption({
    grid: { left: 8, right: 8, top: 12, bottom: 4, containLabel: true },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(13,19,40,0.95)',
      borderColor: 'rgba(99,102,241,0.3)',
      textStyle: { color: '#fff', fontSize: 10 },
      formatter: (params: any) => `${params[0].name}<br/>${params[0].value.toLocaleString()} 次`,
    },
    xAxis: {
      type: 'category',
      data: top.map((w) => w.label),
      axisLabel: { color: '#6b7280', fontSize: 9 },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#6b7280', fontSize: 9 },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
    },
    series: [{
      type: 'bar',
      data: top.map((w) => w.calls),
      barWidth: 18,
      itemStyle: {
        borderRadius: [4, 4, 0, 0],
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: '#818cf8' },
          { offset: 1, color: 'rgba(99,102,241,0.15)' },
        ]),
      },
    }],
  })
}

const onResize = () => chart?.resize()

onMounted(() => {
  render()
  window.addEventListener('resize', onResize)
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  chart?.dispose()
})
watch(() => props.ranking, render, { deep: true })
</script>
