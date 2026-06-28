<template>
  <div class="goal-timeline">
    <!-- Header -->
    <div class="timeline-header">
      <div class="header-left">
        <h1 class="header-title">📈 目标 Timeline</h1>
        <p class="header-subtitle">完整追踪链路：Goal → Strategy → Workflow → Task → Execution → Review</p>
      </div>
      <div v-if="selectedGoal" class="header-right">
        <button class="btn btn-sm" @click="closeGoalView">← 返回列表</button>
      </div>
    </div>

    <!-- Goal Select (when no goal selected) -->
    <div v-if="!selectedGoal" class="goal-select-section">
      <div class="section-header">
        <h2 class="section-title">选择目标查看详情</h2>
        <div v-if="loading" class="loading-spinner"></div>
      </div>
      <div v-if="goals.length === 0" class="empty-state">
        暂无目标数据
      </div>
      <div v-else class="goal-list">
        <div
          v-for="goal in goals"
          :key="goal.id"
          class="goal-item"
          @click="loadGoalTimeline(goal)"
        >
          <div class="goal-status-dot" :class="'dot-' + goal.status"></div>
          <div class="goal-item-body">
            <div class="goal-item-title">{{ goal.title }}</div>
            <div class="goal-item-meta">
              <span class="meta-badge" :class="'badge-' + goal.status">{{ statusLabel(goal.status) }}</span>
              <span v-if="goal.targetMetric" class="meta-text">🎯 {{ goal.targetMetric }}</span>
              <span v-if="goal.deadline" class="meta-text">⏰ {{ formatDate(goal.deadline) }}</span>
            </div>
          </div>
          <div class="goal-arrow">→</div>
        </div>
      </div>
    </div>

    <!-- Timeline Detail View -->
    <div v-else class="timeline-detail">
      <!-- Goal Header -->
      <div class="goal-detail-header">
        <div class="goal-detail-title">
          <span class="goal-detail-icon">🎯</span>
          <div>
            <h2>{{ selectedGoal.title }}</h2>
            <p v-if="selectedGoal.description">{{ selectedGoal.description }}</p>
            <div class="goal-detail-meta">
              <span class="meta-badge" :class="'badge-' + selectedGoal.status">{{ statusLabel(selectedGoal.status) }}</span>
              <span v-if="selectedGoal.targetMetric">目标: {{ selectedGoal.targetMetric }}</span>
              <span v-if="selectedGoal.successCriteria">标准: {{ selectedGoal.successCriteria }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Timeline -->
      <div class="timeline-container">
        <!-- Strategies -->
        <div v-for="strategy in strategies" :key="strategy.id" class="timeline-block">
          <div class="timeline-node strategy-node">
            <div class="node-icon">📋</div>
            <div class="node-content">
              <div class="node-header">
                <strong>{{ strategy.name }}</strong>
                <span class="meta-badge" :class="'badge-' + strategy.status">{{ statusLabel(strategy.status) }}</span>
              </div>
              <p v-if="strategy.description" class="node-desc">{{ strategy.description }}</p>
              <div class="node-type">{{ strategy.type }}</div>
            </div>
          </div>

          <!-- Workflows under strategy -->
          <div class="timeline-children">
            <div v-for="workflow in getWorkflows(strategy.id)" :key="workflow.id" class="timeline-block">
              <div class="timeline-node workflow-node">
                <div class="node-icon">📄</div>
                <div class="node-content">
                  <div class="node-header">
                    <strong>{{ workflow.name }}</strong>
                    <span class="meta-badge" :class="'badge-' + workflow.status">{{ statusLabel(workflow.status) }}</span>
                  </div>
                  <p v-if="workflow.description" class="node-desc">{{ workflow.description }}</p>
                </div>
              </div>

              <!-- Stages -->
              <div class="timeline-children stages-grid">
                <div v-for="stage in getStages(workflow.id)" :key="stage.id" class="stage-card">
                  <div class="stage-header">
                    <span class="stage-order">{{ stage.order }}</span>
                    <span class="stage-name">{{ stage.name }}</span>
                    <span class="stage-status" :class="'stage-' + stage.status">{{ stage.status }}</span>
                  </div>

                  <!-- Tasks in stage -->
                  <div v-if="getTasks(strategy.id, workflow.id, stage.id).length" class="task-list">
                    <div
                      v-for="task in getTasks(strategy.id, workflow.id, stage.id)"
                      :key="task.id"
                      class="task-item"
                      :class="'task-' + task.status"
                      @click="toggleTaskDetail(task.id)"
                    >
                      <div class="task-header">
                        <span class="task-action">{{ task.actionType }}</span>
                        <span class="task-title">{{ task.title }}</span>
                        <span class="task-status-badge" :class="'badge-' + task.status">{{ task.status }}</span>
                      </div>

                      <!-- Task Detail (expandable) -->
                      <div v-if="expandedTask === task.id" class="task-detail">
                        <!-- Executions -->
                        <div v-if="getExecutions(task.id).length" class="execution-list">
                          <div
                            v-for="exec in getExecutions(task.id)"
                            :key="exec.id"
                            class="execution-item"
                          >
                            <div class="exec-header">
                              <span class="exec-status" :class="'exec-' + exec.status">
                                {{ exec.status === 'completed' ? '✅' : exec.status === 'failed' ? '❌' : '🔄' }}
                              </span>
                              <span class="exec-action">{{ exec.actionType }}</span>
                              <span v-if="exec.durationMs" class="exec-duration">{{ exec.durationMs }}ms</span>
                              <span v-if="exec.error" class="exec-error">⚠ {{ exec.error }}</span>
                            </div>
                            <div v-if="exec.output" class="exec-output">
                              <pre>{{ formatJson(exec.output) }}</pre>
                            </div>

                            <!-- Reviews -->
                            <div v-if="getReviews(exec.id).length" class="review-list">
                              <div
                                v-for="review in getReviews(exec.id)"
                                :key="review.id"
                                class="review-item"
                                :class="'review-' + review.status"
                              >
                                <span>
                                  {{ review.status === 'approved' ? '✅ 已批准' : review.status === 'rejected' ? '❌ 已拒绝' : '⏳ 待审核' }}
                                </span>
                                <span v-if="review.score != null" class="review-score">{{ review.score }}/10</span>
                                <span v-if="review.comments" class="review-comments">{{ review.comments }}</span>
                              </div>
                            </div>
                            <div v-else class="review-empty">暂无审核记录</div>
                          </div>
                        </div>
                        <div v-else class="exec-empty">暂无执行记录</div>
                      </div>
                    </div>
                  </div>
                  <div v-else class="no-tasks">暂无任务</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useGoalStore } from '~/modules/goal/store/useGoalStore'
