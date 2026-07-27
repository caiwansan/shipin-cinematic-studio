<!-- PendingList — 需要处理列表 -->
<!-- UX-03: 人工介入的操作入口，永远第一屏 -->
<template>
  <div class="pending-list">
    <div
      v-for="item in items"
      :key="item.label"
      class="pending-item"
      @click="item.href && $router.push(item.href)"
    >
      <span class="pending-label">{{ item.label }}</span>
      <span class="pending-count">{{ item.count }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  items: Array<{ label: string; count: number; href?: string }>
}>()
</script>

<style scoped>
.pending-list {
  display: flex;
  flex-direction: column;
  gap: var(--rec-space-2);
}

.pending-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--rec-space-3) var(--rec-space-4);
  border-radius: var(--rec-radius-md);
  background: var(--rec-bg-tertiary);
  cursor: pointer;
  transition: background 0.15s;
}

.pending-item:hover {
  background: var(--rec-bg-hover);
}

.pending-label {
  font-size: var(--rec-text-md);
  color: var(--rec-text-primary);
}

.pending-count {
  font-size: var(--rec-text-lg);
  font-weight: 700;
  color: var(--rec-warning);
  font-family: var(--rec-font-mono);
}
</style>
