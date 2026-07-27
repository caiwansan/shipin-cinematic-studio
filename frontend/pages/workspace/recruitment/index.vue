<template>
  <div class="recruitment-home">
    <!-- ═══ Header: AI 招聘部门身份 ═══ -->
    <div class="rh-header">
      <div class="rh-header-left">
        <button @click="goToHome" class="rh-back-btn" title="返回昆仑镜首页">← 首页</button>
        <div class="rh-title-group">
          <h1 class="rh-title">🤖 AI 招聘部门</h1>
          <p class="rh-subtitle">你的 AI 招聘团队正在协助企业寻找人才</p>
        </div>
      </div>
      <div class="rh-header-right">
        <WorkspaceSwitcher />
        <button @click="goToCreateJob" class="rh-create-btn">➕ 创建岗位</button>
      </div>
    </div>

    <!-- Identity Loading -->
    <div v-if="identityLoading" class="recruitment-loading">
      <div class="loading-spinner"></div>
      <span>身份验证中...</span>
    </div>

    <!-- Identity Error -->
    <div v-else-if="error" class="recruitment-error">
      <div class="error-icon">⚠️</div>
      <h2>身份验证失败</h2>
      <p>{{ error }}</p>
      <button @click="retryIdentity" class="gate-btn-primary">重试</button>
    </div>

    <!-- Identity Gate: 无企业身份用户 -->
    <div v-else-if="!identity?.hasEnterprise" class="recruitment-gate">
      <div class="gate-card">
        <div class="gate-icon">🏢</div>
        <h2>企业身份认证</h2>
        <p>您需要完成企业身份认证才能使用 AI 招聘中心</p>
        <div class="gate-features">
          <div class="gate-feature">🤖 AI 猎聘顾问 — 智能寻找和分析候选人</div>
          <div class="gate-feature">🎤 AI 面试官 — 设计面试流程评估人才</div>
          <div class="gate-feature">📊 招聘数据分析 — 实时洞察招聘状态</div>
          <div class="gate-feature">🎯 智能人岗匹配 — 精准推荐最佳人才</div>
        </div>
        <button @click="goToOnboarding" class="gate-btn-primary">立即认证企业身份</button>
      </div>
    </div>

    <!-- Main Content (has enterprise) -->
    <template v-else>
      <!-- ═══ Status Dashboard ═══ -->
      <div class="recruitment-stats">
        <div class="stat-card stat-card--primary">
          <span class="stat-num">{{ stats.activeJobs }}</span>
          <span class="stat-label">招聘中岗位</span>
        </div>
        <div class="stat-card">
          <span class="stat-num">{{ stats.totalCandidates }}</span>
          <span class="stat-label">候选匹配</span>
        </div>
        <div class="stat-card">
          <span class="stat-num">{{ stats.pendingReview }}</span>
          <span class="stat-label">待处理推荐</span>
        </div>
        <div class="stat-card">
          <span class="stat-num">{{ stats.interviewsPending }}</span>
          <span class="stat-label">待面试</span>
        </div>
      </div>

      <!-- ═══ AI 招聘员工 (始终显示) ═══ -->
      <div class="recruitment-section">
        <AgentWorkforceCard :recruitment-stats="stats" />
      </div>

      <!-- ═══ Recruitment Flow ═══ -->
      <div class="recruitment-section">
        <h2 class="section-title">📋 招聘流程</h2>
        <div class="recruitment-flow">
          <div class="flow-step" :class="{ 'flow-step--active': stats.activeJobs > 0 }">
            <span class="flow-icon">📝</span>
            <span class="flow-label">创建岗位</span>
          </div>
          <span class="flow-arrow">→</span>
          <div class="flow-step" :class="{ 'flow-step--active': stats.activeJobs > 0 }">
            <span class="flow-icon">🤖</span>
            <span class="flow-label">AI 寻找人才</span>
          </div>
          <span class="flow-arrow">→</span>
          <div class="flow-step" :class="{ 'flow-step--active': stats.totalCandidates > 0 }">
            <span class="flow-icon">🎯</span>
            <span class="flow-label">候选人筛选</span>
          </div>
          <span class="flow-arrow">→</span>
          <div class="flow-step" :class="{ 'flow-step--active': stats.interviewsPending > 0 }">
            <span class="flow-icon">🎤</span>
            <span class="flow-label">AI 面试</span>
          </div>
          <span class="flow-arrow">→</span>
          <div class="flow-step">
            <span class="flow-icon">✅</span>
            <span class="flow-label">录用决策</span>
          </div>
        </div>
      </div>

      <!-- ═══ Recruitment Task Center ═══ -->
      <div v-if="!loading" class="recruitment-section">
        <h2 class="section-title">📌 招聘任务中心</h2>

        <!-- Empty State -->
        <div v-if="jobs.length === 0" class="task-empty">
          <div class="task-empty-icon">🤖</div>
          <h3>开始你的第一次招聘</h3>
          <p>创建首个岗位，AI 猎聘顾问将自动为您寻找最佳候选人</p>
          <button @click="goToCreateJob" class="task-empty-btn">➕ 创建首个岗位</button>
        </div>

        <!-- Job List -->
        <div v-else class="task-list">
          <div
            v-for="job in jobs"
            :key="job.id"
            class="job-card"
            @click="goToJobDetail(job.id)"
          >
            <div class="job-card-header">
              <span class="job-title">📋 {{ job.title }}</span>
              <span class="job-status" :class="getStatusClass(job.status)">
                {{ getStatusLabel(job.status) }}
              </span>
            </div>
            <div class="job-card-body">
              <div class="job-meta">
                <span v-if="job.location">📍 {{ job.location }}</span>
                <span v-if="job.experienceMin">💼 {{ job.experienceMin }}年+</span>
                <span v-if="job.requiredSkills?.length">🛠 {{ job.requiredSkills.slice(0, 3).map((s: any) => typeof s === 'string' ? s : s.name).join(', ') }}</span>
              </div>
              <div class="job-match-info" v-if="jobMatchCounts[job.id] > 0">
                <span class="match-badge">🎯 {{ jobMatchCounts[job.id] }} 位匹配</span>
              </div>
            </div>
            <div class="job-card-footer">
              <span class="job-date">创建于 {{ formatDate(job.createdAt) }}</span>
              <div class="job-actions" @click.stop>
                <button v-if="job.status === 'draft'" class="job-action-btn publish" @click="handlePublish(job.id)">发布</button>
                <button v-if="job.status === 'published'" class="job-action-btn pause" @click="handlePause(job.id)">暂停</button>
                <button v-if="job.status === 'paused'" class="job-action-btn publish" @click="handlePublish(job.id)">发布</button>
                <button v-if="job.status === 'published' || job.status === 'paused'" class="job-action-btn close" @click="handleClose(job.id)">关闭</button>
              </div>
              <span class="job-arrow">→</span>
            </div>
          </div>
        </div>
      </div>

      <!-- ═══ Candidate List ═══ -->
      <div v-if="!loading && candidates.length > 0" class="recruitment-section">
        <h2 class="section-title">🎯 候选人（{{ candidates.length }}）</h2>
        <div class="candidate-list">
          <div v-for="c in candidates" :key="c.id" class="candidate-card">
            <div class="candidate-header">
              <span class="candidate-name">👤 {{ c.careerGoal || '候选人' }}</span>
              <span class="candidate-match" :class="getMatchScoreClass(c.matchScore)">
                {{ c.matchScore }}% 匹配
              </span>
            </div>
            <div class="candidate-body">
              <div class="candidate-meta">
                <span v-if="c.city">📍 {{ c.city }}</span>
                <span v-if="c.experience">💼 {{ c.experience }}</span>
                <span v-if="c.education">🎓 {{ c.education }}</span>
              </div>
              <div v-if="c.skills?.length" class="candidate-skills">
                <span v-for="s in c.skills.slice(0, 4)" :key="s" class="skill-tag">{{ s }}</span>
              </div>
            </div>
            <div class="candidate-footer">
              <span class="candidate-job-tag">📋 {{ c.jobTitle }}</span>
              <div class="candidate-actions">
                <button class="talent-btn analyze" @click.stop="handleAnalyze(c.id)" :disabled="analyzingId === c.id">
                  {{ analyzingId === c.id ? '⏳' : '🤖 AI 分析' }}
                </button>
                <button class="talent-btn explain" @click.stop="handleExplain(c.id)" :disabled="explainingId === c.id">
                  {{ explainingId === c.id ? '⏳' : '💡 解释匹配' }}
                </button>
                <button class="talent-btn interview" @click.stop="handleGenerateInterview(c.id, c.jobId)" :disabled="generatingInterviewId === c.id">
                  {{ generatingInterviewId === c.id ? '⏳' : '🎤 面试准备' }}
                </button>
              </div>
              <span class="candidate-date">{{ formatDate(c.matchedAt) }}</span>
            </div>

            <!-- Talent Agent 结果展示 -->
            <div v-if="talentResults[c.id]" class="talent-result">
              <div class="talent-result-header">
                <span>🤖 AI 猎聘顾问</span>
                <button class="talent-close" @click.stop="clearTalentResult(c.id)">×</button>
              </div>
              <div class="talent-result-content" v-html="formatTalentResult(talentResults[c.id])"></div>
              <div class="talent-result-meta">
                <span v-if="talentResults[c.id]?.metadata">
                  ⏱ {{ talentResults[c.id].metadata.durationMs }}ms ·
                  🔤 {{ talentResults[c.id].metadata.tokensUsed }} tokens ·
                  🏷 {{ talentResults[c.id].metadata.model }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="recruitment-loading">
        <div class="loading-spinner"></div>
        <span>加载中...</span>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getEnterpriseIdentity, type EnterpriseIdentityStatus } from '~/studio-v2/api/job/enterprise-identity-api'
