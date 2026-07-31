<template>
  <div class="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl p-4 flex flex-col h-full">
    <div class="flex items-center justify-between mb-2 shrink-0">
      <h3 class="text-[11px] font-semibold text-white/80 flex items-center gap-1.5">📈 用户趋势
        <span class="text-[8px] text-gray-600 font-normal">{{ rangeLabel }} · 真实注册</span>
      </h3>
      <button @click="$emit('detail')" class="text-[9px] text-blue-400/80 hover:text-blue-300 cursor-pointer flex items-center gap-0.5 transition-colors">
        查看详情 <span class="text-[8px]">›</span>
      </button>
    </div>
    <div ref="el" class="flex-1 min-h-[110px] w-full"></div>
    <div class="grid grid-cols-3 gap-2 mt-2 shrink-0">
      <div class="px-2 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.05] text-center">
        <div class="text-sm font-bold text-blue-400 font-mono">{{ fmt(data?.window?.newUsers ?? data?.summary?.monthNew) }}</div>
        <div class="text-[8px] text-gray-600 mt-0.5">窗口新增</div>
      </div>
      <div class="px-2 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.05] text-center">
        <div class="text-sm font-bold text-orange-400 font-mono">{{ fmt(data?.window?.activeUsers ?? data?.summary?.active30) }}</div>
        <div class="text-[8px] text-gray-600 mt-0.5">窗口活跃</div>
      </div>
      <div class="px-2 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.05] text-center">
        <div class="text-sm font-bold text-purple-400 font-mono">{{ fmt(data?.summary?.returned) }}</div>
        <div class="text-[8px] text-gray-600 mt-0.5">回流用户</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import * as echarts from 'echarts'

const props = defineProps<{ data: any; rangeLabel?: string }>()
defineEmits<{ (e: 'detail'): void }>()

const el = ref<HTMLDivElement | null>(null)
let chart: echarts.ECharts | null = null
const fmt = (n: any) => (n == null ? '—' : Number(n).toLocaleString('zh-CN'))

function render() {
  if (!el.value) return
  if (!chart) chart = echarts.init(el.value)
  const trend = props.data?.windowTrend?.length ? props.data.windowTrend : (props.data?.trend || [])
  chart.setOption({
    grid: { left: 6, right: 6, top: 12, bottom: 2, containLabel: true },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(13,19,40,0.95)', borderColor: 'rgba(96,165,250,0.3)',
      textStyle: { color: '#fff', fontSize: 9 },
    },
    xAxis: {
      type: 'category',
      data: trend.map((t: any) => t.label ?? t.date?.slice(5)),
      axisLabel: { color: '#6b7280', fontSize: 8, interval: Math.ceil(trend.length / 8) },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } }, axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#6b7280', fontSize: 8 },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
    },
    series: [{
      type: 'line',
      data: trend.map((t: any) => t.registrations ?? t.c ?? 0),
      smooth: true, symbol: 'circle', symbolSize: 3,
      lineStyle: { color: '#60a5fa', width: 1.5 },
      itemStyle: { color: '#60a5fa' },
      areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
        { offset: 0, color: 'rgba(96,165,250,0.25)' }, { offset: 1, color: 'rgba(96,165,250,0)' }]) },
    }],
  })
}
const onResize = () => chart?.resize()
watch(() => props.data, render, { deep: true })
onMounted(() => { render(); window.addEventListener('resize', onResize) })
onBeforeUnmount(() => { window.removeEventListener('resize', onResize); chart?.dispose() })
</script>
