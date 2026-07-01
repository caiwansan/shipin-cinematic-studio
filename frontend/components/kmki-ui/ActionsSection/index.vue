<template>
  <div class="actions-section">
    <div class="flex items-center gap-2 mb-4">
      <span class="text-lg">📋</span>
      <h3 class="text-base font-semibold text-gray-900">行动汇总</h3>
    </div>

    <!-- Progress Bar -->
    <div class="mb-5">
      <div class="flex items-center gap-3 mb-1.5">
        <span class="text-xs font-medium text-gray-500">完成率</span>
        <span class="text-sm font-bold text-gray-800">{{ completionRate }}%</span>
      </div>
      <div class="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          class="h-full rounded-full transition-all duration-500"
          :class="progressColorClass"
          :style="{ width: completionRate + '%' }"
        />
      </div>
    </div>

    <!-- Stats Grid -->
    <div class="grid grid-cols-5 gap-3 mb-5">
      <div class="text-center p-3 bg-gray-50 rounded-lg">
        <div class="text-lg font-bold text-gray-900">{{ report.actions.total }}</div>
        <div class="text-xs text-gray-500">总计</div>
      </div>
      <div class="text-center p-3 bg-emerald-50 rounded-lg">
        <div class="text-lg font-bold text-emerald-600">{{ report.actions.completed }}</div>
        <div class="text-xs text-emerald-600">已完成</div>
      </div>
      <div class="text-center p-3 bg-blue-50 rounded-lg">
        <div class="text-lg font-bold text-blue-600">{{ report.actions.inProgress }}</div>
        <div class="text-xs text-blue-600">进行中</div>
      </div>
      <div class="text-center p-3 bg-gray-50 rounded-lg">
        <div class="text-lg font-bold text-gray-500">{{ report.actions.skipped }}</div>
        <div class="text-xs text-gray-500">已跳过</div>
      </div>
      <div class="text-center p-3 bg-amber-50 rounded-lg">
        <div class="text-lg font-bold text-amber-600">{{ report.actions.pending }}</div>
        <div class="text-xs text-amber-600">待处理</div>
      </div>
    </div>

    <!-- Estimated vs Actual Gain -->
    <div class="flex gap-6 mb-5 px-4 py-3 bg-gray-50 rounded-lg">
      <div>
        <span class="text-xs text-gray-500">预计增益：</span>
        <span class="ml-2 text-sm font-bold text-gray-800">{{ report.actions.estimatedGain.toFixed(1) }}</span>
      </div>
      <div>
        <span class="text-xs text-gray-500">实际增益：</span>
        <span
          class="ml-2 text-sm font-bold"
          :class="report.actions.actualGain >= report.actions.estimatedGain ? 'text-emerald-600' : 'text-amber-600'"
        >
          {{ report.actions.actualGain.toFixed(1) }}
        </span>
      </div>
    </div>

    <!-- Items Table -->
    <div v-if="report.actions.items.length === 0" class="text-sm text-gray-400 py-4 text-center">
      No action items.
    </div>

    <div v-else class="border border-gray-100 rounded-xl overflow-hidden">
      <table class="w-full text-sm">
        <thead>
          <tr class="bg-gray-50 text-left">
            <th class="px-4 py-2.5 font-semibold text-gray-600 text-xs uppercase">Action</th>
            <th class="px-4 py-2.5 font-semibold text-gray-600 text-xs uppercase">Status</th>
            <th class="px-4 py-2.5 font-semibold text-gray-600 text-xs uppercase">Expected Impact</th>
            <th class="px-4 py-2.5 font-semibold text-gray-600 text-xs uppercase">Actual Impact</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-50">
          <tr
            v-for="(item, i) in report.actions.items"
            :key="i"
            class="hover:bg-gray-50 transition-colors"
          >
            <td class="px-4 py-2.5 font-medium text-gray-800">{{ item.title }}</td>
            <td class="px-4 py-2.5">
              <span
                class="inline-block text-xs font-medium px-2 py-0.5 rounded-full"
                :class="statusClass(item.status)"
              >
                {{ statusLabel(item.status) }}
              </span>
            </td>
            <td class="px-4 py-2.5">{{ item.expectedImpact }}</td>
            <td class="px-4 py-2.5">
              <template v-if="item.actualImpact !== null">
                <span :class="item.actualImpact >= 0 ? 'text-emerald-600' : 'text-red-500'">
                  {{ item.actualImpact >= 0 ? '+' : '' }}{{ item.actualImpact }}
                </span>
              </template>
              <template v-else>
                <span class="text-gray-300">—</span>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { DeliverableReport } from '../../../workspaces/geo/types/report'

const props = defineProps<{
  report: DeliverableReport
}>()

const completionRate = computed(() => {
  if (props.report.actions.total === 0) return 0
  return Math.round((props.report.actions.completed / props.report.actions.total) * 100)
})

const progressColorClass = computed(() => {
  const r = completionRate.value
  if (r >= 80) return 'bg-emerald-500'
  if (r >= 50) return 'bg-blue-500'
  if (r >= 20) return 'bg-amber-500'
  return 'bg-red-500'
})

function statusClass(status: string): string {
  const s = status.toLowerCase()
  if (s === 'completed') return 'bg-emerald-100 text-emerald-700'
  if (s === 'in-progress' || s === 'in_progress') return 'bg-blue-100 text-blue-700'
  if (s === 'skipped') return 'bg-gray-100 text-gray-500'
  return 'bg-amber-100 text-amber-700'
}

function statusLabel(status: string): string {
  const s = status.toLowerCase()
  if (s === 'completed') return '✅ Completed'
  if (s === 'in-progress' || s === 'in_progress') return '🔄 In Progress'
  if (s === 'skipped') return '⏭ Skipped'
  return '⏳ Pending'
}
</script>
