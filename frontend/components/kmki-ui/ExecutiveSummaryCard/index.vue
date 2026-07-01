<template>
  <div class="executive-summary-card rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-emerald-50 overflow-hidden">
    <!-- Header -->
    <div class="px-6 py-5">
      <h2 class="text-lg font-bold text-gray-900 mb-1">品牌健康报告 — {{ projectName }}</h2>
      <p class="text-sm text-gray-500">生成时间：{{ formattedDate }}</p>
    </div>

    <!-- Metrics Grid -->
    <div class="px-6 pb-4">
      <div class="grid grid-cols-5 gap-4">
        <div class="text-center">
          <div class="text-2xl font-extrabold text-gray-900">{{ report.executiveSummary.currentAdi }}</div>
          <div class="text-xs text-gray-500 mt-0.5">当前 ADI</div>
        </div>
        <div class="text-center">
          <div
            class="text-2xl font-extrabold"
            :class="report.executiveSummary.adiChange >= 0 ? 'text-emerald-600' : 'text-red-600'"
          >
            {{ report.executiveSummary.adiChange >= 0 ? '+' : '' }}{{ report.executiveSummary.adiChange }}
          </div>
          <div class="text-xs text-gray-500 mt-0.5">Δ ADI</div>
        </div>
        <div class="text-center">
          <div class="text-2xl font-extrabold text-gray-900">{{ report.executiveSummary.completionRate }}%</div>
          <div class="text-xs text-gray-500 mt-0.5">完成率</div>
        </div>
        <div class="text-center">
          <div class="text-2xl font-extrabold text-amber-600">{{ report.executiveSummary.topOpportunities }}</div>
          <div class="text-xs text-gray-500 mt-0.5">机会</div>
        </div>
        <div class="text-center">
          <div class="text-2xl font-extrabold text-gray-900">{{ (report.executiveSummary.confidence * 100).toFixed(0) }}%</div>
          <div class="text-xs text-gray-500 mt-0.5">置信度</div>
        </div>
      </div>
    </div>

    <!-- Health Badge -->
    <div class="px-6 pb-5 flex items-center gap-3">
      <div class="h-px flex-1 bg-gray-100" />
      <span class="text-sm font-semibold text-gray-600">整体评估:</span>
      <span
        class="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold"
        :class="healthClass"
      >
        {{ healthLabel }}
      </span>
      <div class="h-px flex-1 bg-gray-100" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { DeliverableReport } from '../../../workspaces/geo/types/report'

const props = defineProps<{
  report: DeliverableReport
  projectName?: string
}>()

const formattedDate = computed(() => {
  const d = new Date(props.report.generatedAt)
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
})

const healthLabel = computed(() => {
  const m: Record<string, string> = { good: 'Good ✅', fair: 'Fair ⚠️', poor: 'Poor ❌' }
  return m[props.report.executiveSummary.overallHealth] || '—'
})

const healthClass = computed(() => {
  const h = props.report.executiveSummary.overallHealth
  return {
    'bg-emerald-100 text-emerald-700': h === 'good',
    'bg-amber-100 text-amber-700': h === 'fair',
    'bg-red-100 text-red-700': h === 'poor',
  }
})
</script>
