<!-- @deprecated 未被任何页面引用，保留作参考 -->
<template>
  <div class="execution-panel">
    <!-- ===== Summary Stats ===== -->
    <div class="execution-panel__summary">
      <div class="execution-panel__stat">
        <span class="execution-panel__stat-value">{{ summaryData.total }}</span>
        <span class="execution-panel__stat-label">全部</span>
      </div>
      <div class="execution-panel__stat execution-panel__stat--pending">
        <span class="execution-panel__stat-value">{{ summaryData.pending }}</span>
        <span class="execution-panel__stat-label">队列中</span>
      </div>
      <div class="execution-panel__stat execution-panel__stat--running">
        <span class="execution-panel__stat-value">{{ summaryData.running }}</span>
        <span class="execution-panel__stat-label">运行中</span>
      </div>
      <div class="execution-panel__stat execution-panel__stat--completed">
        <span class="execution-panel__stat-value">{{ summaryData.completed }}</span>
        <span class="execution-panel__stat-label">已完成</span>
      </div>
      <div class="execution-panel__stat execution-panel__stat--failed">
        <span class="execution-panel__stat-value">{{ summaryData.failed }}</span>
        <span class="execution-panel__stat-label">失败</span>
      </div>
      <div class="execution-panel__stat execution-panel__stat--cancelled">
        <span class="execution-panel__stat-value">{{ summaryData.cancelled }}</span>
        <span class="execution-panel__stat-label">已取消</span>
      </div>
    </div>

    <!-- ===== Action Bar ===== -->
    <div class="execution-panel__actions">
      <div class="execution-panel__filters">
        <button
          v-for="tab in statusTabs"
          :key="tab.key"
          class="execution-panel__filter-btn"
          :class="{ 'execution-panel__filter-btn--active': activeTab === tab.key }"
          @click="activeTab = tab.key; loadExecutions()"
        >
          {{ tab.label }}
        </button>
      </div>
      <button class="execution-panel__create-btn" @click="showCreateModal = true">
        ➕ 新建执行
      </button>
    </div>

    <!-- ===== Loading State ===== -->
    <div v-if="loading && !executions.length" class="execution-panel__loading">
      <div class="execution-panel__spinner" />
      <span>正在加载执行任务...</span>
    </div>

    <!-- ===== Error State ===== -->
    <div v-else-if="loadError && !executions.length" class="execution-panel__error">
      <p>加载失败：{{ loadError }}</p>
      <button class="execution-panel__retry-btn" @click="loadExecutions">重试</button>
    </div>

    <!-- ===== Empty State ===== -->
    <div v-else-if="!executions.length" class="execution-panel__empty">
      <div class="execution-panel__empty-icon">📋</div>
      <h3>暂无执行任务</h3>
      <p>点击「新建执行」创建优化执行任务。</p>
    </div>

    <!-- ===== Execution List ===== -->
    <div v-else class="execution-panel__list">
      <div
        v-for="exec in executions"
        :key="exec.id"
        class="execution-panel__card"
      >
        <div class="execution-panel__card-left">
          <div class="execution-panel__card-header">
            <span
              class="execution-panel__card-type"
            >
              {{ getOptimizationLabel(exec.optimizationType) }}
            </span>
            <span
              class="execution-panel__card-status"
              :class="`execution-panel__card-status--${exec.executionStatus}`"
            >
              {{ statusLabel(exec.executionStatus) }}
            </span>
          </div>
          <div class="execution-panel__card-meta">
            <span>触发方式：{{ exec.triggerSource === 'manual' ? '手动' : exec.triggerSource }}</span>
            <span>开始时间：{{ formatTime(exec.startedAt) }}</span>
            <span v-if="exec.completedAt">完成时间：{{ formatTime(exec.completedAt) }}</span>
          </div>
          <div v-if="exec.beforeScore != null" class="execution-panel__card-scores">
            <span>分数变化：{{ exec.beforeScore?.toFixed(1) }} → {{ exec.afterScore?.toFixed(1) || '—' }}</span>
            <span v-if="exec.scoreDelta != null" :class="exec.scoreDelta >= 0 ? 'score-up' : 'score-down'">
              {{ exec.scoreDelta >= 0 ? '+' : '' }}{{ exec.scoreDelta.toFixed(1) }}
            </span>
          </div>
        </div>
        <div class="execution-panel__card-actions">
          <!-- Running: show cancel -->
          <button
            v-if="exec.executionStatus === 'running' || exec.executionStatus === 'pending'"
            class="execution-panel__action-btn execution-panel__action-btn--cancel"
            title="取消"
            @click="cancelExecution(exec.id)"
          >
            ✕ 取消
          </button>
          <!-- Failed: show retry -->
          <button
            v-if="exec.executionStatus === 'failed'"
            class="execution-panel__action-btn execution-panel__action-btn--retry"
            title="重试"
            @click="retryExecution(exec.id)"
          >
            ↻ 重试
          </button>
          <!-- Completed: show detail toggle -->
          <button
            v-if="exec.executionStatus === 'completed'"
            class="execution-panel__action-btn execution-panel__action-btn--view"
            @click="toggleDetail(exec.id)"
          >
            {{ expandedId === exec.id ? '收起' : '详情' }}
          </button>
        </div>
      </div>
    </div>

    <!-- ===== Create Modal ===== -->
    <div v-if="showCreateModal" class="execution-panel__modal-overlay" @click.self="showCreateModal = false">
      <div class="execution-panel__modal">
        <h3>新建执行任务</h3>
        <div class="execution-panel__modal-field">
          <label>优化类型</label>
          <select v-model="newExecution.optimizationType">
            <option value="content_optimization">内容优化</option>
            <option value="structured_data">结构化数据</option>
            <option value="entity_enrichment">实体丰富</option>
            <option value="faq_generation">FAQ 生成</option>
            <option value="citation_building">引用构建</option>
            <option value="full_optimization">完整优化</option>
          </select>
        </div>
        <div class="execution-panel__modal-field">
          <label>行业</label>
          <input v-model="newExecution.industry" placeholder="如：technology" />
        </div>
        <div class="execution-panel__modal-field">
          <label>品牌类型</label>
          <input v-model="newExecution.brandType" placeholder="如：enterprise" />
        </div>
        <div class="execution-panel__modal-btns">
          <button class="execution-panel__modal-btn" @click="showCreateModal = false">取消</button>
          <button
            class="execution-panel__modal-btn execution-panel__modal-btn--primary"
            :disabled="creating"
            @click="createExecution"
          >
            {{ creating ? '创建中...' : '创建执行' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { geoApi } from '../services/api'

const props = defineProps<{
  projectId: string
}>()

const emit = defineEmits<{
  (e: 'data-loaded', data?: any): void
}>()

// ── State ──

const executions = ref<any[]>([])
const loading = ref(false)
const loadError = ref<string | null>(null)
const activeTab = ref<string>('all')
const expandedId = ref<string | null>(null)
const showCreateModal = ref(false)
const creating = ref(false)

const summaryData = reactive({
  total: 0,
  pending: 0,
  running: 0,
  completed: 0,
  failed: 0,
  cancelled: 0,
})

const newExecution = reactive({
  optimizationType: 'full_optimization',
  industry: '',
  brandType: '',
})

const statusTabs = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '队列中' },
  { key: 'running', label: '运行中' },
  { key: 'completed', label: '已完成' },
  { key: 'failed', label: '失败' },
  { key: 'cancelled', label: '已取消' },
]

