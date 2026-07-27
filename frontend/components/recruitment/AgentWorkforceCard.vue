<template>
  <div class="agent-workforce">
    <!-- Section Header -->
    <div class="aw-header">
      <h2 class="aw-title">🤖 AI 招聘团队</h2>
      <span class="aw-subtitle">
        {{ state.summary.active }}/{{ state.summary.total }} 在线
      </span>
    </div>

    <!-- Loading -->
    <div v-if="state.loading" class="aw-loading">
      <div class="loading-spinner"></div>
      <span>加载 AI 员工数据...</span>
    </div>

    <!-- Error -->
    <div v-else-if="state.error" class="aw-error">
      <span>⚠️ {{ state.error }}</span>
      <button @click="refresh" class="aw-retry-btn">重试</button>
    </div>

    <!-- Empty -->
    <div v-else-if="state.instances.length === 0" class="aw-empty">
      <div class="aw-empty-icon">🤖</div>
      <p>暂无 AI 招聘员工</p>
      <span class="aw-empty-hint">完成企业认证后将自动分配 AI 招聘团队</span>
    </div>

    <!-- Agent List -->
    <div v-else class="aw-grid">
      <div
        v-for="agent in state.instances"
        :key="agent.id"
        class="aw-agent-card"
        :class="{
          'aw-agent-card--active': agent.status === 'active',
          'aw-agent-card--paused': agent.status === 'paused',
          'aw-agent-card--stopped': agent.emergencyStop,
        }"
      >
        <!-- Agent Header -->
        <div class="aw-agent-header">
          <div class="aw-agent-avatar">
            {{ getAgentEmoji(agent.type) }}
          </div>
          <div class="aw-agent-info">
            <span class="aw-agent-name">{{ agent.name }}</span>
            <span class="aw-agent-type">{{ getAgentRole(agent.type) }}</span>
          </div>
          <div class="aw-agent-status">
            <span
              class="aw-status-dot"
              :class="{
                'aw-status-dot--active': agent.status === 'active',
                'aw-status-dot--paused': agent.status === 'paused',
                'aw-status-dot--stopped': agent.emergencyStop,
              }"
            ></span>
            <span class="aw-status-text">
              {{ getStatusLabel(agent) }}
            </span>
          </div>
        </div>

        <!-- Agent Metrics -->
        <div class="aw-agent-metrics">
          <div class="aw-metric">
            <span class="aw-metric-val">{{ agent.totalTasks || 0 }}</span>
            <span class="aw-metric-label">已完成任务</span>
          </div>
          <div class="aw-metric">
            <span class="aw-metric-val">{{ formatDate(agent.lastActiveAt) }}</span>
            <span class="aw-metric-label">最后活跃</span>
          </div>
        </div>

        <!-- Capabilities -->
        <div v-if="agent.capabilities?.length" class="aw-capabilities">
          <span
            v-for="cap in agent.capabilities.slice(0, 4)"
            :key="cap"
            class="aw-cap-tag"
          >
            {{ cap }}
          </span>
          <span v-if="agent.capabilities.length > 4" class="aw-cap-tag aw-cap-tag--more">
            +{{ agent.capabilities.length - 4 }}
          </span>
        </div>

        <!-- Quick Insight (from metadata or computed) -->
        <div v-if="agent.status === 'active' && recruitmentInsight" class="aw-insight">
          <span class="aw-insight-icon">📊</span>
          <span class="aw-insight-text">{{ recruitmentInsight }}</span>
        </div>

        <!-- AI 招聘官：Copilot 交互区 -->
        <div v-if="agent.type === 'recruiter' && agent.status === 'active'" class="aw-copilot">
          <div class="aw-copilot-header">
            <span class="aw-copilot-icon">🎯</span>
            <span class="aw-copilot-title">AI 招聘官 Copilot</span>
          </div>

          <!-- 候选人输入 -->
          <div class="aw-copilot-input-row">
            <input
              v-model="copilotCandidateName"
              class="aw-copilot-input"
              placeholder="输入候选人姓名..."
              @keyup.enter="runCopilotAction('candidate_analysis')"
            />
          </div>

          <!-- 快捷操作按钮 -->
          <div class="aw-copilot-actions">
            <button
              v-for="act in copilotActions"
              :key="act.type"
              class="aw-copilot-btn"
              :disabled="copilotLoading || !copilotCandidateName.trim()"
              @click="runCopilotAction(act.type)"
            >
              {{ act.label }}
            </button>
          </div>

          <!-- 结果展示 -->
          <div v-if="copilotLoading" class="aw-copilot-loading">
            <div class="loading-spinner loading-spinner--sm"></div>
            <span>AI 正在分析...</span>
          </div>

          <div v-else-if="copilotResult" class="aw-copilot-result">
            <!-- 候选人分析 -->
            <div v-if="copilotResult.content?.analysisType === 'candidate_analysis'" class="aw-result-block">
              <div class="aw-result-row">
                <span class="aw-result-label">评级:</span>
                <span class="aw-result-badge" :class="'aw-result-badge--' + copilotResult.content.overallRating">
                  {{ copilotResult.content.overallRating === 'recommend' ? '推荐' : copilotResult.content.overallRating === 'consider' ? '待定' : '不推荐' }}
                </span>
              </div>
              <div v-if="copilotResult.content.strengths?.length" class="aw-result-row">
                <span class="aw-result-label">优势:</span>
                <span class="aw-result-text">{{ copilotResult.content.strengths.join(', ') }}</span>
              </div>
              <div v-if="copilotResult.content.risks?.length" class="aw-result-row">
                <span class="aw-result-label">风险:</span>
                <span class="aw-result-text">{{ copilotResult.content.risks.join(', ') }}</span>
              </div>
              <div v-if="copilotResult.content.nextStep" class="aw-result-row">
                <span class="aw-result-label">下一步:</span>
                <span class="aw-result-text">{{ copilotResult.content.nextStep }}</span>
              </div>
            </div>

            <!-- 沟通内容 -->
            <div v-else-if="copilotResult.content?.analysisType === 'communication_draft'" class="aw-result-block">
              <div class="aw-result-row">
                <span class="aw-result-label">主题:</span>
                <span class="aw-result-text">{{ copilotResult.content.subject }}</span>
              </div>
              <div class="aw-result-msg">{{ copilotResult.content.body }}</div>
              <button class="aw-copy-btn" @click="copyText(copilotResult.content.body)">复制内容</button>
            </div>

            <!-- 面试建议 -->
            <div v-else-if="copilotResult.content?.analysisType === 'interview_suggestion'" class="aw-result-block">
              <div class="aw-result-row">
                <span class="aw-result-label">建议:</span>
                <span class="aw-result-badge" :class="copilotResult.content.suggested ? 'aw-result-badge--recommend' : 'aw-result-badge--pass'">
                  {{ copilotResult.content.suggested ? '建议面试' : '不建议' }}
                </span>
              </div>
              <div class="aw-result-row">
                <span class="aw-result-label">原因:</span>
                <span class="aw-result-text">{{ copilotResult.content.reason }}</span>
              </div>
              <div v-if="copilotResult.content.recommendedRound" class="aw-result-row">
                <span class="aw-result-label">推荐轮次:</span>
                <span class="aw-result-text">{{ copilotResult.content.recommendedRound }}</span>
              </div>
              <div v-if="copilotResult.content.focusAreas?.length" class="aw-result-row">
                <span class="aw-result-label">考察重点:</span>
                <span class="aw-result-text">{{ copilotResult.content.focusAreas.join(', ') }}</span>
              </div>
            </div>

            <!-- Pipeline 建议 -->
            <div v-else-if="copilotResult.content?.analysisType === 'pipeline_suggestion'" class="aw-result-block">
              <div class="aw-result-row">
                <span class="aw-result-label">当前阶段:</span>
                <span class="aw-result-text">{{ copilotResult.content.currentStage }}</span>
              </div>
              <div class="aw-result-row">
                <span class="aw-result-label">建议:</span>
                <span v-if="copilotResult.content.suggestedStage" class="aw-result-badge aw-result-badge--recommend">
                  推进至 {{ copilotResult.content.suggestedStage }}
                </span>
                <span v-else class="aw-result-badge aw-result-badge--pass">暂不推进</span>
              </div>
              <div class="aw-result-row">
                <span class="aw-result-label">原因:</span>
                <span class="aw-result-text">{{ copilotResult.content.reason }}</span>
              </div>
            </div>

            <!-- 数据来源 -->
            <div v-if="copilotResult.dataSources?.length" class="aw-result-sources">
              数据来源: {{ copilotResult.dataSources.join(', ') }}
            </div>

            <!-- Meta -->
            <div v-if="copilotResult.metadata" class="aw-result-meta">
              {{ copilotResult.agentName }} · {{ copilotResult.metadata.tokensUsed }} tokens · {{ (copilotResult.metadata.durationMs / 1000).toFixed(1) }}s
            </div>
          </div>
        </div>

        <!-- AI 招聘经理：今日 Intelligence Report -->
        <div v-if="agent.type === 'career_advisor' && agent.status === 'active'" class="aw-report">
          <div class="aw-report-header">
            <span class="aw-report-icon">📋</span>
            <span class="aw-report-title">今日招聘报告</span>
            <button @click.stop="toggleReport" class="aw-report-toggle">
              {{ reportExpanded ? '收起' : '展开' }}
            </button>
          </div>

          <div v-if="reportExpanded" class="aw-report-body">
            <!-- Loading -->
            <div v-if="reportLoading" class="aw-report-loading">
              <div class="loading-spinner loading-spinner--sm"></div>
              <span>AI 正在分析招聘数据...</span>
            </div>

            <!-- Report Content -->
            <div v-else-if="report" class="aw-report-content">
              <!-- Summary -->
              <div v-if="report.summary?.length" class="aw-report-section">
                <div v-for="(item, idx) in report.summary" :key="'s'+idx" class="aw-report-item aw-report-item--info">
                  <span class="aw-report-item-icon">ℹ️</span>
                  <div class="aw-report-item-body">
                    <span class="aw-report-item-text">{{ item.content }}</span>
                    <span v-if="item.sources?.length" class="aw-report-source">来源: {{ item.sources.join(', ') }}</span>
                  </div>
                </div>
              </div>

              <!-- Risks -->
              <div v-if="report.risks?.length" class="aw-report-section">
                <div v-for="(item, idx) in report.risks" :key="'r'+idx" class="aw-report-item" :class="'aw-report-item--' + item.level">
                  <span class="aw-report-item-icon">{{ item.level === 'high' ? '🔴' : item.level === 'medium' ? '🟡' : '🔵' }}</span>
                  <div class="aw-report-item-body">
                    <span class="aw-report-item-text">{{ item.content }}</span>
                    <span v-if="item.sources?.length" class="aw-report-source">来源: {{ item.sources.join(', ') }}</span>
                  </div>
                </div>
              </div>

              <!-- Actions -->
              <div v-if="report.actions?.length" class="aw-report-section">
                <div v-for="(item, idx) in report.actions" :key="'a'+idx" class="aw-report-item aw-report-item--action">
                  <span class="aw-report-item-icon">⚡</span>
                  <div class="aw-report-item-body">
                    <span class="aw-report-item-text">{{ item.reason }}</span>
                    <span v-if="item.target" class="aw-report-target">目标: {{ item.target }}</span>
                    <span v-if="item.sources?.length" class="aw-report-source">来源: {{ item.sources.join(', ') }}</span>
                  </div>
                </div>
              </div>

              <!-- Meta -->
              <div class="aw-report-meta">
                <span>{{ report.agentName || 'AI 招聘经理' }}</span>
                <span>·</span>
                <span>{{ formatReportTime(report.generatedAt) }}</span>
                <span v-if="report.metadata?.tokensUsed">·</span>
                <span v-if="report.metadata?.tokensUsed">{{ report.metadata.tokensUsed }} tokens</span>
              </div>
            </div>

            <!-- Error / Empty -->
            <div v-else class="aw-report-empty">
              <span v-if="reportError">⚠️ {{ reportError }}</span>
              <span v-else>暂无报告数据</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Workforce Stats Bar -->
    <div v-if="state.instances.length > 0" class="aw-stats-bar">
      <div class="aw-stat">
        <span class="aw-stat-val">{{ state.summary.active }}</span>
        <span class="aw-stat-label">在线</span>
      </div>
      <div class="aw-stat">
        <span class="aw-stat-val">{{ state.summary.paused }}</span>
        <span class="aw-stat-label">暂停</span>
      </div>
      <div class="aw-stat">
        <span class="aw-stat-val">{{ totalTasks }}</span>
        <span class="aw-stat-label">总任务</span>
      </div>
      <div class="aw-stat">
        <span class="aw-stat-val">{{ recruitmentStats.activeJobs }}</span>
        <span class="aw-stat-label">在招岗位</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useAgentWorkforce, type AgentInstance } from '~/composables/enterprise/useAgentWorkforce'

