<!-- ActivityFeed — 招聘动态流 -->
<!-- UX-03: 今日发生的招聘事件，按时间倒序 -->
<template>
  <div class="activity-feed">
    <div v-if="items.length === 0" class="activity-empty">
      今天暂无动态
    </div>
    <div
      v-for="item in items"
      :key="item.id"
      class="activity-item"
    >
      <span class="activity-time">{{ item.time }}</span>
      <span class="activity-text">{{ item.text }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  items: Array<{ id?: string; time: string; text: string }>
}>()
</script>

<style scoped>
.activity-feed {
  display: flex;
  flex-direction: column;
  gap: var(--rec-space-3);
}

.activity-empty {
  font-size: var(--rec-text-sm);
  color: var(--rec-text-muted);
  text-align: center;
  padding: var(--rec-space-4);
}

.activity-item {
  display: flex;
  gap: var(--rec-space-3);
  align-items: baseline;
}

.activity-time {
  font-size: var(--rec-text-sm);
  color: var(--rec-text-muted);
  font-family: var(--rec-font-mono);
  flex-shrink: 0;
  width: 44px;
}

.activity-text {
  font-size: var(--rec-text-md);
  color: var(--rec-text-primary);
}
</style>
