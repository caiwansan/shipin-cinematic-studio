<!-- StatusBadge — 状态徽章 -->
<!-- 统一状态显示 -->
<template>
  <span class="status-badge" :class="`status-badge--${type}`">
    <span class="status-dot" />{{ label }}
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  type: 'connected' | 'disconnected' | 'warning' | 'error' | 'pending'
  label?: string
}>(), {
  label: '',
})

const defaultLabel = computed(() => {
  if (props.label) return props.label
  return {
    connected: '已连接',
    disconnected: '未连接',
    warning: '注意',
    error: '异常',
    pending: '待处理',
  }[props.type]
})
</script>

<style scoped>
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-sm);
  font-size: var(--font-size-xs);
  font-weight: 500;
  padding: 2px 8px;
  border-radius: var(--radius-full);
}
.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}
.status-badge--connected {
  background: var(--color-execution-glow);
  color: var(--color-execution);
}
.status-badge--connected .status-dot { background: var(--color-execution); }
.status-badge--disconnected {
  background: var(--color-bg-hover);
  color: var(--color-text-muted);
}
.status-badge--disconnected .status-dot { background: var(--color-text-muted); }
.status-badge--warning {
  background: rgba(245, 158, 11, 0.1);
  color: var(--color-warning);
}
.status-badge--warning .status-dot { background: var(--color-warning); }
.status-badge--error {
  background: rgba(239, 68, 68, 0.1);
  color: var(--color-danger);
}
.status-badge--error .status-dot { background: var(--color-danger); }
.status-badge--pending {
  background: var(--color-intelligence-glow);
  color: var(--color-intelligence);
}
.status-badge--pending .status-dot { background: var(--color-intelligence); }
</style>
