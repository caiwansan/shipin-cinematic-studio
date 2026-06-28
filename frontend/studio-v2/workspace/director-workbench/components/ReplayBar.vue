<!--
ReplayBar.vue
导演回放控制条 — 外挂式 overlay，零改造现有 UI

显示在 TimelineTrack 上方，提供：
  - Live Mode toggle
  - Play/Pause
  - Progress scrub
  - Speed control
-->

<template>
  <div class="replay-bar" v-if="replayStore.liveMode">
    <div class="replay-header">
      <span class="replay-title">🎥 Live Replay</span>
      <span class="replay-trace">{{ replayStore.traceId?.slice(0, 20) }}...</span>
    </div>

    <!-- 事件计数器 -->
    <div class="replay-stats">
      <span class="stat">{{ replayStore.totalEvents }} events</span>
      <span class="stat">seq {{ replayStore.cursor }} / {{ replayStore.totalEvents }}</span>
      <span class="stat progress">{{ (replayStore.progress * 100).toFixed(0) }}%</span>
    </div>

    <!-- 播放控制 -->
    <div class="replay-controls">
      <button @click="replayStore.stepBackward()" class="ctrl" title="上一步">⏪</button>
      <button @click="replayStore.togglePlay()" class="ctrl play-btn" title="播放/暂停">
        {{ replayStore.isPlaying ? '⏸' : '▶' }}
      </button>
      <button @click="replayStore.stepForward()" class="ctrl" title="下一步">⏩</button>

      <div class="speed-control">
        <button
          v-for="s in speeds"
          :key="s"
          class="speed-btn"
          :class="{ active: replayStore.replaySpeed === s }"
          @click="replayStore.setReplaySpeed(s)"
        >{{ s }}x</button>
      </div>
    </div>

    <!-- 进度条 -->
    <div
      class="replay-progress"
      ref="progressRef"
      @mousedown.prevent="onProgressClick"
    >
      <div class="progress-track">
        <div
          class="progress-fill"
          :style="{ width: (replayStore.progress * 100) + '%' }"
        />
        <div
          class="progress-thumb"
          :style="{ left: (replayStore.progress * 100) + '%' }"
        />
      </div>
      <!-- 事件分布标记 -->
      <div class="event-dots">
        <div
          v-for="(_, i) in Math.min(replayStore.totalEvents, 50)"
          :key="i"
          class="event-dot"
          :class="{ passed: i < replayStore.cursor }"
          :style="{ left: (i / Math.max(replayStore.totalEvents, 1) * 100) + '%' }"
        />
      </div>
    </div>

    <!-- 当前事件详情 -->
    <div class="replay-event" v-if="replayStore.currentEvent">
      <span class="event-layer" :class="replayStore.currentEvent.layer">{{ replayStore.currentEvent.layer }}</span>
      <span class="event-type">{{ replayStore.currentEvent.type }}</span>
      <span class="event-payload">{{ formatPayload(replayStore.currentEvent.payload) }}</span>
    </div>
  </div>

  <!-- 非 Live 模式的入口按钮 -->
  <div class="replay-entrance" v-else>
    <button @click="enterReplayMode" class="enter-btn" v-if="hasTrace">
      🎥 导演回放
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useDirectorReplayStore } from '../stores/director-replay-store'

const replayStore = useDirectorReplayStore()
const progressRef = ref<HTMLElement | null>(null)

const props = defineProps<{
  hasTrace?: boolean
}>()

const speeds = [0.5, 1, 2, 3]

const emit = defineEmits<{
  (e: 'enter-replay'): void
}>()

function onProgressClick(e: MouseEvent) {
  if (progressRef.value) {
    const rect = progressRef.value.getBoundingClientRect()
    const ratio = (e.clientX - rect.left) / rect.width
    replayStore.seek(Math.floor(ratio * replayStore.totalEvents))
  }
}

function enterReplayMode() {
  emit('enter-replay')
}

function formatPayload(payload: any): string {
  if (!payload) return ''
  if (typeof payload === 'string') return payload.slice(0, 30)
  if (payload.text) return payload.text.slice(0, 30)
  if (payload.shotIndex !== undefined) return `shot ${payload.shotIndex}`
  if (payload.grammarType) return payload.grammarType
  if (payload.motionStyle) return payload.motionStyle
  return JSON.stringify(payload).slice(0, 40)
}
</script>

<style scoped>
.replay-bar {
  background: #1a0a1a;
  border: 1px solid #3a1a3a;
  border-radius: 10px;
  padding: 10px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.replay-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.replay-title {
  color: #f6f;
  font-size: 13px;
  font-weight: 600;
}

.replay-trace {
  color: #444;
  font-size: 10px;
  font-family: 'Courier New', monospace;
}

.replay-stats {
  display: flex;
  gap: 12px;
}

.stat {
  color: #888;
  font-size: 11px;
  font-family: 'Courier New', monospace;
}

.stat.progress {
  color: #f6f;
}

.replay-controls {
  display: flex;
  align-items: center;
  gap: 6px;
}

.ctrl {
  background: #222;
  color: #ccc;
  border: 1px solid #333;
  border-radius: 6px;
  width: 32px;
  height: 28px;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ctrl:hover {
  background: #333;
}

.play-btn {
  background: #3a1a3a;
  border-color: #6a2a6a;
}

.speed-control {
  display: flex;
  gap: 2px;
  margin-left: 8px;
}

.speed-btn {
  background: #1a1a1a;
  color: #666;
  border: 1px solid #2a2a2a;
  border-radius: 4px;
  padding: 2px 8px;
  font-size: 10px;
  cursor: pointer;
}

.speed-btn.active {
  background: #3a1a3a;
  color: #f6f;
  border-color: #6a2a6a;
}

.replay-progress {
  position: relative;
  height: 28px;
  cursor: pointer;
}

.progress-track {
  position: absolute;
  top: 10px;
  left: 0;
  right: 0;
  height: 6px;
  background: #2a2a2a;
  border-radius: 3px;
  overflow: visible;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #f6f, #88f);
  border-radius: 3px;
  transition: width 0.1s;
}

.progress-thumb {
  position: absolute;
  top: -4px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #f6f;
  transform: translateX(-50%);
  transition: left 0.1s;
}

.event-dots {
  position: absolute;
  top: 8px;
  left: 0;
  right: 0;
  height: 10px;
}

.event-dot {
  position: absolute;
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: #444;
  transform: translateX(-50%);
}

.event-dot.passed {
  background: #f6f;
}

.replay-event {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  background: #1a1a1a;
  border-radius: 4px;
}

.event-layer {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 3px;
  text-transform: uppercase;
}

.event-layer.shot { background: #1a3a1a; color: #6f6; }
.event-layer.grammar { background: #1a1a3a; color: #66f; }
.event-layer.motion { background: #1a3a3a; color: #6ff; }
.event-layer.character { background: #3a1a3a; color: #f6f; }
.event-layer.temporal { background: #3a3a1a; color: #ff6; }

.event-type {
  color: #aaa;
  font-size: 11px;
  font-family: 'Courier New', monospace;
}

.event-payload {
  color: #666;
  font-size: 10px;
  margin-left: auto;
}

/* 入口按钮 */
.replay-entrance {
  display: flex;
  justify-content: flex-end;
}

.enter-btn {
  background: #1a0a1a;
  color: #f6f;
  border: 1px solid #3a1a3a;
  border-radius: 6px;
  padding: 6px 16px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}

.enter-btn:hover {
  background: #2a1a2a;
  border-color: #6a2a6a;
}
</style>
