<template>
  <div class="jobs-workspace">
    <!-- Maintenance Banner -->
    <div style="background:#fff3cd;border:1px solid #ffc107;border-radius:8px;padding:12px 16px;margin-bottom:16px;color:#856404;">
      ⚠️ 职位管理模块正在升级中，部分功能暂不可用。
    </div>
    <!-- Top Navigation Bar -->
    <div class="ceo-top-nav">
      <button @click="goToWorkspaceCenter" class="ceo-nav-btn" title="返回工作台中心">
        ← 工作台中心
      </button>
      <WorkspaceSwitcher />
      <button @click="goToBilling" class="ceo-nav-btn" title="套餐订阅">
        📦 套餐订阅
      </button>
    </div>

    <!-- Page Header -->
    <div class="page-header">
      <div class="header-left">
        <h1 class="page-title">📋 职位管理</h1>
        <p class="page-subtitle">创建和管理招聘职位，一键发布到多个渠道</p>
      </div>
      <div class="header-right">
        <button @click="showCreateModal = true" class="ceo-btn-primary">
          ➕ 创建职位
        </button>
        <button @click="refresh" class="ceo-btn-secondary" :disabled="loading">
          🔄 刷新
        </button>
      </div>
    </div>

    <!-- Stats Summary -->
    <div class="stats-bar">
      <div class="stat-item">
        <span class="stat-num">{{ stats.total }}</span>
        <span class="stat-label">总职位</span>
      </div>
      <div class="stat-item">
        <span class="stat-num">{{ stats.published }}</span>
        <span class="stat-label">招聘中</span>
      </div>
      <div class="stat-item">
        <span class="stat-num">{{ stats.paused }}</span>
        <span class="stat-label">已暂停</span>
      </div>
      <div class="stat-item">
        <span class="stat-num">{{ stats.closed }}</span>
        <span class="stat-label">已关闭</span>
      </div>
      <div class="stat-item">
        <span class="stat-num">{{ stats.draft }}</span>
        <span class="stat-label">草稿</span>
      </div>
    </div>

    <!-- Filter Bar -->
    <div class="filter-bar">
      <select v-model="statusFilter" class="ceo-select" @change="loadJobs">
        <option value="">全部状态</option>
        <option value="published">招聘中</option>
        <option value="paused">已暂停</option>
        <option value="closed">已关闭</option>
        <option value="draft">草稿</option>
      </select>
      <input
        v-model="searchQuery"
        type="text"
        placeholder="搜索职位名称..."
        class="ceo-input"
        @input="debounceSearch"
      />
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      <div class="loading-spinner"></div>
      <span>加载中...</span>
    </div>

    <!-- Empty State -->
    <div v-else-if="filteredJobs.length === 0" class="ceo-empty">
      <h2>暂无职位</h2>
      <p>点击"创建职位"按钮发布您的第一个招聘职位</p>
      <button @click="showCreateModal = true" class="ceo-btn-primary">➕ 创建职位</button>
    </div>

    <!-- Job List -->
    <div v-else class="job-list">
      <div
        v-for="job in filteredJobs"
        :key="job.id"
        class="job-card"
        @click="openDetail(job)"
      >
        <div class="job-main">
          <div class="job-info">
            <div class="job-title">{{ job.title }}</div>
            <div class="job-meta">
              <span v-if="job.salary" class="meta-tag salary">{{ job.salary }}</span>
              <span v-if="job.location" class="meta-tag location">{{ job.location }}</span>
              <span v-for="tag in (job.tags || []).slice(0, 3)" :key="tag" class="meta-tag">{{ tag }}</span>
            </div>
          </div>
          <div class="job-stats">
            <div class="stat">
              <span class="stat-value">{{ job.candidateCount }}</span>
              <span class="stat-label">候选人</span>
            </div>
            <div class="stat">
              <span class="stat-value">{{ job.channelCount }}</span>
              <span class="stat-label">渠道</span>
            </div>
          </div>
          <div class="job-status">
            <span :class="['status-badge', job.status]">{{ statusLabels[job.status] || job.status }}</span>
            <div class="job-time">{{ formatDate(job.createdAt) }}</div>
          </div>
          <div class="job-actions" @click.stop>
            <button @click="openDetail(job)" class="ceo-btn-small">详情</button>
            <div class="action-dropdown">
              <button class="ceo-btn-small dropdown-toggle" @click.stop="toggleDropdown(job.id)">⋯</button>
              <div v-if="dropdownOpen === job.id" class="dropdown-menu">
                <button @click="changeStatus(job, 'published')" v-if="job.status !== 'published'">▶️ 发布</button>
                <button @click="changeStatus(job, 'paused')" v-if="job.status === 'published'">⏸️ 暂停</button>
                <button @click="changeStatus(job, 'closed')" v-if="job.status !== 'closed'">⏹️ 关闭</button>
                <button @click="deleteJob(job)" class="danger">🗑️ 删除</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Job Detail Drawer -->
    <div v-if="showDetail" class="drawer-overlay" @click.self="closeDetail">
      <div class="drawer-panel">
        <div class="drawer-header">
          <h2>{{ detail?.title || '职位详情' }}</h2>
          <button @click="closeDetail" class="close-btn">✕</button>
        </div>

        <div v-if="detailLoading" class="drawer-loading">
          <div class="loading-spinner"></div>
          <span>加载中...</span>
        </div>

        <div v-else-if="detail" class="drawer-content">
          <!-- Status & Quick Stats -->
          <div class="detail-section">
            <div class="section-header">
              <h3>📊 概览</h3>
              <span :class="['status-badge', detail.status]">{{ statusLabels[detail.status] || detail.status }}</span>
            </div>
            <div class="quick-stats">
              <div class="quick-stat">
                <span class="qs-value">{{ detail.candidateCount }}</span>
                <span class="qs-label">候选人</span>
              </div>
              <div class="quick-stat">
                <span class="qs-value">{{ detail.interviewCount }}</span>
                <span class="qs-label">面试</span>
              </div>
              <div class="quick-stat">
                <span class="qs-value">{{ detail.channelCount }}</span>
                <span class="qs-label">渠道</span>
              </div>
              <div class="quick-stat">
                <span class="qs-value">{{ detail.qualityScore }}</span>
                <span class="qs-label">质量分</span>
              </div>
            </div>
          </div>

          <!-- JD -->
          <div class="detail-section">
            <h3>📝 职位描述</h3>
            <div class="jd-content">
              <div v-if="detail.description" class="jd-text">{{ detail.description }}</div>
              <div v-else class="empty-text">暂无职位描述</div>
            </div>
          </div>

          <!-- Requirements -->
          <div class="detail-section">
            <h3>📋 岗位要求</h3>
            <div class="jd-content">
              <div v-if="detail.requirements" class="jd-text">{{ detail.requirements }}</div>
              <div v-else class="empty-text">暂无岗位要求</div>
            </div>
          </div>

          <!-- Skills -->
          <div v-if="detail.skillRequirements?.length" class="detail-section">
            <h3>🎯 技能要求</h3>
            <div class="skill-tags">
              <span v-for="skill in detail.skillRequirements" :key="skill" class="skill-tag">{{ skill }}</span>
            </div>
          </div>

          <!-- Channels -->
          <div class="detail-section">
            <div class="section-header">
              <h3>📡 招聘渠道</h3>
              <button @click="showChannelModal = true" class="ceo-btn-small">+ 添加渠道</button>
            </div>
            <div v-if="!detail.channels?.length" class="empty-text">暂未发布到任何渠道</div>
            <div v-else class="channel-list">
              <div v-for="ch in detail.channels" :key="ch.id" class="channel-item">
                <span class="channel-name">{{ ch.channel?.name || ch.channelId }}</span>
                <span :class="['channel-status', ch.status]">{{ ch.status }}</span>
              </div>
            </div>
          </div>

          <!-- Recent Candidates -->
          <div class="detail-section">
            <h3>👥 最近候选人</h3>
            <div v-if="!detail.recentCandidates?.length" class="empty-text">暂无候选人</div>
            <div v-else class="candidate-list">
              <div v-for="c in detail.recentCandidates" :key="c.id" class="candidate-item">
                <span class="candidate-name">{{ c.candidateName }}</span>
                <span :class="['stage-badge', c.stage]">{{ stageLabels[c.stage] || c.stage }}</span>
                <span v-if="c.screeningScore" class="score">{{ c.screeningScore }}分</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Create Job Modal -->
    <div v-if="showCreateModal" class="modal-overlay" @click.self="showCreateModal = false">
      <div class="modal-panel">
        <div class="modal-header">
          <h2>创建职位</h2>
          <button @click="showCreateModal = false" class="close-btn">✕</button>
        </div>
        <div class="modal-content">
          <!-- Tabs -->
          <div class="modal-tabs">
            <button :class="['modal-tab', { active: createTab === 'manual' }]" @click="createTab = 'manual'">✍️ 手动创建</button>
            <button :class="['modal-tab', { active: createTab === 'ai' }]" @click="createTab = 'ai'">🤖 AI 生成 JD</button>
          </div>

          <!-- Manual Form -->
          <div v-if="createTab === 'manual'" class="form-content">
            <div class="form-group">
              <label>职位名称 <span class="required">*</span></label>
              <input v-model="jobForm.title" placeholder="如：Python开发工程师" class="ceo-input" />
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>薪资范围</label>
                <input v-model="jobForm.salary" placeholder="如：15-22K" class="ceo-input" />
              </div>
              <div class="form-group">
                <label>工作地点</label>
                <input v-model="jobForm.location" placeholder="如：深圳" class="ceo-input" />
              </div>
            </div>
            <div class="form-group">
              <label>职位描述 <span class="required">*</span></label>
              <textarea v-model="jobForm.description" placeholder="请输入职位描述..." class="ceo-textarea" rows="4"></textarea>
            </div>
            <div class="form-group">
              <label>岗位要求</label>
              <textarea v-model="jobForm.requirements" placeholder="请输入岗位要求..." class="ceo-textarea" rows="3"></textarea>
            </div>
            <div class="form-group">
              <label>技能要求（逗号分隔）</label>
              <input v-model="jobForm.skillsInput" placeholder="如：Python, Django, SQL" class="ceo-input" />
            </div>
            <div class="form-group">
              <label>标签（逗号分隔）</label>
              <input v-model="jobForm.tagsInput" placeholder="如：AI, 远程, 高薪" class="ceo-input" />
            </div>
          </div>

          <!-- AI JD -->
          <div v-if="createTab === 'ai'" class="form-content">
            <div class="form-group">
              <label>职位名称 <span class="required">*</span></label>
              <input v-model="jobForm.title" placeholder="如：Python开发工程师" class="ceo-input" />
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>薪资范围</label>
                <input v-model="jobForm.salary" placeholder="如：15-22K" class="ceo-input" />
              </div>
              <div class="form-group">
                <label>工作地点</label>
                <input v-model="jobForm.location" placeholder="如：深圳" class="ceo-input" />
              </div>
            </div>
            <div class="form-group">
              <label>关键词（帮助 AI 生成更好的 JD）</label>
              <input v-model="jobForm.aiKeywords" placeholder="如：后端, 微服务, 高并发" class="ceo-input" />
            </div>
            <div class="ai-generate-btn">
              <button @click="generateAIJD" class="ceo-btn-primary" :disabled="aiGenerating || !jobForm.title">
                {{ aiGenerating ? '生成中...' : '🤖 生成 JD' }}
              </button>
            </div>
            <div v-if="jobForm.description" class="form-group">
              <label>AI 生成的职位描述</label>
              <textarea v-model="jobForm.description" class="ceo-textarea" rows="6"></textarea>
            </div>
            <div v-if="jobForm.requirements" class="form-group">
              <label>AI 生成的岗位要求</label>
              <textarea v-model="jobForm.requirements" class="ceo-textarea" rows="4"></textarea>
            </div>
          </div>

          <!-- Footer -->
          <div class="modal-footer">
            <button @click="showCreateModal = false" class="ceo-btn-secondary">取消</button>
            <button @click="createJob" class="ceo-btn-primary" :disabled="!canCreate">
              {{ jobForm.status === 'published' ? '🚀 立即发布' : '💾 保存草稿' }}
            </button>
            <select v-model="jobForm.status" class="ceo-select status-select">
              <option value="draft">草稿</option>
              <option value="published">直接发布</option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <!-- Channel Select Modal -->
    <div v-if="showChannelModal" class="modal-overlay" @click.self="showChannelModal = false">
      <div class="modal-panel" style="max-width: 500px;">
        <div class="modal-header">
          <h2>选择招聘渠道</h2>
          <button @click="showChannelModal = false" class="close-btn">✕</button>
        </div>
        <div class="modal-content">
          <div v-if="channels.length === 0" class="empty-text">暂无可用渠道</div>
          <div v-else class="channel-select-list">
            <label v-for="ch in channels" :key="ch.id" class="channel-select-item">
              <input type="checkbox" :value="ch.id" v-model="selectedChannels" />
              <span class="channel-info">
                <span class="channel-name">{{ ch.name }}</span>
                <span class="channel-desc">{{ ch.description }}</span>
              </span>
            </label>
          </div>
          <div class="modal-footer">
            <button @click="showChannelModal = false" class="ceo-btn-secondary">取消</button>
            <button @click="publishToChannels" class="ceo-btn-primary" :disabled="selectedChannels.length === 0">
              发布到 {{ selectedChannels.length }} 个渠道
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useEnterpriseContext } from '~/composables/useEnterpriseContext'
import { useIdentityStore } from '~/stores/identity'
import WorkspaceSwitcher from '~/components/WorkspaceSwitcher.vue'

