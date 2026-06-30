<template>
  <button
    :class="[
      'ds-button',
      `ds-button--${variant}`,
      `ds-button--${size}`,
      {
        'ds-button--loading': loading,
        'ds-button--disabled': disabled,
        'ds-button--full-width': fullWidth,
      },
      classOverride
    ]"
    :style="styleOverride"
    :disabled="disabled || loading"
    :data-testid="dataTestId"
    v-bind="$attrs"
  >
    <span v-if="loading" class="ds-button__loader" aria-hidden="true">
      <span class="ds-button__spinner" />
    </span>
    <span v-else-if="icon && !$slots.default" class="ds-button__icon">
      <slot name="icon">
        <span v-html="icon" />
      </slot>
    </span>
    <span v-if="$slots.default || label" class="ds-button__label">
      <slot>{{ label }}</slot>
    </span>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

const props = withDefaults(defineProps<{
  variant?: ButtonVariant
  size?: ButtonSize
  label?: string
  icon?: string
  loading?: boolean
  disabled?: boolean
  fullWidth?: boolean
  class?: string
  style?: string | Record<string, string>
  'data-testid'?: string
}>(), {
  variant: 'primary',
  size: 'md',
  loading: false,
  disabled: false,
  fullWidth: false,
})

const classOverride = computed(() => props.class || '')
const styleOverride = computed(() => props.style || undefined)
const dataTestId = computed(() => props['data-testid'] || undefined)
</script>

<style scoped>
.ds-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2, 8px);
  border: 1px solid transparent;
  border-radius: var(--radius-sm, 4px);
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-weight: 500;
  cursor: pointer;
  transition: all var(--motion-fast-duration, 100ms) var(--motion-fast-easing, ease-out);
  white-space: nowrap;
  user-select: none;
  outline: none;
  text-decoration: none;
  line-height: 1;
}

.ds-button:focus-visible {
  outline: 2px solid var(--color-info, #3b82f6);
  outline-offset: 2px;
}

.ds-button--disabled,
.ds-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}

.ds-button--full-width {
  width: 100%;
}

/* Sizes */
.ds-button--sm {
  padding: var(--space-1, 4px) var(--space-3, 12px);
  font-size: var(--text-body-sm-size, 14px);
  height: 32px;
}

.ds-button--md {
  padding: var(--space-2, 8px) var(--space-4, 16px);
  font-size: var(--text-body-size, 16px);
  height: 40px;
}

.ds-button--lg {
  padding: var(--space-3, 12px) var(--space-5, 24px);
  font-size: var(--text-body-size, 16px);
  height: 48px;
}

/* Primary */
.ds-button--primary {
  background-color: var(--color-info, #3b82f6);
  color: #ffffff;
  border-color: var(--color-info, #3b82f6);
}

.ds-button--primary:hover:not(:disabled) {
  background-color: #2563eb;
  border-color: #2563eb;
}

.ds-button--primary:active:not(:disabled) {
  background-color: #1d4ed8;
  border-color: #1d4ed8;
}

/* Secondary */
.ds-button--secondary {
  background-color: transparent;
  color: var(--color-text-primary, #111111);
  border-color: var(--color-border, #e5e7eb);
}

.ds-button--secondary:hover:not(:disabled) {
  background-color: var(--color-surface-dim, #f9fafb);
  border-color: var(--color-text-tertiary, #9ca3af);
}

.ds-button--secondary:active:not(:disabled) {
  background-color: var(--color-border, #e5e7eb);
}

/* Ghost */
.ds-button--ghost {
  background-color: transparent;
  color: var(--color-text-primary, #111111);
  border-color: transparent;
}

.ds-button--ghost:hover:not(:disabled) {
  background-color: var(--color-surface-dim, #f9fafb);
}

.ds-button--ghost:active:not(:disabled) {
  background-color: var(--color-border, #e5e7eb);
}

/* Danger */
.ds-button--danger {
  background-color: var(--color-error, #ef4444);
  color: #ffffff;
  border-color: var(--color-error, #ef4444);
}

.ds-button--danger:hover:not(:disabled) {
  background-color: #dc2626;
  border-color: #dc2626;
}

.ds-button--danger:active:not(:disabled) {
  background-color: #b91c1c;
  border-color: #b91c1c;
}

/* Loading */
.ds-button--loading {
  position: relative;
}

.ds-button__loader {
  display: inline-flex;
  align-items: center;
}

.ds-button__spinner {
  width: 16px;
  height: 16px;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: var(--radius-full, 9999px);
  animation: ds-spin var(--motion-slow-duration, 400ms) linear infinite;
}

@keyframes ds-spin {
  to { transform: rotate(360deg); }
}
</style>
