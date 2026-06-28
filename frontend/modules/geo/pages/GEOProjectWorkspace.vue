<template>
  <div class="geo-workspace">
    <!-- Left: Navigation / Pipeline -->
    <aside class="geo-workspace__sidebar">
      <div class="geo-workspace__back" @click="goBack">
        ← 返回列表
      </div>

      <div class="geo-workspace__project-name">
        {{ store.currentProject?.name || '加载中...' }}
      </div>

      <!-- Pipeline Progress -->
      <div class="geo-workspace__pipeline">
        <FlowPipeline :steps="store.pipelineSteps" />
      </div>

      <!-- Navigation -->
      <nav class="geo-workspace__nav">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          class="geo-workspace__nav-btn"
          :class="{ 'geo-workspace__nav-btn--active': activeTab === tab.key }"
          @click="activeTab = tab.key"
        >
          <span>{{ tab.icon }}</span>
          <span>{{ tab.label }}</span>
        </button>
      </nav>
    </aside>

    <!-- Center: Main Workspace -->
    <main class="geo-workspace__main">
      <!-- Topic Research Tab -->
      <div v-if="activeTab === 'research'" class="geo-workspace__panel">
        <TopicResearchPanel
          :research="store.researchResult"
          :loading="store.loading"
          @research="handleResearch"
        />
      </div>

      <!-- Entity Discovery Tab -->
      <div v-else-if="activeTab === 'entities'" class="geo-workspace__panel">
        <EntityDiscoveryPanel
          :entities="store.entities"
          :relations="store.relations"
        />
      </div>

      <!-- Knowledge Graph Tab -->
      <div v-else-if="activeTab === 'graph'" class="geo-workspace__panel">
        <div class="geo-workspace__graph-controls">
          <button
            class="geo-workspace__build-btn"
            :disabled="store.entities.length === 0 || store.loading"
            @click="handleBuildGraph"
          >
            {{ store.loading ? '构建中...' : '构建知识图谱' }}
          </button>
        </div>
        <KnowledgeGraphViewer :data="store.visualizationData" />
      </div>

      <!-- Provenance Tab -->
      <div v-else-if="activeTab === 'provenance'" class="geo-workspace__panel">
        <div v-if="store.entities.length > 0" class="geo-workspace__entity-select">
          <label>选择实体查看溯源：</label>
          <select v-model="selectedEntityId" @change="loadProvenance">
            <option value="">-- 请选择 --</option>
            <option v-for="e in store.entities" :key="e.id" :value="e.id">
              {{ e.name }}
            </option>
          </select>
        </div>
        <ProvenanceTimeline :provenance="provenanceData" />
      </div>
    </main>

    <!-- Right: Info Panel -->
    <aside class="geo-workspace__right-panel">
      <div class="geo-workspace__info">
        <h4>项目信息</h4>
        <div v-if="store.currentProject" class="geo-workspace__info-grid">
          <div class="geo-workspace__info-item">
            <span class="geo-workspace__info-label">状态</span>
            <span class="geo-workspace__info-value">{{ store.currentProject.status }}</span>
          </div>
          <div class="geo-workspace__info-item">
            <span class="geo-workspace__info-label">主题</span>
            <span class="geo-workspace__info-value">{{ store.currentProject.topic || '-' }}</span>
          </div>
          <div class="geo-workspace__info-item">
            <span class="geo-workspace__info-label">语言</span>
            <span class="geo-workspace__info-value">{{ store.currentProject.language }}</span>
          </div>
          <div class="geo-workspace__info-item">
            <span class="geo-workspace__info-label">实体数</span>
            <span class="geo-workspace__info-value">{{ store.entityCount }}</span>
          </div>
          <div class="geo-workspace__info-item">
            <span class="geo-workspace__info-label">关系数</span>
            <span class="geo-workspace__info-value">{{ store.relationCount }}</span>
          </div>
        </div>
      </div>

      <div class="geo-workspace__actions">
        <h4>操作</h4>
        <button
          class="geo-workspace__action-btn"
          :disabled="!store.currentProject"
          @click="handleSnapshot"
        >
          📸 创建快照
        </button>
      </div>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useGEOStore } from '../store/useGEOStore'
