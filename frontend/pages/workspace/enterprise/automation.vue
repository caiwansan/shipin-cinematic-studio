<!--
  Sprint-09: 招聘自动化编排页面
  位置：/workspace/enterprise/automation.vue
  目标：从人工点击升级为 AI Workflow 自动执行
  核心功能：配置自动化规则、查看自动化执行状态
-->
<template>
  <div class="automation-page">
    <!-- Page Header -->
    <div class="page-header">
      <div class="header-left">
        <h1 class="page-title">⚡ 招聘自动化</h1>
        <p class="page-subtitle">配置 AI 自动执行招聘流程，从人工点击升级为智能工作流</p>
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
      <span>加载自动化配置中...</span>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-state">
      <span class="error-icon">⚠️</span>
      <p>{{ error }}</p>
      <button @click="refresh" class="retry-btn">重试</button>
    </div>

    <!-- Main Content -->
    <template v-else-if="config">
      <!-- Workflow Overview -->
      <div class="workflow-section">
        <h2 class="section-title">🔄 自动化工作流</h2>
        <div class="workflow-steps">
          <div class="workflow-step">
            <div class="workflow-step-icon">📝</div>
            <div class="workflow-step-content">
              <div class="workflow-step-title">AI 生成/优化 JD</div>
              <div class="workflow-step-desc">企业创建岗位后，AI 自动生成和优化职位描述</div>
            </div>
            <label class="toggle-switch">
              <input
                type="checkbox"
                :checked="config.autoJdGeneration"
                @change="updateConfig('autoJdGeneration', $event.target.checked)"
              />
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div class="workflow-connector"></div>
          <div class="workflow-step">
            <div class="workflow-step-icon">🔍</div>
            <div class="workflow-step-content">
              <div class="workflow-step-title">自动搜索候选人</div>
              <div class="workflow-step-desc">AI 持续扫描人才库，自动寻找匹配候选人</div>
            </div>
            <label class="toggle-switch">
              <input
                type="checkbox"
                :checked="config.autoTalentSearch"
                @change="updateConfig('autoTalentSearch', $event.target.checked)"
              />
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div class="workflow-connector"></div>
          <div class="workflow-step">
            <div class="workflow-step-icon">🎯</div>
            <div class="workflow-step-content">
              <div class="workflow-step-title">智能筛选匹配</div>
              <div class="workflow-step-desc">自动筛选 TOP 20 匹配候选人，按匹配度排序</div>
            </div>
            <label class="toggle-switch">
              <input
                type="checkbox"
                :checked="config.autoMatchFiltering"
                @change="updateConfig('autoMatchFiltering', $event.target.checked)"
              />
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div class="workflow-connector"></div>
          <div class="workflow-step">
            <div class="workflow-step-icon">📅</div>
            <div class="workflow-step-content">
              <div class="workflow-step-title">自动安排面试</div>
              <div class="workflow-step-desc">高匹配候选人自动进入面试流程，通知招聘负责人</div>
            </div>
            <label class="toggle-switch">
              <input
                type="checkbox"
                :checked="config.autoInterviewScheduling"
                @change="updateConfig('autoInterviewScheduling', $event.target.checked)"
              />
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>
      </div>

      <!-- Automation Rules -->
      <div class="rules-section">
        <h2 class="section-title">⚙️ 自动化规则</h2>
        <div class="rules-grid">
          <div class="rule-card">
            <div class="rule-label">匹配度阈值</div>
            <div class="rule-control">
              <input
                type="range"
                min="50"
                max="95"
                :value="config.matchThreshold"
                @change="updateConfig('matchThreshold', parseInt($event.target.value))"
                class="rule-slider"
              />
              <span class="rule-value">{{ config.matchThreshold }}%</span>
            </div>
            <div class="rule-desc">仅当匹配度达到此阈值时触发自动化</div>
          </div>
          <div class="rule-card">
            <div class="rule-label">匹配通知</div>
            <label class="toggle-switch">
              <input
                type="checkbox"
                :checked="config.notifyOnMatch"
                @change="updateConfig('notifyOnMatch', $event.target.checked)"
              />
              <span class="toggle-slider"></span>
            </label>
            <div class="rule-desc">发现高匹配候选人时通知招聘负责人</div>
          </div>
          <div class="rule-card">
            <div class="rule-label">面试通知</div>
            <label class="toggle-switch">
              <input
                type="checkbox"
                :checked="config.notifyOnInterview"
                @change="updateConfig('notifyOnInterview', $event.target.checked)"
              />
              <span class="toggle-slider"></span>
            </label>
            <div class="rule-desc">面试状态变更时通知相关人员</div>
          </div>
        </div>
      </div>

      <!-- Execution Stats -->
      <div class="stats-section">
        <h2 class="section-title">📊 执行统计（近30天）</h2>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">{{ stats.autoJobsCreated }}</div>
            <div class="stat-label">自动创建岗位</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ stats.autoMatches }}</div>
            <div class="stat-label">自动匹配候选</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ stats.autoInterviews }}</div>
            <div class="stat-label">自动安排面试</div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { getAuthToken } from '~/utils/auth/token'
