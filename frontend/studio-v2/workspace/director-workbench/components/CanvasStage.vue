<!--
CanvasStage.vue
导演驾驶舱 — 画布舞台层（核心预览）
-->

<template>
  <div class="canvas-stage" @click="store.selectShot(0)">
    <div class="canvas-header">
      <span class="canvas-title">🎥 画布舞台</span>
      <div class="canvas-controls">
        <button @click="store.togglePlay()" class="ctrl-btn">
          {{ store.state.isPlaying ? '⏸ 暂停' : '▶ 播放' }}
        </button>
        <span class="time-display">{{ formatTime(store.state.playbackTime) }} / {{ formatTime(store.totalDuration) }}</span>
      </div>
    </div>

    <div class="canvas-body">
      <!-- 当前镜头展示区 -->
      <div class="shot-display" v-if="store.currentShot">
        <div class="shot-card" :class="shotCardClass(store.currentShot)">
          <div class="shot-badge">{{ store.currentShot.grammarType }}</div>
          <div class="shot-description">{{ store.currentShot.description }}</div>
          <div class="shot-meta">
            <span class="meta-tag motion">{{ store.currentShot.motionStyle }}</span>
            <span class="meta-tag emotion">{{ store.currentShot.emotionalMood }}</span>
            <span class="meta-tag continuity" :class="store.currentShot.temporalContinuity < 0.4 ? 'warn' : 'ok'">
              连续性 {{ (store.currentShot.temporalContinuity * 100).toFixed(0) }}%
            </span>
          </div>
        </div>
      </div>

      <div class="shot-nav">
        <button
          v-for="(shot, i) in store.state.timeline"
          :key="shot.id"
          class="nav-dot"
          :class="{ active: i === store.state.currentShotIndex }"
          @click="store.selectShot(i)"
          :title="`Shot ${i + 1}: ${shot.grammarType}`"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useDirectorRuntimeStore, TimelineShot } from '../stores/director-runtime-store'

const store = useDirectorRuntimeStore()

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function shotCardClass(shot: TimelineShot): Record<string, boolean> {
  return {
    'is-selected': shot.selected,
    'is-hovered': shot.hovered,
    [`grammar-${shot.grammarType}`]: true,
  }
}
</script>

<style scoped>
.canvas-stage {
  background: #111;
  border-radius: 12px;
  padding: 16px;
  min-height: 300px;
  border: 1px solid #222;
}

.canvas-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.canvas-title {
  color: #fff;
  font-size: 14px;
  font-weight: 600;
}

.canvas-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.ctrl-btn {
  background: #333;
  color: #fff;
  border: 1px solid #444;
  border-radius: 6px;
  padding: 6px 16px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.15s;
}

.ctrl-btn:hover {
  background: #444;
  border-color: #666;
}

.time-display {
  color: #888;
  font-size: 12px;
  font-family: 'Courier New', monospace;
}

.canvas-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.shot-display {
  width: 100%;
}

.shot-card {
  background: #1a1a2e;
  border: 1px solid #2a2a4e;
  border-radius: 10px;
  padding: 20px;
  transition: all 0.2s;
}

.shot-card:hover {
  border-color: #4a4a8e;
  background: #1e1e3e;
}

.shot-badge {
  display: inline-block;
  background: #2a2a4e;
  color: #8080ff;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 10px;
  border-radius: 4px;
  text-transform: uppercase;
  margin-bottom: 12px;
}

.shot-description {
  color: #ddd;
  font-size: 15px;
  line-height: 1.5;
  margin-bottom: 14px;
}

.shot-meta {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.meta-tag {
  font-size: 11px;
  padding: 3px 10px;
  border-radius: 4px;
}

.meta-tag.motion {
  background: #1a2e1a;
  color: #6f6;
}

.meta-tag.emotion {
  background: #2e1a2e;
  color: #f6f;
}

.meta-tag.continuity {
  background: #2e2e1a;
  color: #ff6;
}

.meta-tag.continuity.warn {
  background: #3e1a1a;
  color: #f66;
}

.shot-nav {
  display: flex;
  gap: 8px;
}

.nav-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #333;
  border: 2px solid transparent;
  cursor: pointer;
  transition: all 0.15s;
}

.nav-dot.active {
  background: #8080ff;
  border-color: #a0a0ff;
}

.nav-dot:hover {
  border-color: #666;
}
</style>
