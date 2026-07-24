<template>
  <div class="interview-workspace">
    <!-- Maintenance Banner -->
    <div style="background:#fff3cd;border:1px solid #ffc107;border-radius:8px;padding:12px 16px;margin-bottom:16px;color:#856404;">
      ⚠️ 面试管理模块正在升级中，部分功能暂不可用。
    </div>
    <!-- Top Navigation Bar -->
    <div class="ceo-top-nav">
      <button @click="goToWorkspaceCenter" class="ceo-nav-btn" title="返回工作台中心">
        ← 工作台中心
      </button>
      <WorkspaceSwitcher />
      <button @click="goToBilling" class="ceo-nav-btn" title="套餐订阅">
        📦 套餐订阅
      </button>
    </div>

    <!-- Page Header -->
    <div class="page-header">
      <div class="header-left">
        <h1 class="page-title">🎤 面试管理</h1>
        <p class="page-subtitle">管理所有面试安排、记录和决策</p>
      </div>
      <div class="header-right">
        <button @click="refresh" class="ceo-btn-secondary" :disabled="loading">
          🔄 刷新
        </button>
      </div>
    </div>

    <!-- Stats Summary -->
    <div class="stats-bar">
      <div class="stat-item">
        <span class="stat-num">{{ stats.total }}</span>
        <span class="stat-label">总面试</span>
      </div>
      <div class="stat-item">
        <span class="stat-num">{{ stats.preparing }}</span>
        <span class="stat-label">准备中</span>
      </div>
      <div class="stat-item">
        <span class="stat-num">{{ stats.ongoing }}</span>
        <span class="stat-label">进行中</span>
      </div>
      <div class="stat-item">
        <span class="stat-num">{{ stats.completed }}</span>
        <span class="stat-label">已完成</span>
      </div>
      <div class="stat-item">
        <span class="stat-num">{{ stats.cancelled }}</span>
        <span class="stat-label">已取消</span>
      </div>
    </div>

    <!-- Filter Bar -->
    <div class="filter-bar">
      <select v-model="statusFilter" class="ceo-select" @change="loadInterviews">
        <option value="">全部状态</option>
        <option value="preparing">准备中</option>
        <option value="ongoing">进行中</option>
        <option value="completed">已完成</option>
        <option value="cancelled">已取消</option>
      </select>
      <input
        v-model="searchQuery"
        type="text"
        placeholder="搜索候选人或职位..."
        class="ceo-input"
        @input="debounceSearch"
      />
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      <div class="loading-spinner"></div>
      <span>加载中...</span>
    </div>

    <!-- Empty State -->
    <div v-else-if="filteredInterviews.length === 0" class="ceo-empty">
      <h2>暂无面试</h2>
      <p>在 Pipeline 中点击 ❓ 按钮为候选人安排面试</p>
    </div>

    <!-- Interview List -->
    <div v-else class="interview-list">
      <div
        v-for="item in filteredInterviews"
        :key="item.id"
        class="interview-card"
        @click="openDetail(item)"
      >
        <div class="interview-main">
          <div class="interview-candidate">
            <span class="candidate-avatar">{{ item.candidateName?.charAt(0) || '?' }}</span>
            <div class="candidate-info">
              <div class="candidate-name">{{ item.candidateName }}</div>
              <div class="candidate-job">{{ item.jobTitle || '未知职位' }}</div>
            </div>
          </div>
          <div class="interview-meta">
            <span :class="['status-badge', item.status]">{{ statusLabels[item.status] || item.status }}</span>
            <span v-if="item.overallScore" class="score-badge">{{ item.overallScore }}分</span>
            <span v-if="item.questionCount" class="question-count">{{ item.questionCount }}题</span>
          </div>
          <div class="interview-time">
            <div class="time-label">创建时间</div>
            <div class="time-value">{{ formatDate(item.createdAt) }}</div>
          </div>
          <div class="interview-actions" @click.stop>
            <button @click="openDetail(item)" class="ceo-btn-small">查看详情</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Interview Detail Drawer -->
    <div v-if="showDetail" class="drawer-overlay" @click.self="closeDetail">
      <div class="drawer-panel">
        <div class="drawer-header">
          <h2>{{ detail?.candidateName || '面试详情' }}</h2>
          <button @click="closeDetail" class="close-btn">✕</button>
        </div>

        <div v-if="detailLoading" class="drawer-loading">
          <div class="loading-spinner"></div>
          <span>加载中...</span>
        </div>

        <div v-else-if="detail" class="drawer-content">
          <!-- Status & Decision -->
          <div class="detail-section">
            <div class="section-header">
              <h3>📊 状态</h3>
              <span :class="['status-badge', detail.status]">{{ statusLabels[detail.status] || detail.status }}</span>
            </div>
            <div class="detail-info">
              <div class="info-row">
                <span class="info-label">职位</span>
                <span class="info-value">{{ detail.job?.title || '-' }}</span>
              </div>
              <div class="info-row">
                <span class="info-label">创建时间</span>
                <span class="info-value">{{ formatDate(detail.createdAt) }}</span>
              </div>
              <div v-if="detail.startedAt" class="info-row">
                <span class="info-label">开始时间</span>
                <span class="info-value">{{ formatDate(detail.startedAt) }}</span>
              </div>
              <div v-if="detail.completedAt" class="info-row">
                <span class="info-label">完成时间</span>
                <span class="info-value">{{ formatDate(detail.completedAt) }}</span>
              </div>
            </div>
          </div>

          <!-- Timeline -->
          <div class="detail-section">
            <h3>📅 时间线</h3>
            <div v-if="timeline.length === 0" class="empty-text">暂无事件</div>
            <div v-else class="timeline">
              <div v-for="(event, idx) in timeline" :key="idx" class="timeline-item">
                <div :class="['timeline-dot', event.type]"></div>
                <div class="timeline-content">
                  <div class="timeline-title">{{ event.title }}</div>
                  <div v-if="event.description" class="timeline-desc">{{ event.description }}</div>
                  <div class="timeline-time">{{ formatDate(event.time) }}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- AI Interview Questions -->
          <div v-if="detail.questions?.length" class="detail-section">
            <h3>❓ 面试题</h3>
            <div class="questions-list">
              <div v-for="(q, idx) in detail.questions" :key="q.id" class="question-item">
                <div class="question-header">
                  <span class="question-num">Q{{ idx + 1 }}</span>
                  <span :class="['question-category', q.category]">{{ categoryLabels[q.category] || q.category }}</span>
                </div>
                <div class="question-text">{{ q.question }}</div>
                <div v-if="q.answer" class="question-answer">
                  <strong>回答：</strong>{{ q.answer }}
                </div>
              </div>
            </div>
          </div>

          <!-- AI Evaluation -->
          <div v-if="detail.evaluation" class="detail-section">
            <h3>🤖 AI 评价 <span class="beta-tag">Beta</span></h3>
            <div class="evaluation-card">
              <div class="eval-scores">
                <div class="eval-score">
                  <span class="score-value">{{ detail.evaluation.overallScore }}</span>
                  <span class="score-label">综合</span>
                </div>
                <div class="eval-score">
                  <span class="score-value">{{ detail.evaluation.technicalScore }}</span>
                  <span class="score-label">技术</span>
                </div>
                <div class="eval-score">
                  <span class="score-value">{{ detail.evaluation.communicationScore }}</span>
                  <span class="score-label">沟通</span>
                </div>
                <div class="eval-score">
                  <span class="score-value">{{ detail.evaluation.cultureScore }}</span>
                  <span class="score-label">文化</span>
                </div>
              </div>
              <div class="eval-summary">{{ detail.evaluation.summary }}</div>
              <div v-if="detail.evaluation.recommendation" class="eval-recommendation">
                建议：{{ detail.evaluation.recommendation }}
              </div>
            </div>
          </div>

          <!-- Interview Notes -->
          <div class="detail-section">
            <div class="section-header">
              <h3>📝 面试笔记</h3>
              <button @click="showAddNote = !showAddNote" class="ceo-btn-small">+ 添加笔记</button>
            </div>
            <div v-if="showAddNote" class="add-note">
              <textarea
                v-model="newNote"
                placeholder="输入面试笔记..."
                class="note-input"
                rows="3"
              ></textarea>
              <div class="note-actions">
                <button @click="addNote" class="ceo-btn-primary" :disabled="!newNote.trim()">保存</button>
                <button @click="showAddNote = false; newNote = ''" class="ceo-btn-secondary">取消</button>
              </div>
            </div>
            <div v-if="detail.notes?.length === 0" class="empty-text">暂无笔记</div>
            <div v-else class="notes-list">
              <div v-for="note in detail.notes" :key="note.id" class="note-item">
                <div class="note-content">{{ note.content }}</div>
                <div class="note-meta">
                  <span>{{ formatDate(note.createdAt) }}</span>
                  <button @click="deleteNote(note.id)" class="note-delete">删除</button>
                </div>
              </div>
            </div>
          </div>

          <!-- Decision -->
          <div v-if="!detail.decision" class="detail-section">
            <h3>🎯 面试决策</h3>
            <div class="decision-buttons">
              <button @click="makeDecision('recommend_offer')" class="decision-btn offer">
                ✅ 建议录用
              </button>
              <button @click="makeDecision('hold')" class="decision-btn hold">
                ⏸️ 暂缓
              </button>
              <button @click="makeDecision('reject')" class="decision-btn reject">
                ❌ 拒绝
              </button>
            </div>
          </div>

          <!-- Decision Result -->
          <div v-else class="detail-section">
            <h3>🎯 决策结果</h3>
            <div :class="['decision-result', detail.decision.decision]">
              <span class="decision-label">
                {{ decisionLabels[detail.decision.decision] || detail.decision.decision }}
              </span>
              <span v-if="detail.decision.reason" class="decision-reason">{{ detail.decision.reason }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useEnterpriseContext } from '~/composables/useEnterpriseContext'
