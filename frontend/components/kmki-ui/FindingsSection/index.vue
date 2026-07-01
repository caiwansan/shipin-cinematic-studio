<template>
  <div class="findings-section">
    <div class="flex items-center gap-2 mb-4">
      <span class="text-lg">🔍</span>
      <h3 class="text-base font-semibold text-gray-900">发现汇总</h3>
    </div>

    <!-- Entity & Coverage Stats -->
    <div class="flex gap-6 mb-5 text-sm text-gray-600">
      <div>
        <span class="font-medium text-gray-900">行业：</span>
        {{ report.findings.industry || 'N/A' }}
      </div>
      <div>
        <span class="font-medium text-gray-900">实体：</span>
        {{ report.findings.entityName }}
      </div>
      <div>
        <span class="font-medium text-gray-900">覆盖度：</span>
        {{ report.findings.coverageCount }}
      </div>
      <div>
        <span class="font-medium text-gray-900">场景数：</span>
        {{ report.findings.totalScenarios }}
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Top Scenarios -->
      <div>
        <h4 class="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1">
          🔝 Top Scenarios
          <span class="text-xs text-gray-400 font-normal">(highest coverage)</span>
        </h4>
        <div class="space-y-2">
          <div
            v-for="(s, i) in report.findings.topScenarios"
            :key="i"
            class="flex items-center gap-3 px-4 py-2.5 bg-gray-50 rounded-lg"
          >
            <span class="text-xs font-bold text-gray-400 w-5">{{ i + 1 }}</span>
            <span class="flex-1 text-sm font-medium text-gray-800 truncate">{{ s.name }}</span>
            <span class="text-sm font-bold text-gray-700">{{ s.score }}</span>
            <span
              class="text-sm"
              :class="trendClass(s.trend)"
            >{{ trendArrow(s.trend) }}</span>
          </div>
        </div>
      </div>

      <!-- Bottom Scenarios -->
      <div>
        <h4 class="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1">
          🔻 Bottom Scenarios
          <span class="text-xs text-gray-400 font-normal">(lowest coverage)</span>
        </h4>
        <div class="space-y-2">
          <div
            v-for="(s, i) in report.findings.bottomScenarios"
            :key="i"
            class="flex items-center gap-3 px-4 py-2.5 bg-gray-50 rounded-lg"
          >
            <span class="text-xs font-bold text-gray-400 w-5">{{ i + 1 }}</span>
            <span class="flex-1 text-sm font-medium text-gray-800 truncate">{{ s.name }}</span>
            <span class="text-sm font-bold text-gray-700">{{ s.score }}</span>
            <span
              class="text-sm"
              :class="trendClass(s.trend)"
            >{{ trendArrow(s.trend) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { DeliverableReport } from '../../../workspaces/geo/types/report'

const props = defineProps<{
  report: DeliverableReport
}>()

function trendArrow(trend: string): string {
  if (trend === 'up') return '↑'
  if (trend === 'down') return '↓'
  return '→'
}

function trendClass(trend: string): string {
  return {
    up: 'text-emerald-600',
    down: 'text-red-500',
    stable: 'text-gray-400',
  }[trend] || 'text-gray-400'
}
</script>
