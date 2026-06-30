<template>
  <div class="geo-page">
    <div class="geo-page-header">
      <div class="geo-page-header-left">
        <h2 class="geo-page-title">🏢 品牌</h2>
        <p class="geo-page-subtitle">管理你的品牌项目</p>
      </div>
      <div class="geo-page-header-right">
        <div class="geo-page-quota" v-if="quota">
          <span class="geo-quota-used">{{ brands.length }}</span>
          <span class="geo-quota-sep">/</span>
          <span class="geo-quota-limit">{{ quota.limit }}</span>
          <span class="geo-quota-label">品牌配额</span>
        </div>
        <button class="geo-btn geo-btn-primary" @click="openCreateModal" :disabled="quota && brands.length >= quota.limit">
          + 创建品牌
        </button>
      </div>
    </div>
    <div class="geo-search-bar">
      <input v-model="searchQuery" type="text" class="geo-input" placeholder="搜索品牌名称..." @input="filterBrands" />
    </div>
    <div v-if="!loading && filteredBrands.length === 0" class="geo-page-empty">
      <div class="geo-empty-state-icon">🏢</div>
      <div class="geo-empty-state-title">开始分析第一个品牌</div>
      <div class="geo-empty-state-desc">创建品牌后，系统将自动完成网站扫描、内容提取和报告生成</div>
      <button class="geo-btn geo-btn-primary" @click="openCreateModal">+ 创建品牌</button>
    </div>
    <BrandTable v-else :brands="filteredBrands" :loading="loading" @select="handleSelect" @edit="handleEdit" @delete="handleDelete" />
    <BrandFormModal v-if="showCreateModal" :is-edit="!!editingBrand" :initial="formInitial" :saving="saving" @close="closeCreateModal" @save="saveBrand" />
    <BrandDeleteModal v-if="showDeleteConfirm" :brand-name="deletingBrand?.name || ''" :saving="saving" @close="showDeleteConfirm = false" @confirm="deleteBrand" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import BrandTable from '../components/brand/BrandTable.vue'
import BrandFormModal from '../components/brand/BrandFormModal.vue'
import type { BrandForm } from '../components/brand/BrandFormModal.vue'
import BrandDeleteModal from '../components/brand/BrandDeleteModal.vue'
import type { BrandItem } from '../components/brand/types'
import { brandService } from '../services/brandService'

const loading = ref(false); const saving = ref(false)
const brands = ref<BrandItem[]>([]); const filteredBrands = ref<BrandItem[]>([])
const searchQuery = ref('')
const quota = ref<{ used: number; limit: number; membership: string } | null>(null)
const showCreateModal = ref(false); const showDeleteConfirm = ref(false)
const editingBrand = ref<BrandItem | null>(null); const deletingBrand = ref<BrandItem | null>(null)

const formInitial = computed(() => {
  const b = editingBrand.value
  if (!b) return undefined
  return { name: b.name, website: b.brandSetting?.website || '', industry: b.brandSetting?.industry || b.industry || '', region: b.brandSetting?.region || '', language: b.language || 'zh', description: b.brandSetting?.description || '' }
})

async function fetchBrands() {
  loading.value = true
  try {
    const res = await brandService.list()
    brands.value = res as unknown as BrandItem[]
    filteredBrands.value = brands.value
  } catch (err) { console.error('Failed to fetch brands:', err) }
  finally { loading.value = false }
}

function filterBrands() {
  const q = searchQuery.value.toLowerCase()
  if (!q) { filteredBrands.value = brands.value; return }
  filteredBrands.value = brands.value.filter(b => b.name.toLowerCase().includes(q) || (b.industry && b.industry.toLowerCase().includes(q)))
}

function handleSelect(brandId: string) {} // handled by parent
function handleEdit(brand: BrandItem) { editingBrand.value = brand; showCreateModal.value = true }
function handleDelete(brand: BrandItem) { deletingBrand.value = brand; showDeleteConfirm.value = true }
function openCreateModal() { editingBrand.value = null; showCreateModal.value = true }
function closeCreateModal() { showCreateModal.value = false; editingBrand.value = null }

async function saveBrand(form: BrandForm) {
  if (!form.name) return; saving.value = true
  try {
    if (editingBrand.value) {
      await brandService.update(editingBrand.value.id, { name: form.name } as any)
      await brandService.updateSettings(editingBrand.value.id, {
        brandName: form.name, website: form.website, industry: form.industry,
        region: form.region, language: form.language, description: form.description,
      })
    } else {
      await brandService.create(form as any)
    }
    closeCreateModal(); await fetchBrands()
  } catch (err) { console.error('Failed to save brand:', err) }
  finally { saving.value = false }
}

async function deleteBrand() {
  if (!deletingBrand.value) return; saving.value = true
  try {
    await brandService.remove(deletingBrand.value.id)
    showDeleteConfirm.value = false; deletingBrand.value = null; await fetchBrands()
  } catch (err) { console.error('Failed to delete brand:', err) }
  finally { saving.value = false }
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
.geo-search-bar { margin-bottom: 16px; }
.geo-input { width: 100%; padding: 10px 14px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.04); color: #e0e0e0; font-size: 13px; outline: none; transition: border-color 0.15s; box-sizing: border-box; }
.geo-input:focus { border-color: #818cf8; }

/* ── Empty State ── */
.geo-page-empty { padding: 80px 20px; text-align: center; }
.geo-empty-state-icon { font-size: 48px; margin-bottom: 16px; }
.geo-empty-state-title { font-size: 18px; font-weight: 700; margin-bottom: 8px; color: #e0e0e0; }
.geo-empty-state-desc { font-size: 13px; color: #6b7280; margin-bottom: 24px; }
</style>
