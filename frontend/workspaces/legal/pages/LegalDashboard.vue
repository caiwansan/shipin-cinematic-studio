<template>
  <div class="legal-dashboard">
    <!-- 页面标题 -->
    <div class="legal-dashboard__title">
      <h1 class="legal-dashboard__title-text">法律工作台</h1>
      <p class="legal-dashboard__title-sub">AI 赋能法律实务，高效处理案件与文书</p>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="legal-dashboard__loading">
      <div class="legal-dashboard__loading-spinner" />
      <span>加载数据中...</span>
    </div>

    <!-- ===== KPI 卡片 ===== -->
    <section v-if="!loading" class="legal-dashboard__kpi-bar">
      <div class="legal-dashboard__kpi-card" @click="navigateTo('/workspace/legal/adviser')">
        <div class="legal-dashboard__kpi-icon">🤖</div>
        <div class="legal-dashboard__kpi-value">{{ stats.totalAdviserSessions }}</div>
        <div class="legal-dashboard__kpi-label">AI 法律顾问</div>
      </div>
      <div class="legal-dashboard__kpi-card" @click="navigateTo('/workspace/legal/cases')">
        <div class="legal-dashboard__kpi-icon">📂</div>
        <div class="legal-dashboard__kpi-value">{{ stats.activeCases }}</div>
        <div class="legal-dashboard__kpi-label">我的案件</div>
      </div>
      <div class="legal-dashboard__kpi-card" @click="navigateTo('/workspace/legal/contracts')">
        <div class="legal-dashboard__kpi-icon">📝</div>
        <div class="legal-dashboard__kpi-value">{{ stats.totalContracts }}</div>
        <div class="legal-dashboard__kpi-label">快速生成合同</div>
      </div>
      <div class="legal-dashboard__kpi-card" @click="navigateTo('/workspace/legal/documents')">
        <div class="legal-dashboard__kpi-icon">📄</div>
        <div class="legal-dashboard__kpi-value">{{ stats.totalDocuments }}</div>
        <div class="legal-dashboard__kpi-label">法律文书</div>
      </div>
      <div class="legal-dashboard__kpi-card" @click="navigateTo('/workspace/legal/analysis')">  
        <div class="legal-dashboard__kpi-icon">🔍</div>
        <div class="legal-dashboard__kpi-value">{{ stats.recentAnalyses }}</div>
        <div class="legal-dashboard__kpi-label">最近分析</div>
      </div>
    </section>

    <!-- ===== 错误状态 ===== -->
    <div v-if="error" class="legal-dashboard__error">
      <p>{{ error }}</p>
      <button class="legal-dashboard__retry-btn" @click="loadStats">重试</button>
    </div>

    <!-- ===== 案件管理区域 ===== -->
    <section v-if="!loading && !error" class="legal-dashboard__section">
      <div class="legal-dashboard__section-header">
        <h2 class="legal-dashboard__section-title">案件管理</h2>
        <button class="legal-dashboard__create-btn" @click="navigateTo('/workspace/legal/cases')">查看全部 →</button>
      </div>
      <div class="legal-dashboard__case-grid">
        <!-- 最近案件 -->
        <div class="legal-dashboard__panel">
          <div class="legal-dashboard__panel-title">最近案件</div>
          <div class="legal-dashboard__panel-body">
            <div v-if="recentCases.length === 0" class="legal-dashboard__panel-empty">暂无案件</div>
            <div
              v-for="c in recentCases.slice(0, 5)"
              :key="c.id"
              class="legal-dashboard__case-item"
              @click="navigateTo('/workspace/legal/cases')"
            >
              <div class="legal-dashboard__case-item-name">{{ c.caseName }}</div>
              <span :class="['legal-dashboard__case-status', `legal-dashboard__case-status--${c.status}`]">
                {{ statusLabel(c.status) }}
              </span>
            </div>
          </div>
        </div>
        <!-- 继续分析 -->
        <div class="legal-dashboard__panel">
          <div class="legal-dashboard__panel-title">继续分析</div>
          <div class="legal-dashboard__panel-body">
            <div v-if="pendingCases.length === 0" class="legal-dashboard__panel-empty">暂无待分析案件</div>
            <div
              v-for="c in pendingCases.slice(0, 5)"
              :key="c.id"
              class="legal-dashboard__case-item"
              @click="navigateTo('/workspace/legal/analysis')"
            >
              <div class="legal-dashboard__case-item-name">{{ c.caseName }}</div>
              <span class="legal-dashboard__case-progress">{{ c.analysisProgress || 0 }}%</span>
            </div>
          </div>
        </div>
        <!-- 上传材料 -->
        <div class="legal-dashboard__panel">
          <div class="legal-dashboard__panel-title">上传材料</div>
          <div class="legal-dashboard__panel-body legal-dashboard__upload-area">
            <div class="legal-dashboard__upload-icon">📤</div>
            <p class="legal-dashboard__upload-text">拖拽文件到此处，或点击上传</p>
            <p class="legal-dashboard__upload-hint">支持 PDF, DOCX, 图片格式，最大 50MB</p>
            <button class="legal-dashboard__upload-btn" @click="triggerUpload">选择文件</button>
            <input ref="fileInput" type="file" multiple accept=".pdf,.docx,.doc,.jpg,.jpeg,.png" class="legal-dashboard__file-input" @change="handleFileUpload" />
          </div>
        </div>
      </div>
    </section>

    <!-- ===== 快捷功能入口 ===== -->
    <section v-if="!loading && !error" class="legal-dashboard__section">
      <div class="legal-dashboard__section-header">
        <h2 class="legal-dashboard__section-title">快捷功能</h2>
      </div>
      <div class="legal-dashboard__quick-grid">
        <div class="legal-dashboard__quick-card" @click="navigateTo('/workspace/legal/contracts')">
          <div class="legal-dashboard__quick-icon">📝</div>
          <div class="legal-dashboard__quick-name">合同生成</div>
          <div class="legal-dashboard__quick-desc">智能生成各类法律合同</div>
        </div>
        <div class="legal-dashboard__quick-card" @click="navigateTo('/workspace/legal/documents')">
          <div class="legal-dashboard__quick-icon">📄</div>
          <div class="legal-dashboard__quick-name">法律文书</div>
          <div class="legal-dashboard__quick-desc">起诉状、答辩状等文书起草</div>
        </div>
        <div class="legal-dashboard__quick-card" @click="navigateTo('/workspace/legal/laws')">
          <div class="legal-dashboard__quick-icon">⚖️</div>
          <div class="legal-dashboard__quick-name">法律法规</div>
          <div class="legal-dashboard__quick-desc">查询最新法律法规条文</div>
        </div>
        <div class="legal-dashboard__quick-card" @click="navigateTo('/workspace/legal/cases-db')">
          <div class="legal-dashboard__quick-icon">📚</div>
          <div class="legal-dashboard__quick-name">案例检索</div>
          <div class="legal-dashboard__quick-desc">检索类案裁判文书</div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '~/stores/auth'

