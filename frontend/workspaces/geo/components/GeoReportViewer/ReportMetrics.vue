<template>
  <div class="geo-report-metrics" v-if="metrics.length > 0">
    <div
      v-for="(m, i) in metrics"
      :key="i"
      class="geo-report-metrics__card"
      :class="`geo-report-metrics__card--${m.color || 'neutral'}`"
    >
      <span class="geo-report-metrics__value">{{ m.value }}{{ m.unit ? '' : '' }}</span>
      <span class="geo-report-metrics__label">{{ m.label }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { MetricItem } from '../types'

defineProps<{
  metrics: MetricItem[]
}>()
</script>

<style scoped>
.geo-report-metrics {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.geo-report-metrics__card {
  flex: 1;
  min-width: 140px;
  padding: 16px;
  border-radius: 10px;
  border: 1px solid #e5e7eb;
  background: #fff;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.geo-report-metrics__value {
  font-size: 20px;
  font-weight: 700;
  color: #111827;
}
.geo-report-metrics__label {
  font-size: 13px;
  color: #6b7280;
}
.geo-report-metrics__card--green { border-left: 3px solid #22c55e; }
.geo-report-metrics__card--yellow { border-left: 3px solid #eab308; }
.geo-report-metrics__card--red { border-left: 3px solid #ef4444; }
.geo-report-metrics__card--neutral { border-left: 3px solid #9ca3af; }
</style>