const props = defineProps<{
  /** 招聘统计数据（从父组件传入，避免重复请求） */
  recruitmentStats?: {
    activeJobs: number
    totalCandidates: number
    pendingReview: number
  }
}>()

const { state, refresh, executeAction } = useAgentWorkforce()

// ─── Copilot State ─────────────────────────────────────────
const copilotCandidateName = ref('')
const copilotLoading = ref(false)
const copilotResult = ref<any>(null)
const copilotCommType = ref('initial_outreach')

const copilotActions = [
  { type: 'candidate_analysis', label: '分析候选人' },
  { type: 'communication_draft', label: '生成沟通' },
  { type: 'interview_suggestion', label: '面试建议' },
  { type: 'pipeline_suggestion', label: 'Pipeline' },
]

async function runCopilotAction(type: string) {
  if (!copilotCandidateName.value.trim()) return
  copilotLoading.value = true
  copilotResult.value = null
  try {
    const result = await executeAction({
      type: type as any,
      candidateName: copilotCandidateName.value.trim(),
      commType: type === 'communication_draft' ? copilotCommType.value : undefined,
    })
    copilotResult.value = result
  } catch (e: any) {
    copilotResult.value = { content: { analysisType: '_error', error: e.message } }
  } finally {
    copilotLoading.value = false
  }
}