// ── Lifecycle ──

onMounted(() => {
  loadSummary()
  loadExecutions()
})

// ── Methods ──

async function loadSummary() {
  try {
    const res = await geoApi(`/executions/project/${props.projectId}/summary`)
    if (res.success && res.data) {
      Object.assign(summaryData, res.data)
    }
  } catch (err: any) {
    console.warn('[ExecutionPanel] Failed to load summary:', err)
  }
}

async function loadExecutions() {
  loading.value = true
  loadError.value = null

  try {
    const params: Record<string, string> = { projectId: props.projectId }
    if (activeTab.value !== 'all') {
      params.status = activeTab.value
    }

    const res = await geoApi('/executions', { query: params })
    if (res.success) {
      executions.value = res.data.executions || []
    } else {
      throw new Error(res.error || 'Failed to load executions')
    }
  } catch (err: any) {
    loadError.value = err?.message || '加载执行任务失败'
    console.error('[ExecutionPanel] Load error:', err)
  } finally {
    loading.value = false
  }
}

async function createExecution() {
  creating.value = true
  try {
    const res = await geoApi('/executions', {
      method: 'POST',
      body: {
        projectId: props.projectId,
        optimizationType: newExecution.optimizationType,
        triggerSource: 'manual',
        industry: newExecution.industry || null,
        brandType: newExecution.brandType || null,
      },
    })
    if (res.success) {
      showCreateModal.value = false
      // Reset form
      newExecution.optimizationType = 'full_optimization'
      newExecution.industry = ''
      newExecution.brandType = ''
      // Refresh
      await Promise.all([loadSummary(), loadExecutions()])
    } else {
      throw new Error(res.error || '创建失败')
    }
  } catch (err: any) {
    alert('创建执行任务失败：' + (err?.message || '未知错误'))
  } finally {
    creating.value = false
  }
}

