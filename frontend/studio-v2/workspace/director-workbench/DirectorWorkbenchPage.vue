<!--
DirectorWorkbenchPage.vue
昆仑镜导演驾驶舱 — 完整工作台页面

七层结构：
  Canvas Stage × Timeline × Shot Graph × Motion Overlay × Emotion Arc × Control Inspector × Runtime Binding
-->

<template>
  <div class="director-workbench">
    <div class="wb-header">
      <div class="wb-title">
        <span class="wb-logo">🎬</span>
        <span>导演驾驶舱</span>
        <span class="wb-version">Cinematic Director OS v1</span>
      </div>
      <div class="wb-actions">
        <div v-if="state === 'idle'" class="input-area">
          <textarea
            v-model="inputText"
            placeholder="输入镜头描述，每行一个镜头&#10;例如：&#10;俯瞰城市夜景，霓虹灯闪烁&#10;男人快步走进酒吧，眼神警惕&#10;男人在吧台前坐下，神情紧张"
            rows="3"
            class="shot-input"
          />
          <button @click="onAnalyze" :disabled="analyzing || !inputText.trim()" class="analyze-btn">
            {{ analyzing ? '分析中...' : '🚀 导演分析' }}
          </button>
        </div>
        <div v-else class="status-bar">
          <span class="status-ok" v-if="state === 'ready'">✅ 五支柱分析完成</span>
          <span class="status-err" v-if="state === 'error'">❌ 分析出错</span>
          <button @click="onReset" class="reset-btn">↺ 重置</button>
        </div>
      </div>
    </div>

    <div class="wb-panels" v-if="store.state.timeline.length > 0">
      <!-- 左侧：画布 + 时间线 -->
      <div class="panel-left">
        <ReplayBar />
        <CanvasStage />
        <TimelineTrack />
        <ShotGraphView />
        <EmotionArcLayer />
        <MotionOverlayLayer />
      </div>

      <!-- 右侧：控制面板 -->
      <div class="panel-right">
        <ControlInspector />
      </div>
    </div>

    <!-- 空状态引导 -->
    <div class="wb-empty" v-else-if="state !== 'loading'">
      <div class="empty-icon">🎬</div>
      <div class="empty-title">导演驾驶舱</div>
      <div class="empty-desc">
        输入一组镜头描述，系统将自动完成五支柱分析：<br />
        🎬 单镜头电影感 → ⏱ 时间连续性 → 🎭 角色一致性 → 🧩 镜头语法 → 🏃 运动规划
      </div>
    </div>

    <!-- 加载状态 -->
    <div class="wb-loading" v-if="analyzing">
      <div class="loading-spinner" />
      <div class="loading-text">导演系统正在分析...</div>
      <div class="loading-steps">
        <div class="step" :class="{ done: step >= 1 }">🎬 Cinematic Compiler</div>
        <div class="step" :class="{ done: step >= 2 }">⏱ Temporal Engine</div>
        <div class="step" :class="{ done: step >= 3 }">🧩 Grammar System</div>
        <div class="step" :class="{ done: step >= 4 }">🏃 Motion Planner</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useDirectorRuntimeStore } from './stores/director-runtime-store'
import { useRuntimeBinding } from './composables/useRuntimeBinding'
import CanvasStage from './components/CanvasStage.vue'
import TimelineTrack from './components/TimelineTrack.vue'
import ShotGraphView from './components/ShotGraphView.vue'
import EmotionArcLayer from './components/EmotionArcLayer.vue'
import MotionOverlayLayer from './components/MotionOverlayLayer.vue'
import ControlInspector from './components/ControlInspector.vue'
import ReplayBar from './components/ReplayBar.vue'

const store = useDirectorRuntimeStore()
const { analyzeShots } = useRuntimeBinding()

const inputText = ref('')
const analyzing = ref(false)
const step = ref(0)
const state = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')

async function onAnalyze() {
  const lines = inputText.value
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)

  if (lines.length < 2) return

  analyzing.value = true
  state.value = 'loading'
  store.reset()

  try {
    // 模拟步骤进度
    step.value = 1
    await delay(300)

    const result = await analyzeShots(lines)
    
    step.value = 4
    await delay(200)

    state.value = 'ready'
  } catch (e) {
    console.error('导演分析失败:', e)
    state.value = 'error'
  } finally {
    analyzing.value = false
  }
}

function onReset() {
  store.reset()
  inputText.value = ''
  state.value = 'idle'
  step.value = 0
}

function delay(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}
</script>

<style scoped>
.director-workbench {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
  min-height: 100vh;
  background: #0a0a0a;
  color: #ddd;
}

.wb-header {
  margin-bottom: 24px;
}

.wb-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 20px;
  font-weight: 700;
  color: #fff;
  margin-bottom: 16px;
}

.wb-logo {
  font-size: 24px;
}

.wb-version {
  color: #555;
  font-size: 11px;
  font-family: 'Courier New', monospace;
  background: #1a1a1a;
  padding: 2px 8px;
  border-radius: 4px;
}

.wb-actions {
  display: flex;
  gap: 8px;
}

.input-area {
  display: flex;
  gap: 8px;
  width: 100%;
}

.shot-input {
  flex: 1;
  background: #1a1a1a;
  border: 1px solid #333;
  border-radius: 8px;
  color: #ddd;
  font-size: 13px;
  padding: 10px;
  resize: vertical;
  min-height: 60px;
  font-family: inherit;
}

.shot-input:focus {
  outline: none;
  border-color: #8080ff;
}

.shot-input::placeholder {
  color: #555;
}

.analyze-btn {
  background: #8080ff;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 10px 24px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s;
}

.analyze-btn:hover:not(:disabled) {
  background: #6a6aff;
}

.analyze-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.status-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.status-ok {
  color: #6f6;
  font-size: 13px;
}

.status-err {
  color: #f66;
  font-size: 13px;
}

.reset-btn {
  background: #222;
  color: #aaa;
  border: 1px solid #333;
  border-radius: 6px;
  padding: 6px 16px;
  font-size: 12px;
  cursor: pointer;
}

.reset-btn:hover {
  background: #333;
  color: #fff;
}

.wb-panels {
  display: flex;
  gap: 16px;
}

.panel-left {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.panel-right {
  width: 260px;
  flex-shrink: 0;
}

.wb-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  text-align: center;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.empty-title {
  color: #fff;
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 12px;
}

.empty-desc {
  color: #666;
  font-size: 14px;
  line-height: 1.8;
}

.wb-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60px;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #222;
  border-top: 3px solid #8080ff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-text {
  color: #888;
  font-size: 14px;
  margin-bottom: 20px;
}

.loading-steps {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.step {
  color: #444;
  font-size: 13px;
  opacity: 0.5;
  transition: all 0.3s;
}

.step.done {
  color: #6f6;
  opacity: 1;
}
</style>
