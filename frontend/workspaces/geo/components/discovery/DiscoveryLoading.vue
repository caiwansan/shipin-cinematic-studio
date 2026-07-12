<!-- DiscoveryLoading.vue — 全屏加载骨架 -->
<template>
  <div class="geo-d-loading">
    <div class="geo-d-loading__hero geo-d-loading__skeleton"></div>
    <div class="geo-d-loading__grid">
      <div class="geo-d-loading__card geo-d-loading__skeleton"></div>
      <div class="geo-d-loading__card geo-d-loading__skeleton"></div>
      <div class="geo-d-loading__card geo-d-loading__skeleton"></div>
    </div>
  </div>
</template>

<style scoped>
.geo-d-loading {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.geo-d-loading__skeleton {
  background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
  background-size: 200% 100%;
  animation: geoShimmer 1.5s infinite;
  border-radius: 12px;
}

@keyframes geoShimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.geo-d-loading__hero {
  height: 80px;
}

.geo-d-loading__grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 12px;
}

.geo-d-loading__card {
  height: 140px;
}
</style>