import { ref, onMounted, onUnmounted } from 'vue'

// ─── Types ───
interface AutomationConfig {
  workspaceId: string
  enterpriseId: string
  autoJdGeneration: boolean
  autoTalentSearch: boolean
  autoMatchFiltering: boolean
  autoInterviewScheduling: boolean
  matchThreshold: number
  notifyOnMatch: boolean
  notifyOnInterview: boolean
}

interface AutomationStats {
  autoJobsCreated: number
  autoMatches: number
  autoInterviews: number
}

// ─── State ───
const loading = ref(true)
const error = ref<string | null>(null)
const config = ref<AutomationConfig | null>(null)
const stats = ref<AutomationStats>({
  autoJobsCreated: 0,
  autoMatches: 0,
  autoInterviews: 0,
})
const saving = ref(false)

// ─── Helpers ───
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

    const res = await fetch('/api/enterprise/recruitment-analytics/automation', { headers })

    if (res.status === 401) {
      error.value = '请先登录'
      return
    }

    const json = await res.json()
    if (json.success && json.data) {
      config.value = json.data.config as AutomationConfig
      stats.value = json.data.stats as AutomationStats
    } else {
      error.value = json.error || '加载失败'
    }
  } catch (e: any) {
    console.error('Failed to load automation config:', e)
    error.value = '网络错误，请稍后重试'
  } finally {
    loading.value = false
  }
}

// ─── Config Update ───
async function updateConfig(key: string, value: boolean | number) {
  if (!config.value || saving.value) return

  saving.value = true

  // Optimistic update
  const oldValue = (config.value as any)[key]
  ;(config.value as any)[key] = value

  try {
    const token = getAuthToken()
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (token) headers['Authorization'] = `Bearer ${token}`

    const res = await fetch('/api/enterprise/recruitment-analytics/automation/config', {
      method: 'PUT',
      headers,
      body: JSON.stringify({ [key]: value }),
    })

    const json = await res.json()
    if (!json.success) {
      // Revert on failure
      ;(config.value as any)[key] = oldValue
      console.error('Failed to update config:', json.error)
    }
  } catch (e: any) {
    // Revert on error
    ;(config.value as any)[key] = oldValue
    console.error('Failed to update config:', e)
  } finally {
    saving.value = false
  }
}

function refresh() {
  loadData()
}

// ─── Lifecycle ───
onMounted(() => {
  loadData()
})
</script>

<style scoped>
.automation-page {
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
.loading-state, .error-state {
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

.error-icon {
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

/* Section */
.section-title {
  font-size: 18px;
  font-weight: 600;
  color: #1a1a2e;
  margin: 0 0 16px;
}

/* Workflow Steps */
.workflow-section {
  margin-bottom: 32px;
}

.workflow-steps {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.workflow-step {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
}

.workflow-step-icon {
  font-size: 28px;
  flex-shrink: 0;
}

.workflow-step-content {
  flex: 1;
}

.workflow-step-title {
  font-size: 15px;
  font-weight: 600;
  color: #1a1a2e;
  margin-bottom: 4px;
}

.workflow-step-desc {
  font-size: 13px;
  color: #6b7280;
}

.workflow-connector {
  width: 2px;
  height: 20px;
  background: #e5e7eb;
  margin-left: 32px;
}

/* Toggle Switch */
.toggle-switch {
  position: relative;
  display: inline-block;
  width: 48px;
  height: 26px;
  flex-shrink: 0;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #e5e7eb;
  transition: 0.3s;
  border-radius: 26px;
}

.toggle-slider:before {
  position: absolute;
  content: "";
  height: 20px;
  width: 20px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: 0.3s;
  border-radius: 50%;
}

input:checked + .toggle-slider {
  background-color: #3b82f6;
}

input:checked + .toggle-slider:before {
  transform: translateX(22px);
}

/* Rules */
.rules-section {
  margin-bottom: 32px;
}

.rules-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 16px;
}

.rule-card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 20px;
}

.rule-label {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 12px;
}

.rule-control {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.rule-slider {
  flex: 1;
  height: 6px;
  -webkit-appearance: none;
  background: #e5e7eb;
  border-radius: 3px;
  outline: none;
}

.rule-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 18px;
  height: 18px;
  background: #3b82f6;
  border-radius: 50%;
  cursor: pointer;
}

.rule-value {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a2e;
  min-width: 40px;
  text-align: right;
}

.rule-desc {
  font-size: 12px;
  color: #9ca3af;
}

/* Stats */
.stats-section {
  margin-bottom: 32px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 16px;
}

.stat-card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 20px;
  text-align: center;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: #1a1a2e;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 13px;
  color: #6b7280;
}

/* Responsive */
@media (max-width: 768px) {
  .automation-page {
    padding: 16px;
  }

  .workflow-step {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
}
</style>
