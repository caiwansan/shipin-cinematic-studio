<template>
  <div
    :class="['ds-card', `ds-card--${variant}`, classOverride]"
    :style="styleOverride"
    :data-testid="dataTestId"
  >
    <div v-if="$slots.header || title" class="ds-card__header">
      <slot name="header">
        <h3 v-if="title" class="ds-card__title">{{ title }}</h3>
      </slot>
    </div>
    <div v-if="$slots.default" class="ds-card__body">
      <slot />
    </div>
    <div v-if="$slots.footer" class="ds-card__footer">
      <slot name="footer" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

type CardVariant = 'default' | 'outlined' | 'elevated'

const props = withDefaults(defineProps<{
  variant?: CardVariant
  title?: string
  padding?: boolean
  class?: string
  style?: string | Record<string, string>
  'data-testid'?: string
}>(), {
  variant: 'default',
  padding: true,
})

const classOverride = computed(() => props.class || '')
const styleOverride = computed(() => props.style || undefined)
const dataTestId = computed(() => props['data-testid'] || undefined)
</script>

<style scoped>
.ds-card {
  display: flex;
  flex-direction: column;
  border-radius: var(--radius-md, 8px);
  background-color: var(--color-surface, #ffffff);
  transition: all var(--motion-normal-duration, 200ms) var(--motion-normal-easing, ease-out);
}

.ds-card--default {
  border: 1px solid var(--color-border, #e5e7eb);
}

.ds-card--outlined {
  border: 1px solid var(--color-border, #e5e7eb);
  box-shadow: none;
}

.ds-card--elevated {
  border: none;
  box-shadow: var(--elevation-sm, 0 1px 2px rgba(0,0,0,0.05));
}

.ds-card--elevated:hover {
  box-shadow: var(--elevation-md, 0 4px 6px rgba(0,0,0,0.07));
}

.ds-card__header {
  padding: var(--space-4, 16px) var(--space-4, 16px) 0;
}

.ds-card__title {
  margin: 0;
  font-size: var(--text-heading-3-size, 20px);
  font-weight: var(--text-heading-3-weight, 500);
  color: var(--color-text-primary, #111111);
}

.ds-card__body {
  padding: var(--space-4, 16px);
}

.ds-card__footer {
  padding: 0 var(--space-4, 16px) var(--space-4, 16px);
  border-top: 1px solid var(--color-border, #e5e7eb);
  margin-top: auto;
  padding-top: var(--space-3, 12px);
}
</style>
