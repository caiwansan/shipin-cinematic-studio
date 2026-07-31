<!--
  @deprecated
  Reality Recovery Phase5
  Production path unused — 全仓 0 import，调用 /api/workbench/*（后端未注册，404）。
  保留：未完成未来层，勿删除。
-->
<template>
  <div class="mock-runner">
    <div class="runner-header">
      <h1>🎬 昆仑镜 · 叙事导演工作台</h1>
      <div class="step-indicator">
        <span v-for="(step, i) in flowSteps" :key="i"
          :class="['step-dot', { active: step.active, done: step.done }]">
          {{ step.label }}
        </span>
      </div>
    </div>

    <!-- ── Step 1: Story Input ── -->
    <section class="step-card" :class="{ active: currentStep === 1 }">
      <div class="step-header">
        <span class="step-num">1</span>
        <span class="step-title">故事输入</span>
      </div>
      <div class="step-body">
        <textarea
          v-model="storyInput"
          placeholder="输入你的故事...&#10;例如：一只名叫抱抱的蚂蚁每天搬运米粒。有一天暴风雨冲毁了他的家。他遇到一只受伤的蝴蝶，他们互相帮助，重建了家园。"
          :disabled="loading"
          rows="4"
          class="story-textarea"
        />
        <button
          class="btn-primary"
          :disabled="!storyInput.trim() || loading"
          @click="handleGenerate"
        >
          {{ loading ? '导演分析中...' : '🎬 生成导演方案' }}
        </button>
      </div>
    </section>

    <!-- ── Step 2: Director Output ── -->
    <section class="step-card" :class="{ active: currentStep === 2 }" v-if="directorResult">
      <div class="step-header">
        <span class="step-num">2</span>
        <span class="step-title">叙事结构</span>
        <span class="step-id">trace: {{ traceId }}</span>
      </div>
      <div class="step-body">
        <!-- Scenes overview -->
        <div class="scene-bar">
          <div v-for="(scene, i) in directorResult.scenes" :key="i"
            class="scene-chip" :style="{ background: emotionColor(scene.emotion) }">
            <span class="scene-label">{{ scene.label }}</span>
            <span class="scene-emotion">{{ scene.emotion }}</span>
          </div>
        </div>

        <!-- Causal graph visualization (simple) -->
        <div class="graph-viz">
          <div v-for="(edge, i) in directorResult.causalEdges" :key="i" class="edge-row">
            <span class="edge-from">{{ edge.from }}</span>
            <span class="edge-arrow">→</span>
            <span class="edge-to">{{ edge.to }}</span>
          </div>
        </div>

        <details>
          <summary>📄 DirectorPlan JSON</summary>
          <pre>{{ JSON.stringify(directorResult.plan, null, 2) }}</pre>
        </details>

        <button class="btn-primary" :disabled="loading" @click="handleCompile">
          {{ loading ? '编译中...' : '📋 生成分镜' }}
        </button>
      </div>
    </section>

    <!-- ── Step 3: Blueprint Preview ── -->
    <section class="step-card" :class="{ active: currentStep === 3 }" v-if="blueprintResult">
      <div class="step-header">
        <span class="step-num">3</span>
        <span class="step-title">分镜预览</span>
      </div>
      <div class="step-body">
        <!-- Shot timeline -->
        <div class="shot-timeline">
          <div v-for="(shot, i) in blueprintResult.shots" :key="i" class="shot-card">
            <div class="shot-badge">Shot {{ i + 1 }}</div>
            <div class="shot-info">
              <span class="shot-label">{{ shot.label }}</span>
              <div class="shot-tags">
                <span class="tag camera">{{ shot.camera }}</span>
                <span class="tag movement">{{ shot.movement }}</span>
                <span class="tag subject">{{ shot.subject }}</span>
              </div>
            </div>
          </div>
        </div>

        <details>
          <summary>📄 VideoBlueprint JSON</summary>
          <pre>{{ JSON.stringify(blueprintResult.raw, null, 2) }}</pre>
        </details>

        <button class="btn-primary" :disabled="loading" @click="handleRender">
          {{ loading ? '渲染中...' : '🎥 生成视频' }}
        </button>
      </div>
    </section>

    <!-- ── Step 4: Render Result ── -->
    <section class="step-card" :class="{ active: currentStep === 4 }" v-if="renderResult">
      <div class="step-header">
        <span class="step-num">4</span>
        <span class="step-title">生成结果</span>
      </div>
      <div class="step-body">
        <div class="render-status" :class="renderResult.status">
          <div class="status-icon">
            {{ renderResult.status === 'completed' ? '✅' : renderResult.status === 'running' ? '⏳' : '❌' }}
          </div>
          <div class="status-text">
            <strong>{{ renderResult.statusText }}</strong>
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: renderResult.progress + '%' }"></div>
            </div>
          </div>
        </div>

        <div v-if="renderResult.videoUrl" class="video-preview">
          <a :href="renderResult.videoUrl" target="_blank" class="video-link">
            🎬 查看视频 → {{ renderResult.videoUrl }}
          </a>
        </div>

        <details v-if="renderResult.job">
          <summary>📄 Job 详情</summary>
          <pre>{{ JSON.stringify(renderResult.job, null, 2) }}</pre>
        </details>

        <div class="action-row">
          <button class="btn-secondary" @click="reset">🔄 重新开始</button>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'

// ── State ──
const storyInput = ref('')
const loading = ref(false)
const traceId = ref('')
const currentStep = ref(1)
const directorResult = ref<any>(null)
const blueprintResult = ref<any>(null)
const renderResult = ref<any>(null)

const flowSteps = reactive([
  { label: '故事', active: true, done: false },
  { label: '叙事', active: false, done: false },
  { label: '分镜', active: false, done: false },
  { label: '成片', active: false, done: false },
])

// ── Colors ──
function emotionColor(emotion: string): string {
  const map: Record<string, string> = {
    '平静': '#4a90d9',
    '波动': '#f5a623',
    '转折': '#d0021b',
    '高潮': '#e74c3c',
    '收束': '#7ed321',
    'happy': '#7ed321',
    'sad': '#4a90d9',
    'tense': '#d0021b',
    'neutral': '#9b9b9b',
  }
  return map[emotion] || '#9b9b9b'
}

// ── Actions ──
async function handleGenerate() {
  if (!storyInput.value.trim()) return
  loading.value = true

  try {
    const res = await $fetch('/api/workbench/generate-director', {
      method: 'POST',
      body: { story: storyInput.value },
    })

    traceId.value = res.traceId
    const plan = res.directorPlan
    const graph = res.narrativeGraph

    directorResult.value = {
      plan,
      scenes: plan.sceneSegmentation.map((s: any, i: number) => ({
        id: s.id,
        label: s.narrativePurpose || `Scene ${i + 1}`,
        emotion: s.emotionalTone || 'neutral',
      })),
      causalEdges: graph.edges?.map((e: any) => ({
        from: graph.nodes.find((n: any) => n.id === e.sourceId)?.label || e.sourceId,
        to: graph.nodes.find((n: any) => n.id === e.targetId)?.label || e.targetId,
      })) || plan.narrativeLogic?.causeEffectGraph?.map((c: string) => ({
        from: c.split('→')[0]?.trim() || '',
        to: c.split('→')[1]?.trim() || '',
      })) || [],
    }

    currentStep.value = 2
    flowSteps[0].done = true
    flowSteps[1].active = true
  } catch (e: any) {
    alert('生成失败: ' + (e.message || '未知错误'))
  } finally {
    loading.value = false
  }
}

async function handleCompile() {
  if (!directorResult.value) return
  loading.value = true

  try {
    const res = await $fetch('/api/workbench/compile-blueprint', {
      method: 'POST',
      body: {
        directorPlan: directorResult.value.plan,
        narrativeGraph: directorResult.value.plan.narrativeGraph,
      },
    })

    const bp = res.blueprint
    const shots = bp.shotGraph?.shots || []

    blueprintResult.value = {
      raw: bp,
      shots: shots.map((s: any) => ({
        id: s.id,
        label: s.intent || s.id,
        camera: s.cameraAngle || s.camera || 'medium',
        movement: s.movement || s.cameraMovement || 'static',
        subject: s.subject || 'general',
        lighting: s.lighting || 'natural',
      })),
    }

    currentStep.value = 3
    flowSteps[1].done = true
    flowSteps[2].active = true
  } catch (e: any) {
    alert('编译失败: ' + (e.message || '未知错误'))
  } finally {
    loading.value = false
  }
}

async function handleRender() {
  if (!blueprintResult.value) return
  loading.value = true

  try {
    const res = await $fetch('/api/workbench/render', {
      method: 'POST',
      body: { blueprint: blueprintResult.value.raw },
    })

    // Poll for completion
    const jobId = res.jobId
    const poll = async () => {
      for (let i = 0; i < 10; i++) {
        await new Promise(r => setTimeout(r, 1000))
        const statusRes = await $fetch(`/api/workbench/jobs/${jobId}`)
        if (statusRes.status === 'completed') {
          renderResult.value = {
            status: 'completed',
            statusText: '视频生成完成！',
            progress: 100,
            videoUrl: statusRes.output?.videoUrl,
            job: statusRes,
          }
          currentStep.value = 4
          flowSteps[2].done = true
          flowSteps[3].active = true
          loading.value = false
          return
        } else if (statusRes.status === 'failed') {
          renderResult.value = {
            status: 'failed',
            statusText: '生成失败',
            progress: statusRes.progress || 0,
            job: statusRes,
          }
          currentStep.value = 4
          loading.value = false
          return
        } else {
          renderResult.value = {
            status: 'running',
            statusText: '渲染中...',
            progress: statusRes.progress || 30,
          }
        }
      }
      loading.value = false
    }

    poll()
  } catch (e: any) {
    alert('渲染失败: ' + (e.message || '未知错误'))
    loading.value = false
  }
}

function reset() {
  storyInput.value = ''
  directorResult.value = null
  blueprintResult.value = null
  renderResult.value = null
  traceId.value = ''
  currentStep.value = 1
  flowSteps.forEach((s, i) => {
    s.active = i === 0
    s.done = false
  })
}
</script>

<style scoped>
.mock-runner {
  max-width: 800px;
  margin: 0 auto;
  padding: 24px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  color: #e0e0e0;
  background: #1a1a2e;
  min-height: 100vh;
}

.runner-header h1 {
  font-size: 1.5rem;
  margin-bottom: 16px;
  color: #f0f0f0;
  text-align: center;
}

.step-indicator {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-bottom: 24px;
}

.step-dot {
  padding: 6px 16px;
  border-radius: 20px;
  background: #2a2a3e;
  font-size: 0.85rem;
  color: #888;
  transition: all 0.3s;
}

.step-dot.active {
  background: #4a6cf7;
  color: white;
}

.step-dot.done {
  background: #2ecc71;
  color: white;
}

/* Step Card */
.step-card {
  background: #222240;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 16px;
  border: 1px solid #333;
  opacity: 0.7;
  transition: all 0.3s;
}

