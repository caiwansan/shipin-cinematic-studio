<template>
  <LegalWorkspaceLayout>
    <div class="legal-analysis">
      <!-- Header -->
      <div class="legal-analysis__header">
        <div class="legal-analysis__header-left">
          <button class="legal-analysis__back" @click="goBack">← 返回</button>
          <div>
            <h1 class="legal-analysis__title">案件分析报告</h1>
            <p v-if="caseName" class="legal-analysis__case-name">{{ caseName }}</p>
          </div>
        </div>
        <div class="legal-analysis__header-actions">
          <button
            v-if="!loading && !error"
            class="legal-analysis__btn legal-analysis__btn--primary"
            :disabled="analyzing"
            @click="triggerAnalysis"
          >
            <span v-if="analyzing" class="legal-analysis__spinner" />
            {{ analyzing ? '分析中...' : latestAnalysis ? '重新分析' : '开始分析' }}
          </button>
        </div>
      </div>

      <!-- Error state -->
      <div v-if="error" class="legal-analysis__error-state">
        <div class="legal-analysis__error-icon">⚠️</div>
        <p class="legal-analysis__error-text">{{ error }}</p>
        <button class="legal-analysis__btn legal-analysis__btn--primary" @click="loadData">重试</button>
      </div>

      <!-- Loading state -->
      <div v-else-if="loading" class="legal-analysis__loading-state">
        <div class="legal-analysis__loading-spinner" />
        <p>加载分析数据...</p>
      </div>

      <!-- No case selected -->
      <div v-else-if="!caseId" class="legal-analysis__empty-state">
        <div class="legal-analysis__empty-icon">📋</div>
        <p>请从案件列表中选择一个案件进行 AI 分析</p>
        <button class="legal-analysis__btn legal-analysis__btn--primary" @click="router.push('/workspace/legal/cases')">前往案件列表</button>
      </div>

      <!-- Analysis content -->
      <template v-else>
        <!-- No analysis yet -->
        <div v-if="!latestAnalysis && !analyzing" class="legal-analysis__empty-state">
          <div class="legal-analysis__empty-icon">🔍</div>
          <p>尚未进行分析，点击"开始分析"生成 AI 分析报告</p>
        </div>

        <!-- Analyzing in progress -->
        <div v-else-if="analyzing || (latestAnalysis && latestAnalysis.status === 'processing')" class="legal-analysis__processing-state">
          <div class="legal-analysis__processing-animation">
            <div class="legal-analysis__processing-dot" />
            <div class="legal-analysis__processing-dot" />
            <div class="legal-analysis__processing-dot" />
          </div>
          <p class="legal-analysis__processing-text">AI 正在深度分析案件...</p>
          <p class="legal-analysis__processing-hint">分析完成时间取决于案件复杂度和模型响应速度</p>
        </div>

        <!-- Analysis report -->
        <div v-else-if="latestAnalysis && latestAnalysis.status === 'done'" class="legal-analysis__report">
          <div class="legal-analysis__report-meta">
            <span>分析版本 v{{ latestAnalysis.version }}</span>
            <span>·</span>
            <span>{{ formatDate(latestAnalysis.createdAt) }}</span>
            <span v-if="latestAnalysis.confidence" class="legal-analysis__confidence">· 置信度 {{ Math.round(latestAnalysis.confidence * 100) }}%</span>
          </div>

          <!-- Report grid -->
          <div class="legal-analysis__report-grid">
            <!-- Left: Main content -->
            <div class="legal-analysis__report-main">
              <!-- AI 摘要 -->
              <section class="legal-analysis__card">
                <div class="legal-analysis__card-header">
                  <span class="legal-analysis__card-icon">📝</span>
                  <h2 class="legal-analysis__card-title">案件摘要</h2>
                </div>
                <div class="legal-analysis__card-body">
                  <p class="legal-analysis__summary-text">{{ latestAnalysis.summary || '暂无摘要' }}</p>
                </div>
              </section>

              <!-- 风险评估 -->
              <section class="legal-analysis__card">
                <div class="legal-analysis__card-header">
                  <span class="legal-analysis__card-icon">⚠️</span>
                  <h2 class="legal-analysis__card-title">风险评估</h2>
                </div>
                <div v-if="parsedRisk" class="legal-analysis__card-body">
                  <div class="legal-analysis__risk-level">
                    <span
                      :class="[
                        'legal-analysis__risk-badge',
                        `legal-analysis__risk-badge--${parsedRisk.level || 'medium'}`
                      ]"
                    >
                      {{ riskLabel(parsedRisk.level) }}
                    </span>
                    <span class="legal-analysis__risk-score" v-if="parsedRisk.score">评分：{{ parsedRisk.score }}/10</span>
                  </div>
                  <div v-if="parsedRisk.items && parsedRisk.items.length" class="legal-analysis__risk-list">
                    <div v-for="(item, idx) in parsedRisk.items" :key="idx" class="legal-analysis__risk-item">
                      <span class="legal-analysis__risk-dot">•</span>
                      <span>{{ typeof item === 'string' ? item : item.desc || item }}</span>
                    </div>
                  </div>
                  <p v-else class="legal-analysis__fallback-text">{{ latestAnalysis.riskAnalysis }}</p>
                </div>
                <div v-else-if="latestAnalysis.riskAnalysis" class="legal-analysis__card-body">
                  <p class="legal-analysis__fallback-text">{{ latestAnalysis.riskAnalysis }}</p>
                </div>
                <div v-else class="legal-analysis__card-body">
                  <p class="legal-analysis__empty-text">暂无风险分析</p>
                </div>
              </section>

              <!-- 证据需求 -->
              <section class="legal-analysis__card">
                <div class="legal-analysis__card-header">
                  <span class="legal-analysis__card-icon">📎</span>
                  <h2 class="legal-analysis__card-title">证据需求与缺失</h2>
                </div>
                <div v-if="parsedEvidence && parsedEvidence.length" class="legal-analysis__card-body">
                  <div v-for="(item, idx) in parsedEvidence" :key="idx" class="legal-analysis__evidence-item">
                    <span class="legal-analysis__evidence-bullet">{{ idx + 1 }}.</span>
                    <div class="legal-analysis__evidence-content">
                      <span>{{ typeof item === 'string' ? item : item.name || item }}</span>
                      <span v-if="typeof item === 'object' && item.priority" class="legal-analysis__evidence-priority">({{ item.priority }})</span>
                    </div>
                  </div>
                </div>
                <div v-else-if="latestAnalysis.missingEvidence" class="legal-analysis__card-body">
                  <p class="legal-analysis__fallback-text">{{ latestAnalysis.missingEvidence }}</p>
                </div>
                <div v-else class="legal-analysis__card-body">
                  <p class="legal-analysis__empty-text">暂无证据分析</p>
                </div>
              </section>
            </div>

            <!-- Right: Sidebar -->
            <div class="legal-analysis__report-sidebar">
              <!-- 时间线 -->
              <section class="legal-analysis__card">
                <div class="legal-analysis__card-header">
                  <span class="legal-analysis__card-icon">📅</span>
                  <h2 class="legal-analysis__card-title">时间线</h2>
                </div>
                <div v-if="parsedTimeline && parsedTimeline.length" class="legal-analysis__card-body">
                  <div class="legal-analysis__timeline">
                    <div v-for="(item, idx) in parsedTimeline.slice(0, 8)" :key="idx" class="legal-analysis__timeline-item">
                      <div class="legal-analysis__timeline-dot" />
                      <div class="legal-analysis__timeline-info">
                        <span class="legal-analysis__timeline-date">{{ item.date || '-' }}</span>
                        <span class="legal-analysis__timeline-desc">{{ item.event || item }}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div v-else class="legal-analysis__card-body">
                  <p class="legal-analysis__empty-text">暂无时间线</p>
                </div>
              </section>

              <!-- 涉及法律 -->
              <section class="legal-analysis__card">
                <div class="legal-analysis__card-header">
                  <span class="legal-analysis__card-icon">⚖️</span>
                  <h2 class="legal-analysis__card-title">涉及法律</h2>
                </div>
                <div v-if="parsedLaws && parsedLaws.length" class="legal-analysis__card-body">
                  <div v-for="(law, idx) in parsedLaws" :key="idx" class="legal-analysis__law-item">
                    <span class="legal-analysis__law-bullet">{{ idx + 1 }}</span>
                    <span class="legal-analysis__law-name">{{ law.name || law.title || law }}</span>
                  </div>
                </div>
                <div v-else-if="latestAnalysis.relatedLaws" class="legal-analysis__card-body">
                  <p class="legal-analysis__fallback-text">{{ latestAnalysis.relatedLaws }}</p>
                </div>
                <div v-else class="legal-analysis__card-body">
                  <p class="legal-analysis__empty-text">暂无</p>
                </div>
              </section>

              <!-- AI 建议 -->
              <section class="legal-analysis__card">
                <div class="legal-analysis__card-header">
                  <span class="legal-analysis__card-icon">💡</span>
                  <h2 class="legal-analysis__card-title">AI 建议</h2>
                </div>
                <div class="legal-analysis__card-body">
                  <p v-if="latestAnalysis.aiSuggestion" class="legal-analysis__suggestion-text">{{ latestAnalysis.aiSuggestion }}</p>
                  <p v-else class="legal-analysis__empty-text">暂无建议</p>
                </div>
              </section>
            </div>
          </div>

          <!-- 分析失败提示 -->
          <div v-if="latestAnalysis && latestAnalysis.status === 'failed'" class="legal-analysis__failed-state">
            <div class="legal-analysis__failed-icon">❌</div>
            <p class="legal-analysis__failed-text">{{ latestAnalysis.summary || '分析失败，请重试' }}</p>
            <button class="legal-analysis__btn legal-analysis__btn--primary" @click="triggerAnalysis">重新分析</button>
          </div>
        </div>
      </template>
    </div>
  </LegalWorkspaceLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '~/stores/auth'
