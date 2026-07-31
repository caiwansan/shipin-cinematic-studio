<template>
  <div class="talent-page">
    <RecruitmentPageShell>
      <template #title>人才库</template>
      <template #subtitle>企业人才资产中心 — 累计人才池、AI 发现、高匹配候选人、人才趋势。AI 人才分析师 Carol 持续为您筛选和评估</template>
      <template #actions>
        <RecruitmentSecondaryButton :disabled="isSearching" @click="refreshTalent">
          刷新
        </RecruitmentSecondaryButton>
      </template>
      <template #stats>
        <RecruitmentStatCard :value="stats.total" label="累计人才" color="--color-decision" />
        <RecruitmentStatCard :value="stats.aiScreened" label="AI 筛选人才" color="--color-execution" />
        <RecruitmentStatCard :value="stats.highMatch" label="高匹配候选" color="--color-warning" />
      </template>
      <template #filters>
        <div class="tp-search-bar">
          <div class="tp-search-field">
            <label class="tp-field-label">岗位</label>
            <RecruitmentSelect v-model="searchParams.jobId" @change="handleSearch">
              <option value="">全部岗位</option>
              <option v-for="job in jobs" :key="job.id" :value="job.id">
                {{ job.title }}
              </option>
            </RecruitmentSelect>
          </div>
          <div class="tp-search-field">
            <label class="tp-field-label">技能</label>
            <RecruitmentInput
              v-model="searchParams.skills"
              placeholder="技能关键词"
              @input="searchParams.skills = $event.target.value"
            />
          </div>
          <div class="tp-search-field">
            <label class="tp-field-label">经验</label>
            <RecruitmentSelect v-model="searchParams.experience">
              <option value="">不限</option>
              <option value="junior">1-3年</option>
              <option value="mid">3-5年</option>
              <option value="senior">5-10年</option>
              <option value="expert">10年+</option>
            </RecruitmentSelect>
          </div>
          <RecruitmentPrimaryButton :disabled="isSearching" @click="handleSearch" class="tp-search-btn">
            <span v-if="isSearching" class="tp-loading-text">搜索中...</span>
            <span v-else>搜索</span>
          </RecruitmentPrimaryButton>
        </div>
      </template>

      <!-- Loading State -->
      <div v-if="isSearching" class="tp-loading-state">
        <div class="tp-loading-spinner"></div>
        <span>AI 人才分析师 Carol 正在筛选候选人...</span>
      </div>

      <!-- Error State -->
      <div v-else-if="searchError" class="tp-error-state">
        <div class="tp-error-icon">!</div>
        <div class="tp-error-text">
          <p>{{ searchError }}</p>
        </div>
        <RecruitmentPrimaryButton @click="handleSearch">重试</RecruitmentPrimaryButton>
      </div>

      <!-- Talent List -->
      <div v-else-if="candidates.length > 0" class="tp-talent-list">
        <!-- Persistent Carol Assistant -->
        <div class="tp-carol-mini">
          <div class="tp-carol-mini-avatar">C</div>
          <div class="tp-carol-mini-text">
            AI 人才分析师 Carol 在线 — 可对每位候选人进行深度分析
          </div>
        </div>
        <div class="tp-talent-header">
          <span class="tp-talent-count">共 {{ candidates.length }} 位候选人</span>
          <span class="tp-talent-hint">AI 评分基于技能匹配度和经验分析</span>
        </div>

        <div class="tp-talent-grid">
          <div
            v-for="c in candidates"
            :key="c.id"
            class="tp-talent-card"
          >
            <div class="tp-card-top">
              <div class="tp-card-avatar">{{ (c.fullName || c.candidateName || '?').charAt(0) }}</div>
              <div class="tp-card-name-area">
                <span class="tp-card-name">{{ c.fullName || c.candidateName || '候选人' }}</span>
                <span class="tp-card-job" v-if="c.jobTitle">{{ c.jobTitle }}</span>
              </div>
              <div class="tp-card-score" :class="scoreClass(c.matchScore || c.score)">
                <span class="tp-score-num">{{ c.matchScore || c.score || '--' }}</span>
                <span class="tp-score-label">AI 评分</span>
              </div>
            </div>

            <div class="tp-card-skills" v-if="c.skills?.length">
              <RecruitmentBadge v-for="skill in c.skills.slice(0, 6)" :key="skill" variant="info">{{ skill }}</RecruitmentBadge>
              <span v-if="c.skills.length > 6" class="tp-more-skills">+{{ c.skills.length - 6 }}</span>
            </div>

            <div class="tp-card-reason" v-if="c.reasoning || c.recommendation">
              <span class="tp-reason-label">推荐理由</span>
              <span class="tp-reason-text">{{ c.reasoning || c.recommendation }}</span>
            </div>

            <div class="tp-card-footer">
              <button class="tp-footer-btn" @click="openMatchDetail(c)">
                <span>匹配详情</span>
              </button>
              <button class="tp-footer-btn tp-footer-btn--primary" @click="handleCarolAnalyze(c)">
                <span>Carol 分析</span>
              </button>
            </div>

            <!-- Carol Analysis Result -->
            <div v-if="carolResults[c.id]" class="tp-carol-result">
              <div class="tp-carol-header">
                <span>Carol 人才分析师</span>
                <button class="tp-carol-close" @click="clearCarolResult(c.id)">✕</button>
              </div>
              <div class="tp-carol-content" v-html="formatCarolResult(carolResults[c.id])"></div>
            </div>
          </div>
        </div>

        <!-- Pagination -->
        <div v-if="totalPages > 1" class="tp-pagination">
          <button
            class="tp-page-btn"
            :disabled="currentPage <= 1"
            @click="goToPage(currentPage - 1)"
          >
            &laquo; 上一页
          </button>
          <template v-for="p in totalPages" :key="p">
            <button
              v-if="p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2"
              class="tp-page-btn"
              :class="{ active: p === currentPage }"
              @click="goToPage(p)"
            >
              {{ p }}
            </button>
            <span
              v-else-if="p === currentPage - 3 || p === currentPage + 3"
              class="tp-page-ellipsis"
            >...</span>
          </template>
          <button
            class="tp-page-btn"
            :disabled="currentPage >= totalPages"
            @click="goToPage(currentPage + 1)"
          >
            下一页 &raquo;
          </button>
          <span class="tp-page-info">共 {{ totalItems }} 条</span>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else-if="hasSearched" class="tp-empty-state">
        <div class="tp-empty-icon">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <circle cx="20" cy="20" r="12" stroke="currentColor" stroke-width="2" fill="none"/>
            <path d="M29 29l10 10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <rect x="12" y="10" width="24" height="28" rx="2" stroke="currentColor" stroke-width="1.5" fill="none" opacity="0.3"/>
          </svg>
        </div>
        <h3>暂无匹配候选人</h3>
        <p>没有匹配结果。尝试选择其他岗位、调整技能关键词，或让 Carol 重新搜索。创建更多招聘岗位后，Carol 会自动扩大搜索范围。</p>
      </div>

      <!-- Initial State -->
      <div v-else class="tp-initial-state">
        <div class="tp-carol-welcome">
          <div class="tp-carol-avatar-lg">C</div>
          <div class="tp-carol-welcome-text">
            <h3>AI 人才分析师 Carol</h3>
            <p>选择岗位或输入技能关键词，Carol 将为您分析企业人才库中的候选人，提供 AI 评分和匹配建议</p>
          </div>
        </div>
        <div class="tp-init-hints">
          <div class="tp-hint-card">
            <span class="tp-hint-title">技能匹配分析</span>
            <span class="tp-hint-desc">基于候选人技能与岗位需求的 AI 匹配度评估</span>
          </div>
          <div class="tp-hint-card">
            <span class="tp-hint-title">高匹配推荐</span>
            <span class="tp-hint-desc">智能识别最符合岗位要求的候选人</span>
          </div>
          <div class="tp-hint-card">
            <span class="tp-hint-title">深度分析报告</span>
            <span class="tp-hint-desc">Carol 为每位候选人输出详细的人才评估报告</span>
          </div>
        </div>
      </div>
    </RecruitmentPageShell>

    <!-- Match Detail Drawer -->
    <Teleport to="body">
      <div v-if="showMatchDetail && selectedCandidate" class="tp-mask" @click.self="closeMatchDetail">
        <div class="tp-drawer">
          <div class="tp-drawer-header">
            <div class="tp-drawer-title">
              <span class="tp-drawer-name">{{ selectedCandidate.fullName || '候选人' }}</span>
              <span class="tp-drawer-job" v-if="selectedCandidate.jobTitle">匹配岗位：{{ selectedCandidate.jobTitle }}</span>
            </div>
            <button class="tp-drawer-close" @click="closeMatchDetail">&#x2715;</button>
          </div>

          <div class="tp-drawer-body">
            <!-- Overall Score -->
            <div class="tp-m-score-hero">
              <div class="tp-m-score-ring" :style="{ borderColor: scoreColor(selectedCandidate.matchScore || 0) }">
                <span class="tp-m-score-num">{{ selectedCandidate.matchScore || '--' }}</span>
                <span class="tp-m-score-label">匹配度</span>
              </div>
              <div class="tp-m-score-desc">
                <span class="tp-m-score-heading">AI 匹配分析报告</span>
                <span class="tp-m-score-sub">基于岗位需求与候选人画像的多维度 AI 评估</span>
              </div>
            </div>

            <!-- Breakdown Bars -->
            <div class="tp-m-section">
              <span class="tp-m-section-title">匹配维度分解</span>
              <div class="tp-m-breakdowns">
                <div v-for="item in getBreakdownScores(selectedCandidate.matchBreakdown)" :key="item.label" class="tp-m-breakdown-row">
                  <span class="tp-m-bd-label">{{ item.label }}</span>
                  <div class="tp-m-bd-bar-track">
                    <div
                      class="tp-m-bd-bar-fill"
                      :style="{
                        width: item.score + '%',
                        background: scoreColor(item.score)
                      }"
                    ></div>
                  </div>
                  <span class="tp-m-bd-score" :style="{ color: scoreColor(item.score) }">{{ item.score }}%</span>
                </div>
              </div>
            </div>

            <!-- AI Analysis -->
            <div v-if="selectedCandidate.aiAnalysis" class="tp-m-section">
              <span class="tp-m-section-title">AI 分析</span>
              <p class="tp-m-analysis-text">{{ selectedCandidate.aiAnalysis }}</p>
            </div>

            <!-- Reasoning -->
            <div v-if="selectedCandidate.reasoning || selectedCandidate.recommendation" class="tp-m-section">
              <span class="tp-m-section-title">推荐理由</span>
              <p class="tp-m-analysis-text">{{ selectedCandidate.reasoning || selectedCandidate.recommendation }}</p>
            </div>

            <!-- Risk Assessment -->
            <div v-if="selectedCandidate.risks?.length" class="tp-m-section">
              <span class="tp-m-section-title tp-m-section-risk">风险提示</span>
              <ul class="tp-m-risk-list">
                <li v-for="(risk, ri) in selectedCandidate.risks" :key="ri" class="tp-m-risk-item">{{ risk }}</li>
              </ul>
            </div>

            <!-- Skills -->
            <div v-if="selectedCandidate.skills?.length" class="tp-m-section">
              <span class="tp-m-section-title">技能标签</span>
              <div class="tp-m-skills">
                <span v-for="skill in selectedCandidate.skills" :key="skill" class="tp-m-skill-badge">{{ skill }}</span>
              </div>
            </div>

            <!-- Suggestion -->
            <div class="tp-m-section">
              <span class="tp-m-section-title">建议</span>
              <p class="tp-m-suggestion">
                <template v-if="(selectedCandidate.matchScore || 0) >= 80">高度匹配，建议优先安排面试</template>
                <template v-else-if="(selectedCandidate.matchScore || 0) >= 60">匹配度良好，可以考虑安排面试</template>
                <template v-else>匹配度一般，建议进一步了解后再做决定</template>
              </p>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'enterprise-workspace' })

