<template>
  <div :class="['ds-trend-chart', classOverride]" :style="styleOverride" :data-testid="dataTestId">
    <div v-if="title || $slots.header" class="ds-trend-chart__header">
      <slot name="header">
        <span v-if="title" class="ds-trend-chart__title">{{ title }}</span>
      </slot>
    </div>
    <div class="ds-trend-chart__canvas" ref="chartContainer">
      <svg
        v-if="points.length > 1"
        :viewBox="`0 0 ${svgWidth} ${svgHeight}`"
        class="ds-trend-chart__svg"
        :aria-label="`Trend chart${title ? ': ' + title : ''}`"
        role="img"
      >
        <!-- Grid lines -->
        <line
          v-for="(y, i) in gridLines"
          :key="`grid-${i}`"
          :x1="padding"
          :y1="y"
          :x2="svgWidth - padding"
          :y2="y"
          stroke="var(--color-border, #e5e7eb)"
          stroke-width="1"
        />
        <!-- Area fill -->
        <path
          :d="areaPath"
          :fill="chartColor"
          fill-opacity="0.1"
        />
        <!-- Line -->
        <path
          :d="linePath"
          :stroke="chartColor"
          stroke-width="2"
          fill="none"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <!-- Dots -->
        <circle
          v-for="(point, i) in chartPoints"
          :key="`dot-${i}`"
          :cx="point.x"
          :cy="point.y"
          :r="isHoveredIndex === i ? 4 : 2.5"
          :fill="chartColor"
          class="ds-trend-chart__dot"
          @mouseenter="isHoveredIndex = i"
          @mouseleave="isHoveredIndex = -1"
        />
        <!-- Hover tooltip -->
        <g v-if="isHoveredIndex >= 0 && hoveredPoint">
          <circle
            :cx="hoveredPoint.x"
            :cy="hoveredPoint.y"
            r="6"
            :fill="chartColor"
            fill-opacity="0.2"
            stroke="var(--color-surface, #ffffff)"
            stroke-width="2"
          />
        </g>
      </svg>
      <div v-else-if="points.length === 0" class="ds-trend-chart__empty">
        <span>No trend data available</span>
      </div>
      <div v-else class="ds-trend-chart__single">
        <span class="ds-trend-chart__single-value">{{ formatY(points[0]) }}</span>
      </div>
    </div>
    <div v-if="showLabels && points.length > 0" class="ds-trend-chart__labels">
      <span class="ds-trend-chart__label-min">{{ formatY(minVal) }}</span>
      <span class="ds-trend-chart__label-max">{{ formatY(maxVal) }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

const props = withDefaults(defineProps<{
  points?: number[]
  title?: string
  color?: string
  showLabels?: boolean
  height?: number
  class?: string
  style?: string | Record<string, string>
  'data-testid'?: string
}>(), {
  points: () => [],
  color: 'var(--color-info, #3b82f6)',
  showLabels: false,
  height: 120,
})

const classOverride = computed(() => props.class || '')
const styleOverride = computed(() => props.style || undefined)
const dataTestId = computed(() => props['data-testid'] || undefined)

const isHoveredIndex = ref(-1)
const chartContainer = ref<HTMLElement | null>(null)

const padding = 4
const svgWidth = 240
const svgHeight = props.height - padding * 2

const minVal = computed(() => Math.min(...props.points))
const maxVal = computed(() => Math.max(...props.points))

const range = computed(() => {
  const r = maxVal.value - minVal.value
  return r === 0 ? 1 : r
})

const chartColor = computed(() => props.color)

const chartPoints = computed(() => {
  if (props.points.length <= 1) return []
  const count = props.points.length
  return props.points.map((val, i) => ({
    x: padding + (i / (count - 1)) * (svgWidth - padding * 2),
    y: svgHeight - ((val - minVal.value) / range.value) * (svgHeight - padding * 2),
    value: val,
  }))
})

const gridLines = computed(() => {
  return [0, 0.25, 0.5, 0.75, 1].map(t => svgHeight - t * (svgHeight - padding * 2))
})

const linePath = computed(() => {
  if (chartPoints.value.length < 2) return ''
  return chartPoints.value.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
})

const areaPath = computed(() => {
  if (chartPoints.value.length < 2) return ''
  const top = chartPoints.value.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
  const bottom = `L${chartPoints.value[chartPoints.value.length - 1].x},${svgHeight} L${chartPoints.value[0].x},${svgHeight} Z`
  return `${top} ${bottom}`
})

const hoveredPoint = computed(() => {
  if (isHoveredIndex.value < 0 || isHoveredIndex.value >= chartPoints.value.length) return null
  return chartPoints.value[isHoveredIndex.value]
})

function formatY(val: number): string {
  if (Math.abs(val) >= 1000000) return (val / 1000000).toFixed(1) + 'M'
  if (Math.abs(val) >= 1000) return (val / 1000).toFixed(1) + 'K'
  return String(Math.round(val * 10) / 10)
}
</script>

<style scoped>
.ds-trend-chart {
  display: flex;
  flex-direction: column;
  gap: var(--space-2, 8px);
}

.ds-trend-chart__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.ds-trend-chart__title {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-sm-size, 14px);
  font-weight: 600;
  color: var(--color-text-primary, #111111);
}

.ds-trend-chart__canvas {
  position: relative;
}

.ds-trend-chart__svg {
  width: 100%;
  height: v-bind('props.height + "px"');
  overflow: visible;
}

.ds-trend-chart__dot {
  cursor: pointer;
  transition: r var(--motion-fast-duration, 100ms) var(--motion-fast-easing, ease-out);
}

.ds-trend-chart__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: v-bind('props.height + "px"');
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-sm-size, 14px);
  color: var(--color-text-tertiary, #9ca3af);
}

.ds-trend-chart__single {
  display: flex;
  align-items: center;
  justify-content: center;
  height: v-bind('props.height + "px"');
}

.ds-trend-chart__single-value {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-metric-sm-size, 32px);
  font-weight: var(--text-metric-sm-weight, 700);
  color: var(--color-text-primary, #111111);
}

.ds-trend-chart__labels {
  display: flex;
  justify-content: space-between;
}

.ds-trend-chart__label-min,
.ds-trend-chart__label-max {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-caption-size, 12px);
  color: var(--color-text-tertiary, #9ca3af);
}
</style>
