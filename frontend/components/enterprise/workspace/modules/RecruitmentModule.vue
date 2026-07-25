<!--
  ⚠️ DEPRECATE — JOB-WORKSPACE-BOUNDARY-AUDIT 2026-07-26
  旧企业工作台内嵌招聘模块，与新版 /workspace/recruitment 功能重复。
  保留原因：企业工作台首页仍引用，P4-FE-02 后删除。
  禁止：修改功能、添加新逻辑。
-->
<template>
  <div class="recruitment-module">
    <!-- Module Header -->
    <div class="rec-module-header">
      <h2 class="rec-module-title">🎯 AI 招聘中心</h2>
      <button @click="goToCreateJob" class="rec-btn-primary">
        ➕ 创建岗位
      </button>
    </div>

    <!-- Stats Summary -->
    <div class="rec-stats">
      <div class="rec-stat-card">
        <span class="rec-stat-num">{{ stats.totalJobs }}</span>
        <span class="rec-stat-label">岗位数</span>
      </div>
      <div class="rec-stat-card">
        <span class="rec-stat-num">{{ stats.matchingTasks }}</span>
        <span class="rec-stat-label">匹配任务</span>
      </div>
      <div class="rec-stat-card">
        <span class="rec-stat-num">{{ stats.totalCandidates }}</span>
        <span class="rec-stat-label">候选人才</span>
      </div>
      <div class="rec-stat-card">
        <span class="rec-stat-num">{{ stats.pendingReview }}</span>
        <span class="rec-stat-label">待处理推荐</span>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="rec-loading">
      <div class="rec-spinner"></div>
      <span>加载中...</span>
    </div>

    <!-- Empty State -->
    <div v-else-if="jobs.length === 0" class="rec-empty">
      <div class="rec-empty-icon">🤖</div>
      <h3>开始使用 AI 招聘</h3>
      <p>创建首个岗位，AI 将自动为您匹配最佳候选人</p>
      <button @click="goToCreateJob" class="rec-btn-primary">
        ➕ 创建首个岗位
      </button>
    </div>

    <!-- Job List -->
    <div v-else class="rec-job-list">
      <h3 class="rec-section-title">岗位列表</h3>
      <div
        v-for="job in jobs"
        :key="job.id"
        class="rec-job-card"
        @click="goToJobDetail(job.id)"
      >
        <div class="rec-job-card-header">
          <span class="rec-job-title">📋 {{ job.title }}</span>
          <span class="rec-job-status" :class="getStatusClass(job.status)">
            {{ getStatusLabel(job.status) }}
          </span>
        </div>
        <div class="rec-job-card-body">
          <div class="rec-job-meta">
            <span v-if="job.location">📍 {{ job.location }}</span>
            <span v-if="job.experienceMin">💼 {{ job.experienceMin }}年+</span>
            <span v-if="job.requiredSkills?.length">🛠 {{ job.requiredSkills.slice(0, 3).join(', ') }}</span>
          </div>
          <div v-if="jobMatchCounts[job.id] > 0" class="rec-job-match">
            <span class="rec-match-badge">🎯 {{ jobMatchCounts[job.id] }} 位匹配</span>
          </div>
        </div>
        <div class="rec-job-card-footer">
          <span class="rec-job-date">创建于 {{ formatDate(job.createdAt) }}</span>
          <span class="rec-job-arrow">→</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { listRequirements, listBatchJobs } from '~/studio-v2/api/recruitment-api'

// ─── Navigation ───
function goToCreateJob() {
  window.location.href = '/workspace/recruitment/jobs/create'
}

function goToJobDetail(id: string) {
  window.location.href = `/workspace/recruitment/jobs/${id}`
}

// ─── State ───
const loading = ref(true)
const jobs = ref<any[]>([])
const batchJobs = ref<any[]>([])

// ─── Stats ───
const stats = computed(() => {
  const totalJobs = jobs.value.length
  const matchingTasks = batchJobs.value.filter(b => b.status === 'RUNNING').length
  const totalCandidates = batchJobs.value
    .filter(b => b.status === 'COMPLETED')
    .reduce((sum, b) => sum + (b.matchedCount || 0), 0)
  // Reality Debt 修复：pendingReview 不再使用 Math.min 伪造数据
  const pendingReview = totalCandidates
  return { totalJobs, matchingTasks, totalCandidates, pendingReview }
})

