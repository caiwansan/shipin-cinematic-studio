<template>
  <div class="geo-page">
    <div class="geo-page-header">
      <div class="geo-page-header-left">
        <h2 class="geo-page-title">🏢 品牌管理</h2>
        <p class="geo-page-subtitle">管理你的品牌项目，配置品牌基本信息</p>
      </div>
      <div class="geo-page-header-right">
        <div class="geo-page-quota" v-if="quota">
          <span class="geo-quota-used">{{ brands.length }}</span>
          <span class="geo-quota-sep">/</span>
          <span class="geo-quota-limit">{{ quota.limit }}</span>
          <span class="geo-quota-label">品牌配额</span>
        </div>
        <button class="geo-btn geo-btn-primary" @click="showCreateModal = true" :disabled="quota && brands.length >= quota.limit">
          + 创建品牌
        </button>
      </div>
    </div>

    <!-- Search -->
    <div class="geo-search-bar">
      <input
        v-model="searchQuery"
        type="text"
        class="geo-input"
        placeholder="搜索品牌名称..."
        @input="filterBrands"
      />
    </div>

    <!-- Brand Table -->
    <div class="geo-table-container">
      <div v-if="loading" class="geo-table-loading">
        <div class="geo-loading-spinner"></div>
        <span>加载中...</span>
      </div>
      <table v-else-if="filteredBrands.length > 0" class="geo-table">
        <thead>
          <tr>
            <th>品牌名称</th>
            <th>行业</th>
            <th>语言</th>
            <th>官网</th>
            <th>状态</th>
            <th>创建时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="brand in filteredBrands" :key="brand.id">
            <td class="geo-cell-name">
              <a class="geo-link" @click="$emit('navigate', 'brands'); selectBrand(brand.id)">
                {{ brand.name }}
              </a>
            </td>
            <td>{{ brand.industry || '-' }}</td>
            <td>{{ brand.language || 'zh' }}</td>
            <td>
              <span v-if="brand.brandSetting?.website" class="geo-cell-url" :title="brand.brandSetting.website">
                {{ brand.brandSetting.website.substring(0, 30) }}{{ brand.brandSetting.website.length > 30 ? '...' : '' }}
              </span>
              <span v-else class="geo-cell-muted">未配置</span>
            </td>
            <td>
              <span :class="['geo-status-badge', `geo-status--${brand.status}`]">{{ brand.status }}</span>
            </td>
            <td class="geo-cell-date">{{ formatDate(brand.createdAt) }}</td>
            <td class="geo-cell-actions">
              <button class="geo-btn-sm" @click="editBrand(brand)">编辑</button>
              <button class="geo-btn-sm geo-btn-danger" @click="confirmDelete(brand)">删除</button>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-else class="geo-table-empty">
        <p>暂无品牌，点击上方「创建品牌」开始</p>
      </div>
    </div>

    <!-- Create / Edit Modal -->
    <div v-if="showCreateModal" class="geo-modal-overlay" @click.self="showCreateModal = false">
      <div class="geo-modal">
        <div class="geo-modal-header">
          <h3>{{ editingBrand ? '编辑品牌' : '创建品牌' }}</h3>
          <button class="geo-modal-close" @click="showCreateModal = false">✕</button>
        </div>
        <div class="geo-modal-body">
          <div class="geo-form-group">
            <label class="geo-form-label">品牌名称 *</label>
            <input v-model="form.name" class="geo-input" placeholder="输入品牌名称" />
          </div>
          <div class="geo-form-group">
            <label class="geo-form-label">官网地址</label>
            <input v-model="form.website" class="geo-input" placeholder="https://example.com" />
          </div>
          <div class="geo-form-row">
            <div class="geo-form-group">
              <label class="geo-form-label">行业</label>
              <input v-model="form.industry" class="geo-input" placeholder="如：科技、教育" />
            </div>
            <div class="geo-form-group">
              <label class="geo-form-label">地区</label>
              <input v-model="form.region" class="geo-input" placeholder="如：中国、全球" />
            </div>
          </div>
          <div class="geo-form-group">
            <label class="geo-form-label">语言</label>
            <select v-model="form.language" class="geo-input">
              <option value="zh">中文</option>
              <option value="en">English</option>
              <option value="ja">日本語</option>
              <option value="ko">한국어</option>
            </select>
          </div>
          <div class="geo-form-group">
            <label class="geo-form-label">品牌描述</label>
            <textarea v-model="form.description" class="geo-input geo-textarea" placeholder="品牌简介、核心业务等" rows="3"></textarea>
          </div>
        </div>
        <div class="geo-modal-footer">
          <button class="geo-btn geo-btn-ghost" @click="showCreateModal = false">取消</button>
          <button class="geo-btn geo-btn-primary" @click="saveBrand" :disabled="saving || !form.name">
            {{ saving ? '保存中...' : '保存' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Delete Confirm Modal -->
    <div v-if="showDeleteConfirm" class="geo-modal-overlay" @click.self="showDeleteConfirm = false">
      <div class="geo-modal geo-modal-sm">
        <div class="geo-modal-header">
          <h3>确认删除</h3>
          <button class="geo-modal-close" @click="showDeleteConfirm = false">✕</button>
        </div>
        <div class="geo-modal-body">
          <p>确定要删除品牌「{{ deletingBrand?.name }}」吗？此操作不可撤销，关联数据将被保留。</p>
        </div>
        <div class="geo-modal-footer">
          <button class="geo-btn geo-btn-ghost" @click="showDeleteConfirm = false">取消</button>
          <button class="geo-btn geo-btn-danger" @click="deleteBrand" :disabled="saving">
            {{ saving ? '删除中...' : '确认删除' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

interface BrandSetting {
  projectId: string
  brandName: string
  website: string | null
  industry: string | null
  region: string | null
  language: string | null
  description: string | null
  logo: string | null
  status: string
}

interface BrandItem {
  id: string
  userId: string
  name: string
  topic: string | null
  industry: string | null
  language: string
  status: string
  createdAt: string
  updatedAt: string
  brandSetting: BrandSetting | null
}

interface BrandsResponse {
  success: boolean
  data: BrandItem[]
  quota: { used: number; limit: number; membership: string }
}

const emit = defineEmits<{
  navigate: [panelId: string]
  selectBrand: [brandId: string]
}>()

const loading = ref(false)
const saving = ref(false)
const brands = ref<BrandItem[]>([])
const filteredBrands = ref<BrandItem[]>([])
const searchQuery = ref('')
const quota = ref<{ used: number; limit: number; membership: string } | null>(null)
const showCreateModal = ref(false)
const showDeleteConfirm = ref(false)
const editingBrand = ref<BrandItem | null>(null)
const deletingBrand = ref<BrandItem | null>(null)

const form = ref({
  name: '',
  website: '',
  industry: '',
  region: '',
  language: 'zh',
  description: '',
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

async function fetchBrands() {
  loading.value = true
  try {
    const res = await fetch('/api/geo/brands', { headers: authHeaders() })
    const json: BrandsResponse = await res.json()
    if (json.success) {
      brands.value = json.data
      filteredBrands.value = json.data
      quota.value = json.quota
    }
  } catch (err) {
    console.error('Failed to fetch brands:', err)
  } finally {
    loading.value = false
  }
}

function filterBrands() {
  const q = searchQuery.value.toLowerCase()
  if (!q) {
    filteredBrands.value = brands.value
    return
  }
  filteredBrands.value = brands.value.filter(b =>
    b.name.toLowerCase().includes(q) ||
    (b.industry && b.industry.toLowerCase().includes(q))
  )
}

function editBrand(brand: BrandItem) {
  editingBrand.value = brand
  form.value = {
    name: brand.name,
    website: brand.brandSetting?.website || '',
    industry: brand.brandSetting?.industry || brand.industry || '',
    region: brand.brandSetting?.region || '',
    language: brand.language || 'zh',
    description: brand.brandSetting?.description || '',
  }
  showCreateModal.value = true
}

function confirmDelete(brand: BrandItem) {
  deletingBrand.value = brand
  showDeleteConfirm.value = true
}

function selectBrand(brandId: string) {
  // Navigate to brand detail
  emit('selectBrand', brandId)
}

async function saveBrand() {
  if (!form.value.name) return
  saving.value = true
  try {
    if (editingBrand.value) {
      // Update existing brand
      await fetch(`/api/geo/brands/${editingBrand.value.id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ name: form.value.name }),
      })
      await fetch(`/api/geo/brands/${editingBrand.value.id}/settings`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({
          brandName: form.value.name,
          website: form.value.website,
          industry: form.value.industry,
          region: form.value.region,
          language: form.value.language,
          description: form.value.description,
        }),
      })
    } else {
      // Create new brand
      await fetch('/api/geo/brands', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          name: form.value.name,
          website: form.value.website,
          industry: form.value.industry,
          region: form.value.region,
          language: form.value.language,
          description: form.value.description,
        }),
      })
    }
    showCreateModal.value = false
    editingBrand.value = null
    form.value = { name: '', website: '', industry: '', region: '', language: 'zh', description: '' }
    await fetchBrands()
  } catch (err) {
    console.error('Failed to save brand:', err)
  } finally {
    saving.value = false
  }
}

async function deleteBrand() {
  if (!deletingBrand.value) return
  saving.value = true
  try {
    await fetch(`/api/geo/brands/${deletingBrand.value.id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    })
    showDeleteConfirm.value = false
    deletingBrand.value = null
    await fetchBrands()
  } catch (err) {
    console.error('Failed to delete brand:', err)
  } finally {
    saving.value = false
  }
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
  } catch { return iso }
}

onMounted(fetchBrands)
</script>

<style scoped>
.geo-page { padding: 24px; color: #e0e0e0; height: 100%; overflow-y: auto; }

.geo-page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
.geo-page-header-left { }
.geo-page-title { font-size: 20px; font-weight: 700; margin: 0 0 4px; }
.geo-page-subtitle { color: #888; font-size: 13px; margin: 0; }
.geo-page-header-right { display: flex; align-items: center; gap: 12px; }
.geo-page-quota { display: flex; align-items: center; gap: 4px; font-size: 12px; color: #6b7280; padding: 4px 10px; background: rgba(255,255,255,0.04); border-radius: 6px; }
.geo-quota-used { color: #818cf8; font-weight: 700; }
.geo-quota-sep { color: #444; }
.geo-quota-limit { font-weight: 600; }
.geo-quota-label { margin-left: 4px; }

.geo-btn { padding: 8px 20px; border-radius: 6px; border: none; cursor: pointer; font-size: 14px; font-weight: 600; transition: all 0.15s; }
.geo-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.geo-btn-primary { background: linear-gradient(135deg, #818cf8, #6366f1); color: white; }
.geo-btn-primary:hover:not(:disabled) { opacity: 0.9; }
.geo-btn-ghost { background: rgba(255,255,255,0.06); color: #ccc; }
.geo-btn-ghost:hover { background: rgba(255,255,255,0.1); }
.geo-btn-danger { background: rgba(239,68,68,0.2); color: #ef4444; }
.geo-btn-danger:hover { background: rgba(239,68,68,0.3); }

.geo-btn-sm { padding: 4px 10px; border-radius: 4px; border: none; cursor: pointer; font-size: 12px; background: rgba(255,255,255,0.06); color: #aaa; transition: all 0.15s; }
.geo-btn-sm:hover { background: rgba(255,255,255,0.1); color: #ddd; }
.geo-btn-sm.geo-btn-danger { background: rgba(239,68,68,0.15); color: #fca5a5; }
.geo-btn-sm.geo-btn-danger:hover { background: rgba(239,68,68,0.25); }

.geo-search-bar { margin-bottom: 16px; }
.geo-input { width: 100%; padding: 10px 14px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.04); color: #e0e0e0; font-size: 13px; outline: none; transition: border-color 0.15s; box-sizing: border-box; }
.geo-input:focus { border-color: #818cf8; }
.geo-textarea { resize: vertical; min-height: 60px; }

.geo-table-container { background: #1a1a2e; border-radius: 10px; border: 1px solid rgba(255,255,255,0.04); overflow: hidden; }
.geo-table { width: 100%; border-collapse: collapse; }
.geo-table th { padding: 12px 16px; text-align: left; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid rgba(255,255,255,0.04); }
.geo-table td { padding: 12px 16px; font-size: 13px; border-bottom: 1px solid rgba(255,255,255,0.03); }
.geo-table tr:last-child td { border-bottom: none; }
.geo-table tr:hover td { background: rgba(255,255,255,0.02); }

.geo-cell-name { font-weight: 600; }
.geo-link { color: #818cf8; cursor: pointer; }
.geo-link:hover { color: #a5b4fc; text-decoration: underline; }
.geo-cell-url { color: #34d399; font-size: 12px; }
.geo-cell-muted { color: #555; }
.geo-cell-date { color: #6b7280; font-size: 12px; }
.geo-cell-actions { display: flex; gap: 6px; }

.geo-status-badge { padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; }
.geo-status--active { background: rgba(52,211,153,0.15); color: #34d399; }
.geo-status--draft { background: rgba(156,163,175,0.15); color: #9ca3af; }
.geo-status--completed { background: rgba(129,140,248,0.15); color: #818cf8; }

.geo-table-loading { padding: 40px; text-align: center; color: #6b7280; display: flex; align-items: center; justify-content: center; gap: 8px; }
.geo-loading-spinner { width: 16px; height: 16px; border: 2px solid rgba(129,140,248,0.2); border-top-color: #818cf8; border-radius: 50%; animation: spin 0.6s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.geo-table-empty { padding: 60px 20px; text-align: center; color: #666; font-size: 14px; }

/* Modal */
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
.geo-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.geo-form-row .geo-form-group { margin-bottom: 0; }
</style>
