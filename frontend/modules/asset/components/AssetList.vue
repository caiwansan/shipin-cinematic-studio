<template>
  <div class="asset-list">
    <!-- Search & Filter Bar -->
    <div class="asset-list-toolbar">
      <div class="asset-search-box">
        <span class="asset-search-icon">🔍</span>
        <input
          v-model="searchQuery"
          class="asset-search-input"
          placeholder="搜索资产..."
          @input="onSearchDebounced"
        />
      </div>

      <select v-model="filterType" class="asset-filter-select" @change="onFilterChange">
        <option value="">全部类型</option>
        <option v-for="type in types" :key="type" :value="type">{{ type }}</option>
      </select>

      <select v-model="filterStatus" class="asset-filter-select" @change="onFilterChange">
        <option value="">全部状态</option>
        <option value="draft">草稿</option>
        <option value="published">已发布</option>
        <option value="archived">已归档</option>
      </select>

      <select v-model="filterSource" class="asset-filter-select" @change="onFilterChange">
        <option value="">全部来源</option>
        <option value="scanner">扫描</option>
        <option value="import">导入</option>
        <option value="manual">手动</option>
        <option value="api">API</option>
      </select>
    </div>

    <!-- Loading indicator -->
    <div v-if="loading" class="asset-list-loading">
      <span class="loading-spinner"></span>
      <span>加载中...</span>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="asset-list-error">
      ⚠️ {{ error }}
    </div>

    <!-- Empty state -->
    <div v-else-if="items.length === 0" class="asset-list-empty">
      <div class="asset-empty-icon">📭</div>
      <p>暂无资产数据</p>
      <p class="asset-empty-hint">请先扫描网站或手动创建资产</p>
    </div>

    <!-- Asset cards -->
    <div v-else class="asset-grid">
      <AssetCard
        v-for="asset in items"
        :key="asset.id"
        :asset="asset"
        @click="$emit('select', asset)"
      />
    </div>

    <!-- Pagination -->
    <div v-if="total > limit" class="asset-list-pagination">
      <button
        :disabled="offset === 0"
        class="asset-page-btn"
        @click="goToPage(offset - limit)"
      >
        ← 上一页
      </button>
      <span class="asset-page-info">
        第 {{ Math.floor(offset / limit) + 1 }} / {{ Math.ceil(total / limit) }} 页
        (共 {{ total }} 条)
      </span>
      <button
        :disabled="offset + limit >= total"
        class="asset-page-btn"
        @click="goToPage(offset + limit)"
      >
        下一页 →
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import AssetCard from './AssetCard.vue'
import type { UnifiedAsset, AssetFilter } from '../types/index'
import { assetService } from '../services/asset.service'
import { ASSET_TYPES } from '../types/index'

const props = defineProps<{
  projectId: string
  initialFilter?: AssetFilter
}>()

const emit = defineEmits<{
  select: [asset: UnifiedAsset]
  loaded: [items: UnifiedAsset[], total: number]
}>()

const items = ref<UnifiedAsset[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref<string | null>(null)
const searchQuery = ref('')
const filterType = ref('')
const filterStatus = ref('')
const filterSource = ref('')
const offset = ref(0)
const limit = 50
const types = Object.values(ASSET_TYPES)

let searchTimer: ReturnType<typeof setTimeout> | null = null

async function loadAssets() {
  loading.value = true
  error.value = null
  try {
    const result = await assetService.list(props.projectId, {
      type: filterType.value || undefined,
      status: filterStatus.value || undefined,
      source: filterSource.value || undefined,
      search: searchQuery.value || undefined,
      limit,
      offset: offset.value,
    })
    items.value = result.items
    total.value = result.total
    emit('loaded', result.items, result.total)
  } catch (err: any) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

function onFilterChange() {
  offset.value = 0
  loadAssets()
}

function onSearchDebounced() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    offset.value = 0
    loadAssets()
  }, 300)
}

function goToPage(newOffset: number) {
  offset.value = Math.max(0, Math.min(newOffset, total.value))
  loadAssets()
}

onMounted(() => {
  loadAssets()
})

defineExpose({ refresh: loadAssets })
</script>

<style scoped>
.asset-list { padding: 16px 0; }
.asset-list-toolbar {
  display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap;
}
.asset-search-box {
  display: flex; align-items: center; flex: 1; min-width: 200px;
  background: #1a1f2e; border: 1px solid rgba(255,255,255,0.06);
  border-radius: 8px; padding: 0 12px;
}
.asset-search-icon { font-size: 14px; margin-right: 8px; }
.asset-search-input {
  background: transparent; border: none; outline: none;
  color: #e2e8f0; font-size: 14px; padding: 10px 0; width: 100%;
}
.asset-filter-select {
  background: #1a1f2e; border: 1px solid rgba(255,255,255,0.06);
  border-radius: 8px; color: #9ca3af; font-size: 13px; padding: 8px 12px;
  cursor: pointer; outline: none;
}
.asset-list-loading {
  display: flex; align-items: center; justify-content: center;
  gap: 8px; padding: 60px 0; color: #6b7280;
}
.loading-spinner {
  width: 20px; height: 20px; border: 2px solid rgba(99,102,241,0.2);
  border-top-color: #6366f1; border-radius: 50%; animation: spin 0.6s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.asset-list-error {
  text-align: center; padding: 40px; color: #fca5a5;
}
.asset-list-empty {
  text-align: center; padding: 60px 0; color: #6b7280;
}
.asset-empty-icon { font-size: 48px; margin-bottom: 12px; }
.asset-empty-hint { font-size: 13px; margin-top: 6px; color: #4b5563; }
.asset-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 12px;
}
.asset-list-pagination {
  display: flex; align-items: center; justify-content: center;
  gap: 16px; padding: 20px 0; margin-top: 16px;
}
.asset-page-btn {
  background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08);
  border-radius: 8px; padding: 8px 16px; color: #9ca3af; cursor: pointer; font-size: 13px;
}
.asset-page-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.asset-page-info { font-size: 13px; color: #6b7280; }
</style>
