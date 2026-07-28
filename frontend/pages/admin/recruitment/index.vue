<!-- Admin: 平台运营概览 -->
<!-- 位置：/admin/recruitment/index.vue -->
<!-- 职责：平台级运营总览 — 核心指标 + 健康度 + 快捷入口 + 实时动态 -->
<template>
  <div class="admin-rec-page">
    <!-- Header -->
    <div class="admin-rec-header">
      <div>
        <h1 class="admin-rec-title">招聘平台运营</h1>
        <p class="admin-rec-subtitle">平台级运行监控 · 数据实时更新</p>
      </div>
      <div class="admin-rec-header-actions">
        <button class="admin-rec-btn" @click="loadData" :disabled="loading">
          <span v-if="!loading">🔄 刷新</span>
          <span v-else>加载中...</span>
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="admin-rec-loading">
      <div class="admin-rec-spinner"></div>
      <span>加载平台数据中...</span>
    </div>

    <template v-else-if="data">
      <!-- Health Banner -->
      <div class="admin-rec-health" :class="healthClass">
        <span class="admin-rec-health-dot"></span>
        {{ healthMessage }}
        <span class="admin-rec-health-rate">健康率 {{ data.overview.healthRate }}</span>
      </div>

      <!-- Core Metrics -->
      <div class="admin-rec-metrics">
        <div class="admin-rec-metric-card" @click="goTo('/admin/recruitment/departments')">
          <div class="admin-rec-metric-value">{{ data.overview.enterprises }}</div>
          <div class="admin-rec-metric-label">入驻企业</div>
        </div>
        <div class="admin-rec-metric-card" @click="goTo('/admin/recruitment/agents')">
          <div class="admin-rec-metric-value">{{ data.overview.aiEmployees }}</div>
          <div class="admin-rec-metric-label">AI 员工</div>
        </div>
        <div class="admin-rec-metric-card" @click="goTo('/admin/recruitment/runtime')">
          <div class="admin-rec-metric-value text-green">{{ data.overview.active }}</div>
          <div class="admin-rec-metric-label">运行中</div>
        </div>
        <div class="admin-rec-metric-card" @click="goTo('/admin/recruitment/runtime')">
          <div class="admin-rec-metric-value text-yellow">{{ data.overview.paused }}</div>
          <div class="admin-rec-metric-label">已暂停</div>
        </div>
        <div class="admin-rec-metric-card" @click="goTo('/admin/recruitment/runtime')">
          <div class="admin-rec-metric-value text-red">{{ data.overview.recovering }}</div>
          <div class="admin-rec-metric-label">恢复中</div>
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="admin-rec-section">
        <h2 class="admin-rec-section-title">快捷入口</h2>
        <div class="admin-rec-quick-actions">
          <button class="admin-rec-quick-btn" @click="goTo('/admin/recruitment/jobs')">
            <span class="quick-icon">📋</span>
            <span class="quick-label">岗位池</span>
            <span class="quick-desc">管理全平台岗位</span>
          </button>
          <button class="admin-rec-quick-btn" @click="goTo('/admin/recruitment/candidates')">
            <span class="quick-icon">👤</span>
            <span class="quick-label">候选人</span>
            <span class="quick-desc">查看候选人池</span>
          </button>
          <button class="admin-rec-quick-btn" @click="goTo('/admin/recruitment/interviews')">
            <span class="quick-icon">🎤</span>
            <span class="quick-label">面试管理</span>
            <span class="quick-desc">全平台面试</span>
          </button>
          <button class="admin-rec-quick-btn" @click="goTo('/admin/recruitment/conversations')">
            <span class="quick-icon">💬</span>
            <span class="quick-label">会话管理</span>
            <span class="quick-desc">招聘沟通全流程</span>
          </button>
          <button class="admin-rec-quick-btn" @click="goTo('/admin/recruitment/campaigns')">
            <span class="quick-icon">📢</span>
            <span class="quick-label">Campaign</span>
            <span class="quick-desc">招聘宣传活动</span>
          </button>
          <button class="admin-rec-quick-btn" @click="goTo('/admin/recruitment/audit')">
            <span class="quick-icon">🔍</span>
            <span class="quick-label">审计中心</span>
            <span class="quick-desc">操作审计日志</span>
          </button>
        </div>
      </div>

      <!-- Today Stats -->
      <div class="admin-rec-section">
        <h2 class="admin-rec-section-title">今日动态</h2>
        <div class="admin-rec-today-grid">
          <div class="admin-rec-today-item">
            <span class="today-num">{{ data.today.conversations }}</span>
            <span class="today-label">新会话</span>
          </div>
          <div class="admin-rec-today-item">
            <span class="today-num">{{ data.today.interviews }}</span>
            <span class="today-label">面试安排</span>
          </div>
          <div class="admin-rec-today-item">
            <span class="today-num">{{ data.today.campaigns }}</span>
            <span class="today-label">Campaign</span>
          </div>
        </div>
      </div>

      <!-- Activity Feed -->
      <div class="admin-rec-section">
        <h2 class="admin-rec-section-title">平台动态</h2>
        <div v-if="data.activities?.length" class="admin-rec-activities">
          <div v-for="(act, i) in data.activities" :key="i" class="admin-rec-activity">
            <span class="admin-rec-activity-time">{{ act.time }}</span>
            <span class="admin-rec-activity-text">{{ act.text }}</span>
          </div>
        </div>
        <div v-else class="admin-rec-empty">今日暂无动态</div>
      </div>
    </template>

    <!-- Error State -->
    <div v-else class="admin-rec-error">
      <p>⚠️ 加载失败，请检查网络连接</p>
      <button @click="loadData" class="admin-rec-btn">重试</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { getAuthToken } from '~/utils/auth/token'
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
.admin-rec-page {
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;
}