const ctx = useEnterpriseContext()
const identityStore = useIdentityStore()

// ─── State ───
const loading = ref(false)
const jobs = ref<any[]>([])
const statusFilter = ref('')
const searchQuery = ref('')
const stats = ref({ total: 0, published: 0, paused: 0, closed: 0, draft: 0 })
const dropdownOpen = ref<string | null>(null)

// Detail drawer
const showDetail = ref(false)
const detail = ref<any>(null)
const detailLoading = ref(false)

// Create modal
const showCreateModal = ref(false)
const createTab = ref('manual')
const aiGenerating = ref(false)
const jobForm = ref({
  title: '',
  description: '',
  requirements: '',
  salary: '',
  location: '',
  skillsInput: '',
  tagsInput: '',
  aiKeywords: '',
  status: 'draft',
})

// Channel modal
const showChannelModal = ref(false)
const channels = ref<any[]>([])
const selectedChannels = ref<string[]>([])

// ─── Labels ───
const statusLabels: Record<string, string> = {
  draft: '草稿',
  published: '招聘中',
  paused: '已暂停',
  closed: '已关闭',
}

const stageLabels: Record<string, string> = {
  screening: '筛选',
  interview: '面试',
  offer: 'Offer',
  hired: '入职',
  rejected: '拒绝',
}

