<template>
  <div class="geo-report-card" @click="$emit('click')">
    <div class="geo-report-icon">{{ reportIcon }}</div>
    <div class="geo-report-body">
      <h4 class="geo-report-title">{{ report.title }}</h4>
      <p class="geo-report-summary">{{ report.summary }}</p>
      <div class="geo-report-meta">
        <span :class="['geo-report-type-badge', `geo-report-type--${report.type}`]">{{ typeLabel }}</span>
        <span class="geo-report-date">{{ formatDate }}</span>
        <span class="geo-report-sections">{{ report.sections.length }} 章节</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Report } from '~/studio-v2/types/geo'

const props = defineProps<{
  report: Report
}>()

defineEmits<{ click: [] }>()

const typeLabels: Record<string, string> = {
  brand: '品牌报告', knowledge: '知识报告', evidence: '证据报告', claim: '声明报告', executive: '执行摘要',
}

const typeIcons: Record<string, string> = {
  brand: '🏢', knowledge: '📚', evidence: '📄', claim: '📋', executive: '📊',
}

const typeLabel = computed(() => typeLabels[props.report.type] || props.report.type)
const reportIcon = computed(() => typeIcons[props.report.type] || '📄')

const formatDate = computed(() => {
  try {
    return new Date(props.report.generatedAt).toLocaleDateString('zh-CN', {
      year: 'numeric', month: 'short', day: 'numeric',
    })
  } catch { return props.report.generatedAt }
})
</script>

<style scoped>
.geo-report-card {
  display: flex;
  gap: 14px;
  padding: 16px;
  background: var(--geo-bg-card);
  border: 1px solid var(--geo-border);
  border-radius: var(--geo-radius-lg);
  cursor: pointer;
  transition: border-color 0.15s;
}
.geo-report-card:hover { border-color: var(--geo-accent); }
.geo-report-icon { font-size: 28px; line-height: 1; padding-top: 2px; flex-shrink: 0; }
.geo-report-body { flex: 1; min-width: 0; }
.geo-report-title { font-size: 14px; font-weight: 600; color: var(--geo-text); margin: 0 0 4px; }
.geo-report-summary { font-size: 12px; color: var(--geo-text-secondary); margin: 0 0 8px; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.geo-report-meta { display: flex; align-items: center; gap: 10px; font-size: 11px; }
.geo-report-type-badge { padding: 1px 8px; border-radius: 10px; font-weight: 600; }
.geo-report-type--brand { background: rgba(99, 102, 241, 0.15); color: var(--geo-accent); }
.geo-report-type--knowledge { background: rgba(96, 165, 250, 0.15); color: var(--geo-info); }
.geo-report-type--evidence { background: rgba(52, 211, 153, 0.15); color: var(--geo-success); }
.geo-report-type--claim { background: rgba(251, 191, 36, 0.15); color: var(--geo-warning); }
.geo-report-type--executive { background: rgba(239, 68, 68, 0.15); color: var(--geo-error); }
.geo-report-date { color: var(--geo-text-dim); }
.geo-report-sections { color: var(--geo-text-secondary); }
</style>
