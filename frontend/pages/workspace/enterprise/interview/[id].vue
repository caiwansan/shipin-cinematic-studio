<!-- Sprint 08: AI 面试执行页 -->
<!-- 位置：/workspace/enterprise/interview/:id -->
<!-- 职责：执行 AI 面试 — 生成题目 → 回答 → 评估 → 报告 -->
<template>
  <div class="interview-exec-page">
    <!-- Header -->
    <div class="iep-header">
      <div class="iep-header-left">
        <button @click="goBack" class="iep-back-btn">← 返回</button>
        <div v-if="session">
          <h1 class="iep-title">{{ session.title || 'AI 面试' }}</h1>
          <p class="iep-subtitle">{{ session.candidateName }} · {{ session.jobTitle }}</p>
        </div>
      </div>
      <div class="iep-header-actions">
        <span v-if="session" class="iep-status" :class="statusClass(session.status)">{{ statusLabel(session.status) }}</span>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="iep-loading">
      <div class="iep-spinner"></div>
      <span>加载中...</span>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="iep-error">
      <span>⚠️ {{ error }}</span>
      <button @click="loadSession" class="iep-retry-btn">重试</button>
    </div>

    <!-- Content -->
    <template v-else-if="session">
      <!-- Step 1: Preparing — Generate Questions -->
      <div v-if="session.status === 'preparing' || session.status === 'question_ready'" class="iep-step">
        <section class="iep-card">
          <h2 class="iep-card-title">📝 面试准备</h2>
          <p class="iep-desc">AI 将根据岗位要求和候选人简历生成面试题目</p>
          <button class="iep-btn iep-btn--primary" @click="generateQuestions" :disabled="isGenerating">
            <span v-if="isGenerating" class="iep-btn-loading">
              <span class="iep-spinner iep-spinner--sm"></span>
              生成中...
            </span>
            <span v-else>{{ session.status === 'question_ready' ? '🔄 重新生成题目' : '🤖 生成面试题目' }}</span>
          </button>
        </section>

        <!-- Questions Preview -->
        <section v-if="questions.length > 0" class="iep-card">
          <h2 class="iep-card-title">📋 面试题目 ({{ questions.length }}题)</h2>
          <div class="iep-questions">
            <div v-for="(q, idx) in questions" :key="q.id" class="iep-question-item">
              <div class="iep-question-header">
                <span class="iep-question-num">Q{{ idx + 1 }}</span>
                <span class="iep-question-category">{{ categoryLabel(q.category) }}</span>
              </div>
              <p class="iep-question-text">{{ q.question }}</p>
              <p v-if="q.expectedAnswer" class="iep-question-expected">期望方向：{{ q.expectedAnswer }}</p>
            </div>
          </div>
          <div class="iep-actions">
            <button class="iep-btn iep-btn--primary" @click="startInterview" :disabled="isStarting">
              <span v-if="isStarting" class="iep-btn-loading">
                <span class="iep-spinner iep-spinner--sm"></span>
                启动中...
              </span>
              <span v-else>▶️ 开始面试</span>
            </button>
          </div>
        </section>
      </div>

      <!-- Step 2: In Progress — Answer Questions -->
      <div v-else-if="session.status === 'in_progress'" class="iep-step">
        <section class="iep-card">
          <div class="iep-progress-header">
            <h2 class="iep-card-title">🎤 面试进行中</h2>
            <span class="iep-progress-counter">{{ answeredCount }} / {{ questions.length }} 题</span>
          </div>
          <div class="iep-progress-bar">
            <div class="iep-progress-fill" :style="{ width: (answeredCount / questions.length * 100) + '%' }"></div>
          </div>
        </section>

        <!-- Question Cards -->
        <section v-for="(q, idx) in questions" :key="q.id" class="iep-card iep-question-card" :class="{ 'iep-question--answered': q.answer }">
          <div class="iep-question-header">
            <span class="iep-question-num">Q{{ idx + 1 }}</span>
            <span class="iep-question-category">{{ categoryLabel(q.category) }}</span>
            <span v-if="q.answer" class="iep-answered-badge">✅ 已回答</span>
          </div>
          <p class="iep-question-text">{{ q.question }}</p>

          <!-- Answer Input -->
          <div class="iep-answer-section">
            <textarea
              v-model="answers[q.id]"
              :disabled="!!q.answer"
              class="iep-answer-input"
              rows="4"
              placeholder="请输入候选人回答..."
            ></textarea>
            <div class="iep-answer-actions">
              <button
                v-if="!q.answer"
                class="iep-btn iep-btn--primary"
                @click="submitAnswer(q.id)"
                :disabled="!answers[q.id]?.trim() || isSubmitting[q.id]"
              >
                <span v-if="isSubmitting[q.id]" class="iep-btn-loading">
                  <span class="iep-spinner iep-spinner--sm"></span>
                  提交中...
                </span>
                <span v-else>💾 保存回答</span>
              </button>
              <span v-else class="iep-followup-label">💡 追问建议：{{ q.followUpSuggestion || '—' }}</span>
            </div>
          </div>
        </section>

        <!-- Submit All -->
        <section v-if="answeredCount === questions.length && questions.length > 0" class="iep-card iep-submit-card">
          <p class="iep-submit-hint">所有题目已回答完毕，提交答案进入评估阶段</p>
          <button class="iep-btn iep-btn--success" @click="submitAllAnswers" :disabled="isSubmittingAll">
            <span v-if="isSubmittingAll" class="iep-btn-loading">
              <span class="iep-spinner iep-spinner--sm"></span>
              提交中...
            </span>
            <span v-else>📤 提交所有答案并评估</span>
          </button>
        </section>
      </div>

      <!-- Step 3: Evaluating — Show spinner -->
      <div v-else-if="session.status === 'evaluating'" class="iep-step">
        <section class="iep-card iep-center">
          <div class="iep-spinner iep-spinner--lg"></div>
          <h2 class="iep-card-title">🤖 AI 正在评估面试结果...</h2>
          <p class="iep-desc">请稍候，通常需要 10-30 秒</p>
        </section>
      </div>

      <!-- Step 4: Completed — Show Report -->
      <div v-else-if="session.status === 'completed' || session.status === 'decision_made'" class="iep-step">
        <!-- Evaluation Report -->
        <section v-if="evaluation" class="iep-card">
          <h2 class="iep-card-title">📊 面试评估报告</h2>

          <!-- Overall Score -->
          <div class="iep-eval-header">
            <div class="iep-eval-score-ring">
              <svg viewBox="0 0 100 100" class="iep-score-svg">
                <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="8" />
                <circle
                  cx="50" cy="50" r="42" fill="none"
                  :stroke="scoreColor(evaluation.overallScore)"
                  stroke-width="8"
                  stroke-linecap="round"
                  :stroke-dasharray="`${(evaluation.overallScore / 100) * 264} 264`"
                  transform="rotate(-90 50 50)"
                />
              </svg>
              <div class="iep-score-text">
                <span class="iep-score-num" :style="{ color: scoreColor(evaluation.overallScore) }">{{ evaluation.overallScore }}</span>
                <span class="iep-score-label">综合评分</span>
              </div>
            </div>
            <div class="iep-eval-recommendation">
              <span class="iep-rec-badge" :class="recClass(evaluation.recommendation)">{{ evaluation.recommendation }}</span>
            </div>
          </div>

          <!-- Dimension Scores -->
          <div class="iep-dimensions">
            <div class="iep-dim-row">
              <span class="iep-dim-label">技术能力</span>
              <div class="iep-dim-bar">
                <div class="iep-dim-fill" :style="{ width: (evaluation.technicalScore || 0) + '%', background: '#60a5fa' }"></div>
              </div>
              <span class="iep-dim-value">{{ evaluation.technicalScore ?? '—' }}</span>
            </div>
            <div class="iep-dim-row">
              <span class="iep-dim-label">沟通表达</span>
              <div class="iep-dim-bar">
                <div class="iep-dim-fill" :style="{ width: (evaluation.communicationScore || 0) + '%', background: '#a78bfa' }"></div>
              </div>
              <span class="iep-dim-value">{{ evaluation.communicationScore ?? '—' }}</span>
            </div>
            <div class="iep-dim-row">
              <span class="iep-dim-label">文化契合</span>
              <div class="iep-dim-bar">
                <div class="iep-dim-fill" :style="{ width: (evaluation.cultureScore || 0) + '%', background: '#34d399' }"></div>
              </div>
              <span class="iep-dim-value">{{ evaluation.cultureScore ?? '—' }}</span>
            </div>
          </div>

          <!-- Summary -->
          <div v-if="evaluation.summary" class="iep-eval-summary">
            <h3 class="iep-sub-title">综合评价</h3>
            <p>{{ evaluation.summary }}</p>
          </div>

          <!-- Strengths -->
          <div v-if="evaluation.strengths?.length" class="iep-eval-section">
            <h3 class="iep-sub-title">✅ 优势</h3>
            <div class="iep-tag-list">
              <span v-for="s in evaluation.strengths" :key="s" class="iep-tag iep-tag--success">{{ s }}</span>
            </div>
          </div>

          <!-- Risks -->
          <div v-if="evaluation.risks?.length" class="iep-eval-section">
            <h3 class="iep-sub-title">⚠️ 风险点</h3>
            <div class="iep-tag-list">
              <span v-for="r in evaluation.risks" :key="r" class="iep-tag iep-tag--warning">{{ r }}</span>
            </div>
          </div>

          <!-- Next Steps -->
          <div v-if="evaluation.nextSteps?.length" class="iep-eval-section">
            <h3 class="iep-sub-title">📋 建议下一步</h3>
            <ul class="iep-next-steps">
              <li v-for="step in evaluation.nextSteps" :key="step">{{ step }}</li>
            </ul>
          </div>
        </section>

        <!-- Decision Actions -->
        <section v-if="session.status === 'completed'" class="iep-card iep-decision-card">
          <h2 class="iep-card-title">🎯 录用决策</h2>
          <div class="iep-decision-actions">
            <button class="iep-btn iep-btn--success" @click="makeDecision('hire')">✅ 推荐录用</button>
            <button class="iep-btn iep-btn--primary" @click="makeDecision('next_round')">🔄 安排下一轮</button>
            <button class="iep-btn iep-btn--danger" @click="makeDecision('reject')">❌ 不推荐</button>
          </div>
        </section>

        <!-- Decision Made -->
        <section v-if="decision" class="iep-card">
          <h2 class="iep-card-title">📋 决策记录</h2>
          <div class="iep-decision-result">
            <span class="iep-decision-badge" :class="decisionClass(decision.decision)">{{ decisionLabel(decision.decision) }}</span>
            <p v-if="decision.reason" class="iep-decision-reason">{{ decision.reason }}</p>
          </div>
        </section>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { getAuthToken } from '~/utils/auth/token'

