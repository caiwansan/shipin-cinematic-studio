<!-- DirectorPanel.vue — AI 招聘主管交互面板 -->
<template>
  <div class="director-panel">
    <div class="director-header">
      <h2 class="director-title">🤖 AI 招聘主管</h2>
      <p class="director-subtitle">输入招聘目标，AI 团队自动执行</p>
    </div>

    <!-- 输入区域 -->
    <div class="director-input-area">
      <div class="input-group">
        <label class="input-label">招聘目标</label>
        <textarea
          v-model="goalText"
          class="goal-input"
          placeholder="例如：招聘3名Java工程师，薪资15-25K，北京"
          rows="2"
          :disabled="isCreating"
        />
      </div>
      <div class="input-row">
        <div class="input-group">
          <label class="input-label">薪资范围</label>
          <input
            v-model="salaryRange"
            class="input-field"
            placeholder="15-25K"
            :disabled="isCreating"
          />
        </div>
        <div class="input-group">
          <label class="input-label">工作地点</label>
          <input
            v-model="location"
            class="input-field"
            placeholder="北京"
            :disabled="isCreating"
          />
        </div>
      </div>
      <button
        class="create-plan-btn"
        :disabled="!goalText.trim() || isCreating"
        @click="createPlan"
      >
        <span v-if="isCreating" class="btn-spinner"></span>
        <span v-else>🎯 创建招聘计划</span>
      </button>
    </div>

    <!-- 错误提示 -->
    <div v-if="error" class="error-message">
      ⚠️ {{ error }}
    </div>

    <!-- 当前计划 -->
    <div v-if="currentPlan" class="current-plan">
      <div class="plan-header">
        <h3 class="plan-title">📋 {{ currentPlan.positionTitle }} 招聘计划</h3>
        <span class="plan-status" :class="currentPlan.status">{{ statusLabel(currentPlan.status) }}</span>
      </div>
      <p class="plan-summary">{{ currentPlan.summary }}</p>

      <!-- 进度条 -->
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: currentPlan.progress + '%' }"></div>
        <span class="progress-text">{{ currentPlan.completedSubtasks }}/{{ currentPlan.totalSubtasks }}</span>
      </div>

      <!-- 任务列表 -->
      <div class="task-list">
        <div
          v-for="task in currentPlan.tasks"
          :key="task.id"
          class="task-item"
          :class="task.status"
        >
          <span class="task-icon">{{ getTaskIcon(task.agentType) }}</span>
          <div class="task-info">
            <span class="task-name">{{ task.taskName }}</span>
            <span v-if="task.result" class="task-result">{{ getTaskSummary(task) }}</span>
            <span v-if="task.errorMessage" class="task-error">{{ task.errorMessage }}</span>
          </div>
          <span class="task-status-icon">{{ getTaskStatusIcon(task.status) }}</span>
        </div>
      </div>

      <!-- 执行按钮 -->
      <div v-if="currentPlan.status === 'planning'" class="plan-actions">
        <button class="execute-btn" :disabled="isExecuting" @click="executePlan">
          <span v-if="isExecuting" class="btn-spinner"></span>
          <span v-else>🚀 执行计划</span>
        </button>
      </div>

      <!-- 审核按钮 -->
      <div v-if="currentPlan.status === 'reviewing'" class="plan-actions">
        <button class="approve-btn" @click="reviewPlan('approve')">✅ 确认推荐</button>
        <button class="retry-btn" @click="reviewPlan('retry')">🔄 重新执行</button>
      </div>
    </div>

    <!-- 历史计划 -->
    <div v-if="planHistory.length > 0" class="plan-history">
      <h3 class="history-title">📜 历史计划</h3>
      <div
        v-for="plan in planHistory"
        :key="plan.id"
        class="history-item"
        @click="viewPlanDetail(plan.id)"
      >
        <span class="history-goal">{{ plan.goal }}</span>
        <span class="history-status" :class="plan.status">{{ statusLabel(plan.status) }}</span>
      </div>
    </div>

    <!-- 知识库 -->
    <div v-if="knowledgeStats.length > 0" class="knowledge-section">
      <h3 class="knowledge-title">📚 招聘知识库</h3>
      <div class="knowledge-stats">
        <div v-for="stat in knowledgeStats" :key="stat.type" class="knowledge-stat-item">
          <span class="stat-type">{{ getKnowledgeTypeLabel(stat.type) }}</span>
          <span class="stat-count">{{ stat.count }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { getAuthToken } from '~/utils/auth/token'

const props = defineProps<{
  workspaceId: string
}>()

// ─── State ───
const goalText = ref('')
const salaryRange = ref('')
const location = ref('')
const isCreating = ref(false)
const isExecuting = ref(false)
const error = ref('')
const currentPlan = ref<any>(null)
const planHistory = ref<any[]>([])
const knowledgeStats = ref<any[]>([])

// ─── Methods ───

async function createPlan() {
  if (!goalText.value.trim()) return

  isCreating.value = true
  error.value = ''

  try {
    const token = getAuthToken()
    const res = await fetch('/api/enterprise/recruitment-director/plan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        workspaceId: props.workspaceId,
        goal: goalText.value,
        salaryRange: salaryRange.value || undefined,
        location: location.value || undefined,
      }),
    })

    const data = await res.json()
    if (!data.success) {
      throw new Error(data.error || '创建计划失败')
    }

    currentPlan.value = data.data
    // 刷新历史
    loadPlanHistory()
  } catch (e: any) {
    error.value = e.message
  } finally {
    isCreating.value = false
  }
}

