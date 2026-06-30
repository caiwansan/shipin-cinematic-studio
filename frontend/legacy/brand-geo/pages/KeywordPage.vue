<!-- @deprecated — GEO v3 Legacy. Use design-system product blocks instead. -->
<template>
  <div class="geo-page">
    <div class="geo-page-header">
      <div class="geo-page-header-left">
        <h2 class="geo-page-title">🔑 搜索词</h2>
        <p class="geo-page-subtitle">管理品牌相关搜索词，支持导入导出</p>
      </div>
      <div class="geo-page-header-right">
        <button class="geo-btn geo-btn-ghost" @click="showImportModal = true">📥 导入</button>
        <button class="geo-btn geo-btn-ghost" @click="exportKeywords">📤 导出</button>
        <button class="geo-btn geo-btn-primary" @click="showCreateModal = true">+ 新增关键词</button>
      </div>
    </div>
    <KeywordFilters :projects="projects" @project-change="onProjectChange" @type-change="onTypeChange" @search-change="onSearchChange" />
    <KeywordTable :keywords="displayKeywords" :loading="loading" :project-selected="!!selectedProjectId" @delete="confirmDelete" />
    <div v-if="!loading && keywords.length === 0 && selectedProjectId" class="geo-page-empty">
      <div class="geo-empty-state-icon">🔑</div>
      <div class="geo-empty-state-title">暂无搜索词</div>
      <div class="geo-empty-state-desc">分析完成后自动创建搜索词，或手动添加</div>
      <button class="geo-btn geo-btn-primary" @click="showCreateModal = true">+ 添加搜索词</button>
    </div>
    <div v-else-if="!loading && keywords.length === 0" class="geo-page-empty">
      <div class="geo-empty-state-icon">🔑</div>
      <div class="geo-empty-state-title">请先选择一个品牌项目</div>
      <div class="geo-empty-state-desc">选择品牌项目后，搜索词将自动加载</div>
    </div>
    <div class="geo-pagination-info" v-if="keywords.length > 0">共 {{ keywords.length }} 个搜索词</div>
    <KeywordCreateModal v-if="showCreateModal" :saving="saving" @close="showCreateModal = false" @save="addKeywords" />
    <KeywordImportModal v-if="showImportModal" :saving="saving" @close="showImportModal = false" @save="importKeywords" />
    <div v-if="showDeleteConfirm" class="geo-modal-overlay" @click.self="showDeleteConfirm = false">
      <div class="geo-modal geo-modal-sm">
        <div class="geo-modal-header"><h3>确认删除</h3><button class="geo-modal-close" @click="showDeleteConfirm = false">✕</button></div>
        <div class="geo-modal-body"><p>确定要删除关键词「{{ deletingKeyword?.keyword }}」吗？</p></div>
        <div class="geo-modal-footer"><button class="geo-btn geo-btn-ghost" @click="showDeleteConfirm = false">取消</button><button class="geo-btn geo-btn-danger" @click="deleteKeyword" :disabled="saving">确认删除</button></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import KeywordFilters from '../components/keyword/KeywordFilters.vue'
import KeywordTable from '../components/keyword/KeywordTable.vue'
import KeywordCreateModal from '../components/keyword/KeywordCreateModal.vue'
import KeywordImportModal from '../components/keyword/KeywordImportModal.vue'
import { brandService } from '../services/brandService'
import { client } from '../clients/GEOApiClient'

const loading = ref(false); const saving = ref(false)
const keywords = ref<any[]>([]); const projects = ref<any[]>([])
const selectedProjectId = ref(''); const filterType = ref(''); const searchQuery = ref('')
const showCreateModal = ref(false); const showImportModal = ref(false)
const showDeleteConfirm = ref(false); const deletingKeyword = ref<any>(null)

const displayKeywords = computed(() => {
  let items = keywords.value
  if (filterType.value) items = items.filter(k => k.type === filterType.value)
  if (searchQuery.value) { const q = searchQuery.value.toLowerCase(); items = items.filter(k => k.keyword.toLowerCase().includes(q)) }
  return items
})

function onProjectChange(id: string) { selectedProjectId.value = id; fetchKeywords() }
function onTypeChange(type: string) { filterType.value = type; fetchKeywords() }
function onSearchChange(q: string) { searchQuery.value = q }

async function fetchProjects() {
  try {
    const brands = await brandService.list()
    projects.value = brands as any[]
  } catch (err) { console.error('Failed to fetch projects:', err) }
}

