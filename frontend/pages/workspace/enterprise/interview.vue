<template>
  <div class="interview-workspace">
    <RecruitmentPageShell>
      <template #title>面试管理</template>
      <template #subtitle>面试决策中心 — 今日面试、待评估面试、历史报告。AI 面试专家 Bob 自动生成面试题、评分和决策建议</template>
      <template #actions>
        <RecruitmentSecondaryButton :disabled="loading" @click="refresh">
          刷新
        </RecruitmentSecondaryButton>
      </template>
      <template #stats>
        <RecruitmentStatCard :value="stats.total" label="总面试" />
        <RecruitmentStatCard :value="stats.preparing" label="准备中" color="--color-warning" />
        <RecruitmentStatCard :value="stats.ongoing" label="进行中" color="--color-decision" />
        <RecruitmentStatCard :value="stats.completed" label="已完成" color="--color-execution" />
      </template>
      <template #filters>
        <RecruitmentSelect v-model="statusFilter" @change="loadInterviews">
          <option value="">全部状态</option>
          <option value="preparing">准备中</option>
          <option value="ongoing">进行中</option>
          <option value="completed">已完成</option>
          <option value="cancelled">已取消</option>
        </RecruitmentSelect>
        <RecruitmentInput
          v-model="searchQuery"
          placeholder="搜索候选人或职位..."
          @input="debounceSearch"
        />
      </template>

      <!-- Loading State -->
      <div v-if="loading" class="iv-loading-state">
        <div class="iv-loading-spinner"></div>
        <span>加载中...</span>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="iv-error-state">
        <div class="iv-error-icon">!</div>
        <div class="iv-error-text">
          <p>{{ error }}</p>
        </div>
        <RecruitmentPrimaryButton @click="refresh">重新加载</RecruitmentPrimaryButton>
      </div>

      <!-- Empty State -->
      <div v-else-if="filteredInterviews.length === 0 && !loading" class="iv-empty-state">
        <div class="iv-empty-bob">
          <div class="iv-bob-avatar-lg">B</div>
          <div class="iv-bob-welcome">
            <h3>AI 面试专家 Bob</h3>
            <p>还没有面试安排。创建岗位后，AI 面试专家 Bob 会自动生成面试流程，包括智能面试题、评分标准和评估报告。</p>
          </div>
        </div>
        <RecruitmentPrimaryButton @click="goToJobs">查看职位</RecruitmentPrimaryButton>
      </div>

      <!-- Today's Interviews Section + Bob Card -->
      <template v-else>
        <!-- Pending Evaluations Section -->
        <div v-if="pendingEvalInterviews.length > 0" class="iv-pending-section">
          <div class="iv-section-title">
            <span>待评估面试 ({{ pendingEvalInterviews.length }})</span>
          </div>
          <div class="iv-pending-cards">
            <div
              v-for="item in pendingEvalInterviews"
              :key="item.id"
              class="iv-pending-card"
              @click="openDetail(item)"
            >
              <div class="iv-pending-avatar">{{ (item.candidateName || '?').charAt(0) }}</div>
              <div class="iv-pending-info">
                <span class="iv-pending-name">{{ item.candidateName }}</span>
                <span class="iv-pending-job">{{ item.job?.title || item.jobTitle || '—' }}</span>
              </div>
              <RecruitmentBadge variant="warning">待评估</RecruitmentBadge>
              <span class="iv-pending-arrow">→</span>
            </div>
          </div>
        </div>
        <!-- Today's interviews highlight -->
        <div v-if="todayInterviews.length > 0" class="iv-today-section">
          <div class="iv-section-title">
            <span>今天的面试 ({{ todayInterviews.length }})</span>
          </div>
          <div class="iv-today-cards">
            <div
              v-for="item in todayInterviews"
              :key="item.id"
              class="iv-today-card"
              @click="openDetail(item)"
            >
              <div class="iv-today-avatar">{{ (item.candidateName || '?').charAt(0) }}</div>
              <div class="iv-today-info">
                <span class="iv-today-name">{{ item.candidateName }}</span>
                <span class="iv-today-job">{{ item.job?.title || item.jobTitle || '—' }}</span>
              </div>
              <RecruitmentBadge :variant="badgeVariant(item.status)">{{ statusLabels[item.status] || item.status }}</RecruitmentBadge>
            </div>
          </div>
        </div>

        <!-- AI Interview Expert Bob Section -->
        <div class="iv-bob-card">
          <div class="iv-bob-left">
            <div class="iv-bob-avatar">B</div>
            <div class="iv-bob-info">
              <span class="iv-bob-name">AI 面试专家 Bob</span>
              <span class="iv-bob-role">负责智能面试题生成、评估和决策建议</span>
            </div>
          </div>
          <div class="iv-bob-stats">
            <div class="iv-bob-stat">
              <span class="iv-bob-stat-val">{{ stats.total }}</span>
              <span class="iv-bob-stat-lbl">总面试</span>
            </div>
            <div class="iv-bob-stat">
              <span class="iv-bob-stat-val">{{ stats.completed }}</span>
              <span class="iv-bob-stat-lbl">已完成</span>
            </div>
            <div class="iv-bob-stat">
              <span class="iv-bob-stat-val">{{ stats.preparing }}</span>
              <span class="iv-bob-stat-lbl">待评估</span>
            </div>
          </div>
        </div>

        <!-- Interview List -->
        <div class="iv-list">
          <div class="iv-list-header">
            <span class="iv-list-title">全部面试 ({{ filteredInterviews.length }})</span>
          </div>
          <div
            v-for="item in filteredInterviews"
            :key="item.id"
            class="iv-card"
            @click="openDetail(item)"
          >
            <div class="iv-card-main">
              <div class="iv-card-candidate">
                <span class="iv-cand-avatar">{{ (item.candidateName || '?').charAt(0) }}</span>
                <div class="iv-cand-info">
                  <div class="iv-cand-name">{{ item.candidateName }}</div>
                  <div class="iv-cand-job">{{ item.job?.title || item.jobTitle || '—' }}</div>
                </div>
              </div>
              <div class="iv-card-meta">
                <RecruitmentBadge :variant="badgeVariant(item.status)">{{ statusLabels[item.status] || item.status }}</RecruitmentBadge>
                <span v-if="item.evaluation?.overallScore" class="iv-score-badge">{{ item.evaluation.overallScore }}分</span>
              </div>
              <div class="iv-card-time">
                {{ formatDate(item.createdAt) }}
              </div>
              <div class="iv-card-action">
                <button class="iv-action-btn" @click.stop="openDetail(item)">详情</button>
              </div>
            </div>
          </div>
        </div>
      </template>
    </RecruitmentPageShell>

    <!-- Interview Detail Drawer -->
    <div v-if="showDetail" class="iv-drawer-overlay" @click.self="closeDetail">
      <div class="iv-drawer-panel">
        <div class="iv-drawer-header">
          <h2>{{ detail?.candidateName || '面试详情' }}</h2>
          <button @click="closeDetail" class="iv-close-btn">✕</button>
        </div>

        <div v-if="detailLoading" class="iv-drawer-loading">
          <div class="iv-loading-spinner"></div>
          <span>加载中...</span>
        </div>

        <div v-else-if="detail" class="iv-drawer-content">
          <!-- Overview -->
          <div class="iv-detail-section">
            <div class="iv-section-header">
              <h3>概览</h3>
              <RecruitmentBadge :variant="badgeVariant(detail.status)">{{ statusLabels[detail.status] || detail.status }}</RecruitmentBadge>
            </div>
            <div class="iv-overview-grid">
              <div class="iv-ov-item">
                <span class="iv-ov-label">职位</span>
                <span class="iv-ov-value">{{ detail.job?.title || '—' }}</span>
              </div>
              <div class="iv-ov-item">
                <span class="iv-ov-label">创建时间</span>
                <span class="iv-ov-value">{{ formatDate(detail.createdAt) }}</span>
              </div>
              <div v-if="detail.startedAt" class="iv-ov-item">
                <span class="iv-ov-label">开始时间</span>
                <span class="iv-ov-value">{{ formatDate(detail.startedAt) }}</span>
              </div>
              <div v-if="detail.completedAt" class="iv-ov-item">
                <span class="iv-ov-label">完成时间</span>
                <span class="iv-ov-value">{{ formatDate(detail.completedAt) }}</span>
              </div>
            </div>
          </div>

          <!-- AI Evaluation -->
          <div v-if="detail.evaluation" class="iv-detail-section">
            <h3>Bob 面试评估</h3>
            <div class="iv-eval-card">
              <div class="iv-eval-scores">
                <div class="iv-eval-score-item">
                  <span class="iv-eval-score-val">{{ detail.evaluation.overallScore }}</span>
                  <span class="iv-eval-score-lbl">综合</span>
                </div>
                <div class="iv-eval-score-item">
                  <span class="iv-eval-score-val">{{ detail.evaluation.technicalScore }}</span>
                  <span class="iv-eval-score-lbl">技术</span>
                </div>
                <div class="iv-eval-score-item">
                  <span class="iv-eval-score-val">{{ detail.evaluation.communicationScore }}</span>
                  <span class="iv-eval-score-lbl">沟通</span>
                </div>
                <div class="iv-eval-score-item">
                  <span class="iv-eval-score-val">{{ detail.evaluation.cultureScore }}</span>
                  <span class="iv-eval-score-lbl">文化</span>
                </div>
              </div>
              <div v-if="detail.evaluation.summary" class="iv-eval-summary">{{ detail.evaluation.summary }}</div>
              <div v-if="detail.evaluation.recommendation" class="iv-eval-recommend">
                <span class="iv-rec-label">建议：</span>
                <span>{{ recommendationLabel(detail.evaluation.recommendation) }}</span>
              </div>
            </div>
          </div>

          <!-- Interview Questions -->
          <div v-if="detail.questions?.length" class="iv-detail-section">
            <h3>面试题 ({{ detail.questions.length }})</h3>
            <div class="iv-questions">
              <div v-for="(q, idx) in detail.questions" :key="q.id" class="iv-question-item">
                <div class="iv-q-header">
                  <span class="iv-q-num">Q{{ idx + 1 }}</span>
                  <RecruitmentBadge variant="info" v-if="q.category">{{ categoryLabels[q.category] || q.category }}</RecruitmentBadge>
                </div>
                <div class="iv-q-text">{{ q.question }}</div>
                <div v-if="q.answer" class="iv-q-answer"><strong>回答：</strong>{{ q.answer }}</div>
              </div>
            </div>
          </div>

          <!-- Decision -->
          <div v-if="detail.decision" class="iv-detail-section">
            <h3>决策结果</h3>
            <div :class="['iv-decision-result', 'iv-dr--' + detail.decision.decision]">
              <span class="iv-dr-label">{{ decisionLabels[detail.decision.decision] || detail.decision.decision }}</span>
              <span v-if="detail.decision.reason" class="iv-dr-reason">{{ detail.decision.reason }}</span>
            </div>
          </div>

          <!-- Notes -->
          <div class="iv-detail-section">
            <h3>面试笔记</h3>
            <div v-if="detail.notes?.length === 0" class="iv-empty-text">暂无笔记</div>
            <div v-else class="iv-notes-list">
              <div v-for="note in detail.notes" :key="note.id" class="iv-note-item">
                <div class="iv-note-content">{{ note.content }}</div>
                <div class="iv-note-meta">
                  <span>{{ formatDate(note.createdAt) }}</span>
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
definePageMeta({ layout: 'enterprise-workspace' })

