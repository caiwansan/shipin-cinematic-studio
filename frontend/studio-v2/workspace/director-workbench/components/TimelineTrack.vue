<!--
TimelineTrack.vue
导演驾驶舱 — 时间轴线组件（可拖拽/拉伸/scrub）
-->

<template>
  <div class="timeline-track">
    <div class="timeline-header">
      <span class="tl-title">⏱ 时间轴</span>
      <div class="tl-controls">
        <button @click="store.togglePlay()" class="tl-btn">
          {{ store.state.isPlaying ? '⏸' : '▶' }}
        </button>
        <span class="tl-total">{{ store.totalShots }} 镜头 · {{ formatTime(store.totalDuration) }}</span>
      </div>
    </div>

    <div
      class="timeline-body"
      ref="timelineBodyRef"
      @mousedown.prevent="onTimelineMouseDown"
      @mousemove="onTimelineMouseMove"
      @mouseup="onTimelineMouseUp"
      @mouseleave="onTimelineMouseUp"
    >
      <div class="timeline-ruler">
        <div
          v-for="mark in rulerMarks"
          :key="mark.time"
          class="ruler-mark"
          :style="{ left: mark.percent + '%' }"
        >
          <span class="ruler-label">{{ formatTime(mark.time) }}</span>
        </div>
      </div>

      <div class="shots-row">
        <div
          v-for="(shot, i) in store.state.timeline"
          :key="shot.id"
          class="shot-block"
          :class="[
            `type-${shot.grammarType}`,
            { selected: shot.selected, dragging: dragState.hoverIndex === i && dragState.isDragging }
          ]"
          :style="shotBlockStyle(shot)"
          @mousedown.prevent="engine.startDrag(i, $event)"
          @mouseenter="engine.onDragMove(i)"
        >
          <div class="shot-label">
            <span class="shot-index">{{ i + 1 }}</span>
            <span class="shot-grammar">{{ shot.grammarType.slice(0, 4) }}</span>
          </div>
          <div
            class="resize-handle left"
            @mousedown.prevent="engine.startResize(i, 'left', $event)"
          />
          <div
            class="resize-handle right"
            @mousedown.prevent="engine.startResize(i, 'right', $event)"
          />
        </div>
      </div>

      <!-- Scrub 播放头 -->
      <div
        class="scrub-head"
        :style="{ left: scrubPercent + '%' }"
      >
        <div class="scrub-line" />
        <div class="scrub-dot" />
      </div>
    </div>

    <!-- 底部操作 -->
    <div class="timeline-actions">
      <button @click="engine.splitShot(store.state.currentShotIndex, 1)" class="tl-action-btn" :disabled="!store.currentShot">
        ✂ 拆分
      </button>
      <button
        @click="engine.mergeShots(store.state.currentShotIndex, store.state.currentShotIndex + 1)"
        class="tl-action-btn"
        :disabled="!store.currentShot || store.state.currentShotIndex >= store.totalShots - 1"
      >
        ⊞ 合并
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useDirectorRuntimeStore, TimelineShot } from '../stores/director-runtime-store'
import { useTimelineEngine } from '../composables/useTimelineEngine'

const store = useDirectorRuntimeStore()
const engine = useTimelineEngine()
const timelineBodyRef = ref<HTMLElement | null>(null)

const rulerMarks = computed(() => {
  const marks = []
  for (let t = 0; t <= store.totalDuration; t += 2) {
    marks.push({ time: t, percent: (t / store.totalDuration) * 100 })
  }
  return marks
})

const scrubPercent = computed(() =>
  store.totalDuration > 0 ? (store.state.playbackTime / store.totalDuration) * 100 : 0,
)

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function shotBlockStyle(shot: TimelineShot): Record<string, string> {
  const widthPct = (shot.duration / store.totalDuration) * 100
  return { width: widthPct + '%' }
}

function onTimelineMouseDown(e: MouseEvent) {
  if (timelineBodyRef.value) {
    const rect = timelineBodyRef.value.getBoundingClientRect()
    engine.onScrub(e.clientX - rect.left, rect.width)
  }
}

function onTimelineMouseMove(e: MouseEvent) {
  if (e.buttons === 1 && timelineBodyRef.value) {
    const rect = timelineBodyRef.value.getBoundingClientRect()
    engine.onScrub(e.clientX - rect.left, rect.width)
  }
}

function onTimelineMouseUp() {
  engine.onDragEnd()
}
</script>

<style scoped>
.timeline-track {
  background: #111;
  border-radius: 12px;
  padding: 16px;
  border: 1px solid #222;
}

.timeline-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.tl-title {
  color: #fff;
  font-size: 14px;
  font-weight: 600;
}

.tl-controls {
  display: flex;
  align-items: center;
  gap: 10px;
}

.tl-btn {
  background: #333;
  color: #fff;
  border: 1px solid #444;
  border-radius: 6px;
  width: 32px;
  height: 28px;
  cursor: pointer;
  font-size: 12px;
}

.tl-btn:hover {
  background: #444;
}

.tl-total {
  color: #888;
  font-size: 12px;
}

.timeline-body {
  position: relative;
  height: 70px;
  background: #1a1a1a;
  border-radius: 8px;
  cursor: pointer;
  overflow: hidden;
}

.timeline-ruler {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 16px;
}

.ruler-mark {
  position: absolute;
  top: 0;
  transform: translateX(-50%);
}

.ruler-label {
  color: #555;
  font-size: 9px;
  font-family: 'Courier New', monospace;
}

.shots-row {
  position: absolute;
  top: 18px;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
}

.shot-block {
  position: relative;
  height: 100%;
  border: 1px solid transparent;
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  cursor: grab;
  transition: all 0.1s;
  overflow: hidden;
}

.shot-block.type-establishing { background: #1a3a1a; border-color: #3a5a3a; }
.shot-block.type-build_up { background: #1a2a3a; border-color: #3a4a5a; }
.shot-block.type-peak { background: #3a1a1a; border-color: #5a2a2a; }
.shot-block.type-release { background: #2a1a3a; border-color: #4a2a5a; }
.shot-block.type-reaction { background: #1a2a2a; border-color: #2a4a4a; }

.shot-block.selected {
  border-color: #8080ff !important;
  box-shadow: 0 0 8px rgba(128, 128, 255, 0.3);
}

.shot-block.dragging {
  opacity: 0.7;
  transform: scale(0.95);
}

.shot-label {
  display: flex;
  gap: 6px;
  align-items: center;
}

.shot-index {
  color: #aaa;
  font-size: 11px;
  font-weight: 600;
}

.shot-grammar {
  color: #666;
  font-size: 10px;
  text-transform: uppercase;
}

.resize-handle {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 6px;
  cursor: ew-resize;
  z-index: 2;
}

.resize-handle.left { left: 0; }
.resize-handle.right { right: 0; }

.scrub-head {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  z-index: 10;
  pointer-events: none;
}

.scrub-line {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: #f44;
}

.scrub-dot {
  position: absolute;
  top: -4px;
  left: -4px;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: #f44;
}

.timeline-actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}

.tl-action-btn {
  background: #222;
  color: #aaa;
  border: 1px solid #333;
  border-radius: 6px;
  padding: 4px 14px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}

.tl-action-btn:hover:not(:disabled) {
  background: #333;
  color: #fff;
}

.tl-action-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}
</style>
