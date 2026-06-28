<template>
  <div>
    <ClientOnly>
      <div class="workbench" v-if="ready">
        <!-- 顶栏 -->
        <header class="top-bar">
          <div class="top-bar-left">
            <h1 class="wb-title">🎬 导演工作台</h1>
            <span v-if="store.sessionKey" class="session-badge">{{ store.sessionKey.slice(0, 20) }}…</span>
          </div>
          <div class="top-bar-right">
            <span v-if="pending" class="loading-badge">⏳ 处理中</span>
            <span v-if="error" class="error-badge">⚠ {{ error }}</span>
          </div>
        </header>

        <div class="main-grid">
          <div class="panel-left">
            <div class="panel-header"><h2>🎬 Scene Graph</h2></div>
            <div class="scene-list" v-if="store.scenes.length">
              <div v-for="(sc, i) in store.scenes" :key="sc.id" class="scene-card"
                :class="{ active: sc.id === store.runtimeState?.currentSceneId }">
                <span class="scene-index">{{ i + 1 }}</span>
                <div class="scene-info">
                  <span class="scene-type">{{ sc.type }}</span>
                  <span class="scene-desc">{{ sc.description }}</span>
                </div>
              </div>
            </div>
            <div v-else class="template-list">
              <button v-for="tpl in templates" :key="tpl.name" class="template-card" @click="loadTemplate(tpl)">
                <span class="tpl-icon">{{ tpl.icon }}</span>
                <span class="tpl-name">{{ tpl.name }}</span>
              </button>
            </div>
          </div>

          <div class="panel-center">
            <div class="panel-header"><h2>🎞 Runtime</h2></div>
            <div v-if="store.runtimeState" class="runtime-card">
              <div class="stat-row"><span>场景</span><strong>{{ store.runtimeState.currentSceneId || '—' }}</strong></div>
              <div class="stat-row"><span>镜头</span><strong>{{ (store.runtimeState.currentShotIndex || 0) + 1 }}</strong></div>
              <div class="stat-row"><span>强度</span><strong>{{ ((store.runtimeState.intensity || 0) * 100).toFixed(0) }}%</strong></div>
              <div class="stat-row"><span>进度</span><strong>{{ store.runtimeState.completedScenes }}/{{ store.runtimeState.totalScenes }}</strong></div>
            </div>
            <div v-else class="panel-empty">启动运行查看状态</div>

            <div v-if="identityKeys.length && identityData" class="identity-mini-panel">
              <div class="mini-title">🧬 身份漂移</div>
              <div v-for="dim in identityKeys" :key="dim" class="id-row">
                <span class="id-label">{{ dim.slice(0, 4) }}</span>
                <div class="id-bar"><div class="id-fill" :style="{ width: ((identityData[dim] || 0.5) * 100).toFixed(0) + '%' }"></div></div>
                <span class="id-val">{{ ((identityData[dim] || 0.5) * 100).toFixed(0) }}</span>
              </div>
            </div>
          </div>

          <div class="panel-right">
            <div class="panel-header"><h2>🔍 Inspector</h2></div>
            <div v-if="memoryLog.length" class="memory-log">
              <div v-for="(m, i) in memoryLog.slice(-5)" :key="i" class="log-entry">{{ m }}</div>
            </div>
            <div v-else class="panel-empty">暂无数据</div>
          </div>
        </div>

        <!-- 控制台 -->
        <div class="control-bar">
          <button class="ctrl-btn primary" @click="runStory" :disabled="running">▶ 运行</button>
          <button class="ctrl-btn" @click="handleTick" :disabled="!running">⏭ 单步</button>
          <button class="ctrl-btn" @click="startAuto" :disabled="!running || autoOn">▶ 自动</button>
          <button class="ctrl-btn" @click="stopAuto" :disabled="!autoOn">⏹</button>
          <button class="ctrl-btn" @click="handleExport" :disabled="!running">📤 导出</button>
          <button class="ctrl-btn danger" @click="handleReset">⏮ 重置</button>
          <span v-if="sseConnected" class="sse-badge on">SSE ●</span>
          <span v-else class="sse-badge">SSE ○</span>
        </div>
      </div>
      <template #fallback>
        <div class="ssr-loading">🎥 加载导演工作台...</div>
      </template>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted } from 'vue'

