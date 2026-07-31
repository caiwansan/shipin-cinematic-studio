<template>
  <div class="candidates-page">
    <RecruitmentPageShell>
      <template #title>候选人</template>
      <template #subtitle>候选人档案管理中心 — 每位候选人完整画像：基础信息、技能经验、AI 评分、匹配岗位、面试记录、AI 推荐</template>
      <template #actions>
        <RecruitmentSecondaryButton :disabled="loading" @click="refresh">
          刷新
        </RecruitmentSecondaryButton>
      </template>
      <template #filters>
        <div class="cp-filter-row">
          <RecruitmentSelect v-model="stageFilter" @change="refresh">
            <option value="">全部阶段</option>
            <option value="discovered">初筛</option>
            <option value="screening">筛选</option>
            <option value="interview">面试</option>
            <option value="offer">Offer</option>
            <option value="hired">已录用</option>
            <option value="rejected">已淘汰</option>
          </RecruitmentSelect>
          <RecruitmentInput v-model="searchQuery" @input="debounceSearch" placeholder="搜索候选人姓名..." />
        </div>
      </template>

      <!-- Loading State -->
      <div v-if="loading" class="cp-loading-state">
        <div class="cp-loading-spinner"></div>
        <span>加载候选人列表...</span>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="cp-error-state">
        <div class="cp-error-icon">!</div>
        <div class="cp-error-text">
          <p>{{ error }}</p>
        </div>
        <RecruitmentPrimaryButton @click="refresh">重新加载</RecruitmentPrimaryButton>
      </div>

      <!-- Empty State -->
      <div v-else-if="filteredCandidates.length === 0" class="cp-empty-state">
        <div class="cp-empty-icon">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <circle cx="20" cy="16" r="6" stroke="currentColor" stroke-width="2" fill="none"/>
            <path d="M8 42c0-9 5.4-14 12-14s12 5 12 14" stroke="currentColor" stroke-width="2" fill="none"/>
            <rect x="30" y="10" width="14" height="20" rx="2" stroke="currentColor" stroke-width="1.5" fill="none" opacity="0.3"/>
          </svg>
        </div>
        <h3>暂无候选人</h3>
        <p>创建招聘岗位后，AI 人才分析师 Carol 会主动搜索和匹配候选人。先创建一个职位吧。</p>
        <RecruitmentPrimaryButton @click="goToJobs">去创建职位</RecruitmentPrimaryButton>
      </div>

      <!-- Candidate Table -->
      <div v-else class="cp-candidate-table">
        <!-- Table Header -->
        <div class="cp-tbl-header">
          <div class="cp-tbl-th cp-th-name">候选人</div>
          <div class="cp-tbl-th cp-th-job">匹配岗位</div>
          <div class="cp-tbl-th cp-th-skills">技能</div>
          <div class="cp-tbl-th cp-th-score">AI 评分</div>
          <div class="cp-tbl-th cp-th-stage">阶段</div>
          <div class="cp-tbl-th cp-th-active">最近活跃</div>
        </div>

        <!-- Table Rows -->
        <div
          v-for="c in paginatedCandidates"
          :key="c.id"
          class="cp-tbl-row"
          @click="goToCandidate(c.id)"
        >
          <div class="cp-tbl-td cp-td-name">
            <div class="cp-avatar">{{ (c.fullName || c.candidateName || '?').charAt(0) }}</div>
            <div class="cp-name-info">
              <span class="cp-name-text">{{ c.fullName || c.candidateName || '未命名候选人' }}</span>
              <span v-if="c.city || c.education" class="cp-name-meta">
                {{ c.city || '' }}{{ c.city && c.education ? ' · ' : '' }}{{ c.education || '' }}
              </span>
            </div>
          </div>
          <div class="cp-tbl-td cp-td-job">
            <span class="cp-job-text">{{ c.jobTitle || '—' }}</span>
          </div>
          <div class="cp-tbl-td cp-td-skills">
            <div class="cp-skills-row" v-if="c.skills?.length">
              <RecruitmentBadge v-for="s in c.skills.slice(0, 3)" :key="s" variant="info" class="cp-skill-badge">{{ s }}</RecruitmentBadge>
              <span v-if="c.skills.length > 3" class="cp-more-skills">+{{ c.skills.length - 3 }}</span>
            </div>
            <span v-else class="cp-no-data">—</span>
          </div>
          <div class="cp-tbl-td cp-td-score">
            <div class="cp-score-display" v-if="c.matchScore != null">
              <div class="cp-score-bar-bg">
                <div class="cp-score-bar-fill" :style="{ width: Math.min(c.matchScore, 100) + '%', background: scoreColor(c.matchScore) }"></div>
              </div>
              <span class="cp-score-val" :style="{ color: scoreColor(c.matchScore) }">{{ Math.round(c.matchScore) }}</span>
            </div>
            <span v-else class="cp-no-data">—</span>
          </div>
          <div class="cp-tbl-td cp-td-stage">
            <RecruitmentBadge :variant="stageVariant(c.stage || c.matchStatus)">{{ stageLabel(c.stage || c.matchStatus) }}</RecruitmentBadge>
          </div>
          <div class="cp-tbl-td cp-td-active">
            <span class="cp-active-text">{{ formatDate(c.matchedAt || c.updatedAt || c.createdAt) }}</span>
          </div>
        </div>

        <!-- Pagination -->
        <div v-if="totalPages > 1" class="cp-pagination">
          <button
            class="cp-page-btn"
            :disabled="currentPage <= 1"
            @click="currentPage = Math.max(1, currentPage - 1)"
          >
            &laquo; 上一页
          </button>
          <template v-for="p in totalPages" :key="p">
            <button
              v-if="p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2"
              class="cp-page-btn"
              :class="{ active: p === currentPage }"
              @click="currentPage = p"
            >
              {{ p }}
            </button>
            <span
              v-else-if="p === currentPage - 3 || p === currentPage + 3"
              class="cp-page-ellipsis"
            >...</span>
          </template>
          <button
            class="cp-page-btn"
            :disabled="currentPage >= totalPages"
            @click="currentPage = Math.min(totalPages, currentPage + 1)"
          >
            下一页 &raquo;
          </button>
          <span class="cp-page-info">共 {{ filteredCandidates.length }} 条</span>
        </div>
      </div>
    </RecruitmentPageShell>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'enterprise-workspace' })