import LegalWorkspaceLayout from 'workspaces/legal/layouts/LegalWorkspaceLayout.vue'

definePageMeta({ layout: false })

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

// 支持 ?caseId=xxx 参数，也支持 /workspace/legal/analysis/:caseId 路由
const caseId = computed(() => route.query.caseId as string || route.params.id as string || '')

const loading = ref(true)
const error = ref<string | null>(null)
const analyzing = ref(false)
const caseName = ref('')
const latestAnalysis = ref<any>(null)

// Parse JSON fields safely
const parsedRisk = computed(() => {
  if (!latestAnalysis.value?.riskAnalysis) return null
  try {
    const p = JSON.parse(latestAnalysis.value.riskAnalysis)
    return typeof p === 'object' ? p : null
  } catch { return null }
})

const parsedEvidence = computed(() => {
  if (!latestAnalysis.value?.missingEvidence) return null
  try {
    const p = JSON.parse(latestAnalysis.value.missingEvidence)
    return Array.isArray(p) ? p : null
  } catch { return null }
})

const parsedTimeline = computed(() => {
  if (!latestAnalysis.value?.timeline) return null
  try {
    const p = JSON.parse(latestAnalysis.value.timeline)
    return Array.isArray(p) ? p : null
  } catch { return null }
})

const parsedLaws = computed(() => {
  if (!latestAnalysis.value?.relatedLaws) return null
  try {
    const p = JSON.parse(latestAnalysis.value.relatedLaws)
    return Array.isArray(p) ? p : null
  } catch { return null }
})

