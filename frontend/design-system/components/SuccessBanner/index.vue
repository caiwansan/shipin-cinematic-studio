<template>
  <div :class="['ds-success-banner', classOverride]" :style="styleOverride" :data-testid="dataTestId" role="status" aria-live="polite">
    <div class="ds-success-banner__icon">
      <span class="ds-success-banner__icon-mark">✓</span>
    </div>
    <div class="ds-success-banner__content">
      <p v-if="title" class="ds-success-banner__title">{{ title }}</p>
      <p v-if="description" class="ds-success-banner__description">{{ description }}</p>
      <div v-if="$slots.default" class="ds-success-banner__actions">
        <slot />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
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
.ds-success-banner {
  display: flex;
  gap: var(--space-3, 12px);
  padding: var(--space-4, 16px);
  border-radius: var(--radius-md, 8px);
  background-color: #f0fdf4;
  border: 1px solid #bbf7d0;
}

.ds-success-banner__icon {
  display: flex;
  align-items: flex-start;
  flex-shrink: 0;
}

.ds-success-banner__icon-mark {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: var(--radius-full, 9999px);
  background-color: var(--color-success, #22c55e);
  color: #ffffff;
  font-size: 14px;
  font-weight: 700;
}

.ds-success-banner__content {
  flex: 1;
  min-width: 0;
}

.ds-success-banner__title {
  margin: 0 0 var(--space-1, 4px);
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-size, 16px);
  font-weight: 600;
  color: #166534;
}

.ds-success-banner__description {
  margin: 0;
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-sm-size, 14px);
  color: #15803d;
  line-height: 1.5;
}

.ds-success-banner__actions {
  margin-top: var(--space-2, 8px);
  display: flex;
  gap: var(--space-2, 8px);
}
</style>
