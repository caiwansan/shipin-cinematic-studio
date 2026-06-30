<!-- @deprecated — GEO v3 Legacy. Use design-system product blocks instead. -->
<template>
  <div class="geo-filters-bar">
    <div class="geo-filter-group">
      <label class="geo-filter-label">项目</label>
      <select v-model="selectedProjectId" class="geo-input geo-input-sm" @change="$emit('project-change', selectedProjectId)">
        <option value="">选择品牌项目</option>
        <option v-for="p in projects" :key="p.id" :value="p.id">{{ p.name }}</option>
      </select>
    </div>
    <div class="geo-filter-group">
      <label class="geo-filter-label">类型</label>
      <select v-model="filterType" class="geo-input geo-input-sm" @change="$emit('type-change', filterType)">
        <option value="">全部类型</option>
        <option value="brand">品牌词</option>
        <option value="ai">AI词</option>
        <option value="industry">行业词</option>
        <option value="long_tail">长尾词</option>
      </select>
    </div>
    <div class="geo-filter-group">
      <label class="geo-filter-label">搜索</label>
      <input v-model="searchQuery" class="geo-input geo-input-sm" placeholder="搜索关键词..." @input="$emit('search-change', searchQuery)" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  projects: any[]
}>()

const emit = defineEmits<{
  'project-change': [id: string]
  'type-change': [type: string]
  'search-change': [query: string]
}>()

const selectedProjectId = ref('')
const filterType = ref('')
const searchQuery = ref('')

watch(() => props.projects, () => { /* no-op */ })
</script>

<style scoped>
.geo-filters-bar { display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
.geo-filter-group { display: flex; flex-direction: column; gap: 4px; }
.geo-filter-label { font-size: 11px; color: #6b7280; font-weight: 500; }
.geo-input { padding: 8px 12px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.04); color: #e0e0e0; font-size: 13px; outline: none; }
.geo-input:focus { border-color: #818cf8; }
.geo-input-sm { padding: 6px 10px; font-size: 12px; }
</style>
