<!-- EmptyState — 空状态 -->
<!-- 所有无数据页面的占位符 -->
<!-- 禁止裸 "No data" 文字 -->
<template>
  <div class="empty-state">
    <div class="empty-icon">{{ icon }}</div>
    <div class="empty-title">{{ title }}</div>
    <div class="empty-description" v-if="description">{{ description }}</div>
    <div class="empty-helper" v-if="helper">{{ helper }}</div>
    <button v-if="action" class="empty-action" @click="$emit('action')">
      {{ action }}
    </button>
    <slot name="action"></slot>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  icon?: string
  title: string
  description?: string
  helper?: string
  action?: string
}>(), {
  icon: '🎯',
})
defineEmits<{
  action: []
}>()
</script>

<style scoped>
.empty-state {
  text-align: center;
  padding: var(--space-2xl);
  background: var(--color-bg-secondary);
  border: 1px dashed var(--color-border-primary);
  border-radius: var(--radius-lg);
}
.empty-icon {
  font-size: 32px;
  margin-bottom: var(--space-md);
}
.empty-title {
  font-size: var(--font-size-md);
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: var(--space-sm);
}
.empty-description {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin-bottom: var(--space-sm);
  line-height: 1.6;
}
.empty-helper {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  margin-bottom: var(--space-md);
  font-style: italic;
}
.empty-action {
  padding: var(--space-sm) var(--space-md);
  background: var(--color-bg-hover);
  border: 1px solid var(--color-border-secondary);
  border-radius: var(--radius-md);
  color: var(--color-text-secondary);
  cursor: pointer;
  font-size: var(--font-size-sm);
  transition: all 0.2s;
}
.empty-action:hover {
  background: var(--color-bg-active);
  color: var(--color-text-primary);
}
</style>
