<template>
  <div class="capability-center">
    <RecruitmentPageShell>
      <template #title>AI 员工</template>
      <template #subtitle>数字员工管理中心 — 管理 Alice、Bob、Carol 的工作状态、任务分配、能力配置和运行记录。像管理人类员工一样管理 AI 员工</template>

      <!-- Loading State -->
      <div v-if="loading" class="cc-loading">
        <div class="cc-spinner"></div>
        <span>加载中...</span>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="cc-error">
        <div class="cc-error-icon">!</div>
        <p>{{ error }}</p>
        <RecruitmentPrimaryButton @click="loadData">重试</RecruitmentPrimaryButton>
      </div>

      <!-- Unsubscribed State -->
      <div v-else-if="!hasSubscription" class="cc-unsubscribed">
        <div class="cc-unsub-header">
          <h2>AI 招聘团队</h2>
          <p>解锁企业 AI 员工，让招聘更高效</p>
        </div>
        <div class="cc-agent-preview-grid">
          <div v-for="agent in AGENT_TEMPLATES" :key="agent.name" class="cc-agent-preview">
            <div class="cc-ap-avatar" :style="{ background: agent.color }">{{ agent.initial }}</div>
            <div class="cc-ap-info">
              <div class="cc-ap-name">{{ agent.name }}</div>
              <div class="cc-ap-role">{{ agent.role }}</div>
            </div>
            <div class="cc-ap-capabilities">
              <RecruitmentBadge v-for="cap in agent.capabilities" :key="cap" variant="info">{{ cap }}</RecruitmentBadge>
            </div>
            <div class="cc-ap-locked">预览</div>
          </div>
        </div>
        <div class="cc-unsub-cta">
          <p>订阅后即可激活 Alice、Bob 和 Carol，让 AI 招聘团队为您工作</p>
          <RecruitmentPrimaryButton @click="goToBilling">升级套餐</RecruitmentPrimaryButton>
        </div>
      </div>

      <!-- Subscribed: No agents configured -->
      <div v-else-if="hasSubscription && agents.length === 0" class="cc-no-agents">
        <div class="cc-no-agents-header">
          <p>AI 招聘团队已就绪，等待激活。</p>
        </div>
        <div class="cc-agent-preview-grid">
          <div v-for="agent in AGENT_TEMPLATES" :key="agent.name" class="cc-agent-preview cc-agent--pending">
            <div class="cc-ap-avatar" :style="{ background: agent.color }">{{ agent.initial }}</div>
            <div class="cc-ap-info">
              <div class="cc-ap-name">{{ agent.name }}</div>
              <div class="cc-ap-role">{{ agent.role }}</div>
            </div>
            <div class="cc-ap-capabilities">
              <RecruitmentBadge v-for="cap in agent.capabilities" :key="cap" variant="info">{{ cap }}</RecruitmentBadge>
            </div>
            <RecruitmentBadge variant="warning">待激活</RecruitmentBadge>
          </div>
        </div>
      </div>

      <!-- Subscribed: With agents -->
      <template v-else>
        <!-- Summary stats -->
        <div class="cc-summary">
          <RecruitmentStatCard :value="summary.totalAgents || agents.length" label="AI 员工" color="--color-decision" />
          <RecruitmentStatCard :value="summary.totalMonthlyTasks || 0" label="本月完成任务" color="--color-execution" />
          <RecruitmentStatCard :value="summary.totalAnalyzedCandidates || 0" label="分析候选人" color="--color-info" />
          <RecruitmentStatCard :value="summary.taskCompletionRate ? summary.taskCompletionRate + '%' : '—'" label="任务完成率" />
        </div>

        <!-- AI 团队协作建议 (AI-CENTER-03A 观察层：仅识别/建议/展示，不自动执行) -->
        <div v-if="workflowTemplates.length" class="wf-section">
          <div class="wf-head">
            <span class="wf-title">🧠 团队协作建议</span>
            <span class="wf-badge">观察层 · 仅建议</span>
            <span class="wf-badge" style="color:#94a3b8;border-color:rgba(148,163,184,0.35);background:rgba(148,163,184,0.08)">⏸ 已暂停扩展（掌柜战略：AI中心聚焦消费决策）</span>
            <span class="wf-sub">一个任务不再是一个 AI 在工作——而是 AI 团队协作。系统只识别与建议，由你确认发起</span>
          </div>
          <div class="wf-grid">
            <div v-for="t in workflowTemplates" :key="t.taskType" class="wf-card">
              <div class="wf-card-head">
                <span class="wf-task">{{ t.name }}</span>
              </div>
              <div class="wf-team">
                <div v-for="a in t.team" :key="a.agentType" class="wf-step">
                  <div class="wf-step-no">{{ a.order }}</div>
                  <div class="wf-step-body">
                    <div class="wf-step-role">
                      {{ a.roleName }}
                      <span v-if="a.model" class="wf-step-model">{{ a.model.name }} · {{ a.model.score }}分</span>
                    </div>
                    <div class="wf-step-task">{{ a.task }}</div>
                  </div>
                  <div v-if="a.order < t.team.length" class="wf-arrow">→</div>
                </div>
              </div>
              <button class="wf-create" @click="goToJobs">创建任务 → 职位管理</button>
            </div>
          </div>
        </div>

        <!-- Agent Cards -->
        <div class="cc-agent-list">
          <div v-for="agent in agents" :key="agent.id" class="cc-agent-card">
            <div class="cc-agent-header">
              <div class="cc-agent-avatar" :style="{ background: agentColor(agent) }">{{ agent.shortName?.charAt(0) || agent.name?.charAt(0) || '?' }}</div>
              <div class="cc-agent-info">
                <div class="cc-agent-name">{{ agent.shortName || agent.name }}</div>
                <div class="cc-agent-desc">{{ agent.description || agent.agentType || '—' }}</div>
              </div>
              <RecruitmentBadge :variant="statusVariant(agent.status)">{{ statusLabels[agent.status] || agent.status }}</RecruitmentBadge>
            </div>

            <!-- AI 大脑建议 (AI-CENTER-02C) -->
            <div v-if="recommendations[agent.id]" class="cc-brain">
              <div class="cc-brain-head">
                <span>🧠 AI大脑建议</span>
                <span v-if="recommendations[agent.id].weightSource === 'workspace_default'" class="cc-brain-src" title="该岗位暂无专属画像，基于业务场景默认权重推荐">基于场景默认权重</span>
                <span class="cc-brain-cost">{{ recommendations[agent.id].costLabel }}</span>
              </div>
              <div class="cc-brain-row">
                <span class="cc-brain-role-lbl">当前角色</span>
                <span class="cc-brain-role">{{ recommendations[agent.id].roleName }}</span>
              </div>
              <div class="cc-brain-primary">
                <span class="cc-brain-trophy">🏆</span>
                <span class="cc-brain-p-name">{{ recommendations[agent.id].primary?.name || '—' }}</span>
                <span class="cc-brain-p-score">{{ recommendations[agent.id].primary?.score ?? '' }}分</span>
              </div>
              <div v-if="recommendations[agent.id].secondary" class="cc-brain-secondary">
                🔶 备选：{{ recommendations[agent.id].secondary.name }} {{ recommendations[agent.id].secondary.score }}分
              </div>
              <div class="cc-brain-reasons">
                <div v-for="(r, ri) in recommendations[agent.id].reasons.slice(0, 3)" :key="ri" class="cc-brain-reason">✓ {{ r }}</div>
              </div>
              <button class="cc-brain-apply" @click="goToModelSettings">应用建议 → 配置企业模型</button>
            </div>

            <!-- Capabilities -->
            <div v-if="agent.capabilities?.length" class="cc-capabilities">
              <div class="cc-section-label">核心能力</div>
              <div class="cc-cap-list">
                <RecruitmentBadge v-for="cap in agent.capabilities" :key="cap" variant="info">{{ cap }}</RecruitmentBadge>
              </div>
            </div>

            <!-- Stats row -->
            <div class="cc-agent-stats">
              <div class="cc-agent-stat">
                <div class="cc-as-value">{{ agent.monthlyTasks || agent.totalTasks || 0 }}</div>
                <div class="cc-as-label">本月任务</div>
              </div>
              <div class="cc-agent-stat">
                <div class="cc-as-value">{{ agent.analyzedCandidates || 0 }}</div>
                <div class="cc-as-label">分析候选</div>
              </div>
              <div class="cc-agent-stat">
                <div class="cc-as-value">{{ agent.interviewsEvaluated || 0 }}</div>
                <div class="cc-as-label">面试评估</div>
              </div>
            </div>

            <!-- Value Section: 价值展示 -->
            <div class="cc-value-section">
              <div class="cc-section-label">当前任务</div>
              <div v-if="agent.recentTasks && agent.recentTasks.length > 0" class="cc-value-list">
                <div v-for="(task, ti) in agent.recentTasks.slice(0, 2)" :key="ti" class="cc-value-item">
                  <span class="cc-value-task-type">{{ getTaskLabel(task.taskType) }}</span>
                  <span class="cc-value-task-desc">{{ task.inputSummary || task.outputSummary || '—' }}</span>
                </div>
              </div>
              <div v-else class="cc-value-empty">完成第一次招聘任务后，此处将展示 AI 员工的工作记录</div>
            </div>

            <div class="cc-value-section">
              <div class="cc-section-label">最近成果</div>
              <div v-if="agent.recentTasks && agent.recentTasks.length > 0" class="cc-value-list">
                <div v-for="(task, ti) in agent.recentTasks.slice(0, 2)" :key="ti" class="cc-value-item">
                  <span class="cc-value-task-type">{{ getTaskLabel(task.taskType) }}</span>
                  <span class="cc-value-task-desc">{{ task.outputSummary || task.inputSummary || '—' }}</span>
                </div>
              </div>
              <div v-else class="cc-value-empty">完成第一次招聘任务后，此处将展示 AI 员工的工作记录</div>
            </div>

            <!-- Sprint 5-3: 执行历史时间线 -->
            <div class="cc-value-section">
              <div class="cc-section-label">执行历史</div>
              <div v-if="agent.recentTasks && agent.recentTasks.length > 0" class="cc-timeline">
                <div v-for="(task, ti) in agent.recentTasks" :key="ti" class="cc-timeline-item">
                  <div class="cc-timeline-dot" :class="taskStatusColor(task.status)"></div>
                  <div class="cc-timeline-content">
                    <div class="cc-timeline-header">
                      <span class="cc-timeline-type">{{ getTaskLabel(task.taskType) }}</span>
                      <span class="cc-timeline-duration" v-if="task.durationMs != null">{{ formatDuration(task.durationMs) }}</span>
                    </div>
                    <span class="cc-timeline-desc">{{ task.inputSummary || task.outputSummary || '—' }}</span>
                    <div class="cc-timeline-meta">
                      <span class="cc-timeline-time">{{ formatTaskTime(task.startedAt) }}</span>
                      <span v-if="task.cost" class="cc-timeline-cost">模型: DeepSeek</span>
                      <span v-if="task.status" class="cc-timeline-status" :class="'cc-tl-status-' + task.status">{{ tlStatusLabel(task.status) }}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div v-else class="cc-value-empty">完成第一次招聘任务后，此处将展示 AI 员工的工作记录</div>
            </div>

            <!-- Weekly trend -->
            <div v-if="agent.weeklyUsage?.length" class="cc-trend">
              <div class="cc-section-label">近4周使用趋势</div>
              <div class="cc-trend-bars">
                <div v-for="week in agent.weeklyUsage" :key="week.week || week.weekLabel" class="cc-trend-bar-group">
                  <div class="cc-trend-bar" :style="{ height: getTrendHeight(week.count || week.value || 0) + '%' }"
                       :title="`${week.count || week.value || 0} 次`"></div>
                  <div class="cc-trend-label">{{ week.week || week.weekLabel || '' }}</div>
                </div>
              </div>
            </div>

            <!-- Action buttons -->
            <div class="cc-agent-actions">
              <button class="cc-action-btn" @click="viewRecords(agent)">查看记录</button>
              <button class="cc-action-btn cc-action-btn--primary" @click="configureCapabilities(agent)">配置能力</button>
            </div>
          </div>
        </div>
      </template>
    </RecruitmentPageShell>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'enterprise-workspace' })
