<template>
  <div class="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl p-4 flex flex-col h-full">
    <div class="flex items-center justify-between mb-2 shrink-0">
      <h3 class="text-[11px] font-semibold text-white/80 flex items-center gap-1.5">💰 收入趋势
        <span class="text-[8px] text-gray-600 font-normal">{{ rangeLabel }} · 支付+订阅</span>
      </h3>
      <button @click="$emit('detail')" class="text-[9px] text-blue-400/80 hover:text-blue-300 cursor-pointer flex items-center gap-0.5 transition-colors">
        查看详情 <span class="text-[8px]">›</span>
      </button>
    </div>
    <div ref="el" class="flex-1 min-h-[110px] w-full"></div>
    <div class="grid grid-cols-3 gap-2 mt-2 shrink-0">
      <div class="px-2 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.05] text-center">
        <div class="text-sm font-bold text-cyan-400 font-mono">¥{{ fmtMoney(data?.window?.revenue ?? data?.totalRevenue) }}</div>
        <div class="text-[8px] text-gray-600 mt-0.5">窗口收入</div>
      </div>
      <div class="px-2 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.05] text-center">
        <div class="text-sm font-bold text-white/90 font-mono">{{ data?.orderCount ?? 0 }}</div>
        <div class="text-[8px] text-gray-600 mt-0.5">支付单数</div>
      </div>
      <div class="px-2 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.05] text-center">
        <div class="text-sm font-bold text-emerald-400 font-mono">{{ data?.enterprise?.renewalRate ?? 0 }}%</div>
        <div class="text-[8px] text-gray-600 mt-0.5">续费率</div>
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

const fmtMoney = (n: any) => {
  const v = Number(n || 0)
  if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M'
  if (v >= 1e4) return (v / 1e4).toFixed(1) + 'w'
  return v.toFixed(0)
}

function render() {
  if (!el.value) return
  if (!chart) chart = echarts.init(el.value)
  const trend = props.data?.window?.trend?.length ? props.data.window.trend : (props.data?.monthlyTrend?.map((t: any) => ({ label: t.month, revenue: t.revenue })) || [])
  const labels = trend.map((t: any) => t.label ?? t.month)
  chart.setOption({
    grid: { left: 6, right: 6, top: 12, bottom: 2, containLabel: true },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(13,19,40,0.95)', borderColor: 'rgba(34,211,238,0.3)',
      textStyle: { color: '#fff', fontSize: 9 },
      valueFormatter: (v: any) => '¥' + Number(v).toLocaleString('zh-CN'),
    },
    xAxis: {
      type: 'category',
      data: labels,
      axisLabel: { color: '#6b7280', fontSize: 8, interval: Math.ceil(labels.length / 8) },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } }, axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#6b7280', fontSize: 8, formatter: (v: number) => '¥' + fmtMoney(v) },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } },
    },
    series: [{
      type: 'line',
      data: trend.map((t: any) => t.revenue ?? t.amount ?? 0),
      smooth: true, symbol: 'circle', symbolSize: 3,
      lineStyle: { color: '#22d3ee', width: 1.5 },
      itemStyle: { color: '#22d3ee' },
      areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
        { offset: 0, color: 'rgba(34,211,238,0.25)' }, { offset: 1, color: 'rgba(34,211,238,0)' }]) },
    }],
  })
}
const onResize = () => chart?.resize()
watch(() => props.data, render, { deep: true })
onMounted(() => { render(); window.addEventListener('resize', onResize) })
onBeforeUnmount(() => { window.removeEventListener('resize', onResize); chart?.dispose() })
</script>
