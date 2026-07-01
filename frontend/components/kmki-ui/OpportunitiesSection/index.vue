<template>
  <div class="opportunities-section">
    <div class="flex items-center gap-2 mb-4">
      <span class="text-lg">💡</span>
      <h3 class="text-base font-semibold text-gray-900">机会 — 机会汇总</h3>
    </div>

    <!-- Summary Counts -->
    <div class="flex gap-4 mb-4">
      <span class="text-xs font-medium px-2.5 py-1 rounded-full bg-red-100 text-red-700">
        High: {{ report.opportunities.high }}
      </span>
      <span class="text-xs font-medium px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">
        Medium: {{ report.opportunities.medium }}
      </span>
      <span class="text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">
        Low: {{ report.opportunities.low }}
      </span>
      <span class="text-xs font-medium px-2.5 py-1 rounded-full bg-blue-100 text-blue-700">
        Total Expected Gain: +{{ report.opportunities.totalExpectedGain.toFixed(1) }} ADI
      </span>
    </div>

    <!-- Table -->
    <div v-if="report.opportunities.items.length === 0" class="text-sm text-gray-400 py-4 text-center">
      No opportunities identified.
    </div>

    <div v-else class="border border-gray-100 rounded-xl overflow-hidden">
      <table class="w-full text-sm">
        <thead>
          <tr class="bg-gray-50 text-left">
            <th class="px-4 py-2.5 font-semibold text-gray-600 text-xs uppercase">场景</th>
            <th class="px-4 py-2.5 font-semibold text-gray-600 text-xs uppercase">差距</th>
            <th class="px-4 py-2.5 font-semibold text-gray-600 text-xs uppercase">优先级</th>
            <th class="px-4 py-2.5 font-semibold text-gray-600 text-xs uppercase">预计增益</th>
            <th class="px-4 py-2.5 font-semibold text-gray-600 text-xs uppercase">建议</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-50">
          <tr
            v-for="(item, i) in report.opportunities.items"
            :key="i"
            class="hover:bg-gray-50 transition-colors"
          >
            <td class="px-4 py-2.5 font-medium text-gray-800">{{ item.scenarioName }}</td>
            <td class="px-4 py-2.5">{{ item.gap }}</td>
            <td class="px-4 py-2.5">
              <span
                class="inline-block text-xs font-medium px-2 py-0.5 rounded-full"
                :class="priorityClass(item.priority)"
              >
                {{ item.priority }}
              </span>
            </td>
            <td class="px-4 py-2.5 text-emerald-600 font-semibold">+{{ item.expectedAdiGain }}</td>
            <td class="px-4 py-2.5 text-gray-500 max-w-[200px] truncate">{{ item.suggestion || '—' }}</td>
          </tr>
        </tbody>
      </table>
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
</script>
