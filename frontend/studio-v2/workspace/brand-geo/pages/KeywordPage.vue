<template>
  <div class="geo-page">
    <div class="geo-page-header">
      <div class="geo-page-header-left">
        <h2 class="geo-page-title">🔑 关键词管理</h2>
        <p class="geo-page-subtitle">管理品牌/AI/行业/长尾关键词，支持导入导出</p>
      </div>
      <div class="geo-page-header-right">
        <button class="geo-btn geo-btn-ghost" @click="showImportModal = true">
          📥 导入
        </button>
        <button class="geo-btn geo-btn-ghost" @click="exportKeywords">
          📤 导出
        </button>
        <button class="geo-btn geo-btn-primary" @click="showCreateModal = true">
          + 新增关键词
        </button>
      </div>
    </div>

    <!-- Filters -->
    <div class="geo-filters-bar">
      <div class="geo-filter-group">
        <label class="geo-filter-label">项目</label>
        <select v-model="selectedProjectId" class="geo-input geo-input-sm" @change="fetchKeywords">
          <option value="">选择品牌项目</option>
          <option v-for="p in projects" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>
      </div>
      <div class="geo-filter-group">
        <label class="geo-filter-label">类型</label>
        <select v-model="filterType" class="geo-input geo-input-sm" @change="fetchKeywords">
          <option value="">全部类型</option>
          <option value="brand">品牌词</option>
          <option value="ai">AI词</option>
          <option value="industry">行业词</option>
          <option value="long_tail">长尾词</option>
        </select>
      </div>
      <div class="geo-filter-group">
        <label class="geo-filter-label">搜索</label>
        <input v-model="searchQuery" class="geo-input geo-input-sm" placeholder="搜索关键词..." @input="filterLocalKeywords" />
      </div>
    </div>

    <!-- Keywords Table -->
    <div class="geo-table-container">
      <div v-if="loading" class="geo-table-loading">
        <div class="geo-loading-spinner"></div>
        <span>加载中...</span>
      </div>
      <div v-else-if="!selectedProjectId" class="geo-table-empty">
        <p>请先选择品牌项目，关键词将在此处显示</p>
      </div>
      <table v-else-if="displayKeywords.length > 0" class="geo-table">
        <thead>
          <tr>
            <th>关键词</th>
            <th>类型</th>
            <th>来源</th>
            <th>创建时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="kw in displayKeywords" :key="kw.id">
            <td class="geo-cell-keyword">{{ kw.keyword }}</td>
            <td>
              <span :class="['geo-type-badge', `geo-type--${kw.type}`]">{{ typeLabel(kw.type) }}</span>
            </td>
            <td class="geo-cell-source">{{ kw.source || '-' }}</td>
            <td class="geo-cell-date">{{ formatDate(kw.createdAt) }}</td>
            <td class="geo-cell-actions">
              <button class="geo-btn-sm geo-btn-danger" @click="confirmDelete(kw)">删除</button>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-else class="geo-table-empty">
        <p>暂无关键词，点击「新增关键词」或「导入」</p>
      </div>
    </div>

    <div class="geo-pagination-info" v-if="keywords.length > 0">
      共 {{ keywords.length }} 个关键词
    </div>

    <!-- Create Modal -->
    <div v-if="showCreateModal" class="geo-modal-overlay" @click.self="showCreateModal = false">
      <div class="geo-modal">
        <div class="geo-modal-header">
          <h3>新增关键词</h3>
          <button class="geo-modal-close" @click="showCreateModal = false">✕</button>
        </div>
        <div class="geo-modal-body">
          <div class="geo-form-group">
            <label class="geo-form-label">关键词（每行一个，支持批量）</label>
            <textarea v-model="newKeywordsText" class="geo-input geo-textarea" placeholder="输入关键词，每行一个" rows="6"></textarea>
          </div>
          <div class="geo-form-group">
            <label class="geo-form-label">类型</label>
            <select v-model="newKeywordsType" class="geo-input">
              <option value="brand">品牌词</option>
              <option value="ai">AI词</option>
              <option value="industry">行业词</option>
              <option value="long_tail">长尾词</option>
            </select>
          </div>
        </div>
        <div class="geo-modal-footer">
          <button class="geo-btn geo-btn-ghost" @click="showCreateModal = false">取消</button>
          <button class="geo-btn geo-btn-primary" @click="addKeywords" :disabled="saving || !newKeywordsText.trim() || !selectedProjectId">
            {{ saving ? '添加中...' : '添加' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Import Modal -->
    <div v-if="showImportModal" class="geo-modal-overlay" @click.self="showImportModal = false">
      <div class="geo-modal">
        <div class="geo-modal-header">
          <h3>导入关键词</h3>
          <button class="geo-modal-close" @click="showImportModal = false">✕</button>
        </div>
        <div class="geo-modal-body">
          <div class="geo-form-group">
            <label class="geo-form-label">粘贴关键词内容（每行一个，或逗号分隔）</label>
            <textarea v-model="importContent" class="geo-input geo-textarea" placeholder="关键词1&#10;关键词2, 关键词3" rows="8"></textarea>
          </div>
          <div class="geo-form-group">
            <label class="geo-form-label">类型</label>
            <select v-model="importType" class="geo-input">
              <option value="brand">品牌词</option>
              <option value="ai">AI词</option>
              <option value="industry">行业词</option>
              <option value="long_tail">长尾词</option>
            </select>
          </div>
        </div>
        <div class="geo-modal-footer">
          <button class="geo-btn geo-btn-ghost" @click="showImportModal = false">取消</button>
          <button class="geo-btn geo-btn-primary" @click="importKeywords" :disabled="saving || !importContent.trim() || !selectedProjectId">
            {{ saving ? '导入中...' : '导入' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Delete Confirm -->
    <div v-if="showDeleteConfirm" class="geo-modal-overlay" @click.self="showDeleteConfirm = false">
      <div class="geo-modal geo-modal-sm">
        <div class="geo-modal-header">
          <h3>确认删除</h3>
          <button class="geo-modal-close" @click="showDeleteConfirm = false">✕</button>
        </div>
        <div class="geo-modal-body">
          <p>确定要删除关键词「{{ deletingKeyword?.keyword }}」吗？</p>
        </div>
        <div class="geo-modal-footer">
          <button class="geo-btn geo-btn-ghost" @click="showDeleteConfirm = false">取消</button>
          <button class="geo-btn geo-btn-danger" @click="deleteKeyword" :disabled="saving">确认删除</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'

const loading = ref(false)
const saving = ref(false)
const keywords = ref<any[]>([])
const projects = ref<any[]>([])
const selectedProjectId = ref('')
const filterType = ref('')
const searchQuery = ref('')
const showCreateModal = ref(false)
const showImportModal = ref(false)
const showDeleteConfirm = ref(false)
const deletingKeyword = ref<any>(null)
const newKeywordsText = ref('')
const newKeywordsType = ref('brand')
const importContent = ref('')
const importType = ref('brand')

const displayKeywords = computed(() => {
  let items = keywords.value
  if (filterType.value) {
    items = items.filter(k => k.type === filterType.value)
  }
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    items = items.filter(k => k.keyword.toLowerCase().includes(q))
  }
  return items
})

function authHeaders(): Record<string, string> {
  try {
    const ls = window.localStorage
    for (const key of ['auth_token', 'accessToken', 'token']) {
      const val = ls.getItem(key)
      if (val) return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${val}` }
    }
  } catch { /* ignore */ }
  return { 'Content-Type': 'application/json' }
}

async function fetchProjects() {
  try {
    const res = await fetch('/api/geo/brands', { headers: authHeaders() })
    const json = await res.json()
    if (json.success) projects.value = json.data
  } catch (err) {
    console.error('Failed to fetch projects:', err)
  }
}

async function fetchKeywords() {
  if (!selectedProjectId.value) return
  loading.value = true
  try {
    const params = new URLSearchParams({ projectId: selectedProjectId.value })
    if (filterType.value) params.set('type', filterType.value)
    const res = await fetch(`/api/geo/keywords?${params}`, { headers: authHeaders() })
    const json = await res.json()
    if (json.success) keywords.value = json.data
  } catch (err) {
    console.error('Failed to fetch keywords:', err)
  } finally {
    loading.value = false
  }
}

function filterLocalKeywords() {
  // handled by computed
}

async function addKeywords() {
  if (!selectedProjectId.value || !newKeywordsText.value.trim()) return
  saving.value = true
  try {
    const lines = newKeywordsText.value.split('\n').map(l => l.trim()).filter(Boolean)
    const bulkKeywords = lines.map(kw => ({ keyword: kw, type: newKeywordsType.value, source: 'manual' }))

    await fetch('/api/geo/keywords', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ projectId: selectedProjectId.value, keywords: bulkKeywords }),
    })

    showCreateModal.value = false
    newKeywordsText.value = ''
    await fetchKeywords()
  } catch (err) {
    console.error('Failed to add keywords:', err)
  } finally {
    saving.value = false
  }
}

async function importKeywords() {
  if (!selectedProjectId.value || !importContent.value.trim()) return
  saving.value = true
  try {
    await fetch('/api/geo/keywords/import', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        projectId: selectedProjectId.value,
        content: importContent.value,
        type: importType.value,
      }),
    })

    showImportModal.value = false
    importContent.value = ''
    await fetchKeywords()
  } catch (err) {
    console.error('Failed to import keywords:', err)
  } finally {
    saving.value = false
  }
}

async function exportKeywords() {
  if (!selectedProjectId.value) return
  try {
    const params = new URLSearchParams({ projectId: selectedProjectId.value })
    if (filterType.value) params.set('type', filterType.value)
    const res = await fetch(`/api/geo/keywords/export?${params}`, { headers: authHeaders() })
    const csv = await res.text()
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `keywords-${selectedProjectId.value}.csv`
    a.click()
    URL.revokeObjectURL(url)
  } catch (err) {
    console.error('Failed to export keywords:', err)
  }
}

function confirmDelete(kw: any) {
  deletingKeyword.value = kw
  showDeleteConfirm.value = true
}

async function deleteKeyword() {
  if (!deletingKeyword.value) return
  saving.value = true
  try {
    await fetch(`/api/geo/keywords/${deletingKeyword.value.id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    })
    showDeleteConfirm.value = false
    deletingKeyword.value = null
    await fetchKeywords()
  } catch (err) {
    console.error('Failed to delete keyword:', err)
  } finally {
    saving.value = false
  }
}

function typeLabel(type: string): string {
  switch (type) {
    case 'brand': return '品牌'
    case 'ai': return 'AI'
    case 'industry': return '行业'
    case 'long_tail': return '长尾'
    default: return type
  }
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
  } catch { return iso }
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
.geo-btn-sm { padding: 4px 10px; border-radius: 4px; font-size: 12px; background: rgba(255,255,255,0.06); color: #aaa; cursor: pointer; border: none; }
.geo-btn-sm:hover { background: rgba(255,255,255,0.1); }

.geo-filters-bar { display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
.geo-filter-group { display: flex; flex-direction: column; gap: 4px; }
.geo-filter-label { font-size: 11px; color: #6b7280; font-weight: 500; }
.geo-input { padding: 8px 12px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.04); color: #e0e0e0; font-size: 13px; outline: none; }
.geo-input:focus { border-color: #818cf8; }
.geo-input-sm { padding: 6px 10px; font-size: 12px; }

.geo-table-container { background: #1a1a2e; border-radius: 10px; border: 1px solid rgba(255,255,255,0.04); overflow: hidden; }
.geo-table { width: 100%; border-collapse: collapse; }
.geo-table th { padding: 10px 16px; text-align: left; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; border-bottom: 1px solid rgba(255,255,255,0.04); }
.geo-table td { padding: 10px 16px; font-size: 13px; border-bottom: 1px solid rgba(255,255,255,0.03); }
.geo-table tr:last-child td { border-bottom: none; }
.geo-table tr:hover td { background: rgba(255,255,255,0.02); }
.geo-cell-keyword { font-weight: 600; }
.geo-cell-source { color: #6b7280; }
.geo-cell-date { color: #6b7280; font-size: 12px; }
.geo-cell-actions { display: flex; gap: 6px; }

.geo-type-badge { padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; }
.geo-type--brand { background: rgba(129,140,248,0.15); color: #818cf8; }
.geo-type--ai { background: rgba(52,211,153,0.15); color: #34d399; }
.geo-type--industry { background: rgba(245,158,11,0.15); color: #fbbf24; }
.geo-type--long_tail { background: rgba(236,72,153,0.15); color: #ec4899; }

.geo-table-loading { padding: 40px; text-align: center; display: flex; align-items: center; justify-content: center; gap: 8px; color: #6b7280; }
.geo-loading-spinner { width: 16px; height: 16px; border: 2px solid rgba(129,140,248,0.2); border-top-color: #818cf8; border-radius: 50%; animation: spin 0.6s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.geo-table-empty { padding: 60px 20px; text-align: center; color: #666; font-size: 14px; }
.geo-pagination-info { margin-top: 12px; font-size: 12px; color: #6b7280; text-align: right; }

/* Modal styles same as BrandListPage */
.geo-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.geo-modal { background: #1a1a2e; border-radius: 12px; border: 1px solid rgba(255,255,255,0.08); width: 480px; max-width: 90vw; max-height: 85vh; overflow-y: auto; }
.geo-modal-sm { width: 380px; }
.geo-modal-header { display: flex; justify-content: space-between; align-items: center; padding: 18px 20px 0; }
.geo-modal-header h3 { margin: 0; font-size: 16px; font-weight: 700; }
.geo-modal-close { background: none; border: none; color: #6b7280; font-size: 18px; cursor: pointer; padding: 4px; }
.geo-modal-close:hover { color: #ccc; }
.geo-modal-body { padding: 16px 20px; }
.geo-modal-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 0 20px 18px; }
.geo-form-group { margin-bottom: 14px; }
.geo-form-label { display: block; font-size: 12px; color: #888; margin-bottom: 4px; font-weight: 500; }
.geo-textarea { resize: vertical; min-height: 80px; width: 100%; box-sizing: border-box; }
</style>
