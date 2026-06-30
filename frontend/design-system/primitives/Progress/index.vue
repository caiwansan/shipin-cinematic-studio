<template>
  <div
    :class="['ds-progress', classOverride]"
    :style="styleOverride"
    :data-testid="dataTestId"
    role="progressbar"
    :aria-valuenow="value"
    :aria-valuemin="0"
    :aria-valuemax="max"
    :aria-label="label || undefined"
  >
    <div v-if="label || showValue" class="ds-progress__header">
      <span v-if="label" class="ds-progress__label">{{ label }}</span>
      <span v-if="showValue" class="ds-progress__value">{{ displayValue }}</span>
    </div>
    <div :class="['ds-progress__track', `ds-progress__track--${size}`]">
      <div
        :class="['ds-progress__bar', `ds-progress__bar--${variant}`]"
        :style="{ width: `${percentage}%` }"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

type ProgressVariant = 'default' | 'success' | 'warning' | 'error'
type ProgressSize = 'sm' | 'md'

const props = withDefaults(defineProps<{
  value?: number
  max?: number
  label?: string
  showValue?: boolean
  variant?: ProgressVariant
  size?: ProgressSize
  class?: string
  style?: string | Record<string, string>
  'data-testid'?: string
}>(), {
  value: 0,
  max: 100,
  showValue: false,
  variant: 'default',
  size: 'md',
})

const classOverride = computed(() => props.class || '')
const styleOverride = computed(() => props.style || undefined)
const dataTestId = computed(() => props['data-testid'] || undefined)

const percentage = computed(() => {
  if (props.max <= 0) return 0
  return Math.min(Math.max((props.value / props.max) * 100, 0), 100)
})

const displayValue = computed(() => {
  return `${Math.round(props.value)}/${props.max}`
})
</script>

<style scoped>
.ds-progress {
  display: flex;
  flex-direction: column;
  gap: var(--space-1, 4px);
  width: 100%;
}

.ds-progress__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.ds-progress__label {
  font-size: var(--text-body-sm-size, 14px);
  color: var(--color-text-secondary, #6b7280);
}

.ds-progress__value {
  font-size: var(--text-caption-size, 12px);
  color: var(--color-text-tertiary, #9ca3af);
  font-weight: 500;
}

.ds-progress__track {
  width: 100%;
  background-color: var(--color-surface-dim, #f9fafb);
  border-radius: var(--radius-full, 9999px);
  overflow: hidden;
}

.ds-progress__track--sm {
  height: 4px;
}

.ds-progress__track--md {
  height: 8px;
}

.ds-progress__bar {
  height: 100%;
  border-radius: var(--radius-full, 9999px);
  transition: width var(--motion-slow-duration, 400ms) var(--motion-slow-easing, ease-in-out);
}

.ds-progress__bar--default {
  background-color: var(--color-info, #3b82f6);
}

.ds-progress__bar--success {
  background-color: var(--color-success, #22c55e);
}

.ds-progress__bar--warning {
  background-color: var(--color-warning, #eab308);
}

.ds-progress__bar--error {
  background-color: var(--color-error, #ef4444);
}
</style>
