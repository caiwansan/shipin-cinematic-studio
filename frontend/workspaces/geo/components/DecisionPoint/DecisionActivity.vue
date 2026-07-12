<!-- @deprecated 未被引用，保留作参考 -->
<template>
  <div class="dp-activity">
    <h3 class="dp-activity__title">决策活动</h3>
    <div v-if="events.length === 0" class="dp-activity__empty">暂无决策活动</div>
    <div v-for="(evt, i) in events.slice(0, limit)" :key="i" class="dp-activity__item">
      <div class="dp-activity__marker" />
      <div class="dp-activity__icon">{{ evt.icon || '📋' }}</div>
      <div class="dp-activity__body">
        <div class="dp-activity__header">
          <span class="dp-activity__type">决策</span>
          <span class="dp-activity__time">{{ evt.relativeTime || evt.timestamp }}</span>
        </div>
        <p class="dp-activity__text">{{ evt.label || evt.title }}</p>
        <p v-if="evt.projectName" class="dp-activity__project">{{ evt.projectName }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  events: Array<{
    label?: string; title?: string; projectName?: string
    timestamp?: string; relativeTime?: string; icon?: string
  }>
  limit?: number
}>(), { limit: 5 })
</script>

<style scoped>
.dp-activity {
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 20px 24px;
}
.dp-activity__title { font-size: 16px; font-weight: 700; color: #111827; margin: 0 0 16px; }
.dp-activity__empty { color: #9ca3af; font-size: 13px; text-align: center; padding: 16px; }
.dp-activity__item { display: flex; gap: 12px; padding: 8px 0; align-items: flex-start; }
.dp-activity__marker { width: 8px; height: 8px; border-radius: 50%; background: #d1d5db; margin-top: 6px; flex-shrink: 0; }
.dp-activity__icon { flex-shrink: 0; font-size: 14px; }
.dp-activity__body { flex: 1; min-width: 0; }
.dp-activity__header { display: flex; align-items: center; gap: 8px; margin-bottom: 2px; }
.dp-activity__type { font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; }
.dp-activity__time { font-size: 11px; color: #9ca3af; margin-left: auto; }
.dp-activity__text { font-size: 14px; color: #374151; margin: 0; }
.dp-activity__project { font-size: 12px; color: #9ca3af; margin: 2px 0 0; }
</style>
