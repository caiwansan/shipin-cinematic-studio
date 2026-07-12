<template>
  <div class="case-workspace">
    <!-- Header -->
    <div class="case-workspace__header">
      <div class="case-workspace__header-left">
        <button class="case-workspace__back" @click="router.push('/workspace/legal/cases')">← 返回案件列表</button>
        <h1 class="case-workspace__title">{{ caseData?.caseName || '案件工作区' }}</h1>
      </div>
      <div class="case-workspace__status">
        <span :class="['case-workspace__status-badge', `case-workspace__status-badge--${caseData?.status}`]">
          {{ statusLabel(caseData?.status) }}
        </span>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="case-workspace__loading">
      <div class="case-workspace__loading-spinner" />
      <span>加载案件数据...</span>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="case-workspace__error">
      <p>{{ error }}</p>
      <button class="case-workspace__retry-btn" @click="loadWorkspace">重试</button>
    </div>

    <template v-else>
      <div class="case-workspace__grid">
        <!-- Left Column: Main content -->
        <div class="case-workspace__main">
          <!-- 1. Case Overview -->
          <section class="case-workspace__section">
            <div class="case-workspace__section-header">
              <h2>案件概览</h2>
              <button class="case-workspace__section-action" @click="startNewChat">继续咨询</button>
            </div>
            <div class="case-workspace__overview">
              <div class="case-workspace__overview-desc">{{ caseData?.description || '暂无描述' }}</div>
              <div class="case-workspace__overview-meta">
                <span>当事人：{{ caseData?.party || '-' }}</span>
                <span>分类：{{ caseData?.category || '-' }}</span>
                <span>创建时间：{{ formatDate(caseData?.createdAt) }}</span>
              </div>
            </div>
            <!-- AI Summary -->
            <div v-if="latestAnalysis" class="case-workspace__ai-summary">
              <div class="case-workspace__ai-summary-header">
                <span>🤖 AI 分析摘要</span>
                <span class="case-workspace__ai-confidence">置信度：{{ Math.round((latestAnalysis.confidence || 0) * 100) }}%</span>
              </div>
              <p class="case-workspace__ai-summary-text">{{ latestAnalysis.summary }}</p>
            </div>
          </section>

          <!-- 2. Analysis Status -->
          <section class="case-workspace__section">
            <div class="case-workspace__section-header">
              <h2>分析状态</h2>
              <button v-if="!latestAnalysis || latestAnalysis.status !== 'processing'" class="case-workspace__section-action" @click="triggerAnalysis">
                {{ latestAnalysis ? '重新分析' : '开始分析' }}
              </button>
              <span v-else class="case-workspace__processing-label">分析中...</span>
            </div>
            <div v-if="latestAnalysis" class="case-workspace__analysis-detail">
              <div v-if="latestAnalysis.riskAnalysis" class="case-workspace__analysis-block">
                <div class="case-workspace__analysis-label">风险评估</div>
                <div class="case-workspace__analysis-value">{{ parseJSON(latestAnalysis.riskAnalysis)?.level === 'high' ? '🟢 低风险' : parseJSON(latestAnalysis.riskAnalysis)?.level === 'medium' ? '🟡 中风险' : '🔴 高风险' }}</div>
              </div>
              <div v-if="latestAnalysis.aiSuggestion" class="case-workspace__analysis-block">
                <div class="case-workspace__analysis-label">AI 建议</div>
                <div class="case-workspace__analysis-value">{{ latestAnalysis.aiSuggestion }}</div>
              </div>
              <div v-if="latestAnalysis.missingEvidence" class="case-workspace__analysis-block">
                <div class="case-workspace__analysis-label">缺失证据</div>
                <ul class="case-workspace__analysis-list">
                  <li v-for="(item, idx) in safeParseArray(latestAnalysis.missingEvidence)" :key="idx">⚠️ {{ item }}</li>
                </ul>
              </div>
            </div>
            <div v-else class="case-workspace__empty-section">暂无分析，点击"开始分析"</div>
          </section>

          <!-- 3. Chat Sessions -->
          <section class="case-workspace__section">
            <div class="case-workspace__section-header">
              <h2>咨询记录</h2>
              <button class="case-workspace__section-action" @click="startNewChat">新咨询</button>
            </div>
            <div class="case-workspace__chat-list">
              <div v-for="s in chatSessions" :key="s.id" class="case-workspace__chat-item" @click="openChat(s)">
                <div class="case-workspace__chat-item-title">{{ s.title }}</div>
                <div class="case-workspace__chat-item-meta">
                  <span>{{ s._count?.messages || 0 }} 条消息</span>
                  <span>{{ s.status }}</span>
                </div>
              </div>
              <div v-if="chatSessions.length === 0" class="case-workspace__empty-section">暂无咨询记录</div>
            </div>
          </section>

          <!-- 4. Timeline -->
          <section class="case-workspace__section">
            <div class="case-workspace__section-header">
              <h2>时间轴</h2>
            </div>
            <div class="case-workspace__timeline">
              <div v-if="timelineData.length > 0">
                <div v-for="(ev, idx) in timelineData" :key="idx" class="case-workspace__timeline-item">
                  <div class="case-workspace__timeline-dot" :class="`case-workspace__timeline-dot--${ev.status}`" />
                  <div class="case-workspace__timeline-content">
                    <div class="case-workspace__timeline-date">{{ formatDate(ev.evidenceDate || ev.createdAt) }}</div>
                    <div class="case-workspace__timeline-title">{{ ev.title }}</div>
                    <div v-if="ev.description" class="case-workspace__timeline-desc">{{ ev.description }}</div>
                  </div>
                </div>
              </div>
              <div v-else class="case-workspace__empty-section">暂无时间轴数据</div>
            </div>
          </section>

          <!-- 5. Evidence -->
          <section class="case-workspace__section">
            <div class="case-workspace__section-header">
              <h2>证据 ({{ evidence.length }})</h2>
            </div>
            <div class="case-workspace__evidence-grid">
              <div v-for="ev in evidence" :key="ev.id" class="case-workspace__evidence-item">
                <div class="case-workspace__evidence-icon">{{ evidenceIcon(ev.category) }}</div>
                <div class="case-workspace__evidence-info">
                  <div class="case-workspace__evidence-title">{{ ev.title }}</div>
                  <div class="case-workspace__evidence-meta">{{ ev.category }} · {{ ev.status === 'collected' ? '已收集' : ev.status === 'pending' ? '待收集' : ev.status === 'verified' ? '已验证' : '有争议' }}</div>
                </div>
                <span v-if="ev.aiReviewed" class="case-workspace__evidence-reviewed">AI 已审</span>
              </div>
              <div v-if="evidence.length === 0" class="case-workspace__empty-section">暂无证据</div>
            </div>
          </section>
        </div>

        <!-- Right Column: Quick Actions -->
        <div class="case-workspace__sidebar">
          <section class="case-workspace__section">
            <h2 class="case-workspace__section-title-no-border">快捷操作</h2>
            <div class="case-workspace__actions">
              <button class="case-workspace__action-btn" @click="startNewChat">
                <span class="case-workspace__action-icon">💬</span>
                <span>继续咨询</span>
              </button>
              <button class="case-workspace__action-btn" @click="triggerAnalysis">
                <span class="case-workspace__action-icon">🔍</span>
                <span>{{ latestAnalysis ? '重新分析' : 'AI 分析' }}</span>
              </button>
              <button class="case-workspace__action-btn" @click="router.push(`/workspace/legal/contracts?caseId=${caseId}`)">
                <span class="case-workspace__action-icon">📝</span>
                <span>生成合同</span>
              </button>
              <button class="case-workspace__action-btn" @click="router.push(`/workspace/legal/documents?caseId=${caseId}`)">
                <span class="case-workspace__action-icon">📄</span>
                <span>生成文书</span>
              </button>
            </div>
          </section>

          <!-- Related Laws -->
          <section class="case-workspace__section">
            <h2 class="case-workspace__section-title-no-border">涉及法律</h2>
            <div v-if="latestAnalysis?.relatedLaws" class="case-workspace__laws">
              <div v-for="(law, idx) in safeParseArray(latestAnalysis.relatedLaws)" :key="idx" class="case-workspace__law-item">{{ law }}</div>
            </div>
            <div v-else class="case-workspace__empty-section">暂无数据</div>
          </section>

          <!-- Files -->
          <section class="case-workspace__section">
            <h2 class="case-workspace__section-title-no-border">文件 ({{ files.length }})</h2>
            <div class="case-workspace__file-list">
              <div v-for="f in files" :key="f.id" class="case-workspace__file-item">
                <span class="case-workspace__file-icon">{{ fileIcon(f.mimeType) }}</span>
                <div class="case-workspace__file-info">
                  <div class="case-workspace__file-name">{{ f.fileName }}</div>
                  <div class="case-workspace__file-meta">{{ formatSize(f.size) }}</div>
                </div>
              </div>
              <div v-if="files.length === 0" class="case-workspace__empty-section">暂无文件</div>
            </div>
          </section>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '~/stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const caseId = computed(() => route.params.id as string)