.step-card.active {
  opacity: 1;
  border-color: #4a6cf7;
  box-shadow: 0 0 20px rgba(74, 108, 247, 0.1);
}

.step-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.step-num {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #4a6cf7;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 0.85rem;
}

.step-title {
  font-size: 1.1rem;
  font-weight: 600;
}

.step-id {
  margin-left: auto;
  font-size: 0.75rem;
  color: #666;
  font-family: monospace;
}

.step-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Input */
.story-textarea {
  width: 100%;
  padding: 12px;
  border-radius: 8px;
  border: 1px solid #444;
  background: #1a1a2e;
  color: #e0e0e0;
  font-size: 0.95rem;
  resize: vertical;
  box-sizing: border-box;
}

.story-textarea:focus {
  outline: none;
  border-color: #4a6cf7;
}

/* Buttons */
.btn-primary {
  padding: 10px 24px;
  border: none;
  border-radius: 8px;
  background: #4a6cf7;
  color: white;
  font-size: 0.95rem;
  cursor: pointer;
  transition: background 0.2s;
  align-self: flex-start;
}

.btn-primary:disabled {
  background: #555;
  cursor: not-allowed;
}

.btn-primary:hover:not(:disabled) {
  background: #5a7cf7;
}

.btn-secondary {
  padding: 10px 24px;
  border: 1px solid #555;
  border-radius: 8px;
  background: transparent;
  color: #ccc;
  font-size: 0.95rem;
  cursor: pointer;
}

