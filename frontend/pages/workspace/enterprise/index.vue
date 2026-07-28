<!-- UX-03B: 企业招聘指挥中心首页（产品化重构） -->
<!-- TASK-UX-01 Phase 2-3: 新信息架构 -->
<!-- 目标：第一屏展示 "我是谁 / AI团队 / 当前状态 / 下一步" -->
<template>
  <div class="rec-home">
    <!-- ─── 企业身份区 ─── -->
    <div class="rec-identity">
      <div class="rec-identity-brand">
        <span class="rec-identity-icon">🏢</span>
        <div>
          <h1 class="rec-identity-name">{{ enterpriseName || '企业招聘指挥中心' }}</h1>
          <p class="rec-identity-status">
            <span class="rec-identity-dot" :class="healthClass"></span>
            {{ healthMessage }}
          </p>
        </div>
      </div>
      <div class="rec-identity-summary">
        <div class="rec-summary-item">
          <span class="rec-summary-value">{{ summary.jobs }}</span>
          <span class="rec-summary-label">在招岗位</span>
        </div>
        <div class="rec-summary-divider"></div>
        <div class="rec-summary-item">
          <span class="rec-summary-value">{{ summary.candidates }}</span>
          <span class="rec-summary-label">候选人</span>
        </div>
        <div class="rec-summary-divider"></div>
        <div class="rec-summary-item">
          <span class="rec-summary-value">{{ summary.interviews }}</span>
          <span class="rec-summary-label">待面试</span>
        </div>
        <div class="rec-summary-divider"></div>
        <div class="rec-summary-item">
          <span class="rec-summary-value">{{ summary.offers }}</span>
          <span class="rec-summary-label">Offer 决策</span>
        </div>
      </div>
      <div class="rec-identity-actions">
        <button class="rec-action-primary" @click="navigateTo('/workspace/enterprise/jobs')">
          📝 创建岗位
        </button>
        <button class="rec-action-secondary" @click="navigateTo('/workspace/enterprise/talent')">
          🔍 人才池
        </button>
      </div>
      <RecruitmentFunnel v-if="funnelStages.length > 0" :stages="funnelStages" mini class="rec-home-funnel" />
    </div>

    <!-- ─── Loading State ─── -->
    <div v-if="loading" class="rec-loading">
      <div class="rec-loading-spinner"></div>
      <div class="rec-loading-text">
        <p>正在加载招聘数据...</p>
        <span>AI 招聘团队正在为您准备今日信息</span>
      </div>
    </div>

    <!-- ─── No Enterprise ─── -->
    <div v-else-if="hasNoEnterprise" class="rec-empty">
      <div class="rec-empty-icon">🏢</div>
      <h2>欢迎使用 AI 招聘中心</h2>
      <p>创建企业后，AI 招聘团队将自动为您工作</p>
      <button class="rec-action-primary rec-action--lg" @click="navigateTo('/workspace/enterprise/onboarding')">
        🚀 立即创建企业
      </button>
    </div>

    <!-- ─── Empty State (有企业但无数据) ─── -->
    <div v-else-if="isEmpty" class="rec-empty rec-empty--first">
      <div class="rec-empty-icon">🎯</div>
      <h2>开始你的第一次 AI 招聘</h2>
      <p>只需三步：创建岗位 → AI 自动搜索 → 推荐候选人</p>
      <div class="rec-empty-steps">
        <div class="rec-step">
          <div class="rec-step-num">1</div>
          <div class="rec-step-body">
            <span class="rec-step-title">创建岗位</span>
            <span class="rec-step-desc">填写职位信息，或上传 JD 让 AI 自动生成</span>
          </div>
        </div>
        <div class="rec-step">
          <div class="rec-step-num">2</div>
          <div class="rec-step-body">
            <span class="rec-step-title">AI 自动搜索</span>
            <span class="rec-step-desc">AI 招聘员工自动匹配人才、分析简历</span>
          </div>
        </div>
        <div class="rec-step">
          <div class="rec-step-num">3</div>
          <div class="rec-step-body">
            <span class="rec-step-title">推荐候选人</span>
            <span class="rec-step-desc">AI 推荐最佳候选人，你只需做决策</span>
          </div>
        </div>
      </div>
      <button class="rec-action-primary rec-action--lg" @click="navigateTo('/workspace/enterprise/jobs')">
        📝 创建首个岗位
      </button>
    </div>

    <!-- ─── 核心内容区（有数据时） ─── -->
    <template v-else>
      <!-- AI 招聘团队 -->
      <AiTeamDisplay
        :agents="agentData"
        :loading="agentsLoading"
        @create-job="navigateTo('/workspace/enterprise/jobs')"
        @view-agent="(id) => {}"
      />

      <!-- 招聘驾驶舱 (Pipeline 概览) -->
      <div class="rec-cockpit">
        <div class="rec-cockpit-header">
          <h3 class="rec-cockpit-title">📊 招聘驾驶舱</h3>
        </div>
        <div class="rec-cockpit-flow">
          <div
            v-for="(stage, idx) in pipelineFlow"
            :key="stage.key"
            :class="['rec-flow-node', { 'rec-flow-node--active': stage.count > 0 }]"
          >
            <span class="rec-flow-icon">{{ stage.icon }}</span>
            <span class="rec-flow-count">{{ stage.count || 0 }}</span>
            <span class="rec-flow-label">{{ stage.label }}</span>
            <div v-if="idx < pipelineFlow.length - 1" class="rec-flow-arrow">→</div>
          </div>
        </div>
        <!-- AI 建议 -->
        <div v-if="aiSuggestion" class="rec-suggestion">
          <span class="rec-suggestion-icon">💡</span>
          <span class="rec-suggestion-text">{{ aiSuggestion }}</span>
          <button
            v-if="aiSuggestionAction"
            class="rec-suggestion-btn"
            @click="navigateTo(aiSuggestionAction)"
          >
            查看 →
          </button>
        </div>
      </div>

      <!-- 今日任务 + 动态两栏 -->
      <div class="rec-split">
        <TodayTasks
          :pending-candidates="data!.todayMetrics.pendingCandidates || 0"
          :pending-jobs="data!.todayMetrics.pendingJobs || 0"
          :pending-resumes="data!.todayMetrics.pendingResumes || 0"
          @create-job="navigateTo('/workspace/enterprise/jobs')"
        />
        <SectionCard title="招聘动态">
          <ActivityFeed :items="data!.activityFeed" />
        </SectionCard>
      </div>

      <!-- 需要处理 -->
      <div v-if="pendingItems.length > 0" class="rec-pending">
        <SectionCard title="需要处理">
          <PendingList :items="pendingItems" />
        </SectionCard>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { getAuthToken } from '~/utils/auth/token'