import { ref, computed, onMounted } from 'vue'
import RecruitmentInput from '~/components/enterprise/recruitment/ui/RecruitmentInput.vue'
import RecruitmentPrimaryButton from '~/components/enterprise/recruitment/ui/RecruitmentPrimaryButton.vue'
import RecruitmentSecondaryButton from '~/components/enterprise/recruitment/ui/RecruitmentSecondaryButton.vue'
import RecruitmentSelect from '~/components/enterprise/recruitment/ui/RecruitmentSelect.vue'
import RecruitmentStatCard from '~/components/enterprise/recruitment/ui/RecruitmentStatCard.vue'
import RecruitmentBadge from '~/components/enterprise/recruitment/ui/RecruitmentBadge.vue'
import RecruitmentPageShell from '~/components/enterprise/recruitment/ui/RecruitmentPageShell.vue'

// ─── State ───
const loading = ref(false)
const error = ref<string | null>(null)
const interviews = ref<any[]>([])
const statusFilter = ref('')
const searchQuery = ref('')
const stats = ref({ total: 0, preparing: 0, ongoing: 0, completed: 0, cancelled: 0 })

// Detail drawer
const showDetail = ref(false)
const detail = ref<any>(null)
const detailLoading = ref(false)

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
  pending: '待定',
}

