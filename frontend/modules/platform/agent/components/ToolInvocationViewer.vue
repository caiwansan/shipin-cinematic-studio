<template>
  <div class="tool-invocation-viewer">
    <h3 class="viewer-title">工具调用</h3>

    <div v-if="!calls.length" class="empty-state">
      暂无工具调用记录
    </div>

    <div v-else class="calls-list">
      <div v-for="(call, i) in calls" :key="i" class="call-item" :class="{ expanded: call.expanded }">
        <div class="call-header" @click="call.expanded = !call.expanded">
          <span class="call-type-badge" :class="call.type">
            {{ call.type }}
          </span>
          <span class="call-name">{{ call.name }}</span>
          <span class="call-status" :class="call.result?.success ? 'success' : 'error'">
            {{ call.result?.success ? '✓' : '✗' }}
          </span>
          <span class="call-duration" v-if="call.result?.durationMs">
            {{ call.result.durationMs }}ms
          </span>
        </div>

        <div v-if="call.expanded" class="call-details">
          <div class="detail-section">
            <label>参数</label>
            <pre>{{ JSON.stringify(call.params, null, 2) }}</pre>
          </div>
          <div v-if="call.result" class="detail-section">
            <label>结果</label>
            <pre>{{ JSON.stringify(call.result.data, null, 2) }}</pre>
          </div>
          <div v-if="call.result?.error" class="detail-section error">
            <label>错误</label>
            <pre>{{ call.result.error }}</pre>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'

interface ToolCallRecord {
  type: string
  name: string
  params: Record<string, unknown>
  result?: {
    success: boolean
    data?: any
    error?: string
    durationMs?: number
  }
  expanded?: boolean
}

const calls = reactive<ToolCallRecord[]>([])

function addCall(record: ToolCallRecord) {
  calls.unshift({ ...record, expanded: false })
}

defineExpose({ addCall })
</script>

<style scoped>
.tool-invocation-viewer {
  padding: 16px;
}

.viewer-title {
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

.calls-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.call-item {
  background: var(--surface-color, #1a1a2e);
  border: 1px solid var(--border-color, #2a2a4a);
  border-radius: 8px;
  overflow: hidden;
}

.call-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  cursor: pointer;
  transition: background 0.2s;
}

.call-header:hover {
  background: rgba(99, 102, 241, 0.05);
}

.call-type-badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 600;
  text-transform: uppercase;
}

.call-type-badge.mcp { background: #6366f120; color: #6366f1; }
.call-type-badge.browser { background: #22c55e20; color: #22c55e; }
.call-type-badge.search { background: #f59e0b20; color: #f59e0b; }
.call-type-badge.python { background: #3b82f620; color: #3b82f6; }
.call-type-badge.database { background: #8b5cf620; color: #8b5cf6; }
.call-type-badge.http { background: #ec489920; color: #ec4899; }
.call-type-badge.filesystem { background: #14b8a620; color: #14b8a6; }

.call-name {
  flex: 1;
  font-size: 13px;
  color: var(--text-primary, #e2e8f0);
  font-family: monospace;
}

.call-status {
  font-size: 14px;
  font-weight: 700;
}

.call-status.success { color: #22c55e; }
.call-status.error { color: #ef4444; }

.call-duration {
  font-size: 11px;
  color: var(--text-muted, #64748b);
  font-family: monospace;
}

.call-details {
  border-top: 1px solid var(--border-color, #2a2a4a);
  padding: 12px;
}

.detail-section {
  margin-bottom: 8px;
}

.detail-section label {
  display: block;
  font-size: 11px;
  color: var(--text-muted, #64748b);
  margin-bottom: 4px;
  text-transform: uppercase;
}

.detail-section pre {
  font-size: 12px;
  background: #0a0a1a;
  padding: 8px;
  border-radius: 4px;
  overflow-x: auto;
  max-height: 200px;
  overflow-y: auto;
  margin: 0;
}

.detail-section.error pre {
  color: #ef4444;
}
</style>