import AiTeamDisplay from '~/components/enterprise/AiTeamDisplay.vue'
import TodayTasks from '~/components/enterprise/TodayTasks.vue'
import SectionCard from '~/components/recruitment/SectionCard.vue'
import ActivityFeed from '~/components/recruitment/ActivityFeed.vue'
import PendingList from '~/components/recruitment/PendingList.vue'
import RecruitmentFunnel from '~/components/recruitment/RecruitmentFunnel.vue'

interface EnterpriseHomeDTO {
  hasEnterprise?: boolean
  enterpriseName?: string
  message?: string
  todayMetrics: {
    conversations: number; interviews: number; campaigns: number; newResumes: number; offers: number; hires: number
    pendingCandidates?: number; pendingJobs?: number; pendingResumes?: number
  }
  funnel: Array<{ label: string; value: number }>
  needsAttention: Array<{ label: string; count: number }>
  activityFeed: Array<{ time: string; text: string; type: string }>
  departmentHealth: { status: 'healthy' | 'warning' | 'critical' | 'unknown'; message: string; activeCount: number; pausedCount: number }
}

interface AgentDTO {
  id: string
  name: string
  type: string
  status: string
  totalTasks?: number
  stats?: { completedToday?: number; discovered?: number; pending?: number }
}

const router = useRouter()
const loading = ref(true)
const agentsLoading = ref(false)
const data = ref<EnterpriseHomeDTO | null>(null)
const agentData = ref<AgentDTO[]>([])