// ─── Helpers ───
function badgeVariant(status: string): string {
  const map: Record<string, string> = {
    preparing: 'warning',
    ongoing: 'info',
    completed: 'success',
    cancelled: 'danger',
  }
  return map[status] || 'default'
}

function recommendationLabel(rec: string): string {
  const map: Record<string, string> = {
    strong_yes: '强烈建议录用',
    yes: '建议录用',
    maybe: '值得考虑',
    no: '不建议录用',
    pending: '待评估',
  }
  return map[rec] || rec
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
      i.job?.title?.toLowerCase().includes(q) ||
      i.jobTitle?.toLowerCase().includes(q)
    )
  }
  return result
})

const todayInterviews = computed(() => {
  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)
  return interviews.value.filter((i: any) => {
    const created = i.createdAt ? new Date(i.createdAt).toISOString().slice(0, 10) : ''
    return created === todayStr
  })
})

const pendingEvalInterviews = computed(() => {
  return interviews.value.filter((i: any) => i.status === 'completed' && !i.evaluation?.overallScore)
})

// ─── Methods ───
function formatDate(date: string | Date | null): string {
  if (!date) return '-'
  const d = new Date(date)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (days === 0) return '今天 ' + d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  if (days === 1) return '昨天'
  if (days < 7) return `${days}天前`
  return d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
}

