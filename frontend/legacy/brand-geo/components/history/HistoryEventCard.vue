<!-- @deprecated — GEO v3 Legacy. Use design-system product blocks instead. -->
<template>
  <div class="geo-history-event-card">
    <div class="geo-event-icon">{{ eventIcon }}</div>
    <div class="geo-event-body">
      <div class="geo-event-top">
        <span :class="['geo-event-type-badge', `geo-event-type--${event.type}`]">{{ typeLabel }}</span>
        <span class="geo-event-time">{{ formatTime }}</span>
      </div>
      <p class="geo-event-desc">{{ event.description }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { HistoryEvent } from '~/studio-v2/types/geo'

const props = defineProps<{
  event: HistoryEvent
}>()

const typeLabels: Record<string, string> = {
  website_scanned: '网站扫描',
  knowledge_updated: '知识更新',
  evidence_generated: '证据生成',
  claim_generated: '事实生成',
  citation_generated: '引用生成',
  report_generated: '报告生成',
}

const typeIcons: Record<string, string> = {
  website_scanned: '🌐',
  knowledge_updated: '📚',
  evidence_generated: '📄',
  claim_generated: '📋',
  citation_generated: '📝',
  report_generated: '📊',
}

const typeLabel = computed(() => typeLabels[props.event.type] || props.event.type)
const eventIcon = computed(() => typeIcons[props.event.type] || '📌')

const formatTime = computed(() => {
  try {
    const d = new Date(props.event.timestamp)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return '刚刚'
    if (diffMin < 60) return `${diffMin} 分钟前`
    const diffHour = Math.floor(diffMin / 60)
    if (diffHour < 24) return `${diffHour} 小时前`
    return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch { return props.event.timestamp }
})
</script>

<style scoped>
.geo-history-event-card {
  display: flex;
  gap: 12px;
  padding: 12px 14px;
  background: var(--geo-bg-card);
  border: 1px solid var(--geo-border);
  border-radius: var(--geo-radius-lg);
}
.geo-event-icon { font-size: 20px; line-height: 1; padding-top: 2px; }
.geo-event-body { flex: 1; min-width: 0; }
.geo-event-top { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.geo-event-type-badge { padding: 1px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; }
.geo-event-type--website_scanned { background: rgba(96, 165, 250, 0.15); color: var(--geo-info); }
.geo-event-type--knowledge_updated { background: rgba(99, 102, 241, 0.15); color: var(--geo-accent); }
.geo-event-type--evidence_generated { background: rgba(52, 211, 153, 0.15); color: var(--geo-success); }
.geo-event-type--claim_generated { background: rgba(251, 191, 36, 0.15); color: var(--geo-warning); }
.geo-event-type--citation_generated { background: rgba(148, 163, 184, 0.15); color: var(--geo-text-secondary); }
.geo-event-type--report_generated { background: rgba(239, 68, 68, 0.15); color: var(--geo-error); }
.geo-event-time { margin-left: auto; font-size: 11px; color: var(--geo-text-dim); }
.geo-event-desc { font-size: 13px; color: var(--geo-text); margin: 0; line-height: 1.5; }
</style>