// ─── Route ───
const route = useRoute()
const sessionId = route.params.id as string

// ─── State ───
const loading = ref(true)
const error = ref('')
const session = ref<any>(null)
const questions = ref<any[]>([])
const evaluation = ref<any>(null)
const decision = ref<any>(null)
const answers = ref<Record<string, string>>({})
const isGenerating = ref(false)
const isStarting = ref(false)
const isSubmitting = ref<Record<string, boolean>>({})
const isSubmittingAll = ref(false)
const pollInterval = ref<ReturnType<typeof setInterval> | null>(null)

// ─── Computed ───
const answeredCount = computed(() => questions.value.filter(q => q.answer).length)

// ─── Data Loading ───
async function loadSession() {
  loading.value = true
  error.value = ''

  try {
    const token = getAuthToken()
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}

    const res = await fetch(`/api/enterprise/recruitment-interview/${sessionId}`, { headers })
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}))
      throw new Error(errData.message || `加载失败 (${res.status})`)
    }
    const data = await res.json()
    session.value = data.data

    // Load questions
    if (data.data.questions) {
      questions.value = data.data.questions
      // Pre-fill answers
      for (const q of data.data.questions) {
        if (q.answer) answers.value[q.id] = q.answer
      }
    }

    // Load evaluation
    if (data.data.evaluation) {
      evaluation.value = data.data.evaluation
    }

    // Load decision
    if (data.data.decision) {
      decision.value = data.data.decision
    }

    // Start polling if in_progress or evaluating
    if (session.value.status === 'in_progress' || session.value.status === 'evaluating') {
      startPolling()
    }

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