import { useIdentityStore } from '~/stores/identity'
import WorkspaceSwitcher from '~/components/WorkspaceSwitcher.vue'

const ctx = useEnterpriseContext()
const identityStore = useIdentityStore()

// ─── State ───
const loading = ref(false)
const interviews = ref<any[]>([])
const statusFilter = ref('')
const searchQuery = ref('')
const stats = ref({ total: 0, preparing: 0, ongoing: 0, completed: 0, cancelled: 0 })

// Detail drawer
const showDetail = ref(false)
const detail = ref<any>(null)
const detailLoading = ref(false)
const timeline = ref<any[]>([])
const showAddNote = ref(false)
const newNote = ref('')

// ─── Labels ───
const statusLabels: Record<string, string> = {
  preparing: '准备中',
  ongoing: '进行中',
  completed: '已完成',
  cancelled: '已取消',
}

const categoryLabels: Record<string, string> = {
  technical: '技术',
  project: '项目',
  behavioral: '行为',
  deep: '深度',
}

const decisionLabels: Record<string, string> = {
  recommend_offer: '建议录用',
  hold: '暂缓',
  reject: '拒绝',
}

// ─── Computed ───
const filteredInterviews = computed(() => {
  let result = interviews.value
  if (statusFilter.value) {
    result = result.filter(i => i.status === statusFilter.value)
  }
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(i =>
      i.candidateName?.toLowerCase().includes(q) ||
      i.jobTitle?.toLowerCase().includes(q)
    )
  }
  return result
})

