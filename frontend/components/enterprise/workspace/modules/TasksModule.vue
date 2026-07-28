<!-- TasksModule — 任务创建与执行追踪 -->
<!-- BETA-06.2 P0: First Working Agent Loop -->
<template>
  <div class="tasks-module">
    <!-- Header: Tab 切换 -->
    <div class="tasks-header">
      <h2 class="module-title">任务管理</h2>
      <div class="tab-group">
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'create' }"
          @click="activeTab = 'create'"
        >
          ➕ 创建任务
        </button>
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'list' }"
          @click="activeTab = 'list'"
        >
          📋 任务列表
        </button>
      </div>
    </div>

    <!-- Tab: 创建任务 -->
    <div v-if="activeTab === 'create'" class="tab-content">
      <div class="create-form-card">
        <h3 class="form-title">创建新任务</h3>
        <p class="form-subtitle">向 AI 员工下达指令，实时查看执行进度和结果</p>

        <form @submit.prevent="handleCreateTask" class="task-form">
          <!-- 任务标题 -->
          <div class="form-group">
            <label>任务标题 <span class="required">*</span></label>
            <input
              v-model="form.title"
              type="text"
              placeholder="例：分析 AI SaaS 市场竞争趋势"
              class="form-input"
              maxlength="100"
              required
            />
          </div>

          <!-- 任务描述 -->
          <div class="form-group">
            <label>任务描述 <span class="required">*</span></label>
            <textarea
              v-model="form.instruction"
              placeholder="详细描述任务要求、期望输出格式等"
              class="form-input form-textarea"
              maxlength="2000"
              rows="5"
              required
            ></textarea>
            <span class="form-hint">{{ form.instruction.length }}/2000</span>
          </div>

          <!-- 选择 AI 员工 -->
          <div class="form-group">
            <label>选择 AI 员工 <span class="required">*</span></label>
            <div class="agent-selector">
              <div
                v-for="agent in availableAgents"
                :key="agent.id"
                class="agent-option"
                :class="{ selected: form.agentId === agent.id, disabled: agent.runtimeStatus !== 'active' }"
                @click="agent.runtimeStatus === 'active' && (form.agentId = agent.id)"
              >
                <div class="agent-avatar">{{ agent.name?.charAt(0) || '🤖' }}</div>
                <div class="agent-details">
                  <span class="agent-name">{{ agent.name }}</span>
                  <span class="agent-role">{{ agent.role }}</span>
                </div>
                <span v-if="agent.runtimeStatus === 'active'" class="status-dot active">●</span>
                <span v-else class="status-dot inactive">●</span>
              </div>
            </div>
            <span v-if="availableAgents.length === 0" class="form-hint warn">
              暂无可用 AI 员工，请先创建并激活 AI 员工
            </span>
          </div>

          <!-- 优先级 -->
          <div class="form-group">
            <label>优先级</label>
            <div class="priority-group">
              <label
                v-for="p in priorities"
                :key="p.value"
                class="priority-option"
                :class="{ selected: form.priority === p.value }"
              >
                <input
                  type="radio"
                  :value="p.value"
                  v-model="form.priority"
                  class="priority-radio"
                />
                <span class="priority-label">{{ p.label }}</span>
              </label>
            </div>
          </div>

          <p v-if="error" class="form-error">{{ error }}</p>

          <button
            type="submit"
            class="btn btn-primary btn-full"
            :disabled="loading || !form.title || !form.instruction || !form.agentId"
          >
            {{ loading ? '执行中...' : '🚀 提交并执行' }}
          </button>
        </form>
      </div>
    </div>

    <!-- Tab: 任务列表 -->
    <div v-else class="tab-content">
      <div v-if="tasks.length === 0" class="empty-state">
        <div class="empty-icon">📋</div>
        <h3>暂无任务</h3>
        <p>创建第一个任务，让 AI 员工开始工作</p>
        <button class="btn btn-primary" @click="activeTab = 'create'">➕ 创建任务</button>
      </div>

      <div v-else class="task-list">
        <div
          v-for="task in tasks"
          :key="task.id"
          class="task-card"
          @click="selectedTaskId = selectedTaskId === task.id ? null : task.id; if (selectedTaskId && !timelineEvents[task.id]) loadTimeline(task.id)"
        >
          <div class="task-card-header">
            <span class="task-status" :class="`status-${task.status}`">
              {{ statusLabel(task.status) }}
            </span>
            <span class="task-time">{{ formatTime(task.startedAt) }}</span>
          </div>
          <h4 class="task-title">{{ task.inputSummary || '任务' }}</h4>
          <div class="task-meta">
            <span class="meta-item">🤖 {{ task.agentName || 'AI' }}</span>
            <span class="meta-item">🧠 {{ task.tokenInput + task.tokenOutput }} tokens</span>
            <span class="meta-item">💰 ¥{{ task.cost.toFixed(6) }}</span>
            <span class="meta-item">⏱ {{ task.durationMs }}ms</span>
          </div>

          <!-- 执行时间线 -->
          <div v-if="selectedTaskId === task.id" class="task-timeline">
            <div v-if="!timelineEvents[task.id]" class="timeline-loading">
              <span class="timeline-dot"></span>
              <span class="timeline-text">加载执行时间线...</span>
            </div>
            <div v-for="(event, idx) in (timelineEvents[task.id] || [])" :key="event.id" class="timeline-item">
              <span class="timeline-dot" :class="{ success: event.action === 'outcome.generated' }"></span>
              <span class="timeline-text">{{ timelineActionLabel(event.action) }}</span>
              <span class="timeline-time">{{ formatTimestamp(event.timestamp) }}</span>
            </div>
            <div v-if="timelineEvents[task.id] && timelineEvents[task.id].length === 0" class="timeline-empty">
              暂无执行记录
            </div>
          </div>

          <!-- 输出摘要 -->
          <div v-if="task.outputSummary && selectedTaskId === task.id" class="task-output">
            <h5>执行结果：</h5>
            <pre>{{ task.outputSummary }}</pre>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { getAuthToken } from '~/utils/auth/token'
