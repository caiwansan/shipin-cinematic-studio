<template>
  <div class="roi-card">
    <div class="roi-card__header">
      <span class="roi-card__title">{{ title }}</span>
      <BusinessImpactBadge v-if="impact" :impact="impact" />
    </div>
    <div class="roi-card__metrics">
      <div class="roi-card__metric" v-for="m in metrics" :key="m.label">
        <span class="roi-card__metric-value" :class="{ 'roi-card__metric-value--positive': m.positive }">
          {{ m.prefix }}{{ m.value }}{{ m.suffix }}
        </span>
        <span class="roi-card__metric-label">{{ m.label }}</span>
      </div>
    </div>
    <div v-if="footnote" class="roi-card__footnote">{{ footnote }}</div>
  </div>
</template>

<script setup lang="ts">
import BusinessImpactBadge from './BusinessImpactBadge.vue'

export interface ROIMetric {
  label: string
  value: string | number
  prefix?: string
  suffix?: string
  positive?: boolean
}

defineProps<{
  title: string
  impact?: string
  metrics: ROIMetric[]
  footnote?: string
}>()
</script>

<style scoped>
.roi-card {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  transition: box-shadow 0.15s;
}

.roi-card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
}

.roi-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.roi-card__title {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}

.roi-card__metrics {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 8px;
}

.roi-card__metric {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 10px;
  background: #f9fafb;
  border-radius: 8px;
}

.roi-card__metric-value {
  font-size: 18px;
  font-weight: 700;
  color: #111827;
  line-height: 1.2;
}

.roi-card__metric-value--positive {
  color: #059669;
}

.roi-card__metric-label {
  font-size: 11px;
  font-weight: 500;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.roi-card__footnote {
  font-size: 12px;
  color: #9ca3af;
  font-style: italic;
}
</style>
