<template>
  <div class="growth-dashboard">
    <!-- Header -->
    <div class="dashboard-header">
      <div class="header-left">
        <h1 class="header-title">🚀 增长目标仪表盘</h1>
        <p class="header-subtitle">监控和管理品牌增长目标的执行状态</p>
      </div>
      <div class="header-right">
        <button class="btn btn-primary" @click="showCreateGoal = true">
          + 新建目标
        </button>
        <button class="btn btn-outline" @click="refreshAll">
          🔄 刷新
        </button>
      </div>
    </div>

    <!-- Stats Cards -->
    <div class="stats-row">
      <div class="stat-card" style="border-left-color: #4f46e5">
        <div class="stat-value">{{ stats.totalGoals }}</div>
        <div class="stat-label">总目标数</div>
      </div>
      <div class="stat-card" style="border-left-color: #22c55e">
        <div class="stat-value">{{ stats.activeGoals }}</div>
        <div class="stat-label">活跃目标</div>
      </div>
      <div class="stat-card" style="border-left-color: #3b82f6">
        <div class="stat-value">{{ stats.completedGoals }}</div>
        <div class="stat-label">已完成</div>
      </div>
      <div class="stat-card" style="border-left-color: #f59e0b">
        <div class="stat-value">{{ stats.pendingTasks }}</div>
        <div class="stat-label">待执行任务</div>
      </div>
      <div class="stat-card" style="border-left-color: #ef4444">
        <div class="stat-value">{{ stats.failedTasks }}</div>
        <div class="stat-label">失败任务</div>
      </div>
      <div class="stat-card" style="border-left-color: #8b5cf6">
        <div class="stat-value">{{ stats.pendingReviews }}</div>
        <div class="stat-label">待审核</div>
      </div>
    </div>

    <!-- Goals Section -->
    <div class="section">
      <h2 class="section-title">📋 目标列表</h2>
      <div v-if="loading" class="loading-state">加载中...</div>
      <div v-else-if="goals.length === 0" class="empty-state">
        暂无目标，点击「新建目标」开始
      </div>
      <div v-else class="goal-list">
        <div
          v-for="goal in goals"
          :key="goal.id"
          class="goal-card"
          :class="'goal-' + goal.status"
          @click="$emit('selectGoal', goal.id)"
        >
          <div class="goal-header">
            <h3 class="goal-title">{{ goal.title }}</h3>
            <span class="goal-status-badge" :class="'badge-' + goal.status">
              {{ statusLabel(goal.status) }}
            </span>
          </div>
          <p v-if="goal.description" class="goal-desc">{{ goal.description }}</p>
          <div class="goal-meta">
            <span v-if="goal.targetMetric" class="goal-metric">
              🎯 {{ goal.targetMetric }}
            </span>
            <span class="goal-priority" :class="'priority-' + goal.priority">
              优先级: {{ goal.priority }}
            </span>
            <span v-if="goal.deadline" class="goal-deadline">
              ⏰ {{ formatDate(goal.deadline) }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Create Goal Modal -->
    <div v-if="showCreateGoal" class="modal-overlay" @click.self="showCreateGoal = false">
      <div class="modal-content">
        <div class="modal-header">
          <h2>新建增长目标</h2>
          <button class="modal-close" @click="showCreateGoal = false">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>目标标题 <span class="required">*</span></label>
            <input v-model="newGoal.title" class="form-input" placeholder="例如：让品牌三个月内成为 AI 视频领域 Top 3" />
          </div>
          <div class="form-group">
            <label>描述</label>
            <textarea v-model="newGoal.description" class="form-textarea" placeholder="详细描述这个目标..." rows="3"></textarea>
          </div>
          <div class="form-group">
            <label>成功标准 (JSON)</label>
            <textarea v-model="newGoal.successCriteria" class="form-textarea" placeholder='["visibility_score > 80", "citation_count > 100"]' rows="2"></textarea>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>目标指标</label>
              <input v-model="newGoal.targetMetric" class="form-input" placeholder="如: visibility_score > 80" />
            </div>
            <div class="form-group">
              <label>截止日期</label>
              <input v-model="newGoal.deadline" type="date" class="form-input" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>优先级</label>
              <select v-model="newGoal.priority" class="form-select">
                <option :value="1">1 - 最高</option>
                <option :value="2">2 - 高</option>
                <option :value="3" selected>3 - 中</option>
                <option :value="4">4 - 低</option>
                <option :value="5">5 - 最低</option>
              </select>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" @click="showCreateGoal = false">取消</button>
          <button class="btn btn-primary" @click="handleCreateGoal" :disabled="!newGoal.title">
            {{ creating ? '创建中...' : '创建并运行' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useGoalStore } from '~/modules/goal/store/useGoalStore'
import type { Goal } from '~/modules/goal/types/index'

const props = defineProps<{
  projectId: string
}>()

const emit = defineEmits<{
  selectGoal: [id: string]
}>()

const {
  goals, stats, loading,
  fetchGoals, createGoal, fetchStats, runPipeline,
} = useGoalStore()

const showCreateGoal = ref(false)
const creating = ref(false)

const newGoal = reactive({
  title: '',
  description: '',
  successCriteria: '',
  targetMetric: '',
  deadline: '',
  priority: 3,
})

async function refreshAll() {
  await Promise.all([
    fetchGoals({ projectId: props.projectId }),
    fetchStats(props.projectId),
  ])
}

async function handleCreateGoal() {
  if (!newGoal.title) return
  creating.value = true
  try {
    const result = await runPipeline(props.projectId, newGoal.title, {
      description: newGoal.description || undefined,
      successCriteria: newGoal.successCriteria || undefined,
      targetMetric: newGoal.targetMetric || undefined,
      deadline: newGoal.deadline || undefined,
      priority: newGoal.priority,
    })
    if (result) {
      showCreateGoal.value = false
      newGoal.title = ''
      newGoal.description = ''
      newGoal.successCriteria = ''
      newGoal.targetMetric = ''
      newGoal.deadline = ''
      newGoal.priority = 3
      await refreshAll()
    }
  } finally {
    creating.value = false
  }
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: '草稿',
    active: '进行中',
    paused: '已暂停',
    completed: '已完成',
    cancelled: '已取消',
  }
  return labels[status] || status
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('zh-CN')
  } catch {
    return dateStr
  }
}

