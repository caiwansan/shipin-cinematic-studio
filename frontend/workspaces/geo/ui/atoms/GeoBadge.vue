<template>
  <span
    :class="[
      'geo-badge',
      `geo-badge--${variant}`,
      `geo-badge--${size}`,
      className,
    ]"
    :data-testid="dataTestId"
  >
    <span v-if="dot" class="geo-badge__dot" />
    <slot>{{ label }}</slot>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'purple'
type BadgeSize = 'sm' | 'md'

const props = withDefaults(defineProps<{
  /** Badge visual variant */
  variant?: BadgeVariant
  /** Badge size */
  size?: BadgeSize
  /** Badge text label */
  label?: string
  /** Show a small dot indicator */
  dot?: boolean
  /** Additional class names */
  class?: string
  /** Data test id */
  'data-testid'?: string
}>(), {
  variant: 'default',
  size: 'sm',
  dot: false,
})

const className = computed(() => props.class || '')
const dataTestId = computed(() => props['data-testid'] || undefined)
</script>

<style scoped>
.geo-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--geo-space-xs, 4px);
  border-radius: 9999px;
  font-family: var(--geo-font, inherit);
  font-weight: 500;
  white-space: nowrap;
  line-height: 1;
}

.geo-badge--sm {
  padding: 2px var(--geo-space-sm, 8px);
  font-size: var(--geo-font-size-xs, 11px);
}

.geo-badge--md {
  padding: var(--geo-space-xs, 4px) var(--geo-space-md, 12px);
  font-size: var(--geo-font-size-sm, 12px);
}

.geo-badge__dot {
  width: 6px;
  height: 6px;
  border-radius: 9999px;
  background-color: currentColor;
}

/* Variants */
.geo-badge--default {
  background-color: var(--geo-bg-secondary, #f9fafb);
  color: var(--geo-text-tertiary, #6b7280);
  border: 1px solid var(--geo-border, #e5e7eb);
}

.geo-badge--success {
  background-color: var(--geo-success-bg, #f0fdf4);
  color: var(--geo-success, #059669);
  border: 1px solid transparent;
}

.geo-badge--warning {
  background-color: var(--geo-warning-bg, #fffbeb);
  color: var(--geo-warning, #d97706);
  border: 1px solid transparent;
}

.geo-badge--error {
  background-color: var(--geo-error-bg, #fef2f2);
  color: var(--geo-error, #dc2626);
  border: 1px solid transparent;
}

.geo-badge--info {
  background-color: var(--geo-info-bg, #eff6ff);
  color: var(--geo-info, #3b82f6);
  border: 1px solid transparent;
}

.geo-badge--neutral {
  background-color: var(--geo-bg-secondary, #f9fafb);
  color: var(--geo-text-tertiary, #6b7280);
  border: 1px solid var(--geo-border, #e5e7eb);
}

.geo-badge--purple {
  background-color: #f5f3ff;
  color: #7c3aed;
  border: 1px solid transparent;
}
</style>
