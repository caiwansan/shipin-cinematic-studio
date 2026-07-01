<template>
  <div class="card border border-gray-100 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 overflow-hidden">
    <div v-if="title || subtitle" class="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
      <h4 v-if="title" class="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide">{{ title }}</h4>
      <p v-if="subtitle" class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ subtitle }}</p>
    </div>
    <div class="px-6 py-4">
      <slot />
    </div>
    <div v-if="actions" class="px-6 py-3 border-t border-gray-100 dark:border-gray-700 flex items-center gap-2 flex-wrap">
      <button
        v-for="action in actions"
        :key="action.label"
        class="text-xs font-medium px-3 py-1.5 rounded-md transition-colors"
        :class="actionClass(action.variant)"
        @click="action.onClick"
      >
        {{ action.label }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
export interface CardAction {
  label: string
  onClick: () => void
  variant?: 'primary' | 'secondary' | 'ghost'
}

const props = defineProps<{
  title?: string
  subtitle?: string
  actions?: CardAction[]
}>()

function actionClass(variant = 'primary') {
  return {
    'bg-blue-600 text-white hover:bg-blue-700': variant === 'primary' || !variant,
    'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600': variant === 'secondary',
    'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300': variant === 'ghost',
  }
}
</script>
