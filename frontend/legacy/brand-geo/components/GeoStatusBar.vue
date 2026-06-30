<!-- @deprecated — GEO v3 Legacy. Use design-system product blocks instead. -->
<template>
  <footer class="geo-status-bar">
    <div class="geo-status-bar-left">
      <span v-if="projectId && typeof projectId === 'string'" class="geo-status-item">
        📦 项目: <strong>{{ projectId.slice(0, 8) }}...</strong>
      </span>
      <span v-if="brandCount !== undefined" class="geo-status-item">
        🏢 品牌: <strong>{{ brandCount }}</strong>
      </span>
      <span v-if="koCount !== undefined" class="geo-status-item">
        📚 KO: <strong>{{ koCount }}</strong>
      </span>
    </div>
    <div class="geo-status-bar-right">
      <span v-if="lastSync" class="geo-status-item">
        🕐 上次同步: {{ lastSync }}
      </span>
    </div>
  </footer>
</template>

<script setup lang="ts">
defineProps<{
  projectId?: string | null
  brandCount?: number
  koCount?: number
  lastSync?: string
}>()
</script>

<style scoped>
.geo-status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(10, 10, 18, 0.8);
  font-size: 11px;
  color: #6b7280;
  flex-shrink: 0;
}

.geo-status-bar-left,
.geo-status-bar-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.geo-status-item strong {
  color: #9ca3af;
}
</style>