async function generateQuestions() {
  isGenerating.value = true
  try {
    const token = getAuthToken()
    const res = await fetch(`/api/enterprise/recruitment-interview/${sessionId}/generate-questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.message || '生成失败')
    }
    const data = await res.json()
    questions.value = data.data.questions
    await loadSession()
  } catch (e: any) {
    alert(`❌ ${e.message}`)
  } finally {
    isGenerating.value = false
  }
}

async function startInterview() {
  isStarting.value = true
  try {
    const token = getAuthToken()
    const res = await fetch(`/api/enterprise/recruitment-interview/${sessionId}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.message || '启动失败')
    }
    await loadSession()
    startPolling()
  } catch (e: any) {
    alert(`❌ ${e.message}`)
  } finally {
    isStarting.value = false
  }
}

async function submitAnswer(questionId: string) {
  if (!answers.value[questionId]?.trim()) return
  isSubmitting.value[questionId] = true
  try {
    const token = getAuthToken()
    const res = await fetch(`/api/enterprise/recruitment-interview/${sessionId}/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ questionId, answer: answers.value[questionId].trim() }),
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.message || '提交失败')
    }
    const data = await res.json()
    // Update question with followUpSuggestion
    const q = questions.value.find(q => q.id === questionId)
    if (q) {
      q.answer = answers.value[questionId].trim()
      q.followUpSuggestion = data.data?.followUpSuggestion || ''
    }
  } catch (e: any) {
    alert(`❌ ${e.message}`)
  } finally {
    isSubmitting.value[questionId] = false
  }
}

async function submitAllAnswers() {
  isSubmittingAll.value = true
  try {
    const token = getAuthToken()
    const answersPayload = questions.value.map(q => ({
      questionId: q.id,
      answer: answers.value[q.id] || q.answer || '',
      score: 70, // Default score, will be overridden by AI evaluation
    }))

    const res = await fetch(`/api/enterprise/recruitment-interview/${sessionId}/submit-answers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ answers: answersPayload }),
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.message || '提交失败')
    }

    // Trigger evaluation
    await triggerEvaluation()
  } catch (e: any) {
    alert(`❌ ${e.message}`)
  } finally {
    isSubmittingAll.value = false
  }
}

