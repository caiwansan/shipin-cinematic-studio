<!-- DecisionCard — IMP-03 完整版 -->
<!-- 输入: EnterpriseDataEnvelope<Decision> -->
<!-- 展示: Title + Reason + Impact + Confidence + Source + Freshness + Actions -->
<!-- CTO Rule: Decision ≠ Approval -->

<template>
  <div class="decision-card" :class="`priority-${priorityClass}`">
    <!-- Header: Title + Priority -->
    <div class="decision-header">
      <div class="decision-title-row">
        <span class="decision-priority" :class="priorityClass">{{ decision.data.priorityLevel || 'P3' }}</span>
        <span class="decision-title">{{ decision.data.title }}</span>
      </div>
      <span class="decision-confidence" v-if="decision.confidence">
        {{ decision.confidence }}%
      </span>
    </div>

    <!-- Body: Reason + Impact -->
    <div class="decision-body">
      <p class="decision-rationale">{{ decision.data.rationale }}</p>
      <div class="decision-impact" v-if="decision.data.impact">
        <span class="impact-label">影响:</span>
        <span class="impact-value">{{ decision.data.impact }}</span>
      </div>
    </div>

    <!-- Source + Freshness -->
    <div class="decision-source">
      <span>来源: {{ decision.source }}</span>
      <span>更新: {{ formattedFreshness }}</span>
    </div>

    <!-- Evidence Section (Expandable) -->
    <div v-if="showEvidence" class="decision-evidence">
      <div class="evidence-header">
        <span class="evidence-title">证据链</span>
        <button class="evidence-toggle" @click="$emit('close-evidence')">▲</button>
      </div>
      <div v-if="evidenceLoading" class="evidence-loading">
        <Skeleton variant="card" :lines="3" />
      </div>
      <div v-else-if="evidenceData" class="evidence-content">
        <div v-for="node in evidenceData.nodes" :key="node.id" class="evidence-node">
          <span class="node-type">{{ node.type }}</span>
          <span class="node-desc">{{ node.description }}</span>
          <span class="node-confidence">{{ node.confidence }}%</span>
        </div>
      </div>
      <div v-else class="evidence-empty">
        <span>暂无证据数据</span>
      </div>
    </div>

    <!-- Actions -->
    <div v-if="decision.data.decisionStatus === 'pending' || decision.data.decisionStatus === 'reviewed'" class="decision-actions">
      <button class="decision-btn btn-accept" @click.stop="$emit('accept')">✓ 批准</button>
      <button class="decision-btn btn-reject" @click.stop="$emit('reject')">✕ 拒绝</button>
      <button class="decision-btn btn-evidence" @click.stop="$emit('view-evidence')">
        {{ showEvidence ? '隐藏' : '查看' }}证据
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { EnterpriseDataEnvelope, Decision } from '~/types/enterprise-envelope'
import type { EvidenceGraph } from '~/types/enterprise-envelope'
import Skeleton from '~/components/enterprise-ui/feedback/Skeleton.vue'

const props = defineProps<{
  decision: EnterpriseDataEnvelope<Decision>
  showEvidence?: boolean
  evidenceLoading?: boolean
  evidenceData?: EvidenceGraph | null
}>()

defineEmits<{
  accept: []
  reject: []
  'view-evidence': []
  'close-evidence': []
}>()

const priorityClass = computed(() => 
  (props.decision.data.priorityLevel || 'P3').toLowerCase()
)

const formattedFreshness = computed(() => {
  const ts = props.decision.freshness || props.decision.timestamp
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
.decision-card {
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  transition: all 0.2s;
}
.decision-card:hover {
  border-color: var(--color-border-secondary);
}
.decision-card.priority-p1 { border-left: 3px solid var(--color-danger); }
.decision-card.priority-p2 { border-left: 3px solid var(--color-warning); }
.decision-card.priority-p3 { border-left: 3px solid var(--color-decision); }
.decision-card.priority-p4 { border-left: 3px solid var(--color-text-muted); }

.decision-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-md);
}
.decision-title-row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}
.decision-priority {
  font-size: var(--font-size-xs);
  font-weight: 700;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  flex-shrink: 0;
}
.decision-priority.p1 { background: rgba(239, 68, 68, 0.1); color: var(--color-danger); }
.decision-priority.p2 { background: rgba(245, 158, 11, 0.1); color: var(--color-warning); }
.decision-priority.p3 { background: var(--color-decision-glow); color: var(--color-decision); }
.decision-priority.p4 { background: var(--color-bg-hover); color: var(--color-text-muted); }
.decision-title { font-size: var(--font-size-md); font-weight: 500; color: var(--color-text-primary); }
.decision-confidence { font-size: var(--font-size-sm); color: var(--color-text-muted); flex-shrink: 0; }

.decision-body {
  margin-top: var(--space-md);
}
.decision-rationale { font-size: var(--font-size-sm); color: var(--color-text-secondary); line-height: 1.5; }
.decision-impact {
  display: flex;
  gap: var(--space-sm);
  margin-top: var(--space-sm);
  font-size: var(--font-size-sm);
}
.impact-label { color: var(--color-text-muted); }
.impact-value { color: var(--color-text-primary); font-weight: 500; }

.decision-source {
  display: flex;
  justify-content: space-between;
  margin-top: var(--space-md);
  padding-top: var(--space-sm);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  border-top: 1px solid var(--color-border-primary);
}

.decision-evidence {
  margin-top: var(--space-md);
  padding-top: var(--space-md);
  border-top: 1px solid var(--color-border-primary);
}
.evidence-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-sm);
}
.evidence-title { font-size: var(--font-size-sm); font-weight: 600; color: var(--color-text-secondary); }
.evidence-toggle {
  background: none;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  padding: var(--space-xs);
}
.evidence-loading { padding: var(--space-sm) 0; }
.evidence-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}
.evidence-node {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm);
  background: var(--color-bg-secondary);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
}
.node-type {
  font-weight: 600;
  color: var(--color-intelligence);
  text-transform: uppercase;
  font-size: 10px;
}
.node-desc { flex: 1; color: var(--color-text-secondary); }
.node-confidence { color: var(--color-text-muted); }
.evidence-empty { text-align: center; color: var(--color-text-muted); font-size: var(--font-size-xs); padding: var(--space-sm); }

.decision-actions {
  display: flex;
  gap: var(--space-sm);
  margin-top: var(--space-md);
  padding-top: var(--space-md);
  border-top: 1px solid var(--color-border-primary);
}
.decision-btn {
  padding: var(--space-sm) var(--space-md);
  font-size: var(--font-size-sm);
  border-radius: var(--radius-md);
  border: 1px solid;
  cursor: pointer;
  transition: all 0.2s;
  background: transparent;
}
.btn-accept { color: var(--color-execution); border-color: var(--color-execution); }
.btn-accept:hover { background: var(--color-execution); color: #000; }
.btn-reject { color: var(--color-text-muted); border-color: var(--color-text-muted); }
.btn-reject:hover { background: var(--color-text-muted); color: #fff; }
.btn-evidence { color: var(--color-intelligence); border-color: var(--color-intelligence); }
.btn-evidence:hover { background: var(--color-intelligence); color: #000; }
</style>