const router = useRouter()
const auth = useAuthStore()

const loading = ref(true)
const error = ref<string | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)

interface Stats {
  totalAdviserSessions: number
  activeCases: number
  totalContracts: number
  totalDocuments: number
  recentAnalyses: number
}

interface CaseItem {
  id: string
  caseName: string
  status: string
  analysisProgress?: number
}

const stats = ref<Stats>({
  totalAdviserSessions: 0,
  activeCases: 0,
  totalContracts: 0,
  totalDocuments: 0,
  recentAnalyses: 0,
})

const recentCases = ref<CaseItem[]>([])
const pendingCases = ref<CaseItem[]>([])

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    draft: '草稿', active: '进行中', pending: '待处理',
    closed: '已结案', archived: '已归档',
  }
  return map[status] || status
}

function navigateTo(path: string) {
  router.push(path)
}

function triggerUpload() {
  fileInput.value?.click()
}

async function handleFileUpload(event: Event) {
  const input = event.target as HTMLInputElement
  if (!input.files?.length) return
  const token = auth.getToken()
  if (!token) return
  const formData = new FormData()
  for (const file of Array.from(input.files)) {
    formData.append('files', file)
  }
  try {
    await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData,
    })
  } catch (err: any) {
    console.error('Upload failed:', err)
  }
  input.value = ''
}

