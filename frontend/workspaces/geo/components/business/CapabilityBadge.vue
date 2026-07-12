<template>
  <span
    v-if="meta"
    class="capability-badge"
    :class="`capability-badge--level-${levelClass}`"
    :title="tooltip"
  >
    <span class="capability-badge__truth">{{ truthLabel }}</span>
    <span class="capability-badge__separator">·</span>
    <span class="capability-badge__capability">{{ capabilityLabel }}</span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { CapabilityMetadata, TruthLevel, CapabilityLevel } from '~/workspaces/geo/types/foundation/capability'

const props = defineProps<{
  meta: CapabilityMetadata | null | undefined
}>()

// ── UI label mappings (product language, not engineering terms) ──
const TRUTH_LABELS: Record<TruthLevel, string> = {
  TRUE: '已验证',
  DERIVED: '基于品牌数据计算',
  ESTIMATION: '基于已有数据估算',
  SIMULATED: '模拟分析',
  NO_EVIDENCE: '暂无证据',
}

const CAPABILITY_LABELS: Record<CapabilityLevel, string> = {
  Production: '正式能力',
  Beta: '测试能力',
  Simulated: '模拟能力',
  Unavailable: '暂不可用',
}

const truthLabel = computed(() => {
  if (!props.meta) return ''
  return TRUTH_LABELS[props.meta.truthLevel] || props.meta.truthLevel
})

const capabilityLabel = computed(() => {
  if (!props.meta) return ''
  return CAPABILITY_LABELS[props.meta.capabilityLevel] || props.meta.capabilityLevel
})

const tooltip = computed(() => {
  if (!props.meta) return ''
  return `数据来源: ${props.meta.source} · ${truthLabel.value} · ${capabilityLabel.value}`
})

// CSS class modifier for truth/capability combination
const levelClass = computed(() => {
  if (!props.meta) return 'none'
  if (props.meta.truthLevel === 'TRUE' && props.meta.capabilityLevel === 'Production') return 'production'
  if (props.meta.truthLevel === 'DERIVED') return 'derived'
  if (props.meta.truthLevel === 'ESTIMATION') return 'estimation'
  if (props.meta.truthLevel === 'SIMULATED' || props.meta.capabilityLevel === 'Simulated') return 'simulated'
  if (props.meta.truthLevel === 'NO_EVIDENCE') return 'none'
  return 'default'
})
</script>

<style scoped>
.capability-badge {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 11px;
  line-height: 1.5;
  white-space: nowrap;
  cursor: default;
  opacity: 0.85;
  transition: opacity 0.15s;
}

.capability-badge:hover {
  opacity: 1;
}

/* Production: green-tinted, muted */
.capability-badge--level-production {
  background: #e6f7e6;
  color: #3a7d3a;
}

/* Derived: blue-tinted */
.capability-badge--level-derived {
  background: #e6f0fa;
  color: #3a6ea5;
}

/* Estimation: amber-tinted */
.capability-badge--level-estimation {
  background: #fef4e0;
  color: #8e6f1e;
}

/* Simulated: gray-tinted */
.capability-badge--level-simulated {
  background: #f0f0f0;
  color: #7a7a7a;
}

/* None/No Evidence: light gray, more subtle */
.capability-badge--level-none {
  background: #f5f5f5;
  color: #999;
}

/* Default fallback */
.capability-badge--level-default {
  background: #f0f0f0;
  color: #666;
}

.capability-badge__truth {
  font-weight: 500;
}

.capability-badge__separator {
  opacity: 0.5;
}

.capability-badge__capability {
  font-weight: 400;
  opacity: 0.85;
}
</style>