async function executePlan() {
  if (!currentPlan.value) return

  isExecuting.value = true
  error.value = ''

  try {
    const token = getAuthToken()
    const res = await fetch(`/api/enterprise/recruitment-director/plans/${currentPlan.value.id}/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    })

    const data = await res.json()
    if (!data.success) {
      throw new Error(data.error || '执行失败')
    }

    // 轮询获取最新状态
    await pollPlanStatus()
  } catch (e: any) {
    error.value = e.message
  } finally {
    isExecuting.value = false
  }
}

async function pollPlanStatus() {
  if (!currentPlan.value) return

  const maxAttempts = 30
  let attempts = 0

  const poll = async () => {
    if (attempts >= maxAttempts) return
    attempts++

    try {
      const token = getAuthToken()
      const res = await fetch(`/api/enterprise/recruitment-director/plans/${currentPlan.value.id}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.success) {
        currentPlan.value = data.data
        if (data.data.status === 'reviewing' || data.data.status === 'completed' || data.data.status === 'failed') {
          return
        }
      }
    } catch (e) {
      // ignore
    }

    setTimeout(poll, 2000)
  }

  await poll()
}

async function reviewPlan(action: string) {
  if (!currentPlan.value) return

  try {
    const token = getAuthToken()
    const res = await fetch(`/api/enterprise/recruitment-director/plans/${currentPlan.value.id}/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ action }),
    })

    const data = await res.json()
    if (data.success) {
      currentPlan.value = { ...currentPlan.value, status: data.data.status }
      loadPlanHistory()
    }
  } catch (e: any) {
    error.value = e.message
  }
}

async function loadPlanHistory() {
  try {
    const token = getAuthToken()
    const res = await fetch(`/api/enterprise/recruitment-director/plans?workspaceId=${props.workspaceId}&limit=5`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })
    const data = await res.json()
    if (data.success) {
      planHistory.value = data.data.items.filter((p: any) => p.id !== currentPlan.value?.id)
    }
  } catch (e) {
    // ignore
  }
}

async function loadKnowledgeStats() {
  try {
    const token = getAuthToken()
    const res = await fetch(`/api/enterprise/recruitment-director/knowledge?workspaceId=${props.workspaceId}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })
    const data = await res.json()
    if (data.success) {
      knowledgeStats.value = data.data.stats
    }
  } catch (e) {
    // ignore
  }
}

function viewPlanDetail(planId: string) {
  // 切换到该计划
  const plan = planHistory.value.find(p => p.id === planId)
  if (plan) {
    currentPlan.value = plan
  }
}

// ─── Helpers ───

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    planning: '规划中',
    executing: '执行中',
    reviewing: '待审核',
    completed: '已完成',
    failed: '失败',
    paused: '已暂停',
  }
  return labels[status] || status
}

function getTaskIcon(agentType: string): string {
  const icons: Record<string, string> = {
    jd_optimizer: '📝',
    talent_searcher: '🔍',
    match_filter: '🎯',
    interview_planner: '💬',
  }
  return icons[agentType] || '🤖'
}

function getTaskStatusIcon(status: string): string {
  const icons: Record<string, string> = {
    pending: '⏳',
    running: '🔄',
    completed: '✅',
    failed: '❌',
    skipped: '⏭️',
  }
  return icons[status] || '⏳'
}

function getTaskSummary(task: any): string {
  if (!task.result) return ''
  if (task.result.qualityScore) return `质量分: ${task.result.qualityScore}`
  if (task.result.candidatesFound !== undefined) return `找到 ${task.result.candidatesFound} 人`
  if (task.result.analyzedCount !== undefined) return `分析 ${task.result.analyzedCount} 人`
  if (task.result.totalQuestions) return `${task.result.totalQuestions} 道面试题`
  return ''
}

function getKnowledgeTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    candidate_profile: '候选人画像',
    interview_standard: '面试标准',
    hiring_preference: '招聘偏好',
    success_pattern: '成功模式',
  }
  return labels[type] || type
}

