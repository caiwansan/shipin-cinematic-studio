<!-- @deprecated — GEO v3 Legacy. Use design-system product blocks instead. -->
<template>
  <div class="geo-history-timeline">
    <div v-if="!events.length" class="geo-timeline-empty">暂无事件记录</div>
    <div v-else class="geo-timeline">
      <div v-for="(event, idx) in events" :key="event.id" class="geo-timeline-node">
        <div class="geo-timeline-marker">
          <div class="geo-timeline-dot" :class="`geo-timeline-dot--${event.type}`">{{ eventIcon(event) }}</div>
          <div v-if="idx < events.length - 1" class="geo-timeline-line"></div>
        </div>
        <div class="geo-timeline-content">
          <HistoryEventCard :event="event" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { HistoryEvent } from '~/studio-v2/types/geo'
import HistoryEventCard from './HistoryEventCard.vue'

defineProps<{
  events: HistoryEvent[]
}>()

const typeIcons: Record<string, string> = {
  website_scanned: '🌐',
  knowledge_updated: '📚',
  evidence_generated: '📄',
  claim_generated: '📋',
  citation_generated: '📝',
  report_generated: '📊',
}

function eventIcon(event: HistoryEvent): string {
  return typeIcons[event.type] || '📌'
}
</script>

<style scoped>
.geo-history-timeline { }
.geo-timeline-empty { text-align: center; padding: 40px; color: var(--geo-text-dim); font-size: 13px; }
.geo-timeline { display: flex; flex-direction: column; gap: 0; }
.geo-timeline-node { display: flex; gap: 14px; position: relative; }
.geo-timeline-marker { display: flex; flex-direction: column; align-items: center; width: 36px; flex-shrink: 0; }
.geo-timeline-dot { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; background: var(--geo-bg-card); border: 2px solid var(--geo-border); z-index: 1; }
.geo-timeline-line { width: 2px; flex: 1; background: var(--geo-border); margin-top: 4px; }
.geo-timeline-content { flex: 1; padding-bottom: 16px; min-width: 0; }
</style>
