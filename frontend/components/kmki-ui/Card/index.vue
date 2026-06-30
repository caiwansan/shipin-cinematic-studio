<script setup lang="ts">
export interface CardAction {
  label: string
  icon?: string
  onClick: () => void
  variant?: 'primary' | 'secondary' | 'ghost'
}

const props = defineProps<{
  title?: string
  subtitle?: string
  actions?: CardAction[]
}>()
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
    <div v-if="title || subtitle" class="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
      <h4 v-if="title" class="text-sm font-semibold text-gray-900 dark:text-white">{{ title }}</h4>
      <p v-if="subtitle" class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ subtitle }}</p>
    </div>
    <div class="px-4 py-3">
      <slot />
    </div>
    <div v-if="actions" class="px-4 py-2 border-t border-gray-100 dark:border-gray-700 flex items-center gap-2">
      <button
        v-for="action in actions"
        :key="action.label"
        class="text-xs font-medium px-3 py-1.5 rounded-md transition-colors"
        :class="{
          'bg-blue-600 text-white hover:bg-blue-700': action.variant === 'primary' || !action.variant,
          'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600': action.variant === 'secondary',
          'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300': action.variant === 'ghost',
        }"
        @click="action.onClick"
      >
        {{ action.icon }}{{ action.label }}
      </button>
    </div>
  </div>
</template>