import { updatePostingStatus, listEnterpriseCandidates, analyzeCandidate, explainMatch, generateInterviewQuestions } from '~/studio-v2/api/recruitment-api'
import AgentWorkforceCard from '~/components/recruitment/AgentWorkforceCard.vue'

// ─── Navigation ───
function goToHome() {
  window.location.href = '/'
}

function goToCreateJob() {
  window.location.href = '/workspace/recruitment/jobs/create'
}

function goToJobDetail(id: string) {
  window.location.href = `/workspace/recruitment/jobs/${id}`
}

function goToOnboarding() {
  window.location.href = '/workspace/enterprise/onboarding'
}

async function retryIdentity() {
  identityLoading.value = true
  error.value = ''
  try {
    identity.value = await getEnterpriseIdentity()
  } catch (e: any) {
    error.value = e.message || '身份验证失败'
  } finally {
    identityLoading.value = false
  }
  if (identity.value?.hasEnterprise) {
    refresh()
  }
}

function goToJobList() {
  const el = document.querySelector('.recruitment-job-list')
  if (el) el.scrollIntoView({ behavior: 'smooth' })
}

function goToInterview() {
  window.location.href = '/workspace/recruitment/interviews'
}

// ─── Identity Gate ───
const identityLoading = ref(true)
const identity = ref<EnterpriseIdentityStatus | null>(null)