// ─── Computed ───
const filteredJobs = computed(() => {
  let result = jobs.value
  if (statusFilter.value) {
    result = result.filter(j => j.status === statusFilter.value)
  }
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(j => j.title?.toLowerCase().includes(q))
  }
  return result
})

const canCreate = computed(() => {
  return jobForm.value.title.trim() && jobForm.value.description.trim()
})

// ─── Methods ───
function getWorkspaceId(): string {
  return identityStore.workspaceId || ctx.getWorkspaceId()
}

function formatDate(date: string | Date): string {
  if (!date) return '-'
  return new Date(date).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

async function loadJobs() {
  loading.value = true
  const wsId = getWorkspaceId()
  try {
    const params = new URLSearchParams()
    if (wsId) params.set('workspaceId', wsId)
    if (statusFilter.value) params.set('status', statusFilter.value)
    if (searchQuery.value) params.set('keyword', searchQuery.value)

    const res = await fetch(`/api/enterprise/postings?${params}`)
    const data = await res.json()
    jobs.value = data.data || []

    // Calculate stats
    stats.value = {
      total: jobs.value.length,
      published: jobs.value.filter((j: any) => j.status === 'published').length,
      paused: jobs.value.filter((j: any) => j.status === 'paused').length,
      closed: jobs.value.filter((j: any) => j.status === 'closed').length,
      draft: jobs.value.filter((j: any) => j.status === 'draft').length,
    }
  } catch (e) {
    console.error('加载职位列表失败', e)
  } finally {
    loading.value = false
  }
}

let searchTimer: any = null
function debounceSearch() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => loadJobs(), 300)
}