// Reality Debt 修复：matchCount 断链修复
// 后端 JobRequirementDTO 不含 matchCount 字段
// 真实来源：batchJobs 中该 job 的 matchedCount 聚合
const jobMatchCounts = computed(() => {
  const counts: Record<string, number> = {}
  for (const b of batchJobs.value) {
    if (b.status === 'COMPLETED' && b.jobRequirementId) {
      counts[b.jobRequirementId] = (counts[b.jobRequirementId] || 0) + (b.matchedCount || 0)
    }
  }
  return counts
})

// ─── Helpers ───
function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    draft: '草稿', active: '招聘中', paused: '已暂停', closed: '已关闭',
  }
  return map[status] || status
}

function getStatusClass(status: string): string {
  return `rec-status-${status}`
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
  } catch {
    return dateStr
  }
}

// ─── Data Loading ───
async function refresh() {
  loading.value = true
  try {
    const [jobsData, batchesData] = await Promise.all([
      listRequirements().catch(() => []),
      listBatchJobs().catch(() => []),
    ])
    jobs.value = jobsData
    batchJobs.value = batchesData
  } catch {
    // silent
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  refresh()
})
</script>

<style scoped>
.recruitment-module {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  padding: 0;
}

/* ─── Header ─── */
.rec-module-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.rec-module-title {
  font-size: var(--font-size-lg);
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0;
}

/* ─── Stats ─── */
.rec-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-md);
}

.rec-stat-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--space-lg) var(--space-sm);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-lg);
}

.rec-stat-num {
  font-size: 1.8rem;
  font-weight: 700;
  color: #60a5fa;
}

.rec-stat-label {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  margin-top: var(--space-xs);
}

/* ─── Button ─── */
.rec-btn-primary {
  padding: var(--space-sm) var(--space-lg);
  font-size: var(--font-size-sm);
  font-weight: 600;
  background: linear-gradient(135deg, #60a5fa, #3b82f6);
  border: none;
  border-radius: var(--radius-md);
  color: #fff;
  cursor: pointer;
  transition: box-shadow 0.15s;
}

.rec-btn-primary:hover {
  box-shadow: 0 4px 16px rgba(96, 165, 250, 0.3);
}

/* ─── Loading ─── */
.rec-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-xl);
  color: var(--color-text-muted);
}

.rec-spinner {
  width: 28px;
  height: 28px;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top-color: #60a5fa;
  border-radius: 50%;
  animation: rec-spin 0.8s linear infinite;
}

@keyframes rec-spin {
  to { transform: rotate(360deg); }
}

/* ─── Empty ─── */
.rec-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--space-xl);
  text-align: center;
}

.rec-empty-icon {
  font-size: 2.5rem;
  margin-bottom: var(--space-md);
}

.rec-empty h3 {
  margin: 0 0 var(--space-sm);
  font-size: var(--font-size-md);
  color: var(--color-text-primary);
}

.rec-empty p {
  margin: 0 0 var(--space-lg);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

/* ─── Job List ─── */
.rec-job-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.rec-section-title {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text-secondary);
  margin: 0;
}

.rec-job-card {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.rec-job-card:hover {
  border-color: rgba(96, 165, 250, 0.3);
  box-shadow: 0 4px 20px rgba(96, 165, 250, 0.08);
}

.rec-job-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-sm);
}

.rec-job-title {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text-primary);
}

.rec-job-status {
  font-size: var(--font-size-xs);
  padding: 2px 8px;
  border-radius: 8px;
  font-weight: 500;
}

.rec-status-draft {
  background: rgba(156, 163, 175, 0.15);
  color: #9ca3af;
}

.rec-status-active {
  background: rgba(74, 222, 128, 0.15);
  color: #4ade80;
}

.rec-status-paused {
  background: rgba(245, 158, 11, 0.15);
  color: #f59e0b;
}

.rec-status-closed {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
}

.rec-job-card-body {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.rec-job-meta {
  display: flex;
  gap: var(--space-md);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.rec-match-badge {
  font-size: var(--font-size-xs);
  color: #4ade80;
  background: rgba(74, 222, 128, 0.1);
  padding: 2px 8px;
  border-radius: 8px;
}

.rec-job-card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: var(--space-sm);
  padding-top: var(--space-sm);
  border-top: 1px solid var(--color-border-primary);
}

.rec-job-date {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.rec-job-arrow {
  color: var(--color-text-muted);
}

@media (max-width: 768px) {
  .rec-stats {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