// ─── State ───
const loading = ref(true)
const jobs = ref<any[]>([])
const candidates = ref<any[]>([])
const error = ref('')

// ─── Talent Agent ───
const talentResults = ref<Record<string, any>>({})
const analyzingId = ref<string | null>(null)
const explainingId = ref<string | null>(null)
const generatingInterviewId = ref<string | null>(null)

// ─── Stats ───
const stats = computed(() => {
  const totalJobs = jobs.value.length
  const activeJobs = jobs.value.filter(j => j.status === 'published').length
  const matchingTasks = 0
  const totalCandidates = jobs.value.reduce((sum, j) => sum + (j.candidateCount || 0), 0)
  const pendingReview = totalCandidates
  const interviewsPending = 0

  return { totalJobs, activeJobs, matchingTasks, totalCandidates, pendingReview, interviewsPending }
})

const jobMatchCounts = computed(() => {
  const counts: Record<string, number> = {}
  return counts
})

const hasEnterprise = computed(() => identity.value?.hasEnterprise === true)

// ─── Helpers ───
function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    draft: '草稿',
    published: '招聘中',
    paused: '已暂停',
    closed: '已关闭',
  }
  return map[status] || status
}

function getStatusClass(status: string): string {
  return `status-${status}`
}

function getMatchScoreClass(score: number): string {
  if (score >= 80) return 'match-high'
  if (score >= 60) return 'match-medium'
  return 'match-low'
}