function refresh() {
  loadJobs()
}

function toggleDropdown(jobId: string) {
  dropdownOpen.value = dropdownOpen.value === jobId ? null : jobId
}

async function changeStatus(job: any, status: string) {
  try {
    const res = await fetch(`/api/enterprise/postings/${job.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    const data = await res.json()
    if (data.success) {
      loadJobs()
      dropdownOpen.value = null
    }
  } catch (e) {
    console.error('更新状态失败', e)
  }
}

async function deleteJob(job: any) {
  if (!confirm(`确定删除职位"${job.title}"？此操作不可恢复。`)) return
  try {
    const res = await fetch(`/api/enterprise/postings/${job.id}`, { method: 'DELETE' })
    const data = await res.json()
    if (data.success) {
      loadJobs()
      dropdownOpen.value = null
    }
  } catch (e) {
    console.error('删除失败', e)
  }
}

async function openDetail(job: any) {
  showDetail.value = true
  detailLoading.value = true
  detail.value = null

  try {
    const res = await fetch(`/api/enterprise/postings/${job.id}`)
    const data = await res.json()
    if (data.success) {
      detail.value = data.data
    }
  } catch (e) {
    console.error('加载职位详情失败', e)
  } finally {
    detailLoading.value = false
  }
}

function closeDetail() {
  showDetail.value = false
  detail.value = null
  showChannelModal.value = false
  selectedChannels.value = []
}

async function generateAIJD() {
  if (!jobForm.value.title) return
  aiGenerating.value = true
  try {
    const res = await fetch('/api/enterprise/jd/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: jobForm.value.title,
        salary: jobForm.value.salary,
        location: jobForm.value.location,
        keywords: jobForm.value.aiKeywords,
      }),
    })
    const data = await res.json()
    if (data.success || data.description) {
      jobForm.value.description = data.description || data.jd || ''
      jobForm.value.requirements = data.requirements || ''
      if (data.skills) {
        jobForm.value.skillsInput = Array.isArray(data.skills) ? data.skills.join(', ') : data.skills
      }
    }
  } catch (e) {
    console.error('AI 生成失败', e)
    // Fallback: generate a basic JD
    jobForm.value.description = `${jobForm.value.title}\n\n职位描述：\n我们正在寻找一位优秀的${jobForm.value.title}加入我们的团队。\n\n岗位职责：\n1. 负责相关技术开发工作\n2. 参与产品需求分析和技术方案设计\n3. 代码审查和技术文档编写`
    jobForm.value.requirements = '岗位要求：\n1. 相关专业本科及以上学历\n2. 具备扎实的专业基础\n3. 良好的沟通能力和团队协作精神'
  } finally {
    aiGenerating.value = false
  }
}

async function createJob() {
  if (!canCreate.value) return
  const wsId = getWorkspaceId()
  try {
    const body: any = {
      workspaceId: wsId,
      title: jobForm.value.title.trim(),
      description: jobForm.value.description.trim(),
      requirements: jobForm.value.requirements?.trim() || undefined,
      salary: jobForm.value.salary?.trim() || undefined,
      location: jobForm.value.location?.trim() || undefined,
      status: jobForm.value.status,
    }

    if (jobForm.value.skillsInput) {
      body.skillRequirements = jobForm.value.skillsInput.split(/[,，、]/).map(s => s.trim()).filter(Boolean)
    }
    if (jobForm.value.tagsInput) {
      body.tags = jobForm.value.tagsInput.split(/[,，、]/).map(s => s.trim()).filter(Boolean)
    }

    const res = await fetch('/api/enterprise/postings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (data.success || data.id) {
      showCreateModal.value = false
      resetForm()
      loadJobs()
    } else {
      alert(data.error || '创建失败')
    }
  } catch (e) {
    console.error('创建职位失败', e)
  }
}

function resetForm() {
  jobForm.value = {
    title: '',
    description: '',
    requirements: '',
    salary: '',
    location: '',
    skillsInput: '',
    tagsInput: '',
    aiKeywords: '',
    status: 'draft',
  }
}

async function loadChannels() {
  try {
    const res = await fetch('/api/enterprise/channels')
    const data = await res.json()
    if (data.success) {
      channels.value = data.data
    }
  } catch (e) {
    console.error('加载渠道失败', e)
  }
}

async function publishToChannels() {
  if (!detail.value || selectedChannels.value.length === 0) return
  try {
    const res = await fetch(`/api/enterprise/postings/${detail.value.id}/channels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelIds: selectedChannels.value }),
    })
    const data = await res.json()
    if (data.success) {
      showChannelModal.value = false
      openDetail(detail.value) // Reload
    }
  } catch (e) {
    console.error('发布到渠道失败', e)
  }
}

