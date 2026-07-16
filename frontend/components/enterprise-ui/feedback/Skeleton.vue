<!-- Skeleton — 骨架屏 -->
<!-- 所有异步加载页面的占位符 -->
<!-- 禁止裸 "Loading..." 文字 -->
<template>
  <div class="skeleton" :class="`skeleton--${variant}`">
    <div class="skeleton-line" v-for="line in lines" :key="line" :style="{ width: `${100 - (line * 10)}%` }" />
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  variant?: 'card' | 'list' | 'table'
  lines?: number
}>(), {
  variant: 'card',
  lines: 3,
})
</script>

<style scoped>
.skeleton {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}
.skeleton-line {
  height: 12px;
  background: var(--color-bg-hover);
  border-radius: var(--radius-sm);
  animation: skeleton-pulse 1.5s infinite;
}
@keyframes skeleton-pulse {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}
</style>
