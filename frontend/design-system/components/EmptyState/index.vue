<template>
  <div :class="['ds-empty-state', classOverride]" :style="styleOverride" :data-testid="dataTestId">
    <div v-if="$slots.icon || icon" class="ds-empty-state__icon">
      <slot name="icon">
        <span v-html="icon" />
      </slot>
    </div>
    <h3 v-if="title" class="ds-empty-state__title">{{ title }}</h3>
    <p v-if="description" class="ds-empty-state__description">{{ description }}</p>
    <div v-if="$slots.cta || $slots.default" class="ds-empty-state__cta">
      <slot name="cta">
        <slot />
      </slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  icon?: string
  title?: string
  description?: string
  class?: string
  style?: string | Record<string, string>
  'data-testid'?: string
}>(), {})

const classOverride = computed(() => props.class || '')
const styleOverride = computed(() => props.style || undefined)
const dataTestId = computed(() => props['data-testid'] || undefined)
</script>

<style scoped>
.ds-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-8, 64px) var(--space-4, 16px);
  text-align: center;
}

.ds-empty-state__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  margin-bottom: var(--space-4, 16px);
  border-radius: var(--radius-full, 9999px);
  background-color: var(--color-surface-dim, #f9fafb);
  color: var(--color-text-tertiary, #9ca3af);
  font-size: 28px;
}

.ds-empty-state__title {
  margin: 0 0 var(--space-2, 8px);
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-heading-3-size, 20px);
  font-weight: var(--text-heading-3-weight, 500);
  color: var(--color-text-primary, #111111);
}

.ds-empty-state__description {
  margin: 0 0 var(--space-4, 16px);
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-size, 16px);
  color: var(--color-text-secondary, #6b7280);
  max-width: 360px;
  line-height: 1.5;
}

.ds-empty-state__cta {
  display: flex;
  gap: var(--space-2, 8px);
}
</style>
