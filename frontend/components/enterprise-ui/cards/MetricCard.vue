<!-- MetricCard — KPI 指标卡 -->
<!-- IMP-02: 展示 Label + Value + Source + Freshness -->
<!-- 禁止孤立数字 -->
<template>
  <div class="metric-card">
    <div class="metric-label">{{ metric.data.label || 'Metric' }}</div>
    <div class="metric-value">
      {{ metric.data.value }}
      <span v-if="metric.data.trend" class="metric-trend">{{ metric.data.trend }}</span>
    </div>
    <div class="metric-source">
      <span class="metric-source-name">Source: {{ metric.source }}</span>
      <span class="metric-freshness">Updated: {{ formattedFreshness }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { EnterpriseDataEnvelope, MetricValue } from '~/types/enterprise-envelope'

const props = defineProps<{
  metric: EnterpriseDataEnvelope<MetricValue>
}>()

const formattedFreshness = computed(() => {
  const ts = props.metric.freshness || props.metric.timestamp
  if (!ts) return 'unknown'
  const date = new Date(ts)
  const diff = Date.now() - date.getTime()
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  return `${Math.floor(hr / 24)}d ago`
})
</script>

<style scoped>
.metric-card {
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  transition: border-color 0.2s;
}
.metric-card:hover {
  border-color: var(--color-border-accent);
}
.metric-label {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: var(--space-xs);
}
.metric-value {
  font-size: var(--font-size-2xl);
  font-weight: 700;
  color: var(--color-text-primary);
}
.metric-trend {
  font-size: var(--font-size-sm);
  color: var(--color-execution);
  margin-left: var(--space-sm);
  font-weight: 400;
}
.metric-source {
  display: flex;
  justify-content: space-between;
  margin-top: var(--space-sm);
  padding-top: var(--space-sm);
  border-top: 1px solid var(--color-border-primary);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}
.metric-source-name {
  font-weight: 500;
}
</style>