const loading = ref(true)
const error = ref<string | null>(null)
const caseData = ref<any>(null)
const chatSessions = ref<any[]>([])
const files = ref<any[]>([])
const latestAnalysis = ref<any>(null)
const evidence = ref<any[]>([])
const contracts = ref<any[]>([])
const documents = ref<any[]>([])

const timelineData = computed(() => {
  // Merge evidence dates + analysis timeline into one sorted timeline
  const items = [...evidence.value]
  // Add analysis-generated timeline items if present
  if (latestAnalysis.value?.timeline) {
    try {
      const parsed = JSON.parse(latestAnalysis.value.timeline)
      if (Array.isArray(parsed)) items.push(...parsed)
    } catch {}
  }
  return items.sort((a, b) => {
    const da = a.evidenceDate || a.createdAt
    const db = b.evidenceDate || b.createdAt
    return new Date(da).getTime() - new Date(db).getTime()
  })
})

function statusLabel(s?: string) {
  const map: Record<string, string> = { draft: '草稿', active: '进行中', pending: '待处理', closed: '已结案', archived: '已归档' }
  return map[s || ''] || s || '-'
}

function formatDate(d?: string) { return d ? new Date(d).toLocaleDateString('zh-CN') : '-' }
function formatSize(bytes: number) {
  if (bytes < 1024) return bytes + 'B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB'
  return (bytes / (1024 * 1024)).toFixed(1) + 'MB'
}
function evidenceIcon(cat?: string) {
  const map: Record<string, string> = { contract: '📄', payment: '💰', chat: '💬', photo: '📷', video: '🎬', other: '📁' }
  return map[cat || ''] || '📁'
}
function fileIcon(mime: string) {
  if (mime.includes('pdf')) return '📕'
  if (mime.includes('word') || mime.includes('doc')) return '📘'
  if (mime.includes('image')) return '🖼️'
  if (mime.includes('excel') || mime.includes('sheet')) return '📊'
  return '📎'
}
function parseJSON(s?: string) { try { return s ? JSON.parse(s) : null } catch { return null } }
function safeParseArray(s?: string) {
  const p = parseJSON(s)
  return Array.isArray(p) ? p : (p ? [p] : [])
}

