<template>
  <div class="session-timeline">
    <h3 class="timeline-title">Session 时间线</h3>

    <div v-if="!sessions.length" class="empty-state">
      暂无 Session 记录
    </div>

    <div v-else class="timeline-list">
      <div
        v-for="session in sessions"
        :key="session.id"
        class="timeline-item"
        :class="`status-${session.status}`"
      >
        <div class="timeline-dot" />
        <div class="timeline-content">
          <div class="timeline-header">
            <span class="session-status" :class="session.status">
              {{ session.status }}
            </span>
            <span class="session-type">{{ session.sessionType }}</span>
            <span class="session-time" v-if="session.createdAt">
              {{ formatTime(session.createdAt) }}
            </span>
          </div>

          <div class="session-detail" v-if="session.agentCode || session.agentName">
            <span class="detail-label">Agent:</span>
            {{ session.agentName || session.agentCode }}
          </div>

          <div class="session-detail" v-if="session.executedBy">
            <span class="detail-label">执行者:</span>
            {{ session.executedBy }}
          </div>

          <div class="session-error" v-if="session.error">
            {{ session.error }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AgentSession } from '../types/index'

defineProps<{
  sessions: AgentSession[]
}>()

function formatTime(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>

<style scoped>
.session-timeline {
  padding: 16px;
}

.timeline-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary, #e2e8f0);
  margin: 0 0 16px;
}

.empty-state {
  text-align: center;
  padding: 32px;
  color: var(--text-muted, #64748b);
  font-size: 14px;
}

.timeline-list {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.timeline-item {
  display: flex;
  gap: 12px;
  padding: 12px 0;
  position: relative;
}

.timeline-item:not(:last-child)::after {
  content: '';
  position: absolute;
  left: 7px;
  top: 28px;
  bottom: 0;
  width: 2px;
  background: var(--border-color, #2a2a4a);
}

.timeline-dot {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--border-color, #2a2a4a);
  flex-shrink: 0;
  margin-top: 4px;
  border: 2px solid var(--surface-color, #1a1a2e);
}

.timeline-item.status-completed .timeline-dot { background: #22c55e; }
.timeline-item.status-failed .timeline-dot { background: #ef4444; }
.timeline-item.status-executing .timeline-dot { background: #6366f1; animation: pulse 1.5s infinite; }
.timeline-item.status-pending .timeline-dot { background: #f59e0b; }
.timeline-item.status-cancelled .timeline-dot { background: #64748b; }

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.timeline-content {
  flex: 1;
  min-width: 0;
}

.timeline-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.session-status {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: 500;
  text-transform: uppercase;
}
.session-status.completed { background: #22c55e20; color: #22c55e; }
.session-status.failed { background: #ef444420; color: #ef4444; }
.session-status.executing { background: #6366f120; color: #6366f1; }
.session-status.pending { background: #f59e0b20; color: #f59e0b; }
.session-status.cancelled { background: #64748b20; color: #64748b; }

.session-type {
  font-size: 11px;
  color: var(--text-muted, #64748b);
}

.session-time {
  font-size: 11px;
  color: var(--text-muted, #64748b);
  margin-left: auto;
}

.session-detail {
  font-size: 13px;
  color: var(--text-secondary, #94a3b8);
  margin-top: 2px;
}

.detail-label {
  color: var(--text-muted, #64748b);
  margin-right: 4px;
}

.session-error {
  font-size: 12px;
  color: #ef4444;
  margin-top: 4px;
  padding: 6px 8px;
  background: #ef444410;
  border-radius: 6px;
  font-family: monospace;
  word-break: break-all;
}
</style>