async function retryExecution(executionId: string) {
  try {
    const res = await geoApi(`/executions/${executionId}/retry`, { method: 'POST' })
    if (res.success) {
      await Promise.all([loadSummary(), loadExecutions()])
    } else {
      throw new Error(res.error || '重试失败')
    }
  } catch (err: any) {
    alert('重试失败：' + (err?.message || '未知错误'))
  }
}

async function cancelExecution(executionId: string) {
  if (!confirm('确定要取消此执行任务吗？')) return
  try {
    const res = await geoApi(`/executions/${executionId}/cancel`, { method: 'POST' })
    if (res.success) {
      await Promise.all([loadSummary(), loadExecutions()])
    } else {
      throw new Error(res.error || '取消失败')
    }
  } catch (err: any) {
    alert('取消失败：' + (err?.message || '未知错误'))
  }
}

function toggleDetail(id: string) {
  expandedId.value = expandedId.value === id ? null : id
}

// ── Helpers ──

function getOptimizationLabel(type: string): string {
  const labels: Record<string, string> = {
    content_optimization: '内容优化',
    structured_data: '结构化数据',
    entity_enrichment: '实体丰富',
    faq_generation: 'FAQ 生成',
    citation_building: '引用构建',
    full_optimization: '完整优化',
  }
  return labels[type] || type
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: '队列中',
    running: '运行中',
    completed: '已完成',
    failed: '失败',
    cancelled: '已取消',
  }
  return labels[status] || status
}

function formatTime(dateStr: string): string {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    return d.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateStr
  }
}
</script>

<style scoped>
.execution-panel {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
}

