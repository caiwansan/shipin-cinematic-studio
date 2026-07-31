<!-- Sprint 08: 候选人详情页 — AI 招聘决策中心 -->
<!-- 位置：/workspace/enterprise/candidates/:id -->
<!-- 职责：候选人完整画像 + AI 匹配分析 + Pipeline 历史 + 决策入口 -->
<template>
  <div class="candidate-detail-page">
    <!-- Page Header -->
    <div class="cdp-header">
      <div class="cdp-header-left">
        <button @click="goBack" class="cdp-back-btn">← 返回</button>
        <div v-if="candidate">
          <h1 class="cdp-title">{{ candidate.candidateName || '候选人' }}</h1>
          <p class="cdp-subtitle">{{ candidate.jobTitle }} · {{ stageLabel(candidate.stage) }}</p>
        </div>
      </div>
      <div class="cdp-header-actions">
        <button class="cdp-action-btn cdp-action-btn--primary" @click="startInterview" :disabled="!candidate">
          安排面试
        </button>
        <button class="cdp-action-btn cdp-action-btn--success" @click="advanceToOffer" :disabled="!candidate">
          推进到 Offer
        </button>
        <button class="cdp-action-btn cdp-action-btn--danger" @click="rejectCandidate" :disabled="!candidate">
          建议拒绝
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="cdp-loading">
      <div class="cdp-spinner"></div>
      <span>加载候选人数据...</span>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="cdp-error">
      <span>{{ error }}</span>
      <button @click="loadData" class="cdp-retry-btn">重试</button>
    </div>

    <!-- Content -->
    <template v-else-if="candidate">
      <div class="cdp-grid">
        <!-- Left Column: Basic Info + AI Analysis -->
        <div class="cdp-col cdp-col--main">
          <!-- Basic Info Card -->
          <section class="cdp-card">
            <h2 class="cdp-card-title">基础信息</h2>
            <div class="cdp-info-grid">
              <div class="cdp-info-item">
                <span class="cdp-info-label">姓名</span>
                <span class="cdp-info-value">{{ candidate.candidateName || '—' }}</span>
              </div>
              <div class="cdp-info-item">
                <span class="cdp-info-label">应聘职位</span>
                <span class="cdp-info-value">{{ candidate.jobTitle || '—' }}</span>
              </div>
              <div class="cdp-info-item">
                <span class="cdp-info-label">工作地点</span>
                <span class="cdp-info-value">{{ candidate.jobLocation || '—' }}</span>
              </div>
              <div class="cdp-info-item">
                <span class="cdp-info-label">薪资范围</span>
                <span class="cdp-info-value">{{ candidate.jobSalary || '—' }}</span>
              </div>
              <div class="cdp-info-item">
                <span class="cdp-info-label">当前阶段</span>
                <span class="cdp-info-value">
                  <span class="cdp-stage-badge" :class="stageClass(candidate.stage)">{{ stageLabel(candidate.stage) }}</span>
                </span>
              </div>
              <div class="cdp-info-item">
                <span class="cdp-info-label">面试次数</span>
                <span class="cdp-info-value">{{ candidate.interviewCount || 0 }} 场</span>
              </div>
              <div class="cdp-info-item">
                <span class="cdp-info-label">创建时间</span>
                <span class="cdp-info-value">{{ formatDate(candidate.createdAt) }}</span>
              </div>
              <div class="cdp-info-item">
                <span class="cdp-info-label">最后活跃</span>
                <span class="cdp-info-value">{{ formatDate(candidate.lastActivityAt) }}</span>
              </div>
            </div>

            <!-- Tags -->
            <div v-if="candidate.tags?.length" class="cdp-tags">
              <span class="cdp-tags-label">标签：</span>
              <span v-for="tag in candidate.tags" :key="tag" class="cdp-tag">{{ tag }}</span>
            </div>

            <!-- Resume -->
            <div v-if="candidate.resume" class="cdp-resume">
              <h3 class="cdp-sub-title">简历信息</h3>
              <div class="cdp-resume-info">
                <span>文件名：{{ candidate.resume.fileName || '—' }}</span>
                <span>上传时间：{{ formatDate(candidate.resume.uploadedAt) }}</span>
              </div>
              <div v-if="candidate.resume.profile" class="cdp-resume-profile">
                <div class="cdp-info-grid">
                  <div class="cdp-info-item">
                    <span class="cdp-info-label">姓名</span>
                    <span class="cdp-info-value">{{ candidate.resume.profile.name || '—' }}</span>
                  </div>
                  <div class="cdp-info-item">
                    <span class="cdp-info-label">学历</span>
                    <span class="cdp-info-value">{{ candidate.resume.profile.education || '—' }}</span>
                  </div>
                  <div class="cdp-info-item">
                    <span class="cdp-info-label">城市</span>
                    <span class="cdp-info-value">{{ candidate.resume.profile.city || '—' }}</span>
                  </div>
                  <div class="cdp-info-item">
                    <span class="cdp-info-label">工作年限</span>
                    <span class="cdp-info-value">{{ candidate.resume.profile.experienceYears || '—' }} 年</span>
                  </div>
                </div>
                <div v-if="candidate.resume.profile.skills?.length" class="cdp-skills">
                  <span class="cdp-tags-label">技能：</span>
                  <span v-for="s in candidate.resume.profile.skills" :key="s" class="cdp-skill-tag">{{ s }}</span>
                </div>
              </div>
            </div>
          </section>

          <!-- AI Match Analysis -->
          <section class="cdp-card">
            <h2 class="cdp-card-title">AI 匹配分析</h2>
            <div v-if="matchData" class="cdp-match">
              <!-- Overall Score -->
              <div class="cdp-match-header">
                <div class="cdp-score-ring">
                  <svg viewBox="0 0 100 100" class="cdp-score-svg">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="8" />
                    <circle
                      cx="50" cy="50" r="42" fill="none"
                      :stroke="scoreColor(matchData.matchScore)"
                      stroke-width="8"
                      stroke-linecap="round"
                      :stroke-dasharray="`${(matchData.matchScore / 100) * 264} 264`"
                      transform="rotate(-90 50 50)"
                    />
                  </svg>
                  <div class="cdp-score-text">
                    <span class="cdp-score-num" :style="{ color: scoreColor(matchData.matchScore) }">{{ matchData.matchScore }}</span>
                    <span class="cdp-score-label">综合匹配度</span>
                  </div>
                </div>
              </div>

              <!-- Score Breakdown -->
              <div class="cdp-breakdown">
                <h3 class="cdp-sub-title">分项评分</h3>
                <div class="cdp-bars">
                  <div class="cdp-bar-row">
                    <span class="cdp-bar-label">技能匹配</span>
                    <div class="cdp-bar-track">
                      <div class="cdp-bar-fill" :style="{ width: breakdown.skills + '%', background: '#60a5fa' }"></div>
                    </div>
                    <span class="cdp-bar-value">{{ breakdown.skills }}</span>
                  </div>
                  <div class="cdp-bar-row">
                    <span class="cdp-bar-label">经验匹配</span>
                    <div class="cdp-bar-track">
                      <div class="cdp-bar-fill" :style="{ width: breakdown.experience + '%', background: '#a78bfa' }"></div>
                    </div>
                    <span class="cdp-bar-value">{{ breakdown.experience }}</span>
                  </div>
                  <div class="cdp-bar-row">
                    <span class="cdp-bar-label">教育背景</span>
                    <div class="cdp-bar-track">
                      <div class="cdp-bar-fill" :style="{ width: breakdown.education + '%', background: '#34d399' }"></div>
                    </div>
                    <span class="cdp-bar-value">{{ breakdown.education }}</span>
                  </div>
                  <div class="cdp-bar-row">
                    <span class="cdp-bar-label">职业匹配</span>
                    <div class="cdp-bar-track">
                      <div class="cdp-bar-fill" :style="{ width: breakdown.career + '%', background: '#fbbf24' }"></div>
                    </div>
                    <span class="cdp-bar-value">{{ breakdown.career }}</span>
                  </div>
                </div>
              </div>

              <!-- AI Analysis Text -->
              <div v-if="matchData.aiAnalysis" class="cdp-ai-analysis">
                <h3 class="cdp-sub-title">AI 分析</h3>
                <p class="cdp-ai-text">{{ matchData.aiAnalysis }}</p>
              </div>
            </div>
            <div v-else class="cdp-no-match">
              <p>暂无匹配数据，请先执行 AI 匹配分析</p>
              <button class="cdp-action-btn cdp-action-btn--primary" @click="runMatch">执行匹配分析</button>
            </div>

            <!-- Sprint 5-4: AI 招聘建议 决策增强 -->
            <div v-if="matchData" class="cdp-ai-decision">
              <div class="cdp-decision-header">
                <span class="cdp-decision-label">推荐等级</span>
                <span class="cdp-decision-grade" :class="'cdp-grade-' + recommendation.level.toLowerCase()">{{ recommendation.level }}</span>
              </div>

              <div class="cdp-decision-detail">
                <div class="cdp-decision-column cdp-decision-pros">
                  <span class="cdp-decision-col-label">优势</span>
                  <div v-if="recommendation.strengths.length > 0" class="cdp-decision-items">
                    <div v-for="(s, i) in recommendation.strengths" :key="i" class="cdp-decision-item cdp-decision-item--pro">
                      <span class="cdp-decision-icon">✓</span>
                      <span>{{ s }}</span>
                    </div>
                  </div>
                  <div v-else class="cdp-decision-empty">暂无突出优势</div>
                </div>

                <div class="cdp-decision-column cdp-decision-risks">
                  <span class="cdp-decision-col-label">风险</span>
                  <div v-if="recommendation.risks.length > 0" class="cdp-decision-items">
                    <div v-for="(r, i) in recommendation.risks" :key="i" class="cdp-decision-item cdp-decision-item--risk">
                      <span class="cdp-decision-icon">⚠</span>
                      <span>{{ r }}</span>
                    </div>
                  </div>
                  <div v-else class="cdp-decision-empty">未发现明显风险</div>
                </div>
              </div>

              <div class="cdp-decision-action">
                <span class="cdp-decision-action-label">下一步</span>
                <span class="cdp-decision-action-text">{{ recommendation.nextStep }}</span>
                <button class="cdp-action-btn cdp-action-btn--primary cdp-btn-sm" @click="startInterview">安排面试</button>
              </div>
            </div>
          </section>

          <!-- Interview History -->
          <section class="cdp-card" v-if="candidate.interviews?.length">
            <h2 class="cdp-card-title">面试记录 ({{ candidate.interviews.length }})</h2>
            <div class="cdp-interview-list">
              <div v-for="iv in candidate.interviews" :key="iv.id" class="cdp-interview-item" @click="goToInterview(iv.id)">
                <div class="cdp-interview-info">
                  <span class="cdp-interview-title">{{ iv.title }}</span>
                  <span class="cdp-interview-status" :class="interviewStatusClass(iv.status)">{{ interviewStatusLabel(iv.status) }}</span>
                </div>
                <div class="cdp-interview-meta">
                  <span v-if="iv.overallScore" class="cdp-interview-score">综合 {{ iv.overallScore }} 分</span>
                  <span class="cdp-interview-date">{{ formatDate(iv.createdAt) }}</span>
                </div>
              </div>
            </div>
          </section>
        </div>

        <!-- Right Column: Pipeline Timeline + Notes -->
        <div class="cdp-col cdp-col--side">
          <!-- Pipeline Timeline -->
          <section class="cdp-card">
            <h2 class="cdp-card-title">Pipeline 历史</h2>
            <div v-if="timelineData" class="cdp-timeline">
              <div v-for="event in timelineData.events" :key="event.id" class="cdp-timeline-item">
                <div class="cdp-timeline-marker">
                  <span :class="timelineIconClass(event.type)">{{ timelineIcon(event.type) }}</span>
                </div>
                <div class="cdp-timeline-content">
                  <div class="cdp-timeline-text">
                    <span v-if="event.fromStage">{{ stageLabel(event.fromStage) }}</span>
                    <span v-if="event.fromStage && event.toStage" class="cdp-timeline-arrow">→</span>
                    <span v-if="event.toStage">{{ stageLabel(event.toStage) }}</span>
                    <span v-if="!event.fromStage && !event.toStage">{{ event.type }}</span>
                  </div>
                  <div class="cdp-timeline-meta">
                    <span class="cdp-timeline-actor">{{ event.actor }}</span>
                    <span class="cdp-timeline-time">{{ formatDateTime(event.time) }}</span>
                  </div>
                </div>
              </div>
            </div>
            <div v-else class="cdp-no-timeline">
              <p>暂无 Pipeline 记录</p>
            </div>
          </section>

          <!-- Notes -->
          <section class="cdp-card">
            <h2 class="cdp-card-title">备注 ({{ notes.length }})</h2>
            <div class="cdp-notes">
              <div v-for="note in notes" :key="note.id" class="cdp-note-item">
                <p class="cdp-note-content">{{ note.content }}</p>
                <span class="cdp-note-time">{{ formatDateTime(note.createdAt) }}</span>
              </div>
              <div v-if="notes.length === 0" class="cdp-no-notes">暂无备注</div>
            </div>
            <div class="cdp-note-input">
              <textarea v-model="newNote" placeholder="添加备注..." rows="2" class="cdp-note-textarea"></textarea>
              <button @click="addNote" :disabled="!newNote.trim()" class="cdp-action-btn cdp-action-btn--primary cdp-btn-sm">添加</button>
            </div>
          </section>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { getAuthToken } from '~/utils/auth/token'