import { ref, computed, onMounted } from 'vue'
import { getAuthToken } from '~/utils/auth/token'

import RecruitmentInput from '~/components/enterprise/recruitment/ui/RecruitmentInput.vue'
import RecruitmentPrimaryButton from '~/components/enterprise/recruitment/ui/RecruitmentPrimaryButton.vue'
import RecruitmentSecondaryButton from '~/components/enterprise/recruitment/ui/RecruitmentSecondaryButton.vue'
import RecruitmentSelect from '~/components/enterprise/recruitment/ui/RecruitmentSelect.vue'
import RecruitmentStatCard from '~/components/enterprise/recruitment/ui/RecruitmentStatCard.vue'
import RecruitmentBadge from '~/components/enterprise/recruitment/ui/RecruitmentBadge.vue'
import RecruitmentPageShell from '~/components/enterprise/recruitment/ui/RecruitmentPageShell.vue'

// ─── State ───
const isSearching = ref(false)
const searchError = ref('')
const hasSearched = ref(false)
const jobs = ref<any[]>([])
const candidates = ref<any[]>([])
const carolResults = ref<Record<string, any>>({})

// Match Detail State
const showMatchDetail = ref(false)
const selectedCandidate = ref<any>(null)

// Pagination State
const currentPage = ref(1)
const pageSize = ref(20)
const totalItems = ref(0)
const totalPages = computed(() => Math.max(1, Math.ceil(totalItems.value / pageSize.value)))

