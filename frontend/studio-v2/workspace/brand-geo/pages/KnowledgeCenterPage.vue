<template>
  <div class="geo-page">
    <div class="geo-page-header">
      <div class="geo-page-header-left">
        <h2 class="geo-page-title">📚 Knowledge 中心</h2>
        <p class="geo-page-subtitle">管理知识对象，查看 Evidence、Claim、Citation 详情</p>
      </div>
    </div>

    <div class="geo-filters-bar">
      <div class="geo-filter-group">
        <label class="geo-filter-label">选择项目</label>
        <select v-model="selectedProjectId" class="geo-input geo-input-sm" @change="fetchKnowledgeObjects">
          <option value="">选择项目</option>
          <option v-for="p in projects" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>
      </div>
    </div>

    <div v-if="!selectedProjectId" class="geo-empty-state">
      <p>请先选择一个品牌项目</p>
    </div>

    <template v-else-if="!loading">
      <KnowledgeStats
        v-if="knowledgeObjects.length > 0"
        :total-kos="knowledgeObjects.length"
        :total-claims="totalClaims"
        :total-evidence="totalEvidence"
        :total-citations="totalCitations"
      />

      <KnowledgeObjectList
        v-if="knowledgeObjects.length > 0"
        :knowledge-objects="knowledgeObjects"
        @select="selectKO"
      />

      <div v-else class="geo-empty-state">
        <p>暂无知识对象，请先运行 Entity Discovery 工作流</p>
      </div>
    </template>

    <div v-else class="geo-loading-state">
      <div class="geo-loading-spinner"></div>
      <span>加载中...</span>
    </div>

    <KnowledgeObjectDetail
      v-if="selectedKO"
      :ko="selectedKO"
      @close="selectedKO = null"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import KnowledgeStats from '../components/knowledge/KnowledgeStats.vue'
import KnowledgeObjectList from '../components/knowledge/KnowledgeObjectList.vue'
import KnowledgeObjectDetail from '../components/knowledge/KnowledgeObjectDetail.vue'

const loading = ref(false)
const projects = ref<any[]>([])
const selectedProjectId = ref('')
const knowledgeObjects = ref<any[]>([])
const selectedKO = ref<any>(null)

const totalClaims = computed(() =>
  knowledgeObjects.value.reduce((s, ko) => s + (ko.claims?.length || 0), 0))
const totalEvidence = computed(() =>
  knowledgeObjects.value.reduce((s, ko) => s + (ko.evidence?.length || 0), 0))
const totalCitations = computed(() =>
  knowledgeObjects.value.reduce((s, ko) => s + (ko.citations?.length || 0), 0))

function authHeaders(): Record<string, string> {
  try {
    for (const key of ['auth_token', 'accessToken', 'token']) {
      const val = window.localStorage.getItem(key)
      if (val) return { 'Content-Type': 'application/json', Authorization: `Bearer ${val}` }
    }
  } catch { /* ignore */ }
  return { 'Content-Type': 'application/json' }
}

async function fetchProjects() {
  try {
    const res = await fetch('/api/geo/brands', { headers: authHeaders() })
    const json = await res.json()
    if (json.success) projects.value = json.data
  } catch (err) { console.error('Failed to fetch projects:', err) }
}

async function fetchKnowledgeObjects() {
  if (!selectedProjectId.value) return
  loading.value = true
  try {
    const res = await fetch(`/api/geo/knowledge?projectId=${selectedProjectId.value}`, { headers: authHeaders() })
    const json = await res.json()
    if (json.success) {
      knowledgeObjects.value = Array.isArray(json.data) ? json.data : (json.data?.items || [])
    }
  } catch (err) { console.error('Failed to fetch knowledge objects:', err) }
  finally { loading.value = false }
}

async function selectKO(ko: any) {
  try {
    const res = await fetch(`/api/geo/knowledge/${ko.id}`, { headers: authHeaders() })
    const json = await res.json()
    selectedKO.value = json.success ? json.data : ko
  } catch { selectedKO.value = ko }
}

onMounted(fetchProjects)
</script>

<style scoped>
.geo-page { padding: 24px; color: #e0e0e0; height: 100%; overflow-y: auto; }
.geo-page-header { margin-bottom: 20px; }
.geo-page-title { font-size: 20px; font-weight: 700; margin: 0 0 4px; }
.geo-page-subtitle { color: #888; font-size: 13px; margin: 0; }
.geo-filters-bar { margin-bottom: 16px; display: flex; gap: 12px; }
.geo-filter-group { display: flex; flex-direction: column; gap: 4px; }
.geo-filter-label { font-size: 11px; color: #6b7280; font-weight: 500; }
.geo-input { padding: 8px 12px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.04); color: #e0e0e0; font-size: 13px; outline: none; }
.geo-input:focus { border-color: #818cf8; }
.geo-input-sm { padding: 6px 10px; font-size: 12px; }
.geo-empty-state { padding: 60px 20px; text-align: center; color: #666; font-size: 14px; }
.geo-loading-state { padding: 40px; text-align: center; display: flex; align-items: center; justify-content: center; gap: 8px; color: #6b7280; }
.geo-loading-spinner { width: 16px; height: 16px; border: 2px solid rgba(129,140,248,0.2); border-top-color: #818cf8; border-radius: 50%; animation: spin 0.6s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
