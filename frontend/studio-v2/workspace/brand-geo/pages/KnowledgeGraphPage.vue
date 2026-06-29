<template>
  <div class="geo-knowledge-graph">
    <div class="geo-panel-header">
      <h3 class="geo-panel-title">🔗 知识图谱</h3>
      <p class="geo-panel-subtitle">
        管理品牌的知识图谱节点和关系。节点表示品牌相关实体，边表示实体间关系。
      </p>
    </div>

    <!-- Tabs -->
    <div class="geo-tabs">
      <button
        class="geo-tab"
        :class="{ active: tab === 'nodes' }"
        @click="tab = 'nodes'"
      >
        节点 ({{ nodes.length }})
      </button>
      <button
        class="geo-tab"
        :class="{ active: tab === 'edges' }"
        @click="tab = 'edges'"
      >
        关系 ({{ edges.length }})
      </button>
      <button
        class="geo-tab"
        :class="{ active: tab === 'create' }"
        @click="tab = 'create'"
      >
        + 新建
      </button>
    </div>

    <!-- Nodes List -->
    <div v-if="tab === 'nodes'" class="geo-graph-section">
      <div v-if="nodes.length === 0" class="geo-empty">
        <p>暂无节点数据。完成网站扫描后可自动生成节点。</p>
      </div>
      <div v-else class="geo-node-list">
        <div v-for="node in nodes" :key="node.id" class="geo-node-card">
          <div class="geo-node-type" :class="'type-' + node.type">{{ node.type }}</div>
          <div class="geo-node-body">
            <span class="geo-node-label">{{ node.label }}</span>
            <span v-if="node.properties" class="geo-node-props">{{ node.properties }}</span>
          </div>
          <div class="geo-node-meta">
            <span class="geo-node-edges">
              出: {{ node.outgoing?.length || 0 }} 入: {{ node.incoming?.length || 0 }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Edges List -->
    <div v-if="tab === 'edges'" class="geo-graph-section">
      <div v-if="edges.length === 0" class="geo-empty">
        <p>暂无关系数据。创建节点后可建立关系。</p>
      </div>
      <div v-else class="geo-edge-list">
        <div v-for="edge in edges" :key="edge.id" class="geo-edge-card">
          <span class="geo-edge-source">{{ edge.sourceId?.slice(0, 8) }}...</span>
          <span class="geo-edge-type">{{ edge.type }}</span>
          <span class="geo-edge-target">{{ edge.targetId?.slice(0, 8) }}...</span>
          <span v-if="edge.properties" class="geo-edge-props">{{ edge.properties }}</span>
        </div>
      </div>
    </div>

    <!-- Create Node Form -->
    <div v-if="tab === 'create'" class="geo-graph-section">
      <div class="geo-create-form">
        <h4 class="geo-create-title">创建新节点</h4>

        <div class="geo-form-group">
          <label class="geo-form-label">标签 *</label>
          <input v-model="newNode.label" type="text" class="geo-form-input" placeholder="节点名称" />
        </div>

        <div class="geo-form-group">
          <label class="geo-form-label">类型 *</label>
          <select v-model="newNode.type" class="geo-form-select">
            <option value="">选择类型...</option>
            <option value="brand">品牌</option>
            <option value="product">产品</option>
            <option value="service">服务</option>
            <option value="page">页面</option>
            <option value="article">文章</option>
            <option value="faq">FAQ</option>
            <option value="api">API</option>
            <option value="document">文档</option>
            <option value="person">人物</option>
            <option value="organization">组织</option>
            <option value="concept">概念</option>
          </select>
        </div>

        <div class="geo-form-group">
          <label class="geo-form-label">属性 (JSON)</label>
          <textarea v-model="newNode.properties" class="geo-form-textarea" rows="3" placeholder='{"key": "value"}'></textarea>
        </div>

        <button class="geo-btn geo-btn-primary" :disabled="!newNode.label || !newNode.type" @click="createNode">
          创建节点
        </button>
      </div>
    </div>

    <div v-if="error" class="geo-error">{{ error }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import { useBrandGeoStore } from '~/studio-v2/workspace/brand-geo/stores/useBrandGeoStore'
import { useGeoHydrate } from '~/studio-v2/workspace/brand-geo/composables/useGeoHydrate'
import type { GeoGraphNode, GeoGraphEdge } from '~/studio-v2/types/geo'

const props = defineProps<{
  projectId: string
}>()

const store = useBrandGeoStore()
const tab = ref<'nodes' | 'edges' | 'create'>('nodes')
const error = ref('')

// Hydrate as primary data source (for execution results context)
const { loading } = useGeoHydrate(() => props.projectId)

// Graph data fetched directly via existing backend routes (bypasses old store)
const nodes = ref<GeoGraphNode[]>([])
const edges = ref<GeoGraphEdge[]>([])

// Inline authFetch — same pattern as useGeoHydrate  
function getAuthHeaders(): Record<string, string> {
  try {
    const token = localStorage.getItem('token') || ''
    return token ? { Authorization: `Bearer ${token}` } : {}
  } catch { return {} }
}

async function authFetch(url: string) {
  const res = await fetch(url, { headers: getAuthHeaders() })
  if (!res.ok) {
    if (res.status === 404) return null
    throw new Error(`HTTP ${res.status} ${res.statusText}`)
  }
  return res.json()
}

async function loadGraph() {
  if (!props.projectId) return
  error.value = ''
  try {
    const [graphRes, edgesRes] = await Promise.all([
      authFetch(`/api/geo/projects/${props.projectId}/graph`),
      authFetch(`/api/geo/projects/${props.projectId}/graph/edges`),
    ])
    if (graphRes?.data) {
      nodes.value = Array.isArray(graphRes.data) ? graphRes.data
        : graphRes.data.nodes || []
    } else {
      nodes.value = []
    }
    if (edgesRes?.data) {
      edges.value = Array.isArray(edgesRes.data) ? edgesRes.data
        : edgesRes.data.edges || []
    } else {
      edges.value = []
    }
  } catch (err: any) {
    error.value = err.message
    nodes.value = []
    edges.value = []
  }
}

watch(() => props.projectId, async (id) => {
  if (!id) return
  await loadGraph()
}, { immediate: true })

const newNode = reactive({
  label: '',
  type: '',
  properties: '',
})

async function createNode() {
  if (!newNode.label || !newNode.type) return
  error.value = ''
  try {
    const result = await store.createGraphNode({
      projectId: props.projectId,
      type: newNode.type,
      label: newNode.label,
      properties: newNode.properties || undefined,
    })
    if (result) {
      newNode.label = ''
      newNode.type = ''
      newNode.properties = ''
      tab.value = 'nodes'
      await loadGraph()
    } else {
      error.value = store.error.value || '创建失败'
    }
  } catch (err: any) {
    error.value = err.message
  }
}
</script>

<style scoped>
.geo-knowledge-graph { padding: 24px; max-width: 800px; margin: 0 auto; }
.geo-panel-header { margin-bottom: 24px; }
.geo-panel-title { font-size: 22px; font-weight: 700; color: #e2e8f0; margin: 0 0 8px; }
.geo-panel-subtitle { font-size: 14px; color: #6b7280; margin: 0; }

.geo-tabs { display: flex; gap: 4px; margin-bottom: 16px; background: #0a0a12; border-radius: 8px; padding: 4px; }
.geo-tab {
  flex: 1; padding: 8px 16px; border-radius: 6px; border: none;
  background: transparent; color: #6b7280; font-size: 13px; font-weight: 500;
  cursor: pointer; transition: all 0.15s;
}
.geo-tab.active { background: #1a1f2e; color: #e2e8f0; }
.geo-tab:hover:not(.active) { color: #9ca3af; }

.geo-graph-section { min-height: 200px; }
.geo-empty { text-align: center; padding: 40px; color: #4b5563; font-size: 13px; }

.geo-node-list { display: flex; flex-direction: column; gap: 8px; }
.geo-node-card {
  display: flex; align-items: center; gap: 12px;
  background: #11151c; border-radius: 10px; padding: 12px 16px;
  border: 1px solid rgba(255, 255, 255, 0.04);
}
.geo-node-type {
  padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;
  background: #1e293b; color: #94a3b8; flex-shrink: 0;
}
.type-brand { background: rgba(99, 102, 241, 0.15); color: #a5b4fc; }
.type-product { background: rgba(16, 185, 129, 0.15); color: #6ee7b7; }
.type-service { background: rgba(245, 158, 11, 0.15); color: #fcd34d; }
.type-person { background: rgba(236, 72, 153, 0.15); color: #f9a8d4; }
.type-organization { background: rgba(59, 130, 246, 0.15); color: #93c5fd; }
.geo-node-body { flex: 1; display: flex; flex-direction: column; gap: 2px; }
.geo-node-label { font-size: 14px; color: #e2e8f0; font-weight: 500; }
.geo-node-props { font-size: 11px; color: #6b7280; }
.geo-node-meta { text-align: right; flex-shrink: 0; }
.geo-node-edges { font-size: 11px; color: #4b5563; }

.geo-edge-list { display: flex; flex-direction: column; gap: 6px; }
.geo-edge-card {
  display: flex; align-items: center; gap: 8px;
  background: #11151c; border-radius: 8px; padding: 10px 14px;
  border: 1px solid rgba(255, 255, 255, 0.04); font-size: 12px;
}
.geo-edge-source, .geo-edge-target { color: #6b7280; font-family: monospace; }
.geo-edge-type {
  background: rgba(139, 92, 246, 0.1); color: #c4b5fd;
  padding: 2px 8px; border-radius: 4px; font-size: 11px;
}
.geo-edge-props { color: #4b5563; font-size: 11px; margin-left: auto; }

.geo-create-form {
  background: #11151c; border-radius: 12px; padding: 20px;
  border: 1px solid rgba(255, 255, 255, 0.04); display: flex; flex-direction: column; gap: 14px;
}
.geo-create-title { font-size: 16px; font-weight: 600; color: #d1d5db; margin: 0; }
.geo-form-group { display: flex; flex-direction: column; gap: 6px; }
.geo-form-label { font-size: 13px; font-weight: 600; color: #9ca3af; }
.geo-form-input, .geo-form-select, .geo-form-textarea {
  background: #0b0f14; border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px; padding: 10px 14px; color: #e2e8f0; font-size: 14px;
  outline: none; transition: border-color 0.15s;
}
.geo-form-select { cursor: pointer; }
.geo-form-textarea { resize: vertical; font-family: inherit; }
.geo-form-input:focus, .geo-form-select:focus, .geo-form-textarea:focus { border-color: #6366f1; }
.geo-btn {
  padding: 10px 24px; border-radius: 8px; font-size: 14px; font-weight: 600;
  cursor: pointer; border: none; align-self: flex-start;
  background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white;
}
.geo-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.geo-btn:hover:not(:disabled) { opacity: 0.9; }
.geo-error { margin-top: 12px; color: #fca5a5; font-size: 13px; }
</style>