// ─── Route ───
const route = useRoute()
const candidateId = route.params.id as string

// ─── State ───
const loading = ref(true)
const error = ref('')
const candidate = ref<any>(null)
const matchData = ref<any>(null)
const timelineData = ref<any>(null)
const notes = ref<any[]>([])
const newNote = ref('')
const workspaceId = ref('')

// ─── Computed: Score Breakdown ───
const breakdown = computed(() => {
  const mb = matchData.value?.matchBreakdown
  if (!mb) return { skills: 0, experience: 0, education: 0, career: 0 }
  return {
    skills: mb.skills ?? 0,
    experience: mb.experience ?? 0,
    education: mb.education ?? 0,
    career: mb.career ?? mb.city ?? 0,
  }
})

/* ── Sprint 5-4: AI 招聘建议 ── */
const recommendation = computed(() => {
  const score = matchData.value?.matchScore || 0
  const mb = matchData.value?.matchBreakdown
  const aiAnalysis = matchData.value?.aiAnalysis || ''

  let level = 'C'
  if (score >= 80) level = 'A'
  else if (score >= 60) level = 'B'

  const strengths: string[] = []
  const risks: string[] = []

  if (mb) {
    if ((mb.skills || 0) >= 70) strengths.push('技能匹配')
    if ((mb.experience || 0) >= 70) strengths.push('项目经验')
    if ((mb.education || 0) >= 70) strengths.push('教育背景')
    if ((mb.career || 0) >= 70) strengths.push('职业规划')

    if ((mb.skills || 0) < 40) risks.push('技能匹配度较低')
    if ((mb.experience || 0) < 40) risks.push('经验匹配不足')
    if ((mb.education || 0) < 40) risks.push('教育背景有差距')
  }

  // Parse aiAnalysis for additional pros/cons
  if (aiAnalysis) {
    const lower = aiAnalysis.toLowerCase()
    if (lower.includes('薪资') || lower.includes('salary') || lower.includes('预算')) risks.push('薪资可能超预算')
    if (lower.includes('location') || lower.includes('location') || lower.includes('城市')) risks.push('工作地点可能不匹配')
    if (lower.includes('突出') || lower.includes('优秀') || lower.includes('strong')) strengths.push('综合能力突出')
  }

  // Next step based on stage
  let nextStep = '安排面试'
  const stage = candidate.value?.stage || ''
  if (stage === 'screening' || stage === 'discovered') nextStep = '安排面试'
  else if (stage === 'interview') nextStep = '评估面试结果'
  else if (stage === 'offer') nextStep = '发送 Offer'
  else if (stage === 'hired') nextStep = '准备入职' 

  return { level, strengths, risks, nextStep }
})

