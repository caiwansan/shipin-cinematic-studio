<template>
  <div class="export-menu relative">
    <div class="relative inline-block">
      <!-- Trigger Button -->
      <button
        class="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
        @click="open = !open"
      >
        <span>📤 Export</span>
        <svg class="w-3.5 h-3.5" :class="{ 'rotate-180': open }" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <!-- Dropdown -->
      <div
        v-if="open"
        class="absolute right-0 mt-1 w-44 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1"
      >
        <button
          class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
          @click="handleExport('markdown')"
        >
          <span class="text-base">📝</span>
          Export as Markdown
        </button>
        <button
          class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
          @click="handleExport('json')"
        >
          <span class="text-base">📄</span>
          Export as JSON
        </button>
        <button
          class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
          @click="handleCopy"
        >
          <span class="text-base">📋</span>
          Copy to Clipboard
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { DeliverableReport } from '../../../workspaces/geo/types/report'

const props = defineProps<{
  report: DeliverableReport
  markdownContent?: string
}>()

const emit = defineEmits<{
  (e: 'export', format: 'markdown' | 'json'): void
  (e: 'copy'): void
}>()

const open = ref(false)

function handleExport(format: 'markdown' | 'json') {
  open.value = false
  emit('export', format)
}

function handleCopy() {
  open.value = false
  emit('copy')
}

// Close on outside click
function onClickOutside(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (!target.closest('.export-menu')) {
    open.value = false
  }
}

if (typeof window !== 'undefined') {
  document.addEventListener('click', onClickOutside)
}
</script>
