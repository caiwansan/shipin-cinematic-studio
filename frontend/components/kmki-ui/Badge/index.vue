<script setup lang="ts">
const props = withDefaults(defineProps<{
  label: string
  color?: 'green' | 'yellow' | 'red' | 'blue' | 'gray' | 'purple'
  size?: 'sm' | 'md'
}>(), {
  color: 'gray',
  size: 'sm',
})

const classMap: Record<string, Record<string, string>> = {
  sm: {
    green: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200',
    yellow: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200',
    red: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200',
    blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200',
    gray: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-200',
    purple: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200',
  },
  md: {
    green: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200',
    yellow: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200',
    red: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200',
    blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200',
    gray: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-200',
    purple: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200',
  },
}

const sizeClass = computed(() => props.size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm')
</script>

<template>
  <span
    class="inline-flex items-center rounded-full font-medium"
    :class="[sizeClass, classMap[size][color]]"
  >
    {{ label }}
  </span>
</template>
