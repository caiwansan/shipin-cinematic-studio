<template>
  <div class="geo-report-exporter">
    <button class="geo-report-exporter__btn" @click="toggleOpen">
      📥 导出
    </button>
    <div v-if="open" class="geo-report-exporter__dropdown" @mouseleave="open = false">
      <button
        v-for="fmt in formats"
        :key="fmt.label"
        class="geo-report-exporter__option"
        @click="handleExport(fmt)"
      >
        <span class="geo-report-exporter__option-icon">{{ fmt.icon }}</span>
        <span>{{ fmt.label }}</span>
      </button>
      <button
        class="geo-report-exporter__option geo-report-exporter__option--copy"
        @click="handleCopy"
      >
        <span>📋 复制 Markdown</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Report, ExportFormat } from '../types'
import { getExportFormats, exportReport } from './exporters/index'

const props = defineProps<{
  report: Report
}>()

const emit = defineEmits<{
  exported: [format: string]
  copied: []
}>()

const open = ref(false)

const formats = computed(() => getExportFormats())

function toggleOpen() {
  open.value = !open.value
}

async function handleExport(fmt: ExportFormat) {
  open.value = false
  await exportReport(props.report, fmt)
  emit('exported', fmt.label)
}

async function handleCopy() {
  open.value = false
  const mdBlob = await getExportFormats()[0].export(props.report)
  try {
    await navigator.clipboard.writeText(mdBlob)
  } catch {
    // Fallback
    const ta = document.createElement('textarea')
    ta.value = mdBlob
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
  }
  emit('copied')
}
</script>

<style scoped>
.geo-report-exporter {
  position: relative;
}
.geo-report-exporter__btn {
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid #d1d5db;
  background: #fff;
  color: #374151;
}
.geo-report-exporter__btn:hover {
  background: #f9fafb;
  border-color: #9ca3af;
}
.geo-report-exporter__dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  z-index: 20;
  min-width: 180px;
  overflow: hidden;
}
.geo-report-exporter__option {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 10px 14px;
  font-size: 14px;
  color: #374151;
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
}
.geo-report-exporter__option:hover {
  background: #f3f4f6;
}
.geo-report-exporter__option-icon {
  font-size: 16px;
}
.geo-report-exporter__option--copy {
  border-top: 1px solid #e5e7eb;
  color: #6b7280;
}
</style>
