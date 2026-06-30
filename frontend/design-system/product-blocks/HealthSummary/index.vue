<template>
  <div :class="['health-summary', classOverride]" :style="styleOverride" :data-testid="dataTestId">
    <!-- Ring/Progress placeholder (future) -->
    <div class="health-summary__ring-placeholder" />

    <!-- Score display -->
    <div class="health-summary__score" :style="{ color: scoreColor }">
      {{ displayScore }}
    </div>

    <!-- Trend display -->
    <div class="health-summary__trend" :class="`health-summary__trend--${trendDirection}`">
      <span class="health-summary__trend-icon">{{ trendIcon }}</span>
      <span class="health-summary__trend-value">{{ trendPrefix }}{{ trend }}</span>
    </div>

    <!-- Label -->
    <p v-if="label" class="health-summary__label">{{ label }}</p>

    <!-- Definition -->
    <p v-if="definition" class="health-summary__definition">{{ definition }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  score: number
  trend: number
  label: string
  definition: string
  class?: string
  style?: string | Record<string, string>
  'data-testid'?: string
}>(), {
  score: 0,
  trend: 0,
  label: '',
  definition: '',
})

const classOverride = computed(() => props.class || '')
const styleOverride = computed(() => props.style || undefined)
const dataTestId = computed(() => props['data-testid'] || undefined)

const displayScore = computed(() => Math.round(props.score).toString())

const scoreColor = computed(() => {
  const s = props.score
  if (s >= 80) return 'var(--color-health, #22c55e)'
  if (s >= 60) return 'var(--color-warning, #eab308)'
  return 'var(--color-risk, #ef4444)'
})

const trendDirection = computed(() => {
  if (props.trend > 0) return 'up'
  if (props.trend < 0) return 'down'
  return 'stable'
})

const trendIcon = computed(() => {
  if (props.trend > 0) return '↑'
  if (props.trend < 0) return '↓'
  return '→'
})

const trendPrefix = computed(() => {
  if (props.trend > 0) return '+'
  if (props.trend < 0) return ''
  return ''
})
</script>

<style scoped>
.health-summary {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: var(--space-6, 32px) 0;
}

.health-summary__ring-placeholder {
  /* Space reserved for ring/donut chart in future sprints */
  width: 120px;
  height: 120px;
  margin-bottom: var(--space-3, 12px);
}

.health-summary__score {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-metric-size, 96px);
  line-height: var(--text-metric-line, 1.0);
  font-weight: var(--text-metric-weight, 700);
  transition: color var(--motion-slow-duration, 400ms) var(--motion-slow-easing, ease-in-out);
}

.health-summary__trend {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1, 4px);
  margin-top: var(--space-2, 8px);
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-sm-size, 14px);
  font-weight: var(--text-body-weight, 500);
}

.health-summary__trend--up {
  color: var(--color-success, #22c55e);
}

.health-summary__trend--down {
  color: var(--color-error, #ef4444);
}

.health-summary__trend--stable {
  color: var(--color-text-tertiary, #9ca3af);
}

.health-summary__label {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-size, 16px);
  color: var(--color-text-primary, #111111);
  font-weight: 500;
  margin: var(--space-2, 8px) 0 0;
}

.health-summary__definition {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-sm-size, 14px);
  color: var(--color-text-secondary, #6b7280);
  margin: var(--space-2, 8px) 0 0;
  max-width: 480px;
  line-height: var(--text-body-sm-line, 1.5);
}
</style>
