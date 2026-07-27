<!-- /enterprise/dashboard.vue — CEO Command Center -->
<template>
  <div class="ceo-dashboard">
    <!-- Header -->
    <div class="dashboard-header">
      <div class="header-left">
        <h1>CEO Command Center</h1>
        <p class="header-subtitle">{{ todayLabel }} · AI 数字部门运营全景</p>
      </div>
      <div class="header-right">
        <div class="header-stats">
          <div class="stat-chip">
            <span class="stat-dot active"></span>
            <span>{{ workforceStatus.activeCount }} 活跃</span>
          </div>
          <div class="stat-chip">
            <span class="stat-value">{{ workforceStatus.todayTasks }}</span>
            <span>今日任务</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>加载运营数据中...</p>
    </div>

    <template v-else>
      <!-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ -->
      <!-- 1️⃣ Today Intelligence — 今日智能概览 -->
      <!-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ -->
      <DashboardSection title="今日智能" description="实时运营快照" icon="📊">
        <div class="intel-grid">
          <div class="intel-card workforce">
            <div class="intel-icon">🤖</div>
            <div class="intel-content">
              <span class="intel-value">{{ todayIntelligence.activeEmployees }}</span>
              <span class="intel-label">AI 员工活跃</span>
            </div>
            <span class="intel-detail">共 {{ todayIntelligence.totalEmployees }} 名</span>
          </div>
          <div class="intel-card opportunities">
            <div class="intel-icon">💡</div>
            <div class="intel-content">
              <span class="intel-value">{{ todayIntelligence.opportunities }}</span>
              <span class="intel-label">发现机会</span>
            </div>
            <span class="intel-detail">{{ todayIntelligence.opportunityDelta }}</span>
          </div>
          <div class="intel-card decisions">
            <div class="intel-icon">⚡</div>
            <div class="intel-content">
              <span class="intel-value">{{ todayIntelligence.pendingDecisions }}</span>
              <span class="intel-label">待决策</span>
            </div>
            <span class="intel-detail">{{ todayIntelligence.urgencyLabel }}</span>
          </div>
          <div class="intel-card executing">
            <div class="intel-icon">🔄</div>
            <div class="intel-content">
              <span class="intel-value">{{ todayIntelligence.executing }}</span>
              <span class="intel-label">执行中</span>
            </div>
            <span class="intel-detail">{{ todayIntelligence.executionRate }}</span>
          </div>
          <div class="intel-card completed">
            <div class="intel-icon">✅</div>
            <div class="intel-content">
              <span class="intel-value">{{ todayIntelligence.completed }}</span>
              <span class="intel-label">今日完成</span>
            </div>
            <span class="intel-detail">{{ todayIntelligence.completionRate }}</span>
          </div>
        </div>
      </DashboardSection>

      <!-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ -->
      <!-- 2️⃣ AI Workforce Overview — AI员工概览 -->
      <!-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ -->
      <DashboardSection title="AI 员工概览" description="每个 AI 员工今日工作成果" icon="👥">
        <div class="workforce-list">
          <div v-for="agent in workforceOverview" :key="agent.id" class="workforce-item">
            <div class="wf-avatar">
              <span class="wf-icon">{{ agent.icon }}</span>
              <span class="wf-status" :class="agent.status"></span>
            </div>
            <div class="wf-info">
              <div class="wf-header">
                <span class="wf-name">{{ agent.name }}</span>
                <span class="wf-dept">{{ agent.department }}</span>
              </div>
              <div class="wf-stats">
                <span class="wf-stat">今日任务 <strong>{{ agent.todayTasks }}</strong></span>
                <span class="wf-stat">完成 <strong>{{ agent.completed }}</strong></span>
                <span v-if="agent.discoveries > 0" class="wf-stat">发现 <strong>{{ agent.discoveries }}</strong></span>
              </div>
              <div v-if="agent.lastOutcome" class="wf-outcome">
                <span class="outcome-label">最新成果：</span>
                <span class="outcome-text">{{ agent.lastOutcome }}</span>
              </div>
            </div>
            <div class="wf-actions">
              <button class="wf-btn" @click="handleViewProfile(agent.id)">查看</button>
            </div>
          </div>
        </div>
        <div v-if="workforceOverview.length === 0" class="empty-state">
          <p>暂无 AI 员工 · <a href="/enterprise/marketplace">前往市场招聘</a></p>
        </div>
      </DashboardSection>

      <!-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ -->
      <!-- 3️⃣ Decision Intelligence — 决策智能 -->
      <!-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ -->
      <DashboardSection title="决策智能" description="AI 推荐的高价值决策" icon="🧠">
        <div class="decision-list">
          <div v-for="decision in decisions" :key="decision.id" class="decision-item">
            <div class="decision-score">
              <span class="score-value">{{ decision.score }}</span>
              <span class="score-label">决策分</span>
            </div>
            <div class="decision-content">
              <h4 class="decision-title">{{ decision.title }}</h4>
              <p class="decision-desc">{{ decision.description }}</p>
              <div class="decision-meta">
                <span class="meta-tag impact">影响: {{ decision.impact }}</span>
                <span class="meta-tag urgency">紧急: {{ decision.urgency }}</span>
                <span class="meta-tag confidence">置信: {{ decision.confidence }}%</span>
              </div>
            </div>
            <div class="decision-actions">
              <button class="decision-btn approve" @click="handleApprove(decision)">批准</button>
              <button class="decision-btn reject" @click="handleReject(decision)">拒绝</button>
            </div>
          </div>
        </div>
        <div v-if="decisions.length === 0" class="empty-state">
          <p>暂无待决策项 · AI 员工正在分析业务数据</p>
        </div>
      </DashboardSection>

      <!-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ -->
      <!-- 4️⃣ Action Loop — 执行闭环 -->
      <!-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ -->
      <DashboardSection title="执行闭环" description="决策 → 执行 → 成果 → 学习" icon="🔄">
        <div class="action-loop">
          <div class="loop-timeline">
            <div v-for="action in actionLoop" :key="action.id" class="loop-item">
              <div class="loop-status" :class="action.status"></div>
              <div class="loop-content">
                <span class="loop-title">{{ action.title }}</span>
                <span class="loop-time">{{ action.timestamp }}</span>
              </div>
              <span class="loop-state">{{ actionStatusLabel(action.status) }}</span>
            </div>
          </div>
        </div>
        <div v-if="actionLoop.length === 0" class="empty-state">
          <p>暂无执行任务 · <a href="/enterprise/decisions">查看决策中心</a></p>
        </div>
      </DashboardSection>

      <!-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ -->
      <!-- 5️⃣ ROI Dashboard — ROI 仪表盘 -->
      <!-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ -->
      <DashboardSection title="ROI 仪表盘" description="AI 数字部门创造的商业价值" icon="💰">
        <div class="roi-grid">
          <div class="roi-card">
            <span class="roi-icon">📈</span>
            <span class="roi-value">{{ roi.leads }}</span>
            <span class="roi-label">新增线索</span>
            <span class="roi-delta positive">+{{ roi.leadsDelta }}%</span>
          </div>
          <div class="roi-card">
            <span class="roi-icon">⏰</span>
            <span class="roi-value">{{ roi.hoursSaved }}</span>
            <span class="roi-label">节省人工(小时)</span>
            <span class="roi-delta positive">+{{ roi.hoursDelta }}%</span>
          </div>
          <div class="roi-card">
            <span class="roi-icon">📋</span>
            <span class="roi-value">{{ roi.tasksCompleted }}</span>
            <span class="roi-label">完成任务</span>
            <span class="roi-delta positive">+{{ roi.tasksDelta }}%</span>
          </div>
          <div class="roi-card highlight">
            <span class="roi-icon">💎</span>
            <span class="roi-value">¥{{ roi.estimatedRevenue }}</span>
            <span class="roi-label">预计收益</span>
            <span class="roi-delta positive">+{{ roi.revenueDelta }}%</span>
          </div>
        </div>
      </DashboardSection>

      <!-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ -->
      <!-- 6️⃣ Enterprise Timeline -->
      <!-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ -->
      <DashboardSection title="今日工作时间线" description="AI 员工如何创造价值" icon="📅">
        <EnterpriseTimeline :organization-id="organizationId" />
      </DashboardSection>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import DashboardSection from '~/components/enterprise/dashboard/DashboardSection.vue'
