<!-- KnowledgeLoading.vue — 加载骨架屏 -->
<template>
  <div class="geo-knowledge-loading">
    <div class="geo-knowledge-loading__hero geo-knowledge-loading__skeleton"></div>
    <div class="geo-knowledge-loading__grid">
      <div class="geo-knowledge-loading__card geo-knowledge-loading__skeleton"></div>
      <div class="geo-knowledge-loading__card geo-knowledge-loading__skeleton"></div>
      <div class="geo-knowledge-loading__card geo-knowledge-loading__skeleton"></div>
      <div class="geo-knowledge-loading__card geo-knowledge-loading__skeleton"></div>
      <div class="geo-knowledge-loading__card geo-knowledge-loading__skeleton"></div>
    </div>
    <div class="geo-knowledge-loading__list">
      <div class="geo-knowledge-loading__item geo-knowledge-loading__skeleton"></div>
      <div class="geo-knowledge-loading__item geo-knowledge-loading__skeleton"></div>
      <div class="geo-knowledge-loading__item geo-knowledge-loading__skeleton"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { KnowledgeVM } from '../../viewmodels/KnowledgeViewModel'

defineProps<{ vm: KnowledgeVM }>()
</script>

<style scoped>
.geo-knowledge-loading {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.geo-knowledge-loading__skeleton {
  background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
  background-size: 200% 100%;
  animation: geoShimmer 1.5s infinite;
  border-radius: 12px;
}

@keyframes geoShimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.geo-knowledge-loading__hero {
  height: 80px;
}

.geo-knowledge-loading__grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
}

.geo-knowledge-loading__card {
  height: 120px;
}

.geo-knowledge-loading__list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.geo-knowledge-loading__item {
  height: 64px;
}
</style>
