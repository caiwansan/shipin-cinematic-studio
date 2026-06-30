<template>
  <div :class="['verification-summary', classOverride]" :style="styleOverride" :data-testid="dataTestId">
    <h3 v-if="title" class="verification-summary__title">{{ title }}</h3>
    <div class="verification-summary__display">
      <span class="verification-summary__before" :style="{ color: beforeColor }">{{ beforeScore }}</span>
      <span class="verification-summary__arrow">
        <svg width="40" height="20" viewBox="0 0 40 20" fill="none">
          <path d="M2 10H36M36 10L28 2M36 10L28 18" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </span>
      <span class="verification-summary__after" :style="{ color: afterColor }">{{ afterScore }}</span>
    </div>
    <div v-if="delta !== 0" class="verification-summary__delta" :class="{ 'verification-summary__delta--positive': delta > 0, 'verification-summary__delta--negative': delta < 0 }">
      <span>{{ delta > 0 ? '+' : '' }}{{ delta }} this improvement</span>
    </div>
    <div v-else class="verification-summary__delta verification-summary__delta--none">
      <span>No change detected</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  beforeScore: number
  afterScore: number
  title?: string
  class?: string
  style?: string | Record<string, string>
  'data-testid'?: string
}>(), {
  title: 'Brand Health',
  beforeScore: 0,
  afterScore: 0,
})

const classOverride = computed(() => props.class || '')
const styleOverride = computed(() => props.style || undefined)
const dataTestId = computed(() => props['data-testid'] || undefined)

const delta = computed(() => props.afterScore - props.beforeScore)

function scoreColor(s: number): string {
  if (s >= 80) return 'var(--color-health, #22c55e)'
  if (s >= 60) return 'var(--color-warning, #eab308)'
  return 'var(--color-risk, #ef4444)'
}

const beforeColor = computed(() => scoreColor(props.beforeScore))
const afterColor = computed(() => scoreColor(props.afterScore))
</script>

<style scoped>
.verification-summary {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3, 12px);
  padding: var(--space-6, 32px);
  background: linear-gradient(135deg, var(--color-surface-dim, #f9fafb) 0%, var(--color-surface, #ffffff) 100%);
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: var(--radius-lg, 12px);
  text-align: center;
}

.verification-summary__title {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-heading-3-size, 20px);
  font-weight: var(--text-heading-3-weight, 500);
  color: var(--color-text-primary, #111111);
  margin: 0;
}

.verification-summary__display {
  display: flex;
  align-items: center;
  gap: var(--space-4, 16px);
}

.verification-summary__before,
.verification-summary__after {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-metric-size, 96px);
  font-weight: var(--text-metric-weight, 700);
  line-height: 1;
  transition: color var(--motion-slow-duration, 400ms) ease-in-out;
}

.verification-summary__arrow {
  color: var(--color-text-tertiary, #9ca3af);
  display: flex;
  align-items: center;
}

.verification-summary__delta {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-size, 16px);
  font-weight: 500;
}

.verification-summary__delta--positive {
  color: var(--color-success, #22c55e);
}

.verification-summary__delta--negative {
  color: var(--color-error, #ef4444);
}

.verification-summary__delta--none {
  color: var(--color-text-tertiary, #9ca3af);
}
</style>