function copyText(text: string) {
  navigator.clipboard.writeText(text).catch(() => {})
}

// ─── Intelligence Report ──-
const report = ref<any>(null)
const reportLoading = ref(false)
const reportError = ref('')
const reportExpanded = ref(false)

async function toggleReport() {
  reportExpanded.value = !reportExpanded.value
  if (reportExpanded.value && !report.value && !reportLoading.value) {
    await fetchReport()
  }
}

async function fetchReport() {
  reportLoading.value = true
  reportError.value = ''
  try {
    const token = localStorage.getItem('auth_token') || ''
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }
    const res = await fetch('/api/enterprise/agents/intelligence/summary', { headers })
    if (!res.ok) throw new Error(`API ${res.status}`)
    const json = await res.json()
    report.value = json.data || null
  } catch (e: any) {
    reportError.value = e.message || '加载报告失败'
  } finally {
    reportLoading.value = false
  }
}

function formatReportTime(dateStr: string): string {
  if (!dateStr) return '未知'
  try {
    const d = new Date(dateStr)
    return d.toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return '未知'
  }
}

// ─── Computed ───

const totalTasks = computed(() =>
  state.value.instances.reduce((sum, i) => sum + (i.totalTasks || 0), 0)
)

// 根据真实数据生成招聘洞察
const recruitmentInsight = computed(() => {
  const activeCount = state.value.summary.active
  const total = state.value.summary.total
  if (activeCount === 0) return null
  if (total === 0) return null
  return `AI 团队已就绪，可协助处理招聘任务`
})

