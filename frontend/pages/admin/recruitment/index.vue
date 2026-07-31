<!-- Admin: 平台运营概览 -->
<!-- 位置：/admin/recruitment/index.vue -->
<!-- 职责：平台级运营总览 — 核心指标 + 健康度 + 快捷入口 + 实时动态 -->
<template>
  <RecruitmentPageShell>
    <template #title>招聘平台运营</template>
    <template #subtitle>平台级运行监控 · 数据实时更新</template>
    <template #actions>
      <button class="rec-btn" @click="loadData" :disabled="loading">
        <span v-if="!loading">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;vertical-align:middle"><path d="M21 12a9 9 0 1 1-9-9"/><path d="M21 3v6h-6"/></svg>
          刷新
        </span>
        <span v-else>加载中...</span>
      </button>
    </template>

    <!-- Loading -->
    <div v-if="loading" class="rec-loading">
      <div class="rec-spinner"></div>
      <span>加载平台数据中...</span>
    </div>

    <template v-else-if="data">
      <!-- Health Banner -->
      <div class="rec-health" :class="healthClass">
        <span class="rec-health-dot"></span>
        {{ healthMessage }}
        <span class="rec-health-rate">健康率 {{ data.overview.healthRate }}</span>
      </div>

      <!-- Core Metrics -->
      <div class="rec-metrics">
        <div class="rec-metric-card" @click="goTo('/admin/recruitment/departments')">
          <div class="rec-metric-value" :style="{ color: 'var(--color-decision)' }">{{ data.overview.enterprises }}</div>
          <div class="rec-metric-label">入驻企业</div>
        </div>
        <div class="rec-metric-card" @click="goTo('/admin/recruitment/agents')">
          <div class="rec-metric-value" :style="{ color: 'var(--color-intelligence)' }">{{ data.overview.aiEmployees }}</div>
          <div class="rec-metric-label">AI 员工</div>
        </div>
        <div class="rec-metric-card" @click="goTo('/admin/recruitment/runtime')">
          <div class="rec-metric-value rec-text-green">{{ data.overview.active }}</div>
          <div class="rec-metric-label">运行中</div>
        </div>
        <div class="rec-metric-card" @click="goTo('/admin/recruitment/runtime')">
          <div class="rec-metric-value rec-text-yellow">{{ data.overview.paused }}</div>
          <div class="rec-metric-label">已暂停</div>
        </div>
        <div class="rec-metric-card" @click="goTo('/admin/recruitment/runtime')">
          <div class="rec-metric-value rec-text-red">{{ data.overview.recovering }}</div>
          <div class="rec-metric-label">恢复中</div>
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="rec-section">
        <h2 class="rec-section-title">快捷入口</h2>
        <div class="rec-quick-actions">
          <button class="rec-quick-btn" @click="goTo('/admin/recruitment/jobs')">
            <svg class="quick-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-decision)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>
            <span class="quick-label">岗位池</span>
            <span class="quick-desc">管理全平台岗位</span>
          </button>
          <button class="rec-quick-btn" @click="goTo('/admin/recruitment/candidates')">
            <svg class="quick-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-intelligence)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            <span class="quick-label">候选人</span>
            <span class="quick-desc">查看候选人池</span>
          </button>
          <button class="rec-quick-btn" @click="goTo('/admin/recruitment/interviews')">
            <svg class="quick-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-execution)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            <span class="quick-label">面试管理</span>
            <span class="quick-desc">全平台面试</span>
          </button>
          <button class="rec-quick-btn" @click="goTo('/admin/recruitment/conversations')">
            <svg class="quick-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-secondary)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <span class="quick-label">会话管理</span>
            <span class="quick-desc">招聘沟通全流程</span>
          </button>
          <button class="rec-quick-btn" @click="goTo('/admin/recruitment/campaigns')">
            <svg class="quick-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-warning)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            <span class="quick-label">Campaign</span>
            <span class="quick-desc">招聘宣传活动</span>
          </button>
          <button class="rec-quick-btn" @click="goTo('/admin/recruitment/audit')">
            <svg class="quick-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-danger)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            <span class="quick-label">审计中心</span>
            <span class="quick-desc">操作审计日志</span>
          </button>
          <!-- 🧠 AI 配置 → 已内嵌为下方 AdminAiConfigPanel，点击展开直接配置 -->
        </div>
      </div>

      <!-- Today Stats -->
      <div class="rec-section">
        <h2 class="rec-section-title">今日动态</h2>
        <div class="rec-today-grid">
          <div class="rec-today-item">
            <span class="today-num" :style="{ color: 'var(--color-decision)' }">{{ data.today.conversations }}</span>
            <span class="today-label">新会话</span>
          </div>
          <div class="rec-today-item">
            <span class="today-num" :style="{ color: 'var(--color-execution)' }">{{ data.today.interviews }}</span>
            <span class="today-label">面试安排</span>
          </div>
          <div class="rec-today-item">
            <span class="today-num" :style="{ color: 'var(--color-intelligence)' }">{{ data.today.campaigns }}</span>
            <span class="today-label">Campaign</span>
          </div>
        </div>
      </div>

      <!-- 🧠 求职顾问 AI 配置（内嵌面板，不跳转） -->
      <AdminAiConfigPanel />

      <!-- Activity Feed -->
      <div class="rec-section">
        <h2 class="rec-section-title">平台动态</h2>
        <div v-if="data.activities?.length" class="rec-activities">
          <div v-for="(act, i) in data.activities" :key="i" class="rec-activity">
            <span class="rec-activity-time">{{ act.time }}</span>
            <span class="rec-activity-text">{{ act.text }}</span>
          </div>
        </div>
        <div v-else class="rec-empty">今日暂无动态</div>
      </div>
    </template>

    <!-- Error State -->
    <div v-else class="rec-error">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-danger)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
      <p>加载失败，请检查网络连接</p>
      <button @click="loadData" class="rec-btn">重试</button>
    </div>
  </RecruitmentPageShell>
