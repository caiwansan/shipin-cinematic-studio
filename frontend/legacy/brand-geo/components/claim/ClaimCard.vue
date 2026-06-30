<!-- @deprecated — GEO v3 Legacy. Use design-system product blocks instead. -->
<template>
  <div :class="['geo-claim-card', { 'geo-claim-card--clickable': clickable }]" @click="clickable && $emit('click')">
    <div class="geo-claim-card-header">
      <span :class="['geo-claim-type-badge', `geo-claim-type--${claim.claimType}`]">
        {{ typeLabel }}
      </span>
      <span :class="['geo-status-badge', `geo-status--${claim.status}`]">{{ statusLabel }}</span>
    </div>
    <p class="geo-claim-text">{{ claim.text }}</p>
    <div class="geo-claim-card-footer">
      <span class="geo-claim-confidence">
        置信度: <strong>{{ Math.round(claim.confidence * 100) }}%</strong>
      </span>
      <span v-if="claim.evidences?.length" class="geo-claim-evidence-count">
        {{ claim.evidences.length }} 条证据
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Claim } from '~/studio-v2/types/geo'

const props = defineProps<{
  claim: Claim
  clickable?: boolean
}>()

defineEmits<{ click: [] }>()

const typeLabels: Record<string, string> = {
  fact: '事实', primary: '主要', derived: '推导', opinion: '观点', hypothesis: '假设',
}

const statusLabels: Record<string, string> = {
  draft: '草稿', review: '审核中', approved: '已批准', rejected: '已拒绝', stale: '过期',
}

const typeLabel = computed(() => typeLabels[props.claim.claimType] || props.claim.claimType)
const statusLabel = computed(() => statusLabels[props.claim.status] || props.claim.status)
</script>

<style scoped>
.geo-claim-card {
  background: var(--geo-bg-card);
  border: 1px solid var(--geo-border);
  border-radius: var(--geo-radius-lg);
  padding: 14px 16px;
  transition: border-color 0.15s;
}
.geo-claim-card--clickable { cursor: pointer; }
.geo-claim-card--clickable:hover { border-color: var(--geo-accent); }
.geo-claim-card-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.geo-claim-type-badge { padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; }
.geo-claim-type--fact { background: rgba(52, 211, 153, 0.15); color: var(--geo-success); }
.geo-claim-type--primary { background: rgba(99, 102, 241, 0.15); color: var(--geo-accent); }
.geo-claim-type--derived { background: rgba(96, 165, 250, 0.15); color: var(--geo-info); }
.geo-claim-type--opinion { background: rgba(251, 191, 36, 0.15); color: var(--geo-warning); }
.geo-claim-type--hypothesis { background: rgba(239, 68, 68, 0.15); color: var(--geo-error); }
.geo-status-badge { margin-left: auto; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; }
.geo-status--draft { background: rgba(148, 163, 184, 0.15); color: var(--geo-text-secondary); }
.geo-status--review { background: rgba(251, 191, 36, 0.15); color: var(--geo-warning); }
.geo-status--approved { background: rgba(52, 211, 153, 0.15); color: var(--geo-success); }
.geo-status--rejected { background: rgba(239, 68, 68, 0.15); color: var(--geo-error); }
.geo-status--stale { background: rgba(107, 114, 128, 0.15); color: var(--geo-text-dim); }
.geo-claim-text { font-size: 13px; line-height: 1.5; color: var(--geo-text); margin: 0 0 8px; word-break: break-word; }
.geo-claim-card-footer { display: flex; align-items: center; gap: 12px; font-size: 11px; }
.geo-claim-confidence { color: var(--geo-text-secondary); }
.geo-claim-evidence-count { margin-left: auto; color: var(--geo-info); }
</style>
