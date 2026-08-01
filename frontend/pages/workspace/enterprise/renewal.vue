<!--
  Sprint-09: 企业续费价值页面
  位置：/workspace/enterprise/renewal.vue
  目标：连接 Usage → Value → Renewal 链路
  核心展示：企业健康度评分、续费风险预警、续费价值量化
-->
<template>
  <div class="renewal-page">
    <!-- Page Header -->
    <div class="page-header">
      <div class="header-left">
        <h1 class="page-title">💎 续费价值分析</h1>
        <p class="page-subtitle">量化企业价值，识别续费风险，驱动持续增长</p>
      </div>
      <div class="header-right">
        <button @click="refresh" class="refresh-btn" :disabled="loading">
          🔄 刷新
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      <div class="loading-spinner"></div>
      <span>分析企业价值中...</span>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-state">
      <span class="error-icon">⚠️</span>
      <p>{{ error }}</p>
      <button @click="refresh" class="retry-btn">重试</button>
    </div>

    <!-- Main Content -->
    <template v-else-if="data">
      <!-- Health Score Hero -->
      <div class="health-hero">
        <div class="health-score-container">
          <div class="health-score-ring" :style="{ '--score': data.healthScore }">
            <svg viewBox="0 0 100 100" class="health-ring-svg">
              <circle cx="50" cy="50" r="45" fill="none" stroke="#e5e7eb" stroke-width="8" />
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                :stroke="getHealthColor(data.healthScore)"
                stroke-width="8"
                stroke-linecap="round"
                :stroke-dasharray="`${data.healthScore * 2.83} 283`"
                transform="rotate(-90 50 50)"
              />
            </svg>
            <div class="health-score-value">{{ data.healthScore }}</div>
          </div>
          <div class="health-score-label">企业健康度</div>
        </div>
        <div class="health-details">
          <div :class="['health-risk-badge', data.renewalRisk]">
            {{ riskLabels[data.renewalRisk] }}
          </div>
          <div class="health-tags">
            <span v-if="data.isHighValue" class="health-tag high-value">⭐ 高价值客户</span>
            <span v-if="data.renewalRisk === 'high'" class="health-tag risk">⚠️ 流失风险</span>
          </div>
          <div class="health-summary">
            <p v-if="data.renewalRisk === 'low'">
              企业活跃度高，AI 招聘使用频繁，续费意愿强。
            </p>
            <p v-else-if="data.renewalRisk === 'medium'">
              企业有一定使用量，建议加强互动以提升粘性。
            </p>
            <p v-else>
              企业活跃度低，存在流失风险，建议主动触达。
            </p>
          </div>
        </div>
      </div>

      <!-- Score Breakdown -->
      <div class="section">
        <h2 class="section-title">📊 评分维度</h2>
        <div class="score-breakdown">
          <div class="score-item">
            <div class="score-item-header">
              <span class="score-item-label">使用频率</span>
              <span class="score-item-value">{{ data.scoreBreakdown.usageScore }}/30</span>
            </div>
            <div class="score-bar">
              <div class="score-bar-fill" :style="{ width: (data.scoreBreakdown.usageScore / 30 * 100) + '%' }"></div>
            </div>
            <div class="score-item-desc">月使用 {{ data.metrics.monthlyUsage }} 次，周均 {{ data.metrics.weeklyUsageAvg }} 次</div>
          </div>
          <div class="score-item">
            <div class="score-item-header">
              <span class="score-item-label">招聘活跃度</span>
              <span class="score-item-value">{{ data.scoreBreakdown.activityScore }}/30</span>
            </div>
            <div class="score-bar">
              <div class="score-bar-fill" :style="{ width: (data.scoreBreakdown.activityScore / 30 * 100) + '%' }"></div>
            </div>
            <div class="score-item-desc">
              {{ data.metrics.activeJobs }} 在招岗位，{{ data.metrics.monthlyConversations }} 次沟通，{{ data.metrics.monthlyInterviews }} 次面试
            </div>
          </div>
          <div class="score-item">
            <div class="score-item-header">
              <span class="score-item-label">AI 依赖度</span>
              <span class="score-item-value">{{ data.scoreBreakdown.dependencyScore }}/20</span>
            </div>
            <div class="score-bar">
              <div class="score-bar-fill" :style="{ width: (data.scoreBreakdown.dependencyScore / 20 * 100) + '%' }"></div>
            </div>
            <div class="score-item-desc">AI 处理任务占比 {{ data.metrics.aiDependencyRate }}%</div>
          </div>
          <div class="score-item">
            <div class="score-item-header">
              <span class="score-item-label">招聘成功率</span>
              <span class="score-item-value">{{ data.scoreBreakdown.successScore }}/20</span>
            </div>
            <div class="score-bar">
              <div class="score-bar-fill" :style="{ width: (data.scoreBreakdown.successScore / 20 * 100) + '%' }"></div>
            </div>
            <div class="score-item-desc">面试通过率 {{ data.metrics.hireRate }}%</div>
          </div>
        </div>
      </div>

      <!-- Key Metrics -->
      <div class="section">
        <h2 class="section-title">🔑 关键指标</h2>
        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-icon">📈</div>
            <div class="metric-value">{{ data.metrics.monthlyUsage }}</div>
            <div class="metric-label">月使用量</div>
          </div>
          <div class="metric-card">
            <div class="metric-icon">📋</div>
            <div class="metric-value">{{ data.metrics.activeJobs }}</div>
            <div class="metric-label">在招岗位</div>
          </div>
          <div class="metric-card">
            <div class="metric-icon">🤖</div>
            <div class="metric-value">{{ data.metrics.aiDependencyRate }}%</div>
            <div class="metric-label">AI 依赖度</div>
          </div>
          <div class="metric-card">
            <div class="metric-icon">✅</div>
            <div class="metric-value">{{ data.metrics.hireRate }}%</div>
            <div class="metric-label">招聘成功率</div>
          </div>
        </div>
      </div>
    </template>

    <!-- Empty State -->
    <div v-else class="empty-state">
      <div class="empty-icon">💎</div>
      <h2>暂无续费分析数据</h2>
      <p>企业使用数据积累后将自动生成续费价值分析</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { getAuthToken } from '~/utils/auth/token'