// ─── 状态（全部在客户端初始化） ─────────────────
const ready = ref(false)
const pending = ref(false)
const error = ref<string | null>(null)

const store = reactive({
  sessionKey: null as string | null,
  scenes: [] as any[],
  runtimeState: null as any,
  identity: {} as Record<string, any>,
  memory: null as any,
  adaptiveDecisions: [] as any[],
})

const identityKeys = ['courage', 'fear', 'curiosity', 'aggression', 'stability', 'attention']
const identityData = ref<Record<string, number> | null>(null)
const memoryLog = ref<string[]>([])
const running = ref(false)
const autoOn = ref(false)
const sseConnected = ref(false)
const exportData = ref<any>(null)

let sseSource: EventSource | null = null
let autoTimer: ReturnType<typeof setInterval> | null = null

// ─── 模板 ────────────────────────────────────────
const templates = [
  { name: '英雄之旅', icon: '⚔️', scenes: [
    { id: 's1', type: 'intro', description: '平静的村庄', shotGraph: { subject: [{ name: '英雄' }], action: '准备出发', camera: { shot_type: 'wide' }, spatialFrame: '村庄' } },
    { id: 's2', type: 'conflict', description: '黑暗森林的遭遇', shotGraph: { subject: [{ name: '英雄' }, { name: '怪物' }], action: '战斗', camera: { shot_type: 'close-up' }, spatialFrame: '森林' }, relations: { causedBy: 's1' } },
    { id: 's3', type: 'resolution', description: '带着宝藏归来', shotGraph: { subject: [{ name: '英雄' }], action: '凯旋', camera: { shot_type: 'medium' }, spatialFrame: '村庄' }, relations: { resolves: 's2' } },
  ], title: '英雄之旅' },
  { name: '悬疑短剧', icon: '🔍', scenes: [
    { id: 's1', type: 'intro', description: '案发现场', shotGraph: { subject: [{ name: '侦探' }], action: '勘察', camera: { shot_type: 'medium' }, spatialFrame: '房间' } },
    { id: 's2', type: 'conflict', description: '审讯嫌疑人', shotGraph: { subject: [{ name: '侦探' }, { name: '嫌疑人' }], action: '对质', camera: { shot_type: 'close-up' }, spatialFrame: '审讯室' }, relations: { causedBy: 's1' } },
    { id: 's3', type: 'climax', description: '发现隐藏线索', shotGraph: { subject: [{ name: '侦探' }], action: '搜索', camera: { shot_type: 'dolly' }, spatialFrame: '地下室' }, relations: { causedBy: 's2' } },
    { id: 's4', type: 'resolution', description: '真相大白', shotGraph: { subject: [{ name: '侦探' }, { name: '嫌疑人' }], action: '揭露', camera: { shot_type: 'over-the-shoulder' }, spatialFrame: '审讯室' }, relations: { resolves: 's3' } },
  ], title: '悬疑短剧' },
  { name: '情感故事', icon: '💔', scenes: [
    { id: 's1', type: 'intro', description: '初次相遇', shotGraph: { subject: [{ name: '她' }, { name: '他' }], action: '邂逅', camera: { shot_type: 'medium' }, spatialFrame: '咖啡馆' } },
    { id: 's2', type: 'conflict', description: '无奈分离', shotGraph: { subject: [{ name: '她' }], action: '告别', camera: { shot_type: 'close-up' }, spatialFrame: '车站' }, relations: { causedBy: 's1' } },
    { id: 's3', type: 'resolution', description: '多年重逢', shotGraph: { subject: [{ name: '她' }, { name: '他' }], action: '相视一笑', camera: { shot_type: 'wide' }, spatialFrame: '旧地' }, relations: { resolves: 's2' } },
  ], title: '情感故事' },
]

// ─── API ────────────────────────────────────────
const API = '/api/director'

