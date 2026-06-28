<template>
  <div class="workflow-node-card" :class="[`type-${type}`, status]">
    <div class="card-header">
      <span class="node-icon">{{ icon }}</span>
      <span class="node-type-label">{{ typeLabel }}</span>
    </div>
    <div class="card-body">
      <span class="node-name">{{ name }}</span>
      <span class="node-status">{{ statusLabel }}</span>
    </div>
    <div class="card-footer" v-if="duration">
      <span class="node-duration">{{ duration }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { NodeStatus } from '../types/index.js'

const props = defineProps<{
  type: string
  name: string
  status?: string
  duration?: string
}>()

const iconMap: Record<string, string> = {
  start: '▶', agent: '🤖', capability: '⚡', condition: '◇',
  parallel: '⇉', loop: '↻', merge: '⇇', delay: '⏱',
  event: '📡', humanApproval: '👤', humanEdit: '✏',
  humanReview: '🔍', humanUpload: '📤', humanDecision: '✓', end: '■',
}

const labelMap: Record<string, string> = {
  start: '开始', agent: 'Agent', capability: '能力', condition: '条件',
  parallel: '并行', loop: '循环', merge: '合并', delay: '延迟',
  event: '事件', humanApproval: '审批', humanEdit: '编辑',
  humanReview: '审核', humanUpload: '上传', humanDecision: '决策', end: '结束',
}

const statusLabelMap: Record<string, string> = {
  pending: '等待中', running: '运行中', completed: '已完成',
  failed: '失败', skipped: '已跳过', paused: '已暂停',
}

const icon = computed(() => iconMap[props.type] || '◻')
const typeLabel = computed(() => labelMap[props.type] || props.type)
const statusLabel = computed(() => statusLabelMap[props.status || ''] || props.status || '未知')
</script>

<style scoped>
.workflow-node-card {
  display: inline-flex;
  flex-direction: column;
  border-radius: 8px;
  padding: 8px 12px;
  min-width: 120px;
  background: #1a1a2e;
  border: 1px solid #333;
}

.workflow-node-card.type-start { border-color: #4CAF50; }
.workflow-node-card.type-end { border-color: #F44336; }
.workflow-node-card.type-condition { border-color: #9C27B0; }
.workflow-node-card.type-agent { border-color: #2196F3; }
.workflow-node-card.type-capability { border-color: #FF9800; }

.workflow-node-card.completed { background: rgba(76,175,80,0.1); border-color: #4CAF50; }
.workflow-node-card.running { background: rgba(33,150,243,0.1); border-color: #2196F3; }
.workflow-node-card.failed { background: rgba(244,67,54,0.1); border-color: #F44336; }

.card-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.node-icon { font-size: 16px; }
.node-type-label { font-size: 11px; color: #888; }

.card-body {
  display: flex;
  flex-direction: column;
}

.node-name { font-size: 13px; font-weight: bold; }
.node-status { font-size: 11px; color: #aaa; }

.card-footer { margin-top: 4px; }
.node-duration { font-size: 10px; color: #666; }
</style>
