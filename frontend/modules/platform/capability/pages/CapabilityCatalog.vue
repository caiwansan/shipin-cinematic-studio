<template>
  <div class="capability-catalog">
    <div class="catalog-header">
      <h1>能力目录</h1>
      <p class="subtitle">浏览和发现平台注册的所有能力契约</p>
    </div>

    <!-- Stats Overview -->
    <div class="stats-row" v-if="stats">
      <div class="stat-card">
        <div class="stat-value">{{ stats.totalContracts }}</div>
        <div class="stat-label">总契约数</div>
      </div>
      <div class="stat-card active">
        <div class="stat-value">{{ stats.activeContracts }}</div>
        <div class="stat-label">活跃</div>
      </div>
      <div class="stat-card deprecated">
        <div class="stat-value">{{ stats.deprecatedContracts }}</div>
        <div class="stat-label">已废弃</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.categoriesCount }}</div>
        <div class="stat-label">分类数</div>
      </div>
    </div>

    <!-- Search & Filter -->
    <div class="filter-bar">
      <div class="search-box">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="搜索能力名称、描述或标签..."
          @input="onSearchDebounced"
        />
      </div>
      <div class="category-filter">
        <select v-model="selectedCategory" @change="onFilterChange">
          <option value="">全部分类</option>
          <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
        </select>
      </div>
      <div class="status-filter">
        <select v-model="selectedStatus" @change="onFilterChange">
          <option value="">全部状态</option>
          <option value="active">活跃</option>
          <option value="deprecated">已废弃</option>
          <option value="removed">已移除</option>
        </select>
      </div>
    </div>

    <!-- Category Tabs -->
    <div class="category-tabs">
      <button
        v-for="cat in categoryList"
        :key="cat.value"
        :class="['tab-btn', { active: selectedCategory === cat.value }]"
        @click="selectedCategory = cat.value; onFilterChange()"
      >
        <span class="tab-icon">{{ cat.icon }}</span>
        <span class="tab-label">{{ cat.label }}</span>
      </button>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>加载中...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-state">
      <p>⚠️ {{ error }}</p>
      <button @click="loadContracts">重试</button>
    </div>

    <!-- Contract List -->
    <div v-else-if="contracts.length === 0" class="empty-state">
      <p>暂无能力契约</p>
    </div>

    <div v-else class="contract-grid">
      <div
        v-for="contract in contracts"
        :key="contract.id"
        class="contract-card"
        @click="showContractDetail(contract)"
      >
        <div class="card-header">
          <span class="category-badge" :style="getCategoryStyle(contract.category)">
            {{ contract.category }}
          </span>
          <span :class="['status-badge', contract.status]">
            {{ statusLabel(contract.status) }}
          </span>
        </div>
        <div class="card-body">
          <h3>{{ contract.displayName }}</h3>
          <p class="contract-name">{{ contract.name }}</p>
          <p v-if="contract.description" class="description">{{ truncate(contract.description, 80) }}</p>
        </div>
        <div class="card-footer">
          <span class="version">v{{ contract.version }}</span>
          <span v-if="contract.tags" class="tags">
            <span v-for="tag in parseTags(contract.tags)" :key="tag" class="tag">{{ tag }}</span>
          </span>
        </div>
      </div>
    </div>

    <!-- Contract Detail Modal -->
    <div v-if="selectedContract" class="modal-overlay" @click.self="selectedContract = null">
      <div class="modal-content">
        <div class="modal-header">
          <h2>{{ selectedContract.displayName }}</h2>
          <button class="close-btn" @click="selectedContract = null">&times;</button>
        </div>
        <div class="modal-body">
          <div class="detail-section">
            <label>名称</label>
            <code>{{ selectedContract.name }}</code>
          </div>
          <div class="detail-section">
            <label>分类</label>
            <span :class="['category-badge', selectedContract.category]">{{ selectedContract.category }}</span>
          </div>
          <div class="detail-section">
            <label>版本</label>
            <span>v{{ selectedContract.version }}</span>
          </div>
          <div class="detail-section">
            <label>状态</label>
            <span :class="['status-badge', selectedContract.status]">{{ statusLabel(selectedContract.status) }}</span>
          </div>
          <div v-if="selectedContract.description" class="detail-section">
            <label>描述</label>
            <p>{{ selectedContract.description }}</p>
          </div>

          <!-- Schema -->
          <div v-if="selectedContract.inputSchema" class="detail-section">
            <label>输入 Schema</label>
            <pre>{{ formatJson(selectedContract.inputSchema) }}</pre>
          </div>
          <div v-if="selectedContract.outputSchema" class="detail-section">
            <label>输出 Schema</label>
            <pre>{{ formatJson(selectedContract.outputSchema) }}</pre>
          </div>

          <!-- Constraints -->
          <div v-if="selectedContract.constraints" class="detail-section">
            <label>约束</label>
            <pre>{{ formatJson(selectedContract.constraints) }}</pre>
          </div>

          <!-- Tags -->
          <div v-if="selectedContract.tags" class="detail-section">
            <label>标签</label>
            <div class="tag-list">
              <span v-for="tag in parseTags(selectedContract.tags)" :key="tag" class="tag">{{ tag }}</span>
            </div>
          </div>

          <!-- Quality Profile -->
          <div v-if="selectedContract.qualityProfile" class="detail-section">
            <label>质量配置</label>
            <pre>{{ formatJson(selectedContract.qualityProfile) }}</pre>
          </div>

          <!-- Metadata -->
          <div class="detail-section meta">
            <label>元数据</label>
            <p>schemaVersion: {{ selectedContract.schemaVersion }}</p>
            <p>创建时间: {{ formatDate(selectedContract.createdAt) }}</p>
            <p>更新时间: {{ formatDate(selectedContract.updatedAt) }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { capabilityService } from '../services/capability.service'
import { CAPABILITY_CATEGORIES, type CapabilityContract, type CapabilityStats } from '../types/index'

const contracts = ref<CapabilityContract[]>([])
const selectedContract = ref<CapabilityContract | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const stats = ref<CapabilityStats | null>(null)
const categories = ref<string[]>([])
const searchQuery = ref('')
const selectedCategory = ref('')
const selectedStatus = ref('')
const categoryList = CAPABILITY_CATEGORIES

let searchTimer: ReturnType<typeof setTimeout> | null = null

onMounted(async () => {
  await Promise.all([
    loadContracts(),
    loadStats(),
    loadCategories(),
  ])
})

async function loadContracts() {
  loading.value = true
  error.value = null
  try {
    const result = await capabilityService.listContracts({
      category: selectedCategory.value || undefined,
      status: selectedStatus.value || undefined,
      search: searchQuery.value || undefined,
      limit: 100,
    })
    contracts.value = result.items
  } catch (err: any) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

async function loadStats() {
  stats.value = await capabilityService.getStats()
}

async function loadCategories() {
  categories.value = await capabilityService.getCategories()
}

function onSearchDebounced() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(loadContracts, 300)
}

function onFilterChange() {
  loadContracts()
}

function showContractDetail(contract: CapabilityContract) {
  selectedContract.value = contract
}

function parseTags(tags: string | null): string[] {
  if (!tags) return []
  try {
    return JSON.parse(tags)
  } catch {
    return []
  }
}

function formatJson(str: string | null): string {
  if (!str) return ''
  try {
    return JSON.stringify(JSON.parse(str), null, 2)
  } catch {
    return str
  }
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = { active: '活跃', deprecated: '已废弃', removed: '已移除' }
  return labels[status] || status
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + '...' : text
}

function getCategoryStyle(category: string): Record<string, string> {
  const cat = categoryList.find(c => c.value === category)
  return { background: getCategoryColor(category) }
}

function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    Generation: '#6366f1', Analysis: '#8b5cf6', Extraction: '#a855f7',
    Transformation: '#d946ef', Publishing: '#ec4899', Reasoning: '#f43f5e',
    Search: '#f97316', Translation: '#eab308', Vision: '#22c55e',
    Audio: '#14b8a6', Video: '#06b6d4', Workflow: '#0ea5e9',
    Knowledge: '#3b82f6', Utility: '#64748b',
  }
  return colors[category] || '#64748b'
}
</script>

