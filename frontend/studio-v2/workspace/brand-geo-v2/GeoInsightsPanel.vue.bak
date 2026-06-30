<script setup lang="ts">
const props = defineProps<{ projectId: string | null }>()
</script>

<template>
  <div class="h-full flex flex-col">
    <div class="p-4 border-b border-gray-200 dark:border-gray-700">
      <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300">洞察</h3>
    </div>
    <div class="flex-1 overflow-auto p-4 space-y-4">
      <div class="text-xs text-gray-400 uppercase tracking-wider">活跃告警</div>
      <div v-if="!projectId" class="text-xs text-gray-400 text-center py-4">选择项目查看洞察</div>
      <div v-else>
        <!-- Alerts will be shown here when API is available -->
      </div>
    </div>
  </div>
</template>
