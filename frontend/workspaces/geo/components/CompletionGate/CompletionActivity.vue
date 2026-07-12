<!-- @deprecated 未被引用，保留作参考 -->
<template>
  <div class="cg-activity">
    <h3 class="cg-activity__title">验证活动</h3>
    <div v-if="events.length === 0" class="cg-activity__empty">暂无验证活动</div>
    <div v-for="(evt, i) in events.slice(0, limit)" :key="i" class="cg-activity__item">
      <div class="cg-activity__marker" />
      <div class="cg-activity__icon">{{ evt.icon || '✅' }}</div>
      <div class="cg-activity__body">
        <div class="cg-activity__header">
          <span class="cg-activity__type">验证</span>
          <span class="cg-activity__time">{{ evt.relativeTime || evt.timestamp }}</span>
        </div>
        <p class="cg-activity__text">{{ evt.label || evt.title }}</p>
        <p v-if="evt.projectName" class="cg-activity__project">{{ evt.projectName }}</p>
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
.cg-activity { border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px 24px; }
.cg-activity__title { font-size: 16px; font-weight: 700; color: #111827; margin: 0 0 16px; }
.cg-activity__empty { color: #9ca3af; font-size: 13px; text-align: center; padding: 16px; }
.cg-activity__item { display: flex; gap: 12px; padding: 8px 0; align-items: flex-start; }
.cg-activity__marker { width: 8px; height: 8px; border-radius: 50%; background: #d1d5db; margin-top: 6px; flex-shrink: 0; }
.cg-activity__icon { flex-shrink: 0; font-size: 14px; }
.cg-activity__body { flex: 1; min-width: 0; }
.cg-activity__header { display: flex; align-items: center; gap: 8px; margin-bottom: 2px; }
.cg-activity__type { font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; }
.cg-activity__time { font-size: 11px; color: #9ca3af; margin-left: auto; }
.cg-activity__text { font-size: 14px; color: #374151; margin: 0; }
.cg-activity__project { font-size: 12px; color: #9ca3af; margin: 2px 0 0; }
</style>
