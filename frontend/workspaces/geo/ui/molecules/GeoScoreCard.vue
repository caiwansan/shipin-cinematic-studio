<template>
  <div
    :class="['geo-score-card', className]"
    :data-testid="dataTestId"
  >
    <!-- DS-style score display -->
    <template v-if="displayMode === 'score'">
      <div class="geo-score-card__score" :style="{ color: scoreColor }">
        {{ displayScore }}
      </div>
      <div v-if="label" class="geo-score-card__label">{{ label }}</div>
      <div v-if="trend !== undefined" class="geo-score-card__trend" :class="`geo-score-card__trend--${trendDir}`">
        <span class="geo-score-card__trend-icon">{{ trendIcon }}</span>
        <span v-if="trendValue !== undefined" class="geo-score-card__trend-value">{{ trendPrefix }}{{ trendValue }}</span>
      </div>
      <slot />
    </template>

    <!-- Geo-style metric display with progress bar -->
    <template v-else>
      <div class="geo-score-card__header">
        <span class="geo-score-card__label">{{ label }}</span>
        <GeoBadge v-if="badge" :variant="badgeVariant" size="sm">{{ badge }}</GeoBadge>
      </div>
      <div class="geo-score-card__value-row">
        <span class="geo-score-card__value" :class="scoreColorClass">{{ displayValue || displayScore }}</span>
        <slot name="suffix" />
      </div>
      <div v-if="showProgress" class="geo-score-card__track">
        <div
          class="geo-score-card__fill"
          :style="{ width: progressPercent + '%' }"
          :class="scoreColorClass"
        />
      </div>
      <div v-if="subtext" class="geo-score-card__subtext">{{ subtext }}</div>
      <div v-if="description" class="geo-score-card__description">{{ description }}</div>
      <slot />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import GeoBadge from '../atoms/GeoBadge.vue'

type ScoreDisplayMode = 'score' | 'metric'
type TrendDir = 'up' | 'down' | 'stable'

const props = withDefaults(defineProps<{
  /** Display mode */
  displayMode?: ScoreDisplayMode
  /** Score value (0-100) */
  score?: number
  /** Maximum score */
  maxScore?: number
  /** Label text */
  label?: string
  /** Display value (for metric mode, overrides score display) */
  displayValue?: string | number
  /** Badge text */
  badge?: string
  /** Badge variant */
  badgeVariant?: 'success' | 'warning' | 'error' | 'info' | 'neutral'
  /** Progress percentage (0-100, metric mode) */
  progress?: number
  /** Subtext */
  subtext?: string
  /** Description text */
  description?: string
  /** Trend direction (score mode) */
  trend?: TrendDir
  /** Trend numeric value */
  trendValue?: number
  /** Show decimal places (score mode) */
  showDecimal?: boolean
  /** Additional class names */
  class?: string
  /** Data test id */
  'data-testid'?: string
}>(), {
  displayMode: 'metric',
  score: 0,
  maxScore: 100,
  showDecimal: false,
  badge: '',
  badgeVariant: 'info',
  subtext: '',
  description: '',
})

const className = computed(() => props.class || '')
const dataTestId = computed(() => props['data-testid'] || undefined)

const displayScore = computed(() => {
  if (props.showDecimal) return props.score.toFixed(1)
  return Math.round(props.score).toString()
})

const progressPercent = computed(() => {
  if (props.progress !== undefined) return Math.min(100, Math.max(0, props.progress))
  return Math.min(100, Math.max(0, (props.score / props.maxScore) * 100))
})

const showProgress = computed(() => props.progress !== undefined || props.displayMode !== 'score')

const scoreColor = computed(() => {
  const ratio = props.score / props.maxScore
  if (ratio >= 0.8) return 'var(--geo-success, #059669)'
  if (ratio >= 0.6) return 'var(--geo-warning, #d97706)'
  return 'var(--geo-error, #dc2626)'
})

const scoreColorClass = computed(() => {
  const val = props.displayValue !== '' ? Number(props.displayValue) : props.score
  if (typeof val === 'number' && !isNaN(val)) {
    if (val >= 80) return 'geo-score-card--high'
    if (val >= 50) return 'geo-score-card--mid'
    return 'geo-score-card--low'
  }
  return ''
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
.geo-score-card {
  padding: var(--geo-space-xl, 20px);
  border-radius: var(--geo-radius-round, 12px);
  background-color: var(--geo-bg, #ffffff);
  border: 1px solid var(--geo-border, #e5e7eb);
  transition: all 150ms ease;
}

.geo-score-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--geo-space-sm, 8px);
}

.geo-score-card__label {
  font-size: var(--geo-font-size-base, 13px);
  color: var(--geo-text-tertiary, #6b7280);
  font-weight: 500;
}

.geo-score-card__value-row {
  display: flex;
  align-items: baseline;
  gap: var(--geo-space-sm, 8px);
  margin-bottom: var(--geo-space-md, 12px);
}

.geo-score-card__value {
  font-size: 32px;
  font-weight: 700;
  color: var(--geo-text, #111827);
  line-height: 1.1;
}

.geo-score-card__value.geo-score-card--high { color: var(--geo-success, #059669); }
.geo-score-card__value.geo-score-card--mid { color: var(--geo-warning, #d97706); }
.geo-score-card__value.geo-score-card--low { color: var(--geo-error, #dc2626); }

.geo-score-card__track {
  height: 6px;
  border-radius: 3px;
  background: var(--geo-border, #e5e7eb);
  margin-bottom: 10px;
  overflow: hidden;
}

.geo-score-card__fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.6s ease;
}

.geo-score-card__fill.geo-score-card--high { background: var(--geo-success, #059669); }
.geo-score-card__fill.geo-score-card--mid { background: var(--geo-warning, #d97706); }
.geo-score-card__fill.geo-score-card--low { background: var(--geo-error, #dc2626); }

.geo-score-card__subtext {
  font-size: var(--geo-font-size-xs, 11px);
  color: var(--geo-text-disabled, #9ca3af);
}

.geo-score-card__description {
  font-size: var(--geo-font-size-base, 13px);
  color: var(--geo-text-tertiary, #6b7280);
  margin-top: 6px;
  line-height: 1.4;
}

/* Score display mode (DS style) */
.geo-score-card__score {
  font-family: var(--geo-font, inherit);
  font-size: 48px;
  font-weight: 700;
  line-height: 1;
  text-align: center;
  transition: color 400ms ease-in-out;
}

.geo-score-card__trend {
  display: inline-flex;
  align-items: center;
  gap: var(--geo-space-xs, 4px);
  margin-top: var(--geo-space-sm, 8px);
  font-size: var(--geo-font-size-base, 13px);
  font-weight: 500;
  justify-content: center;
  width: 100%;
}

.geo-score-card__trend--up { color: var(--geo-success, #059669); }
.geo-score-card__trend--down { color: var(--geo-error, #dc2626); }
.geo-score-card__trend--stable { color: var(--geo-text-disabled, #9ca3af); }
</style>
