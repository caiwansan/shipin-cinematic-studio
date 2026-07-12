<template>
  <div class="geo-score-card" :class="className">
    <div class="geo-score-card__header">
      <span class="geo-score-card__label">{{ label }}</span>
      <GeoBadge v-if="badge" :variant="badgeVariant">{{ badge }}</GeoBadge>
    </div>
    <div class="geo-score-card__value-row">
      <span class="geo-score-card__value" :class="scoreColorClass">{{ displayValue }}</span>
      <slot name="suffix" />
    </div>
    <div v-if="progress" class="geo-score-card__track">
      <div
        class="geo-score-card__fill"
        :style="{ width: Math.min(100, Math.max(0, progress)) + '%' }"
        :class="scoreColorClass"
      />
    </div>
    <div v-if="subtext" class="geo-score-card__subtext">{{ subtext }}</div>
    <div v-if="description" class="geo-score-card__description">{{ description }}</div>
    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import GeoBadge from '../GeoBadge/index.vue'

const props = withDefaults(defineProps<{
  label?: string
  displayValue?: string | number
  badge?: string
  badgeVariant?: string
  progress?: number
  subtext?: string
  description?: string
  className?: string
}>(), {
  label: '',
  displayValue: '',
  badge: '',
  badgeVariant: 'info',
  subtext: '',
  description: '',
  className: '',
})

const scoreColorClass = computed(() => {
  if (typeof props.displayValue === 'number') {
    if (props.displayValue >= 80) return 'geo-score-card--high'
    if (props.displayValue >= 50) return 'geo-score-card--mid'
    return 'geo-score-card--low'
  }
  return ''
})
</script>

<style scoped>
.geo-score-card {
  padding: 20px;
  border-radius: 12px;
  background: #fff;
  border: 1px solid #e5e7eb;
}
.geo-score-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.geo-score-card__label {
  font-size: 13px;
  color: #6b7280;
  font-weight: 500;
}
.geo-score-card__value-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 12px;
}
.geo-score-card__value {
  font-size: 32px;
  font-weight: 700;
  color: #111827;
  line-height: 1.1;
}
.geo-score-card__value.geo-score-card--high { color: #059669; }
.geo-score-card__value.geo-score-card--mid { color: #d97706; }
.geo-score-card__value.geo-score-card--low { color: #dc2626; }

.geo-score-card__track {
  height: 6px;
  border-radius: 3px;
  background: #e5e7eb;
  margin-bottom: 10px;
  overflow: hidden;
}
.geo-score-card__fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.6s ease;
}
.geo-score-card__fill.geo-score-card--high { background: #059669; }
.geo-score-card__fill.geo-score-card--mid { background: #d97706; }
.geo-score-card__fill.geo-score-card--low { background: #dc2626; }

.geo-score-card__subtext {
  font-size: 12px;
  color: #9ca3af;
}
.geo-score-card__description {
  font-size: 13px;
  color: #6b7280;
  margin-top: 6px;
  line-height: 1.4;
}
</style>