async function loadInterviews() {
  loading.value = true
  error.value = null
  try {
    const params = new URLSearchParams()
    if (statusFilter.value) params.set('status', statusFilter.value)

    const res = await fetch(`/api/enterprise/interviews?${params}`)
    if (!res.ok) {
      throw new Error(`请求失败 (${res.status})`)
    }
    const data = await res.json()
    interviews.value = data.items || []

    // Calculate stats
    stats.value = {
      total: interviews.value.length,
      preparing: interviews.value.filter((i: any) => i.status === 'preparing').length,
      ongoing: interviews.value.filter((i: any) => i.status === 'ongoing').length,
      completed: interviews.value.filter((i: any) => i.status === 'completed').length,
      cancelled: interviews.value.filter((i: any) => i.status === 'cancelled').length,
    }
  } catch (e: any) {
    console.error('加载面试列表失败', e)
    error.value = e.message || '加载失败'
  } finally {
    loading.value = false
  }
}

let searchTimer: any = null
function debounceSearch() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => loadInterviews(), 300)
}

function refresh() {
  loadInterviews()
}

function goToJobs() {
  window.location.href = '/workspace/enterprise/jobs'
}

async function openDetail(item: any) {
  showDetail.value = true
  detailLoading.value = true
  detail.value = null

  try {
    const res = await fetch(`/api/enterprise/interviews/${item.id}`)
    if (res.ok) {
      const data = await res.json()
      detail.value = data
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
}

// ─── Lifecycle ───
onMounted(() => {
  loadInterviews()
})
</script>

<style scoped>
.interview-workspace {
  padding: 0;
}

/* ─── Loading ─── */
.iv-loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 60px;
  color: var(--color-text-muted);
}

.iv-loading-spinner {
  width: 24px;
  height: 24px;
  border: 3px solid var(--color-border-primary);
  border-top-color: var(--color-decision);
  border-radius: 50%;
  animation: iv-spin 1s linear infinite;
}

@keyframes iv-spin {
  to { transform: rotate(360deg); }
}

/* ─── Error ─── */
.iv-error-state {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px;
  background: rgba(239, 68, 68, 0.06);
  border: 1px solid rgba(239, 68, 68, 0.15);
  border-radius: 10px;
}

.iv-error-icon {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(239, 68, 68, 0.1);
  color: #EF4444;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 700;
  flex-shrink: 0;
}

.iv-error-text {
  flex: 1;
}

.iv-error-text p {
  margin: 0;
  font-size: 13px;
  color: var(--color-text-secondary);
}

/* ─── Empty State ─── */
.iv-empty-state {
  text-align: center;
  padding: 40px 40px 60px;
}

.iv-empty-bob {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 24px;
  text-align: left;
  padding: 24px;
  background: rgba(99, 102, 241, 0.05);
  border: 1px solid rgba(99, 102, 241, 0.12);
  border-radius: 12px;
}

.iv-bob-avatar-lg {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: linear-gradient(135deg, #6366F1, #8B5CF6);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
}

.iv-bob-welcome h3 {
  font-size: 17px;
  font-weight: 600;
  margin: 0 0 6px;
  color: var(--color-text-primary);
}

.iv-bob-welcome p {
  font-size: 13px;
  line-height: 1.5;
  color: var(--color-text-secondary);
  margin: 0;
}

/* ─── Pending Section ─── */
.iv-pending-section {
  margin-bottom: 20px;
}

.iv-pending-cards {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding-bottom: 4px;
}

.iv-pending-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: rgba(245, 158, 11, 0.06);
  border: 1px solid rgba(245, 158, 11, 0.2);
  border-radius: 10px;
  cursor: pointer;
  white-space: nowrap;
  transition: border-color 0.15s;
  flex-shrink: 0;
}

.iv-pending-card:hover {
  border-color: #F59E0B;
}

.iv-pending-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(245, 158, 11, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
  color: #F59E0B;
  flex-shrink: 0;
}

.iv-pending-info {
  display: flex;
  flex-direction: column;
}

.iv-pending-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-primary);
}