import { ref, computed, watch, onMounted } from 'vue'
import { getAuthToken } from '~/utils/auth/token'

import RecruitmentInput from '~/components/enterprise/recruitment/ui/RecruitmentInput.vue'
import RecruitmentPrimaryButton from '~/components/enterprise/recruitment/ui/RecruitmentPrimaryButton.vue'
import RecruitmentSecondaryButton from '~/components/enterprise/recruitment/ui/RecruitmentSecondaryButton.vue'
import RecruitmentSelect from '~/components/enterprise/recruitment/ui/RecruitmentSelect.vue'
import RecruitmentBadge from '~/components/enterprise/recruitment/ui/RecruitmentBadge.vue'
import RecruitmentPageShell from '~/components/enterprise/recruitment/ui/RecruitmentPageShell.vue'

const loading = ref(false)
const error = ref<string | null>(null)
const candidates = ref<any[]>([])
const stageFilter = ref('')
const searchQuery = ref('')

// Pagination
const currentPage = ref(1)
const pageSize = 20
const totalItems = ref(0)
const totalPages = computed(() => Math.max(1, Math.ceil(filteredCandidates.value.length / pageSize)))
const paginatedCandidates = computed(() => {
  const all = filteredCandidates.value
  const start = (currentPage.value - 1) * pageSize
  return all.slice(start, start + pageSize)
})

