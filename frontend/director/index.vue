<template>
  <div class="workbench">
    <!-- 顶栏 -->
    <header class="top-bar">
      <div class="top-bar-left">
        <h1 class="wb-title">🎬 导演工作台</h1>
        <span v-if="director.state.sessionKey" class="session-badge">
          {{ director.state.sessionKey.slice(0, 20) }}…
        </span>
      </div>
      <div class="top-bar-right">
        <span v-if="director.state.pending" class="loading-badge">⏳ 处理中</span>
        <span v-if="director.state.error" class="error-badge">⚠ {{ director.state.error }}</span>
      </div>
    </header>

    <!-- 四栏布局 -->
    <div class="main-grid">
      <SceneGraphPanel
        :scenes="director.state.scenes"
        :active-scene-id="director.state.runtimeState?.currentSceneId ?? null"
        @add="addScene"
        @select="onSceneSelect"
      />
      <RuntimeView
        :state="director.state.runtimeState"
        :identity-keys="identityKeys"
        :identities="allIdentities"
        :active-char="activeCharacter"
      />
      <TimelineView
        :scenes="director.state.scenes"
        :active-scene-id="director.state.runtimeState?.currentSceneId ?? null"
        :current-shot-index="director.state.runtimeState?.currentShotIndex ?? 0"
        :completed-scenes="director.state.runtimeState?.completedScenes ?? 0"
        @seek="onSeek"
      />
      <InspectorPanel
        :memory="director.state.memory"
        :identities="director.state.identity"
        :decisions="director.state.adaptiveDecisions"
        :export-data="exportData"
      />
    </div>

    <!-- 底部控制台 -->
    <ControlConsole
      :running="!!director.state.sessionKey"
      :auto-active="autoActive"
      :connected="director.state.connected"
      :tick-interval="tickInterval"
      @run="runCurrentStory"
      @tick="handleTick"
      @start-auto="startAutoRun"
      @stop-auto="stopAutoRun"
      @export="handleExport"
      @reset="handleReset"
      @stop="handleStop"
      @update:tick-interval="tickInterval = $event"
    />

    <!-- 快速故事模板区 -->
    <section class="story-templates" v-if="!director.state.sessionKey && !director.state.scenes.length">
      <p class="template-label">选择预设故事快速体验</p>
      <div class="template-list">
        <button
          v-for="tpl in templates"
          :key="tpl.name"
          class="template-card"
          @click="loadTemplate(tpl)"
        >
          <span class="tpl-icon">{{ tpl.icon }}</span>
          <span class="tpl-name">{{ tpl.name }}</span>
          <span class="tpl-desc">{{ tpl.description }}</span>
        </button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import SceneGraphPanel from '../components/SceneGraphPanel.vue'
import RuntimeView from '../components/RuntimeView.vue'
import TimelineView from '../components/TimelineView.vue'
import InspectorPanel from '../components/InspectorPanel.vue'
import ControlConsole from '../components/ControlConsole.vue'
import { useDirectorRuntime } from '../composables/useDirectorRuntime'

const director = useDirectorRuntime()

// ─── 状态 ──────────────────────────────────────────────

const tickInterval = ref(1000)
const autoActive = ref(false)
const exportData = ref<any>(null)
let sceneCounter = 1

function nextSceneId() {
  return `s${sceneCounter++}`
}

// 默认场景
function defaultScene(id: string): any {
  return {
    id,
    type: 'intro',
    description: '场景描述',
    shotGraph: {
      subject: [{ name: '角色' }],
      action: '行动',
      camera: { shot_type: 'medium' },
      spatialFrame: '空间',
    },
  }
}

// ─── 模板 ──────────────────────────────────────────────

const templates = [
  {
    name: '英雄之旅',
    icon: '⚔️',
    description: '3 场景：启程 → 试炼 → 归来',
    scenes: [
      { id: 's1', type: 'intro', description: '平静的村庄', shotGraph: { subject: [{ name: '英雄' }], action: '准备出发', camera: { shot_type: 'wide' }, spatialFrame: '村庄' } },
      { id: 's2', type: 'conflict', description: '黑暗森林的遭遇', shotGraph: { subject: [{ name: '英雄' }, { name: '怪物' }], action: '战斗', camera: { shot_type: 'close-up' }, spatialFrame: '森林' }, relations: { causedBy: 's1' } },
      { id: 's3', type: 'resolution', description: '带着宝藏归来', shotGraph: { subject: [{ name: '英雄' }], action: '凯旋', camera: { shot_type: 'medium' }, spatialFrame: '村庄' }, relations: { resolves: 's2' } },
    ],
    title: '英雄之旅',
  },
  {
    name: '悬疑短剧',
    icon: '🔍',
    description: '4 场景：探索 → 对抗 → 转折 → 真相',
    scenes: [
      { id: 's1', type: 'intro', description: '案发现场', shotGraph: { subject: [{ name: '侦探' }], action: '勘察', camera: { shot_type: 'medium' }, spatialFrame: '房间' } },
      { id: 's2', type: 'conflict', description: '审讯嫌疑人', shotGraph: { subject: [{ name: '侦探' }, { name: '嫌疑人' }], action: '对质', camera: { shot_type: 'close-up' }, spatialFrame: '审讯室' }, relations: { causedBy: 's1' } },
      { id: 's3', type: 'climax', description: '发现隐藏线索', shotGraph: { subject: [{ name: '侦探' }], action: '搜索', camera: { shot_type: 'dolly' }, spatialFrame: '地下室' }, relations: { causedBy: 's2' } },
      { id: 's4', type: 'resolution', description: '真相大白', shotGraph: { subject: [{ name: '侦探' }, { name: '嫌疑人' }], action: '揭露', camera: { shot_type: 'over-the-shoulder' }, spatialFrame: '审讯室' }, relations: { resolves: 's3' } },
    ],
    title: '悬疑短剧',
  },
  {
    name: '情感短剧',
    icon: '💔',
    description: '3 场景：相遇 → 离别 → 重逢',
    scenes: [
      { id: 's1', type: 'intro', description: '初次相遇', shotGraph: { subject: [{ name: '她' }, { name: '他' }], action: '邂逅', camera: { shot_type: 'medium' }, spatialFrame: '咖啡馆' } },
      { id: 's2', type: 'conflict', description: '无奈分离', shotGraph: { subject: [{ name: '她' }], action: '告别', camera: { shot_type: 'close-up' }, spatialFrame: '车站' }, relations: { causedBy: 's1' } },
      { id: 's3', type: 'resolution', description: '多年重逢', shotGraph: { subject: [{ name: '她' }, { name: '他' }], action: '相视一笑', camera: { shot_type: 'wide' }, spatialFrame: '旧地' }, relations: { resolves: 's2' } },
    ],
    title: '情感故事',
  },
]

