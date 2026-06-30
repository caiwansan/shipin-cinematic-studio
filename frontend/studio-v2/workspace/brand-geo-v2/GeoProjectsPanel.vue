<script setup lang="ts">
import { ref, onMounted } from 'vue'

const selected = defineModel<string | null>({ required: true })

const projects = ref<any[]>([])
const loading = ref(true)

onMounted(async () => {
  try {
    const res: any = await $fetch('/api/geo/list')
    if (res.success) {
      projects.value = res.data || []
      if (projects.value.length > 0 && !selected.value) {
        selected.value = projects.value[0].id
      }
    }
  } catch {
    // ignore API errors
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
    <div class="p-4 border-b border-gray-200 dark:border-gray-700">
      <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300">Projects</h3>
    </div>
    <div class="flex-1 overflow-auto">
      <div v-if="loading" class="p-4 space-y-3">
        <div v-for="i in 3" :key="i" class="h-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
      </div>
      <button
        v-for="p in projects"
        :key="p.id"
        class="w-full text-left px-4 py-3 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        :class="{ 'bg-blue-50 dark:bg-blue-900/20 border-l-2 border-l-blue-500': selected === p.id }"
        @click="selected = p.id"
      >
        <div class="text-sm font-medium">{{ p.name || p.brandName || p.id }}</div>
        <div class="text-xs text-gray-400 mt-0.5">{{ p.industry || 'Unknown' }}</div>
      </button>
    </div>
  </div>
</template>
