<script setup lang="ts">
withDefaults(defineProps<{
  rows?: number
  type?: 'card' | 'text' | 'table'
}>(), {
  rows: 3,
  type: 'card',
})
</script>

<template>
  <div v-if="type === 'card'" class="space-y-4">
    <div v-for="i in rows" :key="i" class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 animate-pulse mb-3" />
      <div class="h-8 bg-gray-200 dark:bg-gray-700 rounded w-2/3 animate-pulse mb-2" />
      <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2 animate-pulse" />
    </div>
  </div>
  <div v-else-if="type === 'text'" class="space-y-2">
    <div v-for="i in rows" :key="i" class="h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" :class="i % 2 === 0 ? 'w-3/4' : 'w-full'" />
  </div>
  <div v-else class="space-y-1">
    <div v-for="i in rows" :key="i" class="h-10 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
  </div>
</template>
