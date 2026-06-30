<template>
  <div :class="['impact-preview', classOverride]" :style="styleOverride" :data-testid="dataTestId">
    <div class="impact-preview__label">{{ label }}</div>
    <div class="impact-preview__display">
      <span class="impact-preview__current" :style="{ color: currentColor }">{{ currentScore }}</span>
      <span class="impact-preview__arrow">
        <svg width="32" height="16" viewBox="0 0 32 16" fill="none">
          <path d="M2 8H28M28 8L22 2M28 8L22 14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </span>
      <span class="impact-preview__expected" style="color: var(--color-success, #22c55e);">{{ expectedScore }}</span>
    </div>
    <p v-if="description" class="impact-preview__description">{{ description }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  currentScore: number
  expectedScore: number
  label?: string
  description?: string
  class?: string
  style?: string | Record<string, string>
  'data-testid'?: string
}>(), {
  label: 'Brand Health Impact Preview',
  currentScore: 0,
  expectedScore: 0,
})

const classOverride = computed(() => props.class || '')
const styleOverride = computed(() => props.style || undefined)
const dataTestId = computed(() => props['data-testid'] || undefined)

const currentColor = computed(() => {
  const s = props.currentScore
  if (s >= 80) return 'var(--color-health, #22c55e)'
  if (s >= 60) return 'var(--color-warning, #eab308)'
  return 'var(--color-risk, #ef4444)'
})
</script>

<style scoped>
.impact-preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3, 12px);
  padding: var(--space-5, 24px);
  background: linear-gradient(135deg, var(--color-surface-dim, #f9fafb) 0%, var(--color-surface, #ffffff) 100%);
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: var(--radius-lg, 12px);
  text-align: center;
}

.impact-preview__label {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-sm-size, 14px);
  font-weight: 500;
  color: var(--color-text-secondary, #6b7280);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.impact-preview__display {
  display: flex;
  align-items: center;
  gap: var(--space-4, 16px);
}

.impact-preview__current,
.impact-preview__expected {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-metric-sm-size, 32px);
  font-weight: var(--text-metric-sm-weight, 700);
  line-height: 1;
}

.impact-preview__arrow {
  color: var(--color-text-tertiary, #9ca3af);
  display: flex;
  align-items: center;
}

.impact-preview__description {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-sm-size, 14px);
  color: var(--color-text-secondary, #6b7280);
  margin: 0;
  max-width: 400px;
  line-height: 1.5;
}
</style>
