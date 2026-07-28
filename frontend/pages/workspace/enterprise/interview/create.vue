<!-- Sprint 08: 创建面试会话页 -->
<!-- 位置：/workspace/enterprise/interview/create -->
<!-- 职责：创建新的 AI 面试会话 -->
<template>
  <div class="create-interview-page">
    <!-- Header -->
    <div class="cip-header">
      <button @click="goBack" class="cip-back-btn">← 返回</button>
      <h1 class="cip-title">🎤 创建 AI 面试</h1>
      <p class="cip-subtitle">为候选人创建 AI 驱动的面试会话</p>
    </div>

    <!-- Form -->
    <div class="cip-form-card">
      <div class="cip-form-group">
        <label class="cip-label">候选人姓名 *</label>
        <input
          v-model="form.candidateName"
          class="cip-input"
          placeholder="请输入候选人姓名"
        />
      </div>

      <div class="cip-form-group">
        <label class="cip-label">应聘岗位 *</label>
        <select v-model="form.jobId" class="cip-select">
          <option value="">选择岗位</option>
          <option v-for="job in jobs" :key="job.id" :value="job.id">
            {{ job.title }}
          </option>
        </select>
      </div>

      <div class="cip-form-group">
        <label class="cip-label">面试标题</label>
        <input
          v-model="form.title"
          class="cip-input"
          placeholder="如：张三 - 前端工程师面试（可选）"
        />
      </div>

      <div class="cip-form-group">
        <label class="cip-label">关联 Pipeline</label>
        <select v-model="form.pipelineId" class="cip-select">
          <option value="">不关联</option>
          <option v-for="p in pipelines" :key="p.id" :value="p.id">
            {{ p.candidateName }} - {{ p.job?.title || '' }}
          </option>
        </select>
      </div>

      <div class="cip-form-actions">
        <button class="cip-btn cip-btn--primary" @click="createSession" :disabled="isCreating || !form.candidateName || !form.jobId">
          <span v-if="isCreating" class="cip-btn-loading">
            <span class="cip-spinner"></span>
            创建中...
          </span>
          <span v-else>🚀 创建面试会话</span>
        </button>
      </div>
    </div>

    <!-- Existing Sessions -->
    <div v-if="existingSessions.length > 0" class="cip-existing">
      <h2 class="cip-section-title">📋 现有面试会话</h2>
      <div class="cip-session-list">
        <div
          v-for="s in existingSessions"
          :key="s.id"
          class="cip-session-item"
          @click="goToSession(s.id)"
        >
          <div class="cip-session-info">
            <span class="cip-session-title">{{ s.title || s.candidateName }}</span>
            <span class="cip-session-job">{{ s.job?.title || '' }}</span>
          </div>
          <div class="cip-session-meta">
            <span class="cip-session-status" :class="statusClass(s.status)">{{ statusLabel(s.status) }}</span>
            <span class="cip-session-date">{{ formatDate(s.createdAt) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { getAuthToken } from '~/utils/auth/token'

// ─── Route (for pre-fill) ───
const route = useRoute()
const prefillCandidateId = route.query.candidateId as string || ''
const prefillCandidateName = route.query.candidateName as string || ''
const prefillJobId = route.query.jobId as string || ''

// ─── State ───
const isCreating = ref(false)
const jobs = ref<any[]>([])
const pipelines = ref<any[]>([])
const existingSessions = ref<any[]>([])
const form = ref({
  candidateName: prefillCandidateName,
  jobId: prefillJobId,
  title: '',
  pipelineId: '',
})

// ─── Data Loading ───
async function loadData() {
  const token = getAuthToken()
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}

  // Load jobs
  try {
    const jobRes = await fetch('/api/enterprise/postings', { headers })
    if (jobRes.ok) {
      const data = await jobRes.json()
      jobs.value = data.data || []
    }
  } catch { /* silent */ }

  // Load existing sessions
  try {
    const sessionRes = await fetch('/api/enterprise/recruitment-interview?limit=10', { headers })
    if (sessionRes.ok) {
      const data = await sessionRes.json()
      existingSessions.value = data.data?.sessions || []
    }
  } catch { /* silent */ }
}

// ─── Actions ───
function goBack() {
  window.history.back()
}

function goToSession(id: string) {
  window.location.href = `/workspace/enterprise/interview/${id}`
}

async function createSession() {
  if (!form.value.candidateName || !form.value.jobId) return

  isCreating.value = true
  try {
    const token = getAuthToken()
    const workspaceId = localStorage.getItem('workspace_id') || localStorage.getItem('enterprise_id') || ''

    const res = await fetch('/api/enterprise/recruitment-interview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        workspaceId,
        jobId: form.value.jobId,
        candidateName: form.value.candidateName,
        title: form.value.title || undefined,
        pipelineId: form.value.pipelineId || undefined,
      }),
    })

    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.message || '创建失败')
    }

    const data = await res.json()
    // Redirect to interview execution page
    window.location.href = `/workspace/enterprise/interview/${data.data.id}`
  } catch (e: any) {
    alert(`❌ ${e.message}`)
  } finally {
    isCreating.value = false
  }
}