</template>

<script setup lang="ts">
import { getAuthToken } from '~/utils/auth/token'
import RecruitmentPageShell from '~/components/enterprise/recruitment/ui/RecruitmentPageShell.vue'
import AdminAiConfigPanel from '~/components/enterprise/recruitment/AdminAiConfigPanel.vue'
definePageMeta({ layout: 'admin-aigc' })
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

interface PlatformOverview {
  overview: {
    enterprises: number
    workspaces: number
    aiEmployees: number
    aiInstances: number
    active: number
    paused: number
    recovering: number
    healthRate: string
  }
  today: {
    conversations: number
    interviews: number
    campaigns: number
  }
  activities: Array<{ time: string; text: string; type: string }>
}

const loading = ref(true)
const data = ref<PlatformOverview | null>(null)

const healthMessage = computed(() => {
  if (!data.value) return '加载中...'
  const rate = parseFloat(data.value.overview.healthRate)
  if (rate >= 70) return '平台运行正常'
  if (rate >= 40) return '部分实例需要关注'
  return '平台运行异常，需要处理'
})

const healthClass = computed(() => {
  if (!data.value) return ''
  const rate = parseFloat(data.value.overview.healthRate)
  if (rate >= 70) return 'healthy'
  if (rate >= 40) return 'warning'
  return 'critical'
})

function goTo(path: string) {
  router.push(path)
}

