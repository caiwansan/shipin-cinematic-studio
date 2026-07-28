<!-- EnterpriseTimeline.vue — ER-01-TASK-03 -->
<!-- AI 企业部门工作流水线 -->
<!-- 让 CEO 看到: AI员工 → 执行动作 → 产生结果 → 形成业务影响 -->
<template>
  <div class="enterprise-timeline">
    <!-- 时间线头部 -->
    <div class="timeline-header">
      <div class="timeline-header__left">
        <span class="timeline-icon">📜</span>
        <h3 class="timeline-title">今日 AI 工作记录</h3>
      </div>
      <div class="timeline-header__right" v-if="summary">
        <span class="timeline-summary">
          {{ summary.totalEvents }} 条记录 · {{ summary.activeAgents }} 名 AI 在岗
        </span>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="timeline-loading">
      <div class="timeline-spinner"></div>
      <span>汇总今日工作记录中...</span>
    </div>

    <!-- Empty State -->
    <div v-else-if="!loading && items.length === 0" class="timeline-empty">
      <div class="timeline-empty__icon">📜</div>
      <h4 class="timeline-empty__title">AI 员工还没有产生今日记录</h4>
      <p class="timeline-empty__desc">
        完成第一个任务后，<br />这里会展示企业 AI 部门工作轨迹。
      </p>
    </div>

    <!-- Timeline Items -->
    <div v-else class="timeline-body">
      <div
        v-for="item in items"
        :key="item.id"
        class="timeline-item"
        :class="{ 'timeline-item--outcome': item.type === 'outcome' }"
      >
        <!-- Timeline dot -->
        <div class="timeline-item__dot" :class="`dot-${item.type}`">
          <span class="dot-icon">{{ itemIcon(item) }}</span>
        </div>

        <!-- Content -->
        <div class="timeline-item__content">
          <!-- Time + Agent -->
          <div class="timeline-item__meta">
            <span class="timeline-item__time">{{ formatTime(item.timestamp) }}</span>
            <span class="timeline-item__agent">
              <span class="agent-emoji">{{ agentEmoji(item.agentType) }}</span>
              {{ item.agentName }}
            </span>
          </div>

          <!-- Action -->
          <div class="timeline-item__action">
            {{ item.action }}
          </div>

          <!-- Outcome chain (因果链) -->
          <div v-if="item.outcome || item.impactValue" class="timeline-item__chain">
            <span v-if="item.outcome" class="chain-arrow">↓</span>
            <span v-if="item.outcome" class="chain-outcome">{{ item.outcome }}</span>
          </div>

          <!-- Impact badge -->
          <div v-if="item.impactValue" class="timeline-item__impact">
            <span class="impact-badge" :class="impactClass(item.impactType)">
              <span class="impact-icon">💰</span>
              <span class="impact-value">{{ formatImpact(item.impactValue, item.impactType) }}</span>
              <span v-if="item.impactType" class="impact-type">{{ impactLabel(item.impactType) }}</span>
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Summary Footer -->
    <div v-if="summary && items.length > 0" class="timeline-footer">
      <div class="timeline-footer__stat">
        <span class="stat-value">{{ summary.totalActions }}</span>
        <span class="stat-label">执行动作</span>
      </div>
      <div class="timeline-footer__divider"></div>
      <div class="timeline-footer__stat">
        <span class="stat-value">{{ summary.totalOutcomes }}</span>
        <span class="stat-label">产生成果</span>
      </div>
      <div v-if="summary.totalRevenue" class="timeline-footer__divider"></div>
      <div v-if="summary.totalRevenue" class="timeline-footer__stat">
        <span class="stat-value stat-value--revenue">{{ summary.totalRevenue }}</span>
        <span class="stat-label">业务价值</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { getAuthToken } from '~/utils/auth/token'
import { ref, onMounted, computed } from 'vue'

// ─── Types ───────────────────────────────────────────────
interface TimelineItem {
  id: string
  timestamp: string
  type: 'operation_event' | 'outcome'
  agentId: string | null
  agentName: string
  agentType: string | null
  action: string
  actionType: string
  targetType: string | null
  targetId: string | null
  outcome: string | null
  impactValue: string | null
  impactUnit: string | null
  impactType: string | null
}