import EnterpriseTimeline from '~/components/enterprise/dashboard/EnterpriseTimeline.vue'

const loading = ref(true)
const todayLabel = ref('')

// Data
const todayIntelligence = ref<any>({})
const workforceOverview = ref<any[]>([])
const decisions = ref<any[]>([])
const actionLoop = ref<any[]>([])
const roi = ref<any>({})
const workforceStatus = ref<any>({ activeCount: 0, todayTasks: 0 })
const organizationId = ref('')

onMounted(async () => {
  todayLabel.value = formatToday()
  await loadDashboardData()
})

async function loadDashboardData() {
  loading.value = true
  try {
    const res = await fetch('/api/enterprise/dashboard/ceo', {
      headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
    })
    const data = await res.json()
    if (data.code === 0) {
      const d = data.data
      todayIntelligence.value = d.todayIntelligence || {}
      workforceOverview.value = d.workforceOverview || []
      decisions.value = d.decisions || []
      actionLoop.value = d.actionLoop || []
      roi.value = d.roi || {}
      workforceStatus.value = d.workforceStatus || {}
      organizationId.value = d.organizationId || ''
    }
  } catch (e) {
    console.error('Failed to load CEO dashboard:', e)
  } finally {
    loading.value = false
  }
}

function formatToday(): string {
  const d = new Date()
  const days = ['日', '一', '二', '三', '四', '五', '六']
  return `${d.getMonth() + 1}月${d.getDate()}日 周${days[d.getDay()]}`
}

function actionStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: '待批准',
    approved: '已批准',
    executing: '执行中',
    completed: '已完成',
    verified: '已验证',
  }
  return labels[status] || status
}

function handleViewProfile(agentId: string) {
  window.location.href = `/enterprise/agent/${agentId}`
}

function handleApprove(decision: any) {
  // Navigate to decisions page
  window.location.href = '/enterprise/decisions'
}

function handleReject(decision: any) {
  window.location.href = '/enterprise/decisions'
}
</script>

<style scoped>
.ceo-dashboard {
  max-width: 1200px;
  margin: 0 auto;
  padding: 32px 24px 60px;
  color: #e0e0e0;
}

/* Header */
.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 32px;
}
.header-left h1 {
  font-size: 28px;
  font-weight: bold;
  margin-bottom: 6px;
  background: linear-gradient(135deg, #e0e0e0, #60a5fa);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
.header-subtitle {
  font-size: 14px;
  color: #9ca3af;
}
.header-stats {
  display: flex;
  gap: 12px;
}
.stat-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  background: #1f2937;
  border: 1px solid #374151;
  border-radius: 20px;
  font-size: 13px;
}
.stat-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #6b7280;
}
.stat-dot.active {
  background: #22c55e;
  box-shadow: 0 0 6px rgba(34, 197, 94, 0.5);
}
.stat-value {
  font-weight: bold;
  color: #60a5fa;
}

/* Loading */
.loading-state {
  text-align: center;
  padding: 60px;
  color: #6b7280;
}
.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #374151;
  border-top-color: #60a5fa;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 12px;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* Today Intelligence */
