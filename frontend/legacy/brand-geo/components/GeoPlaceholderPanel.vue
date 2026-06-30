<!-- @deprecated — GEO v3 Legacy. Use design-system product blocks instead. -->
<template>
  <div class="geo-placeholder-panel">
    <div class="geo-placeholder-icon">{{ icon }}</div>
    <h2 class="geo-placeholder-title">{{ title }}</h2>
    <p class="geo-placeholder-desc">{{ description }}</p>
    <div class="geo-placeholder-status">
      <span class="geo-status-dot"></span>
      即将上线
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string
  description: string
  icon: string
}>()
</script>

<style scoped>
.geo-placeholder-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 48px;
  height: 100%;
  min-height: 400px;
}
.geo-placeholder-icon {
  font-size: 48px;
  opacity: 0.2;
}
.geo-placeholder-title {
  font-size: 20px;
  font-weight: 600;
  color: #6b7280;
  margin: 0;
}
.geo-placeholder-desc {
  font-size: 14px;
  color: #4b5563;
  margin: 0;
  max-width: 360px;
  text-align: center;
}
.geo-placeholder-status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #6b7280;
  margin-top: 8px;
  padding: 6px 14px;
  border-radius: 20px;
  background: rgba(99, 102, 241, 0.08);
  border: 1px solid rgba(99, 102, 241, 0.12);
}
.geo-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #818cf8;
}
</style>