// ─── Status Actions ───
async function handlePublish(jobId: string) {
  if (!confirm('发布岗位后，候选人将能看到此岗位，确定发布？')) return
  try {
    await updatePostingStatus(jobId, 'published')
    await refresh()
  } catch (e: any) {
    alert(e.message || '发布失败')
  }
}

async function handlePause(jobId: string) {
  if (!confirm('暂停岗位后，候选人将不能申请，确定暂停？')) return
  try {
    await updatePostingStatus(jobId, 'paused')
    await refresh()
  } catch (e: any) {
    alert(e.message || '暂停失败')
  }
}

// ─── Talent Agent Handlers ───

async function handleAnalyze(candidateId: string) {
  analyzingId.value = candidateId
  try {
    const res = await analyzeCandidate(candidateId)
    if (res.success && res.result) {
      talentResults.value[candidateId] = res.result
    }
  } catch (e: any) {
    talentResults.value[candidateId] = {
      content: `❌ 分析失败: ${e.message}`,
      metadata: { durationMs: 0, tokensUsed: 0, model: 'none' },
    }
  } finally {
    analyzingId.value = null
  }
}

async function handleExplain(candidateId: string) {
  explainingId.value = candidateId
  try {
    const res = await explainMatch(candidateId)
    if (res.success && res.result) {
      talentResults.value[candidateId] = res.result
    }
  } catch (e: any) {
    talentResults.value[candidateId] = {
      content: `❌ 解释失败: ${e.message}`,
      metadata: { durationMs: 0, tokensUsed: 0, model: 'none' },
    }
  } finally {
    explainingId.value = null
  }
}

async function handleGenerateInterview(candidateId: string, jobId: string) {
  generatingInterviewId.value = candidateId
  try {
    const res = await generateInterviewQuestions(jobId, candidateId)
    if (res.success && res.result) {
      talentResults.value[candidateId] = res.result
    }
  } catch (e: any) {
    talentResults.value[candidateId] = {
      content: `❌ 面试问题生成失败: ${e.message}`,
      metadata: { durationMs: 0, tokensUsed: 0, model: 'none' },
    }
  } finally {
    generatingInterviewId.value = null
  }
}

function clearTalentResult(candidateId: string) {
  delete talentResults.value[candidateId]
}

