<template>
  <div
    class="geo-metric-card"
    :class="{ 'geo-metric-card--clickable': clickable }"
    @click="$emit('click')"
  >
    <div class="geo-metric-card__header">
      <span class="geo-metric-card__label">{{ label }}</span>
      <GeoBadge v-if="badge" :variant="badgeVariant">{{ badge }}</GeoBadge>
    </div>
    <div class="geo-metric-card__value-row">
      <span class="geo-metric-card__value">{{ displayValue }}</span>
      <slot name="suffix" />
    </div>
    <div v-if="subtext" class="geo-metric-card__subtext">{{ subtext }}</div>
    <slot />
  </div>
</template>

<script setup lang="ts">
import GeoBadge from '../GeoBadge/index.vue'

defineProps<{
  label?: string
  displayValue?: string | number
  badge?: string
  badgeVariant?: 'success' | 'warning' | 'error' | 'info' | 'neutral'
  subtext?: string
  clickable?: boolean
}>()

defineEmits<{
  click: []
}>()
</script>

<style scoped>
.geo-metric-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 16px;
  background: #ffffff;
  border: 1px solid #f3f4f6;
  border-radius: 10px;
  transition: all 0.15s;
}

.geo-metric-card--clickable {
  cursor: pointer;
}

.geo-metric-card--clickable:hover {
  border-color: #d1d5db;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.geo-metric-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.geo-metric-card__label {
  font-size: 12px;
  font-weight: 500;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.geo-metric-card__value-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.geo-metric-card__value {
  font-size: 28px;
  font-weight: 700;
  color: #111827;
  line-height: 1.2;
  letter-spacing: -0.02em;
}

.geo-metric-card__subtext {
  font-size: 12px;
  color: #9ca3af;
}
</style>