import { geoApi } from '../services/geo.service'
import FlowPipeline from '../components/FlowPipeline.vue'
import TopicResearchPanel from '../components/TopicResearchPanel.vue'
import EntityDiscoveryPanel from '../components/EntityDiscoveryPanel.vue'
import KnowledgeGraphViewer from '../components/KnowledgeGraphViewer.vue'
import ProvenanceTimeline from '../components/ProvenanceTimeline.vue'
import type { ProvenanceChain } from '../types/index'

const route = useRoute()
const router = useRouter()
const store = useGEOStore()

const activeTab = ref('research')
const selectedEntityId = ref('')
const provenanceData = ref<ProvenanceChain | null>(null)

const tabs = [
  { key: 'research', label: '主题研究', icon: '🔍' },
  { key: 'entities', label: '实体发现', icon: '🧩' },
  { key: 'graph', label: '知识图谱', icon: '🕸️' },
  { key: 'provenance', label: '溯源', icon: '📜' },
]

onMounted(async () => {
  const projectId = route.params.id as string
  if (projectId) {
    await store.openProject(projectId)
  }
})

function goBack() {
  router.push('/geo')
}

async function handleResearch(topic: string) {
  await store.runResearch(topic)
  if (!store.error) {
    activeTab.value = 'entities'
  }
}

async function handleBuildGraph() {
  const graph = await store.buildGraph()
  if (graph) {
    activeTab.value = 'graph'
  }
}

async function loadProvenance() {
  if (!selectedEntityId.value) {
    provenanceData.value = null
    return
  }
  try {
    const data = await geoApi.getEntityProvenance(selectedEntityId.value)
    provenanceData.value = data
  } catch {
    provenanceData.value = null
  }
}

async function handleSnapshot() {
  if (!store.currentProject) return
  try {
    await geoApi.snapshotProject(store.currentProject.id)
    alert('快照创建成功')
  } catch (err: any) {
    alert('快照创建失败: ' + err.message)
  }
}
</script>

<style scoped>
.geo-workspace {
  display: flex;
  height: calc(100vh - 60px);
  background: #f9fafb;
}

/* Left Sidebar */
.geo-workspace__sidebar {
  width: 240px;
  background: #fff;
  border-right: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
  padding: 16px;
  gap: 16px;
  flex-shrink: 0;
}

.geo-workspace__back {
  font-size: 13px;
  color: #6366f1;
  cursor: pointer;
  padding: 4px 0;
}

.geo-workspace__back:hover {
  color: #4f46e5;
}

.geo-workspace__project-name {
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
  padding-bottom: 8px;
  border-bottom: 1px solid #e5e7eb;
}

.geo-workspace__pipeline {
  margin: 0 -8px;
}

.geo-workspace__nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.geo-workspace__nav-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: transparent;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  color: #374151;
  cursor: pointer;
  text-align: left;
  transition: all 0.2s;
}

.geo-workspace__nav-btn:hover {
  background: #f3f4f6;
}

.geo-workspace__nav-btn--active {
  background: #eef2ff;
  color: #4338ca;
  font-weight: 500;
}

/* Main Area */
.geo-workspace__main {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.geo-workspace__panel {
  background: #fff;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  min-height: calc(100% - 40px);
}

.geo-workspace__graph-controls {
  padding: 12px;
  border-bottom: 1px solid #e5e7eb;
}

.geo-workspace__build-btn {
  padding: 8px 16px;
  background: #6366f1;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;
}

.geo-workspace__build-btn:hover:not(:disabled) {
  background: #4f46e5;
}

.geo-workspace__build-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.geo-workspace__entity-select {
  padding: 12px;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  align-items: center;
  gap: 8px;
}

.geo-workspace__entity-select label {
  font-size: 13px;
  color: #374151;
}

.geo-workspace__entity-select select {
  padding: 6px 10px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 13px;
  outline: none;
}

/* Right Panel */
.geo-workspace__right-panel {
  width: 280px;
  background: #fff;
  border-left: 1px solid #e5e7eb;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  flex-shrink: 0;
  overflow-y: auto;
}

.geo-workspace__info h4,
.geo-workspace__actions h4 {
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
  margin: 0 0 12px 0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.geo-workspace__info-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.geo-workspace__info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.geo-workspace__info-label {
  font-size: 13px;
  color: #9ca3af;
}

.geo-workspace__info-value {
  font-size: 13px;
  font-weight: 500;
  color: #1f2937;
}

.geo-workspace__action-btn {
  width: 100%;
  padding: 8px 16px;
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.geo-workspace__action-btn:hover:not(:disabled) {
  background: #e5e7eb;
}

.geo-workspace__action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
