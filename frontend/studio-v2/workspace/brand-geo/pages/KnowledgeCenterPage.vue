<template>
  <div class="geo-page">
    <div class="geo-page-header">
      <div class="geo-page-header-left">
        <h2 class="geo-page-title">📚 知识内容</h2>
        <p class="geo-page-subtitle">查看和管理品牌相关知识内容</p>
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

    <div v-if="!selectedProjectId" class="geo-page-empty">
      <div class="geo-empty-state-icon">📚</div>
      <div class="geo-empty-state-title">请先选择一个品牌</div>
      <div class="geo-empty-state-desc">选择品牌后查看相关知识内容</div>
      <button class="geo-btn geo-btn-primary" @click="$emit('navigate', 'brands')">查看品牌列表</button>
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

      <div v-else class="geo-page-empty">
        <div class="geo-empty-state-icon">📚</div>
        <div class="geo-empty-state-title">暂无知识内容</div>
        <div class="geo-empty-state-desc">品牌分析中会自动生成知识内容，请先创建并分析一个品牌</div>
        <button class="geo-btn geo-btn-primary" @click="handleCreateBrand">开始分析品牌</button>
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
import { brandService } from '../services/brandService'
import { client } from '../clients/GEOApiClient'

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

async function fetchProjects() {
  try {
    const brands = await brandService.list()
    projects.value = brands as any[]
  } catch (err) { console.error('Failed to fetch projects:', err) }
}

async function fetchKnowledgeObjects() {
  if (!selectedProjectId.value) return
  loading.value = true
  try {
    const res = await client.get<any[]>(`/knowledge?projectId=${selectedProjectId.value}`)
    if (res.success) {
      const data = res.data
      knowledgeObjects.value = Array.isArray(data) ? data : (res as any).data?.items || []
    }
  } catch (err) { console.error('Failed to fetch knowledge objects:', err) }
  finally { loading.value = false }
}

async function selectKO(ko: any) {
  try {
    const res = await client.get<any>(`/knowledge/${ko.id}`)
    selectedKO.value = res.success ? res.data : ko
  } catch { selectedKO.value = ko }
}

function handleCreateBrand() {
  const url = new URL(window.location.href)
  url.searchParams.set('panel', 'wizard')
  window.history.replaceState({}, '', url.toString())
  window.location.reload()
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
.geo-btn { padding: 8px 20px; border-radius: 6px; border: none; cursor: pointer; font-size: 13px; font-weight: 600; transition: all 0.15s; }
.geo-btn-primary { background: linear-gradient(135deg, #818cf8, #6366f1); color: white; }
.geo-btn-primary:hover { opacity: 0.9; }

/* ── Empty State ── */
.geo-page-empty { padding: 60px 20px; text-align: center; }
.geo-empty-state-icon { font-size: 40px; margin-bottom: 12px; }
.geo-empty-state-title { font-size: 16px; font-weight: 700; margin-bottom: 8px; color: #e0e0e0; }
.geo-empty-state-desc { font-size: 13px; color: #6b7280; margin-bottom: 20px; }
</style>