import { goalService } from '~/modules/goal/services/goal.service'
import type { Goal, Strategy, Workflow, WorkflowStage, Task, Execution, Review } from '~/modules/goal/types/index'

const {
  goals, loading, fetchGoals,
} = useGoalStore()

const selectedGoal = ref<Goal | null>(null)
const strategies = ref<Strategy[]>([])
const workflows = ref<Workflow[]>([])
const stages = ref<WorkflowStage[]>([])
const tasks = ref<Task[]>([])
const executions = ref<Execution[]>([])
const reviews = ref<Review[]>([])
const expandedTask = ref<string | null>(null)

function getWorkflows(strategyId: string): Workflow[] {
  return workflows.value.filter(w => w.strategyId === strategyId)
}

function getStages(workflowId: string): WorkflowStage[] {
  return stages.value.filter(s => s.workflowId === workflowId)
}

function getTasks(strategyId: string, workflowId: string, stageId: string): Task[] {
  return tasks.value.filter(t => t.strategyId === strategyId && t.workflowId === workflowId && t.stageId === stageId)
}

function getExecutions(taskId: string): Execution[] {
  return executions.value.filter(e => e.taskId === taskId)
}

function getReviews(executionId: string): Review[] {
  return reviews.value.filter(r => r.executionId === executionId)
}