// ─── Computed ───
const hasNoEnterprise = computed(() => data.value?.hasEnterprise === false)
const healthMessage = computed(() => {
  if (!data.value) return '加载中...'
  const h = data.value.departmentHealth
  if (h.status === 'healthy') return `${h.activeCount} 个 AI 员工运行中 · 状态正常`
  if (h.status === 'warning') return h.message || '部分 AI 员工异常'
  if (h.status === 'critical') return h.message || 'AI 团队异常，请检查'
  return h.message || 'AI 员工待命'
})
const healthClass = computed(() => {
  if (!data.value) return ''
  return `rec-dot--${data.value.departmentHealth.status}`
})
const enterpriseName = computed(() => data.value?.enterpriseName || '')
const isEmpty = computed(() => {
  if (!data.value) return false
  if (data.value.hasEnterprise === false) return false
  const d = data.value
  return d.todayMetrics.conversations === 0 && d.todayMetrics.interviews === 0 && d.funnel.length === 0
})

const summary = computed(() => ({
  jobs: data.value?.todayMetrics.pendingJobs || 0,
  candidates: data.value?.todayMetrics.pendingCandidates || 0,
  interviews: data.value?.todayMetrics.interviews || 0,
  offers: data.value?.todayMetrics.offers || 0,
}))

const funnelStages = computed(() => data.value?.funnel || [])

const pendingItems = computed(() => {
  if (!data.value) return []
  return data.value.needsAttention.map((item, i) => ({
    ...item,
    href: [
      '/workspace/enterprise/conversations?status=WAITING_HR_REVIEW',
      '/workspace/enterprise/interview?status=PASSED',
      '/workspace/enterprise/interview?status=PASSED',
    ][i] || '/workspace/enterprise',
  }))
})

const pipelineFlow = computed(() => {
  const stages = data.value?.funnel || []
  if (stages.length === 0) return []
  return stages.map((s, i) => ({
    key: s.label,
    label: s.label,
    icon: ['📋', '🔍', '📄', '🎤', '📑', '📨'][i] || '•',
    count: s.value,
  }))
})

// ─── AI 建议（对应 CTO 要求的 "今日AI建议"） ───
const aiSuggestion = computed<string | null>(() => {
  if (!data.value) return null
  const d = data.value

  if ((d.todayMetrics.pendingJobs || 0) === 0) {
    return '暂无在招岗位，建议创建新岗位开始招聘'
  }
  if ((d.todayMetrics.pendingCandidates || 0) > 0) {
    return `${d.todayMetrics.pendingCandidates} 名候选人待处理，AI 已初步筛选，建议安排面试`
  }
  if ((d.todayMetrics.offers || 0) > 0) {
    return `${d.todayMetrics.offers} 个面试通过，建议发送 Offer`
  }
  const total = d.funnel.reduce((s, f) => s + f.value, 0)
  if (total > 0) {
    return `Pipeline 共 ${total} 名候选人，建议查看整体进展`
  }
  return null
})

const aiSuggestionAction = computed<string | null>(() => {
  if (!data.value || !aiSuggestion.value) return null
  const d = data.value
  if ((d.todayMetrics.pendingJobs || 0) === 0) return '/workspace/enterprise/jobs'
  if ((d.todayMetrics.pendingCandidates || 0) > 0) return '/workspace/enterprise/interview'
  if ((d.todayMetrics.offers || 0) > 0) return '/workspace/enterprise/interview'
  return '/workspace/enterprise'
})

function navigateTo(path: string) {
  router.push(path)
}