// ─── Navigation ───
function goToWorkspaceCenter() {
  window.location.href = '/workspace/enterprise/onboarding'
}

function goToBilling() {
  window.location.href = '/workspace/enterprise/billing'
}

// ─── Lifecycle ───
onMounted(async () => {
  // Sprint-08: Fetch identity context from backend
  await identityStore.fetchContext()

  if (!getWorkspaceId()) {
    window.location.href = '/workspace/enterprise/onboarding'
    return
  }
  loadJobs()
  loadChannels()

  // Sprint-08: Listen for workspace switch events
  window.addEventListener('workspace-switched', () => {
    loadJobs()
    loadChannels()
  })
})
</script>

<style scoped>
.jobs-workspace {
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;
}

.ceo-top-nav {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
}

.ceo-nav-btn {
  padding: 8px 16px;
  border: 1px solid #1A2240;
  background: #0A0F1E;
  color: #9ca3af;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.15s;
}

.ceo-nav-btn:hover {
  border-color: #2563eb;
  color: #60a5fa;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
}

.page-title {
  font-size: 22px;
  font-weight: 600;
  margin: 0;
}

.page-subtitle {
  color: #6b7280;
  font-size: 13px;
  margin-top: 4px;
}

.header-right {
  display: flex;
  gap: 12px;
}

