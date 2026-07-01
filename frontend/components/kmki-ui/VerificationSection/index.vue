<template>
  <div class="verification-section" v-if="report.verification">
    <div class="flex items-center gap-2 mb-4">
      <span class="text-lg">✅</span>
      <h3 class="text-base font-semibold text-gray-900">Verification — 验证结果</h3>
    </div>

    <!-- Before / After Comparison -->
    <div class="flex items-center justify-center gap-6 mb-5 p-5 bg-gray-50 rounded-xl">
      <div class="text-center">
        <div class="text-xs text-gray-500 uppercase mb-1">Before</div>
        <div class="text-3xl font-extrabold text-gray-500">{{ report.verification.beforeAdi }}</div>
      </div>
      <div class="flex flex-col items-center">
        <span class="text-xl text-gray-300">→</span>
        <span
          class="text-sm font-semibold px-2 py-0.5 rounded"
          :class="report.verification.deltaAdi >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'"
        >
          {{ report.verification.deltaAdi >= 0 ? '+' : '' }}{{ report.verification.deltaAdi }}
        </span>
      </div>
      <div class="text-center">
        <div class="text-xs text-gray-500 uppercase mb-1">After</div>
        <div class="text-3xl font-extrabold text-emerald-600">{{ report.verification.afterAdi }}</div>
      </div>
      <div class="border-l border-gray-200 pl-6">
        <div class="text-xs text-gray-500 uppercase mb-1">Improvement</div>
        <div class="text-xl font-bold text-emerald-600">{{ report.verification.improvementRate }}%</div>
      </div>
    </div>

    <!-- Improvement Breakdown Waterfall -->
    <div v-if="report.verification.breakdown.length > 0" class="mb-5">
      <h4 class="text-sm font-semibold text-gray-700 mb-3">Improvement Breakdown</h4>
      <div class="space-y-1.5">
        <div class="flex items-center gap-3 px-3 py-2 bg-gray-50 rounded-lg text-sm">
          <span class="text-gray-500 font-medium flex-1">Baseline</span>
          <span class="font-bold text-gray-700">{{ report.verification.beforeAdi }}</span>
        </div>
        <div
          v-for="(b, i) in report.verification.breakdown"
          :key="i"
          class="flex items-center gap-3 px-3 py-2 bg-gray-50 rounded-lg text-sm"
        >
          <span class="text-gray-700 flex-1">{{ b.label }}</span>
          <span :class="b.contribution >= 0 ? 'text-emerald-600' : 'text-red-500'" class="font-semibold">
            {{ b.contribution >= 0 ? '+' : '' }}{{ b.contribution }}
          </span>
          <span class="font-bold text-gray-700 w-10 text-right">{{ waterfallCumulative(i) }}</span>
        </div>
      </div>
    </div>

    <!-- Remaining Issues -->
    <div v-if="report.verification.remainingIssues.length > 0">
      <h4 class="text-sm font-semibold text-gray-700 mb-3">Remaining Issues</h4>
      <div class="space-y-1.5">
        <div
          v-for="(issue, i) in report.verification.remainingIssues"
          :key="i"
          class="flex items-center gap-3 px-4 py-2.5 bg-gray-50 rounded-lg"
        >
          <span class="flex-1 text-sm font-medium text-gray-800">{{ issue.scenario }}</span>
          <span class="text-sm text-gray-500">Gap: {{ issue.gap }}</span>
          <span
            class="text-xs font-medium px-2 py-0.5 rounded-full"
            :class="priorityClass(issue.priority)"
          >
            {{ issue.priority }}
          </span>
        </div>
      </div>
    </div>
  </div>

  <!-- No Verification Data -->
  <div v-else class="verification-section--empty">
    <div class="flex items-center gap-2 mb-2">
      <span class="text-lg">✅</span>
      <h3 class="text-base font-semibold text-gray-900">Verification</h3>
    </div>
    <p class="text-sm text-gray-400">No verification data available yet. Complete the Verification step to see results.</p>
  </div>
</template>

<script setup lang="ts">
import type { DeliverableReport } from '../../../workspaces/geo/types/report'

const props = defineProps<{
  report: DeliverableReport
}>()

function priorityClass(p: string): string {
  const lower = p.toLowerCase()
  if (lower === 'high') return 'bg-red-100 text-red-700'
  if (lower === 'medium') return 'bg-amber-100 text-amber-700'
  return 'bg-emerald-100 text-emerald-700'
}

function waterfallCumulative(idx: number): number {
  if (!props.report.verification) return 0
  let score = props.report.verification.beforeAdi
  for (let i = 0; i <= idx; i++) {
    if (props.report.verification.breakdown[i]) {
      score += props.report.verification.breakdown[i].contribution
    }
  }
  return score
}
</script>
