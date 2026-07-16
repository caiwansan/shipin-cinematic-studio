<template>
  <div class="bg-[#0D1328] border border-[#1A2240] rounded-xl p-4 space-y-3">
    <h4 class="text-sm font-semibold text-white">AI 员工健康度</h4>

    <!-- Big Score -->
    <div class="flex items-center gap-4">
      <div class="relative w-16 h-16">
        <svg class="w-full h-full -rotate-90" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="28" fill="none" stroke="#1A2240" stroke-width="4" />
          <circle
            cx="32" cy="32" r="28" fill="none"
            :stroke="scoreColor"
            stroke-width="4"
            stroke-linecap="round"
            :stroke-dasharray="circumference"
            :stroke-dashoffset="circumference * (1 - score / 100)"
            class="transition-all duration-500"
          />
        </svg>
        <div class="absolute inset-0 flex items-center justify-center">
          <span class="text-sm font-bold" :class="scoreTextClass">{{ score }}</span>
        </div>
      </div>
      <div>
        <div class="text-sm font-medium" :class="scoreTextClass">{{ healthLabel }}</div>
        <div class="text-[11px] text-gray-500">基于最近任务表现</div>
      </div>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-2 gap-2 text-xs">
      <div class="bg-[#060A18] rounded-lg p-2 text-center">
        <div class="text-green-400 font-semibold">{{ successRate }}%</div>
        <div class="text-[10px] text-gray-500">任务成功率</div>
      </div>
      <div class="bg-[#060A18] rounded-lg p-2 text-center">
        <div class="text-gray-300 font-semibold">{{ avgDuration }}</div>
        <div class="text-[10px] text-gray-500">平均响应</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  score: { type: Number, default: 100 },
  totalTasks: { type: Number, default: 0 },
  totalErrors: { type: Number, default: 0 },
  tasks: { type: Array, default: () => [] }
})

const circumference = 2 * Math.PI * 28

const scoreColor = computed(() => {
  if (props.score >= 90) return '#22c55e'
  if (props.score >= 70) return '#eab308'
  return '#ef4444'
})

const scoreTextClass = computed(() => {
  if (props.score >= 90) return 'text-green-400'
  if (props.score >= 70) return 'text-yellow-400'
  return 'text-red-400'
})

const healthLabel = computed(() => {
  if (props.score >= 90) return '运行稳定'
  if (props.score >= 70) return '状态一般'
  return '需要关注'
})

const successRate = computed(() => {
  if (props.totalTasks === 0) return 100
  return Math.round(((props.totalTasks - props.totalErrors) / props.totalTasks) * 100)
})

const avgDuration = computed(() => {
  if (props.tasks.length === 0) return '—'
  const total = props.tasks.reduce((sum, t) => sum + (t.durationMs || 0), 0)
  const avg = Math.round(total / props.tasks.length)
  if (avg < 1000) return avg + 'ms'
  return (avg / 1000).toFixed(1) + 's'
})
</script>