import { ref, onMounted } from 'vue'

const AGENT_TEMPLATES = [
  { name: 'Alice', initial: 'A', role: '招聘顾问', color: 'linear-gradient(135deg, #6366F1, #8B5CF6)', capabilities: ['需求分析', 'JD生成', '渠道推荐'] },
  { name: 'Bob', initial: 'B', role: '面试专家', color: 'linear-gradient(135deg, #10B981, #34D399)', capabilities: ['面试题生成', '面试评估', '决策建议'] },
  { name: 'Carol', initial: 'C', role: '人才分析师', color: 'linear-gradient(135deg, #F59E0B, #F97316)', capabilities: ['人才搜索', '技能匹配', '候选人分析'] },
]

interface AgentData {
  id: string
  agentType: string
  name: string
  shortName: string
  description: string
  capabilities: string[]
  status: string
  monthlyTasks: number
  totalTasks: number
  analyzedCandidates: number
  interviewsEvaluated: number
  completedInterviews: number
  weeklyUsage: Array<{ week: string; count: number; value?: number; weekLabel?: string }>
  recentTasks?: Array<{ taskType: string; inputSummary: string; outputSummary: string; status: string; startedAt: string }>
}

// ─── State ───
const loading = ref(true)
const error = ref<string | null>(null)
const hasSubscription = ref(false)
const agents = ref<AgentData[]>([])
const recommendations = ref<Record<string, any>>({})
const workflowTemplates = ref<any[]>([])
const summary = ref({ totalAgents: 0, totalMonthlyTasks: 0, totalAnalyzedCandidates: 0, taskCompletionRate: 0 })

