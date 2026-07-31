<!--
  Sprint-09: 招聘 ROI Dashboard
  位置：/workspace/enterprise/analytics.vue
  目标：回答企业老板的问题："买 AI 招聘员工到底值不值？"
  核心展示：招聘效率、成本价值、ROI 分析
-->
<template>
  <div class="analytics-page">
    <!-- Page Header -->
    <div class="page-header">
      <div class="header-left">
        <h1 class="page-title">📊 招聘 ROI 分析</h1>
        <p class="page-subtitle">量化 AI 招聘价值，清晰看到投资回报</p>
      </div>
      <div class="header-right">
        <button @click="goBack" class="back-btn">← 返回工作台</button>
        <button @click="refresh" class="refresh-btn" :disabled="loading">
          🔄 刷新
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      <div class="loading-spinner"></div>
      <span>加载分析数据中...</span>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-state">
      <span class="error-icon">⚠️</span>
      <p>{{ error }}</p>
      <button @click="refresh" class="retry-btn">重试</button>
    </div>

    <!-- Main Content -->
    <template v-else-if="data">
      <!-- ROI Hero Card -->
      <div class="roi-hero">
        <div class="roi-hero-content">
          <div class="roi-hero-label">投资回报率</div>
          <div class="roi-hero-value">{{ data.costValue.roi }}%</div>
          <div class="roi-hero-desc">
            相比传统招聘，AI 招聘节省 <strong>¥{{ formatNumber(data.costValue.savings) }}</strong>
          </div>
        </div>
        <div class="roi-hero-visual">
          <div class="roi-comparison">
            <div class="roi-bar-item">
              <span class="roi-bar-label">传统招聘</span>
              <div class="roi-bar">
                <div class="roi-bar-fill manual" :style="{ width: '100%' }"></div>
              </div>
              <span class="roi-bar-value">¥{{ formatNumber(data.costValue.manualCostTotal) }}</span>
            </div>
            <div class="roi-bar-item">
              <span class="roi-bar-label">AI 招聘</span>
              <div class="roi-bar">
                <div class="roi-bar-fill ai" :style="{ width: getAiCostPercent() + '%' }"></div>
              </div>
              <span class="roi-bar-value">¥{{ formatNumber(data.costValue.aiCostYearly) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Efficiency Metrics -->
      <div class="section">
        <h2 class="section-title">⚡ 招聘效率</h2>
        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-icon">⏱️</div>
            <div class="metric-value">{{ data.efficiency.avgHireDays }}天</div>
            <div class="metric-label">平均招聘周期</div>
            <div class="metric-benchmark">
              行业平均 {{ data.efficiency.industryAvgHireDays }} 天
              <span v-if="data.efficiency.hireDaysReduction > 0" class="metric-improvement">
                ↓ {{ data.efficiency.hireDaysReduction }}%
              </span>
            </div>
          </div>
          <div class="metric-card">
            <div class="metric-icon">🤖</div>
            <div class="metric-value">{{ data.efficiency.aiProcessedCandidates }}</div>
            <div class="metric-label">AI 处理候选人数</div>
            <div class="metric-benchmark">
              本月 {{ data.efficiency.monthlyProcessedCandidates }} 人
            </div>
          </div>
          <div class="metric-card">
            <div class="metric-icon">⏰</div>
            <div class="metric-value">{{ data.efficiency.savedScreeningHours }}小时</div>
            <div class="metric-label">节省筛选时间</div>
            <div class="metric-benchmark">
              相当于 {{ data.efficiency.savedScreeningMinutes }} 分钟人工
            </div>
          </div>
          <div class="metric-card">
            <div class="metric-icon">🎯</div>
            <div class="metric-value">{{ data.funnel.conversionRate }}%</div>
            <div class="metric-label">候选→面试转化率</div>
            <div class="metric-benchmark">
              {{ data.funnel.totalInterviews }} / {{ data.funnel.totalMatches }}
            </div>
          </div>
        </div>
      </div>

      <!-- Cost Value Analysis -->
      <div class="section">
        <h2 class="section-title">💰 成本价值分析</h2>
        <div class="cost-breakdown">
          <div class="cost-item">
            <div class="cost-item-header">
              <span class="cost-item-label">AI 年化成本</span>
              <span class="cost-item-value">¥{{ formatNumber(data.costValue.aiCostYearly) }}</span>
            </div>
            <div class="cost-item-detail">
              月均 ¥{{ formatNumber(data.costValue.aiCostMonthly) }}，基于实际 AI 调用量
            </div>
          </div>
          <div class="cost-item">
            <div class="cost-item-header">
              <span class="cost-item-label">人工筛选成本（估算）</span>
              <span class="cost-item-value">¥{{ formatNumber(data.costValue.manualScreeningCost) }}</span>
            </div>
            <div class="cost-item-detail">
              {{ data.efficiency.aiProcessedCandidates }} 人 × {{ data.benchmarks.avgScreeningTimePerCandidate }} 分钟/人
            </div>
          </div>
          <div class="cost-item">
            <div class="cost-item-header">
              <span class="cost-item-label">人工面试成本（估算）</span>
              <span class="cost-item-value">¥{{ formatNumber(data.costValue.manualInterviewCost) }}</span>
            </div>
            <div class="cost-item-detail">
              {{ data.funnel.completedInterviews }} 次面试 × {{ data.benchmarks.avgInterviewPerCandidate }} 分钟/次
            </div>
          </div>
          <div class="cost-item">
            <div class="cost-item-header">
              <span class="cost-item-label">单次招聘成本（估算）</span>
              <span class="cost-item-value">¥{{ formatNumber(data.costValue.manualRecruitmentCost) }}</span>
            </div>
            <div class="cost-item-detail">
              {{ data.funnel.completedInterviews }} 次录用 × ¥{{ data.benchmarks.avgCostPerHire }}/次
            </div>
          </div>
        </div>
      </div>

      <!-- Recruitment Funnel -->
      <div class="section">
        <h2 class="section-title">🔻 招聘漏斗</h2>
        <div class="funnel-container">
          <div class="funnel-stage">
            <div class="funnel-value">{{ data.funnel.totalJobs }}</div>
            <div class="funnel-label">总岗位</div>
            <div class="funnel-sub">{{ data.funnel.activeJobs }} 在招</div>
          </div>
          <div class="funnel-arrow">→</div>
          <div class="funnel-stage">
            <div class="funnel-value">{{ data.funnel.totalMatches }}</div>
            <div class="funnel-label">候选匹配</div>
            <div class="funnel-sub">{{ data.funnel.highQualityMatches }} 高质量</div>
          </div>
          <div class="funnel-arrow">→</div>
          <div class="funnel-stage">
            <div class="funnel-value">{{ data.funnel.totalInterviews }}</div>
            <div class="funnel-label">面试</div>
            <div class="funnel-sub">{{ data.funnel.completedInterviews }} 已完成</div>
          </div>
        </div>
      </div>

      <!-- Monthly Trend -->
      <div class="section">
        <h2 class="section-title">📈 月度趋势</h2>
        <div class="trend-chart">
          <div class="trend-bars">
            <div
              v-for="item in data.monthlyTrend"
              :key="item.month"
              class="trend-bar-group"
            >
              <div class="trend-bar-container">
                <div
                  class="trend-bar candidates"
                  :style="{ height: getTrendHeight(item.candidates, maxCandidates) + '%' }"
                  :title="`候选: ${item.candidates}`"
                ></div>
                <div
                  class="trend-bar interviews"
                  :style="{ height: getTrendHeight(item.interviews, maxInterviews) + '%' }"
                  :title="`面试: ${item.interviews}`"
                ></div>
              </div>
              <div class="trend-label">{{ item.month }}</div>
            </div>
          </div>
          <div class="trend-legend">
            <span class="legend-item"><span class="legend-dot candidates"></span> 候选匹配</span>
            <span class="legend-item"><span class="legend-dot interviews"></span> 面试</span>
          </div>
        </div>
      </div>
    </template>

    <!-- Empty State -->
    <div v-else class="empty-state">
      <div class="empty-icon">📊</div>
      <h2>暂无分析数据</h2>
      <p>开始使用 AI 招聘后，这里将展示 ROI 分析数据</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

// ─── Types ───
interface AnalyticsData {
  efficiency: {
    avgHireDays: number
    industryAvgHireDays: number
    hireDaysReduction: number
    aiProcessedCandidates: number
    monthlyProcessedCandidates: number
    savedScreeningHours: number
    savedScreeningMinutes: number
  }
  costValue: {
    aiCostMonthly: number
    aiCostYearly: number
    manualCostTotal: number
    manualScreeningCost: number
    manualInterviewCost: number
    manualRecruitmentCost: number
    savings: number
    roi: number
  }
  funnel: {
    totalJobs: number
    activeJobs: number
    totalMatches: number
    highQualityMatches: number
    totalInterviews: number
    completedInterviews: number
    conversionRate: number
  }
  monthlyTrend: Array<{
    month: string
    candidates: number
    interviews: number
    cost: number
  }>
  benchmarks: {
    avgHireDays: number
    avgScreeningTimePerCandidate: number
    avgCostPerHire: number
    avgInterviewPerCandidate: number
    aiCostPerCall: number
  }
}

// ─── State ───
const loading = ref(true)
const error = ref<string | null>(null)
const data = ref<AnalyticsData | null>(null)

// ─── Computed ───
const maxCandidates = computed(() => {
  if (!data.value) return 1
  return Math.max(...data.value.monthlyTrend.map(t => t.candidates), 1)
})

const maxInterviews = computed(() => {
  if (!data.value) return 1
  return Math.max(...data.value.monthlyTrend.map(t => t.interviews), 1)
})

// ─── Helpers ───
function formatNumber(num: number | undefined | null): string {
  if (num == null || isNaN(num)) return '0'
  return num.toLocaleString('zh-CN')
}

function getAiCostPercent(): number {
  if (!data.value) return 0
  const { aiCostYearly, manualCostTotal } = data.value.costValue
  if (manualCostTotal === 0) return 100
  return Math.min(100, Math.round((aiCostYearly / manualCostTotal) * 100))
}

function goBack() {
  navigateTo('/workspace/enterprise/')
}

function getTrendHeight(value: number, max: number): number {
  if (max === 0) return 0
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

    const res = await fetch('/api/enterprise/recruitment-analytics/roi', { headers })

    if (res.status === 401) {
      error.value = '请先登录'
      return
    }

    const json = await res.json()
    if (json.success && json.data) {
      data.value = json.data as AnalyticsData
    } else {
      error.value = json.error || '加载失败'
    }
  } catch (e: any) {
    console.error('Failed to load analytics:', e)
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
  refreshTimer = setInterval(loadData, 60000)
})

onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer)
})
</script>