/* Scene Bar */
.scene-bar {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.scene-chip {
  padding: 8px 16px;
  border-radius: 8px;
  color: white;
  font-size: 0.85rem;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.scene-label {
  font-weight: 600;
}

.scene-emotion {
  font-size: 0.75rem;
  opacity: 0.9;
}

/* Causal Graph */
.graph-viz {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  align-items: center;
}

.edge-row {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #2a2a40;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 0.85rem;
}

.edge-arrow {
  color: #4a6cf7;
}

/* Shot Timeline */
.shot-timeline {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.shot-card {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  background: #2a2a40;
  padding: 10px 14px;
  border-radius: 8px;
}

.shot-badge {
  background: #4a6cf7;
  color: white;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
}

.shot-info {
  flex: 1;
}

.shot-label {
  display: block;
  font-size: 0.9rem;
  margin-bottom: 4px;
}

.shot-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.tag {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
  background: #333;
}

.tag.camera { background: #2c3e50; color: #3498db; }
.tag.movement { background: #3d2a1a; color: #e67e22; }
.tag.subject { background: #1a3d2a; color: #2ecc71; }

/* Render Status */
.render-status {
  display: flex;
  gap: 16px;
  align-items: center;
  padding: 16px;
  background: #2a2a40;
  border-radius: 8px;
}

.status-icon {
  font-size: 2rem;
}

.progress-bar {
  width: 200px;
  height: 6px;
  background: #333;
  border-radius: 3px;
  margin-top: 4px;
}

.progress-fill {
  height: 100%;
  background: #4a6cf7;
  border-radius: 3px;
  transition: width 0.5s;
}

.video-link {
  display: block;
  padding: 12px;
  background: #2a2a40;
  border-radius: 8px;
  color: #4a6cf7;
  text-decoration: none;
  text-align: center;
  font-weight: 600;
}

.video-link:hover {
  background: #333;
}

details {
  background: #1a1a2e;
  border-radius: 6px;
  padding: 8px 12px;
}

details summary {
  cursor: pointer;
  color: #888;
  font-size: 0.85rem;
}

pre {
  font-size: 0.75rem;
  max-height: 300px;
  overflow: auto;
  background: #111;
  padding: 12px;
  border-radius: 4px;
  margin-top: 8px;
}

.action-row {
  display: flex;
  gap: 12px;
}
</style>