async function loadData() {
  loading.value = true
  data.value = null
  try {
    const token = getAuthToken() || getAuthToken() || ''
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`
    const res = await fetch('/api/admin/recruitment/overview', { headers })
    if (!res.ok) {
      console.error('Failed to load platform overview:', res.status)
      return
    }
    const json = await res.json()
    data.value = json as PlatformOverview
  } catch (e) {
    console.error('Failed to load platform overview:', e)
  } finally {
    loading.value = false
  }
}

onMounted(() => { loadData() })
</script>

<style scoped>
/* ── Shared button style ── */
.rec-btn {
  display: inline-flex;
  align-items: center;
  padding: 8px 16px;
  border-radius: var(--radius-md, 10px);
  border: 1px solid var(--color-border-primary, #1E293B);
  background: var(--color-bg-elevated, #111827);
  color: var(--color-text-secondary, #94A3B8);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}

.rec-btn:hover:not(:disabled) {
  background: var(--color-bg-hover, #1A2240);
  color: var(--color-text-primary, #F1F5F9);
  border-color: var(--color-border-secondary, #334155);
}

.rec-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ── Loading ── */
.rec-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 48px;
  color: var(--color-text-muted, #64748B);
  font-size: 14px;
}

.rec-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--color-border-primary, #1E293B);
  border-top-color: var(--color-decision, #3B82F6);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

/* ── Health banner ── */
.rec-health {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-radius: var(--radius-md, 10px);
  font-size: 14px;
}

.rec-health.healthy {
  background: var(--color-execution-glow, rgba(16, 185, 129, 0.15));
  color: var(--color-execution, #10B981);
}

.rec-health.warning {
  background: rgba(245, 158, 11, 0.12);
  color: var(--color-warning, #F59E0B);
}

.rec-health.critical {
  background: rgba(239, 68, 68, 0.12);
  color: var(--color-danger, #EF4444);
}

.rec-health-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
}

.rec-health-rate {
  margin-left: auto;
  font-size: 12px;
  opacity: 0.7;
}

/* ── Metrics grid ── */
.rec-metrics {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
}

.rec-metric-card {
  background: var(--color-bg-elevated, #111827);
  border: 1px solid var(--color-border-primary, #1E293B);
  border-radius: var(--radius-lg, 12px);
  padding: 20px 16px;
  text-align: center;
  cursor: pointer;
  transition: all 0.15s;
}

.rec-metric-card:hover {
  background: var(--color-bg-hover, #1A2240);
  border-color: var(--color-decision-glow, rgba(59, 130, 246, 0.3));
  transform: translateY(-1px);
}

.rec-metric-value {
  font-size: 28px;
  font-weight: 700;
  color: var(--color-text-primary, #F1F5F9);
}

.rec-text-green { color: var(--color-execution, #10B981) !important; }
.rec-text-yellow { color: var(--color-warning, #F59E0B) !important; }
.rec-text-red { color: var(--color-danger, #EF4444) !important; }

.rec-metric-label {
  font-size: 12px;
  color: var(--color-text-muted, #64748B);
  margin-top: 4px;
}

/* ── Sections ── */
.rec-section {
  background: var(--color-bg-elevated, #111827);
  border: 1px solid var(--color-border-primary, #1E293B);
  border-radius: var(--radius-lg, 12px);
  padding: 20px;
}

.rec-section-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-primary, #F1F5F9);
  margin: 0 0 16px;
}

/* ── Quick actions ── */
.rec-quick-actions {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.rec-quick-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 18px 12px;
  border-radius: var(--radius-md, 10px);
  border: 1px solid var(--color-border-primary, #1E293B);
  background: var(--color-bg-secondary, #0D1328);
  cursor: pointer;
  transition: all 0.15s;
  color: inherit;
}

.rec-quick-btn:hover {
  background: var(--color-decision-glow, rgba(59, 130, 246, 0.15));
  border-color: var(--color-decision-glow, rgba(59, 130, 246, 0.3));
}

.quick-icon { width: 24px; height: 24px; }
.quick-label { font-size: 13px; font-weight: 500; color: var(--color-text-primary, #F1F5F9); }
.quick-desc { font-size: 11px; color: var(--color-text-muted, #64748B); }

/* ── Today grid ── */
.rec-today-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.rec-today-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px 12px;
  border-radius: var(--radius-md, 10px);
  background: var(--color-bg-secondary, #0D1328);
}

.today-num { font-size: 24px; font-weight: 700; color: var(--color-text-primary, #F1F5F9); }
.today-label { font-size: 12px; color: var(--color-text-muted, #64748B); margin-top: 4px; }

/* ── Activities ── */
.rec-activities {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.rec-activity {
  display: flex;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid var(--color-border-primary, #1E293B);
}

.rec-activity:last-child {
  border-bottom: none;
}

.rec-activity-time {
  font-size: 13px;
  color: var(--color-text-muted, #64748B);
  min-width: 48px;
}

.rec-activity-text {
  font-size: 13px;
  color: var(--color-text-secondary, #94A3B8);
}

.rec-empty {
  text-align: center;
  padding: 24px;
  color: var(--color-text-muted, #64748B);
  font-size: 14px;
}

.rec-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 48px;
  color: var(--color-text-secondary, #94A3B8);
}

@media (max-width: 768px) {
  .rec-metrics { grid-template-columns: repeat(3, 1fr); }
  .rec-quick-actions { grid-template-columns: repeat(2, 1fr); }
  .rec-today-grid { grid-template-columns: repeat(2, 1fr); }
}
</style>