const stageLabels: Record<string, string> = {
  discovered: '初筛',
  screening: '筛选',
  interview: '面试',
  offer: 'Offer',
  hired: '已录用',
  rejected: '已淘汰',
  matched: '已匹配',
  new: '新候选人',
}

function stageLabel(stage: string): string {
  return stageLabels[stage] || stage || '—'
}

function stageVariant(stage: string): string {
  const map: Record<string, string> = {
    discovered: 'neutral',
    screening: 'warning',
    interview: 'info',
    offer: 'success',
    hired: 'success',
    rejected: 'danger',
    matched: 'info',
    new: 'neutral',
  }
  return map[stage] || 'default'
}

function scoreColor(score: number): string {
  if (score >= 80) return '#10B981'
  if (score >= 60) return '#F59E0B'
  return '#EF4444'
}

function formatDate(d: string | null | undefined): string {
  if (!d) return '—'
  const date = new Date(d)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (days === 0) return '今天'
  if (days === 1) return '昨天'
  if (days < 7) return `${days}天前`
  return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
}

const filteredCandidates = computed(() => {
  let result = candidates.value
  if (stageFilter.value) {
    result = result.filter(c => (c.stage || c.matchStatus) === stageFilter.value)
  }
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(c => (c.fullName || c.candidateName || '').toLowerCase().includes(q))
  }
  return result
})

async function refresh(page = 1) {
  loading.value = true
  error.value = null
  currentPage.value = page
  try {
    const token = getAuthToken() || ''
    const res = await fetch(`/api/enterprise/candidates?page=${page}&pageSize=100`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!res.ok) {
      throw new Error(`请求失败 (${res.status})`)
    }
    const data = await res.json()
    if (data.success && Array.isArray(data.candidates)) {
      candidates.value = data.candidates
      totalItems.value = data.total || 0
    } else {
      candidates.value = []
    }
  } catch (e: any) {
    console.error('Failed to load candidates', e)
    error.value = e.message || '加载候选人列表失败'
  } finally {
    loading.value = false
  }
}

let searchTimer: any = null
function debounceSearch() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    // Just filter local data, no extra API call
  }, 300)
}

function goToJobs() {
  window.location.href = '/workspace/enterprise/jobs'
}

function goToCandidate(id: string) {
  window.location.href = `/workspace/enterprise/candidates/${id}`
}

// Reset pagination when filters change
watch([stageFilter, searchQuery], () => {
  currentPage.value = 1
})

onMounted(() => refresh(1))
</script>

<style scoped>
.candidates-page {
  padding: 0;
}

/* ─── Filter Row ─── */
.cp-filter-row {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}

/* ─── Loading ─── */
.cp-loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 60px;
  color: var(--color-text-muted);
}

.cp-loading-spinner {
  width: 24px;
  height: 24px;
  border: 3px solid var(--color-border-primary);
  border-top-color: var(--color-decision);
  border-radius: 50%;
  animation: cp-spin 1s linear infinite;
}

@keyframes cp-spin {
  to { transform: rotate(360deg); }
}

/* ─── Error ─── */
.cp-error-state {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px;
  background: rgba(239, 68, 68, 0.06);
  border: 1px solid rgba(239, 68, 68, 0.15);
  border-radius: 10px;
}