// ─── Data Loading ───
async function loadData() {
  loading.value = true
  error.value = ''

  try {
    const token = getAuthToken()
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}

    // 1. Load pipeline/candidate detail
    const detailRes = await fetch(`/api/pipeline/${candidateId}`, { headers })
    if (!detailRes.ok) {
      const errData = await detailRes.json().catch(() => ({}))
      throw new Error(errData.error || `加载失败 (${detailRes.status})`)
    }
    const detailData = await detailRes.json()
    candidate.value = detailData.candidate

    // 2. Load timeline
    try {
      const timelineRes = await fetch(`/api/pipeline/${candidateId}/timeline`, { headers })
      if (timelineRes.ok) {
        timelineData.value = await timelineRes.json()
      }
    } catch { /* silent */ }

    // 3. Load match data (from candidate_match table)
    if (candidate.value?.jobId) {
      try {
        const matchRes = await fetch(`/api/enterprise/matches?jobId=${candidate.value.jobId}`, { headers })
        if (matchRes.ok) {
          const matchJson = await matchRes.json()
          const matches = matchJson.matches || matchJson.data || []
          // Find match for this candidate
          const found = matches.find((m: any) => m.candidateId === candidate.value?.candidateId || m.candidateName === candidate.value?.candidateName)
          if (found) matchData.value = found
        }
      } catch { /* silent */ }
    }

    // Notes from candidate detail
    notes.value = detailData.candidate?.notes || []

  } catch (e: any) {
    error.value = e.message || '加载失败'
  } finally {
    loading.value = false
  }
}