.stats-bar {
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
}

.stat-item {
  flex: 1;
  background: #0A0F1E;
  border: 1px solid #1A2240;
  border-radius: 12px;
  padding: 16px;
  text-align: center;
}

.stat-num {
  display: block;
  font-size: 28px;
  font-weight: 700;
  color: #60a5fa;
}

.stat-label {
  font-size: 12px;
  color: #6b7280;
  margin-top: 4px;
}

.filter-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}

.ceo-select,
.ceo-input {
  padding: 8px 12px;
  border: 1px solid #1A2240;
  background: #0A0F1E;
  color: white;
  border-radius: 8px;
  font-size: 13px;
}

.ceo-input {
  flex: 1;
}

.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 60px;
  color: #6b7280;
}

.loading-spinner {
  width: 24px;
  height: 24px;
  border: 3px solid #1A2240;
  border-top-color: #60a5fa;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.ceo-empty {
  text-align: center;
  padding: 60px;
  color: #6b7280;
}

.ceo-empty h2 {
  font-size: 18px;
  margin-bottom: 8px;
}

.ceo-empty p {
  margin-bottom: 16px;
}

.ceo-btn-primary {
  padding: 8px 16px;
  border: none;
  background: #2563eb;
  color: white;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
}

.ceo-btn-primary:hover {
  background: #1d4ed8;
}

