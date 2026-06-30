<!-- @deprecated — GEO v3 Legacy. Use design-system product blocks instead. -->
<template>
  <div class="timeline">
    <div v-for="(stage, i) in stages" :key="i" class="timeline-stage">
      <div class="tl-line" :class="i < stages.length - 1 ? 'has-line' : ''">
        <div class="tl-dot" :class="`dot-${stage.status}`"></div>
        <div v-if="i < stages.length - 1" class="tl-connector"></div>
      </div>
      <div class="tl-content" @click="stage.detail ? (expanded = expanded === i ? null : i) : null">
        <div class="tl-row">
          <span class="tl-name">{{ stage.name }}</span>
          <span v-if="stage.durationMs !== null" class="tl-duration">{{ stage.durationMs }}ms</span>
          <span class="tl-status" :class="`status-${stage.status}`">{{ statusLabel(stage.status) }}</span>
          <span v-if="stage.retry" class="tl-retry">retry ×{{ stage.retry }}</span>
        </div>
        <div v-if="expanded === i && stage.detail" class="tl-detail">{{ stage.detail }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

export interface TimelineStage {
  name: string
  durationMs: number | null
  status: 'success' | 'fail' | 'pending' | 'na'
  retry?: number
  detail?: string
}

const props = defineProps<{ stages: TimelineStage[] }>()
const expanded = ref<number | null>(null)

function statusLabel(s: string) {
  switch (s) {
    case 'success': return '✓'
    case 'fail': return '✗'
    case 'pending': return '...'
    default: return '—'
  }
}
</script>

<style scoped>
.timeline { padding: 12px 0; }
.timeline-stage { display: flex; gap: 12px; min-height: 36px; }
.tl-line { display: flex; flex-direction: column; align-items: center; width: 20px; }
.tl-dot { width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0; }
.dot-success { background: #22c55e; box-shadow: 0 0 6px rgba(34,197,94,0.4); }
.dot-fail { background: #ef4444; box-shadow: 0 0 6px rgba(239,68,68,0.4); }
.dot-na { background: #475569; }
.dot-pending { background: #f59e0b; animation: pulse 1.5s infinite; }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
.tl-connector { width: 2px; flex: 1; background: #334155; min-height: 24px; }
.tl-content { flex: 1; cursor: pointer; padding-bottom: 12px; }
.tl-row { display: flex; align-items: center; gap: 12px; }
.tl-name { font-size: 13px; color: #e2e8f0; font-weight: 500; width: 140px; }
.tl-duration { font-size: 11px; color: #64748b; font-family: monospace; width: 60px; }
.tl-status { font-size: 12px; font-weight: 600; width: 24px; }
.status-success { color: #22c55e; }
.status-fail { color: #ef4444; }
.status-na { color: #475569; }
.status-pending { color: #f59e0b; }
.tl-retry { font-size: 10px; background: #451a03; color: #fbbf24; padding: 1px 4px; border-radius: 4px; }
.tl-detail { margin-top: 4px; font-size: 11px; color: #94a3b8; padding: 4px 8px; background: #1e293b; border-radius: 4px; white-space: pre-wrap; }
</style>