interface TimelineSummary {
  totalActions: number
  totalOutcomes: number
  totalEvents: number
  activeAgents: number
  totalRevenue: string | null
}

interface TimelineData {
  date: string
  organizationId: string
  summary: TimelineSummary
  items: TimelineItem[]
}

// ─── Props ───────────────────────────────────────────────
const props = defineProps<{
  organizationId?: string
  prefetchedData?: TimelineData | null
}>()

// ─── State ───────────────────────────────────────────────
const loading = ref(true)
const error = ref<string | null>(null)
const timelineData = ref<TimelineData | null>(null)

const items = computed(() => timelineData.value?.items ?? [])
const summary = computed(() => timelineData.value?.summary ?? null)

// ─── Helpers ─────────────────────────────────────────────
function formatTime(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

function agentEmoji(agentType: string | null): string {
  if (!agentType) return '🤖'
  const lower = agentType.toLowerCase()
  if (lower.includes('sale') || lower.includes('growth') || lower.includes('销售') || lower.includes('增长')) return '🤖'
  if (lower.includes('content') || lower.includes('内容') || lower.includes('market')) return '✍️'
  if (lower.includes('analy') || lower.includes('分析') || lower.includes('intel')) return '🔍'
  if (lower.includes('support') || lower.includes('客服') || lower.includes('success')) return '💬'
  if (lower.includes('operation') || lower.includes('运营')) return '📊'
  if (lower.includes('knowledge') || lower.includes('知识')) return '📚'
  return '🤖'
}

function itemIcon(item: TimelineItem): string {
  if (item.type === 'outcome') return '🎯'
  if (item.actionType?.includes('channel')) return '📡'
  if (item.actionType?.includes('approval')) return '✅'
  if (item.actionType?.includes('action.completed')) return '⚡'
  if (item.actionType?.includes('action')) return '⚙️'
  if (item.actionType?.includes('tenant')) return '🏢'
  if (item.actionType?.includes('user')) return '👤'
  return '📋'
}

function formatImpact(value: string, type: string | null): string {
  if (type === 'REVENUE' || type === 'COST_SAVED') return `¥${Number(value).toLocaleString()}`
  if (type === 'TIME_SAVED') return `${value}小时`
  if (type === 'LEADS_GENERATED') return `${value}个`
  return value
}

function impactLabel(type: string | null): string {
  if (!type) return ''
  const map: Record<string, string> = {
    'REVENUE': '收入',
    'COST_SAVED': '节省',
    'TIME_SAVED': '省时',
    'LEADS_GENERATED': '线索',
    'CONTENT_CREATED': '内容',
  }
  return map[type] || type
}

function impactClass(type: string | null): string {
  if (!type) return 'impact-general'
  if (type === 'REVENUE' || type === 'COST_SAVED') return 'impact-revenue'
  if (type === 'LEADS_GENERATED') return 'impact-leads'
  return 'impact-general'
}

// ─── Data Fetching ───────────────────────────────────────
async function fetchTimeline() {
  // Use prefetched data if available
  if (props.prefetchedData) {
    timelineData.value = props.prefetchedData
    loading.value = false
    return
  }

  loading.value = true
  error.value = null

  try {
    const token = getAuthToken() || ''
    const res = await fetch('/api/enterprise/timeline', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })

    if (res.ok) {
      const json = await res.json()
      if (json.code === 0 && json.data) {
        timelineData.value = json.data
      }
    }
  } catch (e: any) {
    error.value = e.message || 'fetch-failed'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchTimeline()
})
</script>

<style scoped>
/* ═══════════════════════════════════════════════════════════ */
/* Enterprise Timeline Container                              */
/* ═══════════════════════════════════════════════════════════ */
.enterprise-timeline {
  background: #0D1328;
  border: 1px solid #1A2240;
  border-radius: 16px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ─── Header ─── */
.timeline-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 12px;
  border-bottom: 1px solid #1A2240;
}

.timeline-header__left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.timeline-icon {
  font-size: 18px;
}

.timeline-title {
  font-size: 15px;
  font-weight: 600;
  color: #e8e8e8;
  margin: 0;
}

.timeline-summary {
  font-size: 11px;
  color: #5A6A8A;
}

