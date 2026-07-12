<template>
  <div class="geo-evidence-list">
    <div v-if="items.length === 0" class="geo-evidence-list__empty">
      <slot name="empty">
        <span class="geo-evidence-list__empty-text">{{ emptyText }}</span>
      </slot>
    </div>
    <template v-else>
      <div
        v-for="(item, idx) in visibleItems"
        :key="idx"
        class="geo-evidence-list__item"
      >
        <slot name="item" :item="item" :index="idx">
          <div class="geo-evidence-list__item-default">
            <span class="geo-evidence-list__item-title">{{ item.title }}</span>
            <span v-if="showSource && item.source" class="geo-evidence-list__item-source">{{ item.source }}</span>
          </div>
        </slot>
      </div>
      <div v-if="hasMore" class="geo-evidence-list__expand">
        <slot name="expand" :remaining="items.length - (maxItems ?? items.length)">
          <button class="geo-evidence-list__expand-btn" @click="expanded = !expanded">
            {{ expanded ? '收起' : `展开全部 (${items.length - (maxItems ?? items.length)} 项)` }}
          </button>
        </slot>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

export interface EvidenceItem {
  id?: string
  title: string
  source?: string
  [key: string]: unknown
}

const props = withDefaults(defineProps<{
  items: EvidenceItem[]
  maxItems?: number
  showSource?: boolean
  emptyText?: string
}>(), {
  maxItems: 5,
  showSource: false,
  emptyText: '暂无证据数据',
})

const expanded = ref(false)

const visibleItems = computed(() => {
  if (expanded.value || !props.maxItems) return props.items
  return props.items.slice(0, props.maxItems)
})

const hasMore = computed(() => {
  return props.maxItems && props.items.length > props.maxItems
})
</script>

<style scoped>
.geo-evidence-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.geo-evidence-list__empty {
  padding: 24px;
  text-align: center;
  color: #9ca3af;
  font-size: 14px;
}

.geo-evidence-list__item {
  display: flex;
  align-items: center;
  padding: 10px 16px;
  background-color: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}

.geo-evidence-list__item-default {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.geo-evidence-list__item-title {
  font-size: 14px;
  font-weight: 500;
  color: #111827;
}

.geo-evidence-list__item-source {
  font-size: 12px;
  color: #6b7280;
  background-color: #f3f4f6;
  padding: 2px 8px;
  border-radius: 4px;
}

.geo-evidence-list__expand {
  text-align: center;
}

.geo-evidence-list__expand-btn {
  padding: 6px 16px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: white;
  font-size: 13px;
  color: #374151;
  cursor: pointer;
  transition: background 0.15s;
}

.geo-evidence-list__expand-btn:hover {
  background: #f3f4f6;
}
</style>