// ─── Helpers ───

function getAgentEmoji(type: string): string {
  const map: Record<string, string> = {
    recruiter: '🎯',
    career_advisor: '🤖',
    talent_hunter: '🔍',
    interview_agent: '🎤',
    marketing: '📢',
    resume_analyzer: '📄',
  }
  return map[type] || '🤖'
}

function getAgentRole(type: string): string {
  const map: Record<string, string> = {
    recruiter: 'AI 招聘官',
    career_advisor: 'AI 招聘经理',
    talent_hunter: 'AI 猎聘顾问',
    interview_agent: 'AI 面试官',
    marketing: 'AI 宣传官',
    resume_analyzer: 'AI 简历分析师',
  }
  return map[type] || 'AI 员工'
}

function getStatusLabel(agent: AgentInstance): string {
  if (agent.emergencyStop) return '已停止'
  const map: Record<string, string> = {
    active: '在线',
    paused: '暂停',
    archived: '已归档',
  }
  return map[agent.status] || agent.status
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '从未'
  try {
    const d = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return '刚刚'
    if (diffMin < 60) return `${diffMin}分钟前`
    const diffHr = Math.floor(diffMin / 60)
    if (diffHr < 24) return `${diffHr}小时前`
    return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
  } catch {
    return '未知'
  }
}