.intel-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
}
.intel-card {
  background: #1f2937;
  border: 1px solid #374151;
  border-radius: 12px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.intel-card.workforce { border-left: 3px solid #60a5fa; }
.intel-card.opportunities { border-left: 3px solid #f59e0b; }
.intel-card.decisions { border-left: 3px solid #ef4444; }
.intel-card.executing { border-left: 3px solid #8b5cf6; }
.intel-card.completed { border-left: 3px solid #22c55e; }
.intel-icon {
  font-size: 20px;
}
.intel-value {
  font-size: 28px;
  font-weight: bold;
}
.intel-label {
  font-size: 13px;
  color: #9ca3af;
}
.intel-detail {
  font-size: 12px;
  color: #6b7280;
}

/* Workforce Overview */
.workforce-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.workforce-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: #1f2937;
  border: 1px solid #374151;
  border-radius: 12px;
}
.wf-avatar {
  position: relative;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #374151;
  border-radius: 10px;
}
.wf-icon {
  font-size: 20px;
}
.wf-status {
  position: absolute;
  bottom: -2px;
  right: -2px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 2px solid #1f2937;
}
.wf-status.active { background: #22c55e; }
.wf-status.idle { background: #f59e0b; }
.wf-status.inactive { background: #6b7280; }

.wf-info {
  flex: 1;
}
.wf-header {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 4px;
}
.wf-name {
  font-weight: bold;
  font-size: 15px;
}
.wf-dept {
  font-size: 12px;
  color: #6b7280;
}
.wf-stats {
  display: flex;
  gap: 16px;
  font-size: 13px;
  color: #9ca3af;
}
.wf-stat strong {
  color: #d1d5db;
}
.wf-outcome {
  margin-top: 6px;
  font-size: 12px;
}
.outcome-label {
  color: #6b7280;
}
.outcome-text {
  color: #86efac;
}

.wf-btn {
  padding: 6px 14px;
  background: transparent;
  border: 1px solid #4b5563;
  border-radius: 6px;
  color: #d1d5db;
  font-size: 13px;
  cursor: pointer;
}
.wf-btn:hover {
  border-color: #60a5fa;
  color: #60a5fa;
}

/* Decisions */
.decision-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.decision-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: #1f2937;
  border: 1px solid #374151;
  border-radius: 12px;
}
.decision-score {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 56px;
}
.score-value {
  font-size: 24px;
  font-weight: bold;
  color: #f59e0b;
}
.score-label {
  font-size: 11px;
  color: #6b7280;
}
.decision-content {
  flex: 1;
}
.decision-title {
  font-size: 15px;
  font-weight: bold;
  margin-bottom: 4px;
}
.decision-desc {
  font-size: 13px;
  color: #9ca3af;
  margin-bottom: 8px;
}
.decision-meta {
  display: flex;
  gap: 8px;
}
.meta-tag {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
}
.meta-tag.impact { background: rgba(96, 165, 250, 0.1); color: #60a5fa; }
.meta-tag.urgency { background: rgba(239, 68, 68, 0.1); color: #f87171; }
.meta-tag.confidence { background: rgba(34, 197, 94, 0.1); color: #86efac; }

.decision-actions {
  display: flex;
  gap: 8px;
}
.decision-btn {
  padding: 6px 14px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
}
.decision-btn.approve {
  background: #22c55e;
  color: #fff;
}
.decision-btn.reject {
  background: #374151;
  color: #9ca3af;
}

/* Action Loop */
.action-loop {
  padding: 8px 0;
}
.loop-timeline {
  display: flex;
  flex-direction: column;
  gap: 0;
}
.loop-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid #374151;
}
.loop-item:last-child {
  border-bottom: none;
}
.loop-status {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
.loop-status.pending { background: #f59e0b; }
.loop-status.approved { background: #60a5fa; }
.loop-status.executing { background: #8b5cf6; }
.loop-status.completed { background: #22c55e; }
.loop-status.verified { background: #22c55e; box-shadow: 0 0 6px rgba(34, 197, 94, 0.5); }

.loop-content {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.loop-title {
  font-size: 14px;
}
.loop-time {
  font-size: 12px;
  color: #6b7280;
}
.loop-state {
  font-size: 12px;
  color: #9ca3af;
}

/* ROI */
.roi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
}
.roi-card {
  background: #1f2937;
  border: 1px solid #374151;
  border-radius: 12px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  text-align: center;
}
.roi-card.highlight {
  border-color: #60a5fa;
  background: rgba(96, 165, 250, 0.05);
}
.roi-icon {
  font-size: 24px;
}
.roi-value {
  font-size: 28px;
  font-weight: bold;
}
.roi-label {
  font-size: 13px;
  color: #9ca3af;
}
.roi-delta {
  font-size: 12px;
}
.roi-delta.positive {
  color: #86efac;
}
.roi-delta.negative {
  color: #f87171;
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: 24px;
  color: #6b7280;
  font-size: 14px;
}
.empty-state a {
  color: #60a5fa;
  text-decoration: none;
}
</style>