async function fetchKeywords() {
  if (!selectedProjectId.value) return; loading.value = true
  try {
    const params = new URLSearchParams({ projectId: selectedProjectId.value })
    if (filterType.value) params.set('type', filterType.value)
    const res = await client.get<any[]>(`/keywords?${params}`)
    if (res.success) keywords.value = res.data || []
  } catch (err) { console.error('Failed to fetch keywords:', err) }
  finally { loading.value = false }
}

async function addKeywords(data: { keywordsText: string; keywordsType: string }) {
  if (!selectedProjectId.value || !data.keywordsText.trim()) return; saving.value = true
  try {
    const lines = data.keywordsText.split('\n').map(l => l.trim()).filter(Boolean)
    const bulkKeywords = lines.map(kw => ({ keyword: kw, type: data.keywordsType, source: 'manual' }))
    await client.post('/keywords', { projectId: selectedProjectId.value, keywords: bulkKeywords })
    showCreateModal.value = false; await fetchKeywords()
  } catch (err) { console.error('Failed to add keywords:', err) }
  finally { saving.value = false }
}

async function importKeywords(data: { content: string; type: string }) {
  if (!selectedProjectId.value || !data.content.trim()) return; saving.value = true
  try {
    await client.post('/keywords/import', { projectId: selectedProjectId.value, content: data.content, type: data.type })
    showImportModal.value = false; await fetchKeywords()
  } catch (err) { console.error('Failed to import keywords:', err) }
  finally { saving.value = false }
}

async function exportKeywords() {
  if (!selectedProjectId.value) return
  try {
    const params = new URLSearchParams({ projectId: selectedProjectId.value })
    if (filterType.value) params.set('type', filterType.value)
    const res = await fetch(`/api/geo/keywords/export?${params}`)
    const csv = await res.text(); const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `keywords-${selectedProjectId.value}.csv`; a.click(); URL.revokeObjectURL(url)
  } catch (err) { console.error('Failed to export keywords:', err) }
}

function confirmDelete(kw: any) { deletingKeyword.value = kw; showDeleteConfirm.value = true }

async function deleteKeyword() {
  if (!deletingKeyword.value) return; saving.value = true
  try {
    await client.delete(`/keywords/${deletingKeyword.value.id}`)
    showDeleteConfirm.value = false; deletingKeyword.value = null; await fetchKeywords()
  } catch (err) { console.error('Failed to delete keyword:', err) }
  finally { saving.value = false }
}

onMounted(fetchProjects)
</script>

<style scoped>
.geo-page { padding: 24px; color: #e0e0e0; height: 100%; overflow-y: auto; }
.geo-page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
.geo-page-header-left { }
.geo-page-title { font-size: 20px; font-weight: 700; margin: 0 0 4px; }
.geo-page-subtitle { color: #888; font-size: 13px; margin: 0; }
.geo-page-header-right { display: flex; gap: 8px; }
.geo-btn { padding: 8px 20px; border-radius: 6px; border: none; cursor: pointer; font-size: 13px; font-weight: 600; transition: all 0.15s; }
.geo-btn-primary { background: linear-gradient(135deg, #818cf8, #6366f1); color: white; }
.geo-btn-primary:hover { opacity: 0.9; }
.geo-btn-ghost { background: rgba(255,255,255,0.06); color: #ccc; }
.geo-btn-ghost:hover { background: rgba(255,255,255,0.1); }
.geo-pagination-info { margin-top: 12px; font-size: 12px; color: #6b7280; text-align: right; }
.geo-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.geo-modal { background: #1a1a2e; border-radius: 12px; border: 1px solid rgba(255,255,255,0.08); width: 480px; max-width: 90vw; max-height: 85vh; overflow-y: auto; }
.geo-modal-sm { width: 380px; }
.geo-modal-header { display: flex; justify-content: space-between; align-items: center; padding: 18px 20px 0; }
.geo-modal-header h3 { margin: 0; font-size: 16px; font-weight: 700; color: #e0e0e0; }
.geo-modal-close { background: none; border: none; color: #6b7280; font-size: 18px; cursor: pointer; padding: 4px; }
.geo-modal-close:hover { color: #ccc; }
.geo-modal-body { padding: 16px 20px; color: #ccc; }
.geo-modal-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 0 20px 18px; }
.geo-btn-danger { background: rgba(239,68,68,0.2); color: #ef4444; }
.geo-btn-danger:hover { background: rgba(239,68,68,0.3); }

/* ── Empty State ── */
.geo-page-empty { padding: 60px 20px; text-align: center; }
.geo-empty-state-icon { font-size: 40px; margin-bottom: 12px; }
.geo-empty-state-title { font-size: 16px; font-weight: 700; margin-bottom: 8px; color: #e0e0e0; }
.geo-empty-state-desc { font-size: 13px; color: #6b7280; margin-bottom: 20px; }
</style>