// ─── Methods ───
function getWorkspaceId(): string {
  return identityStore.workspaceId || ctx.getWorkspaceId()
}

function formatDate(date: string | Date): string {
  if (!date) return '-'
  return new Date(date).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

async function loadInterviews() {
  loading.value = true
  const wsId = getWorkspaceId()
  try {
    const params = new URLSearchParams()
    if (wsId) params.set('workspaceId', wsId)
    if (statusFilter.value) params.set('status', statusFilter.value)

    const res = await fetch(`/api/enterprise/interviews?${params}`)
    const data = await res.json()
    interviews.value = data.interviews || []

    // Calculate stats
    stats.value = {
      total: interviews.value.length,
      preparing: interviews.value.filter((i: any) => i.status === 'preparing').length,
      ongoing: interviews.value.filter((i: any) => i.status === 'ongoing').length,
      completed: interviews.value.filter((i: any) => i.status === 'completed').length,
      cancelled: interviews.value.filter((i: any) => i.status === 'cancelled').length,
    }
  } catch (e) {
    console.error('加载面试列表失败', e)
  } finally {
    loading.value = false
  }
}

let searchTimer: any = null
function debounceSearch() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {}, 300)
}

function refresh() {
  loadInterviews()
}

async function openDetail(item: any) {
  showDetail.value = true
  detailLoading.value = true
  detail.value = null
  timeline.value = []

  try {
    const [detailRes, timelineRes] = await Promise.all([
      fetch(`/api/enterprise/interview/${item.id}`),
      fetch(`/api/enterprise/interview/${item.id}/timeline`),
    ])

    const detailData = await detailRes.json()
    if (detailData.success) {
      detail.value = detailData.data
    }

    const timelineData = await timelineRes.json()
    if (timelineData.success) {
      timeline.value = timelineData.data
    }
  } catch (e) {
    console.error('加载面试详情失败', e)
  } finally {
    detailLoading.value = false
  }
}