onMounted(() => {
  refresh()
})
</script>

<style scoped>
.agent-workforce {
  padding: 0 24px 32px;
}

/* ─── Header ─── */
.aw-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 16px;
}

.aw-title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
  color: #fff;
}

.aw-subtitle {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.4);
}

/* ─── Loading / Error / Empty ─── */
.aw-loading,
.aw-error,
.aw-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 48px 24px;
  background: #0d1220;
  border: 1px solid #1a2240;
  border-radius: 12px;
  color: rgba(255, 255, 255, 0.5);
}

.aw-error {
  color: rgba(239, 68, 68, 0.8);
  flex-direction: row;
  justify-content: center;
}

.aw-retry-btn {
  padding: 4px 12px;
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 6px;
  color: rgba(239, 68, 68, 0.9);
  cursor: pointer;
  font-size: 0.8rem;
}

.aw-empty-icon {
  font-size: 2.5rem;
}

.aw-empty-hint {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.3);
}

/* ─── Agent Grid ─── */
.aw-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.aw-agent-card {
  background: #0d1220;
  border: 1px solid #1a2240;
  border-radius: 12px;
  padding: 16px;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.aw-agent-card--active {
  border-color: rgba(34, 197, 94, 0.25);
}

.aw-agent-card--active:hover {
  border-color: rgba(34, 197, 94, 0.4);
  box-shadow: 0 4px 20px rgba(34, 197, 94, 0.08);
}

.aw-agent-card--paused {
  opacity: 0.6;
}

.aw-agent-card--stopped {
  border-color: rgba(239, 68, 68, 0.3);
  opacity: 0.5;
}

/* ─── Agent Header ─── */
.aw-agent-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.aw-agent-avatar {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(96, 165, 250, 0.1);
  border-radius: 10px;
  font-size: 1.2rem;
  flex-shrink: 0;
}

.aw-agent-info {
  flex: 1;
  min-width: 0;
}

.aw-agent-name {
  display: block;
  font-size: 0.9rem;
  font-weight: 600;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.aw-agent-type {
  display: block;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.4);
}

.aw-agent-status {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.aw-status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
}

.aw-status-dot--active {
  background: #22c55e;
  box-shadow: 0 0 6px rgba(34, 197, 94, 0.5);
}

.aw-status-dot--paused {
  background: rgba(255, 255, 255, 0.3);
}

.aw-status-dot--stopped {
  background: #ef4444;
}

.aw-status-text {
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.4);
}

