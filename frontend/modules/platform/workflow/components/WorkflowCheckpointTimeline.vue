<template>
  <div class="checkpoint-timeline">
    <h3>检查点时间线</h3>
    <div class="timeline" v-if="checkpoints.length > 0">
      <div
        v-for="cp in checkpoints"
        :key="cp.id"
        class="timeline-item"
        @click="$emit('select', cp)"
      >
        <div class="timeline-dot"></div>
        <div class="timeline-content">
          <div class="timeline-header">
            <span class="timeline-node">节点: {{ cp.nodeId }}</span>
            <span class="timeline-time">{{ formatTime(cp.createdAt) }}</span>
          </div>
          <div class="timeline-snapshot" v-if="cp.snapshot">
            <span class="snapshot-preview">{{ truncate(JSON.stringify(cp.snapshot), 80) }}</span>
          </div>
        </div>
      </div>
    </div>
    <div v-else class="empty-timeline">
      <p>暂无检查点</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { WorkflowCheckpoint } from '../types/index.js'

defineProps<{
  checkpoints: WorkflowCheckpoint[]
}>()

defineEmits<{
  select: [checkpoint: WorkflowCheckpoint]
}>()

function formatTime(timestamp?: string): string {
  if (!timestamp) return ''
  const d = new Date(timestamp)
  return d.toLocaleTimeString()
}

function truncate(str: string, len: number): string {
  return str.length > len ? str.slice(0, len) + '...' : str
}
</script>

<style scoped>
.checkpoint-timeline {
  padding: 12px;
}

.checkpoint-timeline h3 {
  margin: 0 0 12px;
  font-size: 16px;
  color: #e0e0e0;
}

.timeline {
  position: relative;
  padding-left: 30px;
}

.timeline::before {
  content: '';
  position: absolute;
  left: 10px;
  top: 0;
  bottom: 0;
  width: 2px;
  background: #333;
}

.timeline-item {
  position: relative;
  margin-bottom: 16px;
  cursor: pointer;
  transition: background 0.2s;
  padding: 8px;
  border-radius: 6px;
}

.timeline-item:hover {
  background: rgba(255,255,255,0.05);
}

.timeline-dot {
  position: absolute;
  left: -24px;
  top: 12px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #4CAF50;
  border: 2px solid #1a1a2e;
}

.timeline-content {
  background: #16213e;
  border-radius: 6px;
  padding: 8px 12px;
}

.timeline-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
}

.timeline-node {
  font-size: 13px;
  color: #4FC3F7;
}

.timeline-time {
  font-size: 11px;
  color: #666;
}

.snapshot-preview {
  font-size: 11px;
  color: #888;
  font-family: monospace;
}

.empty-timeline {
  color: #555;
  text-align: center;
  padding: 20px;
}
</style>
