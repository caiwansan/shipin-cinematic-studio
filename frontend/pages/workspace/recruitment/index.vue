<template>
  <div class="recruitment-home">
    <!-- Top Navigation Bar -->
    <div class="recruitment-top-nav">
      <button @click="goToHome" class="recruitment-nav-btn" title="返回昆仑镜首页">
        ← 返回首页
      </button>
      <WorkspaceSwitcher />
      <button @click="goToCreateJob" class="recruitment-nav-btn recruitment-nav-primary">
        ➕ 创建岗位
      </button>
    </div>

    <!-- Page Header -->
    <div class="recruitment-header">
      <div class="header-left">
        <h1 class="recruitment-title">🤖 AI 招聘中心</h1>
        <p class="recruitment-subtitle">智能匹配，一键找到最佳候选人</p>
      </div>
      <div class="header-right">
        <button @click="refresh" class="recruitment-btn-secondary" :disabled="loading">
          🔄 刷新
        </button>
      </div>
    </div>

    <!-- Stats Summary -->
    <div class="recruitment-stats">
      <div class="stat-card">
        <span class="stat-num">{{ stats.totalJobs }}</span>
        <span class="stat-label">岗位数</span>
      </div>
      <div class="stat-card">
        <span class="stat-num">{{ stats.matchingTasks }}</span>
        <span class="stat-label">匹配任务</span>
      </div>
      <div class="stat-card">
        <span class="stat-num">{{ stats.totalCandidates }}</span>
        <span class="stat-label">候选人才</span>
      </div>
      <div class="stat-card">
        <span class="stat-num">{{ stats.pendingReview }}</span>
        <span class="stat-label">待处理推荐</span>
      </div>
    </div>

    <!-- Identity Loading -->
    <div v-if="identityLoading" class="recruitment-loading">
      <div class="loading-spinner"></div>
      <span>身份验证中...</span>
    </div>

    <!-- Identity Gate: 无企业身份用户 -->
    <div v-else-if="!identity?.hasEnterprise" class="recruitment-gate">
      <div class="gate-card">
        <div class="gate-icon">🏢</div>
        <h2>企业身份认证</h2>
        <p>您需要完成企业身份认证才能使用 AI 招聘中心</p>
        <div class="gate-features">
          <div class="gate-feature">🤖 AI 智能匹配候选人</div>
          <div class="gate-feature">📄 简历自动分析</div>
          <div class="gate-feature">🎤 AI 面试官</div>
          <div class="gate-feature">📊 招聘数据看板</div>
        </div>
        <button @click="goToOnboarding" class="gate-btn-primary">
          立即认证企业身份
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="recruitment-loading">
      <div class="loading-spinner"></div>
      <span>加载中...</span>
    </div>

    <!-- Empty State -->
    <div v-else-if="jobs.length === 0" class="recruitment-empty">
      <div class="empty-icon">🤖</div>
      <h2>开始使用 AI 招聘</h2>
      <p>创建首个岗位，AI 将自动为您匹配最佳候选人</p>
      <button @click="goToCreateJob" class="recruitment-btn-primary">
        ➕ 创建首个岗位
      </button>
    </div>

    <!-- Job List -->
    <div v-else class="recruitment-job-list">
      <h2 class="section-title">岗位列表</h2>
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
            <span v-if="job.requiredSkills?.length">🛠 {{ job.requiredSkills.slice(0, 3).join(', ') }}</span>
          </div>
          <div class="job-match-info" v-if="job.matchCount > 0">
            <span class="match-badge">🎯 {{ job.matchCount }} 位匹配</span>
          </div>
        </div>
        <div class="job-card-footer">
          <span class="job-date">创建于 {{ formatDate(job.createdAt) }}</span>
          <span class="job-arrow">→</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { listRequirements, listBatchJobs } from '~/studio-v2/api/recruitment-api'
import { getEnterpriseIdentity, type EnterpriseIdentityStatus } from '~/studio-v2/api/job/enterprise-identity-api'

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
  window.location.href = '/workspace/recruitment/onboarding'
}

// ─── Identity Gate ───
const identityLoading = ref(true)
const identity = ref<EnterpriseIdentityStatus | null>(null)

// ─── State ───
const loading = ref(true)
const jobs = ref<any[]>([])
const batchJobs = ref<any[]>([])
const error = ref('')

// ─── Stats ───
const stats = computed(() => {
  const totalJobs = jobs.value.length
  const matchingTasks = batchJobs.value.filter(b => b.status === 'RUNNING').length
  const totalCandidates = batchJobs.value
    .filter(b => b.status === 'COMPLETED')
    .reduce((sum, b) => sum + (b.matchedCount || 0), 0)
  const pendingReview = totalCandidates > 0 ? Math.min(totalCandidates, 5) : 0

  return { totalJobs, matchingTasks, totalCandidates, pendingReview }
})

// ─── Helpers ───
function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    draft: '草稿',
    active: '招聘中',
    paused: '已暂停',
    closed: '已关闭',
  }
  return map[status] || status
}

function getStatusClass(status: string): string {
  return `status-${status}`
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
    const [jobsData, batchesData] = await Promise.all([
      listRequirements().catch(() => []),
      listBatchJobs().catch(() => []),
    ])
    jobs.value = jobsData
    batchJobs.value = batchesData
  } catch (e: any) {
    error.value = e.message || '加载失败'
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

/* ─── Top Nav ─── */
.recruitment-top-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px;
  background: #0d1220;
  border-bottom: 1px solid #1a2240;
}

.recruitment-nav-btn {
  padding: 8px 16px;
  font-size: 0.85rem;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  transition: all 0.15s;
}

.recruitment-nav-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.recruitment-nav-primary {
  background: linear-gradient(135deg, #60a5fa, #3b82f6);
  border-color: #3b82f6;
  color: #fff;
  font-weight: 600;
}

.recruitment-nav-primary:hover {
  box-shadow: 0 4px 16px rgba(96, 165, 250, 0.3);
}

/* ─── Header ─── */
.recruitment-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 32px 24px 24px;
}

.recruitment-title {
  margin: 0;
  font-size: 1.6rem;
  font-weight: 700;
  color: #fff;
}

.recruitment-subtitle {
  margin: 4px 0 0;
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.5);
}

.header-right {
  display: flex;
  gap: 8px;
}

.recruitment-btn-secondary {
  padding: 8px 16px;
  font-size: 0.85rem;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  transition: all 0.15s;
}

.recruitment-btn-secondary:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.recruitment-btn-primary {
  padding: 10px 20px;
  font-size: 0.9rem;
  font-weight: 600;
  background: linear-gradient(135deg, #60a5fa, #3b82f6);
  border: none;
  border-radius: 8px;
  color: #fff;
  cursor: pointer;
  transition: box-shadow 0.15s;
}

.recruitment-btn-primary:hover {
  box-shadow: 0 4px 16px rgba(96, 165, 250, 0.3);
}

/* ─── Stats ─── */
.recruitment-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  padding: 0 24px 24px;
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

/* ─── Empty State ─── */
.recruitment-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80px 24px;
  text-align: center;
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: 16px;
}

.recruitment-empty h2 {
  margin: 0 0 8px;
  font-size: 1.3rem;
  color: #fff;
}

.recruitment-empty p {
  margin: 0 0 24px;
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.5);
}

/* ─── Job List ─── */
.recruitment-job-list {
  padding: 0 24px 40px;
}

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

.status-active {
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
</style>