function formatTalentResult(result: any): string {
  if (!result?.content) return ''
  // Simple markdown to HTML conversion
  return result.content
    .replace(/^### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^## (.+)$/gm, '<h3>$1</h3>')
    .replace(/^# (.+)$/gm, '<h2>$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li>$1. $2</li>')
    .replace(/\n/g, '<br>')
}

async function handleClose(jobId: string) {
  if (!confirm('关闭岗位后，此岗位将永久关闭且无法恢复，确定关闭？')) return
  try {
    await updatePostingStatus(jobId, 'closed')
    await refresh()
  } catch (e: any) {
    alert(e.message || '关闭失败')
  }
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return dateStr
  }
}

// ─── Data Loading ───
async function refresh() {
  loading.value = true
  error.value = ''
  try {
    const token = localStorage.getItem('auth_token') || localStorage.getItem('accessToken') || ''
    const res = await fetch('/api/enterprise/postings', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (res.ok) {
      const data = await res.json()
      jobs.value = data.data || []
    } else if (res.status === 400) {
      // No enterprise identity
      jobs.value = []
    } else {
      throw new Error(`API Error: ${res.status}`)
    }

    // Load candidates
    try {
      const candRes = await listEnterpriseCandidates()
      if (candRes.success) {
        candidates.value = candRes.candidates
      }
    } catch (e) {
      // Non-critical: candidates optional
      candidates.value = []
    }
  } catch (e: any) {
    error.value = e.message || '加载失败'
    jobs.value = []
    candidates.value = []
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  // Step 1: 验证企业身份
  try {
    identity.value = await getEnterpriseIdentity()
  } catch (e: any) {
    error.value = e.message || '身份验证失败'
  } finally {
    identityLoading.value = false
  }

  // Step 2: 有企业身份才加载数据
  if (identity.value?.hasEnterprise) {
    refresh()
  } else {
    loading.value = false
  }
})
</script>

<style scoped>
.recruitment-home {
  min-height: 100vh;
  background: #0a0f1e;
  color: #e0e0e0;
  padding: 0;
}

/* ═══ Header: AI 招聘部门 ═══ */
.rh-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  background: linear-gradient(135deg, rgba(96, 165, 250, 0.06), rgba(168, 85, 247, 0.04));
  border-bottom: 1px solid rgba(96, 165, 250, 0.12);
}

.rh-header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.rh-back-btn {
  padding: 6px 12px;
  font-size: 0.8rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  transition: all 0.15s;
}

.rh-back-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.rh-title-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.rh-title {
  margin: 0;
  font-size: 1.4rem;
  font-weight: 700;
  color: #fff;
}

.rh-subtitle {
  margin: 0;
  font-size: 0.82rem;
  color: rgba(255, 255, 255, 0.45);
}

.rh-header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.rh-create-btn {
  padding: 10px 20px;
  font-size: 0.88rem;
  font-weight: 600;
  background: linear-gradient(135deg, #60a5fa, #3b82f6);
  border: none;
  border-radius: 8px;
  color: #fff;
  cursor: pointer;
  transition: box-shadow 0.15s, transform 0.1s;
}

.rh-create-btn:hover {
  box-shadow: 0 4px 16px rgba(96, 165, 250, 0.35);
  transform: translateY(-1px);
}

/* ─── Cockpit Stat Card Zero State ─── */
.stat-card {
  position: relative;
  overflow: hidden;
}

.stat-card::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: transparent;
  transition: background 0.2s;
}

.stat-card--primary::after {
  background: linear-gradient(90deg, #60a5fa, #3b82f6);
}

/* ─── Section Spacing ─── */
.recruitment-section {
  padding: 0 24px 32px;
}

/* ─── Recruitment Flow ─── */
.recruitment-flow {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 20px;
  background: #0d1220;
  border: 1px solid #1a2240;
  border-radius: 12px;
  overflow-x: auto;
}

.flow-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 12px 16px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.05);
  min-width: 90px;
  transition: all 0.2s;
}

.flow-step--active {
  background: rgba(96, 165, 250, 0.08);
  border-color: rgba(96, 165, 250, 0.25);
}

.flow-step--active .flow-icon {
  filter: grayscale(0);
  transform: scale(1.1);
}

.flow-icon {
  font-size: 1.4rem;
  filter: grayscale(0.5);
  transition: all 0.2s;
}

.flow-label {
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.5);
  white-space: nowrap;
}

.flow-step--active .flow-label {
  color: #60a5fa;
  font-weight: 600;
}

.flow-arrow {
  color: rgba(255, 255, 255, 0.15);
  font-size: 1.1rem;
  flex-shrink: 0;
}

@media (max-width: 768px) {
  .recruitment-flow {
    flex-wrap: nowrap;
    justify-content: flex-start;
    padding: 16px;
  }
  .flow-step {
    min-width: 70px;
    padding: 8px 10px;
  }
  .rh-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  .rh-header-right {
    width: 100%;
    justify-content: space-between;
  }
}

/* ─── Task Empty State ─── */
.task-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60px 24px;
  text-align: center;
  background: #0d1220;
  border: 1px solid #1a2240;
  border-radius: 12px;
}

.task-empty-icon {
  font-size: 3rem;
  margin-bottom: 16px;
}

.task-empty h3 {
  margin: 0 0 8px;
  font-size: 1.2rem;
  color: #fff;
}

.task-empty p {
  margin: 0 0 24px;
  font-size: 0.88rem;
  color: rgba(255, 255, 255, 0.5);
  max-width: 400px;
}

