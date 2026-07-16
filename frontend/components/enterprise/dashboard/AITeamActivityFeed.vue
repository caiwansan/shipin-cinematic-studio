<template>
  <div class="ai-team-activity-feed">
    <div class="feed-header">
      <h4 class="feed-title">AI 工作动态</h4>
      <span class="feed-count">{{ activities.length }} 条</span>
    </div>

    <div v-if="activities.length > 0" class="feed-list">
      <div v-for="event in activities" :key="event.id" class="feed-item">
        <div class="feed-dot" :class="`feed-${event.status}`" />
        <div class="feed-content">
          <span class="feed-action">{{ event.agentName }} {{ event.action }}</span>
          <span class="feed-time">{{ formatTime(event.timestamp) }}</span>
        </div>
      </div>
    </div>

    <div v-else class="feed-empty">
      <span class="empty-icon">📋</span>
      <p>暂无工作记录</p>
    </div>
  </div>
</template>

<script setup>
defineProps({
  activities: { type: Array, default: () => [] }
})

function formatTime(date) {
  if (!date) return ''
  const d = new Date(date)
  const now = new Date()
  const diffMs = now - d
  if (diffMs < 60000) return '刚刚'
  if (diffMs < 3600000) return Math.floor(diffMs / 60000) + ' 分钟前'
  if (diffMs < 86400000) return Math.floor(diffMs / 3600000) + ' 小时前'
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
</script>

<style scoped>
.ai-team-activity-feed {
  background: #0D1328;
  border: 1px solid #1A2240;
  border-radius: 16px;
  padding: 20px;
}
.feed-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}
.feed-title {
  font-size: 14px;
  font-weight: 600;
  color: white;
  margin: 0;
}
.feed-count {
  font-size: 10px;
  color: #5A6A8A;
  background: #111833;
  padding: 2px 8px;
  border-radius: 12px;
}
.feed-list {
  display: flex;
  flex-direction: column;
  gap: 0;
}
.feed-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid #111833;
}
.feed-item:last-child {
  border-bottom: none;
}
.feed-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  margin-top: 6px;
  flex-shrink: 0;
}
.feed-success, .feed-completed { background: #22c55e; }
.feed-failed { background: #ef4444; }
.feed-running { background: #3b82f6; }
.feed-pending { background: #4b5563; }

.feed-content {
  flex: 1;
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
}
.feed-action {
  font-size: 12px;
  color: #B0B8D0;
  line-height: 1.4;
}
.feed-time {
  font-size: 10px;
  color: #3A4A6A;
  white-space: nowrap;
  flex-shrink: 0;
}
.feed-empty {
  text-align: center;
  padding: 24px 0;
  color: #5A6A8A;
}
.empty-icon {
  font-size: 24px;
  display: block;
  margin-bottom: 6px;
}
.feed-empty p {
  font-size: 12px;
  margin: 0;
}
</style>
