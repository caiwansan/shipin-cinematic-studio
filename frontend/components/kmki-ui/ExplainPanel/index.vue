<script setup lang="ts">
export interface ExplainData {
  why: string
  evidence: string
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
  source: string
  details?: Record<string, any>[]
}

const props = defineProps<{
  data: ExplainData
  open?: boolean
}>()

const isOpen = defineModel<boolean>('open', { default: false })
</script>

<template>
  <div class="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
    <button
      class="w-full px-4 py-3 flex items-center justify-between text-left"
      @click="isOpen = !isOpen"
    >
      <span class="text-sm font-medium text-gray-700 dark:text-gray-300">为什么？</span>
      <span class="text-gray-400 transition-transform" :class="{ 'rotate-180': isOpen }">▼</span>
    </button>
    <div v-if="isOpen" class="px-4 pb-4 space-y-3">
      <div>
        <div class="text-xs text-gray-400 uppercase mb-1">原因</div>
        <div class="text-sm text-gray-900 dark:text-white">{{ data.why }}</div>
      </div>
      <div>
        <div class="text-xs text-gray-400 uppercase mb-1">证据</div>
        <div class="text-sm text-gray-600 dark:text-gray-400">{{ data.evidence }}</div>
      </div>
      <div class="flex items-center gap-2">
        <div class="text-xs text-gray-400 uppercase">可信度</div>
        <Badge
          :label="data.confidence"
          :color="data.confidence === 'HIGH' ? 'green' : data.confidence === 'MEDIUM' ? 'yellow' : 'gray'"
        />
      </div>
      <div v-if="data.details" class="border-t border-gray-200 dark:border-gray-700 pt-2">
        <div v-for="(detail, i) in data.details" :key="i" class="flex justify-between text-xs py-1">
          <span class="text-gray-500">{{ detail.key }}</span>
          <span class="text-gray-700 dark:text-gray-300">{{ detail.value }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