.task-empty-btn {
  padding: 12px 28px;
  font-size: 0.95rem;
  font-weight: 600;
  background: linear-gradient(135deg, #60a5fa, #3b82f6);
  border: none;
  border-radius: 10px;
  color: #fff;
  cursor: pointer;
  transition: box-shadow 0.15s, transform 0.1s;
}

.task-empty-btn:hover {
  box-shadow: 0 4px 20px rgba(96, 165, 250, 0.35);
  transform: translateY(-1px);
}

.stat-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px 12px;
  background: #0d1220;
  border: 1px solid #1a2240;
  border-radius: 12px;
}

.stat-num {
  font-size: 2rem;
  font-weight: 700;
  color: #60a5fa;
}

.stat-label {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.5);
  margin-top: 4px;
}

/* ─── Loading ─── */
.recruitment-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 60px 24px;
  color: rgba(255, 255, 255, 0.5);
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top-color: #60a5fa;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ─── Shared section-title ─── */
.section-title {
  font-size: 1rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.7);
  margin: 0 0 16px;
}

.job-card {
  background: #0d1220;
  border: 1px solid #1a2240;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 12px;
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.job-card:hover {
  border-color: rgba(96, 165, 250, 0.3);
  box-shadow: 0 4px 20px rgba(96, 165, 250, 0.1);
}

.job-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.job-title {
  font-size: 1rem;
  font-weight: 600;
  color: #fff;
}

.job-status {
  font-size: 0.75rem;
  padding: 3px 10px;
  border-radius: 10px;
  font-weight: 500;
}

.status-draft {
  background: rgba(156, 163, 175, 0.15);
  color: #9ca3af;
}

.status-active,
.status-published {
  background: rgba(74, 222, 128, 0.15);
  color: #4ade80;
}

.status-paused {
  background: rgba(245, 158, 11, 0.15);
  color: #f59e0b;
}

.status-closed {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
}

.job-card-body {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.job-meta {
  display: flex;
  gap: 16px;
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.5);
}

.match-badge {
  font-size: 0.78rem;
  color: #4ade80;
  background: rgba(74, 222, 128, 0.1);
  padding: 3px 10px;
  border-radius: 10px;
}

.job-card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.04);
}

.job-date {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.3);
}

.job-arrow {
  color: rgba(255, 255, 255, 0.3);
  font-size: 1rem;
}

/* ─── Identity Error ─── */
.recruitment-error {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 80px 24px;
  flex-direction: column;
}

.error-icon {
  font-size: 3rem;
  margin-bottom: 16px;
}

.recruitment-error h2 {
  margin: 0 0 8px;
  font-size: 1.4rem;
  color: #fff;
}

.recruitment-error p {
  margin: 0 0 24px;
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.5);
  max-width: 400px;
  text-align: center;
}

/* ─── Identity Gate ─── */
.recruitment-gate {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 80px 24px;
}

.gate-card {
  max-width: 480px;
  width: 100%;
  text-align: center;
  background: #0d1220;
  border: 1px solid #1a2240;
  border-radius: 16px;
  padding: 48px 36px;
}

.gate-icon {
  font-size: 3rem;
  margin-bottom: 16px;
}

.gate-card h2 {
  margin: 0 0 8px;
  font-size: 1.4rem;
  color: #fff;
}

.gate-card p {
  margin: 0 0 24px;
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.5);
}

.gate-features {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 28px;
}

.gate-feature {
  padding: 10px 14px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  font-size: 0.82rem;
  color: rgba(255, 255, 255, 0.6);
  text-align: left;
}

