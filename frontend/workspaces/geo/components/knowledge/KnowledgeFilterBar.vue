<template>
  <div class="geo-kb-filter">
    <div class="geo-kb-filter__buttons">
      <button
        v-for="f in filters"
        :key="f.key"
        :class="['geo-kb-filter__btn', { 'geo-kb-filter__btn--active': activeFilter === f.key }]"
        @click="$emit('update:activeFilter', f.key)"
      >
        {{ f.label }}
        <span class="geo-kb-filter__count">{{ f.count }}</span>
      </button>
    </div>
    <div class="geo-kb-filter__sort">
      <label class="geo-kb-filter__sort-label">排序：</label>
      <select
        class="geo-kb-filter__sort-select"
        :value="activeSort"
        @change="$emit('update:activeSort', ($event.target as HTMLSelectElement).value)"
      >
        <option value="recent">最近更新</option>
        <option value="quality">最高质量</option>
        <option value="alpha">按字母排序</option>
        <option value="complete">最完整</option>
      </select>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { KnowledgeBrowserVM } from '../../viewmodels/KnowledgeBrowserVM'

const props = defineProps<{
  vm: KnowledgeBrowserVM
  activeFilter: string
  activeSort: string
}>()

defineEmits<{
  'update:activeFilter': [value: string]
  'update:activeSort': [value: string]
}>()

const filters = computed(() => [
  { key: 'all', label: 'All', count: props.vm.counts.total },
  { key: 'verified', label: 'Verified', count: props.vm.counts.verified },
  { key: 'needs-review', label: 'Needs Review', count: props.vm.counts.needsReview },
  { key: 'draft', label: 'Draft', count: props.vm.counts.draft },
  { key: 'published', label: 'Published', count: props.vm.counts.published },
])
</script>

<style scoped>
.geo-kb-filter {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.geo-kb-filter__buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.geo-kb-filter__btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 20px;
  background: #fff;
  font-size: 12px;
  color: #64748b;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}

.geo-kb-filter__btn:hover {
  border-color: #94a3b8;
  color: #1a1a2e;
}

.geo-kb-filter__btn--active {
  background: #eef2ff;
  border-color: #4f46e5;
  color: #4f46e5;
  font-weight: 500;
}

.geo-kb-filter__count {
  font-size: 11px;
  opacity: 0.7;
}

.geo-kb-filter__sort {
  display: flex;
  align-items: center;
  gap: 6px;
}

.geo-kb-filter__sort-label {
  font-size: 12px;
  color: #64748b;
  white-space: nowrap;
}

.geo-kb-filter__sort-select {
  padding: 5px 10px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fff;
  font-size: 12px;
  color: #1a1a2e;
  cursor: pointer;
  outline: none;
}

.geo-kb-filter__sort-select:focus {
  border-color: #3b82f6;
}
</style>
