<template>
  <div class="bg-white">
    <div class="max-w-4xl mx-auto px-4 py-12">
      <h1 class="text-4xl font-bold text-gray-900 break-words">{{ manifest.identity?.name || '—' }}</h1>
      <p v-if="manifest.content?.summary" class="mt-4 text-lg text-gray-600">
        {{ manifest.content.summary }}
      </p>
      <p class="mt-2 text-sm text-gray-400">
        最后更新: {{ manifest.routing?.updatedAt || '—' }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ manifest: any }>()
</script>
