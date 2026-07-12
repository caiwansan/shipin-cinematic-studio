<template>
  <div class="workflow-node" @click="$emit('click')">
    <div class="workflow-node__connector">
      <span :class="['workflow-node__dot', `dot-${engine.status}`]"></span>
      <div v-if="!isLast" class="workflow-node__line"></div>
    </div>
    <div class="workflow-node__body">
      <div class="workflow-node__header">
        <span class="workflow-node__icon">{{ icon }}</span>
        <span class="workflow-node__label">{{ engine.label }}</span>
        <span :class="['workflow-node__badge', `badge-${engine.status}`]">{{ statusText }}</span>
      </div>
      <div class="workflow-node__detail">{{ engine.detail }}</div>
    </div>
    <div class="workflow-node__arrow">→</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { EngineState } from '../services/missionControlService'

const props = defineProps<{
  engine: EngineState
  isLast: boolean
}>()

defineEmits<{
  (e: 'click'): void
}>()

const icon = computed(() => {
  const map: Record<string, string> = {
    discovery: '🔍',
    knowledge: '📚',
    recommendation: '💡',
    mission: '🎯',
    verification: '✅',
    learning: '🧠',
  }
  return map[props.engine.name] || '●'
})

const statusText = computed(() => {
  const map: Record<string, string> = {
    idle: '待机',
    running: '运行中',
    completed: '已完成',
    failed: '失败',
    queued: '排队中',
    collecting: '收集中',
  }
  return map[props.engine.status] || props.engine.status
})
</script>

<style scoped>
.workflow-node {
  display: flex;
  align-items: stretch;
  cursor: pointer;
  transition: background 0.15s;
  background: #fff;
  border-radius: 8px;
  padding: 4px 0;
}

.workflow-node:hover {
  background: #f8fafc;
}

.workflow-node__connector {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 32px;
  padding: 8px 0;
  flex-shrink: 0;
}

.workflow-node__dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  display: inline-block;
  flex-shrink: 0;
}

.workflow-node__line {
  width: 2px;
  flex: 1;
  min-height: 16px;
  background: #e2e8f0;
}

.dot-idle { background: #cbd5e1; }
.dot-running { background: #4ade80; box-shadow: 0 0 6px #4ade80; animation: pulse 2s infinite; }
.dot-completed { background: #3b82f6; }
.dot-failed { background: #ef4444; }
.dot-queued { background: #f59e0b; }
.dot-collecting { background: #8b5cf6; }

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.workflow-node__body {
  flex: 1;
  padding: 8px 12px;
  min-width: 0;
}

.workflow-node__header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 2px;
}

.workflow-node__icon {
  font-size: 16px;
}

.workflow-node__label {
  font-size: 14px;
  font-weight: 600;
  color: #1a1a2e;
}

.workflow-node__badge {
  font-size: 11px;
  padding: 1px 8px;
  border-radius: 6px;
  font-weight: 500;
}

.badge-idle { background: #f1f5f9; color: #64748b; }
.badge-running { background: #dcfce7; color: #166534; }
.badge-completed { background: #dbeafe; color: #1e40af; }
.badge-failed { background: #fee2e2; color: #991b1b; }
.badge-queued { background: #fef3c7; color: #92400e; }
.badge-collecting { background: #e0e7ff; color: #3730a3; }

.workflow-node__detail {
  font-size: 13px;
  color: #64748b;
  margin-left: 24px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.workflow-node__arrow {
  display: flex;
  align-items: center;
  padding-right: 12px;
  color: #cbd5e1;
  font-size: 14px;
}
</style>
