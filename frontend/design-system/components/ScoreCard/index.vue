<template>
  <div :class="['ds-score-card', classOverride]" :style="styleOverride" :data-testid="dataTestId">
    <div class="ds-score-card__score" :style="{ color: scoreColor }">
      {{ displayScore }}
    </div>
    <div v-if="label" class="ds-score-card__label">{{ label }}</div>
    <div v-if="trend !== undefined" class="ds-score-card__trend" :class="`ds-score-card__trend--${trendDir}`">
      <span class="ds-score-card__trend-icon">{{ trendIcon }}</span>
      <span v-if="trendValue !== undefined" class="ds-score-card__trend-value">{{ trendPrefix }}{{ trendValue }}</span>
    </div>
    <div v-if="$slots.default" class="ds-score-card__extra">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  score?: number
  maxScore?: number
  label?: string
  trend?: 'up' | 'down' | 'stable'
  trendValue?: number
  showDecimal?: boolean
  class?: string
  style?: string | Record<string, string>
  'data-testid'?: string
}>(), {
  score: 0,
  maxScore: 100,
  showDecimal: false,
})

const classOverride = computed(() => props.class || '')
const styleOverride = computed(() => props.style || undefined)
const dataTestId = computed(() => props['data-testid'] || undefined)

const displayScore = computed(() => {
  if (props.showDecimal) return props.score.toFixed(1)
  return Math.round(props.score).toString()
})

const scoreColor = computed(() => {
  const ratio = props.score / props.maxScore
  if (ratio >= 0.8) return 'var(--color-health, #22c55e)'
  if (ratio >= 0.6) return 'var(--color-warning, #eab308)'
  return 'var(--color-risk, #ef4444)'
})

const trendDir = computed(() => props.trend || 'stable')
const trendIcon = computed(() => {
  switch (props.trend) {
    case 'up': return '↑'
    case 'down': return '↓'
    default: return '→'
  }
})
const trendPrefix = computed(() => props.trend === 'up' ? '+' : '')
</script>

<style scoped>
.ds-score-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--space-4, 16px);
  background-color: var(--color-surface, #ffffff);
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: var(--radius-md, 8px);
  text-align: center;
  transition: all var(--motion-normal-duration, 200ms) var(--motion-normal-easing, ease-out);
}

.ds-score-card__score {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-metric-size, 96px);
  font-weight: var(--text-metric-weight, 700);
  line-height: var(--text-metric-line, 1.0);
  transition: color var(--motion-slow-duration, 400ms) var(--motion-slow-easing, ease-in-out);
}

.ds-score-card__label {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-size, 16px);
  color: var(--color-text-secondary, #6b7280);
  margin-top: var(--space-1, 4px);
}

.ds-score-card__trend {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1, 4px);
  margin-top: var(--space-2, 8px);
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-sm-size, 14px);
  font-weight: 500;
}

.ds-score-card__trend--up {
  color: var(--color-success, #22c55e);
}

.ds-score-card__trend--down {
  color: var(--color-error, #ef4444);
}

.ds-score-card__trend--stable {
  color: var(--color-text-tertiary, #9ca3af);
}

.ds-score-card__extra {
  margin-top: var(--space-3, 12px);
  width: 100%;
}
</style>