const statusLabels: Record<string, string> = {
  active: '运行中',
  trial: '试用中',
  paused: '已暂停',
  inactive: '未激活',
}

function statusVariant(status: string): string {
  const map: Record<string, string> = { active: 'success', trial: 'warning', paused: 'danger', inactive: 'neutral' }
  return map[status] || 'default'
}

function agentColor(agent: AgentData): string {
  const name = (agent.shortName || agent.name || '').toLowerCase()
  if (name.startsWith('a')) return 'linear-gradient(135deg, #6366F1, #8B5CF6)'
  if (name.startsWith('b')) return 'linear-gradient(135deg, #10B981, #34D399)'
  if (name.startsWith('c')) return 'linear-gradient(135deg, #F59E0B, #F97316)'
  return 'linear-gradient(135deg, #6366F1, #8B5CF6)'
}

function getTrendHeight(value: number): number {
  if (!maxWeeklyVal.value || maxWeeklyVal.value === 0) return 5
  return Math.max(5, (value / maxWeeklyVal.value) * 100)
}

const maxWeeklyVal = ref(1)

function computeMaxWeekly() {
  let max = 1
  for (const agent of agents.value) {
    for (const week of agent.weeklyUsage || []) {
      const v = week.count || week.value || 0
      if (v > max) max = v
    }
  }
  maxWeeklyVal.value = max
}

