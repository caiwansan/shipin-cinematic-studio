<template>
  <div class="geo-table-container">
    <div v-if="loading" class="geo-table-loading">
      <div class="geo-loading-spinner"></div>
      <span>加载中...</span>
    </div>
    <table v-else-if="brands.length > 0" class="geo-table">
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
        <tr v-for="brand in brands" :key="brand.id">
          <td class="geo-cell-name">
            <a class="geo-link" @click="handleSelect(brand.id)">
              {{ brand.name }}
            </a>
          </td>
          <td>{{ brand.industry || '-' }}</td>
          <td>{{ brand.language || 'zh' }}</td>
          <td>
            <span v-if="brand.brandSetting?.website" class="geo-cell-url" :title="brand.brandSetting.website">
              {{ truncate(brand.brandSetting.website, 30) }}
            </span>
            <span v-else class="geo-cell-muted">未配置</span>
          </td>
          <td>
            <span :class="['geo-status-badge', `geo-status--${brand.status}`]">{{ brand.status }}</span>
          </td>
          <td class="geo-cell-date">{{ formatDate(brand.createdAt) }}</td>
          <td class="geo-cell-actions">
            <button class="geo-btn-sm" @click="handleEdit(brand)">编辑</button>
            <button class="geo-btn-sm geo-btn-danger" @click="handleDelete(brand)">删除</button>
          </td>
        </tr>
      </tbody>
    </table>
    <div v-else class="geo-table-empty">
      <p>暂无品牌，点击上方「创建品牌」开始</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { BrandItem } from '../brand/types'

defineProps<{
  brands: BrandItem[]
  loading: boolean
}>()

const emit = defineEmits<{
  select: [brandId: string]
  edit: [brand: BrandItem]
  delete: [brand: BrandItem]
}>()

function handleSelect(brandId: string) {
  emit('select', brandId)
}

function handleEdit(brand: BrandItem) {
  emit('edit', brand)
}

function handleDelete(brand: BrandItem) {
  emit('delete', brand)
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.substring(0, max) + '...' : s
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
  } catch { return iso }
}
</script>

<style scoped>
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
.geo-btn-sm { padding: 4px 10px; border-radius: 4px; border: none; cursor: pointer; font-size: 12px; background: rgba(255,255,255,0.06); color: #aaa; transition: all 0.15s; }
.geo-btn-sm:hover { background: rgba(255,255,255,0.1); color: #ddd; }
.geo-btn-sm.geo-btn-danger { background: rgba(239,68,68,0.15); color: #fca5a5; }
.geo-btn-sm.geo-btn-danger:hover { background: rgba(239,68,68,0.25); }
</style>