/* ─── Loading ─── */
.timeline-loading {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 40px 0;
  justify-content: center;
  color: rgba(255, 255, 255, 0.5);
  font-size: 13px;
}

.timeline-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-top-color: #3B82F6;
  border-radius: 50%;
  animation: timeline-spin 1s linear infinite;
}

@keyframes timeline-spin {
  to { transform: rotate(360deg); }
}

/* ─── Empty State ─── */
.timeline-empty {
  text-align: center;
  padding: 36px 20px;
}

.timeline-empty__icon {
  font-size: 40px;
  margin-bottom: 12px;
  opacity: 0.7;
}

.timeline-empty__title {
  font-size: 15px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.8);
  margin: 0 0 8px;
}

.timeline-empty__desc {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
  line-height: 1.6;
  margin: 0;
}

/* ─── Timeline Body ─── */
.timeline-body {
  display: flex;
  flex-direction: column;
  gap: 0;
  position: relative;
}

.timeline-body::before {
  content: '';
  position: absolute;
  left: 15px;
  top: 24px;
  bottom: 24px;
  width: 2px;
  background: linear-gradient(180deg, #1A2240, #1A224020);
  border-radius: 1px;
}

/* ─── Timeline Item ─── */
.timeline-item {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 12px 0;
  position: relative;
}

.timeline-item__dot {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  z-index: 1;
  background: #111833;
  border: 2px solid #1A2240;
}

.dot-operation_event { border-color: #2A3358; }
.dot-outcome { border-color: #10B98150; background: #0D2818; }

.dot-icon {
  font-size: 12px;
}

.timeline-item__content {
  flex: 1;
  min-width: 0;
  padding-top: 2px;
}

/* Meta row */
.timeline-item__meta {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 4px;
}

.timeline-item__time {
  font-size: 12px;
  color: #5A6A8A;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

.timeline-item__agent {
  font-size: 12px;
  color: #3B82F6;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.agent-emoji {
  font-size: 12px;
}

/* Action text */
.timeline-item__action {
  font-size: 13px;
  color: #D1D5DB;
  line-height: 1.4;
  margin-bottom: 4px;
}

/* Outcome chain (因果链) */
.timeline-item__chain {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
}

.chain-arrow {
  font-size: 11px;
  color: #3B82F6;
}

.chain-outcome {
  font-size: 11px;
  color: #34D399;
  background: rgba(16, 185, 129, 0.08);
  padding: 2px 8px;
  border-radius: 6px;
}

/* Impact badge */
.timeline-item__impact {
  margin-top: 6px;
}

.impact-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 600;
}

.impact-revenue {
  background: rgba(251, 191, 36, 0.1);
  color: #FCD34D;
  border: 1px solid rgba(251, 191, 36, 0.2);
}

.impact-leads {
  background: rgba(59, 130, 246, 0.1);
  color: #60A5FA;
  border: 1px solid rgba(59, 130, 246, 0.2);
}

.impact-general {
  background: rgba(139, 92, 246, 0.1);
  color: #A78BFA;
  border: 1px solid rgba(139, 92, 246, 0.2);
}

.impact-icon {
  font-size: 11px;
}

.impact-type {
  font-size: 10px;
  opacity: 0.7;
  margin-left: 2px;
}

/* ─── Footer Summary ─── */
.timeline-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  padding-top: 14px;
  border-top: 1px solid #1A2240;
}

.timeline-footer__stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.stat-value {
  font-size: 18px;
  font-weight: 700;
  color: #e8e8e8;
}

.stat-value--revenue {
  color: #FCD34D;
}

.stat-label {
  font-size: 10px;
  color: #5A6A8A;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.timeline-footer__divider {
  width: 1px;
  height: 28px;
  background: #1A2240;
}

/* ─── Outcome item highlight ─── */
.timeline-item--outcome {
  background: linear-gradient(90deg, rgba(16, 185, 129, 0.03), transparent);
  border-radius: 8px;
  padding-left: 4px;
  padding-right: 4px;
}

/* ─── Responsive ─── */
@media (max-width: 640px) {
  .enterprise-timeline {
    padding: 16px;
  }

  .timeline-title {
    font-size: 14px;
  }

  .timeline-item__meta {
    flex-wrap: wrap;
    gap: 6px;
  }

  .timeline-footer {
    gap: 12px;
  }
}
</style>
