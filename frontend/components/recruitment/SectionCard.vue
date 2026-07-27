<!-- SectionCard — 内容分区卡片 -->
<!-- UX-03: 通用卡片容器，标题 + 操作 + 内容区 -->
<template>
  <div class="section-card">
    <div v-if="title || $slots.actions" class="section-header">
      <h3 v-if="title" class="section-title">{{ title }}</h3>
      <div v-if="$slots.actions" class="section-actions">
        <slot name="actions" />
      </div>
    </div>
    <div class="section-body">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title?: string
}>()
</script>

<style scoped>
.section-card {
  background: var(--rec-bg-secondary);
  border: 1px solid var(--rec-border-primary);
  border-radius: var(--rec-radius-lg);
  margin-bottom: var(--rec-space-4);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--rec-space-5) var(--rec-space-6) 0;
}

.section-title {
  font-size: var(--rec-text-lg);
  font-weight: 600;
  color: var(--rec-text-primary);
  margin: 0;
}

.section-actions {
  display: flex;
  gap: var(--rec-space-2);
}

.section-body {
  padding: var(--rec-space-5) var(--rec-space-6) var(--rec-space-6);
}

.section-header + .section-body {
  padding-top: var(--rec-space-4);
}
</style>
