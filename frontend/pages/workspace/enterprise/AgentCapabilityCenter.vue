<!--
  Sprint-09: AI 招聘员工能力中心
  位置：/workspace/enterprise/AgentCapabilityCenter.vue
  目标：让企业知道"我的 AI 员工越来越强"
  核心展示：每个 AI 员工的能力列表、成长数据、使用趋势
-->
<template>
  <div class="capability-center">
    <!-- Header -->
    <div class="cc-header">
      <h1 class="cc-title">🤖 AI 员工能力中心</h1>
      <p class="cc-subtitle">您的 AI 招聘团队持续成长，能力不断提升</p>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="cc-loading">
      <div class="cc-spinner"></div>
      <span>加载能力数据中...</span>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="cc-error">
      <span>⚠️</span>
      <p>{{ error }}</p>
      <button @click="loadData" class="cc-retry-btn">重试</button>
    </div>

    <!-- Content -->
    <template v-else-if="data">
      <!-- Summary Stats -->
      <div class="cc-summary">
        <div class="cc-summary-card">
          <div class="cc-summary-value">{{ data.summary.totalMonthlyTasks }}</div>
          <div class="cc-summary-label">本月完成任务</div>
        </div>
        <div class="cc-summary-card">
          <div class="cc-summary-value">{{ data.summary.totalAnalyzedCandidates }}</div>
          <div class="cc-summary-label">分析候选人</div>
        </div>
        <div class="cc-summary-card">
          <div class="cc-summary-value">{{ data.summary.completedInterviews }}</div>
          <div class="cc-summary-label">完成面试评估</div>
        </div>
        <div class="cc-summary-card">
          <div class="cc-summary-value">{{ data.summary.taskCompletionRate }}%</div>
          <div class="cc-summary-label">任务完成率</div>
        </div>
      </div>

      <!-- Agent Cards -->
      <div class="cc-agents">
        <div v-for="agent in data.agents" :key="agent.id" class="cc-agent-card">
          <!-- Agent Header -->
          <div class="cc-agent-header">
            <div class="cc-agent-info">
              <div class="cc-agent-name">{{ agent.shortName }}</div>
              <div class="cc-agent-desc">{{ agent.description }}</div>
            </div>
            <div :class="['cc-agent-status', agent.status]">
              {{ statusLabels[agent.status] || agent.status }}
            </div>
          </div>

          <!-- Capabilities -->
          <div class="cc-capabilities">
            <div class="cc-capabilities-title">核心能力</div>
            <div class="cc-capabilities-list">
              <span
                v-for="cap in agent.capabilities"
                :key="cap"
                class="cc-capability-tag"
              >
                {{ cap }}
              </span>
            </div>
          </div>

          <!-- Stats -->
          <div class="cc-stats">
            <div class="cc-stat">
              <div class="cc-stat-value">{{ agent.monthlyTasks }}</div>
              <div class="cc-stat-label">本月任务</div>
            </div>
            <div class="cc-stat">
              <div class="cc-stat-value">{{ agent.analyzedCandidates }}</div>
              <div class="cc-stat-label">分析候选</div>
            </div>
            <div class="cc-stat">
              <div class="cc-stat-value">{{ agent.interviewsEvaluated }}</div>
              <div class="cc-stat-label">面试评估</div>
            </div>
          </div>

          <!-- Weekly Usage Trend -->
          <div class="cc-trend">
            <div class="cc-trend-title">近4周使用趋势</div>
            <div class="cc-trend-bars">
              <div
                v-for="week in agent.weeklyUsage"
                :key="week.week"
                class="cc-trend-bar-group"
              >
                <div
                  class="cc-trend-bar"
                  :style="{ height: getTrendHeight(week.count, maxWeeklyCount) + '%' }"
                  :title="`${week.count} 次调用`"
                ></div>
                <div class="cc-trend-label">{{ week.week }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Empty State -->
    <div v-else class="cc-empty">
      <div class="cc-empty-icon">🤖</div>
      <h2>暂无 AI 员工数据</h2>
      <p>请先配置并激活 AI 招聘员工</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

// ─── Types ───
interface AgentCapability {
  id: string
  agentType: string
  name: string
  shortName: string
  description: string
  capabilities: string[]
  status: string
  monthlyTasks: number
  analyzedCandidates: number
  interviewsEvaluated: number
  weeklyUsage: Array<{ week: string; count: number }>
  monthlyCalls: number
  monthlyTokens: number
  monthlyCost: number
}

interface CapabilityData {
  agents: AgentCapability[]
  summary: {
    totalMonthlyTasks: number
    totalAnalyzedCandidates: number
    totalInterviews: number
    completedInterviews: number
    taskCompletionRate: number
  }
}

// ─── State ───
const loading = ref(true)
const error = ref<string | null>(null)
const data = ref<CapabilityData | null>(null)

// ─── Constants ───
const statusLabels: Record<string, string> = {
  active: '运行中',
  trial: '试用中',
  paused: '已暂停',
}

// ─── Computed ───
const maxWeeklyCount = computed(() => {
  if (!data.value) return 1
  let max = 1
  for (const agent of data.value.agents) {
    for (const week of agent.weeklyUsage) {
      if (week.count > max) max = week.count
    }
  }
  return max
})

// ─── Helpers ───
function getTrendHeight(value: number, max: number): number {
  if (max === 0) return 5
  return Math.max(5, (value / max) * 100)
}

function getAuthToken(): string {
  return localStorage.getItem('token') || ''
}

// ─── Data Loading ───
async function loadData() {
  loading.value = true
  error.value = null

  try {
    const token = getAuthToken()
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`

    const res = await fetch('/api/enterprise/recruitment-analytics/capability', { headers })

    if (res.status === 401) {
      error.value = '请先登录'
      return
    }

    const json = await res.json()
    if (json.success && json.data) {
      data.value = json.data as CapabilityData
    } else {
      error.value = json.error || '加载失败'
    }
  } catch (e: any) {
    console.error('Failed to load capability data:', e)
    error.value = '网络错误，请稍后重试'
  } finally {
    loading.value = false
  }
}

// ─── Lifecycle ───
let refreshTimer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  loadData()
  refreshTimer = setInterval(loadData, 120000)
})

onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer)
})
</script>

<style scoped>
.capability-center {
  padding: 32px;
  max-width: 1100px;
  margin: 0 auto;
}

.cc-header {
  margin-bottom: 32px;
}

.cc-title {
  font-size: 28px;
  font-weight: 700;
  color: #1a1a2e;
  margin: 0;
}

.cc-subtitle {
  font-size: 14px;
  color: #6b7280;
  margin: 4px 0 0;
}

/* Loading & Error */
.cc-loading, .cc-error, .cc-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
}

.cc-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 12px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.cc-retry-btn {
  margin-top: 12px;
  padding: 8px 24px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
}

.cc-empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

/* Summary */
.cc-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
  margin-bottom: 32px;
}

.cc-summary-card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 20px;
  text-align: center;
}

.cc-summary-value {
  font-size: 28px;
  font-weight: 700;
  color: #1a1a2e;
  margin-bottom: 4px;
}

.cc-summary-label {
  font-size: 13px;
  color: #6b7280;
}

/* Agent Cards */
.cc-agents {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.cc-agent-card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  padding: 24px;
}

.cc-agent-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
}

.cc-agent-name {
  font-size: 18px;
  font-weight: 600;
  color: #1a1a2e;
  margin-bottom: 4px;
}

.cc-agent-desc {
  font-size: 13px;
  color: #6b7280;
  max-width: 400px;
}

.cc-agent-status {
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
}

.cc-agent-status.active {
  background: #d1fae5;
  color: #065f46;
}

.cc-agent-status.trial {
  background: #fef3c7;
  color: #92400e;
}

.cc-agent-status.paused {
  background: #fee2e2;
  color: #991b1b;
}

/* Capabilities */
.cc-capabilities {
  margin-bottom: 20px;
}

.cc-capabilities-title {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 8px;
}

.cc-capabilities-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.cc-capability-tag {
  padding: 4px 10px;
  background: #eff6ff;
  color: #1d4ed8;
  border-radius: 6px;
  font-size: 12px;
}

/* Stats */
.cc-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 20px;
  padding: 16px;
  background: #f9fafb;
  border-radius: 12px;
}

.cc-stat {
  text-align: center;
}

.cc-stat-value {
  font-size: 20px;
  font-weight: 700;
  color: #1a1a2e;
}

.cc-stat-label {
  font-size: 12px;
  color: #6b7280;
  margin-top: 2px;
}

/* Trend */
.cc-trend {
  border-top: 1px solid #f3f4f6;
  padding-top: 16px;
}

.cc-trend-title {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 12px;
}

.cc-trend-bars {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 24px;
  height: 80px;
}

.cc-trend-bar-group {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.cc-trend-bar {
  width: 24px;
  background: linear-gradient(180deg, #3b82f6 0%, #8b5cf6 100%);
  border-radius: 4px 4px 0 0;
  transition: height 0.3s ease;
  min-height: 4px;
}

.cc-trend-label {
  font-size: 11px;
  color: #9ca3af;
  margin-top: 6px;
}

/* Responsive */
@media (max-width: 768px) {
  .capability-center {
    padding: 16px;
  }

  .cc-stats {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .cc-agent-header {
    flex-direction: column;
    gap: 8px;
  }
}
</style>
