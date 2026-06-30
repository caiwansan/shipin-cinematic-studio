<script setup lang="ts">
const props = defineProps<{
  before: Record<string, any>
  after: Record<string, any>
}>()
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
    <div class="grid grid-cols-2 divide-x divide-gray-200 dark:divide-gray-700">
      <div class="p-3">
        <div class="text-xs font-medium text-gray-400 uppercase mb-2">Before</div>
        <pre class="text-xs text-gray-600 dark:text-gray-400 overflow-auto max-h-40">{{ JSON.stringify(before, null, 2) }}</pre>
      </div>
      <div class="p-3 bg-green-50 dark:bg-green-900/10">
        <div class="text-xs font-medium text-green-600 uppercase mb-2">After</div>
        <pre class="text-xs text-green-800 dark:text-green-300 overflow-auto max-h-40">{{ JSON.stringify(after, null, 2) }}</pre>
      </div>
    </div>
  </div>
</template>