function riskLabel(level?: string) {
  const map: Record<string, string> = { low: '低风险 🟢', medium: '中风险 🟡', high: '高风险 🔴' }
  return map[level || ''] || '未知'
}

function formatDate(d?: string) {
  if (!d) return '-'
  return new Date(d).toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  })
}

function goBack() {
  if (caseId.value) {
    router.push(`/workspace/legal/cases/${caseId.value}`)
  } else {
    router.push('/workspace/legal/cases')
  }
}

async function loadData() {
  if (!caseId.value) {
    loading.value = false
    return
  }

  loading.value = true
  error.value = null

  try {
    const token = auth.getToken()
    /** @type {Record<string,string>} */
    const h: Record<string, string> = {}
    if (token) h['Authorization'] = `Bearer ${token}`

    // 获取案件信息
    const caseRes = await fetch(`/api/legal/cases/${caseId.value}`, {
      headers: h,
    })
    const caseData = await caseRes.json()
    if (caseData.success) {
      caseName.value = caseData.data?.caseName || ''
    }

    // 获取最新分析
    const analysisRes = await fetch(`/api/legal/cases/${caseId.value}/analyses/latest`, {
      headers: h,
    })
    const analysisData = await analysisRes.json()
    if (analysisData.success && analysisData.data) {
      latestAnalysis.value = analysisData.data
      // 如果正在处理中，轮询
      if (analysisData.data.status === 'processing') {
        pollAnalysis()
      }
    }
  } catch (err: any) {
    error.value = err.message || '加载失败'
  } finally {
    loading.value = false
  }
}

let pollTimer: ReturnType<typeof setInterval> | null = null

function pollAnalysis() {
  if (pollTimer) clearInterval(pollTimer)
  pollTimer = setInterval(async () => {
    try {
      const token = auth.getToken()
      /** @type {Record<string,string>} */
      const h: Record<string, string> = {}
      if (token) h['Authorization'] = `Bearer ${token}`

      const res = await fetch(`/api/legal/cases/${caseId.value}/analyses/latest`, {
        headers: h,
      })
      const data = await res.json()
      if (data.success && data.data) {
        latestAnalysis.value = data.data
        if (data.data.status !== 'processing') {
          if (pollTimer) clearInterval(pollTimer)
          pollTimer = null
          analyzing.value = false
        }
      }
    } catch { /* ignore poll errors */ }
  }, 3000)
}