/* ─── Metrics ─── */
.aw-agent-metrics {
  display: flex;
  gap: 16px;
  margin-bottom: 10px;
  padding: 8px 0;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.aw-metric {
  display: flex;
  flex-direction: column;
}

.aw-metric-val {
  font-size: 0.9rem;
  font-weight: 600;
  color: #60a5fa;
}

.aw-metric-label {
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.35);
}

/* ─── Capabilities ─── */
.aw-capabilities {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 8px;
}

.aw-cap-tag {
  padding: 2px 8px;
  font-size: 0.7rem;
  background: rgba(96, 165, 250, 0.08);
  border: 1px solid rgba(96, 165, 250, 0.15);
  border-radius: 4px;
  color: rgba(96, 165, 250, 0.8);
}

.aw-cap-tag--more {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.3);
}

/* ─── Insight ─── */
.aw-insight {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: rgba(96, 165, 250, 0.05);
  border-radius: 8px;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.5);
}

.aw-insight-icon {
  flex-shrink: 0;
}

.aw-insight-text {
  line-height: 1.3;
}

/* ─── Stats Bar ─── */
.aw-stats-bar {
  display: flex;
  gap: 24px;
  margin-top: 20px;
  padding: 12px 16px;
  background: rgba(96, 165, 250, 0.04);
  border: 1px solid rgba(96, 165, 250, 0.1);
  border-radius: 10px;
}

.aw-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.aw-stat-val {
  font-size: 1.1rem;
  font-weight: 700;
  color: #60a5fa;
}

.aw-stat-label {
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.35);
}

/* ─── Copilot ─── */
.aw-copilot {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.aw-copilot-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
}

.aw-copilot-icon {
  font-size: 0.9rem;
}

.aw-copilot-title {
  flex: 1;
  font-size: 0.8rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.7);
}

.aw-copilot-input-row {
  display: flex;
  gap: 6px;
  margin-bottom: 8px;
}

.aw-copilot-input {
  flex: 1;
  padding: 6px 10px;
  font-size: 0.75rem;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: #fff;
  outline: none;
  transition: border-color 0.15s;
}

.aw-copilot-input:focus {
  border-color: rgba(96, 165, 250, 0.4);
}

.aw-copilot-input::placeholder {
  color: rgba(255, 255, 255, 0.25);
}

.aw-copilot-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 8px;
}

.aw-copilot-btn {
  padding: 3px 10px;
  font-size: 0.7rem;
  background: rgba(96, 165, 250, 0.08);
  border: 1px solid rgba(96, 165, 250, 0.2);
  border-radius: 4px;
  color: rgba(96, 165, 250, 0.8);
  cursor: pointer;
  transition: background 0.15s;
}

.aw-copilot-btn:hover:not(:disabled) {
  background: rgba(96, 165, 250, 0.18);
}

.aw-copilot-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.aw-copilot-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.4);
}

.aw-copilot-result {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.aw-result-block {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 6px;
  border-left: 2px solid rgba(96, 165, 250, 0.3);
}

.aw-result-row {
  display: flex;
  gap: 6px;
  align-items: flex-start;
}

.aw-result-label {
  flex-shrink: 0;
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.35);
  min-width: 50px;
}

.aw-result-text {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.7);
  line-height: 1.4;
}

.aw-result-badge {
  padding: 1px 8px;
  font-size: 0.7rem;
  border-radius: 4px;
  font-weight: 600;
}