const searchParams = ref({
  jobId: '',
  skills: '',
  experience: '',
})

const stats = ref({
  total: 0,
  aiScreened: 0,
  highMatch: 0,
})

// ─── Load Jobs ───
async function loadJobs() {
  try {
    const token = getAuthToken() || ''
    const res = await fetch('/api/enterprise/postings', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (res.ok) {
      const data = await res.json()
      jobs.value = data.data || []
    }
  } catch (e) {
    console.error('Failed to load jobs:', e)
  }
}

// ─── Load Candidates ───
async function loadCandidates(page = 1) {
  try {
    const token = getAuthToken() || ''
    const res = await fetch(`/api/enterprise/candidates?page=${page}&pageSize=${pageSize.value}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (res.ok) {
      const data = await res.json()
      const items = data.candidates || []
      candidates.value = items
      totalItems.value = data.total || 0
      currentPage.value = page
      updateStatsAll(items, data.total || 0)
    }
  } catch (e) {
    console.error('Failed to load candidates:', e)
  }
}

function updateStatsAll(currentItems: any[], total: number) {
  const highMatch = currentItems.filter((c: any) => (c.matchScore || 0) >= 80).length
  stats.value = {
    total,
    aiScreened: currentItems.filter((c: any) => c.matchScore != null).length,
    highMatch,
  }
}

// ─── Search ───
async function handleSearch(page = 1) {
  isSearching.value = true
  searchError.value = ''
  hasSearched.value = true

  try {
    if (searchParams.value.jobId) {
      // Use talent agent API for job-specific search
      const token = getAuthToken() || ''
      const res = await fetch('/api/enterprise/agents/talent/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          jobId: searchParams.value.jobId,
          limit: pageSize.value,
        }),
      })

      if (res.ok) {
        const json = await res.json()
        if (json.success && json.result) {
          const results = Array.isArray(json.result) ? json.result : [json.result]
          candidates.value = results.map((r: any) => ({
            id: r.candidateId || r.id,
            fullName: r.candidateName || r.fullName,
            skills: r.skills || r.matchedSkills || [],
            jobTitle: r.jobTitle || '',
            matchScore: r.score || r.matchScore,
            reasoning: r.reasoning || r.recommendation || '',
            recommendation: r.recommendation || '',
          }))
          const total = candidates.value.length
          totalItems.value = total
          currentPage.value = 1
          updateStatsAll(candidates.value, total)
          isSearching.value = false
          return
        }
      }
    }

    // Fallback: load all candidates with pagination
    await loadCandidates(page)
  } catch (e: any) {
    searchError.value = e.message || '搜索失败'
    await loadCandidates(page)
  } finally {
    isSearching.value = false
  }
}

function refreshTalent() {
  handleSearch(1)
}

function goToPage(page: number) {
  if (page < 1 || page > totalPages.value) return
  handleSearch(page)
}

// ─── Carol Analysis ───
async function handleCarolAnalyze(candidate: any) {
  try {
    const token = getAuthToken() || ''
    const res = await fetch('/api/enterprise/agents/talent/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ candidateId: candidate.id }),
    })
    if (res.ok) {
      const json = await res.json()
      if (json.success && json.result) {
        carolResults.value[candidate.id] = json.result
      }
    }
  } catch (e: any) {
    carolResults.value[candidate.id] = { content: `分析失败: ${e.message}` }
  }
}

function clearCarolResult(candidateId: string) {
  delete carolResults.value[candidateId]
}

function formatCarolResult(result: any): string {
  if (!result) return ''
  const content = result.content || (typeof result === 'string' ? result : JSON.stringify(result))
  return content
    .replace(/^### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^## (.+)$/gm, '<h3>$1</h3>')
    .replace(/^# (.+)$/gm, '<h2>$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/\n/g, '<br>')
}

function scoreClass(score: number): string {
  if (!score && score !== 0) return ''
  if (score >= 80) return 'score-high'
  if (score >= 60) return 'score-mid'
  return 'score-low'
}

function openMatchDetail(candidate: any) {
  selectedCandidate.value = candidate
  showMatchDetail.value = true
}

function closeMatchDetail() {
  showMatchDetail.value = false
  selectedCandidate.value = null
}

function getBreakdownScores(breakdown: any): { label: string; score: number }[] {
  if (!breakdown) return []
  const labels: Record<string, string> = {
    skills: '技能匹配',
    experience: '经验匹配',
    city: '城市匹配',
    salary: '薪资匹配',
    education: '学历匹配',
  }
  return Object.keys(labels)
    .filter(k => breakdown[k] !== undefined && breakdown[k] !== null)
    .map(k => ({ label: labels[k], score: Math.round(breakdown[k]) }))
}

function scoreColor(score: number): string {
  if (score >= 80) return 'var(--color-match-high)'
  if (score >= 60) return 'var(--color-match-mid)'
  return 'var(--color-match-low)'
}

// ─── Init ───
onMounted(async () => {
  await loadJobs()
  await loadCandidates()
})
</script>

<style scoped>
.talent-page {
  padding: 0;
}

/* ─── Search Bar ─── */
.tp-search-bar {
  display: flex;
  gap: 12px;
  align-items: flex-end;
  flex-wrap: wrap;
  width: 100%;
}

.tp-search-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  min-width: 140px;
}

.tp-field-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.tp-search-btn {
  white-space: nowrap;
  flex-shrink: 0;
}

.tp-loading-text {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* ─── Loading ─── */
.tp-loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 60px 24px;
  color: var(--color-text-muted);
}

.tp-loading-spinner {
  width: 24px;
  height: 24px;
  border: 3px solid var(--color-border-primary);
  border-top-color: var(--color-decision);
  border-radius: 50%;
  animation: tp-spin 0.8s linear infinite;
}

@keyframes tp-spin {
  to { transform: rotate(360deg); }
}

/* ─── Error ─── */
.tp-error-state {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px;
  background: rgba(245, 158, 11, 0.08);
  border: 1px solid rgba(245, 158, 11, 0.2);
  border-radius: 10px;
}

.tp-error-icon {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(245, 158, 11, 0.15);
  color: #F59E0B;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 700;
  flex-shrink: 0;
}

.tp-error-text {
  flex: 1;
}

.tp-error-text p {
  margin: 0;
  font-size: 13px;
  color: var(--color-text-secondary);
}

/* ─── Carol Mini (persistent) ─── */
.tp-carol-mini {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  background: rgba(245, 158, 11, 0.06);
  border: 1px solid rgba(245, 158, 11, 0.15);
  border-radius: 8px;
  margin-bottom: 16px;
}

.tp-carol-mini-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, #F59E0B, #F97316);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
}

.tp-carol-mini-text {
  font-size: 13px;
  color: var(--color-text-secondary);
  line-height: 1.4;
}

/* ─── Talent List ─── */
.tp-talent-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.tp-talent-count {
  font-size: 13px;
  color: var(--color-text-secondary);
  font-weight: 500;
}

.tp-talent-hint {
  font-size: 12px;
  color: var(--color-text-muted);
}

.tp-talent-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 16px;
}

.tp-talent-card {
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-primary);
  border-radius: 12px;
  padding: 20px;
  transition: border-color 0.15s;
}

.tp-talent-card:hover {
  border-color: var(--color-decision-glow);
}

.tp-card-top {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.tp-card-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(139, 92, 246, 0.15));
  border: 1px solid rgba(99, 102, 241, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 600;
  color: var(--color-decision);
  flex-shrink: 0;
}

.tp-card-name-area {
  flex: 1;
  min-width: 0;
}

.tp-card-name {
  display: block;
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.tp-card-job {
  display: block;
  font-size: 12px;
  color: var(--color-text-muted);
  margin-top: 2px;
}

.tp-card-score {
  text-align: center;
  flex-shrink: 0;
}

.tp-score-num {
  display: block;
  font-size: 20px;
  font-weight: 700;
  line-height: 1.2;
}

.tp-score-label {
  display: block;
  font-size: 10px;
  color: var(--color-text-muted);
}

.score-high .tp-score-num { color: #10B981; }
.score-mid .tp-score-num { color: #F59E0B; }
.score-low .tp-score-num { color: #EF4444; }

.tp-card-skills {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 10px;
}

.tp-more-skills {
  font-size: 11px;
  color: var(--color-text-muted);
  padding: 2px 6px;
}

.tp-card-reason {
  background: rgba(99, 102, 241, 0.06);
  border: 1px solid rgba(99, 102, 241, 0.12);
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 12px;
}

.tp-reason-label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  color: var(--color-decision);
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.tp-reason-text {
  display: block;
  font-size: 12px;
  line-height: 1.5;
  color: var(--color-text-secondary);
}

.tp-card-footer {
  display: flex;
  gap: 8px;
}

.tp-footer-btn {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid var(--color-border-primary);
  background: transparent;
  color: var(--color-text-secondary);
  border-radius: 8px;
  cursor: pointer;
  font-size: 12px;
  font-family: var(--font-family);
  transition: all 0.12s;
}

.tp-footer-btn:hover {
  border-color: var(--color-decision);
  color: var(--color-decision);
}

.tp-footer-btn--primary {
  background: var(--color-decision-glow);
  border-color: transparent;
  color: var(--color-decision);
}

.tp-footer-btn--primary:hover {
  background: rgba(99, 102, 241, 0.15);
}

/* ─── Carol Result ─── */
.tp-carol-result {
  margin-top: 12px;
  padding: 14px;
  background: rgba(99, 102, 241, 0.06);
  border: 1px solid rgba(99, 102, 241, 0.15);
  border-radius: 8px;
}

.tp-carol-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-decision);
}

.tp-carol-close {
  background: none;
  border: none;
  color: var(--color-text-muted);
  font-size: 16px;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
}

.tp-carol-close:hover {
  background: var(--color-bg-hover);
}

.tp-carol-content {
  font-size: 13px;
  line-height: 1.6;
  color: var(--color-text-secondary);
}

/* ─── Empty / Initial ─── */
.tp-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60px 24px;
  text-align: center;
}

.tp-empty-icon {
  color: var(--color-text-muted);
  opacity: 0.4;
  margin-bottom: 16px;
}

.tp-empty-state h3 {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0 0 8px;
}

.tp-empty-state p {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin: 0;
  line-height: 1.5;
}

.tp-initial-state {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.tp-carol-welcome {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 24px;
  background: rgba(99, 102, 241, 0.05);
  border: 1px solid rgba(99, 102, 241, 0.12);
  border-radius: 12px;
}

.tp-carol-avatar-lg {
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

.tp-carol-welcome-text h3 {
  font-size: 17px;
  font-weight: 600;
  margin: 0 0 6px;
  color: var(--color-text-primary);
}

.tp-carol-welcome-text p {
  font-size: 13px;
  line-height: 1.5;
  color: var(--color-text-secondary);
  margin: 0;
}

.tp-init-hints {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.tp-hint-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 24px 16px;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-primary);
  border-radius: 10px;
}

.tp-hint-icon {
  font-size: 28px;
  margin-bottom: 12px;
}

.tp-hint-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: 6px;
}

.tp-hint-desc {
  font-size: 12px;
  color: var(--color-text-muted);
  line-height: 1.4;
}

/* ─── Match Detail Drawer ─── */
.tp-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  justify-content: flex-end;
  z-index: 1000;
  backdrop-filter: blur(2px);
}

.tp-drawer {
  width: 440px;
  max-width: 90vw;
  height: 100vh;
  background: var(--color-bg-primary, #fff);
  border-left: 1px solid var(--color-border-primary);
  display: flex;
  flex-direction: column;
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.1);
  animation: tp-drawer-slide 0.2s ease-out;
}

@keyframes tp-drawer-slide {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}

.tp-drawer-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid var(--color-border-primary);
}

.tp-drawer-title {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tp-drawer-name {
  font-size: 17px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.tp-drawer-job {
  font-size: 12px;
  color: var(--color-text-muted);
}

.tp-drawer-close {
  background: none;
  border: none;
  font-size: 18px;
  color: var(--color-text-muted);
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  line-height: 1;
}

.tp-drawer-close:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
}

.tp-drawer-body {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* Score Hero */
.tp-m-score-hero {
  display: flex;
  align-items: center;
  gap: 16px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--color-border-primary);
}

.tp-m-score-ring {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  border: 4px solid #10B981;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.tp-m-score-num {
  font-size: 24px;
  font-weight: 700;
  line-height: 1;
  color: var(--color-text-primary);
}

.tp-m-score-label {
  font-size: 10px;
  color: var(--color-text-muted);
  margin-top: 2px;
}

.tp-m-score-desc {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tp-m-score-heading {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.tp-m-score-sub {
  font-size: 12px;
  color: var(--color-text-muted);
  line-height: 1.4;
}

/* Section */
.tp-m-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.tp-m-section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary);
  padding-bottom: 4px;
  border-bottom: 1px solid var(--color-border-secondary);
}

.tp-m-section-risk {
  color: #EF4444;
}

/* Breakdown Bars */
.tp-m-breakdowns {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.tp-m-breakdown-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.tp-m-bd-label {
  width: 68px;
  font-size: 12px;
  color: var(--color-text-secondary);
  flex-shrink: 0;
}

.tp-m-bd-bar-track {
  flex: 1;
  height: 8px;
  background: var(--color-border-secondary);
  border-radius: 4px;
  overflow: hidden;
}

.tp-m-bd-bar-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.4s ease;
}

.tp-m-bd-score {
  width: 36px;
  font-size: 12px;
  font-weight: 600;
  text-align: right;
  flex-shrink: 0;
}

/* AI Analysis Text */
.tp-m-analysis-text {
  font-size: 13px;
  line-height: 1.7;
  color: var(--color-text-secondary);
  margin: 0;
  white-space: pre-wrap;
}

/* Risk List */
.tp-m-risk-list {
  margin: 0;
  padding: 0 0 0 16px;
}

.tp-m-risk-item {
  font-size: 13px;
  line-height: 1.6;
  color: #EF4444;
  margin-bottom: 4px;
}

/* Skills */
.tp-m-skills {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tp-m-skill-badge {
  display: inline-block;
  padding: 4px 10px;
  font-size: 12px;
  border-radius: 6px;
  background: rgba(99, 102, 241, 0.08);
  color: var(--color-decision);
  border: 1px solid rgba(99, 102, 241, 0.15);
}

/* Suggestion */
.tp-m-suggestion {
  font-size: 14px;
  line-height: 1.5;
  color: var(--color-text-primary);
  margin: 0;
  padding: 12px 16px;
  background: rgba(16, 185, 129, 0.08);
  border: 1px solid rgba(16, 185, 129, 0.15);
  border-radius: 8px;
}

:root {
  --color-match-high: #10B981;
  --color-match-mid: #F59E0B;
  --color-match-low: #EF4444;
}

/* ─── Pagination ─── */
.tp-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 24px 0 8px;
  flex-wrap: wrap;
}

.tp-page-btn {
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

.tp-page-btn:hover:not(:disabled) {
  border-color: var(--color-decision);
  color: var(--color-decision);
}

.tp-page-btn.active {
  background: var(--color-decision-glow);
  border-color: var(--color-decision);
  color: var(--color-decision);
  font-weight: 600;
}

.tp-page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.tp-page-ellipsis {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  color: var(--color-text-muted);
  font-size: 13px;
}

.tp-page-info {
  margin-left: 12px;
  font-size: 12px;
  color: var(--color-text-muted);
}
</style>