import { ref, reactive, onMounted } from 'vue'

const activeTab = ref('create')
const loading = ref(false)
const error = ref('')
const tasks = ref<any[]>([])
const availableAgents = ref<any[]>([])
const selectedTaskId = ref<string | null>(null)
const timelineEvents = ref<Record<string, any[]>>({})

const form = reactive({
  title: '',
  instruction: '',
  agentId: '',
  priority: 'medium',
})

const priorities = [
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' },
  { value: 'urgent', label: '紧急' },
]

function statusLabel(status: string) {
  const map: Record<string, string> = {
    pending: '待执行',
    running: '执行中',
    completed: '已完成',
    failed: '失败',
  }
  return map[status] || status
}

function formatTime(ts: string) {
  if (!ts) return ''
  const d = new Date(ts)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

function formatTimestamp(ts: string) {
  if (!ts) return ''
  const d = new Date(ts)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`
}

function timelineActionLabel(action: string) {
  const labels: Record<string, string> = {
    'task.created': '创建任务',
    'agent.assigned': 'AI 员工接收任务',
    'runtime.started': 'Runtime 启动',
    'llm.request_sent': '调用 LLM',
    'llm.response_received': 'LLM 返回结果',
    'execution.completed': '执行完成',
    'task_executed': '任务执行完毕',
    'outcome.generated': '产生 Business Insight',
  }
  return labels[action] || action
}

async function loadAgents() {
  try {
    const token = getAuthToken() || ''
    const res = await fetch('/api/enterprise/agent-profiles', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    const json = await res.json()
    if (json.code === 0 && json.data) {
      availableAgents.value = json.data
    }
  } catch (e) {
    console.error('Failed to load agents:', e)
  }
}

async function loadTasks() {
  try {
    const token = getAuthToken() || ''
    const res = await fetch('/api/enterprise/agent-tasks', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    const json = await res.json()
    if (json.code === 0 && json.data) {
      tasks.value = json.data
    }
  } catch (e) {
    console.error('Failed to load tasks:', e)
  }
}

async function loadTimeline(taskId: string) {
  try {
    const token = getAuthToken() || ''
    const res = await fetch(`/api/enterprise/agent-tasks/${taskId}/timeline`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    const json = await res.json()
    if (json.code === 0 && json.data) {
      timelineEvents.value[taskId] = json.data
    }
  } catch (e) {
    console.error('Failed to load timeline:', e)
  }
}

async function handleCreateTask() {
  if (!form.title || !form.instruction || !form.agentId) {
    error.value = '请填写所有必填字段'
    return
  }

  loading.value = true
  error.value = ''

  try {
    const token = getAuthToken() || ''
    const res = await fetch('/api/enterprise/agent-tasks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        agentId: form.agentId,
        instruction: form.instruction,
        taskType: 'general',
        priority: form.priority,
      }),
    })

    const json = await res.json()
    if (json.success && json.data) {
      // Reset form
      form.title = ''
      form.instruction = ''
      form.agentId = ''
      form.priority = 'medium'
      // Switch to list tab
      activeTab.value = 'list'
      // Reload tasks
      await loadTasks()
      // Auto-select the new task
      selectedTaskId.value = json.data.id
    } else {
      error.value = json.message || '创建失败，请重试'
    }
  } catch (e: any) {
    error.value = '网络错误，请重试'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadAgents()
  loadTasks()
})
</script>

<style scoped>
.tasks-module {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.tasks-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-md);
}

.module-title {
  font-size: var(--font-size-xl);
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0;
}

.tab-group {
  display: flex;
  gap: var(--space-xs);
  background: var(--color-bg-secondary);
  border-radius: var(--radius-lg);
  padding: 4px;
}

.tab-btn {
  padding: var(--space-sm) var(--space-md);
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.tab-btn.active {
  background: var(--color-intelligence);
  color: #000;
}

.tab-btn:hover:not(.active) {
  color: var(--color-text-primary);
  background: var(--color-bg-hover);
}

.tab-content {
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

.create-form-card {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-xl);
  padding: var(--space-xl);
  max-width: 720px;
}

.form-title {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0 0 var(--space-xs);
}

.form-subtitle {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  margin: 0 0 var(--space-xl);
}

.task-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.form-group label {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-text-secondary);
}

.required {
  color: #ef4444;
}

.form-input {
  padding: 10px 14px;
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-md);
  color: var(--color-text-primary);
  font-size: var(--font-size-sm);
  outline: none;
  transition: border-color 0.2s;
  font-family: inherit;
}

.form-input:focus {
  border-color: var(--color-intelligence);
}

.form-textarea {
  resize: vertical;
  min-height: 100px;
}

.form-hint {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.form-hint.warn {
  color: #fbbf24;
}

.agent-selector {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.agent-option {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-md);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s;
}

.agent-option:hover:not(.disabled) {
  border-color: var(--color-intelligence);
  background: var(--color-bg-hover);
}

.agent-option.selected {
  border-color: var(--color-intelligence);
  background: rgba(201, 168, 108, 0.08);
}

.agent-option.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.agent-avatar {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
  background: var(--color-intelligence);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-md);
  font-weight: 700;
  color: #000;
  flex-shrink: 0;
}

.agent-details {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
}

.agent-name {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-text-primary);
}

.agent-role {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.status-dot {
  font-size: 12px;
}

.status-dot.active {
  color: #10b981;
}

.status-dot.inactive {
  color: var(--color-text-muted);
}

.priority-group {
  display: flex;
  gap: var(--space-sm);
}

.priority-option {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s;
}

.priority-option:hover {
  border-color: var(--color-intelligence);
}

.priority-option.selected {
  border-color: var(--color-intelligence);
  background: rgba(201, 168, 108, 0.08);
}

.priority-radio {
  display: none;
}

.priority-label {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.form-error {
  font-size: var(--font-size-sm);
  color: #ef4444;
  margin: 0;
  text-align: center;
}

.btn {
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: all 0.2s;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 12px 24px;
  font-family: inherit;
}

.btn-primary {
  background: var(--color-intelligence);
  color: #000;
  font-weight: 600;
}

.btn-primary:hover {
  box-shadow: 0 4px 16px rgba(201, 168, 108, 0.25);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-full {
  width: 100%;
}

/* Task list */
.empty-state {
  text-align: center;
  padding: var(--space-xl) * 2;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-xl);
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: var(--space-md);
}

.empty-state h3 {
  font-size: var(--font-size-lg);
  color: var(--color-text-primary);
  margin: 0 0 var(--space-sm);
}

.empty-state p {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  margin: 0 0 var(--space-lg);
}

.task-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.task-card {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-xl);
  padding: var(--space-lg);
  cursor: pointer;
  transition: all 0.2s;
}

.task-card:hover {
  border-color: var(--color-intelligence);
}

.task-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-sm);
}

.task-status {
  font-size: var(--font-size-xs);
  padding: 2px 10px;
  border-radius: var(--radius-full);
  font-weight: 500;
}

.status-completed {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
}

.status-running {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
}

.status-pending {
  background: rgba(251, 191, 36, 0.1);
  color: #fbbf24;
}

.status-failed {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.task-time {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.task-title {
  font-size: var(--font-size-md);
  font-weight: 500;
  color: var(--color-text-primary);
  margin: 0 0 var(--space-md);
}

.task-meta {
  display: flex;
  gap: var(--space-md);
  flex-wrap: wrap;
}

.meta-item {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

/* Timeline */
.task-timeline {
  margin-top: var(--space-md);
  padding-top: var(--space-md);
  border-top: 1px solid var(--color-border-primary);
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.timeline-item {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.timeline-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-border-primary);
  flex-shrink: 0;
}

.timeline-dot.success {
  background: #10b981;
}

.timeline-text {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  flex: 1;
}

.timeline-time {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.timeline-loading {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
}

.timeline-empty {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
}

.task-output {
  margin-top: var(--space-md);
  padding-top: var(--space-md);
  border-top: 1px solid var(--color-border-primary);
}

.task-output h5 {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-text-primary);
  margin: 0 0 var(--space-sm);
}

.task-output pre {
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-md);
  padding: var(--space-md);
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 300px;
  overflow-y: auto;
  margin: 0;
  font-family: inherit;
}

@media (max-width: 768px) {
  .tasks-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .priority-group {
    flex-wrap: wrap;
  }

  .task-meta {
    gap: var(--space-sm);
  }
}
</style>
