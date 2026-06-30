<script setup lang="ts">
const props = withDefaults(defineProps<{
  label: string
  value: number
  max?: number
  size?: 'sm' | 'md'
}>(), {
  max: 100,
  size: 'sm',
})

const colorLabelClass = computed(() => {
  const pct = (props.value / props.max) * 100
  if (pct >= 80) return 'text-green-600 bg-green-100 dark:bg-green-900/30'
  if (pct >= 50) return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30'
  return 'text-red-600 bg-red-100 dark:bg-red-900/30'
})

const barColorClass = computed(() => {
  const pct = (props.value / props.max) * 100
  if (pct >= 80) return 'bg-green-500'
  if (pct >= 50) return 'bg-yellow-500'
  return 'bg-red-500'
})

const barWidth = computed(() => (props.value / props.max) * 100 + '%')
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-1">
      <span class="text-xs text-gray-500 dark:text-gray-400">{{ label }}</span>
      <span class="text-xs font-medium px-1.5 py-0.5 rounded" :class="colorLabelClass">{{ value }}/{{ max }}</span>
    </div>
    <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
      <div
        class="h-1.5 rounded-full transition-all"
        :class="barColorClass"
        :style="{ width: barWidth }"
      />
    </div>
  </div>
</template>