.ceo-btn-primary:disabled {
  background: #374151;
  color: #6b7280;
  cursor: not-allowed;
}

.ceo-btn-secondary {
  padding: 8px 16px;
  border: 1px solid #1A2240;
  background: transparent;
  color: #9ca3af;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
}

.ceo-btn-secondary:hover {
  border-color: #2563eb;
  color: #60a5fa;
}

.job-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.job-card {
  background: #0A0F1E;
  border: 1px solid #1A2240;
  border-radius: 12px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.15s;
}

.job-card:hover {
  border-color: #2563eb;
  box-shadow: 0 0 0 1px rgba(37, 99, 235, 0.2);
}

.job-main {
  display: flex;
  align-items: center;
  gap: 16px;
}

.job-info {
  flex: 1;
}

.job-title {
  font-size: 15px;
  font-weight: 500;
  margin-bottom: 6px;
}

.job-meta {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.meta-tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  background: #1A2240;
  color: #9ca3af;
}

.meta-tag.salary {
  background: #064e3b;
  color: #34d399;
}

.meta-tag.location {
  background: #1e3a5f;
  color: #60a5fa;
}

.job-stats {
  display: flex;
  gap: 16px;
}

.job-stats .stat {
  text-align: center;
}

.job-stats .stat-value {
  display: block;
  font-size: 18px;
  font-weight: 600;
  color: #60a5fa;
}

.job-stats .stat-label {
  font-size: 10px;
  color: #6b7280;
}

.job-status {
  text-align: center;
  min-width: 80px;
}

.status-badge {
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 500;
}

.status-badge.draft { background: #374151; color: #9ca3af; }
.status-badge.published { background: #d1fae5; color: #065f46; }
.status-badge.paused { background: #fef3c7; color: #92400e; }
.status-badge.closed { background: #fee2e2; color: #991b1b; }

.job-time {
  font-size: 11px;
  color: #6b7280;
  margin-top: 4px;
}

.job-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  position: relative;
}

.ceo-btn-small {
  padding: 6px 12px;
  border: 1px solid #1A2240;
  background: transparent;
  color: #9ca3af;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
}

.ceo-btn-small:hover {
  border-color: #2563eb;
  color: #60a5fa;
}

.dropdown-toggle {
  padding: 6px 10px;
}

.dropdown-menu {
  position: absolute;
  right: 0;
  top: 100%;
  background: #0A0F1E;
  border: 1px solid #1A2240;
  border-radius: 8px;
  z-index: 10;
  min-width: 120px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.dropdown-menu button {
  display: block;
  width: 100%;
  padding: 8px 12px;
  border: none;
  background: transparent;
  color: #9ca3af;
  text-align: left;
  cursor: pointer;
  font-size: 12px;
}

.dropdown-menu button:hover {
  background: #1A2240;
  color: white;
}

.dropdown-menu button.danger {
  color: #ef4444;
}

.dropdown-menu button.danger:hover {
  background: rgba(239, 68, 68, 0.1);
}

/* Drawer */
.drawer-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 100;
  display: flex;
  justify-content: flex-end;
}

.drawer-panel {
  width: 600px;
  max-width: 90vw;
  height: 100vh;
  background: #060A18;
  border-left: 1px solid #1A2240;
  overflow-y: auto;
  animation: slideIn 0.2s ease;
}

@keyframes slideIn {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}

.drawer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #1A2240;
  position: sticky;
  top: 0;
  background: #060A18;
  z-index: 1;
}

.drawer-header h2 {
  margin: 0;
  font-size: 18px;
}

.close-btn {
  width: 32px;
  height: 32px;
  border: 1px solid #1A2240;
  background: transparent;
  color: #9ca3af;
  border-radius: 8px;
  cursor: pointer;
  font-size: 16px;
}

.drawer-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 60px;
  color: #6b7280;
}

.drawer-content {
  padding: 20px;
}

.detail-section {
  margin-bottom: 24px;
  padding-bottom: 24px;
  border-bottom: 1px solid #1A2240;
}

.detail-section:last-child {
  border-bottom: none;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.detail-section h3 {
  font-size: 15px;
  margin: 0;
}

.quick-stats {
  display: flex;
  gap: 16px;
}

.quick-stat {
  flex: 1;
  text-align: center;
  background: #0A0F1E;
  border: 1px solid #1A2240;
  border-radius: 8px;
  padding: 12px;
}

.qs-value {
  display: block;
  font-size: 24px;
  font-weight: 700;
  color: #60a5fa;
}

.qs-label {
  font-size: 11px;
  color: #6b7280;
}

.jd-content {
  background: #0A0F1E;
  border: 1px solid #1A2240;
  border-radius: 8px;
  padding: 16px;
}

.jd-text {
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
}

.skill-tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.skill-tag {
  padding: 4px 12px;
  background: #1e3a5f;
  color: #60a5fa;
  border-radius: 12px;
  font-size: 12px;
}

.channel-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.channel-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #0A0F1E;
  border: 1px solid #1A2240;
  border-radius: 8px;
}

.channel-name {
  font-size: 13px;
}

.channel-status {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  background: #d1fae5;
  color: #065f46;
}

.channel-status.paused {
  background: #fef3c7;
  color: #92400e;
}

.channel-status.offline {
  background: #fee2e2;
  color: #991b1b;
}

.candidate-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.candidate-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: #0A0F1E;
  border: 1px solid #1A2240;
  border-radius: 8px;
}