.iv-pending-job {
  font-size: 11px;
  color: var(--color-text-muted);
}

.iv-pending-arrow {
  color: var(--color-text-muted);
  font-size: 14px;
}

/* ─── Today Section ─── */
.iv-today-section {
  margin-bottom: 20px;
}

.iv-section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: 12px;
}

.iv-today-cards {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  padding-bottom: 4px;
}

.iv-today-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: rgba(99, 102, 241, 0.06);
  border: 1px solid rgba(99, 102, 241, 0.15);
  border-radius: 10px;
  cursor: pointer;
  white-space: nowrap;
  transition: border-color 0.15s;
  flex-shrink: 0;
}

.iv-today-card:hover {
  border-color: var(--color-decision);
}

.iv-today-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--color-decision-glow);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-decision);
  flex-shrink: 0;
}

.iv-today-info {
  display: flex;
  flex-direction: column;
}

.iv-today-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-primary);
}

.iv-today-job {
  font-size: 11px;
  color: var(--color-text-muted);
}

/* ─── Bob Card ─── */
.iv-bob-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-primary);
  border-radius: 12px;
  margin-bottom: 20px;
}

.iv-bob-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.iv-bob-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, #6366F1, #8B5CF6);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
}

.iv-bob-info {
  display: flex;
  flex-direction: column;
}

.iv-bob-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.iv-bob-role {
  font-size: 12px;
  color: var(--color-text-muted);
}

.iv-bob-stats {
  display: flex;
  gap: 24px;
}

.iv-bob-stat {
  text-align: center;
}

.iv-bob-stat-val {
  display: block;
  font-size: 20px;
  font-weight: 700;
  color: var(--color-decision);
}

.iv-bob-stat-lbl {
  display: block;
  font-size: 10px;
  color: var(--color-text-muted);
  text-transform: uppercase;
}

/* ─── Interview List ─── */
.iv-list-header {
  margin-bottom: 12px;
}

.iv-list-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.iv-list {
  display: flex;
  flex-direction: column;
}

.iv-card {
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-primary);
  border-radius: 10px;
  padding: 14px 16px;
  cursor: pointer;
  transition: border-color 0.15s;
  margin-bottom: 8px;
}

.iv-card:hover {
  border-color: var(--color-decision);
}

.iv-card-main {
  display: flex;
  align-items: center;
  gap: 16px;
}

.iv-card-candidate {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.iv-cand-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--color-decision-glow);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-decision);
  flex-shrink: 0;
}

.iv-cand-info {
  flex: 1;
  min-width: 0;
}

.iv-cand-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-primary);
}

.iv-cand-job {
  font-size: 12px;
  color: var(--color-text-muted);
  margin-top: 2px;
}

.iv-card-meta {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-shrink: 0;
}

