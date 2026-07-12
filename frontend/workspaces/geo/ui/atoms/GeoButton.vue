<template>
  <button
    :class="[
      'geo-button',
      `geo-button--${variant}`,
      `geo-button--${size}`,
      {
        'geo-button--loading': loading,
        'geo-button--disabled': disabled,
        'geo-button--full-width': fullWidth,
      },
      className,
    ]"
    :disabled="disabled || loading"
    :data-testid="dataTestId"
    v-bind="$attrs"
  >
    <span v-if="loading" class="geo-button__loader" aria-hidden="true">
      <span class="geo-button__spinner" />
    </span>
    <span v-else-if="icon && !$slots.default" class="geo-button__icon">
      <slot name="icon">
        <span v-html="icon" />
      </slot>
    </span>
    <span v-if="$slots.default || label" class="geo-button__label">
      <slot>{{ label }}</slot>
    </span>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'
type ButtonSize = 'sm' | 'md' | 'lg'

const props = withDefaults(defineProps<{
  /** Button visual variant */
  variant?: ButtonVariant
  /** Button size */
  size?: ButtonSize
  /** Button text label (used when no slot content) */
  label?: string
  /** Icon HTML string (emoji or SVG) */
  icon?: string
  /** Show loading spinner */
  loading?: boolean
  /** Disabled state */
  disabled?: boolean
  /** Full width button */
  fullWidth?: boolean
  /** Additional class names */
  class?: string
  /** Data test id */
  'data-testid'?: string
}>(), {
  variant: 'primary',
  size: 'md',
  loading: false,
  disabled: false,
  fullWidth: false,
})

const className = computed(() => props.class || '')
const dataTestId = computed(() => props['data-testid'] || undefined)
</script>

<style scoped>
.geo-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--geo-space-sm, 8px);
  border: 1px solid transparent;
  border-radius: var(--geo-radius-md, 6px);
  font-family: var(--geo-font, inherit);
  font-weight: 500;
  cursor: pointer;
  transition: all 150ms ease;
  white-space: nowrap;
  user-select: none;
  outline: none;
  text-decoration: none;
  line-height: 1;
}

.geo-button:focus-visible {
  outline: 2px solid var(--geo-info, #3b82f6);
  outline-offset: 2px;
}

.geo-button--disabled,
.geo-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}

.geo-button--full-width {
  width: 100%;
}

/* Sizes */
.geo-button--sm {
  padding: var(--geo-space-xs, 4px) var(--geo-space-md, 12px);
  font-size: var(--geo-font-size-sm, 12px);
  height: 32px;
}

.geo-button--md {
  padding: var(--geo-space-sm, 8px) var(--geo-space-lg, 16px);
  font-size: var(--geo-font-size-base, 13px);
  height: 40px;
}

.geo-button--lg {
  padding: var(--geo-space-md, 12px) var(--geo-space-xl, 20px);
  font-size: var(--geo-font-size-lg, 14px);
  height: 48px;
}

/* Variants */
.geo-button--primary {
  background-color: var(--geo-primary, #3b82f6);
  color: #ffffff;
  border-color: var(--geo-primary, #3b82f6);
}

.geo-button--primary:hover:not(:disabled) {
  background-color: var(--geo-primary-dark, #2563eb);
  border-color: var(--geo-primary-dark, #2563eb);
}

.geo-button--primary:active:not(:disabled) {
  background-color: #1d4ed8;
  border-color: #1d4ed8;
}

.geo-button--secondary {
  background-color: transparent;
  color: var(--geo-text, #111827);
  border-color: var(--geo-border, #e5e7eb);
}

.geo-button--secondary:hover:not(:disabled) {
  background-color: var(--geo-bg-secondary, #f9fafb);
  border-color: var(--geo-text-tertiary, #6b7280);
}

.geo-button--secondary:active:not(:disabled) {
  background-color: var(--geo-bg-tertiary, #f3f4f6);
}

.geo-button--ghost {
  background-color: transparent;
  color: var(--geo-text, #111827);
  border-color: transparent;
}

.geo-button--ghost:hover:not(:disabled) {
  background-color: var(--geo-bg-secondary, #f9fafb);
}

.geo-button--ghost:active:not(:disabled) {
  background-color: var(--geo-bg-tertiary, #f3f4f6);
}

.geo-button--danger {
  background-color: var(--geo-error, #dc2626);
  color: #ffffff;
  border-color: var(--geo-error, #dc2626);
}

.geo-button--danger:hover:not(:disabled) {
  background-color: #b91c1c;
  border-color: #b91c1c;
}

.geo-button--danger:active:not(:disabled) {
  background-color: #991b1b;
  border-color: #991b1b;
}

.geo-button--success {
  background-color: var(--geo-success, #059669);
  color: #ffffff;
  border-color: var(--geo-success, #059669);
}

.geo-button--success:hover:not(:disabled) {
  background-color: #047857;
  border-color: #047857;
}

.geo-button--success:active:not(:disabled) {
  background-color: #065f46;
  border-color: #065f46;
}

/* Loading */
.geo-button--loading {
  position: relative;
}

.geo-button__loader {
  display: inline-flex;
  align-items: center;
}

.geo-button__spinner {
  width: 16px;
  height: 16px;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 9999px;
  animation: geo-button-spin 400ms linear infinite;
}

@keyframes geo-button-spin {
  to { transform: rotate(360deg); }
}
</style>
