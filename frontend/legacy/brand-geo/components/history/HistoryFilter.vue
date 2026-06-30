<!-- @deprecated — GEO v3 Legacy. Use design-system product blocks instead. -->
<template>
  <div class="geo-history-filter">
    <button
      v-for="opt in filterOptions"
      :key="opt.value"
      :class="['geo-filter-btn', { 'geo-filter-btn--active': activeFilter === opt.value }]"
      @click="$emit('filter-change', opt.value)"
    >
      {{ opt.label }}
    </button>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  activeFilter?: string
}>(), {
  activeFilter: '',
})

defineEmits<{
  'filter-change': [value: string]
}>()

const filterOptions = [
  { value: '', label: '全部' },
  { value: 'website_scanned', label: '网站扫描' },
  { value: 'knowledge_updated', label: '知识更新' },
  { value: 'evidence_generated', label: '证据生成' },
  { value: 'claim_generated', label: '声明生成' },
  { value: 'citation_generated', label: '引用生成' },
  { value: 'report_generated', label: '报告生成' },
]
</script>

<style scoped>
.geo-history-filter {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.geo-filter-btn {
  padding: 4px 12px;
  border-radius: 16px;
  border: 1px solid var(--geo-border);
  background: transparent;
  color: var(--geo-text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}
.geo-filter-btn:hover { border-color: var(--geo-accent); color: var(--geo-text); }
.geo-filter-btn--active { background: var(--geo-accent); border-color: var(--geo-accent); color: #fff; }
</style>