async function triggerAnalysis() {
  if (!caseId.value || analyzing.value) return

  analyzing.value = true
  error.value = null

  try {
    const token = auth.getToken()
    /** @type {Record<string,string>} */
    const h: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) h['Authorization'] = `Bearer ${token}`

    const res = await fetch(`/api/legal/cases/${caseId.value}/analyses`, {
      method: 'POST',
      headers: h,
      body: JSON.stringify({}),
    })
    const data = await res.json()

    if (data.success) {
      // 立即开始轮询
      latestAnalysis.value = data.data
      pollAnalysis()
    } else {
      error.value = data.error || '触发分析失败'
      analyzing.value = false
    }
  } catch (err: any) {
    error.value = err.message || '触发分析失败'
    analyzing.value = false
  }
}

onMounted(() => {
  loadData()
})

// Cleanup poll on unmount
import { onUnmounted } from 'vue'
onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
})
</script>

<style scoped>
/* ── Layout ── */
.legal-analysis {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 0 48px;
  color: #F8F6F1;
}

/* ── Header ── */
.legal-analysis__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(248,246,241,0.06);
}

.legal-analysis__header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.legal-analysis__back {
  background: rgba(248,246,241,0.05);
  border: 1px solid rgba(248,246,241,0.1);
  border-radius: 8px;
  padding: 6px 14px;
  color: rgba(248,246,241,0.6);
  cursor: pointer;
  font-size: 13px;
  transition: all 0.15s;
}
.legal-analysis__back:hover {
  background: rgba(248,246,241,0.08);
  color: #F8F6F1;
}

.legal-analysis__title {
  font-size: 22px;
  font-weight: 700;
  margin: 0;
}

.legal-analysis__case-name {
  font-size: 13px;
  color: rgba(248,246,241,0.4);
  margin: 2px 0 0;
}

/* ── Buttons ── */
.legal-analysis__btn {
  padding: 8px 20px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  border: none;
  transition: all 0.15s;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.legal-analysis__btn--primary {
  background: rgba(251,191,36,0.12);
  border: 1px solid rgba(251,191,36,0.25);
  color: #FBBF24;
}
.legal-analysis__btn--primary:hover:not(:disabled) {
  background: rgba(251,191,36,0.2);
  border-color: rgba(251,191,36,0.4);
}
.legal-analysis__btn--primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ── States ── */
.legal-analysis__error-state,
.legal-analysis__loading-state,
.legal-analysis__empty-state,
.legal-analysis__processing-state,
.legal-analysis__failed-state {
  text-align: center;
  padding: 80px 0;
  color: rgba(248,246,241,0.5);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.legal-analysis__error-icon,
.legal-analysis__empty-icon,
.legal-analysis__failed-icon {
  font-size: 48px;
  margin-bottom: 8px;
}

.legal-analysis__loading-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid rgba(248,246,241,0.1);
  border-top-color: #FBBF24;
  border-radius: 50%;
  animation: legal-analysis-spin 0.8s linear infinite;
  margin: 0 auto 12px;
}

@keyframes legal-analysis-spin {
  to { transform: rotate(360deg); }
}

.legal-analysis__spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(251,191,36,0.3);
  border-top-color: #FBBF24;
  border-radius: 50%;
  animation: legal-analysis-spin 0.8s linear infinite;
  display: inline-block;
}

.legal-analysis__processing-animation {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.legal-analysis__processing-dot {
  width: 12px;
  height: 12px;
  background: #FBBF24;
  border-radius: 50%;
  animation: legal-analysis-bounce 1.4s ease-in-out infinite both;
}
.legal-analysis__processing-dot:nth-child(1) { animation-delay: -0.32s; }
.legal-analysis__processing-dot:nth-child(2) { animation-delay: -0.16s; }
.legal-analysis__processing-dot:nth-child(3) { animation-delay: 0s; }

@keyframes legal-analysis-bounce {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
  40% { transform: scale(1); opacity: 1; }
}

.legal-analysis__processing-text {
  font-size: 16px;
  color: #FBBF24;
  margin: 0;
}

.legal-analysis__processing-hint {
  font-size: 12px;
  color: rgba(248,246,241,0.3);
  margin: 0;
}

.legal-analysis__error-text,
.legal-analysis__failed-text {
  font-size: 14px;
  color: rgba(248,246,241,0.6);
}

/* ── Report ── */
.legal-analysis__report-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: rgba(248,246,241,0.3);
  margin-bottom: 20px;
}

