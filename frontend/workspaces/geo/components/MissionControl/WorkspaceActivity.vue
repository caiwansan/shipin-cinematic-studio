<!-- @deprecated 未被任何页面引用，MissionControl 重构中废弃 -->
<template>
  <div class="mc-activity">
    <div v-if="events.length === 0" class="mc-activity__empty">暂无活动记录</div>
    <div
      v-for="(evt, i) in events.slice(0, limit)"
      :key="i"
      class="mc-activity__item"
    >
      <div class="mc-activity__marker" />
      <div class="mc-activity__icon">{{ evt.icon || '📌' }}</div>
      <div class="mc-activity__body">
        <div class="mc-activity__header">
          <span class="mc-activity__type">{{ evt.type }}</span>
          <span class="mc-activity__time">{{ evt.relativeTime || evt.timestamp }}</span>
        </div>
        <p class="mc-activity__title">{{ evt.label || evt.title }}</p>
        <p v-if="evt.projectName" class="mc-activity__project">{{ evt.projectName }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  events: Array<{
    type?: string
    label?: string
    title?: string
    projectName?: string
    timestamp?: string
    relativeTime?: string
    icon?: string
  }>
  limit?: number
}>(), { limit: 8 })
</script>

<style scoped>
.mc-activity {
  display: flex;
  flex-direction: column;
}
.mc-activity__empty {
  color: #9ca3af;
  font-size: 13px;
  text-align: center;
  padding: 24px;
}
.mc-activity__item {
  display: flex;
  gap: 12px;
  padding: 10px 12px;
  position: relative;
  border-radius: 6px;
  transition: background 0.1s;
}
.mc-activity__item:hover {
  background: #f9fafb;
}
.mc-activity__marker {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #d1d5db;
  margin-top: 6px;
  flex-shrink: 0;
}
.mc-activity__icon {
  flex-shrink: 0;
  font-size: 14px;
  margin-top: 2px;
}
.mc-activity__body {
  flex: 1;
  min-width: 0;
}
.mc-activity__header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 2px;
}
.mc-activity__type {
  font-size: 11px;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.mc-activity__time {
  font-size: 11px;
  color: #9ca3af;
  margin-left: auto;
}
.mc-activity__title {
  font-size: 14px;
  color: #374151;
  margin: 0;
  line-height: 1.4;
}
.mc-activity__project {
  font-size: 12px;
  color: #9ca3af;
  margin: 2px 0 0;
}
</style>