// ─── Actions ───
function goBack() {
  window.history.back()
}

function goToInterview(id: string) {
  window.location.href = `/workspace/enterprise/interview/${id}`
}

async function startInterview() {
  // Navigate to interview creation with candidate pre-filled
  window.location.href = `/workspace/enterprise/interview?candidateId=${candidateId}&candidateName=${encodeURIComponent(candidate.value?.candidateName || '')}&jobId=${candidate.value?.jobId || ''}`
}

async function advanceToOffer() {
  try {
    const token = getAuthToken()
    const res = await fetch(`/api/pipeline/${candidateId}/stage`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ stage: 'offer', actor: 'user' }),
    })
    if (res.ok) {
      alert('✅ 已推进到 Offer 阶段')
      loadData()
    } else {
      const data = await res.json()
      alert(`❌ ${data.error || '操作失败'}`)
    }
  } catch (e: any) {
    alert(`❌ ${e.message}`)
  }
}

async function rejectCandidate() {
  const reason = prompt('拒绝原因（可选）：')
  try {
    const token = getAuthToken()
    const res = await fetch(`/api/pipeline/${candidateId}/stage`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ stage: 'rejected', actor: 'user', reason }),
    })
    if (res.ok) {
      alert('已标记为拒绝')
      loadData()
    } else {
      const data = await res.json()
      alert(`❌ ${data.error || '操作失败'}`)
    }
  } catch (e: any) {
    alert(`❌ ${e.message}`)
  }
}

