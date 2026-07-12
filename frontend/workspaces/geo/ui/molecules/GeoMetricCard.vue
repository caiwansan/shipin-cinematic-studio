<template>
  <div
    :class="[
      'geo-metric-card',
      { 'geo-metric-card--clickable': clickable },
      className,
    ]"
    :data-testid="dataTestId"
    @click="clickable ? $emit('click') : undefined"
  >
    <div v-if="$slots.icon || icon" class="geo-metric-card__icon">
      <slot name="icon">
        <span v-html="icon" />
      </slot>
    </div>
    <div class="geo-metric-card__body">
      <div class="geo-metric-card__header">
        <span class="geo-metric-card__label">{{ label }}</span>
        <GeoBadge
          v-if="badge"
          :variant="badgeVariant"
          size="sm"
        >{{ badge }}</GeoBadge>
      </div>
      <div class="geo-metric-card__value-row">
        <span class="geo-metric-card__value">{{ displayValue }}</span>
        <slot name="suffix" />
      </div>
      <div v-if="trend" class="geo-metric-card__trend" :class="`geo-metric-card__trend--${trend}`">
        <span class="geo-metric-card__trend-icon">{{ trendIcon }}</span>
        <span v-if="trendText" class="geo-metric-card__trend-text">{{ trendText }}</span>
      </div>
      <div v-if="subtext" class="geo-metric-card__subtext">{{ subtext }}</div>
    </div>
    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import GeoBadge from '../atoms/GeoBadge.vue'

type TrendDir = 'up' | 'down' | 'stable'

const props = withDefaults(defineProps<{
  /** Metric label */
  label?: string
  /** Metric value (raw, without prefix/suffix) */
  value?: string | number
  /** Value prefix */
  prefix?: string
  /** Value suffix */
  suffix?: string
  /** Optional badge text */
  badge?: string
  /** Badge variant */
  badgeVariant?: 'success' | 'warning' | 'error' | 'info' | 'neutral'
  /** Trend direction */
  trend?: TrendDir
  /** Trend display text (e.g., '+12%') */
  trendText?: string
  /** Subtext below value */
  subtext?: string
  /** Icon HTML string */
  icon?: string
  /** Make card clickable */
  clickable?: boolean
  /** Additional class names */
  class?: string
  /** Data test id */
  'data-testid'?: string
}>(), {
  value: '',
  badgeVariant: 'neutral',
})

const emit = defineEmits<{
  click: []
}>()

const className = computed(() => props.class || '')
const dataTestId = computed(() => props['data-testid'] || undefined)

const displayValue = computed(() => {
  const val = String(props.value)
  return `${props.prefix || ''}${val}${props.suffix || ''}`
})

const trendIcon = computed(() => {
  switch (props.trend) {
    case 'up': return '↑'
    case 'down': return '↓'
    default: return '→'
  }
})
</script>

<style scoped>
.geo-metric-card {
  display: flex;
  align-items: flex-start;
  gap: var(--geo-space-md, 12px);
  padding: var(--geo-space-lg, 16px);
  background-color: var(--geo-bg, #ffffff);
  border: 1px solid var(--geo-border, #e5e7eb);
  border-radius: var(--geo-radius-xl, 10px);
  transition: all 150ms ease;
}

.geo-metric-card--clickable {
  cursor: pointer;
}

.geo-metric-card--clickable:hover {
  border-color: var(--geo-text-tertiary, #6b7280);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.geo-metric-card__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: var(--geo-radius-md, 6px);
  background-color: var(--geo-bg-secondary, #f9fafb);
  color: var(--geo-text-tertiary, #6b7280);
  flex-shrink: 0;
}

.geo-metric-card__body {
  flex: 1;
  min-width: 0;
}

.geo-metric-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.geo-metric-card__label {
  font-size: var(--geo-font-size-xs, 11px);
  font-weight: 500;
  color: var(--geo-text-tertiary, #6b7280);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.geo-metric-card__value-row {
  display: flex;
  align-items: center;
  gap: var(--geo-space-sm, 8px);
  margin-top: var(--geo-space-xs, 4px);
}

.geo-metric-card__value {
  font-size: 28px;
  font-weight: 700;
  color: var(--geo-text, #111827);
  line-height: 1.2;
  letter-spacing: -0.02em;
}

.geo-metric-card__trend {
  display: inline-flex;
  align-items: center;
  gap: var(--geo-space-xs, 4px);
  margin-top: var(--geo-space-xs, 4px);
  font-size: var(--geo-font-size-sm, 12px);
  font-weight: 500;
}

.geo-metric-card__trend--up {
  color: var(--geo-success, #059669);
}

.geo-metric-card__trend--down {
  color: var(--geo-error, #dc2626);
}

.geo-metric-card__trend--stable {
  color: var(--geo-text-tertiary, #6b7280);
}

.geo-metric-card__trend-icon {
  line-height: 1;
}

.geo-metric-card__trend-text {
  line-height: 1;
}

.geo-metric-card__subtext {
  font-size: var(--geo-font-size-xs, 11px);
  color: var(--geo-text-disabled, #9ca3af);
  margin-top: var(--geo-space-xs, 4px);
}
</style>
