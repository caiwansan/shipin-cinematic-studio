<!-- @deprecated — GEO v3 Legacy. Use design-system product blocks instead. -->
<template>
  <div class="geo-report-viewer">
    <div class="geo-report-header">
      <h3 class="geo-report-viewer-title">{{ report.title }}</h3>
      <p class="geo-report-viewer-summary">{{ report.summary }}</p>
      <div class="geo-report-viewer-meta">
        <span :class="['geo-report-type-badge', `geo-report-type--${report.type}`]">{{ typeLabel }}</span>
        <span class="geo-report-viewer-date">生成于 {{ formatDate }}</span>
      </div>
    </div>

    <div class="geo-report-sections">
      <div v-for="(section, idx) in report.sections" :key="idx" class="geo-report-section">
        <div class="geo-report-section-header" @click="toggleSection(idx)">
          <h4 class="geo-report-section-title">{{ section.title }}</h4>
          <span class="geo-report-section-toggle">{{ expanded[idx] ? '▼' : '▶' }}</span>
        </div>
        <div v-show="expanded[idx]" class="geo-report-section-body">
          <p class="geo-report-section-content">{{ section.content }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive } from 'vue'
import type { Report } from '~/studio-v2/types/geo'

const props = defineProps<{
  report: Report
}>()

const typeLabels: Record<string, string> = {
  brand: '品牌报告', knowledge: '知识报告', evidence: '证据报告', claim: '声明报告', executive: '执行摘要',
}

const typeLabel = computed(() => typeLabels[props.report.type] || props.report.type)

const formatDate = computed(() => {
  try {
    return new Date(props.report.generatedAt).toLocaleDateString('zh-CN', {
      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  } catch { return props.report.generatedAt }
})

const expanded = reactive<Record<number, boolean>>({})

function toggleSection(idx: number) {
  expanded[idx] = !expanded[idx]
}
</script>

<style scoped>
.geo-report-viewer { }
.geo-report-header { margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid var(--geo-border); }
.geo-report-viewer-title { font-size: 18px; font-weight: 700; color: var(--geo-text); margin: 0 0 8px; }
.geo-report-viewer-summary { font-size: 13px; color: var(--geo-text-secondary); margin: 0 0 12px; line-height: 1.6; }
.geo-report-viewer-meta { display: flex; align-items: center; gap: 12px; font-size: 12px; }
.geo-report-type-badge { padding: 2px 10px; border-radius: 10px; font-weight: 600; font-size: 11px; }
.geo-report-type--brand { background: rgba(99, 102, 241, 0.15); color: var(--geo-accent); }
.geo-report-type--knowledge { background: rgba(96, 165, 250, 0.15); color: var(--geo-info); }
.geo-report-type--evidence { background: rgba(52, 211, 153, 0.15); color: var(--geo-success); }
.geo-report-type--claim { background: rgba(251, 191, 36, 0.15); color: var(--geo-warning); }
.geo-report-type--executive { background: rgba(239, 68, 68, 0.15); color: var(--geo-error); }
.geo-report-viewer-date { color: var(--geo-text-dim); }
.geo-report-sections { display: flex; flex-direction: column; gap: 8px; }
.geo-report-section { background: var(--geo-bg-card); border: 1px solid var(--geo-border); border-radius: var(--geo-radius-lg); overflow: hidden; }
.geo-report-section-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; cursor: pointer; }
.geo-report-section-title { font-size: 14px; font-weight: 600; color: var(--geo-text); margin: 0; }
.geo-report-section-toggle { font-size: 10px; color: var(--geo-text-dim); }
.geo-report-section-body { padding: 0 16px 12px; }
.geo-report-section-content { font-size: 13px; line-height: 1.6; color: var(--geo-text-secondary); margin: 0; white-space: pre-wrap; }
</style>