.aw-result-badge--recommend {
  background: rgba(34, 197, 94, 0.12);
  color: rgba(34, 197, 94, 0.8);
  border: 1px solid rgba(34, 197, 94, 0.2);
}

.aw-result-badge--consider {
  background: rgba(234, 179, 8, 0.12);
  color: rgba(234, 179, 8, 0.8);
  border: 1px solid rgba(234, 179, 8, 0.2);
}

.aw-result-badge--pass {
  background: rgba(239, 68, 68, 0.12);
  color: rgba(239, 68, 68, 0.8);
  border: 1px solid rgba(239, 68, 68, 0.2);
}

.aw-result-msg {
  padding: 8px;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.7);
  line-height: 1.5;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 4px;
  white-space: pre-wrap;
}

.aw-copy-btn {
  align-self: flex-end;
  padding: 2px 10px;
  font-size: 0.7rem;
  background: rgba(96, 165, 250, 0.1);
  border: 1px solid rgba(96, 165, 250, 0.2);
  border-radius: 4px;
  color: rgba(96, 165, 250, 0.8);
  cursor: pointer;
}

.aw-result-sources,
.aw-result-meta {
  font-size: 0.65rem;
  color: rgba(255, 255, 255, 0.25);
}

/* ─── Intelligence Report ─── */
.aw-report {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.aw-report-header {
  display: flex;
  align-items: center;
  gap: 6px;
}

.aw-report-icon {
  font-size: 0.9rem;
}

.aw-report-title {
  flex: 1;
  font-size: 0.8rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.7);
}

.aw-report-toggle {
  padding: 2px 10px;
  font-size: 0.7rem;
  background: rgba(96, 165, 250, 0.1);
  border: 1px solid rgba(96, 165, 250, 0.2);
  border-radius: 4px;
  color: rgba(96, 165, 250, 0.8);
  cursor: pointer;
  transition: background 0.15s;
}

.aw-report-toggle:hover {
  background: rgba(96, 165, 250, 0.2);
}

.aw-report-body {
  margin-top: 10px;
}

.aw-report-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.4);
}

.aw-report-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.aw-report-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.aw-report-item {
  display: flex;
  gap: 6px;
  padding: 6px 8px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.02);
}

.aw-report-item--info {
  border-left: 2px solid rgba(96, 165, 250, 0.4);
}

.aw-report-item--high {
  border-left: 2px solid rgba(239, 68, 68, 0.5);
  background: rgba(239, 68, 68, 0.04);
}

.aw-report-item--medium {
  border-left: 2px solid rgba(234, 179, 8, 0.5);
  background: rgba(234, 179, 8, 0.04);
}

.aw-report-item--action {
  border-left: 2px solid rgba(34, 197, 94, 0.4);
}

.aw-report-item-icon {
  flex-shrink: 0;
  font-size: 0.8rem;
}

.aw-report-item-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.aw-report-item-text {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.7);
  line-height: 1.4;
}

.aw-report-source,
.aw-report-target {
  font-size: 0.65rem;
  color: rgba(255, 255, 255, 0.25);
}

.aw-report-meta {
  display: flex;
  gap: 4px;
  align-items: center;
  font-size: 0.65rem;
  color: rgba(255, 255, 255, 0.2);
  padding-top: 4px;
  border-top: 1px solid rgba(255, 255, 255, 0.03);
}

.aw-report-empty {
  padding: 12px;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.3);
  text-align: center;
}

.loading-spinner--sm {
  width: 14px;
  height: 14px;
  border-width: 1.5px;
}

/* ─── Spinner ─── */
.loading-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-top-color: #60a5fa;
  border-radius: 50%;
  animation: aw-spin 0.8s linear infinite;
}

@keyframes aw-spin {
  to { transform: rotate(360deg); }
}

/* ─── Responsive ─── */
@media (max-width: 768px) {
  .aw-grid {
    grid-template-columns: 1fr;
  }
  .aw-stats-bar {
    gap: 12px;
  }
}
</style>