async function loadStats() {
  loading.value = true
  error.value = null
  try {
    const token = auth.getToken()
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`

    const res = await fetch('/api/legal/dashboard', { headers })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    if (!json.success) throw new Error(json.error || '加载失败')

    const data = json.data || {}
    stats.value = data.stats || stats.value
    recentCases.value = data.recentCases || []
    pendingCases.value = data.pendingCases || []
  } catch (err: any) {
    error.value = err?.message || '加载数据失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadStats()
})
</script>

<style scoped>
.legal-dashboard {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 0 48px;
  color: #F8F6F1;
}

/* ===== Title ===== */
.legal-dashboard__title {
  margin-bottom: 32px;
}

.legal-dashboard__title-text {
  font-size: 28px;
  font-weight: 700;
  color: #F8F6F1;
  margin: 0 0 4px;
  letter-spacing: -0.03em;
}

.legal-dashboard__title-sub {
  font-size: 15px;
  color: rgba(248, 246, 241, 0.5);
  margin: 0;
}

/* ===== Loading ===== */
.legal-dashboard__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 60px 0;
  color: rgba(248, 246, 241, 0.5);
  font-size: 14px;
}

.legal-dashboard__loading-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(248, 246, 241, 0.1);
  border-top-color: #FBBF24;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ===== Error ===== */
.legal-dashboard__error {
  text-align: center;
  padding: 40px;
  color: rgba(248, 246, 241, 0.6);
}

.legal-dashboard__retry-btn {
  margin-top: 12px;
  padding: 8px 20px;
  background: rgba(251, 191, 36, 0.15);
  border: 1px solid rgba(251, 191, 36, 0.3);
  border-radius: 8px;
  color: #FBBF24;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.15s;
}

.legal-dashboard__retry-btn:hover {
  background: rgba(251, 191, 36, 0.25);
}

/* ===== KPI Bar ===== */
.legal-dashboard__kpi-bar {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
  margin-bottom: 32px;
}

.legal-dashboard__kpi-card {
  background: rgba(248, 246, 241, 0.03);
  border: 1px solid rgba(248, 246, 241, 0.06);
  border-radius: 12px;
  padding: 20px 16px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
}

.legal-dashboard__kpi-card:hover {
  background: rgba(251, 191, 36, 0.06);
  border-color: rgba(251, 191, 36, 0.2);
  transform: translateY(-2px);
}

.legal-dashboard__kpi-icon {
  font-size: 24px;
  margin-bottom: 8px;
}

.legal-dashboard__kpi-value {
  font-size: 28px;
  font-weight: 700;
  color: #FBBF24;
  margin-bottom: 4px;
}

.legal-dashboard__kpi-label {
  font-size: 13px;
  color: rgba(248, 246, 241, 0.5);
}

/* ===== Section ===== */
.legal-dashboard__section {
  margin-bottom: 32px;
}

.legal-dashboard__section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.legal-dashboard__section-title {
  font-size: 18px;
  font-weight: 600;
  color: #F8F6F1;
  margin: 0;
}

.legal-dashboard__create-btn {
  background: transparent;
  border: 1px solid rgba(248, 246, 241, 0.12);
  border-radius: 8px;
  padding: 8px 16px;
  color: rgba(248, 246, 241, 0.6);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}

.legal-dashboard__create-btn:hover {
  border-color: rgba(251, 191, 36, 0.3);
  color: #FBBF24;
}

/* ===== Case Grid ===== */
.legal-dashboard__case-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.legal-dashboard__panel {
  background: rgba(248, 246, 241, 0.02);
  border: 1px solid rgba(248, 246, 241, 0.06);
  border-radius: 12px;
  overflow: hidden;
}

.legal-dashboard__panel-title {
  padding: 14px 16px;
  font-size: 14px;
  font-weight: 600;
  color: rgba(248, 246, 241, 0.8);
  border-bottom: 1px solid rgba(248, 246, 241, 0.06);
}

.legal-dashboard__panel-body {
  padding: 12px;
  min-height: 120px;
}

.legal-dashboard__panel-empty {
  text-align: center;
  padding: 24px;
  color: rgba(248, 246, 241, 0.3);
  font-size: 13px;
}

.legal-dashboard__case-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
}

.legal-dashboard__case-item:hover {
  background: rgba(248, 246, 241, 0.04);
}

.legal-dashboard__case-item-name {
  font-size: 13px;
  color: rgba(248, 246, 241, 0.7);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.legal-dashboard__case-status {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  background: rgba(248, 246, 241, 0.05);
  color: rgba(248, 246, 241, 0.4);
}

.legal-dashboard__case-status--active {
  background: rgba(34, 197, 94, 0.15);
  color: #22c55e;
}

.legal-dashboard__case-status--pending {
  background: rgba(251, 191, 36, 0.15);
  color: #FBBF24;
}

.legal-dashboard__case-status--closed {
  background: rgba(99, 102, 241, 0.15);
  color: #818cf8;
}

.legal-dashboard__case-progress {
  font-size: 12px;
  color: #FBBF24;
  font-weight: 600;
}

/* ===== Upload Area ===== */
.legal-dashboard__upload-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
  text-align: center;
}

.legal-dashboard__upload-icon {
  font-size: 32px;
  margin-bottom: 12px;
}

.legal-dashboard__upload-text {
  font-size: 14px;
  color: rgba(248, 246, 241, 0.6);
  margin: 0 0 4px;
}

.legal-dashboard__upload-hint {
  font-size: 12px;
  color: rgba(248, 246, 241, 0.3);
  margin: 0 0 16px;
}

.legal-dashboard__upload-btn {
  padding: 10px 24px;
  background: rgba(251, 191, 36, 0.12);
  border: 1px solid rgba(251, 191, 36, 0.25);
  border-radius: 8px;
  color: #FBBF24;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}

.legal-dashboard__upload-btn:hover {
  background: rgba(251, 191, 36, 0.2);
}

.legal-dashboard__file-input {
  display: none;
}

/* ===== Quick Grid ===== */
.legal-dashboard__quick-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.legal-dashboard__quick-card {
  background: rgba(248, 246, 241, 0.02);
  border: 1px solid rgba(248, 246, 241, 0.06);
  border-radius: 12px;
  padding: 24px 16px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
}

.legal-dashboard__quick-card:hover {
  background: rgba(251, 191, 36, 0.06);
  border-color: rgba(251, 191, 36, 0.2);
  transform: translateY(-2px);
}

.legal-dashboard__quick-icon {
  font-size: 28px;
  margin-bottom: 10px;
}

.legal-dashboard__quick-name {
  font-size: 15px;
  font-weight: 600;
  color: rgba(248, 246, 241, 0.8);
  margin-bottom: 4px;
}

.legal-dashboard__quick-desc {
  font-size: 12px;
  color: rgba(248, 246, 241, 0.4);
}

/* ===== Responsive ===== */
@media (max-width: 1024px) {
  .legal-dashboard__kpi-bar {
    grid-template-columns: repeat(3, 1fr);
  }
  .legal-dashboard__case-grid {
    grid-template-columns: 1fr 1fr;
  }
  .legal-dashboard__quick-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 640px) {
  .legal-dashboard__kpi-bar {
    grid-template-columns: repeat(2, 1fr);
  }
  .legal-dashboard__case-grid {
    grid-template-columns: 1fr;
  }
  .legal-dashboard__quick-grid {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
