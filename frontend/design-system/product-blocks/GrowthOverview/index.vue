<template>
  <div :class="['growth-overview', classOverride]" :style="styleOverride" :data-testid="dataTestId">
    <h3 v-if="title" class="growth-overview__title">{{ title }}</h3>
    <div class="growth-overview__display">
      <div class="growth-overview__scores">
        <span class="growth-overview__score-before" :style="{ color: beforeColor }">{{ beforeScore }}</span>
        <span class="growth-overview__arrow">
          <svg width="40" height="20" viewBox="0 0 40 20" fill="none">
            <path d="M2 10H36M36 10L28 2M36 10L28 18" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </span>
        <span class="growth-overview__score-after" :style="{ color: afterColor }">{{ afterScore }}</span>
      </div>
      <div class="growth-overview__delta" :class="{ 'growth-overview__delta--positive': delta > 0, 'growth-overview__delta--negative': delta < 0, 'growth-overview__delta--neutral': delta === 0 }">
        {{ deltaPrefix }}{{ delta }} {{ period }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  beforeScore: number
  afterScore: number
  period?: string
  title?: string
  class?: string
  style?: string | Record<string, string>
  'data-testid'?: string
}>(), {
  beforeScore: 0,
  afterScore: 0,
  period: 'past 30 days',
  title: 'Brand Health',
})

const classOverride = computed(() => props.class || '')
const styleOverride = computed(() => props.style || undefined)
const dataTestId = computed(() => props['data-testid'] || undefined)

const delta = computed(() => props.afterScore - props.beforeScore)
const deltaPrefix = computed(() => delta.value > 0 ? '+' : '')

function scoreColor(s: number): string {
  if (s >= 80) return 'var(--color-health, #22c55e)'
  if (s >= 60) return 'var(--color-warning, #eab308)'
  return 'var(--color-risk, #ef4444)'
}

const beforeColor = computed(() => scoreColor(props.beforeScore))
const afterColor = computed(() => scoreColor(props.afterScore))
</script>

<style scoped>
.growth-overview {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3, 12px);
}

.growth-overview__title {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-heading-2-size, 24px);
  font-weight: var(--text-heading-2-weight, 600);
  color: var(--color-text-primary, #111111);
  margin: 0;
}

.growth-overview__display {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3, 12px);
  padding: var(--space-6, 32px);
  background: linear-gradient(135deg, var(--color-surface-dim, #f9fafb) 0%, var(--color-surface, #ffffff) 100%);
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: var(--radius-lg, 12px);
  text-align: center;
  width: 100%;
}

.growth-overview__scores {
  display: flex;
  align-items: center;
  gap: var(--space-4, 16px);
}

.growth-overview__score-before,
.growth-overview__score-after {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-metric-size, 96px);
  font-weight: var(--text-metric-weight, 700);
  line-height: 1;
}

.growth-overview__arrow {
  color: var(--color-text-tertiary, #9ca3af);
  display: flex;
  align-items: center;
}

.growth-overview__delta {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-size, 16px);
  font-weight: 500;
}

.growth-overview__delta--positive { color: var(--color-success, #22c55e); }
.growth-overview__delta--negative { color: var(--color-error, #ef4444); }
.growth-overview__delta--neutral { color: var(--color-text-tertiary, #9ca3af); }
</style>