.cp-error-icon {
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

.cp-error-text {
  flex: 1;
}

.cp-error-text p {
  margin: 0;
  font-size: 13px;
  color: var(--color-text-secondary);
}

/* ─── Empty ─── */
.cp-empty-state {
  text-align: center;
  padding: 60px 40px;
}

.cp-empty-icon {
  color: var(--color-text-muted);
  opacity: 0.4;
  margin-bottom: 16px;
}

.cp-empty-state h3 {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: 8px;
}

.cp-empty-state p {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin-bottom: 20px;
}

/* ─── Table ─── */
.cp-candidate-table {
  border: 1px solid var(--color-border-primary);
  border-radius: 10px;
  overflow: hidden;
}

.cp-tbl-header {
  display: flex;
  align-items: center;
  background: var(--color-bg-secondary);
  border-bottom: 1px solid var(--color-border-primary);
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.cp-tbl-th {
  padding: 12px 16px;
}

.cp-th-name { flex: 2; min-width: 0; }
.cp-th-job { flex: 1.5; min-width: 0; }
.cp-th-skills { flex: 2; min-width: 0; }
.cp-th-score { width: 120px; text-align: center; }
.cp-th-stage { width: 80px; text-align: center; }
.cp-th-active { width: 80px; text-align: center; }

.cp-tbl-row {
  display: flex;
  align-items: center;
  border-bottom: 1px solid var(--color-border-primary);
  cursor: pointer;
  transition: background 0.1s;
}

.cp-tbl-row:last-child {
  border-bottom: none;
}

.cp-tbl-row:hover {
  background: var(--color-bg-hover);
}

.cp-tbl-td {
  padding: 14px 16px;
  font-size: 13px;
  color: var(--color-text-primary);
}

.cp-td-name { flex: 2; min-width: 0; }
.cp-td-job { flex: 1.5; min-width: 0; }
.cp-td-skills { flex: 2; min-width: 0; }
.cp-td-score { width: 120px; text-align: center; }
.cp-td-stage { width: 80px; text-align: center; }
.cp-td-active { width: 80px; text-align: center; }

/* ─── Name Cell ─── */
.cp-td-name {
  display: flex;
  align-items: center;
  gap: 12px;
}

.cp-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(139, 92, 246, 0.15));
  border: 1px solid rgba(99, 102, 241, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-decision);
  flex-shrink: 0;
}

.cp-name-info {
  flex: 1;
  min-width: 0;
}

.cp-name-text {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-primary);
}

.cp-name-meta {
  display: block;
  font-size: 11px;
  color: var(--color-text-muted);
  margin-top: 2px;
}

/* ─── Job Cell ─── */
.cp-job-text {
  font-size: 13px;
  color: var(--color-text-secondary);
}

/* ─── Skills Cell ─── */
.cp-skills-row {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  align-items: center;
}

.cp-skill-badge {
  font-size: 11px;
}

.cp-more-skills {
  font-size: 11px;
  color: var(--color-text-muted);
  padding: 0 4px;
}

.cp-no-data {
  font-size: 12px;
  color: var(--color-text-muted);
}

/* ─── Score Cell ─── */
.cp-score-display {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.cp-score-bar-bg {
  width: 50px;
  height: 5px;
  background: var(--color-border-primary);
  border-radius: 3px;
  overflow: hidden;
}

.cp-score-bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s ease;
}

.cp-score-val {
  font-size: 13px;
  font-weight: 700;
  min-width: 24px;
}

/* ─── Active Cell ─── */
.cp-active-text {
  font-size: 12px;
  color: var(--color-text-secondary);
}

/* ─── Pagination ─── */
.cp-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 16px 16px 20px;
  flex-wrap: wrap;
  border-top: 1px solid var(--color-border-primary);
}

.cp-page-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 36px;
  height: 36px;
  padding: 0 10px;
  border: 1px solid var(--color-border-primary);
  border-radius: 8px;
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 13px;
  font-family: var(--font-family);
  cursor: pointer;
  transition: all 0.12s;
}

.cp-page-btn:hover:not(:disabled) {
  border-color: var(--color-decision);
  color: var(--color-decision);
}

.cp-page-btn.active {
  background: var(--color-decision-glow);
  border-color: var(--color-decision);
  color: var(--color-decision);
  font-weight: 600;
}

.cp-page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.cp-page-ellipsis {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  color: var(--color-text-muted);
  font-size: 13px;
}

.cp-page-info {
  margin-left: 12px;
  font-size: 12px;
  color: var(--color-text-muted);
}
</style>