.gate-btn-primary {
  padding: 14px 32px;
  font-size: 1rem;
  font-weight: 600;
  background: linear-gradient(135deg, #60a5fa, #3b82f6);
  border: none;
  border-radius: 10px;
  color: #fff;
  cursor: pointer;
  transition: box-shadow 0.15s, transform 0.1s;
}

.gate-btn-primary:hover {
  box-shadow: 0 4px 20px rgba(96, 165, 250, 0.35);
  transform: translateY(-1px);
}

/* ─── Job Actions ─── */
.job-actions {
  display: flex;
  gap: 6px;
  align-items: center;
}

.job-action-btn {
  padding: 4px 12px;
  font-size: 0.75rem;
  font-weight: 500;
  border: 1px solid transparent;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
}

.job-action-btn.publish {
  background: rgba(74, 222, 128, 0.15);
  color: #4ade80;
  border-color: rgba(74, 222, 128, 0.3);
}
.job-action-btn.publish:hover {
  background: rgba(74, 222, 128, 0.25);
}

.job-action-btn.pause {
  background: rgba(245, 158, 11, 0.15);
  color: #f59e0b;
  border-color: rgba(245, 158, 11, 0.3);
}
.job-action-btn.pause:hover {
  background: rgba(245, 158, 11, 0.25);
}

.job-action-btn.close {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
  border-color: rgba(239, 68, 68, 0.3);
}
.job-action-btn.close:hover {
  background: rgba(239, 68, 68, 0.25);
}

/* ─── Candidate List ─── */
.candidate-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 12px;
  margin-top: 12px;
}

.candidate-card {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  padding: 16px;
  transition: background 0.2s, border-color 0.2s;
}

.candidate-card:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(96, 165, 250, 0.2);
}

.candidate-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.candidate-name {
  font-size: 0.9rem;
  font-weight: 600;
  color: #e4e4e7;
}

.candidate-match {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
}

.match-high {
  background: rgba(74, 222, 128, 0.15);
  color: #4ade80;
}

.match-medium {
  background: rgba(245, 158, 11, 0.15);
  color: #f59e0b;
}

.match-low {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
}

.candidate-meta {
  display: flex;
  gap: 12px;
  font-size: 0.75rem;
  color: #71717a;
  margin-bottom: 8px;
}

.candidate-skills {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 8px;
}

.skill-tag {
  padding: 2px 8px;
  background: rgba(96, 165, 250, 0.1);
  color: #60a5fa;
  border-radius: 4px;
  font-size: 0.7rem;
}

.candidate-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.04);
  flex-wrap: wrap;
}

.candidate-job-tag {
  font-size: 0.75rem;
  color: #71717a;
}

.candidate-date {
  font-size: 0.7rem;
  color: #52525b;
}

/* ─── Talent Agent ─── */
.candidate-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.talent-btn {
  padding: 6px 12px;
  border: 1px solid rgba(96, 165, 250, 0.3);
  border-radius: 6px;
  background: rgba(96, 165, 250, 0.1);
  color: #60a5fa;
  font-size: 0.78rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.talent-btn:hover {
  background: rgba(96, 165, 250, 0.2);
  border-color: rgba(96, 165, 250, 0.5);
  box-shadow: 0 2px 8px rgba(96, 165, 250, 0.15);
}

.talent-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.talent-btn.interview {
  border-color: rgba(168, 85, 247, 0.3);
  background: rgba(168, 85, 247, 0.1);
  color: #a855f7;
}

.talent-btn.interview:hover {
  background: rgba(168, 85, 247, 0.2);
  border-color: rgba(168, 85, 247, 0.5);
  box-shadow: 0 2px 8px rgba(168, 85, 247, 0.15);
}

.talent-result {
  margin-top: 12px;
  padding: 12px;
  background: rgba(96, 165, 250, 0.05);
  border: 1px solid rgba(96, 165, 250, 0.15);
  border-radius: 8px;
  grid-column: 1 / -1;
}

.talent-result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 0.8rem;
  font-weight: 600;
  color: #60a5fa;
}

.talent-close {
  background: none;
  border: none;
  color: #71717a;
  font-size: 1.2rem;
  cursor: pointer;
  padding: 0 4px;
}

.talent-close:hover {
  color: #ef4444;
}

.talent-result-content {
  font-size: 0.85rem;
  line-height: 1.6;
  color: #d4d4d8;
}

.talent-result-content h4 {
  margin: 8px 0 4px;
  color: #e4e4e7;
  font-size: 0.9rem;
}

.talent-result-content li {
  margin-left: 16px;
  margin-bottom: 2px;
}

.talent-result-meta {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.04);
  font-size: 0.7rem;
  color: #52525b;
}
</style>