.admin-rec-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
}

.admin-rec-title {
  font-size: 22px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.9);
  margin: 0;
}

.admin-rec-subtitle {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.4);
  margin: 4px 0 0;
}

.admin-rec-header-actions {
  display: flex;
  gap: 8px;
}

.admin-rec-btn {
  padding: 6px 16px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.7);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}

.admin-rec-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.admin-rec-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.admin-rec-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 48px;
  color: rgba(255, 255, 255, 0.5);
  font-size: 14px;
}

.admin-rec-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.admin-rec-health {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-radius: 10px;
  font-size: 14px;
  margin-bottom: 20px;
}

.admin-rec-health.healthy {
  background: rgba(34, 197, 94, 0.1);
  color: #22c55e;
}

.admin-rec-health.warning {
  background: rgba(234, 179, 8, 0.1);
  color: #eab308;
}

.admin-rec-health.critical {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.admin-rec-health-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
}

.admin-rec-health-rate {
  margin-left: auto;
  font-size: 12px;
  opacity: 0.7;
}

.admin-rec-metrics {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
  margin-bottom: 24px;
}

.admin-rec-metric-card {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 16px;
  text-align: center;
  cursor: pointer;
  transition: all 0.15s;
}

.admin-rec-metric-card:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(59, 130, 246, 0.3);
  transform: translateY(-1px);
}

.admin-rec-metric-value {
  font-size: 28px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.9);
}

.text-green { color: #22c55e !important; }
.text-yellow { color: #eab308 !important; }
.text-red { color: #ef4444 !important; }

.admin-rec-metric-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  margin-top: 4px;
}

.admin-rec-section {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
}

.admin-rec-section-title {
  font-size: 16px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.8);
  margin: 0 0 16px;
}

.admin-rec-quick-actions {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.admin-rec-quick-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 16px 12px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
  cursor: pointer;
  transition: all 0.15s;
}

.admin-rec-quick-btn:hover {
  background: rgba(59, 130, 246, 0.08);
  border-color: rgba(59, 130, 246, 0.3);
}

.quick-icon { font-size: 24px; }
.quick-label { font-size: 13px; font-weight: 500; color: rgba(255, 255, 255, 0.8); }
.quick-desc { font-size: 11px; color: rgba(255, 255, 255, 0.4); }

.admin-rec-today-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.admin-rec-today-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.03);
}

.today-num { font-size: 24px; font-weight: 700; color: rgba(255, 255, 255, 0.9); }
.today-label { font-size: 12px; color: rgba(255, 255, 255, 0.4); margin-top: 4px; }

.admin-rec-activities {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.admin-rec-activity {
  display: flex;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.admin-rec-activity-time {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.4);
  min-width: 48px;
}

.admin-rec-activity-text {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
}

.admin-rec-empty {
  text-align: center;
  padding: 24px;
  color: rgba(255, 255, 255, 0.4);
  font-size: 14px;
}

.admin-rec-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 48px;
  color: rgba(255, 255, 255, 0.6);
}

@media (max-width: 768px) {
  .admin-rec-metrics { grid-template-columns: repeat(3, 1fr); }
  .admin-rec-quick-actions { grid-template-columns: repeat(2, 1fr); }
}
</style>
