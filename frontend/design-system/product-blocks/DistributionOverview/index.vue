<template>
  <div :class="['distribution-overview', classOverride]" :style="styleOverride" :data-testid="dataTestId">
    <h3 v-if="title" class="distribution-overview__title">{{ title }}</h3>
    <div class="distribution-overview__display">
      <div class="distribution-overview__count">
        <span class="distribution-overview__count-num">{{ activeCount }}</span>
        <span class="distribution-overview__count-total">/{{ totalCount }}</span>
      </div>
      <div class="distribution-overview__bar">
        <div class="distribution-overview__bar-fill" :style="{ width: barPercent + '%' }" />
      </div>
      <p class="distribution-overview__label">
        {{ labelText }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  activeCount?: number
  totalCount?: number
  title?: string
  class?: string
  style?: string | Record<string, string>
  'data-testid'?: string
}>(), {
  activeCount: 0,
  totalCount: 5,
  title: 'Distribution Coverage',
})

const classOverride = computed(() => props.class || '')
const styleOverride = computed(() => props.style || undefined)
const dataTestId = computed(() => props['data-testid'] || undefined)

const barPercent = computed(() => {
  if (props.totalCount === 0) return 0
  return Math.min(100, (props.activeCount / props.totalCount) * 100)
})

const labelText = computed(() => {
  return `Distribution Coverage: ${props.activeCount} of ${props.totalCount} channels active`
})
</script>

<style scoped>
.distribution-overview {
  display: flex;
  flex-direction: column;
  gap: var(--space-4, 16px);
}

.distribution-overview__title {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-heading-3-size, 20px);
  font-weight: var(--text-heading-3-weight, 500);
  color: var(--color-text-primary, #111111);
  margin: 0;
}

.distribution-overview__display {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3, 12px);
  padding: var(--space-5, 24px);
  background: linear-gradient(135deg, var(--color-surface-dim, #f9fafb) 0%, var(--color-surface, #ffffff) 100%);
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: var(--radius-lg, 12px);
}

.distribution-overview__count {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-metric-sm-size, 32px);
  font-weight: var(--text-metric-sm-weight, 700);
  line-height: 1;
}

.distribution-overview__count-num {
  color: var(--color-text-primary, #111111);
}

.distribution-overview__count-total {
  color: var(--color-text-tertiary, #9ca3af);
}

.distribution-overview__bar {
  width: 100%;
  max-width: 300px;
  height: 10px;
  border-radius: var(--radius-full, 9999px);
  background-color: var(--color-surface-dim, #f9fafb);
  overflow: hidden;
}

.distribution-overview__bar-fill {
  height: 100%;
  border-radius: var(--radius-full, 9999px);
  background: linear-gradient(90deg, var(--color-info, #3b82f6) 0%, var(--color-health, #22c55e) 100%);
  transition: width var(--motion-slow-duration, 400ms) ease-in-out;
}

.distribution-overview__label {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-sm-size, 14px);
  color: var(--color-text-secondary, #6b7280);
  margin: 0;
}
</style>
