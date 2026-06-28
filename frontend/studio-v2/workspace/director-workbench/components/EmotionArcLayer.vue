<!--
EmotionArcLayer.vue
导演驾驶舱 — 情绪弧线层（Emotional Arc Compiler 可视化）
-->

<template>
  <div class="emotion-arc" v-if="store.state.showEmotionArc">
    <div class="arc-header">
      <span class="arc-title">❤️ 情绪弧线</span>
      <button @click="store.toggleEmotionArc()" class="close-btn">✕</button>
    </div>

    <div class="arc-body" ref="arcBodyRef">
      <svg :width="svgWidth" :height="SVG_HEIGHT" class="arc-svg">
        <!-- 张力折线 -->
        <polyline
          :points="tensionPoints"
          fill="none"
          stroke="#f66"
          stroke-width="2"
          class="tension-line"
        />

        <!-- 张力填充区域 -->
        <polygon
          :points="tensionFillPoints"
          fill="url(#tensionGradient)"
          opacity="0.2"
        />

        <!-- 标签 -->
        <g v-for="(pt, i) in tensionData" :key="'pt-' + i">
          <circle
            :cx="pt.x"
            :cy="pt.y"
            r="4"
            :fill="pt.moodColor"
            class="tension-dot"
            @mouseenter="store.selectShot(i)"
          />
          <text
            :x="pt.x"
            :y="pt.y - 14"
            text-anchor="middle"
            class="tension-label"
          >{{ pt.tension }}%</text>
          <text
            :x="pt.x"
            :y="SVG_HEIGHT - 4"
            text-anchor="middle"
            class="shot-label"
          >S{{ i + 1 }}</text>
        </g>

        <!-- 渐变定义 -->
        <defs>
          <linearGradient id="tensionGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#f66" />
            <stop offset="100%" stop-color="#f66" stop-opacity="0" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useDirectorRuntimeStore } from '../stores/director-runtime-store'

const store = useDirectorRuntimeStore()
const arcBodyRef = ref<HTMLElement | null>(null)

const SVG_HEIGHT = 120
const PADDING = 20

const moodColors: Record<string, string> = {
  calm: '#6f6',
  rising: '#ff6',
  tensed: '#f90',
  explosive: '#f44',
  falling: '#f6f',
  resolved: '#6ff',
}

const tensionData = computed(() => {
  const shots = store.state.timeline
  if (shots.length === 0) return []

  const width = (arcBodyRef.value?.clientWidth ?? 500) - PADDING * 2
  const height = SVG_HEIGHT - PADDING * 2

  return shots.map((shot, i) => {
    const x = shots.length > 1
      ? PADDING + (i / (shots.length - 1)) * width
      : PADDING + width / 2
    const tension = (shot.emotionalTension ?? 0.5) * height
    const y = SVG_HEIGHT - PADDING - Math.min(tension, height)

    return {
      x, y,
      tension: (shot.emotionalTension * 100).toFixed(0),
      moodColor: moodColors[shot.emotionalMood] ?? '#888',
    }
  })
})

const tensionPoints = computed(() =>
  tensionData.value.map(pt => `${pt.x},${pt.y}`).join(' '),
)

const tensionFillPoints = computed(() => {
  if (tensionData.value.length === 0) return ''
  const first = tensionData.value[0]
  const last = tensionData.value[tensionData.value.length - 1]
  const bottom = SVG_HEIGHT - PADDING
  return `${first.x},${bottom} ${tensionPoints.value} ${last.x},${bottom}`
})

const svgWidth = computed(() => (arcBodyRef.value?.clientWidth ?? 500))
</script>

<style scoped>
.emotion-arc {
  background: #111;
  border-radius: 12px;
  padding: 12px;
  border: 1px solid #222;
}

.arc-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.arc-title {
  color: #fff;
  font-size: 13px;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: 1px solid #333;
  color: #666;
  border-radius: 4px;
  cursor: pointer;
  font-size: 11px;
  padding: 2px 6px;
}

.arc-body {
  overflow-x: auto;
}

.arc-svg {
  display: block;
}

.tension-line {
  transition: all 0.3s;
}

.tension-dot {
  cursor: pointer;
  transition: r 0.15s;
}

.tension-dot:hover {
  r: 6;
}

.tension-label {
  fill: #888;
  font-size: 10px;
  font-family: 'Courier New', monospace;
}

.shot-label {
  fill: #555;
  font-size: 10px;
  font-family: 'Courier New', monospace;
}
</style>
