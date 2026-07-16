<!-- ActionCard — IMP-04 Execution Timeline -->
<!-- 输入: EnterpriseDataEnvelope<ActionProgress> -->
<!-- 展示: Action Name + Trigger Source + Stage + Progress + Owner + Started At + Outcome -->
<!-- 必须包含: Source + Freshness -->
<template>
  <div class="action-card" :class="`stage-${action.data.status}`">
    <!-- Header: Title + Status -->
    <div class="action-header">
      <span class="action-title">{{ action.data.title }}</span>
      <span class="action-stage" :class="action.data.status">{{ stageLabel }}</span>
    </div>

    <!-- Description -->
    <p v-if="action.data.description" class="action-desc">{{ action.data.description }}</p>

    <!-- Progress Bar -->
    <div class="action-progress">
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: `${progressPercent}%` }" :class="action.data.status" />
      </div>
      <span class="progress-label">{{ progressPercent }}%</span>
    </div>

    <!-- Meta: Owner + Started + Trigger -->
    <div class="action-meta">
      <span v-if="action.data.ownerName" class="meta-item">👤 {{ action.data.ownerName }}</span>
      <span v-if="action.data.startedAt" class="meta-item">🕐 {{ formattedStartedAt }}</span>
      <span v-if="action.data.triggerSource" class="meta-item">🔗 {{ action.data.triggerSource }}</span>
    </div>

    <!-- Expected Outcome -->
    <div v-if="action.data.expectedOutcome" class="action-outcome">
      <span class="outcome-label">预期成果:</span>
      <span class="outcome-value">{{ action.data.expectedOutcome }}</span>
    </div>

    <!-- Source + Freshness -->
    <div class="action-source">
      <span>来源: {{ action.source }}</span>
      <span>更新: {{ formattedFreshness }}</span>
    </div>

    <!-- Actions (for pending approval stage) -->
    <div v-if="action.data.status === 'pending'" class="action-actions">
      <button class="action-btn btn-approve" @click.stop="$emit('approve')">✓ 批准</button>
      <button class="action-btn btn-reject" @click.stop="$emit('reject')">✕ 拒绝</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { EnterpriseDataEnvelope, ActionProgress } from '~/types/enterprise-envelope'

const props = defineProps<{
  action: EnterpriseDataEnvelope<ActionProgress>
}>()

defineEmits<{
  approve: []
  reject: []
}>()

const stageLabel = computed(() => {
  const labels: Record<string, string> = {
    pending: '待审批',
    approved: '已批准',
    executing: '执行中',
    completed: '已完成',
    verified: '已验证',
    rejected: '已拒绝',
  }
  return labels[props.action.data.status] || props.action.data.status
})

const progressPercent = computed(() => {
  const status = props.action.data.status
  if (status === 'pending') return 0
  if (status === 'approved') return 25
  if (status === 'executing') return 60
  if (status === 'completed') return 90
  if (status === 'verified') return 100
  if (status === 'rejected') return 0
  return props.action.data.progress || 0
})

const formattedStartedAt = computed(() => {
  const ts = props.action.data.startedAt || props.action.data.createdAt
  if (!ts) return ''
  const date = new Date(ts)
  const diff = Date.now() - date.getTime()
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return `${sec}秒前`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}分钟前`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}小时前`
  return `${Math.floor(hr / 24)}天前`
})

const formattedFreshness = computed(() => {
  const ts = props.action.freshness || props.action.timestamp
  if (!ts) return '未知'
  const date = new Date(ts)
  const diff = Date.now() - date.getTime()
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return `${sec}秒前`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}分钟前`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}小时前`
  return `${Math.floor(hr / 24)}天前`
})
</script>

<style scoped>
.action-card {
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  transition: all 0.2s;
}
.action-card:hover {
  border-color: var(--color-border-secondary);
}
.action-card.stage-pending { border-left: 3px solid var(--color-text-muted); }
.action-card.stage-approved { border-left: 3px solid var(--color-intelligence); }
.action-card.stage-executing { border-left: 3px solid var(--color-execution); }
.action-card.stage-completed { border-left: 3px solid var(--color-execution); }
.action-card.stage-verified { border-left: 3px solid #10b981; }
.action-card.stage-rejected { border-left: 3px solid var(--color-danger); }

.action-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-md);
}
.action-title { font-size: var(--font-size-md); font-weight: 500; color: var(--color-text-primary); }
.action-stage {
  font-size: var(--font-size-xs);
  font-weight: 600;
  padding: 2px 8px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
}
.action-stage.pending { background: var(--color-bg-hover); color: var(--color-text-muted); }
.action-stage.approved { background: var(--color-intelligence-glow); color: var(--color-intelligence); }
.action-stage.executing { background: var(--color-execution-glow); color: var(--color-execution); }
.action-stage.completed { background: rgba(16, 185, 129, 0.1); color: #10b981; }
.action-stage.verified { background: rgba(16, 185, 129, 0.15); color: #10b981; }
.action-stage.rejected { background: rgba(239, 68, 68, 0.1); color: var(--color-danger); }

.action-desc {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin-top: var(--space-sm);
}

.action-progress {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  margin-top: var(--space-md);
}
.progress-bar {
  flex: 1;
  height: 4px;
  background: var(--color-bg-hover);
  border-radius: var(--radius-full);
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  border-radius: var(--radius-full);
  transition: width 0.3s ease;
}
.progress-fill.pending { background: var(--color-text-muted); }
.progress-fill.approved { background: var(--color-intelligence); }
.progress-fill.executing { background: var(--color-execution); }
.progress-fill.completed { background: #10b981; }
.progress-fill.verified { background: #10b981; }
.progress-fill.rejected { background: var(--color-danger); }

.progress-label {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.action-meta {
  display: flex;
  gap: var(--space-md);
  margin-top: var(--space-md);
  flex-wrap: wrap;
}
.meta-item {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.action-outcome {
  display: flex;
  gap: var(--space-sm);
  margin-top: var(--space-sm);
  font-size: var(--font-size-xs);
}
.outcome-label { color: var(--color-text-muted); }
.outcome-value { color: var(--color-text-secondary); font-weight: 500; }

.action-source {
  display: flex;
  justify-content: space-between;
  margin-top: var(--space-md);
  padding-top: var(--space-sm);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  border-top: 1px solid var(--color-border-primary);
}

.action-actions {
  display: flex;
  gap: var(--space-sm);
  margin-top: var(--space-md);
  padding-top: var(--space-md);
  border-top: 1px solid var(--color-border-primary);
}
.action-btn {
  padding: var(--space-sm) var(--space-md);
  font-size: var(--font-size-sm);
  border-radius: var(--radius-md);
  border: 1px solid;
  cursor: pointer;
  transition: all 0.2s;
  background: transparent;
}
.btn-approve { color: var(--color-execution); border-color: var(--color-execution); }
.btn-approve:hover { background: var(--color-execution); color: #000; }
.btn-reject { color: var(--color-text-muted); border-color: var(--color-text-muted); }
.btn-reject:hover { background: var(--color-text-muted); color: #fff; }
</style>