// ─── 动作 ──────────────────────────────────────────────

const identityKeys = ['courage', 'fear', 'curiosity', 'aggression', 'stability', 'attention']
const activeCharacter = ref('')
const allIdentities = computed(() => {
  // 将 identity 转为 { [dim]: { [char]: val } } 格式供 RuntimeView 消费
  const result: Record<string, Record<string, number>> = {}
  for (const dim of identityKeys) result[dim] = {}
  for (const [char, vec] of Object.entries(director.state.identity)) {
    activeCharacter.value = activeCharacter.value || char
    for (const dim of identityKeys) {
      result[dim][char] = (vec as any)[dim] ?? 0.5
    }
  }
  return result
})

function addScene() {
  const id = nextSceneId()
  const newScenes = [...director.state.scenes, defaultScene(id)]
  // 无法直接 setScenes，需要用 composable 暴露的 setter
  // 但 current implementation 需要直接改 store——composable 已暴露 setScenes
}

function onSceneSelect(_id: string) { /* 高亮不处理 */ }
function onSeek(_sceneId: string, _shotIndex: number) { /* 暂时 skip */ }

async function runCurrentStory() {
  if (director.state.scenes.length === 0) {
    // 没场景时加载第一个模板
    await director.runStory(templates[0].scenes as any, templates[0].title)
  } else {
    await director.runStory(director.state.scenes as any, '自定义故事')
  }
  director.connectSSE()
}

async function loadTemplate(tpl: typeof templates[0]) {
  // 暂存 scenes 到 store
  const src = director.state.scenes
  src.length = 0
  src.push(...tpl.scenes as any)
}

async function handleTick() { await director.tick() }

function startAutoRun() {
  autoActive.value = true
  director.startAutoTick(tickInterval.value)
}

function stopAutoRun() {
  autoActive.value = false
  director.stopAutoTick()
}

async function handleExport() {
  const data = await director.fetchExport()
  if (data) exportData.value = data.projection
}

async function handleReset() {
  stopAutoRun()
  await director.stopStory()
  exportData.value = null
}

async function handleStop() {
  stopAutoRun()
  director.disconnectSSE()
  director.stopAutoTick()
  // 不重置 scenes
}

onUnmounted(() => {
  director.disconnectSSE()
  director.stopAutoTick()
})
</script>

<style scoped>
.workbench {
  min-height: 100vh;
  background: #0a0a0f;
  color: #e0e0e0;
  display: flex;
  flex-direction: column;
  padding: 16px;
  gap: 12px;
  font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
}

/* 顶栏 */
.top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #0f0f18;
  border: 1px solid #1e1e2e;
  border-radius: 10px;
}
.top-bar-left { display: flex; align-items: center; gap: 12px; }
.wb-title { font-size: 1rem; font-weight: 600; margin: 0; color: #a0a0b0; }
.session-badge {
  padding: 2px 8px; border-radius: 4px;
  background: #1e1e2e; color: #666; font-size: 0.7rem;
  font-family: 'JetBrains Mono', monospace;
}
.top-bar-right { display: flex; gap: 8px; }
.loading-badge { padding: 2px 8px; border-radius: 4px; background: #312e81; color: #a5b4fc; font-size: 0.7rem; }
.error-badge { padding: 2px 8px; border-radius: 4px; background: #7f1d1d; color: #fca5a5; font-size: 0.7rem; }

/* 四栏 */
.main-grid {
  display: grid;
  grid-template-columns: 220px 1fr 1fr 240px;
  gap: 12px;
  flex: 1;
  min-height: 0;
}
.main-grid > * {
  min-height: 400px;
  max-height: calc(100vh - 200px);
}

/* 模板区 */
.story-templates { padding: 24px 0; text-align: center; }
.template-label { color: #666; font-size: 0.85rem; margin-bottom: 12px; }
.template-list { display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; }
.template-card {
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  padding: 16px 24px; background: #12121a; border: 1px solid #1e1e2e;
  border-radius: 12px; cursor: pointer; transition: all 0.2s;
  width: 160px;
}
.template-card:hover { border-color: #60a5fa; background: #1a1a3e; }
.tpl-icon { font-size: 2rem; }
.tpl-name { font-size: 0.9rem; color: #c0c0d0; }
.tpl-desc { font-size: 0.7rem; color: #666; text-align: center; }

@media (max-width: 1200px) {
  .main-grid {
    grid-template-columns: 1fr 1fr;
  }
}
@media (max-width: 768px) {
  .main-grid {
    grid-template-columns: 1fr;
  }
}
</style>