async function triggerEvaluation() {
  try {
    const token = getAuthToken()
    const res = await fetch(`/api/enterprise/recruitment-interview/${sessionId}/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.message || '评估失败')
    }
    await loadSession()
  } catch (e: any) {
    alert(`❌ ${e.message}`)
  }
}

async function makeDecision(decisionType: string) {
  const reason = prompt('决策备注（可选）：') || ''
  try {
    const token = getAuthToken()
    const res = await fetch(`/api/enterprise/recruitment-interview/${sessionId}/decision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ decision: decisionType, reason }),
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.message || '决策失败')
    }
    await loadSession()
  } catch (e: any) {
    alert(`❌ ${e.message}`)
  }
}

// ─── Polling ───
function startPolling() {
  if (pollInterval.value) return
  pollInterval.value = setInterval(async () => {
    await loadSession()
    if (session.value?.status === 'completed' || session.value?.status === 'decision_made') {
      stopPolling()
    }
  }, 5000)
}

function stopPolling() {
  if (pollInterval.value) {
    clearInterval(pollInterval.value)
    pollInterval.value = null
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
  return `iep-status--${status}`
}

function categoryLabel(cat: string): string {
  const map: Record<string, string> = {
    technical: '技术', project: '项目', behavioral: '行为', deep: '深度',
  }
  return map[cat] || cat
}

function scoreColor(score: number): string {
  if (score >= 80) return '#4ade80'
  if (score >= 60) return '#fbbf24'
  return '#f87171'
}

function recClass(rec: string): string {
  if (rec.includes('强烈推荐')) return 'iep-rec--strong'
  if (rec.includes('建议')) return 'iep-rec--normal'
  return 'iep-rec--weak'
}

function decisionLabel(dec: string): string {
  const map: Record<string, string> = {
    hire: '推荐录用', reject: '不推荐', next_round: '下一轮面试', pending: '待定',
  }
  return map[dec] || dec
}

function decisionClass(dec: string): string {
  return `iep-decision--${dec}`
}

// ─── Lifecycle ───
onMounted(() => {
  loadSession()
})

onUnmounted(() => {
  stopPolling()
})
</script>

<style scoped>
.interview-exec-page {
  padding: 24px;
  max-width: 900px;
  margin: 0 auto;
}

/* Header */
.iep-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
  flex-wrap: wrap;
  gap: 12px;
}

.iep-header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.iep-back-btn {
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  font-size: 0.85rem;
}

.iep-back-btn:hover {
  background: rgba(255, 255, 255, 0.08);
}

.iep-title {
  font-size: 1.3rem;
  font-weight: 700;
  color: #fff;
  margin: 0;
}