// ─── Lifecycle ───
onMounted(() => {
  loadPlanHistory()
  loadKnowledgeStats()
})
</script>

<style scoped>
.director-panel {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  border-radius: 12px;
  padding: 24px;
  margin: 16px 0;
  color: #e0e0e0;
}

.director-header {
  margin-bottom: 20px;
}

.director-title {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
  color: #fff;
}

.director-subtitle {
  font-size: 14px;
  color: #a0a0a0;
  margin: 4px 0 0;
}

.director-input-area {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.input-row {
  display: flex;
  gap: 12px;
}

.input-label {
  font-size: 12px;
  color: #a0a0a0;
  font-weight: 500;
}

.goal-input {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 12px;
  color: #fff;
  font-size: 14px;
  resize: vertical;
  min-height: 60px;
}

.goal-input:focus {
  outline: none;
  border-color: #4a9eff;
  background: rgba(255, 255, 255, 0.08);
}

.input-field {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 10px 12px;
  color: #fff;
  font-size: 14px;
}

.input-field:focus {
  outline: none;
  border-color: #4a9eff;
}

.create-plan-btn {
  background: linear-gradient(135deg, #4a9eff 0%, #0066cc 100%);
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 12px 24px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.create-plan-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(74, 158, 255, 0.3);
}

.create-plan-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.error-message {
  background: rgba(255, 82, 82, 0.1);
  border: 1px solid rgba(255, 82, 82, 0.3);
  border-radius: 8px;
  padding: 12px;
  color: #ff5252;
  font-size: 13px;
  margin-bottom: 16px;
}

.current-plan {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  padding: 16px;
  margin-bottom: 16px;
}

.plan-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.plan-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
  color: #fff;
}

.plan-status {
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 12px;
  font-weight: 500;
}

.plan-status.planning { background: rgba(255, 193, 7, 0.2); color: #ffc107; }
.plan-status.executing { background: rgba(74, 158, 255, 0.2); color: #4a9eff; }
.plan-status.reviewing { background: rgba(156, 39, 176, 0.2); color: #ce93d8; }
.plan-status.completed { background: rgba(76, 175, 80, 0.2); color: #4caf50; }
.plan-status.failed { background: rgba(255, 82, 82, 0.2); color: #ff5252; }

.plan-summary {
  font-size: 13px;
  color: #a0a0a0;
  margin: 0 0 12px;
}

.progress-bar {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  height: 24px;
  position: relative;
  overflow: hidden;
  margin-bottom: 16px;
}

.progress-fill {
  background: linear-gradient(90deg, #4a9eff, #0066cc);
  height: 100%;
  border-radius: 6px;
  transition: width 0.3s ease;
}

.progress-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 11px;
  font-weight: 600;
  color: #fff;
}

.task-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.task-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.task-item.completed {
  border-color: rgba(76, 175, 80, 0.3);
}

.task-item.failed {
  border-color: rgba(255, 82, 82, 0.3);
}

.task-item.running {
  border-color: rgba(74, 158, 255, 0.3);
}

.task-icon {
  font-size: 20px;
}

.task-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.task-name {
  font-size: 13px;
  font-weight: 500;
  color: #e0e0e0;
}

.task-result {
  font-size: 11px;
  color: #4caf50;
}

.task-error {
  font-size: 11px;
  color: #ff5252;
}

.task-status-icon {
  font-size: 16px;
}

.plan-actions {
  display: flex;
  gap: 12px;
  margin-top: 16px;
}

.execute-btn {
  flex: 1;
  background: linear-gradient(135deg, #4caf50 0%, #2e7d32 100%);
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 12px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.execute-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.approve-btn {
  flex: 1;
  background: linear-gradient(135deg, #4caf50 0%, #2e7d32 100%);
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 10px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.retry-btn {
  flex: 1;
  background: rgba(255, 255, 255, 0.1);
  color: #e0e0e0;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  padding: 10px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.plan-history {
  margin-top: 16px;
}

.history-title {
  font-size: 14px;
  font-weight: 600;
  color: #a0a0a0;
  margin: 0 0 8px;
}

.history-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 6px;
  margin-bottom: 6px;
  cursor: pointer;
  transition: background 0.2s;
}

.history-item:hover {
  background: rgba(255, 255, 255, 0.06);
}

.history-goal {
  font-size: 13px;
  color: #e0e0e0;
}

.history-status {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
}

.knowledge-section {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.knowledge-title {
  font-size: 14px;
  font-weight: 600;
  color: #a0a0a0;
  margin: 0 0 8px;
}

.knowledge-stats {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.knowledge-stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
}

.stat-type {
  font-size: 11px;
  color: #a0a0a0;
}

.stat-count {
  font-size: 18px;
  font-weight: 700;
  color: #4a9eff;
}

.btn-spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
