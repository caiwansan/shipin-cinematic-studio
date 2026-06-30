<template>
  <div :class="['ds-loading-state', classOverride]" :style="styleOverride" :data-testid="dataTestId" role="status" aria-live="polite">
    <div class="ds-loading-state__spinner" />
    <p v-if="title" class="ds-loading-state__title">{{ title }}</p>
    <div v-if="steps && steps.length > 0" class="ds-loading-state__steps">
      <div
        v-for="(step, index) in steps"
        :key="index"
        :class="['ds-loading-state__step', { 'ds-loading-state__step--active': step.active, 'ds-loading-state__step--complete': step.complete }]"
      >
        <span class="ds-loading-state__step-icon">
          <span v-if="step.complete">✓</span>
          <span v-else-if="step.active" class="ds-loading-state__step-dot" />
          <span v-else class="ds-loading-state__step-number">{{ index + 1 }}</span>
        </span>
        <span class="ds-loading-state__step-label">{{ step.label }}</span>
      </div>
    </div>
    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface StepItem {
  label: string
  active?: boolean
  complete?: boolean
}

const props = withDefaults(defineProps<{
  title?: string
  steps?: StepItem[]
  class?: string
  style?: string | Record<string, string>
  'data-testid'?: string
}>(), {
  steps: () => [],
})

const classOverride = computed(() => props.class || '')
const styleOverride = computed(() => props.style || undefined)
const dataTestId = computed(() => props['data-testid'] || undefined)
</script>

<style scoped>
.ds-loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--space-8, 64px) var(--space-4, 16px);
  text-align: center;
}

.ds-loading-state__spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--color-border, #e5e7eb);
  border-top-color: var(--color-info, #3b82f6);
  border-radius: var(--radius-full, 9999px);
  animation: ds-loading-spin 0.8s linear infinite;
  margin-bottom: var(--space-4, 16px);
}

@keyframes ds-loading-spin {
  to { transform: rotate(360deg); }
}

.ds-loading-state__title {
  margin: 0 0 var(--space-4, 16px);
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-heading-3-size, 20px);
  font-weight: var(--text-heading-3-weight, 500);
  color: var(--color-text-primary, #111111);
}

.ds-loading-state__steps {
  display: flex;
  flex-direction: column;
  gap: var(--space-3, 12px);
  width: 100%;
  max-width: 320px;
}

.ds-loading-state__step {
  display: flex;
  align-items: center;
  gap: var(--space-3, 12px);
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-sm-size, 14px);
  color: var(--color-text-tertiary, #9ca3af);
}

.ds-loading-state__step--active {
  color: var(--color-text-primary, #111111);
  font-weight: 500;
}

.ds-loading-state__step--complete {
  color: var(--color-success, #22c55e);
}

.ds-loading-state__step-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  flex-shrink: 0;
}

.ds-loading-state__step-dot {
  width: 8px;
  height: 8px;
  background-color: var(--color-info, #3b82f6);
  border-radius: var(--radius-full, 9999px);
  animation: ds-loading-pulse 1.2s ease-in-out infinite;
}

@keyframes ds-loading-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.ds-loading-state__step-number {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-full, 9999px);
  background-color: var(--color-surface-dim, #f9fafb);
  font-size: var(--text-caption-size, 12px);
  font-weight: 500;
}
</style>