.candidate-name {
  flex: 1;
  font-size: 13px;
}

.stage-badge {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 10px;
  background: #1e3a5f;
  color: #60a5fa;
}

.score {
  font-size: 12px;
  color: #fbbf24;
}

.empty-text {
  font-size: 13px;
  color: #6b7280;
  text-align: center;
  padding: 20px;
}

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-panel {
  width: 600px;
  max-width: 90vw;
  max-height: 80vh;
  background: #060A18;
  border: 1px solid #1A2240;
  border-radius: 12px;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #1A2240;
  position: sticky;
  top: 0;
  background: #060A18;
  z-index: 1;
}

.modal-header h2 {
  margin: 0;
  font-size: 18px;
}

.modal-content {
  padding: 20px;
}

.modal-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
}

.modal-tab {
  flex: 1;
  padding: 10px;
  border: 1px solid #1A2240;
  background: transparent;
  color: #9ca3af;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
}

.modal-tab.active {
  border-color: #2563eb;
  color: #60a5fa;
  background: rgba(37, 99, 235, 0.1);
}

.form-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-size: 12px;
  color: #9ca3af;
}

.required {
  color: #ef4444;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.ceo-textarea {
  width: 100%;
  padding: 10px;
  border: 1px solid #1A2240;
  background: #060A18;
  color: white;
  border-radius: 8px;
  font-size: 13px;
  resize: vertical;
  font-family: inherit;
}

.ai-generate-btn {
  text-align: center;
  padding: 8px 0;
}

.modal-footer {
  display: flex;
  gap: 12px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid #1A2240;
  align-items: center;
}

.modal-footer .ceo-btn-secondary {
  margin-left: auto;
}

.status-select {
  width: auto;
}

/* Channel Select */
.channel-select-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.channel-select-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #0A0F1E;
  border: 1px solid #1A2240;
  border-radius: 8px;
  cursor: pointer;
}

.channel-select-item:hover {
  border-color: #2563eb;
}

.channel-select-item input[type="checkbox"] {
  width: 18px;
  height: 18px;
}

.channel-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.channel-info .channel-name {
  font-size: 14px;
  font-weight: 500;
}

.channel-desc {
  font-size: 11px;
  color: #6b7280;
}
</style>