function closeDetail() {
  showDetail.value = false
  detail.value = null
  showAddNote.value = false
  newNote.value = ''
}

async function addNote() {
  if (!newNote.value.trim() || !detail.value) return
  try {
    const res = await fetch(`/api/enterprise/interview/${detail.value.id}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: newNote.value.trim() }),
    })
    const data = await res.json()
    if (data.success) {
      newNote.value = ''
      showAddNote.value = false
      openDetail(detail.value) // Reload
    }
  } catch (e) {
    console.error('添加笔记失败', e)
  }
}

async function deleteNote(noteId: string) {
  if (!confirm('确定删除此笔记？')) return
  try {
    const res = await fetch(`/api/enterprise/interview/notes/${noteId}`, {
      method: 'DELETE',
    })
    const data = await res.json()
    if (data.success && detail.value) {
      openDetail(detail.value) // Reload
    }
  } catch (e) {
    console.error('删除笔记失败', e)
  }
}

async function makeDecision(decision: string) {
  if (!detail.value) return
  const reason = prompt('请输入决策原因（可选）：') || ''
  try {
    const res = await fetch(`/api/enterprise/interview/${detail.value.id}/decision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision, reason }),
    })
    const data = await res.json()
    if (data.success) {
      openDetail(detail.value) // Reload
    } else {
      alert(data.error || '保存失败')
    }
  } catch (e) {
    console.error('保存决策失败', e)
  }
}

// ─── Navigation ───
function goToWorkspaceCenter() {
  window.location.href = '/workspace/enterprise/onboarding'
}

function goToBilling() {
  window.location.href = '/workspace/enterprise/billing'
}

// ─── Lifecycle ───
onMounted(async () => {
  // Sprint-08: Fetch identity context from backend
  await identityStore.fetchContext()

  if (!getWorkspaceId()) {
    window.location.href = '/workspace/enterprise/onboarding'
    return
  }
  loadInterviews()

  // Sprint-08: Listen for workspace switch events
  window.addEventListener('workspace-switched', () => {
    loadInterviews()
  })
})
</script>

<style scoped>
.interview-workspace {
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;
}

.ceo-top-nav {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
}

.ceo-nav-btn {
  padding: 8px 16px;
  border: 1px solid #1A2240;
  background: #0A0F1E;
  color: #9ca3af;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.15s;
}

.ceo-nav-btn:hover {
  border-color: #2563eb;
  color: #60a5fa;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
}

.page-title {
  font-size: 22px;
  font-weight: 600;
  margin: 0;
}

.page-subtitle {
  color: #6b7280;
  font-size: 13px;
  margin-top: 4px;
}

.header-right {
  display: flex;
  gap: 12px;
}

.stats-bar {
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
}

.stat-item {
  flex: 1;
  background: #0A0F1E;
  border: 1px solid #1A2240;
  border-radius: 12px;
  padding: 16px;
  text-align: center;
}

.stat-num {
  display: block;
  font-size: 28px;
  font-weight: 700;
  color: #60a5fa;
}

.stat-label {
  font-size: 12px;
  color: #6b7280;
  margin-top: 4px;
}

.filter-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}

.ceo-select,
.ceo-input {
  padding: 8px 12px;
  border: 1px solid #1A2240;
  background: #0A0F1E;
  color: white;
  border-radius: 8px;
  font-size: 13px;
}

.ceo-input {
  flex: 1;
}

.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 60px;
  color: #6b7280;
}

.loading-spinner {
  width: 24px;
  height: 24px;
  border: 3px solid #1A2240;
  border-top-color: #60a5fa;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.ceo-empty {
  text-align: center;
  padding: 60px;
  color: #6b7280;
}