async function loadAgents() {
  agentsLoading.value = true
  try {
    const token = getAuthToken() || ''
    const res = await fetch('/api/enterprise/agent-profiles', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (res.ok) {
      const json = await res.json()
      if (json?.data) {
        agentData.value = json.data.map((a: any) => ({
          id: a.id,
          name: a.name,
          type: a.agentType || a.type || 'recruiter',
          status: a.status || 'active',
          totalTasks: a.totalTasks || 0,
        }))
      }
    }
  } catch (e) {
    console.error('Failed to load agents:', e)
  } finally {
    agentsLoading.value = false
  }
}

async function loadData() {
  loading.value = true
  try {
    const token = getAuthToken() || ''
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`
    const res = await fetch('/api/enterprise/home', { headers })
    if (res.ok) {
      const json = await res.json()
      if (json.todayMetrics) {
        data.value = json as EnterpriseHomeDTO
      }
    }
  } catch (e) {
    console.error('Failed to load enterprise home:', e)
  } finally {
    loading.value = false
  }
}

let refreshTimer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  loadData()
  loadAgents()
  refreshTimer = setInterval(() => { loadData(); loadAgents() }, 60000)
})

onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer)
})
</script>

<style scoped>
.rec-home {
  padding: var(--rec-space-6);
  max-width: 1000px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--rec-space-6);
}

/* ─── Identity ─── */
.rec-identity {
  background: linear-gradient(135deg, rgba(96, 165, 250, 0.06), rgba(168, 85, 247, 0.04));
  border: 1px solid rgba(96, 165, 250, 0.15);
  border-radius: var(--rec-radius-lg);
  padding: var(--rec-space-6);
  display: flex;
  flex-direction: column;
  gap: var(--rec-space-4);
}

.rec-identity-brand {
  display: flex;
  align-items: center;
  gap: var(--rec-space-3);
}

.rec-identity-icon {
  font-size: 1.8rem;
}

.rec-identity-name {
  font-size: var(--rec-text-xl);
  font-weight: 700;
  color: var(--rec-text-primary);
  margin: 0;
}

.rec-identity-status {
  font-size: var(--rec-text-sm);
  color: var(--rec-text-secondary);
  margin: 2px 0 0;
  display: flex;
  align-items: center;
  gap: 6px;
}

.rec-identity-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}
.rec-dot--healthy { background: #22c55e; }
.rec-dot--warning { background: #f59e0b; }
.rec-dot--critical { background: #ef4444; }
.rec-dot--unknown { background: #6b7280; }

.rec-identity-summary {
  display: flex;
  align-items: center;
  gap: var(--rec-space-6);
  padding: var(--rec-space-4) 0;
}

.rec-summary-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 60px;
}

.rec-summary-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--rec-brand);
}

.rec-summary-label {
  font-size: var(--rec-text-xs);
  color: var(--rec-text-muted);
  margin-top: 2px;
}

.rec-summary-divider {
  width: 1px;
  height: 32px;
  background: var(--rec-border-secondary);
}

.rec-identity-actions {
  display: flex;
  gap: var(--rec-space-3);
}

.rec-home-funnel {
  margin-top: var(--rec-space-2);
}

/* ─── Actions ─── */
.rec-action-primary {
  padding: 10px 20px;
  font-size: var(--rec-text-md);
  font-weight: 600;
  background: linear-gradient(135deg, #60a5fa, #3b82f6);
  border: none;
  border-radius: var(--rec-radius-md);
  color: #fff;
  cursor: pointer;
  transition: box-shadow 0.15s, transform 0.15s;
}
.rec-action-primary:hover {
  box-shadow: 0 4px 16px rgba(96, 165, 250, 0.3);
  transform: translateY(-1px);
}
.rec-action--lg {
  padding: 12px 28px;
  font-size: 1rem;
}

.rec-action-secondary {
  padding: 10px 20px;
  font-size: var(--rec-text-md);
  font-weight: 500;
  background: var(--rec-bg-primary);
  border: 1px solid var(--rec-border-primary);
  border-radius: var(--rec-radius-md);
  color: var(--rec-text-secondary);
  cursor: pointer;
  transition: all 0.15s;
}
.rec-action-secondary:hover {
  background: var(--rec-bg-hover);
  border-color: rgba(96, 165, 250, 0.3);
  color: var(--rec-text-primary);
}

/* ─── Loading ─── */
.rec-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--rec-space-4);
  padding: var(--rec-space-12) var(--rec-space-6);
  background: var(--rec-bg-secondary);
  border: 1px solid var(--rec-border-primary);
  border-radius: var(--rec-radius-lg);
}

.rec-loading-spinner {
  width: 24px;
  height: 24px;
  border: 3px solid var(--rec-border-primary);
  border-top-color: var(--rec-brand);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.rec-loading-text p {
  margin: 0;
  font-weight: 600;
  color: var(--rec-text-primary);
}
.rec-loading-text span {
  font-size: var(--rec-text-sm);
  color: var(--rec-text-muted);
}

/* ─── Empty State ─── */
.rec-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: var(--rec-space-10) var(--rec-space-6);
  background: var(--rec-bg-secondary);
  border: 1px solid var(--rec-border-primary);
  border-radius: var(--rec-radius-lg);
}

.rec-empty-icon {
  font-size: 3rem;
  margin-bottom: var(--rec-space-4);
}
.rec-empty h2 {
  font-size: var(--rec-text-xl);
  color: var(--rec-text-primary);
  margin: 0 0 var(--rec-space-2);
  font-weight: 700;
}
.rec-empty p {
  font-size: var(--rec-text-md);
  color: var(--rec-text-secondary);
  margin: 0 0 var(--rec-space-6);
  max-width: 480px;
}

.rec-empty--first {
  padding: var(--rec-space-12) var(--rec-space-6);
}

.rec-empty-steps {
  display: flex;
  flex-direction: column;
  gap: var(--rec-space-4);
  margin-bottom: var(--rec-space-6);
  max-width: 400px;
  text-align: left;
}

.rec-step {
  display: flex;
  gap: var(--rec-space-3);
  align-items: flex-start;
}

.rec-step-num {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--rec-brand);
  color: #fff;
  font-size: var(--rec-text-sm);
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.rec-step-body {
  display: flex;
  flex-direction: column;
}

.rec-step-title {
  font-size: var(--rec-text-md);
  font-weight: 600;
  color: var(--rec-text-primary);
}

.rec-step-desc {
  font-size: var(--rec-text-sm);
  color: var(--rec-text-muted);
}

/* ─── Cockpit ─── */
.rec-cockpit {
  background: var(--rec-bg-secondary);
  border: 1px solid var(--rec-border-primary);
  border-radius: var(--rec-radius-lg);
  padding: var(--rec-space-6);
}

.rec-cockpit-header {
  margin-bottom: var(--rec-space-5);
}

.rec-cockpit-title {
  font-size: var(--rec-text-lg);
  font-weight: 700;
  color: var(--rec-text-primary);
  margin: 0;
}

.rec-cockpit-flow {
  display: flex;
  align-items: center;
  gap: var(--rec-space-2);
  flex-wrap: wrap;
}

.rec-flow-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--rec-space-3) var(--rec-space-4);
  background: var(--rec-bg-primary);
  border: 1px solid var(--rec-border-primary);
  border-radius: var(--rec-radius-md);
  min-width: 80px;
  position: relative;
  transition: border-color 0.15s;
}

.rec-flow-node--active {
  border-color: rgba(96, 165, 250, 0.3);
}

.rec-flow-icon {
  font-size: 1.2rem;
  margin-bottom: 4px;
}

.rec-flow-count {
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--rec-brand);
}

.rec-flow-label {
  font-size: var(--rec-text-xs);
  color: var(--rec-text-muted);
  margin-top: 2px;
}

.rec-flow-arrow {
  color: var(--rec-text-muted);
  font-size: 1.1rem;
  padding: 0 4px;
}

.rec-suggestion {
  margin-top: var(--rec-space-4);
  padding: var(--rec-space-3) var(--rec-space-4);
  background: rgba(96, 165, 250, 0.05);
  border: 1px solid rgba(96, 165, 250, 0.12);
  border-radius: var(--rec-radius-md);
  display: flex;
  align-items: center;
  gap: var(--rec-space-3);
}

.rec-suggestion-icon {
  font-size: 1.2rem;
  flex-shrink: 0;
}

.rec-suggestion-text {
  flex: 1;
  font-size: var(--rec-text-sm);
  color: var(--rec-text-primary);
}

.rec-suggestion-btn {
  padding: 6px 14px;
  background: transparent;
  border: 1px solid var(--rec-border-primary);
  border-radius: var(--rec-radius-sm);
  color: var(--rec-brand);
  font-size: var(--rec-text-xs);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
}

.rec-suggestion-btn:hover {
  background: rgba(96, 165, 250, 0.1);
  border-color: rgba(96, 165, 250, 0.3);
}

/* ─── Split ─── */
.rec-split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--rec-space-4);
}

.rec-pending {
  /* full-width section */
}

@media (max-width: 768px) {
  .rec-identity-summary {
    flex-wrap: wrap;
    gap: var(--rec-space-4);
  }
  .rec-split {
    grid-template-columns: 1fr;
  }
  .rec-identity-actions {
    flex-direction: column;
  }
}
</style>