/* ===== Summary ===== */
.execution-panel__summary {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.execution-panel__stat {
  flex: 1;
  min-width: 80px;
  text-align: center;
  padding: 14px 12px;
  background: #f9fafb;
  border-radius: 10px;
  border: 1px solid #f3f4f6;
}

.execution-panel__stat-value {
  display: block;
  font-size: 24px;
  font-weight: 700;
  color: #111827;
}

.execution-panel__stat-label {
  font-size: 12px;
  color: #6b7280;
  margin-top: 4px;
}

.execution-panel__stat--pending .execution-panel__stat-value { color: #f59e0b; }
.execution-panel__stat--running .execution-panel__stat-value { color: #3b82f6; }
.execution-panel__stat--completed .execution-panel__stat-value { color: #10b981; }
.execution-panel__stat--failed .execution-panel__stat-value { color: #ef4444; }
.execution-panel__stat--cancelled .execution-panel__stat-value { color: #9ca3af; }

/* ===== Actions Bar ===== */
.execution-panel__actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  gap: 12px;
  flex-wrap: wrap;
}

.execution-panel__filters {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.execution-panel__filter-btn {
  padding: 6px 14px;
  border: 1px solid #e5e7eb;
  background: #fff;
  border-radius: 6px;
  font-size: 13px;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.15s;
}

.execution-panel__filter-btn:hover {
  background: #f3f4f6;
  color: #374151;
}

.execution-panel__filter-btn--active {
  background: #3b82f6;
  color: #fff;
  border-color: #3b82f6;
}

.execution-panel__create-btn {
  padding: 8px 18px;
  background: #3b82f6;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
  white-space: nowrap;
}

.execution-panel__create-btn:hover {
  background: #2563eb;
}

/* ===== Loading ===== */
.execution-panel__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 48px;
  color: #6b7280;
}

.execution-panel__spinner {
  width: 20px;
  height: 20px;
  border: 3px solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ===== Error ===== */
.execution-panel__error {
  text-align: center;
  padding: 32px;
  color: #dc2626;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 10px;
}

.execution-panel__retry-btn {
  margin-top: 12px;
  padding: 8px 20px;
  background: #dc2626;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}

.execution-panel__retry-btn:hover {
  background: #b91c1c;
}

/* ===== Empty ===== */
.execution-panel__empty {
  text-align: center;
  padding: 48px;
  background: #f9fafb;
  border: 1px dashed #e5e7eb;
  border-radius: 12px;
}

.execution-panel__empty-icon {
  font-size: 40px;
  margin-bottom: 12px;
}

.execution-panel__empty h3 {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
  margin: 0 0 6px;
}

.execution-panel__empty p {
  font-size: 14px;
  color: #6b7280;
  margin: 0;
}

/* ===== List ===== */
.execution-panel__list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.execution-panel__card {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 14px 18px;
  background: #fff;
  border: 1px solid #f3f4f6;
  border-radius: 10px;
  transition: box-shadow 0.15s;
  gap: 12px;
}

.execution-panel__card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.execution-panel__card-left {
  flex: 1;
  min-width: 0;
}

.execution-panel__card-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}

.execution-panel__card-type {
  font-size: 15px;
  font-weight: 600;
  color: #111827;
}

.execution-panel__card-status {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 20px;
  font-weight: 500;
  white-space: nowrap;
}

.execution-panel__card-status--pending {
  background: #fef3c7;
  color: #b45309;
}

.execution-panel__card-status--running {
  background: #dbeafe;
  color: #1d4ed8;
}

.execution-panel__card-status--completed {
  background: #d1fae5;
  color: #047857;
}

.execution-panel__card-status--failed {
  background: #fee2e2;
  color: #b91c1c;
}

.execution-panel__card-status--cancelled {
  background: #f3f4f6;
  color: #6b7280;
}

.execution-panel__card-meta {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  font-size: 12px;
  color: #9ca3af;
}

.execution-panel__card-scores {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-top: 6px;
  font-size: 13px;
  color: #6b7280;
}

.score-up {
  color: #10b981;
  font-weight: 600;
}

.score-down {
  color: #ef4444;
  font-weight: 600;
}

.execution-panel__card-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.execution-panel__action-btn {
  padding: 5px 12px;
  border: 1px solid #e5e7eb;
  background: #fff;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}

.execution-panel__action-btn:hover {
  background: #f3f4f6;
}

.execution-panel__action-btn--cancel {
  color: #ef4444;
  border-color: #fecaca;
}

.execution-panel__action-btn--cancel:hover {
  background: #fee2e2;
}

.execution-panel__action-btn--retry {
  color: #f59e0b;
  border-color: #fde68a;
}

.execution-panel__action-btn--retry:hover {
  background: #fef3c7;
}

.execution-panel__action-btn--view {
  color: #3b82f6;
  border-color: #bfdbfe;
}

/* ===== Modal ===== */
.execution-panel__modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.execution-panel__modal {
  background: #fff;
  border-radius: 14px;
  padding: 28px;
  width: 90%;
  max-width: 440px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
}

.execution-panel__modal h3 {
  font-size: 18px;
  font-weight: 700;
  color: #111827;
  margin: 0 0 20px;
}

.execution-panel__modal-field {
  margin-bottom: 16px;
}

.execution-panel__modal-field label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 6px;
}

.execution-panel__modal-field select,
.execution-panel__modal-field input {
  width: 100%;
  padding: 9px 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  color: #111827;
  background: #fff;
  box-sizing: border-box;
}

.execution-panel__modal-field select:focus,
.execution-panel__modal-field input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
}

.execution-panel__modal-btns {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 24px;
}

.execution-panel__modal-btn {
  padding: 9px 20px;
  border: 1px solid #d1d5db;
  background: #fff;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.execution-panel__modal-btn--primary {
  background: #3b82f6;
  color: #fff;
  border-color: #3b82f6;
}

.execution-panel__modal-btn--primary:hover {
  background: #2563eb;
}

.execution-panel__modal-btn--primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