async function loadGoalTimeline(goal: Goal) {
  selectedGoal.value = goal
  expandedTask.value = null

  // Load strategies
  const stratResult = await goalService.listStrategies(goal.id)
  strategies.value = stratResult.items

  // Load workflows and stages
  workflows.value = []
  stages.value = []
  for (const s of strategies.value) {
    const wfs = await goalService.listWorkflows(s.id)
    for (const wf of wfs) {
      const detail = await goalService.getWorkflow(wf.id)
      if (detail) {
        workflows.value.push({ ...wf, stages: detail.stages })
        stages.value.push(...detail.stages)
      }
    }
  }

  // Load tasks
  const taskResult = await goalService.listTasks({ goalId: goal.id })
  tasks.value = taskResult.items

  // Load executions for all tasks
  executions.value = []
  for (const task of tasks.value) {
    const execResult = await goalService.listExecutions(task.id)
    executions.value.push(...execResult.items)
  }

  // Load reviews
  reviews.value = []
  for (const exec of executions.value) {
    const revs = await goalService.listReviews(exec.id)
    reviews.value.push(...revs)
  }
}

function closeGoalView() {
  selectedGoal.value = null
  strategies.value = []
  workflows.value = []
  stages.value = []
  tasks.value = []
  executions.value = []
  reviews.value = []
}

function toggleTaskDetail(taskId: string) {
  expandedTask.value = expandedTask.value === taskId ? null : taskId
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: '草稿', active: '进行中', completed: '已完成',
    cancelled: '已取消', paused: '已暂停', pending: '待处理',
    ready: '就绪', running: '运行中', failed: '失败',
  }
  return labels[status] || status
}

function formatDate(dateStr: string): string {
  try { return new Date(dateStr).toLocaleDateString('zh-CN') }
  catch { return dateStr }
}

function formatJson(str: string): string {
  try { return JSON.stringify(JSON.parse(str), null, 2) }
  catch { return str }
}

onMounted(() => {
  // Initial load handled by parent providing projectId
})
</script>

<style scoped>
.goal-timeline {
  padding: 24px;
  color: #e0e0e0;
  min-height: 100%;
}

.timeline-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
}