// ─── Helpers ───
function statusLabel(status: string): string {
  const map: Record<string, string> = {
    preparing: '准备中', question_ready: '题目就绪', in_progress: '进行中',
    evaluating: '评估中', completed: '已完成', decision_made: '已决策',
  }
  return map[status] || status
}

function statusClass(status: string): string {
  return `cip-status--${status}`
}

function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '—'
  try {
    return new Date(date).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
  } catch { return '—' }
}

// ─── Init ───
onMounted(() => {
  loadData()
})
</script>

<style scoped>
.create-interview-page {
  padding: 24px;
  max-width: 700px;
  margin: 0 auto;
}

/* Header */
.cip-header {
  margin-bottom: 24px;
}

.cip-back-btn {
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  font-size: 0.85rem;
  margin-bottom: 12px;
}

.cip-back-btn:hover {
  background: rgba(255, 255, 255, 0.08);
}

.cip-title {
  font-size: 1.3rem;
  font-weight: 700;
  color: #fff;
  margin: 0;
}

.cip-subtitle {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.5);
  margin: 4px 0 0;
}

/* Form */
.cip-form-card {
  background: #0d1220;
  border: 1px solid #1a2240;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 24px;
}

.cip-form-group {
  margin-bottom: 16px;
}

.cip-label {
  display: block;
  font-size: 0.8rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.6);
  margin-bottom: 6px;
}

.cip-input, .cip-select {
  width: 100%;
  padding: 10px 14px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.85);
  font-size: 0.88rem;
  outline: none;
  box-sizing: border-box;
}

.cip-input:focus, .cip-select:focus {
  border-color: rgba(96, 165, 250, 0.4);
}

.cip-form-actions {
  margin-top: 20px;
}

/* Buttons */
.cip-btn {
  padding: 10px 24px;
  font-size: 0.88rem;
  font-weight: 500;
  border-radius: 8px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.15s;
}

.cip-btn--primary {
  background: linear-gradient(135deg, #60a5fa, #3b82f6);
  color: #fff;
}

.cip-btn--primary:hover:not(:disabled) {
  box-shadow: 0 4px 16px rgba(96, 165, 250, 0.3);
}

.cip-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.cip-btn-loading {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cip-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: cip-spin 0.6s linear infinite;
}

@keyframes cip-spin {
  to { transform: rotate(360deg); }
}

/* Existing Sessions */
.cip-section-title {
  font-size: 0.95rem;
  font-weight: 600;
  color: #fff;
  margin: 0 0 12px;
}

.cip-session-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cip-session-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  background: #0d1220;
  border: 1px solid #1a2240;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
}

.cip-session-item:hover {
  border-color: rgba(96, 165, 250, 0.3);
}

.cip-session-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.cip-session-title {
  font-size: 0.85rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.85);
}

.cip-session-job {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.4);
}

.cip-session-meta {
  display: flex;
  align-items: center;
  gap: 12px;
}

.cip-session-status {
  padding: 2px 8px;
  border-radius: 8px;
  font-size: 0.7rem;
  font-weight: 500;
}

.cip-status--preparing { background: rgba(156, 163, 175, 0.15); color: #9ca3af; }
.cip-status--question_ready { background: rgba(96, 165, 250, 0.15); color: #60a5fa; }
.cip-status--in_progress { background: rgba(167, 139, 250, 0.15); color: #a78bfa; }
.cip-status--evaluating { background: rgba(251, 191, 36, 0.15); color: #fbbf24; }
.cip-status--completed { background: rgba(74, 222, 128, 0.15); color: #4ade80; }
.cip-status--decision_made { background: rgba(74, 222, 128, 0.15); color: #4ade80; }

.cip-session-date {
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.35);
}
</style>
