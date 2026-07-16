<template>
  <div class="dashboard-module">
    <!-- AI Department Overview (Phase 3: CEO Command Center) -->
    <section v-if="aiOverview" class="section ai-overview-section">
      <AIDepartmentOverview :data="aiOverview" />
    </section>

    <!-- KPI Grid -->
    <section class="kpi-section">
      <div class="kpi-grid">
        <div class="kpi-card">
          <span class="kpi-label">企业信号</span>
          <span class="kpi-value">{{ aiOverview?.signalsDiscovered ?? signals.length }}</span>
          <span class="kpi-trend">今日</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-label">AI 建议</span>
          <span class="kpi-value">{{ aiOverview?.suggestionsGenerated ?? pendingDecisions.length }}</span>
          <span class="kpi-trend">需关注</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-label">自动执行</span>
          <span class="kpi-value">{{ aiOverview?.tasksExecuted ?? activeActions.length }}</span>
          <span class="kpi-trend">进行中</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-label">渠道状态</span>
          <span class="kpi-value text-green">正常</span>
          <span class="kpi-trend">已连接</span>
        </div>
      </div>
    </section>

    <!-- 今日概览 -->
    <section class="section">
      <h2 class="section-title">今日企业状态</h2>
      <div class="status-items">
        <div class="status-item">
          <span class="status-icon">📊</span>
          <span class="status-text">AI 今日发现 {{ signals.length }} 个企业经营信号</span>
          <span class="status-time">实时</span>
        </div>
        <div class="status-item">
          <span class="status-icon">💡</span>
          <span class="status-text">{{ pendingDecisions.length }} 条经营建议待您确认</span>
          <span class="status-time">实时</span>
        </div>
        <div class="status-item">
          <span class="status-icon">🚀</span>
          <span class="status-text">{{ activeActions.length }} 个执行任务正在进行中</span>
          <span class="status-time">实时</span>
        </div>
        <div class="status-item">
          <span class="status-icon">📡</span>
          <span class="status-text">所有渠道连接正常，数据同步中</span>
          <span class="status-time">刚刚</span>
        </div>
      </div>
    </section>

    <!-- P0.5: AI Next Actions -->
    <section class="section next-action-section">
      <AINextActionCard />
    </section>

    <!-- Quick Views Row -->
    <div class="split-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-lg);">
      <!-- Signal Preview -->
      <section class="section">
        <h2 class="section-title">最新信号</h2>
        <div v-if="signals.length > 0" class="mini-list">
          <SignalCard
            v-for="signal in signals.slice(0, 3)"
            :key="signal.id"
            :signal-type="signal.signalType"
            :severity="signal.severity"
            :description="signal.description"
            :detected-at="signal.detectedAt"
            :source-events="signal.sourceEvents"
          />
        </div>
        <EmptyState
          v-else
          icon="🔍"
          title="暂无企业信号"
          description="AI 引擎持续监控中，发现异常将立即通知。"
        />
      </section>

      <!-- Decision Preview -->
      <section class="section">
        <h2 class="section-title">AI 经营建议</h2>
        <div v-if="pendingDecisions.length > 0" class="mini-list">
          <DecisionCard
            v-for="rec in pendingDecisions.slice(0, 3)"
            :key="rec.id"
            :decision="{
              source: rec.source || 'WeCom',
              freshness: rec.createdAt,
              confidence: rec.priorityScore || 85,
              data: {
                title: rec.title,
                rationale: rec.rationale,
                priorityLevel: `P${rec.priority}`,
                decisionStatus: rec.decisionStatus,
              }
            }"
          />
        </div>
        <EmptyState
          v-else
          icon="💡"
          title="暂无待处理建议"
          description="AI 正持续分析，需要决策时将通知您。"
        />
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import SignalCard from '~/components/enterprise-ui/cards/SignalCard.vue'
import DecisionCard from '~/components/enterprise-ui/cards/DecisionCard.vue'
import EmptyState from '~/components/enterprise-ui/feedback/EmptyState.vue'
import AIDepartmentOverview from '~/components/enterprise/dashboard/AIDepartmentOverview.vue'
import AINextActionCard from '~/components/enterprise/dashboard/AINextActionCard.vue'
import { useAIDepartment } from '~/composables/useAIDepartment'

interface Signal {
  id: string
  signalType: string
  severity: string
  description: string
  detectedAt: string
  sourceEvents: string[]
}

interface Decision {
  id: string
  title: string
  rationale: string
  priority: number
  priorityScore?: number
  decisionStatus: string
  source?: string
  createdAt?: string
}

interface Action {
  id: string
  title: string
  status: string
}

const signals = ref<Signal[]>([])
const pendingDecisions = ref<Decision[]>([])
const activeActions = ref<Action[]>([])
const aiOverview = ref<any>(null)

const { fetchOverview } = useAIDepartment()

async function loadData() {
  // TODO: Connect to real API endpoints
}

async function loadAIDepartment() {
  // tenantId from auth context — placeholder for now
  const tenantId = 'demo'
  const data = await fetchOverview(tenantId)
  if (data) aiOverview.value = data
}

onMounted(() => {
  loadData()
  loadAIDepartment()
})
</script>

<style scoped>
.dashboard-module {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.ai-overview-section {
  background: transparent;
  border: none;
  padding: 0;
}

.next-action-section {
  padding: 0;
  background: transparent;
  border: none;
}

.kpi-section {
  margin-bottom: var(--space-sm);
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-md);
}

.kpi-card {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.kpi-label {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  margin-bottom: var(--space-xs);
}

.kpi-value {
  font-size: var(--font-size-2xl);
  font-weight: 700;
  color: var(--color-intelligence);
}

.kpi-value.text-green {
  color: #10b981;
}

.kpi-trend {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  margin-top: var(--space-xs);
}

.section {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-xl);
  padding: var(--space-xl);
}

.section-title {
  font-size: var(--font-size-lg);
  font-weight: 600;
  margin-bottom: var(--space-lg);
  color: var(--color-text-primary);
}

.status-items {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.status-item {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-md);
  background: var(--color-bg-elevated);
  border-radius: var(--radius-md);
}

.status-icon {
  font-size: var(--font-size-lg);
}

.status-text {
  flex: 1;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.status-time {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.mini-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

@media (max-width: 1024px) {
  .split-row {
    grid-template-columns: 1fr !important;
  }
}

@media (max-width: 768px) {
  .kpi-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