.iv-score-badge {
  padding: 3px 10px;
  background: rgba(16, 185, 129, 0.12);
  color: #10B981;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}

.iv-card-time {
  font-size: 12px;
  color: var(--color-text-muted);
  min-width: 70px;
  text-align: right;
}

.iv-card-action {
  flex-shrink: 0;
}

.iv-action-btn {
  padding: 5px 12px;
  border: 1px solid var(--color-border-primary);
  background: transparent;
  color: var(--color-text-secondary);
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  font-family: var(--font-family);
  transition: all 0.12s;
}

.iv-action-btn:hover {
  border-color: var(--color-decision);
  color: var(--color-decision);
}

/* ─── Drawer ─── */
.iv-drawer-overlay {
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

.iv-drawer-panel {
  width: 600px;
  max-width: 90vw;
  height: 100vh;
  background: var(--color-bg-primary);
  border-left: 1px solid var(--color-border-primary);
  overflow-y: auto;
  animation: iv-slide-in 0.2s ease;
}

@keyframes iv-slide-in {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}

.iv-drawer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid var(--color-border-primary);
  position: sticky;
  top: 0;
  background: var(--color-bg-primary);
  z-index: 1;
}

.iv-drawer-header h2 {
  margin: 0;
  font-size: 17px;
  color: var(--color-text-primary);
}

.iv-close-btn {
  width: 32px;
  height: 32px;
  border: 1px solid var(--color-border-primary);
  background: transparent;
  color: var(--color-text-secondary);
  border-radius: 8px;
  cursor: pointer;
  font-size: 16px;
  transition: all 0.12s;
}

.iv-close-btn:hover {
  border-color: var(--color-text-muted);
  color: var(--color-text-primary);
}

.iv-drawer-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 60px;
  color: var(--color-text-muted);
}

.iv-drawer-content {
  padding: 20px;
}

.iv-detail-section {
  margin-bottom: 24px;
  padding-bottom: 24px;
  border-bottom: 1px solid var(--color-border-primary);
}

.iv-detail-section:last-child {
  border-bottom: none;
}

.iv-section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.iv-detail-section h3 {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 12px;
  color: var(--color-text-primary);
}

.iv-overview-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.iv-ov-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.iv-ov-label {
  font-size: 11px;
  color: var(--color-text-muted);
}

.iv-ov-value {
  font-size: 13px;
  color: var(--color-text-primary);
}

/* ─── Evaluation ─── */
.iv-eval-card {
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-primary);
  border-radius: 8px;
  padding: 16px;
}

.iv-eval-scores {
  display: flex;
  gap: 16px;
  margin-bottom: 12px;
}

.iv-eval-score-item {
  text-align: center;
  flex: 1;
}

.iv-eval-score-val {
  display: block;
  font-size: 22px;
  font-weight: 700;
  color: var(--color-decision);
}

.iv-eval-score-lbl {
  display: block;
  font-size: 11px;
  color: var(--color-text-muted);
}

.iv-eval-summary {
  font-size: 13px;
  line-height: 1.5;
  color: var(--color-text-primary);
  margin-bottom: 8px;
}

.iv-eval-recommend {
  font-size: 13px;
  color: var(--color-execution);
  padding: 8px 12px;
  background: rgba(16, 185, 129, 0.08);
  border-radius: 6px;
}

.iv-rec-label {
  font-weight: 600;
}

/* ─── Questions ─── */
.iv-questions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.iv-question-item {
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-primary);
  border-radius: 8px;
  padding: 12px;
}

.iv-q-header {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 6px;
}

.iv-q-num {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-decision);
}

.iv-q-text {
  font-size: 13px;
  line-height: 1.5;
  color: var(--color-text-primary);
}

.iv-q-answer {
  margin-top: 8px;
  padding: 8px;
  background: var(--color-bg-primary);
  border-radius: 6px;
  font-size: 12px;
  color: var(--color-text-secondary);
}

/* ─── Decision ─── */
.iv-decision-result {
  padding: 14px;
  border-radius: 8px;
  text-align: center;
}

.iv-dr--recommend_offer {
  background: rgba(16, 185, 129, 0.08);
  border: 1px solid rgba(16, 185, 129, 0.2);
}

.iv-dr--hold {
  background: rgba(245, 158, 11, 0.08);
  border: 1px solid rgba(245, 158, 11, 0.2);
}

.iv-dr--reject {
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.2);
}

.iv-dr-label {
  display: block;
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 4px;
}

.iv-dr--recommend_offer .iv-dr-label { color: #10B981; }
.iv-dr--hold .iv-dr-label { color: #F59E0B; }
.iv-dr--reject .iv-dr-label { color: #EF4444; }

.iv-dr-reason {
  font-size: 12px;
  color: var(--color-text-muted);
}

/* ─── Notes ─── */
.iv-notes-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.iv-note-item {
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-primary);
  border-radius: 8px;
  padding: 12px;
}

.iv-note-content {
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
  color: var(--color-text-primary);
}

.iv-note-meta {
  margin-top: 6px;
  font-size: 11px;
  color: var(--color-text-muted);
}

.iv-empty-text {
  font-size: 13px;
  color: var(--color-text-muted);
  text-align: center;
  padding: 20px;
}
</style>