async function runMatch() {
  if (!candidate.value?.jobId) {
    alert('缺少岗位信息，无法执行匹配')
    return
  }
  try {
    const token = getAuthToken()
    const res = await fetch(`/api/enterprise/jobs/${candidate.value.jobId}/match`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    })
    if (res.ok) {
      const data = await res.json()
      alert(`✅ 匹配分析完成，共 ${data.total || 0} 条结果`)
      loadData()
    } else {
      const data = await res.json()
      alert(`❌ ${data.error || '匹配失败'}`)
    }
  } catch (e: any) {
    alert(`❌ ${e.message}`)
  }
}

async function addNote() {
  if (!newNote.value.trim()) return
  try {
    const token = getAuthToken()
    const res = await fetch(`/api/pipeline/${candidateId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ content: newNote.value.trim() }),
    })
    if (res.ok) {
      newNote.value = ''
      loadData()
    }
  } catch { /* silent */ }
}

// ─── Helpers ───
function stageLabel(stage: string): string {
  const map: Record<string, string> = {
    discovered: '初筛', screening: '筛选', interview: '面试',
    offer: 'Offer', hired: '已录用', rejected: '已拒绝',
  }
  return map[stage] || stage
}

function stageClass(stage: string): string {
  return `cdp-stage--${stage}`
}

function interviewStatusLabel(status: string): string {
  const map: Record<string, string> = {
    preparing: '准备中', question_ready: '题目就绪', in_progress: '进行中',
    evaluating: '评估中', completed: '已完成', decision_made: '已决策',
  }
  return map[status] || status
}

function interviewStatusClass(status: string): string {
  return `cdp-istatus--${status}`
}

function timelineIcon(type: string): string {
  const map: Record<string, string> = {
    stage_change: '→', ai_score: 'AI', ai_interview: 'IV',
    ai_invite: 'IN', ai_offer: 'OF', note: '·',
  }
  return map[type] || '·'
}

function timelineIconClass(type: string): string {
  return `cdp-timeline-icon--${type}`
}

function scoreColor(score: number): string {
  if (score >= 80) return '#4ade80'
  if (score >= 60) return '#fbbf24'
  return '#f87171'
}

function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '—'
  try {
    return new Date(date).toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' })
  } catch { return '—' }
}

function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '—'
  try {
    return new Date(date).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch { return '—' }
}

// ─── Init ───
onMounted(() => {
  loadData()
})
</script>

<style scoped>
.candidate-detail-page {
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;
}

/* Header */
.cdp-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
  flex-wrap: wrap;
  gap: 16px;
}

.cdp-header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.cdp-back-btn {
  padding: 6px 12px;
  background: var(--color-bg-hover, rgba(255, 255, 255, 0.04));
  border: 1px solid var(--color-border-primary, rgba(255, 255, 255, 0.1));
  border-radius: 6px;
  color: var(--color-text-secondary, rgba(255, 255, 255, 0.7));
  cursor: pointer;
  font-size: 0.85rem;
}

.cdp-back-btn:hover {
  background: var(--color-bg-hover, rgba(255, 255, 255, 0.08));
}

.cdp-title {
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--color-text-primary, #E2E8F0);
  margin: 0;
}

.cdp-subtitle {
  font-size: 0.8rem;
  color: var(--color-text-muted, #64748B);
  margin: 2px 0 0;
}

.cdp-header-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

/* Action Buttons */
.cdp-action-btn {
  padding: 8px 16px;
  font-size: 0.82rem;
  font-weight: 500;
  border-radius: 8px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.15s;
  font-family: var(--font-family, inherit);
}

.cdp-action-btn--primary {
  background: var(--color-decision-glow, rgba(96, 165, 250, 0.15));
  color: var(--color-decision, #818CF8);
  border-color: var(--color-decision-glow, rgba(96, 165, 250, 0.3));
}

.cdp-action-btn--primary:hover {
  background: rgba(99, 102, 241, 0.25);
}

.cdp-action-btn--success {
  background: rgba(16, 185, 129, 0.15);
  color: #34D399;
  border-color: rgba(16, 185, 129, 0.3);
}

.cdp-action-btn--success:hover {
  background: rgba(16, 185, 129, 0.25);
}

.cdp-action-btn--danger {
  background: rgba(239, 68, 68, 0.15);
  color: #EF4444;
  border-color: rgba(239, 68, 68, 0.3);
}

.cdp-action-btn--danger:hover {
  background: rgba(239, 68, 68, 0.25);
}

.cdp-action-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.cdp-btn-sm {
  padding: 6px 12px;
  font-size: 0.78rem;
}

/* Loading & Error */
.cdp-loading, .cdp-error {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 60px;
  color: var(--color-text-muted, #64748B);
}

.cdp-spinner {
  width: 24px;
  height: 24px;
  border: 3px solid var(--color-border-primary, rgba(255, 255, 255, 0.1));
  border-top-color: var(--color-decision, #818CF8);
  border-radius: 50%;
  animation: cdp-spin 0.8s linear infinite;
}

@keyframes cdp-spin {
  to { transform: rotate(360deg); }
}

.cdp-retry-btn {
  padding: 4px 12px;
  background: var(--color-decision-glow, rgba(96, 165, 250, 0.15));
  border: 1px solid var(--color-decision-glow, rgba(96, 165, 250, 0.3));
  border-radius: 6px;
  color: var(--color-decision, #818CF8);
  cursor: pointer;
  font-family: var(--font-family, inherit);
}

/* Grid Layout */
.cdp-grid {
  display: grid;
  grid-template-columns: 1fr 360px;
  gap: 20px;
}

.cdp-col {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* Cards */
.cdp-card {
  background: var(--color-bg-elevated, #111827);
  border: 1px solid var(--color-border-primary, #1E293B);
  border-radius: 12px;
  padding: 20px;
}

.cdp-card-title {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--color-text-primary, #E2E8F0);
  margin: 0 0 16px;
}

.cdp-sub-title {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-secondary, #94A3B8);
  margin: 16px 0 8px;
}

/* Info Grid */
.cdp-info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.cdp-info-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.cdp-info-label {
  font-size: 0.72rem;
  color: var(--color-text-muted, #64748B);
  font-weight: 500;
}

.cdp-info-value {
  font-size: 0.85rem;
  color: var(--color-text-primary, #E2E8F0);
}

/* Stage Badge */
.cdp-stage-badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 10px;
  font-size: 0.75rem;
  font-weight: 500;
}

.cdp-stage--discovered { background: rgba(156, 163, 175, 0.15); color: #9ca3af; }
.cdp-stage--screening { background: rgba(96, 165, 250, 0.15); color: #60a5fa; }
.cdp-stage--interview { background: rgba(167, 139, 250, 0.15); color: #a78bfa; }
.cdp-stage--offer { background: rgba(251, 191, 36, 0.15); color: #fbbf24; }
.cdp-stage--hired { background: rgba(74, 222, 128, 0.15); color: #4ade80; }
.cdp-stage--rejected { background: rgba(248, 113, 113, 0.15); color: #f87171; }

/* Tags */
.cdp-tags {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--color-border-primary, #1E293B);
}

.cdp-tags-label {
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.4);
}

.cdp-tag {
  display: inline-block;
  padding: 2px 8px;
  margin: 2px 4px;
  background: rgba(96, 165, 250, 0.1);
  color: #60a5fa;
  border-radius: 4px;
  font-size: 0.72rem;
}

.cdp-skill-tag {
  display: inline-block;
  padding: 2px 8px;
  margin: 2px 4px;
  background: rgba(167, 139, 250, 0.1);
  color: #a78bfa;
  border-radius: 4px;
  font-size: 0.72rem;
}

/* Resume */
.cdp-resume {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--color-border-primary, #1E293B);
}

.cdp-resume-info {
  display: flex;
  gap: 16px;
  font-size: 0.75rem;
  color: var(--color-text-muted, #64748B);
  margin-bottom: 8px;
}

.cdp-resume-profile {
  margin-top: 8px;
}

/* Match Analysis */
.cdp-match-header {
  display: flex;
  justify-content: center;
  margin-bottom: 20px;
}

.cdp-score-ring {
  position: relative;
  width: 120px;
  height: 120px;
}

.cdp-score-svg {
  width: 100%;
  height: 100%;
}

.cdp-score-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
}

.cdp-score-num {
  font-size: 1.8rem;
  font-weight: 700;
}

.cdp-score-label {
  font-size: 0.65rem;
  color: rgba(255, 255, 255, 0.4);
}

/* Breakdown Bars */
.cdp-bars {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.cdp-bar-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.cdp-bar-label {
  width: 70px;
  font-size: 0.78rem;
  color: rgba(255, 255, 255, 0.5);
  text-align: right;
}

.cdp-bar-track {
  flex: 1;
  height: 8px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 4px;
  overflow: hidden;
}

.cdp-bar-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.5s ease;
}

.cdp-bar-value {
  width: 32px;
  font-size: 0.8rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.7);
  text-align: right;
}

/* AI Analysis */
.cdp-ai-analysis {
  margin-top: 16px;
}

.cdp-ai-text {
  font-size: 0.82rem;
  line-height: 1.6;
  color: var(--color-text-secondary, #94A3B8);
  background: var(--color-bg-primary, #0D1328);
  border: 1px solid var(--color-border-primary, #1E293B);
  border-radius: 8px;
  padding: 12px;
  margin: 0;
}

.cdp-no-match {
  text-align: center;
  padding: 24px;
  color: rgba(255, 255, 255, 0.4);
}

.cdp-no-match p {
  margin: 0 0 12px;
}

/* ─── Sprint 5-4: AI 招聘建议 ─── */
.cdp-ai-decision {
  margin-top: 20px;
  padding: 20px;
  background: var(--color-bg-elevated, #111827);
  border: 1px solid rgba(99, 102, 241, 0.2);
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.cdp-decision-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.cdp-decision-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-secondary, #94A3B8);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.cdp-decision-grade {
  font-size: 28px;
  font-weight: 800;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  line-height: 1;
}

.cdp-grade-A {
  background: rgba(16, 185, 129, 0.15);
  color: #34D399;
}

.cdp-grade-B {
  background: rgba(245, 158, 11, 0.15);
  color: #FBBF24;
}

.cdp-grade-C {
  background: rgba(239, 68, 68, 0.12);
  color: #F87171;
}

.cdp-decision-detail {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.cdp-decision-column {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cdp-decision-col-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-muted, #64748B);
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.cdp-decision-items {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.cdp-decision-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--color-text-secondary, #94A3B8);
  line-height: 1.3;
}

.cdp-decision-item--pro {
  color: #34D399;
}

.cdp-decision-item--risk {
  color: #FBBF24;
}

.cdp-decision-icon {
  font-size: 12px;
  flex-shrink: 0;
  width: 16px;
  text-align: center;
}

.cdp-decision-empty {
  font-size: 12px;
  color: var(--color-text-muted, #475569);
  font-style: italic;
}

.cdp-decision-action {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--color-border-primary, #1E293B);
}

.cdp-decision-action-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-muted, #64748B);
  text-transform: uppercase;
  letter-spacing: 0.3px;
  flex-shrink: 0;
}

.cdp-decision-action-text {
  font-size: 13px;
  color: var(--color-text-primary, #E2E8F0);
  font-weight: 500;
  flex: 1;
}

.cdp-btn-sm {
  padding: 6px 14px;
  font-size: 12px;
}

/* Interview List */
.cdp-interview-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cdp-interview-item {
  padding: 12px;
  background: var(--color-bg-primary, #0D1328);
  border: 1px solid var(--color-border-primary, #1E293B);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
}

.cdp-interview-item:hover {
  border-color: var(--color-decision, #6366F1);
  background: rgba(99, 102, 241, 0.04);
}

.cdp-interview-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.cdp-interview-title {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--color-text-primary, #E2E8F0);
}

.cdp-interview-status {
  padding: 2px 8px;
  border-radius: 8px;
  font-size: 0.7rem;
  font-weight: 500;
}

.cdp-istatus--preparing { background: rgba(156, 163, 175, 0.15); color: #9ca3af; }
.cdp-istatus--question_ready { background: rgba(96, 165, 250, 0.15); color: #60a5fa; }
.cdp-istatus--in_progress { background: rgba(167, 139, 250, 0.15); color: #a78bfa; }
.cdp-istatus--evaluating { background: rgba(251, 191, 36, 0.15); color: #fbbf24; }
.cdp-istatus--completed { background: rgba(74, 222, 128, 0.15); color: #4ade80; }
.cdp-istatus--decision_made { background: rgba(74, 222, 128, 0.15); color: #4ade80; }

.cdp-interview-meta {
  display: flex;
  gap: 12px;
  font-size: 0.72rem;
  color: var(--color-text-muted, #64748B);
}

.cdp-interview-score {
  color: #4ade80;
  font-weight: 500;
}

/* Timeline */
.cdp-timeline {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.cdp-timeline-item {
  display: flex;
  gap: 12px;
  padding: 8px 0;
  position: relative;
}

.cdp-timeline-item:not(:last-child)::before {
  content: '';
  position: absolute;
  left: 11px;
  top: 28px;
  bottom: -8px;
  width: 1px;
  background: var(--color-border-primary, rgba(255, 255, 255, 0.06));
}

.cdp-timeline-marker {
  width: 24px;
  flex-shrink: 0;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 2px;
}

.cdp-timeline-marker span {
  font-size: 0.75rem;
}

.cdp-timeline-icon--stage_change { color: #60a5fa; }
.cdp-timeline-icon--ai_score { color: #a78bfa; }
.cdp-timeline-icon--ai_interview { color: #fbbf24; }
.cdp-timeline-icon--ai_invite { color: #34d399; }
.cdp-timeline-icon--ai_offer { color: #4ade80; }
.cdp-timeline-icon--note { color: var(--color-text-muted, #64748B); }

.cdp-timeline-content {
  flex: 1;
}

.cdp-timeline-text {
  font-size: 0.8rem;
  color: var(--color-text-secondary, #94A3B8);
}

.cdp-timeline-arrow {
  margin: 0 4px;
  color: var(--color-text-muted, #64748B);
}

.cdp-timeline-meta {
  display: flex;
  gap: 8px;
  margin-top: 2px;
  font-size: 0.7rem;
  color: var(--color-text-muted, #64748B);
}

.cdp-no-timeline {
  text-align: center;
  padding: 20px;
  color: var(--color-text-muted, #64748B);
  font-size: 0.82rem;
}

/* Notes */
.cdp-notes {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.cdp-note-item {
  padding: 10px;
  background: var(--color-bg-primary, #0D1328);
  border: 1px solid var(--color-border-primary, #1E293B);
  border-radius: 8px;
}

.cdp-note-content {
  font-size: 0.82rem;
  color: var(--color-text-secondary, #94A3B8);
  margin: 0 0 4px;
}

.cdp-note-time {
  font-size: 0.7rem;
  color: var(--color-text-muted, #64748B);
}

.cdp-no-notes {
  text-align: center;
  padding: 12px;
  color: var(--color-text-muted, #64748B);
  font-size: 0.8rem;
}

.cdp-note-input {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cdp-note-textarea {
  padding: 8px 12px;
  background: var(--color-bg-primary, #0D1328);
  border: 1px solid var(--color-border-primary, #1E293B);
  border-radius: 8px;
  color: var(--color-text-primary, #E2E8F0);
  font-size: 0.82rem;
  resize: vertical;
  outline: none;
  font-family: inherit;
}

.cdp-note-textarea:focus {
  border-color: var(--color-decision, #6366F1);
  box-shadow: 0 0 0 1px rgba(99, 102, 241, 0.2);
}

/* Responsive */
@media (max-width: 900px) {
  .cdp-grid {
    grid-template-columns: 1fr;
  }
  .cdp-info-grid {
    grid-template-columns: 1fr;
  }
}
</style>
