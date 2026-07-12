<template>
  <div class="evidence-panel" data-testid="evidence-panel">
    <div
      v-for="item in displayItems"
      :key="item.id"
      class="evidence-panel__item"
    >
      <span
        class="evidence-panel__source-badge"
        :class="`evidence-panel__source-badge--${item.source}`"
      >
        {{ sourceLabel(item.source) }}
      </span>
      <p class="evidence-panel__summary">{{ item.summary }}</p>
      <p v-if="item.detail" class="evidence-panel__detail">{{ item.detail }}</p>
      <span v-if="item.timestamp" class="evidence-panel__timestamp">{{ item.timestamp }}</span>
    </div>
    <button
      v-if="hasMore"
      class="evidence-panel__more"
      @click="expanded = true"
    >
      还有 {{ remaining }} 条证据
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { EvidenceItem, EvidenceSource } from '~/workspaces/geo/types/ai'

interface EvidencePanelProps {
  items: EvidenceItem[]
  maxItems?: number
}

const props = withDefaults(defineProps<EvidencePanelProps>(), {
  maxItems: undefined,
})

const sourceLabelMap: Record<EvidenceSource, string> = {
  scan: '扫描发现',
  knowledge: '知识库',
  timeline: '时间线',
  verification: '验证结果',
}

function sourceLabel(source: EvidenceSource): string {
  return sourceLabelMap[source] || source
}

const expanded = ref(false)

const effectiveMax = computed(() => {
  if (props.maxItems === undefined) return undefined
  return props.maxItems
})

const displayItems = computed(() => {
  const max = effectiveMax.value
  if (max === undefined || expanded.value) return props.items
  return props.items.slice(0, max)
})

const hasMore = computed(() => {
  const max = effectiveMax.value
  return max !== undefined && !expanded.value && props.items.length > max
})

const remaining = computed(() => {
  const max = effectiveMax.value
  if (max === undefined) return 0
  return props.items.length - max
})
</script>

<style scoped>
.evidence-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.evidence-panel__item {
  padding: 10px 12px;
  background: #f9fafb;
  border-radius: 6px;
  border: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.evidence-panel__source-badge {
  display: inline-block;
  font-size: 0.6875rem;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
  align-self: flex-start;
  text-transform: none;
}

.evidence-panel__source-badge--scan {
  background: #dbeafe;
  color: #1d4ed8;
}

.evidence-panel__source-badge--knowledge {
  background: #f3e8ff;
  color: #7c3aed;
}

.evidence-panel__source-badge--timeline {
  background: #fef3c7;
  color: #b45309;
}

.evidence-panel__source-badge--verification {
  background: #d1fae5;
  color: #059669;
}

.evidence-panel__summary {
  font-size: 0.875rem;
  font-weight: 500;
  color: #1f2937;
  margin: 0;
}

.evidence-panel__detail {
  font-size: 0.8125rem;
  color: #6b7280;
  margin: 0;
}

.evidence-panel__timestamp {
  font-size: 0.75rem;
  color: #9ca3af;
}

.evidence-panel__more {
  font-size: 0.8125rem;
  color: #6366f1;
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 0;
  text-align: left;
  text-decoration: underline;
}

.evidence-panel__more:hover {
  color: #4f46e5;
}
</style>
