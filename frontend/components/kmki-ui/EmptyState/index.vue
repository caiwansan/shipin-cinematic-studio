<script setup lang="ts">
export interface EmptyStateAction {
  label: string
  onClick: () => void
  variant?: 'primary' | 'secondary'
}

const props = withDefaults(defineProps<{
  icon?: string
  title?: string
  description?: string
  action?: EmptyStateAction
}>(), {
  icon: '📭',
  title: '暂无数据',
  description: '',
})
</script>

<template>
  <div class="flex flex-col items-center justify-center py-16 px-4 text-center">
    <span class="text-4xl mb-4">{{ icon }}</span>
    <h4 class="text-base font-semibold text-gray-700 dark:text-gray-300 mb-1">{{ title }}</h4>
    <p v-if="description" class="text-sm text-gray-400 dark:text-gray-500 max-w-xs">{{ description }}</p>
    <button
      v-if="action"
      class="mt-4 px-4 py-2 text-sm font-medium rounded-lg transition-colors"
      :class="action.variant === 'secondary'
        ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
        : 'bg-blue-600 text-white hover:bg-blue-700'"
      @click="action.onClick"
    >
      {{ action.label }}
    </button>
  </div>
</template>