<style scoped>
.analytics-page {
  padding: 32px;
  max-width: 1100px;
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

.back-btn {
  padding: 8px 16px;
  border: 1px solid #e5e7eb;
  background: #f8f9fa;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  margin-right: 8px;
}

.back-btn:hover {
  background: #e9ecef;
  border-color: #d1d5db;
}

.refresh-btn {
  padding: 8px 16px;
  border: 1px solid #e5e7eb;
  background: white;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.refresh-btn:hover {
  background: #f9fafb;
  border-color: #d1d5db;
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

/* ROI Hero */
.roi-hero {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16px;
  padding: 32px;
  color: white;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
  gap: 32px;
}

.roi-hero-content {
  flex: 1;
}

.roi-hero-label {
  font-size: 14px;
  opacity: 0.8;
  margin-bottom: 8px;
}

.roi-hero-value {
  font-size: 56px;
  font-weight: 800;
  line-height: 1;
  margin-bottom: 12px;
}

.roi-hero-desc {
  font-size: 14px;
  opacity: 0.9;
}

.roi-hero-visual {
  flex: 1;
  min-width: 280px;
}

.roi-comparison {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.roi-bar-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.roi-bar-label {
  font-size: 12px;
  width: 70px;
  opacity: 0.9;
}

.roi-bar {
  flex: 1;
  height: 24px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  overflow: hidden;
}

.roi-bar-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.5s ease;
}

.roi-bar-fill.manual {
  background: rgba(255, 255, 255, 0.6);
}

.roi-bar-fill.ai {
  background: #4ade80;
}

.roi-bar-value {
  font-size: 12px;
  width: 80px;
  text-align: right;
  opacity: 0.9;
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

/* Metrics Grid */
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
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
  font-size: 28px;
  font-weight: 700;
  color: #1a1a2e;
  margin-bottom: 4px;
}

.metric-label {
  font-size: 13px;
  color: #6b7280;
  margin-bottom: 8px;
}

.metric-benchmark {
  font-size: 12px;
  color: #9ca3af;
}

.metric-improvement {
  color: #10b981;
  font-weight: 600;
  margin-left: 4px;
}

/* Cost Breakdown */
.cost-breakdown {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.cost-item {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 16px 20px;
}

.cost-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.cost-item-label {
  font-size: 14px;
  color: #374151;
}

.cost-item-value {
  font-size: 18px;
  font-weight: 600;
  color: #1a1a2e;
}

.cost-item-detail {
  font-size: 12px;
  color: #9ca3af;
}

/* Funnel */
.funnel-container {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 24px;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
}

.funnel-stage {
  text-align: center;
  flex: 1;
}

.funnel-value {
  font-size: 32px;
  font-weight: 700;
  color: #1a1a2e;
}

.funnel-label {
  font-size: 13px;
  color: #6b7280;
  margin-top: 4px;
}

.funnel-sub {
  font-size: 12px;
  color: #9ca3af;
  margin-top: 2px;
}

.funnel-arrow {
  font-size: 24px;
  color: #d1d5db;
}

/* Trend Chart */
.trend-chart {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 24px;
}

.trend-bars {
  display: flex;
  align-items: flex-end;
  justify-content: space-around;
  height: 160px;
  margin-bottom: 16px;
}

.trend-bar-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
}

.trend-bar-container {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  height: 120px;
}

.trend-bar {
  width: 16px;
  border-radius: 4px 4px 0 0;
  transition: height 0.3s ease;
  min-height: 4px;
}

.trend-bar.candidates {
  background: #3b82f6;
}

.trend-bar.interviews {
  background: #8b5cf6;
}

.trend-label {
  font-size: 11px;
  color: #9ca3af;
  margin-top: 8px;
}

.trend-legend {
  display: flex;
  justify-content: center;
  gap: 24px;
  font-size: 12px;
  color: #6b7280;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 2px;
}

.legend-dot.candidates {
  background: #3b82f6;
}

.legend-dot.interviews {
  background: #8b5cf6;
}

/* Responsive */
@media (max-width: 768px) {
  .analytics-page {
    padding: 16px;
  }

  .roi-hero {
    flex-direction: column;
    padding: 24px;
  }

  .roi-hero-value {
    font-size: 40px;
  }

  .funnel-container {
    flex-direction: column;
    gap: 8px;
  }

  .funnel-arrow {
    transform: rotate(90deg);
  }
}
</style>
