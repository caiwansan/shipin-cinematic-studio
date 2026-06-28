<!--
ControlInspector.vue
导演驾驶舱 — 右侧控制面板（五支柱状态+属性编辑）
-->

<template>
  <div class="control-inspector" v-if="store.currentShot">
    <div class="inspector-header">
      <span class="inspector-title">🎛 镜头属性</span>
      <span class="inspector-sub">Shot {{ store.state.currentShotIndex + 1 }} / {{ store.totalShots }}</span>
    </div>

    <div class="inspector-body">
      <!-- 镜头信息 -->
      <div class="section">
        <div class="section-title">📝 描述</div>
        <div class="desc-text">{{ store.currentShot.description }}</div>
      </div>

      <!-- 五支柱状态 -->
      <div class="section">
        <div class="section-title">🧩 Cinematic Stack 状态</div>

        <div class="pillar" v-for="p in pillars" :key="p.name">
          <div class="pillar-header">
            <span class="pillar-icon">{{ p.icon }}</span>
            <span class="pillar-name">{{ p.name }}</span>
            <span class="pillar-value">{{ p.value }}</span>
          </div>
          <div class="pillar-bar">
            <div
              class="pillar-fill"
              :style="{ width: p.percent + '%', background: p.color }"
            />
          </div>
        </div>
      </div>

      <!-- Motion Intent -->
      <div class="section" v-if="store.currentShot.motionPressure > 0">
        <div class="section-title">🌊 运动意图向量</div>
        <div class="intent-grid">
          <div class="intent-item">
            <span class="intent-label">压迫</span>
            <span class="intent-val" :class="intentClass(store.currentShot.motionPressure)">{{ (store.currentShot.motionPressure * 100).toFixed(0) }}</span>
          </div>
          <div class="intent-item">
            <span class="intent-label">亲密</span>
            <span class="intent-val">{{ (store.currentShot.motionInstability * 100).toFixed(0) }}</span>
          </div>
          <div class="intent-item">
            <span class="intent-label">不稳定</span>
            <span class="intent-val" :class="instabilityClass(store.currentShot.motionInstability)">{{ (store.currentShot.motionInstability * 100).toFixed(0) }}</span>
          </div>
          <div class="intent-item">
            <span class="intent-label">能量流</span>
            <span class="intent-val" :class="flowClass(store.currentShot.motionEnergyFlow)">{{ store.currentShot.motionEnergyFlow.toFixed(2) }}</span>
          </div>
        </div>
      </div>

      <!-- 运动指令 -->
      <div class="section" v-if="store.currentShot.motionDirective">
        <div class="section-title">🏃 运动指令</div>
        <div class="motion-dir">{{ store.currentShot.motionDirective }}</div>
      </div>

      <!-- 时长调节 -->
      <div class="section">
        <div class="section-title">⏱ 时长</div>
        <div class="duration-control">
          <input
            type="range"
            min="0.5"
            max="10"
            step="0.5"
            :value="store.currentShot.duration"
            @input="onDurationChange"
          />
          <span class="duration-val">{{ store.currentShot.duration.toFixed(1) }}s</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useDirectorRuntimeStore } from '../stores/director-runtime-store'
import { useTimelineEngine } from '../composables/useTimelineEngine'

const store = useDirectorRuntimeStore()
const engine = useTimelineEngine()

const pillars = computed(() => {
  const shot = store.currentShot
  if (!shot) return []

  return [
    { icon: '🎬', name: 'Shot', value: shot.grammarType, percent: 80, color: '#6f6' },
    { icon: '🧩', name: 'Grammar', value: shot.grammarType, percent: 70, color: '#88f' },
    { icon: '⏱', name: 'Temporal', value: (shot.temporalContinuity * 100).toFixed(0) + '%', percent: shot.temporalContinuity * 100, color: '#ff6' },
    { icon: '🎭', name: 'Character', value: shot.characterStable ? '✅ 稳定' : '⚠️ 漂移', percent: (1 - shot.characterDrift) * 100, color: '#f6f' },
    { icon: '🏃', name: 'Motion', value: shot.motionStyle, percent: 60, color: '#6ff' },
  ]
})

function intentClass(v: number): string {
  return v > 0.6 ? 'high' : v > 0.3 ? 'mid' : ''
}

function instabilityClass(v: number): string {
  return v > 0.5 ? 'high' : ''
}

function flowClass(v: number): string {
  return v > 0.3 ? 'pos' : v < -0.3 ? 'neg' : ''
}

function onDurationChange(e: Event) {
  const val = parseFloat((e.target as HTMLInputElement).value)
  store.updateShotDuration(store.state.currentShotIndex, val)
}
</script>

<style scoped>
.control-inspector {
  background: #111;
  border-radius: 12px;
  padding: 16px;
  border: 1px solid #222;
  min-width: 220px;
}

.inspector-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 10px;
  border-bottom: 1px solid #222;
}

.inspector-title {
  color: #fff;
  font-size: 14px;
  font-weight: 600;
}

.inspector-sub {
  color: #666;
  font-size: 11px;
}

.section {
  margin-bottom: 14px;
}

.section-title {
  color: #888;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  margin-bottom: 6px;
}

.desc-text {
  color: #ccc;
  font-size: 13px;
  line-height: 1.4;
}

.pillar {
  margin-bottom: 8px;
}

.pillar-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 3px;
}

.pillar-icon {
  width: 16px;
  text-align: center;
}

.pillar-name {
  color: #aaa;
  font-size: 12px;
  flex: 1;
}

.pillar-value {
  color: #888;
  font-size: 10px;
  font-family: 'Courier New', monospace;
}

.pillar-bar {
  height: 4px;
  background: #222;
  border-radius: 2px;
  overflow: hidden;
}

.pillar-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.3s;
}

.intent-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.intent-item {
  background: #1a1a1a;
  border-radius: 6px;
  padding: 6px 8px;
  display: flex;
  justify-content: space-between;
}

.intent-label {
  color: #666;
  font-size: 11px;
}

.intent-val {
  color: #aaa;
  font-size: 11px;
  font-family: 'Courier New', monospace;
  font-weight: 600;
}

.intent-val.high { color: #f66; }
.intent-val.mid { color: #f90; }
.intent-val.pos { color: #6f6; }
.intent-val.neg { color: #f66; }

.motion-dir {
  background: #1a1a1a;
  border-radius: 6px;
  padding: 8px;
  color: #8cf;
  font-size: 12px;
  font-family: 'Courier New', monospace;
}

.duration-control {
  display: flex;
  align-items: center;
  gap: 8px;
}

.duration-control input {
  flex: 1;
  -webkit-appearance: none;
  height: 4px;
  border-radius: 2px;
  background: #333;
  outline: none;
}

.duration-control input::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #8080ff;
  cursor: pointer;
}

.duration-val {
  color: #ccc;
  font-size: 12px;
  min-width: 30px;
}
</style>
