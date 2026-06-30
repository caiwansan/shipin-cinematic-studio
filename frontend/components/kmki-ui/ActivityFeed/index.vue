<script setup lang="ts">
export interface ActivityEvent {
  id: string
  icon: string
  title: string
  time: string
  description?: string
  type: string
}

const props = defineProps<{
  events: ActivityEvent[]
}>()
</script>

<template>
  <div class="space-y-1">
    <div
      v-for="event in events"
      :key="event.id"
      class="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
    >
      <span class="text-lg mt-0.5">{{ event.icon }}</span>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <span class="text-sm font-medium text-gray-900 dark:text-white">{{ event.title }}</span>
          <span class="text-xs text-gray-400">{{ event.time }}</span>
        </div>
        <p v-if="event.description" class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          {{ event.description }}
        </p>
      </div>
    </div>
  </div>
</template>