import { ref, onMounted, onUnmounted } from 'vue'

// ─── Types ───
interface RenewalData {
  healthScore: number
  renewalRisk: 'low' | 'medium' | 'high'
  isHighValue: boolean
  metrics: {
    monthlyUsage: number
    weeklyUsageAvg: number
    activeJobs: number
    monthlyConversations: number
    monthlyInterviews: number
    aiDependencyRate: number
    hireRate: number
  }
  scoreBreakdown: {
    usageScore: number
    activityScore: number
    dependencyScore: number
    successScore: number
  }
}

// ─── State ───
const loading = ref(true)
const error = ref<string | null>(null)
const data = ref<RenewalData | null>(null)

// ─── Constants ───
const riskLabels: Record<string, string> = {
  low: '续费风险低',
  medium: '续费风险中',
  high: '续费风险高',
}

// ─── Helpers ───
function getHealthColor(score: number): string {
  if (score >= 70) return '#10b981'
  if (score >= 40) return '#f59e0b'
  return '#ef4444'
}

function getAuthToken(): string {
  return getAuthToken()
}

// ─── Data Loading ───
async function loadData() {
  loading.value = true
  error.value = null

  try {
    const token = getAuthToken()
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`

    const res = await fetch('/api/enterprise/recruitment-analytics/renewal', { headers })

    if (res.status === 401) {
      error.value = '请先登录'
      return
    }

    const json = await res.json()
    if (json.success && json.data) {
      data.value = json.data as RenewalData
    } else {
      error.value = json.error || '加载失败'
    }
  } catch (e: any) {
    console.error('Failed to load renewal data:', e)
    error.value = '网络错误，请稍后重试'
  } finally {
    loading.value = false
  }
}

function refresh() {
  loadData()
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
.renewal-page {
  padding: 32px;
  max-width: 900px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 32px;
}

.page-title {
  font-size: 28px;
  font-weight: 700;
  color: #1a1a2e;
  margin: 0;
}

.page-subtitle {
  font-size: 14px;
  color: #6b7280;
  margin: 4px 0 0;
}

.refresh-btn {
  padding: 8px 16px;
  border: 1px solid #e5e7eb;
  background: white;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
}

/* Loading & Error */
.loading-state, .error-state, .empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
}

.loading-spinner {
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

.error-icon, .empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.retry-btn {
  margin-top: 12px;
  padding: 8px 24px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
}

/* Health Hero */
.health-hero {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  padding: 32px;
  display: flex;
  align-items: center;
  gap: 40px;
  margin-bottom: 32px;
}

.health-score-container {
  text-align: center;
  flex-shrink: 0;
}

.health-score-ring {
  position: relative;
  width: 120px;
  height: 120px;
}

.health-ring-svg {
  width: 100%;
  height: 100%;
}

.health-score-value {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 32px;
  font-weight: 800;
  color: #1a1a2e;
}

.health-score-label {
  font-size: 13px;
  color: #6b7280;
  margin-top: 8px;
}

.health-details {
  flex: 1;
}

.health-risk-badge {
  display: inline-block;
  padding: 6px 16px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 12px;
}

.health-risk-badge.low {
  background: #d1fae5;
  color: #065f46;
}

.health-risk-badge.medium {
  background: #fef3c7;
  color: #92400e;
}

.health-risk-badge.high {
  background: #fee2e2;
  color: #991b1b;
}

.health-tags {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.health-tag {
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
}

.health-tag.high-value {
  background: #eff6ff;
  color: #1d4ed8;
}

.health-tag.risk {
  background: #fef2f2;
  color: #dc2626;
}

.health-summary {
  font-size: 14px;
  color: #6b7280;
  line-height: 1.5;
}

/* Section */
.section {
  margin-bottom: 32px;
}

.section-title {
  font-size: 18px;
  font-weight: 600;
  color: #1a1a2e;
  margin: 0 0 16px;
}

/* Score Breakdown */
.score-breakdown {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.score-item {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 16px 20px;
}

.score-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.score-item-label {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}

.score-item-value {
  font-size: 14px;
  font-weight: 600;
  color: #1a1a2e;
}

.score-bar {
  height: 8px;
  background: #f3f4f6;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 8px;
}

.score-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #8b5cf6);
  border-radius: 4px;
  transition: width 0.5s ease;
}

.score-item-desc {
  font-size: 12px;
  color: #9ca3af;
}

/* Metrics Grid */
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 16px;
}

.metric-card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 20px;
  text-align: center;
}

.metric-icon {
  font-size: 24px;
  margin-bottom: 8px;
}

.metric-value {
  font-size: 24px;
  font-weight: 700;
  color: #1a1a2e;
  margin-bottom: 4px;
}

.metric-label {
  font-size: 13px;
  color: #6b7280;
}

/* Responsive */
@media (max-width: 768px) {
  .renewal-page {
    padding: 16px;
  }

  .health-hero {
    flex-direction: column;
    text-align: center;
    padding: 24px;
  }

  .health-tags {
    justify-content: center;
  }
}
</style>