.header-title { font-size: 24px; font-weight: 700; color: #fff; margin: 0; }
.header-subtitle { color: #94a3b8; margin: 4px 0 0; font-size: 14px; }
.header-right { display: flex; gap: 8px; }

.btn-sm {
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid #334155;
  background: transparent;
  color: #e0e0e0;
  cursor: pointer;
  font-size: 12px;
}

/* Goal List */
.goal-list { display: flex; flex-direction: column; gap: 6px; }

.goal-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: #1e293b;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
}

.goal-item:hover { background: #293548; }

.goal-status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.dot-draft { background: #f59e0b; }
.dot-active { background: #22c55e; }
.dot-completed { background: #3b82f6; }
.dot-cancelled { background: #ef4444; }

.goal-item-body { flex: 1; }
.goal-item-title { font-weight: 600; color: #fff; margin-bottom: 4px; }
.goal-item-meta { display: flex; gap: 8px; align-items: center; }

.goal-arrow { color: #475569; font-size: 18px; }

/* Detail Header */
.goal-detail-header {
  background: #1e293b;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 24px;
}

.goal-detail-title { display: flex; gap: 12px; }
.goal-detail-icon { font-size: 28px; }
.goal-detail-title h2 { color: #fff; margin: 0; font-size: 20px; }
.goal-detail-title p { color: #94a3b8; margin: 4px 0; font-size: 13px; }
.goal-detail-meta { display: flex; gap: 12px; margin-top: 8px; font-size: 12px; color: #64748b; }

/* Timeline */
.timeline-container {
  position: relative;
  padding-left: 24px;
  border-left: 2px solid #334155;
}

.timeline-block { margin-bottom: 16px; }

.timeline-node {
  display: flex;
  gap: 12px;
  padding: 12px 16px;
  background: #1e293b;
  border-radius: 8px;
  margin-bottom: 8px;
}

.node-icon { font-size: 20px; flex-shrink: 0; }
.node-content { flex: 1; }
.node-header { display: flex; justify-content: space-between; align-items: center; }
.node-header strong { color: #fff; }
.node-desc { color: #94a3b8; font-size: 12px; margin: 4px 0; }
.node-type { font-size: 11px; color: #64748b; }

.timeline-children {
  padding-left: 32px;
  border-left: 1px dashed #334155;
  margin-left: 10px;
}

/* Stages Grid */
.stages-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 8px;
}

.stage-card {
  background: #1e293b;
  border-radius: 8px;
  padding: 12px;
}

.stage-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.stage-order {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #334155;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 600;
  color: #fff;
  flex-shrink: 0;
}

.stage-name { font-size: 13px; color: #e0e0e0; flex: 1; }
.stage-status { font-size: 10px; padding: 1px 6px; border-radius: 4px; background: #334155; }

/* Tasks */
.task-list { display: flex; flex-direction: column; gap: 4px; }

.task-item {
  background: #0f172a;
  border-radius: 6px;
  padding: 8px 10px;
  cursor: pointer;
  transition: background 0.15s;
  border-left: 2px solid #334155;
}

.task-item:hover { background: #1a2332; }
.task-item.task-completed { border-left-color: #22c55e; }
.task-item.task-failed { border-left-color: #ef4444; }
.task-item.task-running { border-left-color: #3b82f6; }

.task-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.task-action {
  background: #334155;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-family: monospace;
}

.task-title { flex: 1; color: #cbd5e1; }

.task-status-badge { font-size: 10px; padding: 1px 6px; border-radius: 4px; }

.task-detail { margin-top: 8px; padding-top: 8px; border-top: 1px solid #334155; }

/* Executions */
.execution-list { display: flex; flex-direction: column; gap: 4px; }
.execution-item {
  background: #0f172a;
  border-radius: 4px;
  padding: 6px 8px;
}
.exec-header { display: flex; gap: 6px; font-size: 11px; align-items: center; flex-wrap: wrap; }
.exec-output { margin-top: 4px; }
.exec-output pre { font-size: 10px; color: #64748b; white-space: pre-wrap; }

/* Reviews */
.review-list { margin-top: 4px; }
.review-item {
  font-size: 11px;
  padding: 4px 6px;
  border-radius: 4px;
  display: flex;
  gap: 8px;
}

.review-approved { background: #22c55e10; }
.review-rejected { background: #ef444410; }
.review-pending { background: #f59e0b10; }

.badge-draft { background: #f59e0b20; color: #f59e0b; font-size: 10px; padding: 1px 6px; border-radius: 4px; }
.badge-active { background: #22c55e20; color: #22c55e; font-size: 10px; padding: 1px 6px; border-radius: 4px; }
.badge-completed { background: #3b82f620; color: #3b82f6; font-size: 10px; padding: 1px 6px; border-radius: 4px; }
.badge-cancelled { background: #ef444420; color: #ef4444; font-size: 10px; padding: 1px 6px; border-radius: 4px; }

.section-title { font-size: 18px; font-weight: 600; color: #fff; margin: 0 0 12px; }
.loading-spinner { width: 20px; height: 20px; border: 2px solid #334155; border-top-color: #4f46e5; border-radius: 50%; animation: spin 0.6s linear infinite; }

@keyframes spin { to { transform: rotate(360deg); } }

.empty-state { text-align: center; padding: 40px; color: #64748b; }
.section-header { display: flex; justify-content: space-between; align-items: center; }
.no-tasks { font-size: 11px; color: #475569; padding: 4px 0; }
.exec-empty, .review-empty { font-size: 11px; color: #475569; }
</style>