function getAuthToken(): string {
  return localStorage.getItem('auth_token') || ''
}

async function loadData() {
  loading.value = true
  error.value = null

  try {
    const token = getAuthToken()
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`

    // Check subscription first
    const subRes = await fetch('/api/enterprise/subscription/current', { headers })
    if (subRes.ok) {
      const subData = await subRes.json()
      hasSubscription.value = subData?.success && subData?.data?.hasSubscription
    }

    // Load agent data
    const res = await fetch('/api/enterprise/recruitment-analytics/capability', { headers })
    if (res.status === 401) {
      error.value = '请先登录'
      return
    }

    const json = await res.json()
    if (json.success && json.data) {
      const agentList = json.data.agents || []
      agents.value = agentList
      if (json.data.summary) {
        summary.value = {
          totalAgents: agentList.length,
          totalMonthlyTasks: json.data.summary.totalMonthlyTasks || 0,
          totalAnalyzedCandidates: json.data.summary.totalAnalyzedCandidates || 0,
          taskCompletionRate: json.data.summary.taskCompletionRate || 0,
        }
      }
      computeMaxWeekly()
    } else {
      // API exists but returns no data — still subscribed
      error.value = null
    }

    // Load task data for each agent (non-blocking)
    if (agents.value.length > 0) {
      for (const agent of agents.value) {
        await loadAgentTasks(agent)
      }
    }
    // AI 大脑建议（AI-CENTER-02C，只建议不切换）
    await loadAgentRecommendations()
    // AI 团队协作建议（AI-CENTER-03A 观察层，不自动执行）
    await loadWorkflowTemplates()
  } catch (e: any) {
    console.error('Failed to load capability data:', e)
    if (!error.value) error.value = '网络错误，请稍后重试'
  } finally {
    loading.value = false
  }
}

function goToBilling() {
  window.location.href = '/workspace/enterprise/billing'
}

function goToModelSettings() {
  window.location.href = '/workspace/enterprise/model-settings'
}

function goToJobs() {
  // 03A 红线：不自动创建任务，跳到职位管理由用户人工发起
  window.location.href = '/workspace/enterprise/jobs'
}

async function loadWorkflowTemplates() {
  try {
    const res = await fetch('/api/ai/agent-workflow-templates?businessType=job')
    if (!res.ok) return
    const json = await res.json()
    if (json.code !== 0 || !json.data?.length) return
    const details = await Promise.all(
      json.data.map(async (t: any) => {
        try {
          const r = await fetch(`/api/ai/agent-workflow-templates/${t.taskType}`)
          if (!r.ok) return null
          const j = await r.json()
          return j.code === 0 ? j.data : null
        } catch (e) {
          return null
        }
      }),
    )
    workflowTemplates.value = details.filter(Boolean)
  } catch (e) {
    // 观察层失败不阻断员工页
  }
}

async function loadAgentRecommendations() {
  for (const agent of agents.value) {
    if (!agent.agentType) continue
    try {
      const res = await fetch(`/api/ai/agent-recommendation?agentType=${encodeURIComponent(agent.agentType)}`)
      if (!res.ok) continue
      const json = await res.json()
      if (json.code === 0 && json.data) {
        recommendations.value[agent.id] = json.data
      }
    } catch (e) {
      // 建议加载失败不阻断员工页
    }
  }
}

function getTaskLabel(taskType: string): string {
  const labels: Record<string, string> = {
    jd_generation: 'JD 生成',
    job_optimization: '岗位优化',
    candidate_search: '人才搜索',
    candidate_analysis: '候选人分析',
    interview_questions: '面试题生成',
    interview_evaluation: '面试评估',
    ranking: '候选人排名',
    matching: '智能匹配',
    resume_screening: '简历筛选',
    report: '报告生成',
  }
  return labels[taskType] || taskType
}

async function loadAgentTasks(agent: AgentData) {
  try {
    const token = getAuthToken()
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`
    
    const res = await fetch('/api/enterprise/agent-tasks', { headers })
    if (res.ok) {
      const json = await res.json()
      const allTasks = json?.data || []
      // Filter by agent name or type
      const agentName = (agent.shortName || agent.name || '').toLowerCase()
      agent.recentTasks = allTasks
        .filter((t: any) => {
          const tName = (t.agentName || '').toLowerCase()
          return tName.includes(agentName) || tName.includes(agent.shortName || '')
        })
        .slice(0, 5)
    }
  } catch (e) {
    // non-fatal
  }
}