.iep-subtitle {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.5);
  margin: 2px 0 0;
}

.iep-status {
  padding: 4px 12px;
  border-radius: 10px;
  font-size: 0.75rem;
  font-weight: 500;
}

.iep-status--preparing { background: rgba(156, 163, 175, 0.15); color: #9ca3af; }
.iep-status--question_ready { background: rgba(96, 165, 250, 0.15); color: #60a5fa; }
.iep-status--in_progress { background: rgba(167, 139, 250, 0.15); color: #a78bfa; }
.iep-status--evaluating { background: rgba(251, 191, 36, 0.15); color: #fbbf24; }
.iep-status--completed { background: rgba(74, 222, 128, 0.15); color: #4ade80; }
.iep-status--decision_made { background: rgba(74, 222, 128, 0.15); color: #4ade80; }

/* Loading & Error */
.iep-loading, .iep-error {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 60px;
  color: rgba(255, 255, 255, 0.5);
}

.iep-spinner {
  width: 24px;
  height: 24px;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top-color: #60a5fa;
  border-radius: 50%;
  animation: iep-spin 0.8s linear infinite;
}

.iep-spinner--sm {
  width: 14px;
  height: 14px;
  border-width: 2px;
}

.iep-spinner--lg {
  width: 40px;
  height: 40px;
  border-width: 4px;
}

@keyframes iep-spin {
  to { transform: rotate(360deg); }
}

.iep-retry-btn {
  padding: 4px 12px;
  background: rgba(96, 165, 250, 0.15);
  border: 1px solid rgba(96, 165, 250, 0.3);
  border-radius: 6px;
  color: #60a5fa;
  cursor: pointer;
}

/* Cards */
.iep-card {
  background: #0d1220;
  border: 1px solid #1a2240;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 16px;
}

.iep-card-title {
  font-size: 0.95rem;
  font-weight: 600;
  color: #fff;
  margin: 0 0 12px;
}

.iep-sub-title {
  font-size: 0.85rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.7);
  margin: 16px 0 8px;
}

.iep-desc {
  font-size: 0.82rem;
  color: rgba(255, 255, 255, 0.5);
  margin: 0 0 16px;
}

.iep-center {
  text-align: center;
  padding: 40px;
}

.iep-center .iep-spinner {
  margin: 0 auto 16px;
}

/* Buttons */
.iep-btn {
  padding: 10px 20px;
  font-size: 0.85rem;
  font-weight: 500;
  border-radius: 8px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.15s;
}

.iep-btn--primary {
  background: rgba(96, 165, 250, 0.15);
  color: #60a5fa;
  border-color: rgba(96, 165, 250, 0.3);
}

.iep-btn--primary:hover {
  background: rgba(96, 165, 250, 0.25);
}

.iep-btn--success {
  background: rgba(74, 222, 128, 0.15);
  color: #4ade80;
  border-color: rgba(74, 222, 128, 0.3);
}

.iep-btn--success:hover {
  background: rgba(74, 222, 128, 0.25);
}

.iep-btn--danger {
  background: rgba(248, 113, 113, 0.15);
  color: #f87171;
  border-color: rgba(248, 113, 113, 0.3);
}

.iep-btn--danger:hover {
  background: rgba(248, 113, 113, 0.25);
}

.iep-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.iep-btn-loading {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* Questions */
.iep-questions {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}

.iep-question-item {
  padding: 14px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
}

.iep-question-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.iep-question-num {
  font-size: 0.75rem;
  font-weight: 600;
  color: #60a5fa;
  background: rgba(96, 165, 250, 0.1);
  padding: 2px 8px;
  border-radius: 4px;
}

.iep-question-category {
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.4);
  background: rgba(255, 255, 255, 0.04);
  padding: 2px 8px;
  border-radius: 4px;
}

.iep-question-text {
  font-size: 0.88rem;
  color: rgba(255, 255, 255, 0.85);
  margin: 0;
  line-height: 1.5;
}

.iep-question-expected {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.35);
  margin: 8px 0 0;
  font-style: italic;
}

.iep-actions {
  display: flex;
  gap: 8px;
}

/* Progress */
.iep-progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.iep-progress-counter {
  font-size: 0.82rem;
  color: rgba(255, 255, 255, 0.5);
}

.iep-progress-bar {
  height: 6px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 3px;
  overflow: hidden;
}

.iep-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #60a5fa, #a78bfa);
  border-radius: 3px;
  transition: width 0.3s ease;
}

/* Question Card in Progress */
.iep-question-card {
  border-left: 3px solid transparent;
}

.iep-question-card.iep-question--answered {
  border-left-color: #4ade80;
}

.iep-answered-badge {
  font-size: 0.7rem;
  color: #4ade80;
  margin-left: auto;
}

.iep-answer-section {
  margin-top: 12px;
}

.iep-answer-input {
  width: 100%;
  padding: 10px 14px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.85);
  font-size: 0.85rem;
  resize: vertical;
  outline: none;
  font-family: inherit;
  box-sizing: border-box;
}

.iep-answer-input:focus {
  border-color: rgba(96, 165, 250, 0.4);
}

.iep-answer-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.iep-answer-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 8px;
}

.iep-followup-label {
  font-size: 0.78rem;
  color: rgba(251, 191, 36, 0.8);
  font-style: italic;
}

/* Submit Card */
.iep-submit-card {
  text-align: center;
  border-color: rgba(74, 222, 128, 0.3);
  background: rgba(74, 222, 128, 0.04);
}

.iep-submit-hint {
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.6);
  margin: 0 0 12px;
}