async function loadWorkspace() {
  loading.value = true
  error.value = null
  try {
    const token = auth.getToken()
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`

    // Get API host from window context (same origin)
    const res = await fetch(`/api/legal/cases/${caseId.value}/workspace`, { headers })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    if (!json.success) throw new Error(json.error || '加载失败')

    const d = json.data
    caseData.value = d.case
    chatSessions.value = d.chatSessions || []
    files.value = d.files || []
    latestAnalysis.value = d.latestAnalysis || null
    evidence.value = d.evidence || []
    contracts.value = d.contracts || []
    documents.value = d.documents || []
  } catch (err: any) {
    error.value = err?.message || '加载案件数据失败'
  } finally {
    loading.value = false
  }
}

function startNewChat() {
  // 跳转到 AI 法律顾问页面，带入案件描述作为上下文
  const desc = caseData.value?.description || ''
  const caseName = caseData.value?.caseName || ''
  router.push(`/workspace/legal/adviser?context=${encodeURIComponent(`案件：${caseName}。案情描述：${desc}`)}`)
}

function openChat(session: any) {
  // 跳转到 AI 法律顾问页面，带入已有咨询会话消息
  router.push(`/workspace/legal/adviser?context=${encodeURIComponent(`历史咨询「${session.title}」的继续咨询`)}`)
}

async function triggerAnalysis() {
  try {
    const token = auth.getToken()
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`

    await fetch(`/api/legal/cases/${caseId.value}/analyses`, {
      method: 'POST',
      headers,
    })
    // Refresh workspace data after a short delay
    setTimeout(loadWorkspace, 1500)
  } catch {}
}