function viewRecords(agent: AgentData) {
  window.location.href = '/workspace/enterprise/analytics'
}

function configureCapabilities(agent: AgentData) {
  // Placeholder
}

/* ── 执行历史辅助函数 ── */
function taskStatusColor(status: string): string {
  if (status === 'completed') return 'cc-tl-dot-done'
  if (status === 'running' || status === 'processing') return 'cc-tl-dot-progress'
  if (status === 'failed') return 'cc-tl-dot-failed'
  return 'cc-tl-dot-pending'
}

function formatDuration(ms: number): string {
  if (!ms || ms < 0) return ''
  if (ms < 1000) return ms + '毫秒'
  if (ms < 60000) return (ms / 1000).toFixed(0) + '秒'
  return (ms / 60000).toFixed(1) + '分钟'
}

function formatTaskTime(dateStr: string | Date): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hour = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${month}-${day} ${hour}:${min}`
}

function tlStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    completed: '已完成',
    running: '进行中',
    processing: '处理中',
    failed: '失败',
    pending: '等待中',
  }
  return labels[status] || status
}

onMounted(loadData)
</script>

<style scoped>
.capability-center {
  padding: 0;
}

/* ─── Loading ─── */
.cc-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  gap: 12px;
  color: var(--color-text-muted);
}

.cc-spinner {
  width: 24px;
  height: 24px;
  border: 3px solid var(--color-border-primary);
  border-top-color: var(--color-decision);
  border-radius: 50%;
  animation: cc-spin 0.8s linear infinite;
}

@keyframes cc-spin {
  to { transform: rotate(360deg); }
}

/* ─── Error ─── */
.cc-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 60px 20px;
  text-align: center;
}

.cc-error-icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(239, 68, 68, 0.1);
  color: #EF4444;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: 700;
}

.cc-error p {
  margin: 0;
  font-size: 14px;
  color: var(--color-text-secondary);
}

/* ─── Unsubscribed ─── */
.cc-unsubscribed {
  text-align: center;
  padding: 20px 0;
}

.cc-unsub-header h2 {
  font-size: 20px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0 0 6px;
}

.cc-unsub-header p {
  font-size: 14px;
  color: var(--color-text-muted);
  margin: 0 0 32px;
}

.cc-agent-preview-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  margin-bottom: 32px;
}

.cc-agent-preview {
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-primary);
  border-radius: 12px;
  padding: 24px 20px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.cc-agent--pending {
  border-color: rgba(245, 158, 11, 0.3);
}

.cc-ap-avatar {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: 700;
  color: #fff;
}

.cc-ap-info {
  text-align: center;
}

.cc-ap-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.cc-ap-role {
  font-size: 12px;
  color: var(--color-text-muted);
  margin-top: 2px;
}

.cc-ap-capabilities {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: center;
}

.cc-ap-locked {
  font-size: 11px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 4px;
  background: rgba(148, 163, 184, 0.15);
  color: #94A3B8;
}

.cc-unsub-cta {
  text-align: center;
}

.cc-unsub-cta p {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin-bottom: 16px;
}

/* ─── No Agents ─── */
.cc-no-agents {
  padding: 20px 0;
}

.cc-no-agents-header {
  text-align: center;
  margin-bottom: 24px;
}

.cc-no-agents-header p {
  font-size: 14px;
  color: var(--color-text-secondary);
  margin: 0;
}

/* ─── Summary ─── */
.cc-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 16px;
  margin-bottom: 28px;
}

/* ─── Agent Cards ─── */
.cc-agent-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.cc-agent-card {
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-primary);
  border-radius: 14px;
  padding: 24px;
}

.cc-agent-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}

.cc-agent-avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
}

.cc-agent-info {
  flex: 1;
  min-width: 0;
}

.cc-agent-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.cc-agent-desc {
  font-size: 12px;
  color: var(--color-text-muted);
  margin-top: 2px;
}

.cc-section-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.03em;
  margin-bottom: 8px;
}

/* ─── Capabilities ─── */
.cc-capabilities {
  margin-bottom: 16px;
}

.cc-cap-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

/* ─── Stats ─── */
.cc-agent-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  padding: 16px;
  background: var(--color-bg-primary);
  border-radius: 10px;
  margin-bottom: 16px;
}

.cc-agent-stat {
  text-align: center;
}

.cc-as-value {
  display: block;
  font-size: 20px;
  font-weight: 700;
  color: var(--color-decision);
}

.cc-as-label {
  display: block;
  font-size: 11px;
  color: var(--color-text-muted);
  margin-top: 2px;
}

/* ─── Value Sections ─── */
.cc-value-section {
  border-top: 1px solid var(--color-border-primary);
  padding-top: 14px;
  margin-bottom: 10px;
}

.cc-value-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cc-value-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 10px;
  background: var(--color-bg-primary);
  border-radius: 6px;
}

.cc-value-task-type {
  font-size: 11px;
  font-weight: 600;
  color: #818CF8;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.cc-value-task-desc {
  font-size: 13px;
  color: var(--color-text-secondary);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.cc-value-empty {
  font-size: 13px;
  color: var(--color-text-muted);
  padding: 6px 0;
  font-style: italic;
}

/* ─── 执行历史时间线 ─── */
.cc-timeline {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.cc-timeline-item {
  display: flex;
  gap: 10px;
  padding: 8px 0;
  position: relative;
}

.cc-timeline-item + .cc-timeline-item {
  border-top: none;
}

.cc-timeline-item::before {
  content: '';
  position: absolute;
  left: 7px;
  top: 24px;
  bottom: 0;
  width: 1px;
  background: var(--color-border-primary, #1E293B);
}

.cc-timeline-item:last-child::before {
  display: none;
}

.cc-timeline-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 4px;
  border: 2px solid var(--color-border-primary, #1E293B);
  background: var(--color-bg-primary, #0D1328);
}

.cc-tl-dot-done {
  border-color: #10B981;
  background: #10B981;
}

.cc-tl-dot-progress {
  border-color: #F59E0B;
  background: #F59E0B;
  animation: cc-pulse 1.5s ease-in-out infinite;
}

@keyframes cc-pulse {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}

.cc-tl-dot-failed {
  border-color: #EF4444;
  background: #EF4444;
}

.cc-tl-dot-pending {
  border-color: var(--color-text-muted, #475569);
}

.cc-timeline-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.cc-timeline-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cc-timeline-type {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary, #E2E8F0);
}

.cc-timeline-duration {
  font-size: 11px;
  color: var(--color-text-muted, #64748B);
  background: var(--color-bg-secondary, #1E293B);
  padding: 1px 6px;
  border-radius: 3px;
}

.cc-timeline-desc {
  font-size: 12px;
  color: var(--color-text-secondary, #94A3B8);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.cc-timeline-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 2px;
}

.cc-timeline-time {
  font-size: 11px;
  color: var(--color-text-muted, #64748B);
}

.cc-timeline-cost {
  font-size: 11px;
  color: var(--color-text-muted, #64748B);
}

.cc-timeline-status {
  font-size: 10px;
  font-weight: 500;
  padding: 1px 6px;
  border-radius: 3px;
  margin-left: auto;
}

.cc-tl-status-completed {
  background: rgba(16, 185, 129, 0.1);
  color: #10B981;
}

.cc-tl-status-running,
.cc-tl-status-processing {
  background: rgba(245, 158, 11, 0.1);
  color: #F59E0B;
}

.cc-tl-status-failed {
  background: rgba(239, 68, 68, 0.1);
  color: #EF4444;
}

.cc-tl-status-pending {
  background: rgba(148, 163, 184, 0.1);
  color: #94A3B8;
}

/* ─── Trend Bars ─── */
.cc-trend {
  border-top: 1px solid var(--color-border-primary);
  padding-top: 16px;
  margin-bottom: 16px;
}

.cc-trend-bars {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 20px;
  height: 70px;
}

.cc-trend-bar-group {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.cc-trend-bar {
  width: 22px;
  background: linear-gradient(180deg, var(--color-decision) 0%, var(--color-intelligence) 100%);
  border-radius: 4px 4px 0 0;
  transition: height 0.3s ease;
  min-height: 4px;
}

.cc-trend-label {
  font-size: 10px;
  color: var(--color-text-muted);
  margin-top: 4px;
}

/* ─── Actions ─── */
.cc-agent-actions {
  display: flex;
  gap: 10px;
}

.cc-action-btn {
  flex: 1;
  padding: 8px 14px;
  border: 1px solid var(--color-border-primary);
  background: transparent;
  color: var(--color-text-secondary);
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  font-family: var(--font-family);
  transition: all 0.12s;
}

.cc-action-btn:hover {
  border-color: var(--color-decision);
  color: var(--color-decision);
}

.cc-action-btn--primary {
  background: var(--color-decision-glow);
  border-color: transparent;
  color: var(--color-decision);
}

.cc-action-btn--primary:hover {
  background: rgba(99, 102, 241, 0.15);
}

/* ─── AI 团队协作建议 (AI-CENTER-03A 观察层) ─── */
.wf-section {
  margin: 18px 0 6px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.wf-head {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.wf-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.wf-badge {
  font-size: 10px;
  color: #fbbf24;
  border: 1px solid rgba(251, 191, 36, 0.35);
  background: rgba(251, 191, 36, 0.08);
  padding: 2px 9px;
  border-radius: 99px;
}

.wf-sub {
  font-size: 11px;
  color: var(--color-text-muted);
}

.wf-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 14px;
}

.wf-card {
  border: 1px solid var(--color-border-primary);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.02);
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  transition: border-color 0.15s;
}

.wf-card:hover {
  border-color: rgba(168, 85, 247, 0.35);
}

.wf-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.wf-task {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.wf-team {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.wf-step {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 7px 9px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.03);
  position: relative;
}

.wf-step-no {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 1px;
}

.wf-step-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.wf-step-role {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary);
  display: flex;
  align-items: center;
  gap: 8px;
}

.wf-step-model {
  font-size: 10px;
  font-weight: 500;
  color: #34d399;
  background: rgba(52, 211, 153, 0.1);
  padding: 1px 7px;
  border-radius: 99px;
}

.wf-step-task {
  font-size: 11px;
  color: var(--color-text-muted);
}

.wf-arrow {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  color: rgba(168, 85, 247, 0.5);
  font-size: 13px;
}

.wf-create {
  align-self: flex-end;
  font-size: 12px;
  padding: 7px 16px;
  border-radius: 8px;
  border: 1px solid rgba(168, 85, 247, 0.4);
  background: rgba(168, 85, 247, 0.12);
  color: #ddd6fe;
  cursor: pointer;
  font-family: var(--font-family);
  transition: all 0.12s;
}

.wf-create:hover {
  background: rgba(168, 85, 247, 0.22);
  border-color: rgba(168, 85, 247, 0.7);
}

/* ─── AI 大脑建议 (AI-CENTER-02C) ─── */
.cc-brain {
  margin-top: 12px;
  border: 1px solid rgba(168, 85, 247, 0.25);
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(168, 85, 247, 0.06), rgba(99, 102, 241, 0.06));
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.cc-brain-head {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #c4b5fd;
}

.cc-brain-src {
  font-size: 10px;
  font-weight: 400;
  color: var(--color-text-muted);
  background: rgba(255, 255, 255, 0.05);
  padding: 1px 7px;
  border-radius: 99px;
}

.cc-brain-cost {
  margin-left: auto;
  font-size: 10px;
  font-weight: 400;
  color: var(--color-text-muted);
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 1px 7px;
  border-radius: 99px;
}

.cc-brain-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--color-text-secondary);
}

.cc-brain-role-lbl {
  font-size: 10px;
  color: var(--color-text-muted);
}

.cc-brain-role {
  font-weight: 600;
  color: var(--color-text-primary);
}

.cc-brain-primary {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.cc-brain-trophy {
  font-size: 15px;
}

.cc-brain-p-name {
  font-weight: 700;
  color: #fbbf24;
}

.cc-brain-p-score {
  font-size: 12px;
  font-weight: 600;
  color: #34d399;
  background: rgba(52, 211, 153, 0.1);
  padding: 1px 8px;
  border-radius: 99px;
}

.cc-brain-secondary {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.cc-brain-reasons {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.cc-brain-reason {
  font-size: 11px;
  color: #a7f3d0;
}

.cc-brain-apply {
  margin-top: 2px;
  align-self: flex-start;
  font-size: 12px;
  padding: 6px 14px;
  border-radius: 8px;
  border: 1px solid rgba(168, 85, 247, 0.4);
  background: rgba(168, 85, 247, 0.12);
  color: #ddd6fe;
  cursor: pointer;
  font-family: var(--font-family);
  transition: all 0.12s;
}

.cc-brain-apply:hover {
  background: rgba(168, 85, 247, 0.22);
  border-color: rgba(168, 85, 247, 0.7);
}
</style>
