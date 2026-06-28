<!--
MotionOverlayLayer.vue
导演驾驶舱 — 运动轨迹层（Motion Planning Enhancer 可视化）
-->

<template>
  <div class="motion-overlay" v-if="store.state.motionOverlays.some(o => o.visible)">
    <div class="motion-header">
      <span class="motion-title">🌊 运动轨迹</span>
      <div class="motion-toggles">
        <button
          v-for="overlay in store.state.motionOverlays"
          :key="overlay.type"
          class="toggle-btn"
          :class="{ active: overlay.visible }"
          @click="store.toggleMotionOverlay(overlay.type)"
        >
          {{ overlayLabel(overlay.type) }}
        </button>
      </div>
    </div>

    <div class="motion-body" ref="motionBodyRef">
      <svg :width="svgWidth" :height="SVG_HEIGHT" class="motion-svg">
        <!-- Energy Flow 曲线 -->
        <polyline
          v-if="motionOverlayVisible('camera_path')"
          :points="energyFlowPoints"
          fill="none"
          stroke="#6ff"
          stroke-width="2"
          stroke-dasharray="4"
          class="energy-line"
        />

        <!-- Pressure Bar -->
        <g v-for="(bar, i) in pressureBars" :key="'bar-' + i" v-if="motionOverlayVisible('velocity')">
          <rect
            :x="bar.x - bar.width / 2"
            :y="SVG_HEIGHT - bar.height"
            :width="bar.width"
            :height="bar.height"
            :fill="bar.color"
            opacity="0.6"
            class="pressure-bar"
          />
          <text
            :x="bar.x"
            :y="SVG_HEIGHT - bar.height - 4"
            text-anchor="middle"
            class="bar-label"
          >{{ bar.pressure }}%</text>
        </g>

        <!-- Instability Dots -->
        <g v-for="(dot, i) in instabilityDots" :key="'dot-' + i" v-if="motionOverlayVisible('shake')">
          <circle
            :cx="dot.x"
            :cy="SVG_HEIGHT / 2"
            :r="dot.radius"
            :fill="dot.color"
            :opacity="dot.opacity"
            class="shake-dot"
          />
          <text
            :x="dot.x"
            :y="SVG_HEIGHT / 2 + 24"
            text-anchor="middle"
            class="dot-label"
          >S{{ i + 1 }}</text>
        </g>

        <!-- Energy flow labels -->
        <g v-if="motionOverlayVisible('camera_path')" v-for="(pt, i) in energyFlowValues" :key="'ef-' + i">
          <text
            :x="pt.x"
            :y="24"
            text-anchor="middle"
            class="ef-label"
            :fill="pt.color"
          >{{ pt.label }}</text>
        </g>
      </svg>

      <!-- 图例 -->
      <div class="motion-legend">
        <span class="legend-item"><span class="legend-line dash" /> 能量流</span>
        <span class="legend-item"><span class="legend-block pressure" /> 压迫感</span>
        <span class="legend-item"><span class="legend-block shake" /> 不稳定度</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useDirectorRuntimeStore } from '../stores/director-runtime-store'

const store = useDirectorRuntimeStore()
const motionBodyRef = ref<HTMLElement | null>(null)

const SVG_HEIGHT = 100
const PADDING = 10

function overlayLabel(type: string): string {
  switch (type) {
    case 'camera_path': return '能量流'
    case 'velocity': return '压迫感'
    case 'acceleration': return '加速'
    case 'shake': return '不稳定'
    default: return type
  }
}

function motionOverlayVisible(type: string): boolean {
  return store.state.motionOverlayFlags?.[type] ?? false
}

const svgWidth = computed(() => (motionBodyRef.value?.clientWidth ?? 500))

const energyFlowValues = computed(() => {
  const shots = store.state.timeline
  if (shots.length === 0) return []

  const width = svgWidth.value - PADDING * 2
  return shots.map((shot, i) => {
    const x = shots.length > 1 ? PADDING + (i / (shots.length - 1)) * width : PADDING + width / 2
    const ef = shot.motionEnergyFlow ?? 0
    const label = ef >= 0.5 ? '▶ 推' : ef <= -0.3 ? '◀ 退' : '▷ 平'
    const color = ef >= 0.5 ? '#6f6' : ef <= -0.3 ? '#f66' : '#888'
    return { x, label, color }
  })
})

const energyFlowPoints = computed(() =>
  energyFlowValues.value.map(pt => `${pt.x},${40 + 10}`).join(' '),
)

const pressureBars = computed(() => {
  const shots = store.state.timeline
  if (shots.length === 0) return []

  const width = svgWidth.value - PADDING * 2
  const barWidth = Math.max(10, (width / shots.length) - 8)

  return shots.map((shot, i) => {
    const x = shots.length > 1 ? PADDING + (i / (shots.length - 1)) * width : PADDING + width / 2
    const pressure = Math.min((shot.motionPressure ?? 0.5) * 100, 100)
    const height = (pressure / 100) * (SVG_HEIGHT - 40)
    const color = pressure > 70 ? '#f66' : pressure > 40 ? '#f90' : '#6f6'
    return { x, width: barWidth, height, pressure: pressure.toFixed(0), color }
  })
})

const instabilityDots = computed(() => {
  const shots = store.state.timeline
  if (shots.length === 0) return []

  const width = svgWidth.value - PADDING * 2
  return shots.map((shot, i) => {
    const x = shots.length > 1 ? PADDING + (i / (shots.length - 1)) * width : PADDING + width / 2
    const instability = Math.min((shot.motionInstability ?? 0.3), 1)
    const radius = 4 + instability * 20
    const opacity = 0.3 + instability * 0.5
    const color = instability > 0.5 ? '#f64' : '#88f'
    return { x, radius, opacity, color, label: (instability * 100).toFixed(0) }
  })
})
</script>

<style scoped>
.motion-overlay {
  background: #111;
  border-radius: 12px;
  padding: 12px;
  border: 1px solid #222;
}

.motion-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.motion-title {
  color: #fff;
  font-size: 13px;
  font-weight: 600;
}

.motion-toggles {
  display: flex;
  gap: 4px;
}

.toggle-btn {
  background: #222;
  color: #666;
  border: 1px solid #333;
  border-radius: 4px;
  padding: 3px 10px;
  font-size: 10px;
  cursor: pointer;
}

.toggle-btn.active {
  background: #2a3a4a;
  color: #8cf;
  border-color: #4a6a8a;
}

.motion-body {
  overflow-x: auto;
}

.motion-svg {
  display: block;
}

.energy-line {
  transition: all 0.3s;
}

.pressure-bar {
  transition: all 0.2s;
}

.shake-dot {
  transition: all 0.2s;
}

.bar-label {
  fill: #888;
  font-size: 9px;
  font-family: 'Courier New', monospace;
}

.dot-label {
  fill: #555;
  font-size: 9px;
  font-family: 'Courier New', monospace;
}

.ef-label {
  font-size: 10px;
  font-family: 'Courier New', monospace;
}

.motion-legend {
  display: flex;
  gap: 16px;
  margin-top: 6px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #666;
  font-size: 10px;
}

.legend-line {
  display: inline-block;
  width: 16px;
  height: 2px;
}

.legend-line.dash {
  background: #6ff;
  border-top: 2px dashed #6ff;
  height: 0;
}

.legend-block {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 2px;
}

.legend-block.pressure { background: #f90; }
.legend-block.shake { background: #88f; }
</style>
