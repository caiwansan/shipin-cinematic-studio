<script setup lang="ts">
const props = defineProps<{
  label: string
  value: string | number
  trend?: 'up' | 'down' | 'stable'
  trendValue?: string
  subtitle?: string
}>()
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
    <div class="text-sm text-gray-500 dark:text-gray-400">{{ label }}</div>
    <div class="mt-1 flex items-baseline gap-2">
      <span class="text-2xl font-semibold text-gray-900 dark:text-white">{{ value }}</span>
      <span
        v-if="trend"
        :class="trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-400'"
        class="text-sm"
      >
        {{ trendValue }}
      </span>
    </div>
    <div v-if="subtitle" class="mt-1 text-xs text-gray-400">{{ subtitle }}</div>
  </div>
</template>
