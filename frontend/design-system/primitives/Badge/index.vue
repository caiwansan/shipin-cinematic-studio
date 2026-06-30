<template>
  <span
    :class="['ds-badge', `ds-badge--${variant}`, `ds-badge--${size}`, classOverride]"
    :style="styleOverride"
    :data-testid="dataTestId"
  >
    <span v-if="dot" class="ds-badge__dot" />
    <slot>{{ label }}</slot>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info'
type BadgeSize = 'sm' | 'md'

const props = withDefaults(defineProps<{
  variant?: BadgeVariant
  size?: BadgeSize
  label?: string
  dot?: boolean
  class?: string
  style?: string | Record<string, string>
  'data-testid'?: string
}>(), {
  variant: 'default',
  size: 'md',
  dot: false,
})

const classOverride = computed(() => props.class || '')
const styleOverride = computed(() => props.style || undefined)
const dataTestId = computed(() => props['data-testid'] || undefined)
</script>

<style scoped>
.ds-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1, 4px);
  border-radius: var(--radius-full, 9999px);
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-weight: 500;
  white-space: nowrap;
  line-height: 1;
}

.ds-badge--sm {
  padding: 2px var(--space-2, 8px);
  font-size: var(--text-caption-size, 12px);
}

.ds-badge--md {
  padding: var(--space-1, 4px) var(--space-3, 12px);
  font-size: var(--text-body-sm-size, 14px);
}

.ds-badge__dot {
  width: 6px;
  height: 6px;
  border-radius: var(--radius-full, 9999px);
  background-color: currentColor;
}

/* Variants */
.ds-badge--default {
  background-color: var(--color-surface-dim, #f9fafb);
  color: var(--color-text-secondary, #6b7280);
  border: 1px solid var(--color-border, #e5e7eb);
}

.ds-badge--success {
  background-color: #f0fdf4;
  color: var(--color-success, #22c55e);
}

.ds-badge--warning {
  background-color: #fefce8;
  color: var(--color-warning, #eab308);
}

.ds-badge--error {
  background-color: #fef2f2;
  color: var(--color-error, #ef4444);
}

.ds-badge--info {
  background-color: #eff6ff;
  color: var(--color-info, #3b82f6);
}
</style>
