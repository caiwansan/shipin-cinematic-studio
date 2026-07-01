<template>
  <div class="next-recommendations">
    <div class="flex items-center gap-2 mb-4">
      <span class="text-lg">🎯</span>
      <h3 class="text-base font-semibold text-gray-900">下一步建议 — 下一步建议</h3>
    </div>

    <div v-if="report.nextRecommendations.length === 0" class="text-sm text-gray-400 py-4 text-center">
      All opportunities have been addressed. Great work! 🎉
    </div>

    <div v-else class="space-y-2">
      <div
        v-for="(rec, i) in report.nextRecommendations"
        :key="i"
        class="flex items-center gap-4 px-4 py-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
      >
        <span
          class="w-2 h-2 rounded-full flex-shrink-0"
          :class="dotClass(rec.priority)"
        />
        <span class="flex-1 text-sm font-medium text-gray-800">{{ rec.scenarioName }}</span>
        <span class="text-sm text-gray-500">差距：{{ rec.gap }}</span>
        <span
          class="text-xs font-medium px-2 py-0.5 rounded-full"
          :class="priorityClass(rec.priority)"
        >
          {{ rec.priority }}
        </span>
        <span class="text-sm font-semibold text-emerald-600">+{{ rec.expectedAdiGain }} ADI</span>
      </div>
    </div>
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

function dotClass(p: string): string {
  const lower = p.toLowerCase()
  if (lower === 'high') return 'bg-red-500'
  if (lower === 'medium') return 'bg-amber-500'
  return 'bg-emerald-500'
}
</script>