onMounted(() => {
  refreshAll()
})
</script>

<style scoped>
.growth-dashboard {
  padding: 24px;
  color: #e0e0e0;
  min-height: 100%;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
}

.header-title {
  font-size: 24px;
  font-weight: 700;
  color: #fff;
  margin: 0;
}

.header-subtitle {
  color: #94a3b8;
  margin: 4px 0 0;
  font-size: 14px;
}

.header-right {
  display: flex;
  gap: 8px;
}

/* Stats */
.stats-row {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 12px;
  margin-bottom: 24px;
}

.stat-card {
  background: #1e293b;
  border-radius: 8px;
  padding: 16px;
  border-left: 3px solid;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: #fff;
}

.stat-label {
  font-size: 12px;
  color: #94a3b8;
  margin-top: 4px;
}

/* Section */
.section {
  margin-bottom: 24px;
}

.section-title {
  font-size: 18px;
  font-weight: 600;
  color: #fff;
  margin: 0 0 12px;
}

/* Goal Cards */
.goal-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.goal-card {
  background: #1e293b;
  border-radius: 8px;
  padding: 16px;
  cursor: pointer;
  transition: background 0.2s;
  border-left: 3px solid #334155;
}

.goal-card:hover {
  background: #293548;
}

.goal-card.goal-active {
  border-left-color: #22c55e;
}

.goal-card.goal-completed {
  border-left-color: #3b82f6;
}

.goal-card.goal-draft {
  border-left-color: #f59e0b;
}

.goal-card.goal-cancelled {
  border-left-color: #ef4444;
}

.goal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.goal-title {
  font-size: 16px;
  font-weight: 600;
  color: #fff;
  margin: 0;
}

.goal-status-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  background: #334155;
}

.badge-draft { background: #f59e0b20; color: #f59e0b; }
.badge-active { background: #22c55e20; color: #22c55e; }
.badge-completed { background: #3b82f620; color: #3b82f6; }
.badge-cancelled { background: #ef444420; color: #ef4444; }
.badge-paused { background: #94a3b820; color: #94a3b8; }

.goal-desc {
  color: #94a3b8;
  font-size: 13px;
  margin: 8px 0;
}

.goal-meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: #64748b;
}

/* Buttons */
.btn {
  padding: 8px 16px;
  border-radius: 6px;
  border: none;
  font-size: 13px;
  cursor: pointer;
  transition: opacity 0.2s;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: #4f46e5;
  color: #fff;
}

.btn-outline {
  background: transparent;
  border: 1px solid #334155;
  color: #e0e0e0;
}

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background: #1e293b;
  border-radius: 12px;
  width: 560px;
  max-width: 90vw;
  max-height: 80vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px 0;
}

.modal-header h2 {
  color: #fff;
  font-size: 18px;
  margin: 0;
}

.modal-close {
  background: none;
  border: none;
  color: #64748b;
  font-size: 18px;
  cursor: pointer;
}

.modal-body {
  padding: 20px 24px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px 24px;
  border-top: 1px solid #334155;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  font-size: 13px;
  color: #94a3b8;
  margin-bottom: 6px;
}

.required { color: #ef4444; }

.form-input,
.form-textarea,
.form-select {
  width: 100%;
  padding: 8px 12px;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 6px;
  color: #e0e0e0;
  font-size: 13px;
  box-sizing: border-box;
}

.form-textarea { resize: vertical; }

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.loading-state,
.empty-state {
  text-align: center;
  padding: 40px;
  color: #64748b;
}
</style>
