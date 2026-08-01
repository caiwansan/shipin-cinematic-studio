<!--
  MediaKpiCard — 驾驶舱 KPI 卡（Sprint-MEDIA-UX-03）
  - value 为 null → 数据源未接入空态（禁 mock）
  - source 标注真实数据来源（agent_outcome / usage_logs / SocialMetricsSnapshot）
-->
<template>
  <div class="mkc" :class="{ 'is-empty': value === null }">
    <div class="mkc-head">
      <span class="mkc-icon">{{ icon }}</span>
      <span class="mkc-label">{{ label }}</span>
      <span v-if="trend !== undefined && trend !== null" class="mkc-trend" :class="trend >= 0 ? 'up' : 'down'">
        {{ trend >= 0 ? '▲' : '▼' }} {{ Math.abs(trend) }}
      </span>
    </div>
    <template v-if="value !== null">
      <div class="mkc-value" :class="accent">{{ value }}</div>
      <div class="mkc-sub">{{ sub }}</div>
    </template>
    <template v-else>
      <div class="mkc-empty">
        <span class="mkc-empty-line"></span>
        <span class="mkc-empty-text">{{ emptyText || '数据源待接入' }}</span>
      </div>
    </template>
    <div class="mkc-source">⚡ {{ source }}</div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  icon: string
  label: string
  value: string | number | null
  sub?: string
  source: string
  accent?: 'green' | 'blue' | 'amber' | 'purple' | 'red'
  trend?: number | null
  emptyText?: string
}>()
</script>

<style scoped>
.mkc {
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-primary);
  border-radius: 14px;
  padding: 18px;
  position: relative;
  overflow: hidden;
  transition: border-color 0.2s, transform 0.2s;
}
.mkc:hover {
  border-color: var(--color-border-accent);
  transform: translateY(-2px);
}
.mkc::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, var(--color-intelligence), var(--color-decision));
  opacity: 0.5;
}
.mkc-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
}
.mkc-icon {
  font-size: 15px;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: var(--color-bg-hover);
  display: flex;
  align-items: center;
  justify-content: center;
}
.mkc-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary);
  letter-spacing: 0.03em;
}
.mkc-trend {
  margin-left: auto;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 8px;
}
.mkc-trend.up {
  color: var(--color-execution);
  background: var(--color-execution-glow);
}
.mkc-trend.down {
  color: var(--color-danger);
  background: rgba(239, 68, 68, 0.12);
}
.mkc-value {
  font-size: 32px;
  font-weight: 800;
  color: var(--color-text-primary);
  letter-spacing: -0.02em;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}
.mkc-value.green { color: var(--color-execution); }
.mkc-value.blue { color: var(--color-decision); }
.mkc-value.amber { color: var(--color-warning); }
.mkc-value.purple { color: var(--color-intelligence); }
.mkc-value.red { color: var(--color-danger); }
.mkc-sub {
  font-size: 12px;
  color: var(--color-text-muted);
  margin-top: 6px;
}
.mkc-empty {
  padding: 10px 0 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.mkc-empty-line {
  height: 26px;
  width: 70%;
  border-radius: 6px;
  background: linear-gradient(90deg, var(--color-bg-hover), var(--color-bg-active), var(--color-bg-hover));
  background-size: 200% 100%;
  animation: shimmer 2s infinite;
}
.mkc-empty-text {
  font-size: 11px;
  color: var(--color-text-muted);
}
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
.mkc-source {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--color-border-primary);
  font-size: 10px;
  color: var(--color-text-disabled);
  letter-spacing: 0.04em;
}
</style>