<style scoped>
.capability-catalog {
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;
}

.catalog-header h1 {
  margin: 0;
  font-size: 1.8rem;
  color: #f1f5f9;
}

.subtitle {
  color: #94a3b8;
  margin: 4px 0 0;
}

/* Stats */
.stats-row {
  display: flex;
  gap: 16px;
  margin: 24px 0;
}

.stat-card {
  background: #1e293b;
  border-radius: 8px;
  padding: 16px 24px;
  flex: 1;
  text-align: center;
  border: 1px solid #334155;
}

.stat-value {
  font-size: 2rem;
  font-weight: 700;
  color: #f1f5f9;
}

.stat-label {
  font-size: 0.85rem;
  color: #94a3b8;
  margin-top: 4px;
}

.stat-card.active { border-color: #22c55e; }
.stat-card.deprecated { border-color: #f97316; }

/* Filter Bar */
.filter-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}

.search-box {
  flex: 1;
}

.search-box input {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid #334155;
  border-radius: 8px;
  background: #1e293b;
  color: #f1f5f9;
  font-size: 0.9rem;
}

.search-box input::placeholder { color: #64748b; }

.category-filter select,
.status-filter select {
  padding: 10px 14px;
  border: 1px solid #334155;
  border-radius: 8px;
  background: #1e293b;
  color: #f1f5f9;
  font-size: 0.9rem;
}

/* Category Tabs */
.category-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 24px;
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border: 1px solid #334155;
  border-radius: 20px;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
  font-size: 0.85rem;
  transition: all 0.2s;
}

.tab-btn:hover { border-color: #6366f1; color: #f1f5f9; }
.tab-btn.active {
  background: #6366f1;
  border-color: #6366f1;
  color: white;
}

/* Contract Grid */
.contract-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}

.contract-card {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 10px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.2s;
}

.contract-card:hover {
  border-color: #6366f1;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.15);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.category-badge {
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 0.75rem;
  color: white;
  font-weight: 500;
}

.status-badge {
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 0.75rem;
  font-weight: 500;
}

.status-badge.active { background: #166534; color: #86efac; }
.status-badge.deprecated { background: #9a3412; color: #fdba74; }
.status-badge.removed { background: #7f1d1d; color: #fca5a5; }

.card-body h3 {
  margin: 0 0 4px;
  color: #f1f5f9;
  font-size: 1rem;
}

.contract-name {
  font-family: monospace;
  color: #64748b;
  font-size: 0.8rem;
  margin: 0 0 8px;
}

.description {
  color: #94a3b8;
  font-size: 0.85rem;
  margin: 0;
  line-height: 1.4;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
}

.version {
  font-size: 0.8rem;
  color: #6366f1;
  font-family: monospace;
}

.tags {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.tag {
  padding: 1px 6px;
  background: #334155;
  border-radius: 4px;
  font-size: 0.7rem;
  color: #94a3b8;
}

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: #1e293b;
  border-radius: 12px;
  width: 90%;
  max-width: 700px;
  max-height: 80vh;
  overflow-y: auto;
  border: 1px solid #334155;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #334155;
}

.modal-header h2 { margin: 0; color: #f1f5f9; }

.close-btn {
  background: none;
  border: none;
  color: #94a3b8;
  font-size: 1.5rem;
  cursor: pointer;
}

.modal-body { padding: 20px 24px; }

.detail-section {
  margin-bottom: 16px;
}

.detail-section label {
  display: block;
  font-size: 0.8rem;
  color: #64748b;
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.detail-section p { margin: 0; color: #e2e8f0; font-size: 0.9rem; }
.detail-section code {
  color: #a5b4fc;
  font-family: monospace;
  font-size: 0.9rem;
}

.detail-section pre {
  background: #0f172a;
  padding: 12px;
  border-radius: 6px;
  overflow-x: auto;
  font-size: 0.8rem;
  color: #a5b4fc;
  max-height: 200px;
}

.tag-list { display: flex; gap: 4px; flex-wrap: wrap; }

.detail-section.meta p { color: #94a3b8; font-size: 0.8rem; }

/* States */
.loading-state, .error-state, .empty-state {
  text-align: center;
  padding: 48px;
  color: #94a3b8;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #334155;
  border-top-color: #6366f1;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 12px;
}

@keyframes spin { to { transform: rotate(360deg); } }

.error-state button {
  margin-top: 12px;
  padding: 8px 20px;
  background: #6366f1;
  border: none;
  border-radius: 6px;
  color: white;
  cursor: pointer;
}
</style>
