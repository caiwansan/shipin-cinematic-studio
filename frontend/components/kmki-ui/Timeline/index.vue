<script setup lang="ts">
export interface TimelineEvent {
  id: string
  icon: string
  title: string
  time: string
  description: string
  status: string
  phase: 'optimize' | 'verify' | 'publish' | 'observe' | 'indexed' | 'drift' | 'learn'
  detail?: Record<string, any>
  onClick?: () => void
}

const props = defineProps<{
  events: TimelineEvent[]
}>()
</script>

<template>
  <div class="relative">
    <div class="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />
    <div class="space-y-6">
      <div
        v-for="event in events"
        :key="event.id"
        class="relative pl-10 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg p-2"
        @click="event.onClick"
      >
        <div
          class="absolute left-2.5 w-3 h-3 rounded-full border-2 border-white dark:border-gray-900 shadow"
          :class="{
            'bg-blue-500': event.phase === 'optimize',
            'bg-green-500': event.phase === 'verify' || event.phase === 'observe',
            'bg-purple-500': event.phase === 'publish' || event.phase === 'indexed',
            'bg-yellow-500': event.phase === 'drift',
            'bg-indigo-500': event.phase === 'learn',
          }"
        />
        <div class="flex items-start gap-2">
          <span class="text-lg">{{ event.icon }}</span>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium text-gray-900 dark:text-white">{{ event.title }}</span>
              <span class="text-xs text-gray-400">{{ event.time }}</span>
            </div>
            <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{{ event.description }}</p>
          </div>
          <Badge
            :label="event.status"
            :color="event.status === 'completed' || event.status === 'improved' ? 'green' : event.status === 'failed' ? 'red' : 'yellow'"
          />
        </div>
      </div>
    </div>
  </div>
</template>
