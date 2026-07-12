<template>
  <section
    :class="[
      'geo-card',
      `geo-card--${variant}`,
      { 'geo-card--no-padding': !padding },
      className,
    ]"
    :data-testid="dataTestId"
  >
    <div v-if="$slots.header || title" class="geo-card__header">
      <slot name="header">
        <h3 v-if="title" class="geo-card__title">{{ title }}</h3>
      </slot>
      <slot name="header-actions" />
    </div>
    <div v-if="$slots.default" class="geo-card__body">
      <slot />
    </div>
    <div v-if="$slots.footer" class="geo-card__footer">
      <slot name="footer" />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'

type CardVariant = 'default' | 'outlined' | 'elevated' | 'flat'

const props = withDefaults(defineProps<{
  /** Card visual variant */
  variant?: CardVariant
  /** Card title */
  title?: string
  /** Enable/disable body padding */
  padding?: boolean
  /** Additional class names */
  class?: string
  /** Data test id */
  'data-testid'?: string
}>(), {
  variant: 'default',
  padding: true,
})

const className = computed(() => props.class || '')
const dataTestId = computed(() => props['data-testid'] || undefined)
</script>

<style scoped>
.geo-card {
  display: flex;
  flex-direction: column;
  border-radius: var(--geo-radius-lg, 8px);
  background-color: var(--geo-bg, #ffffff);
  transition: all 150ms ease;
}

.geo-card--default {
  border: 1px solid var(--geo-border, #e5e7eb);
}

.geo-card--outlined {
  border: 1px solid var(--geo-border, #e5e7eb);
  box-shadow: none;
}

.geo-card--elevated {
  border: 1px solid var(--geo-border-light, #f3f4f6);
  box-shadow: var(--geo-shadow, 0 1px 3px rgba(0,0,0,0.08));
}

.geo-card--elevated:hover {
  box-shadow: 0 4px 6px rgba(0,0,0,0.07);
}

.geo-card--flat {
  border: none;
  box-shadow: none;
  background: transparent;
}

.geo-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--geo-space-lg, 16px) var(--geo-space-lg, 16px) 0;
}

.geo-card__title {
  margin: 0;
  font-size: var(--geo-font-size-lg, 14px);
  font-weight: 600;
  color: var(--geo-text, #111827);
}

.geo-card__body {
  padding: var(--geo-space-lg, 16px);
}

.geo-card--no-padding .geo-card__body {
  padding: 0;
}

.geo-card__footer {
  padding: 0 var(--geo-space-lg, 16px) var(--geo-space-lg, 16px);
  border-top: 1px solid var(--geo-border, #e5e7eb);
  margin-top: auto;
  padding-top: var(--geo-space-md, 12px);
}
</style>