async function apiPost(path: string, body: any) {
  pending.value = true; error.value = null
  try {
    const res = await fetch(`${API}${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await res.json()
    if (!json.success) { error.value = json.error?.message || 'API error'; return null }
    return json.data
  } catch (e: any) { error.value = e.message; return null }
  finally { pending.value = false }
}

function connectSSE(sk: string) {
  if (sseSource) sseSource.close()
  sseSource = new EventSource(`/api/director/runtime/stream/${sk}`)
  sseSource.onopen = () => { sseConnected.value = true }
  sseSource.onerror = () => { sseConnected.value = false }
  sseSource.addEventListener('tick', (e: any) => {
    try { const d = JSON.parse(e.data); store.runtimeState = d.runtimeState; memoryLog.value.push(`tick: ${d.runtimeState?.playbackTime?.toFixed(1)}s`) } catch {}
  })
  sseSource.addEventListener('identity', (e: any) => {
    try { store.identity = JSON.parse(e.data); updateIdentityDisplay() } catch {}
  })
}

function disconnectSSE() { if (sseSource) { sseSource.close(); sseSource = null; sseConnected.value = false } }

function updateIdentityDisplay() {
  const chars = Object.keys(store.identity)
  if (!chars.length) return
  const charData = store.identity[chars[0]]
  if (!charData) return
  const dims: Record<string, number> = {}
  for (const k of identityKeys) dims[k] = charData[k] ?? 0.5
  identityData.value = dims
}

// ─── Actions ────────────────────────────────────
function loadTemplate(tpl: typeof templates[0]) {
  store.scenes = JSON.parse(JSON.stringify(tpl.scenes))
}

async function runStory() {
  const scenes = store.scenes.length ? store.scenes : templates[0].scenes
  const data = await apiPost('/runtime/start', { storyGraph: { title: '故事', scenes } })
  if (!data) return
  store.sessionKey = data.sessionKey
  store.runtimeState = data.state?.runtimeState || null
  store.identity = {}
  store.memoryLog = []
  running.value = true
  exportData.value = null
  connectSSE(data.sessionKey)
}

async function handleTick() {
  if (!store.sessionKey) return
  const data = await apiPost('/runtime/tick', { sessionKey: store.sessionKey, deltaTime: 1.0 })
  if (data) {
    store.runtimeState = data.state?.runtimeState || null
    memoryLog.value.push(`tick: ${data.state?.runtimeState?.playbackTime?.toFixed(1)}s`)
  }
}

function startAuto() { if (autoTimer) return; autoOn.value = true; autoTimer = setInterval(handleTick, 1500) }
function stopAuto() { if (autoTimer) { clearInterval(autoTimer); autoTimer = null; autoOn.value = false } }

async function handleExport() {
  if (!store.sessionKey) return
  const data = await apiPost('/export', { sessionKey: store.sessionKey })
  if (data) {
    exportData.value = data.projection
    memoryLog.value.push('📤 export done')
  }
}

async function handleReset() {
  stopAuto(); disconnectSSE()
  if (store.sessionKey) { await apiPost('/runtime/stop', { sessionKey: store.sessionKey }) }
  store.sessionKey = null; store.runtimeState = null; store.identity = {}; identityData.value = null
  running.value = false; memoryLog.value = []; error.value = null
}

onMounted(() => {
  ready.value = true
  store.scenes = JSON.parse(JSON.stringify(templates[0].scenes))
})

onUnmounted(() => { disconnectSSE(); if (autoTimer) clearInterval(autoTimer) })
</script>

<style scoped>
.ssr-loading { padding: 40px; text-align: center; color: #666; font-size: 1.2rem; }
.workbench { min-height: 100vh; background: #0a0a0f; color: #e0e0e0; display: flex; flex-direction: column; padding: 16px; gap: 12px; font-family: inherit; }
.top-bar { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: #0f0f18; border: 1px solid #1e1e2e; border-radius: 10px; }
.top-bar-left { display: flex; align-items: center; gap: 12px; }
.wb-title { font-size: 1rem; font-weight: 600; margin: 0; color: #a0a0b0; }
.loading-badge { padding: 2px 8px; border-radius: 4px; background: #312e81; color: #a5b4fc; font-size: 0.7rem; }
.error-badge { padding: 2px 8px; border-radius: 4px; background: #7f1d1d; color: #fca5a5; font-size: 0.7rem; }

.main-grid { display: grid; grid-template-columns: 220px 1fr 240px; gap: 12px; flex: 1; }
.main-grid > * { min-height: 400px; max-height: calc(100vh - 140px); overflow-y: auto; }

.panel-left, .panel-center, .panel-right { background: #12121a; border: 1px solid #1e1e2e; border-radius: 10px; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
.panel-header h2 { font-size: 0.95rem; color: #a0a0b0; margin: 0; }

.scene-card { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 8px; background: #181825; border: 1px solid #2a2a3e; cursor: pointer; transition: all 0.2s; }
.scene-card.active { border-color: #60a5fa; background: #1a1a3e; }
.scene-index { width: 24px; height: 24px; border-radius: 50%; background: #2a2a3e; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; color: #888; flex-shrink: 0; }
.scene-info { flex: 1; }
.scene-type { font-size: 0.85rem; color: #c0c0d0; display: block; }
.scene-desc { font-size: 0.75rem; color: #666; }

.template-list { display: flex; flex-direction: column; gap: 8px; }
.template-card { display: flex; align-items: center; gap: 10px; padding: 12px; background: #181825; border: 1px solid #2a2a3e; border-radius: 8px; cursor: pointer; transition: all 0.2s; text-align: left; color: #c0c0d0; font-size: 0.85rem; }
.template-card:hover { border-color: #60a5fa; background: #1a1a3e; }
.tpl-icon { font-size: 1.5rem; }
.tpl-name { font-weight: 500; }

.runtime-card { padding: 12px; background: #181825; border-radius: 8px; display: flex; flex-direction: column; gap: 6px; }
.stat-row { display: flex; justify-content: space-between; font-size: 0.85rem; }
.stat-row span { color: #666; }
.stat-row strong { color: #c0c0d0; }
.panel-empty { text-align: center; padding: 32px 0; color: #555; font-size: 0.85rem; }

.identity-mini-panel { margin-top: 8px; }
.mini-title { font-size: 0.8rem; color: #888; margin-bottom: 8px; }
.id-row { display: flex; align-items: center; gap: 6px; margin: 2px 0; }
.id-label { font-size: 0.7rem; color: #666; width: 28px; flex-shrink: 0; }
.id-bar { flex: 1; height: 4px; background: #1e1e2e; border-radius: 2px; overflow: hidden; }
.id-fill { height: 100%; background: linear-gradient(90deg, #60a5fa, #a78bfa); border-radius: 2px; transition: width 0.3s; }
.id-val { font-size: 0.7rem; color: #888; width: 24px; text-align: right; }

.memory-log { display: flex; flex-direction: column; gap: 4px; }
.log-entry { font-size: 0.75rem; color: #777; padding: 4px 8px; background: #181825; border-radius: 4px; font-family: monospace; }

.control-bar { display: flex; align-items: center; gap: 8px; padding: 10px 16px; background: #0f0f18; border: 1px solid #1e1e2e; border-radius: 10px; }
.ctrl-btn { display: flex; align-items: center; gap: 4px; padding: 8px 14px; border-radius: 8px; border: 1px solid #2a2a3e; background: #181825; color: #c0c0d0; font-size: 0.82rem; cursor: pointer; }
.ctrl-btn:hover { border-color: #3a3a5e; background: #1e1e30; }
.ctrl-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.ctrl-btn.primary { background: #2563eb; border-color: #2563eb; color: #fff; }
.ctrl-btn.danger { border-color: #7f1d1d; color: #fca5a5; }
.sse-badge { padding: 2px 8px; border-radius: 4px; font-size: 0.65rem; background: #2a2a3e; color: #666; margin-left: auto; }
.sse-badge.on { background: #064e3b; color: #4ade80; }
</style>
