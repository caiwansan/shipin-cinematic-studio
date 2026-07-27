<!-- StatusBadge — 状态标签 -->
<!-- UX-03C 扩展：支持 recommendation 类型 + size 属性 -->
<template>
  <span class="status-badge" :class="[`status-${statusClass}`, size === 'sm' ? 'badge-sm' : '']">
    {{ displayText }}
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  status: string
  type?: string  // 'default' | 'recommendation'
  size?: string  // 'md' | 'sm'
}>()

const statusMap: Record<string, { text: string; cls: string }> = {
  // 面试状态
  DISCOVERED: { text: '待筛选', cls: 'neutral' },
  CHATTING: { text: '沟通中', cls: 'info' },
  AI_EVALUATING: { text: '评估中', cls: 'warning' },
  WAITING_HR_REVIEW: { text: '待确认', cls: 'warning' },
  PASSED: { text: '已通过', cls: 'success' },
  REJECTED: { text: '已拒绝', cls: 'danger' },
  HIRED: { text: '已录用', cls: 'success' },
  COMPLETED: { text: '已完成', cls: 'success' },
  IN_PROGRESS: { text: '进行中', cls: 'info' },
  SCHEDULED: { text: '待开始', cls: 'neutral' },
  ACTIVE: { text: '运行中', cls: 'success' },
  PAUSED: { text: '已暂停', cls: 'warning' },
  STOPPED: { text: '已停止', cls: 'danger' },
  // 推荐决策
  STRONGLY_RECOMMEND: { text: '强烈推荐', cls: 'success' },
  RECOMMEND: { text: '推荐', cls: 'success' },
  NEUTRAL: { text: '待定', cls: 'neutral' },
  NOT_RECOMMEND: { text: '不推荐', cls: 'danger' },
  SECOND_INTERVIEW: { text: '建议二面', cls: 'info' },
}

const statusClass = computed(() => statusMap[props.status]?.cls || 'neutral')
const displayText = computed(() => statusMap[props.status]?.text || props.status)
</script>

<style scoped>
.status-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
  white-space: nowrap;
}

.badge-sm {
  padding: 1px 6px;
  font-size: 11px;
  line-height: 16px;
}

.status-neutral {
  background: var(--rec-neutral-light);
  color: var(--rec-neutral);
}

.status-info {
  background: var(--rec-brand-light);
  color: var(--rec-brand);
}

.status-success {
  background: var(--rec-success-light);
  color: var(--rec-success);
}

.status-warning {
  background: var(--rec-warning-light);
  color: var(--rec-warning);
}

.status-danger {
  background: var(--rec-danger-light);
  color: var(--rec-danger);
}
</style>