.legal-analysis__confidence {
  color: #22c55e;
}

.legal-analysis__report-grid {
  display: grid;
  grid-template-columns: 1fr 340px;
  gap: 20px;
  align-items: start;
}

.legal-analysis__report-main {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.legal-analysis__report-sidebar {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ── Card ── */
.legal-analysis__card {
  background: rgba(248,246,241,0.02);
  border: 1px solid rgba(248,246,241,0.06);
  border-radius: 12px;
  overflow: hidden;
}

.legal-analysis__card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px 20px 0;
}

.legal-analysis__card-icon {
  font-size: 16px;
}

.legal-analysis__card-title {
  font-size: 14px;
  font-weight: 600;
  margin: 0;
  color: #F8F6F1;
}

.legal-analysis__card-body {
  padding: 12px 20px 16px;
}

/* ── Summary ── */
.legal-analysis__summary-text {
  font-size: 14px;
  line-height: 1.8;
  color: rgba(248,246,241,0.7);
  margin: 0;
}

/* ── Risk ── */
.legal-analysis__risk-level {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.legal-analysis__risk-badge {
  font-size: 12px;
  font-weight: 600;
  padding: 4px 12px;
  border-radius: 12px;
}

.legal-analysis__risk-badge--low {
  background: rgba(34,197,94,0.12);
  color: #22c55e;
}

.legal-analysis__risk-badge--medium {
  background: rgba(251,191,36,0.12);
  color: #FBBF24;
}

.legal-analysis__risk-badge--high {
  background: rgba(239,68,68,0.12);
  color: #ef4444;
}

.legal-analysis__risk-score {
  font-size: 12px;
  color: rgba(248,246,241,0.4);
}

.legal-analysis__risk-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.legal-analysis__risk-item {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  font-size: 13px;
  color: rgba(248,246,241,0.65);
  line-height: 1.5;
}

.legal-analysis__risk-dot {
  color: #FBBF24;
  flex-shrink: 0;
}

/* ── Evidence ── */
.legal-analysis__evidence-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 0;
  border-bottom: 1px solid rgba(248,246,241,0.04);
  font-size: 13px;
  color: rgba(248,246,241,0.65);
  line-height: 1.5;
}

.legal-analysis__evidence-item:last-child {
  border-bottom: none;
}

.legal-analysis__evidence-bullet {
  color: #FBBF24;
  flex-shrink: 0;
  font-weight: 500;
}

.legal-analysis__evidence-content {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.legal-analysis__evidence-priority {
  color: rgba(248,246,241,0.3);
  font-size: 11px;
}

/* ── Timeline ── */
.legal-analysis__timeline {
  padding-left: 8px;
}

.legal-analysis__timeline-item {
  position: relative;
  padding: 0 0 16px 20px;
  border-left: 1px solid rgba(248,246,241,0.08);
}

.legal-analysis__timeline-item:last-child {
  padding-bottom: 0;
}

.legal-analysis__timeline-dot {
  position: absolute;
  left: -4px;
  top: 4px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(251,191,36,0.5);
}

.legal-analysis__timeline-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.legal-analysis__timeline-date {
  font-size: 11px;
  color: rgba(248,246,241,0.3);
}

.legal-analysis__timeline-desc {
  font-size: 13px;
  color: rgba(248,246,241,0.6);
  line-height: 1.4;
}

/* ── Laws ── */
.legal-analysis__law-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 6px 0;
  font-size: 13px;
  line-height: 1.5;
}

.legal-analysis__law-bullet {
  color: #FBBF24;
  flex-shrink: 0;
  font-weight: 500;
  font-size: 11px;
  margin-top: 2px;
}

.legal-analysis__law-name {
  color: rgba(248,246,241,0.65);
}

/* ── AI Suggestion ── */
.legal-analysis__suggestion-text {
  font-size: 13px;
  line-height: 1.7;
  color: rgba(248,246,241,0.7);
  margin: 0;
  padding: 8px 12px;
  background: rgba(251,191,36,0.03);
  border: 1px solid rgba(251,191,36,0.08);
  border-radius: 8px;
}

/* ── Fallback / Empty ── */
.legal-analysis__fallback-text {
  font-size: 13px;
  line-height: 1.6;
  color: rgba(248,246,241,0.5);
  margin: 0;
  white-space: pre-wrap;
}

.legal-analysis__empty-text {
  font-size: 13px;
  color: rgba(248,246,241,0.25);
  margin: 0;
  text-align: center;
  padding: 8px 0;
}

/* ── Responsive ── */
@media (max-width: 1024px) {
  .legal-analysis__report-grid {
    grid-template-columns: 1fr;
  }
}
</style>