.ceo-empty h2 {
  font-size: 18px;
  margin-bottom: 8px;
}

.interview-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.interview-card {
  background: #0A0F1E;
  border: 1px solid #1A2240;
  border-radius: 12px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.15s;
}

.interview-card:hover {
  border-color: #2563eb;
  box-shadow: 0 0 0 1px rgba(37, 99, 235, 0.2);
}

.interview-main {
  display: flex;
  align-items: center;
  gap: 16px;
}

.interview-candidate {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.candidate-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #1e3a5f;
  color: #60a5fa;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 600;
}

.candidate-info {
  flex: 1;
}

.candidate-name {
  font-size: 15px;
  font-weight: 500;
}

.candidate-job {
  font-size: 12px;
  color: #6b7280;
  margin-top: 2px;
}

.interview-meta {
  display: flex;
  gap: 8px;
  align-items: center;
}

.status-badge {
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 500;
}

.status-badge.preparing { background: #fef3c7; color: #92400e; }
.status-badge.ongoing { background: #dbeafe; color: #1e40af; }
.status-badge.completed { background: #d1fae5; color: #065f46; }
.status-badge.cancelled { background: #fee2e2; color: #991b1b; }

.score-badge {
  padding: 4px 8px;
  background: #1e3a5f;
  color: #60a5fa;
  border-radius: 12px;
  font-size: 11px;
}

.question-count {
  font-size: 11px;
  color: #6b7280;
}

.interview-time {
  text-align: right;
  min-width: 100px;
}

.time-label {
  font-size: 10px;
  color: #6b7280;
}

.time-value {
  font-size: 12px;
  color: #9ca3af;
}

.ceo-btn-small {
  padding: 6px 12px;
  border: 1px solid #1A2240;
  background: transparent;
  color: #9ca3af;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
}

.ceo-btn-small:hover {
  border-color: #2563eb;
  color: #60a5fa;
}

.ceo-btn-secondary {
  padding: 8px 16px;
  border: 1px solid #1A2240;
  background: transparent;
  color: #9ca3af;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
}

.ceo-btn-secondary:hover {
  border-color: #2563eb;
  color: #60a5fa;
}

/* Drawer */
.drawer-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 100;
  display: flex;
  justify-content: flex-end;
}

.drawer-panel {
  width: 600px;
  max-width: 90vw;
  height: 100vh;
  background: #060A18;
  border-left: 1px solid #1A2240;
  overflow-y: auto;
  animation: slideIn 0.2s ease;
}

@keyframes slideIn {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}

.drawer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #1A2240;
  position: sticky;
  top: 0;
  background: #060A18;
  z-index: 1;
}

.drawer-header h2 {
  margin: 0;
  font-size: 18px;
}

.close-btn {
  width: 32px;
  height: 32px;
  border: 1px solid #1A2240;
  background: transparent;
  color: #9ca3af;
  border-radius: 8px;
  cursor: pointer;
  font-size: 16px;
}

.drawer-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 60px;
  color: #6b7280;
}

.drawer-content {
  padding: 20px;
}

.detail-section {
  margin-bottom: 24px;
  padding-bottom: 24px;
  border-bottom: 1px solid #1A2240;
}

.detail-section:last-child {
  border-bottom: none;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.detail-section h3 {
  font-size: 15px;
  margin: 0;
}

.detail-info {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.info-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-label {
  font-size: 11px;
  color: #6b7280;
}

.info-value {
  font-size: 13px;
}

/* Timeline */
.timeline {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.timeline-item {
  display: flex;
  gap: 12px;
  padding-bottom: 16px;
  position: relative;
}

.timeline-item:not(:last-child)::before {
  content: '';
  position: absolute;
  left: 7px;
  top: 18px;
  bottom: 0;
  width: 2px;
  background: #1A2240;
}

.timeline-dot {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 2px;
}

.timeline-dot.created { background: #60a5fa; }
.timeline-dot.started { background: #fbbf24; }
.timeline-dot.note { background: #a78bfa; }
.timeline-dot.evaluation { background: #34d399; }
.timeline-dot.decision { background: #f87171; }
.timeline-dot.completed { background: #10b981; }

.timeline-content {
  flex: 1;
}

.timeline-title {
  font-size: 13px;
  font-weight: 500;
}

.timeline-desc {
  font-size: 12px;
  color: #6b7280;
  margin-top: 2px;
}

.timeline-time {
  font-size: 11px;
  color: #4b5563;
  margin-top: 4px;
}

/* Questions */
.questions-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.question-item {
  background: #0A0F1E;
  border: 1px solid #1A2240;
  border-radius: 8px;
  padding: 12px;
}

.question-header {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
}

.question-num {
  font-size: 12px;
  font-weight: 600;
  color: #60a5fa;
}

.question-category {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 10px;
  background: #1e3a5f;
  color: #60a5fa;
}

.question-text {
  font-size: 13px;
  line-height: 1.5;
}

.question-answer {
  margin-top: 8px;
  padding: 8px;
  background: #060A18;
  border-radius: 6px;
  font-size: 12px;
  color: #9ca3af;
}

/* Evaluation */
.beta-tag {
  font-size: 10px;
  padding: 2px 8px;
  background: #f59e0b;
  color: white;
  border-radius: 10px;
  font-weight: 500;
}

.evaluation-card {
  background: #0A0F1E;
  border: 1px solid #1A2240;
  border-radius: 8px;
  padding: 16px;
}

.eval-scores {
  display: flex;
  gap: 16px;
  margin-bottom: 12px;
}

.eval-score {
  text-align: center;
}

.score-value {
  display: block;
  font-size: 24px;
  font-weight: 700;
  color: #60a5fa;
}

.score-label {
  font-size: 11px;
  color: #6b7280;
}

.eval-summary {
  font-size: 13px;
  line-height: 1.5;
  margin-bottom: 8px;
}

.eval-recommendation {
  font-size: 12px;
  color: #34d399;
  padding: 8px;
  background: rgba(52, 211, 153, 0.1);
  border-radius: 6px;
}

/* Notes */
.add-note {
  margin-bottom: 16px;
}

.note-input {
  width: 100%;
  padding: 10px;
  border: 1px solid #1A2240;
  background: #060A18;
  color: white;
  border-radius: 8px;
  font-size: 13px;
  resize: vertical;
  font-family: inherit;
}

.note-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.ceo-btn-primary {
  padding: 8px 16px;
  border: none;
  background: #2563eb;
  color: white;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
}

.ceo-btn-primary:hover {
  background: #1d4ed8;
}

.notes-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.note-item {
  background: #0A0F1E;
  border: 1px solid #1A2240;
  border-radius: 8px;
  padding: 12px;
}

.note-content {
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
}

.note-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
  font-size: 11px;
  color: #6b7280;
}

.note-delete {
  border: none;
  background: transparent;
  color: #ef4444;
  cursor: pointer;
  font-size: 11px;
}

.note-delete:hover {
  color: #dc2626;
}

.empty-text {
  font-size: 13px;
  color: #6b7280;
  text-align: center;
  padding: 20px;
}

/* Decision */
.decision-buttons {
  display: flex;
  gap: 12px;
}

.decision-btn {
  flex: 1;
  padding: 12px;
  border: 2px solid;
  background: transparent;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.15s;
}

.decision-btn.offer {
  border-color: #10b981;
  color: #10b981;
}

.decision-btn.offer:hover {
  background: #10b981;
  color: white;
}

.decision-btn.hold {
  border-color: #f59e0b;
  color: #f59e0b;
}

.decision-btn.hold:hover {
  background: #f59e0b;
  color: white;
}

.decision-btn.reject {
  border-color: #ef4444;
  color: #ef4444;
}

.decision-btn.reject:hover {
  background: #ef4444;
  color: white;
}

.decision-result {
  padding: 16px;
  border-radius: 8px;
  text-align: center;
}

.decision-result.recommend_offer {
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid #10b981;
}

.decision-result.hold {
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid #f59e0b;
}

.decision-result.reject {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid #ef4444;
}

.decision-label {
  display: block;
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 4px;
}

.decision-result.recommend_offer .decision-label { color: #10b981; }
.decision-result.hold .decision-label { color: #f59e0b; }
.decision-result.reject .decision-label { color: #ef4444; }

.decision-reason {
  font-size: 12px;
  color: #6b7280;
}
</style>