/* Evaluation Report */
.iep-eval-header {
  display: flex;
  align-items: center;
  gap: 24px;
  margin-bottom: 20px;
}

.iep-eval-score-ring {
  position: relative;
  width: 100px;
  height: 100px;
  flex-shrink: 0;
}

.iep-score-svg {
  width: 100%;
  height: 100%;
}

.iep-score-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
}

.iep-score-num {
  font-size: 1.5rem;
  font-weight: 700;
}

.iep-score-label {
  font-size: 0.6rem;
  color: rgba(255, 255, 255, 0.4);
}

.iep-eval-recommendation {
  flex: 1;
}

.iep-rec-badge {
  display: inline-block;
  padding: 6px 16px;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 600;
}

.iep-rec--strong {
  background: rgba(74, 222, 128, 0.15);
  color: #4ade80;
}

.iep-rec--normal {
  background: rgba(96, 165, 250, 0.15);
  color: #60a5fa;
}

.iep-rec--weak {
  background: rgba(248, 113, 113, 0.15);
  color: #f87171;
}

/* Dimensions */
.iep-dimensions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 16px;
}

.iep-dim-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.iep-dim-label {
  width: 70px;
  font-size: 0.78rem;
  color: rgba(255, 255, 255, 0.5);
  text-align: right;
}

.iep-dim-bar {
  flex: 1;
  height: 8px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 4px;
  overflow: hidden;
}

.iep-dim-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.5s ease;
}

.iep-dim-value {
  width: 32px;
  font-size: 0.8rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.7);
  text-align: right;
}

/* Summary & Tags */
.iep-eval-summary p {
  font-size: 0.85rem;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.7);
  margin: 0;
}

.iep-tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.iep-tag {
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 500;
}

.iep-tag--success {
  background: rgba(74, 222, 128, 0.1);
  color: #4ade80;
}

.iep-tag--warning {
  background: rgba(251, 191, 36, 0.1);
  color: #fbbf24;
}

.iep-next-steps {
  margin: 0;
  padding-left: 20px;
}

.iep-next-steps li {
  font-size: 0.82rem;
  color: rgba(255, 255, 255, 0.6);
  margin-bottom: 4px;
}

/* Decision */
.iep-decision-card {
  border-color: rgba(96, 165, 250, 0.2);
}

.iep-decision-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.iep-decision-result {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.iep-decision-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 8px;
  font-size: 0.82rem;
  font-weight: 600;
  align-self: flex-start;
}

.iep-decision--hire { background: rgba(74, 222, 128, 0.15); color: #4ade80; }
.iep-decision--reject { background: rgba(248, 113, 113, 0.15); color: #f87171; }
.iep-decision--next_round { background: rgba(96, 165, 250, 0.15); color: #60a5fa; }
.iep-decision--pending { background: rgba(156, 163, 175, 0.15); color: #9ca3af; }

.iep-decision-reason {
  font-size: 0.82rem;
  color: rgba(255, 255, 255, 0.5);
  margin: 0;
}

@media (max-width: 768px) {
  .iep-eval-header {
    flex-direction: column;
    align-items: flex-start;
  }
  .iep-decision-actions {
    flex-direction: column;
  }
}
</style>
