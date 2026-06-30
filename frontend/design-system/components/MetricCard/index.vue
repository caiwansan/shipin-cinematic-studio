<template>
  <div :class="['ds-metric-card', classOverride]" :style="styleOverride" :data-testid="dataTestId">
    <div v-if="$slots.icon || icon" class="ds-metric-card__icon">
      <slot name="icon">
        <span v-html="icon" />
      </slot>
    </div>
    <div class="ds-metric-card__body">
      <div v-if="label" class="ds-metric-card__label">{{ label }}</div>
      <div class="ds-metric-card__value">{{ displayValue }}</div>
      <div v-if="comparison" class="ds-metric-card__comparison" :class="`ds-metric-card__comparison--${comparisonDir}`">
        <span class="ds-metric-card__comparison-icon">{{ comparisonIcon }}</span>
        <span>{{ comparisonText }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  value?: string | number
  label?: string
  icon?: string
  prefix?: string
  suffix?: string
  comparison?: 'increase' | 'decrease' | 'same'
  comparisonText?: string
  comparisonValue?: number
  class?: string
  style?: string | Record<string, string>
  'data-testid'?: string
}>(), {
  value: '',
})

const classOverride = computed(() => props.class || '')
const styleOverride = computed(() => props.style || undefined)
const dataTestId = computed(() => props['data-testid'] || undefined)

const displayValue = computed(() => {
  const val = String(props.value)
  return `${props.prefix || ''}${val}${props.suffix || ''}`
})

const comparisonDir = computed(() => props.comparison || 'same')
const comparisonIcon = computed(() => {
  switch (props.comparison) {
    case 'increase': return '↑'
    case 'decrease': return '↓'
    default: return '→'
  }
})
</script>

<style scoped>
.ds-metric-card {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3, 12px);
  padding: var(--space-4, 16px);
  background-color: var(--color-surface, #ffffff);
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: var(--radius-md, 8px);
  transition: all var(--motion-normal-duration, 200ms) var(--motion-normal-easing, ease-out);
}

.ds-metric-card__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-md, 8px);
  background-color: var(--color-surface-dim, #f9fafb);
  color: var(--color-text-secondary, #6b7280);
  flex-shrink: 0;
}

.ds-metric-card__body {
  flex: 1;
  min-width: 0;
}

.ds-metric-card__label {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-sm-size, 14px);
  color: var(--color-text-secondary, #6b7280);
  margin-bottom: var(--space-1, 4px);
}

.ds-metric-card__value {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-metric-sm-size, 32px);
  font-weight: var(--text-metric-sm-weight, 700);
  line-height: var(--text-metric-sm-line, 1.0);
  color: var(--color-text-primary, #111111);
}

.ds-metric-card__comparison {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1, 4px);
  margin-top: var(--space-1, 4px);
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-sm-size, 14px);
  font-weight: 500;
}

.ds-metric-card__comparison--increase {
  color: var(--color-success, #22c55e);
}

.ds-metric-card__comparison--decrease {
  color: var(--color-error, #ef4444);
}

.ds-metric-card__comparison--same {
  color: var(--color-text-tertiary, #9ca3af);
}
</style>