onMounted(loadWorkspace)
</script>

<style scoped>
.case-workspace { max-width: 1400px; margin: 0 auto; padding: 0 0 48px; color: #F8F6F1; }

/* Header */
.case-workspace__header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid rgba(248,246,241,0.06);
}
.case-workspace__header-left { display: flex; align-items: center; gap: 16px; }
.case-workspace__back {
  background: rgba(248,246,241,0.05); border: 1px solid rgba(248,246,241,0.1);
  border-radius: 8px; padding: 6px 14px; color: rgba(248,246,241,0.6); cursor: pointer; font-size: 13px;
}
.case-workspace__back:hover { background: rgba(248,246,241,0.08); }
.case-workspace__title { font-size: 22px; font-weight: 700; margin: 0; }
.case-workspace__status-badge {
  font-size: 12px; padding: 4px 12px; border-radius: 12px;
  background: rgba(248,246,241,0.06); color: rgba(248,246,241,0.5);
}
.case-workspace__status-badge--active { background: rgba(34,197,94,0.15); color: #22c55e; }
.case-workspace__status-badge--pending { background: rgba(251,191,36,0.15); color: #FBBF24; }
.case-workspace__status-badge--closed { background: rgba(99,102,241,0.15); color: #818cf8; }

/* Loading & Error */
.case-workspace__loading, .case-workspace__error {
  text-align: center; padding: 80px 0; color: rgba(248,246,241,0.5);
}
.case-workspace__loading-spinner {
  width: 24px; height: 24px; border: 2px solid rgba(248,246,241,0.1);
  border-top-color: #FBBF24; border-radius: 50%; animation: spin 0.8s linear infinite;
  margin: 0 auto 12px;
}
@keyframes spin { to { transform: rotate(360deg); } }
.case-workspace__retry-btn {
  margin-top: 12px; padding: 8px 20px; background: rgba(251,191,36,0.15);
  border: 1px solid rgba(251,191,36,0.3); border-radius: 8px; color: #FBBF24; cursor: pointer;
}

/* Grid */
.case-workspace__grid { display: grid; grid-template-columns: 1fr 340px; gap: 24px; align-items: start; }

/* Sections */
.case-workspace__section {
  background: rgba(248,246,241,0.02); border: 1px solid rgba(248,246,241,0.06);
  border-radius: 12px; padding: 20px; margin-bottom: 16px;
}
.case-workspace__section-header {
  display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;
}
.case-workspace__section-header h2 { font-size: 16px; font-weight: 600; margin: 0; }
.case-workspace__section-action {
  background: rgba(251,191,36,0.1); border: none; border-radius: 6px;
  padding: 6px 14px; color: #FBBF24; cursor: pointer; font-size: 12px;
}
.case-workspace__section-action:hover { background: rgba(251,191,36,0.18); }
.case-workspace__section-title-no-border {
  font-size: 16px; font-weight: 600; margin: 0 0 16px;
}

/* Overview */
.case-workspace__overview-desc { font-size: 14px; color: rgba(248,246,241,0.6); margin-bottom: 12px; line-height: 1.6; }
.case-workspace__overview-meta { display: flex; gap: 20px; font-size: 12px; color: rgba(248,246,241,0.4); }

/* AI Summary */
.case-workspace__ai-summary {
  margin-top: 16px; padding: 14px; background: rgba(251,191,36,0.04);
  border: 1px solid rgba(251,191,36,0.1); border-radius: 8px;
}
.case-workspace__ai-summary-header {
  display: flex; justify-content: space-between; align-items: center;
  font-size: 13px; font-weight: 500; margin-bottom: 8px;
}
.case-workspace__ai-confidence { font-size: 11px; color: rgba(248,246,241,0.4); }
.case-workspace__ai-summary-text { font-size: 13px; color: rgba(248,246,241,0.7); line-height: 1.6; margin: 0; }

/* Analysis */
.case-workspace__analysis-detail { display: flex; flex-direction: column; gap: 12px; }
.case-workspace__analysis-block { }
.case-workspace__analysis-label { font-size: 12px; color: rgba(248,246,241,0.4); margin-bottom: 4px; }
.case-workspace__analysis-value { font-size: 13px; color: rgba(248,246,241,0.7); }
.case-workspace__analysis-list { margin: 4px 0 0; padding-left: 16px; }
.case-workspace__analysis-list li { font-size: 13px; color: #FBBF24; margin-bottom: 4px; }
.case-workspace__processing-label { font-size: 13px; color: #FBBF24; }

/* Chat List */
.case-workspace__chat-list { display: flex; flex-direction: column; gap: 4px; }
.case-workspace__chat-item {
  padding: 12px; border-radius: 8px; cursor: pointer;
  display: flex; justify-content: space-between; align-items: center;
}
.case-workspace__chat-item:hover { background: rgba(248,246,241,0.04); }
.case-workspace__chat-item-title { font-size: 14px; color: rgba(248,246,241,0.7); }
.case-workspace__chat-item-meta { font-size: 11px; color: rgba(248,246,241,0.3); display: flex; gap: 8px; }

/* Timeline */
.case-workspace__timeline { padding-left: 16px; border-left: 1px solid rgba(248,246,241,0.08); }
.case-workspace__timeline-item { position: relative; padding: 0 0 20px 20px; }
.case-workspace__timeline-dot {
  position: absolute; left: -21px; top: 4px; width: 10px; height: 10px;
  border-radius: 50%; background: rgba(248,246,241,0.2);
}
.case-workspace__timeline-dot--collected { background: #22c55e; }
.case-workspace__timeline-dot--pending { background: #FBBF24; }
.case-workspace__timeline-date { font-size: 11px; color: rgba(248,246,241,0.3); margin-bottom: 2px; }
.case-workspace__timeline-title { font-size: 14px; color: rgba(248,246,241,0.7); }
.case-workspace__timeline-desc { font-size: 12px; color: rgba(248,246,241,0.4); margin-top: 4px; }

/* Evidence */
.case-workspace__evidence-grid { display: flex; flex-direction: column; gap: 4px; }
.case-workspace__evidence-item {
  display: flex; align-items: center; gap: 10px; padding: 10px; border-radius: 8px;
}
.case-workspace__evidence-item:hover { background: rgba(248,246,241,0.03); }
.case-workspace__evidence-icon { font-size: 20px; }
.case-workspace__evidence-info { flex: 1; }
.case-workspace__evidence-title { font-size: 14px; color: rgba(248,246,241,0.7); }
.case-workspace__evidence-meta { font-size: 11px; color: rgba(248,246,241,0.3); }
.case-workspace__evidence-reviewed { font-size: 10px; padding: 2px 6px; background: rgba(251,191,36,0.1); color: #FBBF24; border-radius: 4px; }

/* Sidebar */
.case-workspace__sidebar .case-workspace__section { padding: 16px; }
.case-workspace__actions { display: flex; flex-direction: column; gap: 8px; }
.case-workspace__action-btn {
  display: flex; align-items: center; gap: 10px; padding: 12px;
  background: rgba(248,246,241,0.03); border: 1px solid rgba(248,246,241,0.06);
  border-radius: 8px; color: rgba(248,246,241,0.7); cursor: pointer; font-size: 14px;
  transition: all 0.15s;
}
.case-workspace__action-btn:hover { background: rgba(251,191,36,0.06); border-color: rgba(251,191,36,0.2); color: #FBBF24; }
.case-workspace__action-icon { font-size: 18px; }
.case-workspace__law-item { padding: 6px 0; font-size: 13px; color: rgba(248,246,241,0.6); }

/* Files */
.case-workspace__file-list { display: flex; flex-direction: column; gap: 4px; }
.case-workspace__file-item {
  display: flex; align-items: center; gap: 10px; padding: 8px; border-radius: 6px;
}
.case-workspace__file-item:hover { background: rgba(248,246,241,0.03); }
.case-workspace__file-icon { font-size: 16px; }
.case-workspace__file-info { flex: 1; }
.case-workspace__file-name { font-size: 13px; color: rgba(248,246,241,0.7); }
.case-workspace__file-meta { font-size: 11px; color: rgba(248,246,241,0.3); }

/* Empty state */
.case-workspace__empty-section { text-align: center; padding: 24px; color: rgba(248,246,241,0.25); font-size: 13px; }

@media (max-width: 1024px) { .case-workspace__grid { grid-template-columns: 1fr; } }
</style>
