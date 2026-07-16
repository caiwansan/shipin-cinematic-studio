<!-- SignalCard — 企业信号卡片 -->
<!-- 输入: EnterpriseSignal 数据 -->
<!-- 展示: 信号类型 + 严重度 + 信号描述 + 来源 -->
<!-- CTO Rule: 用户看到的是"企业信号"而非技术术语 -->

<template>
  <div class="signal-card" :class="`severity-${severityClass}`">
    <!-- Header: 信号类型 + 严重度 -->
    <div class="signal-header">
      <div class="signal-type-row">
        <span class="signal-severity" :class="severityClass">{{ severityLabel }}</span>
        <span class="signal-type">{{ typeLabel }}</span>
      </div>
      <span class="signal-time">{{ formattedTime }}</span>
    </div>

    <!-- Body: 信号描述 -->
    <div class="signal-body">
      <p class="signal-description">{{ description }}</p>
      <div class="signal-source" v-if="sourceEvents && sourceEvents.length > 0">
        <span class="source-label">来源事件:</span>
        <span class="source-count">{{ sourceEvents.length }} 个</span>
      </div>
    </div>

    <!-- Actions -->
    <div class="signal-actions">
      <button class="signal-btn btn-detail" @click.stop="$emit('view')">查看详情</button>
      <button class="signal-btn btn-decision" @click.stop="$emit('generate-decision')">生成建议</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  signalType: string
  severity: string
  description?: string
  detectedAt?: string | Date
  sourceEvents?: any[]
}>()

defineEmits<{
  view: []
  'generate-decision': []
}>()

// 严重度映射：英文 → 中文用户语言
const severityLabel = computed(() => {
  const map: Record<string, string> = {
    critical: '高风险',
    warning: '注意',
    info: '提示',
    opportunity: '机会',
  }
  return map[props.severity] || '提示'
})

const severityClass = computed(() => {
  const map: Record<string, string> = {
    critical: 'high',
    warning: 'medium',
    info: 'low',
    opportunity: 'opportunity',
  }
  return map[props.severity] || 'low'
})

// 信号类型映射：英文 → 中文用户语言
const typeLabel = computed(() => {
  const map: Record<string, string> = {
    purchase_intent: '采购意向',
    sales_opportunity: '销售机会',
    support_issue: '客户问题',
    customer_feedback: '客户反馈',
    churn_risk: '流失风险',
    general: '一般信号',
  }
  return map[props.signalType] || '经营信号'
})

const formattedTime = computed(() => {
  if (!props.detectedAt) return ''
  const date = new Date(props.detectedAt)
  const diff = Date.now() - date.getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return '刚刚'
  if (min < 60) return `${min}分钟前`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}小时前`
  return `${Math.floor(hr / 24)}天前`
})
</script>

<style scoped>
.signal-card {
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  transition: all 0.2s;
}
.signal-card:hover {
  border-color: var(--color-border-secondary);
}
.signal-card.severity-high { border-left: 3px solid var(--color-danger); }
.signal-card.severity-medium { border-left: 3px solid var(--color-warning); }
.signal-card.severity-low { border-left: 3px solid var(--color-info); }
.signal-card.severity-opportunity { border-left: 3px solid var(--color-success); }

.signal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-md);
}
.signal-type-row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}
.signal-severity {
  font-size: var(--font-size-xs);
  font-weight: 700;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  flex-shrink: 0;
}
.signal-severity.high { background: rgba(239, 68, 68, 0.1); color: var(--color-danger); }
.signal-severity.medium { background: rgba(245, 158, 11, 0.1); color: var(--color-warning); }
.signal-severity.low { background: rgba(59, 130, 246, 0.1); color: var(--color-info); }
.signal-severity.opportunity { background: rgba(34, 197, 94, 0.1); color: var(--color-success); }
.signal-type { font-size: var(--font-size-sm); font-weight: 500; color: var(--color-text-primary); }
.signal-time { font-size: var(--font-size-xs); color: var(--color-text-muted); flex-shrink: 0; }

.signal-body {
  margin-top: var(--space-md);
}
.signal-description { font-size: var(--font-size-sm); color: var(--color-text-secondary); line-height: 1.5; }
.signal-source {
  display: flex;
  gap: var(--space-sm);
  margin-top: var(--space-sm);
  font-size: var(--font-size-xs);
}
.source-label { color: var(--color-text-muted); }
.source-count { color: var(--color-text-primary); font-weight: 500; }

.signal-actions {
  display: flex;
  gap: var(--space-sm);
  margin-top: var(--space-md);
  padding-top: var(--space-md);
  border-top: 1px solid var(--color-border-primary);
}
.signal-btn {
  padding: var(--space-sm) var(--space-md);
  font-size: var(--font-size-sm);
  border-radius: var(--radius-md);
  border: 1px solid;
  cursor: pointer;
  transition: all 0.2s;
  background: transparent;
}
.btn-detail { color: var(--color-text-muted); border-color: var(--color-border-primary); }
.btn-detail:hover { background: var(--color-bg-hover); border-color: var(--color-border-secondary); }
.btn-decision { color: var(--color-intelligence); border-color: var(--color-intelligence); }
.btn-decision:hover { background: var(--color-intelligence); color: #000; }
</style>
