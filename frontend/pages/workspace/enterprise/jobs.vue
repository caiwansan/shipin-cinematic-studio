<template>
  <div class="jobs-workspace">
    <RecruitmentPageShell>
      <template #title>职位管理</template>
      <template #subtitle>岗位生命周期中心 — 从草稿到发布、面试到录用，掌握每个岗位的全流程状态。AI 招聘顾问 Alice 为您提供招聘建议</template>
      <template #actions>
        <RecruitmentPrimaryButton @click="showCreateModal = true">
          创建岗位
        </RecruitmentPrimaryButton>
        <RecruitmentSecondaryButton :disabled="loading" @click="refresh">
          刷新
        </RecruitmentSecondaryButton>
      </template>
      <template #stats>
        <RecruitmentStatCard :value="stats.published" label="正在招聘" color="--color-execution" />
        <RecruitmentStatCard :value="stats.draft" label="待发布" color="--color-warning" />
        <RecruitmentStatCard :value="stats.totalCandidates" label="收到简历" color="--color-decision" />
        <RecruitmentStatCard :value="stats.inInterview" label="面试中" color="--color-info" />
      </template>
      <template #filters>
        <RecruitmentSelect v-model="statusFilter" @change="onFilterChange">
          <option value="">全部状态</option>
          <option value="published">招聘中</option>
          <option value="paused">已暂停</option>
          <option value="closed">已关闭</option>
          <option value="draft">草稿</option>
        </RecruitmentSelect>
        <RecruitmentInput
          v-model="searchQuery"
          placeholder="搜索职位名称..."
          @input="debounceSearch"
        />
      </template>

      <!-- Loading State -->
      <div v-if="loading" class="ps-loading-state">
        <div class="ps-loading-spinner"></div>
        <span>加载中...</span>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="ps-error-state">
        <div class="ps-error-icon">!</div>
        <h3>加载失败</h3>
        <p>{{ error }}</p>
        <RecruitmentPrimaryButton @click="refresh">重新加载</RecruitmentPrimaryButton>
      </div>

      <!-- Empty State -->
      <div v-else-if="filteredJobs.length === 0" class="ps-empty-state">
        <div class="ps-empty-icon">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <rect x="6" y="10" width="36" height="28" rx="3" stroke="currentColor" stroke-width="2" fill="none"/>
            <path d="M16 20h16M16 26h12M16 32h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </div>
        <h3>开始招聘你的第一个岗位</h3>
        <p class="ps-empty-desc">
          AI 招聘顾问 Alice 可以帮你：分析招聘需求 | 生成 JD | 推荐招聘渠道
        </p>
        <RecruitmentPrimaryButton @click="showCreateModal = true">创建岗位</RecruitmentPrimaryButton>
      </div>

      <!-- Lifecycle Stage Pipeline -->
      <div v-if="!loading && !error && filteredJobs.length > 0" class="ps-lifecycle-pipeline">
        <div class="ps-lc-header">岗位生命周期管道</div>
        <div class="ps-lc-stages">
          <div class="ps-lc-stage">
            <span class="ps-lc-count">{{ stats.draft }}</span>
            <span class="ps-lc-label">草稿</span>
            <div class="ps-lc-bar" :style="{ width: pipelinePct(stats.draft) + '%', background: '#94A3B8' }"></div>
          </div>
          <div class="ps-lc-arrow">→</div>
          <div class="ps-lc-stage">
            <span class="ps-lc-count">{{ stats.published }}</span>
            <span class="ps-lc-label">招聘中</span>
            <div class="ps-lc-bar" :style="{ width: pipelinePct(stats.published) + '%', background: '#6366F1' }"></div>
          </div>
          <div class="ps-lc-arrow">→</div>
          <div class="ps-lc-stage">
            <span class="ps-lc-count">{{ stats.inInterview }}</span>
            <span class="ps-lc-label">面试中</span>
            <div class="ps-lc-bar" :style="{ width: pipelinePct(stats.inInterview) + '%', background: '#F59E0B' }"></div>
          </div>
          <div class="ps-lc-arrow">→</div>
          <div class="ps-lc-stage">
            <span class="ps-lc-count">{{ stats.totalCandidates }}</span>
            <span class="ps-lc-label">累计候选</span>
            <div class="ps-lc-bar" :style="{ width: pipelinePct(stats.totalCandidates) + '%', background: '#10B981' }"></div>
          </div>
        </div>
      </div>

      <!-- Job List -->
      <div v-if="!loading && !error && filteredJobs.length > 0" class="ps-job-list">
        <div class="ps-job-table">
          <!-- Table Header -->
          <div class="ps-table-header">
            <div class="ps-th ps-th-title">岗位名称</div>
            <div class="ps-th ps-th-status">状态</div>
            <div class="ps-th ps-th-candidates">候选人数</div>
            <div class="ps-th ps-th-match">AI 匹配度</div>
            <div class="ps-th ps-th-time">创建时间</div>
            <div class="ps-th ps-th-actions">操作</div>
          </div>

          <!-- Table Rows -->
          <div
            v-for="job in paginatedJobs"
            :key="job.id"
            class="ps-table-row"
            @click="openDetail(job)"
          >
            <div class="ps-td ps-td-title">
              <span class="ps-job-name">{{ job.title }}</span>
              <div class="ps-job-meta">
                <span v-if="job.salary" class="ps-meta-tag ps-meta-salary">{{ job.salary }}</span>
                <span v-if="job.location" class="ps-meta-tag ps-meta-location">{{ job.location }}</span>
              </div>
            </div>
            <div class="ps-td ps-td-status">
              <RecruitmentBadge :variant="badgeVariant(job.status)">{{ statusLabels[job.status] || job.status }}</RecruitmentBadge>
            </div>
            <div class="ps-td ps-td-candidates">
              <span class="ps-count-num">{{ job.candidateCount }}</span>
            </div>
            <div class="ps-td ps-td-match">
              <div class="ps-match-bar-wrapper">
                <div class="ps-match-bar-bg">
                  <div class="ps-match-bar-fill" :style="{ width: aiMatchPercent(job) + '%', background: matchColor(aiMatchPercent(job)) }"></div>
                </div>
                <span class="ps-match-text" :style="{ color: matchColor(aiMatchPercent(job)) }">{{ aiMatchPercent(job) }}%</span>
              </div>
            </div>
            <div class="ps-td ps-td-time">
              <span class="ps-time-text">{{ formatDate(job.createdAt) }}</span>
            </div>
            <div class="ps-td ps-td-actions" @click.stop>
              <button class="ps-action-btn" @click="openDetail(job)">详情</button>
              <div class="ps-action-dropdown">
                <button class="ps-action-btn ps-dropdown-toggle" @click.stop="toggleDropdown(job.id)">⋯</button>
                <div v-if="dropdownOpen === job.id" class="ps-dropdown-menu">
                  <button @click="changeStatus(job, 'published')" v-if="job.status !== 'published'">发布</button>
                  <button @click="changeStatus(job, 'paused')" v-if="job.status === 'published'">暂停</button>
                  <button @click="changeStatus(job, 'closed')" v-if="job.status !== 'closed'">关闭</button>
                  <button @click="deleteJob(job)" class="ps-danger-action">删除</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Pagination -->
        <div v-if="totalPages > 1" class="ps-pagination">
          <button class="ps-page-btn" :disabled="currentPage <= 1" @click="currentPage--">
            上一页
          </button>
          <span class="ps-page-info">
            第 {{ currentPage }} / {{ totalPages }} 页，共 {{ filteredJobs.length }} 条
          </span>
          <button class="ps-page-btn" :disabled="currentPage >= totalPages" @click="currentPage++">
            下一页
          </button>
        </div>
      </div>
    </RecruitmentPageShell>

    <!-- Job Detail Drawer -->
    <div v-if="showDetail" class="ps-drawer-overlay" @click.self="closeDetail">
      <div class="ps-drawer-panel">
        <div class="ps-drawer-header">
          <h2>{{ detail?.title || '职位详情' }}</h2>
          <button @click="closeDetail" class="ps-close-btn">✕</button>
        </div>

        <div v-if="detailLoading" class="ps-drawer-loading">
          <div class="ps-loading-spinner"></div>
          <span>加载中...</span>
        </div>

        <div v-else-if="detail" class="ps-drawer-content">
          <!-- Status & Quick Stats -->
          <div class="ps-detail-section">
            <div class="ps-section-header">
              <h3>概览</h3>
              <RecruitmentBadge :variant="badgeVariant(detail.status)">{{ statusLabels[detail.status] || detail.status }}</RecruitmentBadge>
            </div>
            <div class="ps-quick-stats">
              <div class="ps-quick-stat">
                <span class="ps-qs-value">{{ detail.candidateCount }}</span>
                <span class="ps-qs-label">候选人</span>
              </div>
              <div class="ps-quick-stat">
                <span class="ps-qs-value">{{ detail.interviewCount || 0 }}</span>
                <span class="ps-qs-label">面试</span>
              </div>
              <div class="ps-quick-stat">
                <span class="ps-qs-value">{{ detail.channelCount }}</span>
                <span class="ps-qs-label">渠道</span>
              </div>
              <div class="ps-quick-stat">
                <span class="ps-qs-value">{{ detail.qualityScore || '-' }}</span>
                <span class="ps-qs-label">质量分</span>
              </div>
            </div>
          </div>

          <!-- AI 招聘项目空间 -->
          <div class="ps-detail-section">
            <div class="ps-section-header">
              <h3>AI 招聘项目空间</h3>
              <span class="ps-ai-project-subtitle">查看每位 AI 员工对该职位的执行进度</span>
            </div>
            <div class="ps-ai-project-grid">
              <!-- Alice: 招聘顾问 -->
              <div class="ps-ai-project-card">
                <div class="ps-ai-project-header">
                  <span class="ps-ai-project-icon" style="background: linear-gradient(135deg, #6366F1, #8B5CF6)">A</span>
                  <div class="ps-ai-project-meta">
                    <span class="ps-ai-project-name">Alice</span>
                    <span class="ps-ai-project-role">招聘顾问</span>
                  </div>
                </div>
                <div class="ps-ai-project-tasks">
                  <div class="ps-ai-project-task">
                    <span class="ps-ai-project-task-status" :class="detail.status !== 'draft' ? 'ps-ai-done' : 'ps-ai-pending'">{{ detail.status !== 'draft' ? '✓' : '○' }}</span>
                    <span class="ps-ai-project-task-label">需求分析</span>
                  </div>
                  <div class="ps-ai-project-task">
                    <span class="ps-ai-project-task-status" :class="detail.description ? 'ps-ai-done' : 'ps-ai-pending'">{{ detail.description ? '✓' : '○' }}</span>
                    <span class="ps-ai-project-task-label">JD 生成</span>
                  </div>
                  <div class="ps-ai-project-task">
                    <span class="ps-ai-project-task-status" :class="detail.channelCount > 0 ? 'ps-ai-done' : 'ps-ai-pending'">{{ detail.channelCount > 0 ? '✓' : '○' }}</span>
                    <span class="ps-ai-project-task-label">渠道建议</span>
                  </div>
                </div>
              </div>

              <!-- Carol: 人才分析师 -->
              <div class="ps-ai-project-card">
                <div class="ps-ai-project-header">
                  <span class="ps-ai-project-icon" style="background: linear-gradient(135deg, #F59E0B, #F97316)">C</span>
                  <div class="ps-ai-project-meta">
                    <span class="ps-ai-project-name">Carol</span>
                    <span class="ps-ai-project-role">人才分析师</span>
                  </div>
                </div>
                <div class="ps-ai-project-tasks">
                  <div class="ps-ai-project-task">
                    <span class="ps-ai-project-task-status" :class="detail.candidateCount > 0 ? 'ps-ai-done' : 'ps-ai-pending'">{{ detail.candidateCount > 0 ? '✓' : '○' }}</span>
                    <span class="ps-ai-project-task-label">候选池</span>
                  </div>
                  <div class="ps-ai-project-task">
                    <span class="ps-ai-project-task-status" :class="detail.candidateCount > 0 ? 'ps-ai-progress' : 'ps-ai-pending'">{{ detail.candidateCount > 0 ? '↻' : '○' }}</span>
                    <span class="ps-ai-project-task-label">匹配人才</span>
                  </div>
                </div>
              </div>

              <!-- Bob: 面试专家 -->
              <div class="ps-ai-project-card">
                <div class="ps-ai-project-header">
                  <span class="ps-ai-project-icon" style="background: linear-gradient(135deg, #10B981, #34D399)">B</span>
                  <div class="ps-ai-project-meta">
                    <span class="ps-ai-project-name">Bob</span>
                    <span class="ps-ai-project-role">面试专家</span>
                  </div>
                </div>
                <div class="ps-ai-project-tasks">
                  <div class="ps-ai-project-task">
                    <span class="ps-ai-project-task-status" :class="detail.interviewCount > 0 ? 'ps-ai-done' : 'ps-ai-pending'">{{ detail.interviewCount > 0 ? '✓' : '○' }}</span>
                    <span class="ps-ai-project-task-label">面试流程</span>
                  </div>
                  <div class="ps-ai-project-task">
                    <span class="ps-ai-project-task-status" :class="detail.qualityScore > 0 ? 'ps-ai-done' : 'ps-ai-pending'">{{ detail.qualityScore > 0 ? '✓' : '○' }}</span>
                    <span class="ps-ai-project-task-label">评分标准</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- JD -->
          <div class="ps-detail-section">
            <h3>职位描述</h3>
            <div class="ps-jd-content">
              <div v-if="detail.description" class="ps-jd-text">{{ detail.description }}</div>
              <div v-else class="ps-empty-text">暂无职位描述</div>
            </div>
          </div>

          <!-- Requirements -->
          <div class="ps-detail-section">
            <h3>岗位要求</h3>
            <div class="ps-jd-content">
              <div v-if="detail.requirements" class="ps-jd-text">{{ detail.requirements }}</div>
              <div v-else class="ps-empty-text">暂无岗位要求</div>
            </div>
          </div>

          <!-- Skills -->
          <div v-if="detail.skillRequirements?.length" class="ps-detail-section">
            <h3>技能要求</h3>
            <div class="ps-skill-tags">
              <RecruitmentBadge v-for="skill in detail.skillRequirements" :key="skill" variant="info">{{ skill }}</RecruitmentBadge>
            </div>
          </div>

          <!-- Channels -->
          <div class="ps-detail-section">
            <div class="ps-section-header">
              <h3>招聘渠道</h3>
              <RecruitmentSecondaryButton @click="showChannelModal = true">+ 添加渠道</RecruitmentSecondaryButton>
            </div>
            <div v-if="!detail.channels?.length" class="ps-empty-text">暂未发布到任何渠道</div>
            <div v-else class="ps-channel-list">
              <div v-for="ch in detail.channels" :key="ch.id" class="ps-channel-item">
                <span class="ps-channel-name">{{ ch.channel?.name || ch.channelId }}</span>
                <RecruitmentBadge :variant="ch.status === 'active' ? 'success' : ch.status === 'paused' ? 'warning' : 'neutral'">{{ ch.status }}</RecruitmentBadge>
              </div>
            </div>
          </div>

          <!-- Recent Candidates -->
          <div class="ps-detail-section">
            <h3>最近候选人</h3>
            <div v-if="!detail.recentCandidates?.length" class="ps-empty-text">暂无候选人</div>
            <div v-else class="ps-candidate-list">
              <div v-for="c in detail.recentCandidates" :key="c.id" class="ps-candidate-item">
                <span class="ps-candidate-name">{{ c.candidateName }}</span>
                <RecruitmentBadge>{{ stageLabels[c.stage] || c.stage }}</RecruitmentBadge>
                <span v-if="c.screeningScore" class="ps-score">{{ c.screeningScore }}分</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Create Job Modal -->
    <div v-if="showCreateModal" class="ps-modal-overlay" @click.self="showCreateModal = false">
      <div class="ps-modal-panel">
        <div class="ps-modal-header">
          <h2>创建岗位</h2>
          <button @click="showCreateModal = false" class="ps-close-btn">✕</button>
        </div>
        <div class="ps-modal-content">
          <!-- Tabs -->
          <div class="ps-modal-tabs">
            <button :class="['ps-modal-tab', { active: createTab === 'manual' }]" @click="createTab = 'manual'">手动创建</button>
            <button :class="['ps-modal-tab', { active: createTab === 'ai' }]" @click="createTab = 'ai'">AI 生成 JD</button>
          </div>

          <!-- Manual Form -->
          <div v-if="createTab === 'manual'" class="ps-form-content">
            <div class="ps-form-group">
              <label>职位名称 <span class="ps-required">*</span></label>
              <RecruitmentInput v-model="jobForm.title" placeholder="如：Python开发工程师" />
            </div>
            <div class="ps-form-row">
              <div class="ps-form-group">
                <label>薪资范围</label>
                <RecruitmentInput v-model="jobForm.salary" placeholder="如：15-22K" />
              </div>
              <div class="ps-form-group">
                <label>工作地点</label>
                <RecruitmentInput v-model="jobForm.location" placeholder="如：深圳" />
              </div>
            </div>
            <div class="ps-form-group">
              <label>职位描述 <span class="ps-required">*</span></label>
              <textarea v-model="jobForm.description" placeholder="请输入职位描述..." class="ps-textarea" rows="4"></textarea>
            </div>
            <div class="ps-form-group">
              <label>岗位要求</label>
              <textarea v-model="jobForm.requirements" placeholder="请输入岗位要求..." class="ps-textarea" rows="3"></textarea>
            </div>
            <div class="ps-form-group">
              <label>技能要求（逗号分隔）</label>
              <RecruitmentInput v-model="jobForm.skillsInput" placeholder="如：Python, Django, SQL" />
            </div>
            <div class="ps-form-group">
              <label>标签（逗号分隔）</label>
              <RecruitmentInput v-model="jobForm.tagsInput" placeholder="如：AI, 远程, 高薪" />
            </div>
          </div>

          <!-- AI JD -->
          <div v-if="createTab === 'ai'" class="ps-form-content">
            <div class="ps-form-group">
              <label>职位名称 <span class="ps-required">*</span></label>
              <RecruitmentInput v-model="jobForm.title" placeholder="如：Python开发工程师" />
            </div>
            <div class="ps-form-row">
              <div class="ps-form-group">
                <label>薪资范围</label>
                <RecruitmentInput v-model="jobForm.salary" placeholder="如：15-22K" />
              </div>
              <div class="ps-form-group">
                <label>工作地点</label>
                <RecruitmentInput v-model="jobForm.location" placeholder="如：深圳" />
              </div>
            </div>
            <div class="ps-form-group">
              <label>关键词（帮助 AI 生成更好的 JD）</label>
              <RecruitmentInput v-model="jobForm.aiKeywords" placeholder="如：后端, 微服务, 高并发" />
            </div>
            <div class="ps-ai-generate-btn">
              <RecruitmentPrimaryButton :disabled="aiGenerating || !jobForm.title" @click="generateAIJD">
                {{ aiGenerating ? '生成中...' : 'AI 生成 JD' }}
              </RecruitmentPrimaryButton>
            </div>
            <div v-if="jobForm.description" class="ps-form-group">
              <label>AI 生成的职位描述</label>
              <textarea v-model="jobForm.description" class="ps-textarea" rows="6"></textarea>
            </div>
            <div v-if="jobForm.requirements" class="ps-form-group">
              <label>AI 生成的岗位要求</label>
              <textarea v-model="jobForm.requirements" class="ps-textarea" rows="4"></textarea>
            </div>
          </div>

          <!-- Footer -->
          <div class="ps-modal-footer">
            <RecruitmentSecondaryButton @click="showCreateModal = false">取消</RecruitmentSecondaryButton>
            <RecruitmentPrimaryButton :disabled="!canCreate" @click="createJob">
              {{ jobForm.status === 'published' ? '立即发布' : '保存草稿' }}
            </RecruitmentPrimaryButton>
            <RecruitmentSelect v-model="jobForm.status" class="ps-status-select">
              <option value="draft">草稿</option>
              <option value="published">直接发布</option>
            </RecruitmentSelect>
          </div>
        </div>
      </div>
    </div>

    <!-- Channel Select Modal -->
    <div v-if="showChannelModal" class="ps-modal-overlay" @click.self="showChannelModal = false">
      <div class="ps-modal-panel" style="max-width: 500px">
        <div class="ps-modal-header">
          <h2>选择招聘渠道</h2>
          <button @click="showChannelModal = false" class="ps-close-btn">✕</button>
        </div>
        <div class="ps-modal-content">
          <div v-if="channels.length === 0" class="ps-empty-text">暂无可用渠道</div>
          <div v-else class="ps-channel-select-list">
            <label v-for="ch in channels" :key="ch.id" class="ps-channel-select-item">
              <input type="checkbox" :value="ch.id" v-model="selectedChannels" />
              <span class="ps-channel-info">
                <span class="ps-channel-name">{{ ch.name }}</span>
                <span class="ps-channel-desc">{{ ch.description }}</span>
              </span>
            </label>
          </div>
          <div class="ps-modal-footer">
            <RecruitmentSecondaryButton @click="showChannelModal = false">取消</RecruitmentSecondaryButton>
            <RecruitmentPrimaryButton :disabled="selectedChannels.length === 0" @click="publishToChannels">
              发布到 {{ selectedChannels.length }} 个渠道
            </RecruitmentPrimaryButton>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'enterprise-workspace' })

import { ref, computed, onMounted } from 'vue'
import { useEnterpriseContext } from '~/composables/useEnterpriseContext'
import { useIdentityStore } from '~/stores/identity'

// 显式导入招聘 UI 组件（Nuxt auto-import 对深层嵌套组件的短名注册不稳定）
import RecruitmentInput from '~/components/enterprise/recruitment/ui/RecruitmentInput.vue'
import RecruitmentPrimaryButton from '~/components/enterprise/recruitment/ui/RecruitmentPrimaryButton.vue'
import RecruitmentSecondaryButton from '~/components/enterprise/recruitment/ui/RecruitmentSecondaryButton.vue'
import RecruitmentSelect from '~/components/enterprise/recruitment/ui/RecruitmentSelect.vue'
import RecruitmentStatCard from '~/components/enterprise/recruitment/ui/RecruitmentStatCard.vue'
import RecruitmentBadge from '~/components/enterprise/recruitment/ui/RecruitmentBadge.vue'
import RecruitmentPageShell from '~/components/enterprise/recruitment/ui/RecruitmentPageShell.vue'

const ctx = useEnterpriseContext()
const identityStore = useIdentityStore()

// ─── State ───
const loading = ref(false)
const error = ref<string | null>(null)
const jobs = ref<any[]>([])
const statusFilter = ref('')
const searchQuery = ref('')
const stats = ref({ published: 0, draft: 0, totalCandidates: 0, inInterview: 0 })
const dropdownOpen = ref<string | null>(null)

// Pagination
const currentPage = ref(1)
const pageSize = 10

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

// ─── Helpers ───
function badgeVariant(status: string): string {
  const map: Record<string, string> = {
    draft: 'neutral',
    published: 'success',
    paused: 'warning',
    closed: 'danger',
  }
  return map[status] || 'default'
}

function aiMatchPercent(job: any): number {
  if (job.qualityScore != null) return Math.round(job.qualityScore)
  // Fallback: derive from available data
  if (job.candidateCount > 0) return Math.min(85, 40 + job.candidateCount * 5)
  return 0
}

function matchColor(pct: number): string {
  if (pct >= 80) return '#10B981'
  if (pct >= 60) return '#F59E0B'
  if (pct >= 30) return '#F97316'
  return '#94A3B8'
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

const totalPages = computed(() => Math.ceil(filteredJobs.value.length / pageSize))

const paginatedJobs = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  return filteredJobs.value.slice(start, start + pageSize)
})

const canCreate = computed(() => {
  const title = jobForm.value.title
  const desc = jobForm.value.description
  return typeof title === 'string' && title.trim() &&
         typeof desc === 'string' && desc.trim()
})

function pipelinePct(count: number): number {
  const total = filteredJobs.value.length || 1
  return Math.round((count / total) * 100)
}

// ─── Methods ───
function getWorkspaceId(): string {
  return identityStore.workspaceId || ctx.getWorkspaceId()
}

function formatDate(date: string | Date): string {
  if (!date) return '-'
  const d = new Date(date)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (days === 0) return '今天'
  if (days === 1) return '昨天'
  if (days < 7) return `${days}天前`
  return d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
}

async function loadJobs() {
  loading.value = true
  error.value = null
  try {
    const params = new URLSearchParams()
    if (statusFilter.value) params.set('status', statusFilter.value)
    if (searchQuery.value) params.set('keyword', searchQuery.value)

    const res = await fetch(`/api/enterprise/postings?${params}`)
    if (!res.ok) {
      throw new Error(`请求失败 (${res.status})`)
    }
    const data = await res.json()
    jobs.value = data.data || []

    // Calculate stats
    const publishedJobs = jobs.value.filter((j: any) => j.status === 'published')
    const draftJobs = jobs.value.filter((j: any) => j.status === 'draft')
    const totalCandidates = jobs.value.reduce((sum: number, j: any) => sum + (j.candidateCount || 0), 0)

    stats.value = {
      published: publishedJobs.length,
      draft: draftJobs.length,
      totalCandidates,
      inInterview: 0, // Will be updated from interview API
    }

    // Fetch interview count
    try {
      const intRes = await fetch('/enterprise/interviews')
      if (intRes.ok) {
        const intData = await intRes.json()
        const interviews = intData.items || []
        stats.value.inInterview = Array.isArray(interviews) ? interviews.length : 0
      }
    } catch {
      // Non-fatal interview stats
    }

    currentPage.value = 1
  } catch (e: any) {
    console.error('加载职位列表失败', e)
    error.value = e.message || '加载职位列表失败，请重试'
  } finally {
    loading.value = false
  }
}

function onFilterChange() {
  currentPage.value = 1
  loadJobs()
}

let searchTimer: any = null
function debounceSearch() {
  currentPage.value = 1
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
        position: jobForm.value.title,
        salaryRange: jobForm.value.salary,
        location: jobForm.value.location,
        requirements: jobForm.value.aiKeywords ? jobForm.value.aiKeywords.split(/[,，、]/).map((s: string) => s.trim()).filter(Boolean) : undefined,
        companyName: '',
      }),
    })
    const data = await res.json()
    if (data.success || data.description || data.jd) {
      // API 可能返回 data.jd 为对象（含 description 字段）或纯字符串
      const jdObj = typeof data.jd === 'object' ? data.jd : null
      const jdStr = typeof data.jd === 'string' ? data.jd : ''
      jobForm.value.description = jdObj?.description || data.description || jdStr || ''

      if (jdObj?.requirements || data.requirements) {
        const req = jdObj?.requirements || data.requirements
        jobForm.value.requirements = typeof req === 'string' ? req : (Array.isArray(req) ? req.join('\n') : '')
      }
      if (jdObj?.skills || data.skills || jdObj?.skillRequirements || data.skillRequirements) {
        const skills = jdObj?.skills || data.skills || jdObj?.skillRequirements || data.skillRequirements || []
        jobForm.value.skillsInput = Array.isArray(skills) ? skills.join(', ') : String(skills)
      }
    }
  } catch (e) {
    console.error('AI 生成失败', e)
    // Fallback
    jobForm.value.description = `${jobForm.value.title}\n\n职位描述：\n我们正在寻找一位优秀的${jobForm.value.title}加入我们的团队。\n\n岗位职责：\n1. 负责相关技术开发工作\n2. 参与产品需求分析和技术方案设计\n3. 代码审查和技术文档编写`
    jobForm.value.requirements = '岗位要求：\n1. 相关专业本科及以上学历\n2. 具备扎实的专业基础\n3. 良好的沟通能力和团队协作精神'
  } finally {
    aiGenerating.value = false
  }
}

async function createJob() {
  if (!canCreate.value) return
  try {
    const body: any = {
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
      openDetail(detail.value)
    }
  } catch (e) {
    console.error('发布到渠道失败', e)
  }
}

// ─── Lifecycle ───
onMounted(async () => {
  await identityStore.fetchContext()

  if (!getWorkspaceId()) {
    window.location.href = '/workspace/enterprise/onboarding'
    return
  }
  loadJobs()
  loadChannels()

  window.addEventListener('workspace-switched', () => {
    loadJobs()
    loadChannels()
  })
})
</script>

<style scoped>
.jobs-workspace {
  padding: 0;
}

/* ─── Loading ─── */
.ps-loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 60px;
  color: var(--color-text-muted);
}

.ps-loading-spinner {
  width: 24px;
  height: 24px;
  border: 3px solid var(--color-border-primary);
  border-top-color: var(--color-decision);
  border-radius: 50%;
  animation: ps-spin 1s linear infinite;
}

@keyframes ps-spin {
  to { transform: rotate(360deg); }
}

/* ─── Error State ─── */
.ps-error-state {
  text-align: center;
  padding: 60px;
}

.ps-error-icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: rgba(239, 68, 68, 0.1);
  color: #EF4444;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 16px;
}

.ps-error-state h3 {
  font-size: 16px;
  color: var(--color-text-primary);
  margin-bottom: 8px;
}

.ps-error-state p {
  font-size: 13px;
  color: var(--color-text-muted);
  margin-bottom: 16px;
}

/* ─── Empty State ─── */
.ps-empty-state {
  text-align: center;
  padding: 60px 40px;
  color: var(--color-text-muted);
}

.ps-empty-icon {
  color: var(--color-text-muted);
  opacity: 0.4;
  margin-bottom: 16px;
}

.ps-empty-state h3 {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--color-text-primary);
}

.ps-empty-desc {
  font-size: 13px;
  margin-bottom: 20px;
  line-height: 1.6;
  color: var(--color-text-secondary);
}

/* ─── Job Table ─── */
/* ─── Lifecycle Pipeline ─── */
.ps-lifecycle-pipeline {
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-primary);
  border-radius: 10px;
  padding: 16px 20px;
  margin-bottom: 16px;
}

.ps-lc-header {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.03em;
  margin-bottom: 14px;
}

.ps-lc-stages {
  display: flex;
  align-items: center;
  gap: 10px;
}

.ps-lc-stage {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  text-align: center;
}

.ps-lc-count {
  font-size: 24px;
  font-weight: 700;
  color: var(--color-text-primary);
  line-height: 1.2;
}

.ps-lc-label {
  font-size: 11px;
  color: var(--color-text-muted);
}

.ps-lc-bar {
  height: 4px;
  border-radius: 2px;
  margin-top: 4px;
  transition: width 0.3s ease;
}

.ps-lc-arrow {
  color: var(--color-text-muted);
  font-size: 16px;
  padding-bottom: 16px;
}

.ps-job-list {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.ps-job-table {
  border: 1px solid var(--color-border-primary);
  border-radius: 10px;
  overflow: hidden;
}

.ps-table-header {
  display: flex;
  align-items: center;
  background: var(--color-bg-secondary);
  border-bottom: 1px solid var(--color-border-primary);
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.ps-th {
  padding: 12px 16px;
}

.ps-th-title { flex: 1; min-width: 0; }
.ps-th-status { width: 80px; text-align: center; }
.ps-th-candidates { width: 80px; text-align: center; }
.ps-th-match { width: 140px; text-align: center; }
.ps-th-time { width: 90px; text-align: center; }
.ps-th-actions { width: 100px; text-align: center; }

.ps-table-row {
  display: flex;
  align-items: center;
  border-bottom: 1px solid var(--color-border-primary);
  cursor: pointer;
  transition: background 0.1s;
}

.ps-table-row:last-child {
  border-bottom: none;
}

.ps-table-row:hover {
  background: var(--color-bg-hover);
}

.ps-td {
  padding: 14px 16px;
  font-size: 13px;
  color: var(--color-text-primary);
}

.ps-td-title { flex: 1; min-width: 0; }
.ps-td-status { width: 80px; text-align: center; }
.ps-td-candidates { width: 80px; text-align: center; }
.ps-td-match { width: 140px; text-align: center; }
.ps-td-time { width: 90px; text-align: center; }
.ps-td-actions { width: 100px; text-align: center; }

.ps-job-name {
  font-weight: 500;
  font-size: 14px;
  color: var(--color-text-primary);
  display: block;
  margin-bottom: 4px;
}

.ps-job-meta {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.ps-meta-tag {
  font-size: 11px;
  padding: 1px 8px;
  border-radius: 4px;
  background: var(--color-bg-hover);
  color: var(--color-text-secondary);
}

.ps-meta-salary {
  color: var(--color-execution);
  background: rgba(16, 185, 129, 0.1);
}

.ps-meta-location {
  color: var(--color-decision);
  background: rgba(99, 102, 241, 0.1);
}

.ps-count-num {
  font-weight: 600;
  font-size: 15px;
  color: var(--color-text-primary);
}

.ps-match-bar-wrapper {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.ps-match-bar-bg {
  width: 60px;
  height: 6px;
  background: var(--color-border-primary);
  border-radius: 3px;
  overflow: hidden;
}

.ps-match-bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s ease;
}

.ps-match-text {
  font-size: 12px;
  font-weight: 600;
  min-width: 32px;
}

.ps-time-text {
  font-size: 12px;
  color: var(--color-text-secondary);
}

/* ─── Action Buttons ─── */
.ps-action-btn {
  padding: 4px 10px;
  border: 1px solid var(--color-border-primary);
  background: transparent;
  color: var(--color-text-secondary);
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  font-family: var(--font-family);
  transition: all 0.12s;
}

.ps-action-btn:hover {
  border-color: var(--color-decision);
  color: var(--color-decision);
}

.ps-dropdown-toggle {
  padding: 4px 8px;
}

.ps-action-dropdown {
  position: relative;
  display: inline-block;
}

.ps-dropdown-menu {
  position: absolute;
  right: 0;
  top: 100%;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-primary);
  border-radius: 8px;
  z-index: 10;
  min-width: 100px;
  box-shadow: var(--shadow-md);
  margin-top: 4px;
}

.ps-dropdown-menu button {
  display: block;
  width: 100%;
  padding: 8px 14px;
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
  text-align: left;
  cursor: pointer;
  font-size: 12px;
  font-family: var(--font-family);
}

.ps-dropdown-menu button:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
}

.ps-danger-action {
  color: #EF4444 !important;
}

.ps-danger-action:hover {
  background: rgba(239, 68, 68, 0.1) !important;
}

/* ─── Pagination ─── */
.ps-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 20px 0 0;
}

.ps-page-btn {
  padding: 6px 14px;
  border: 1px solid var(--color-border-primary);
  background: transparent;
  color: var(--color-text-secondary);
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  font-family: var(--font-family);
  transition: all 0.12s;
}

.ps-page-btn:hover:not(:disabled) {
  border-color: var(--color-decision);
  color: var(--color-decision);
}

.ps-page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.ps-page-info {
  font-size: 13px;
  color: var(--color-text-muted);
}

/* ─── Drawer ─── */
.ps-drawer-overlay {
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

.ps-drawer-panel {
  width: 600px;
  max-width: 90vw;
  height: 100vh;
  background: var(--color-bg-primary);
  border-left: 1px solid var(--color-border-primary);
  overflow-y: auto;
  animation: ps-slide-in 0.2s ease;
}

@keyframes ps-slide-in {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}

.ps-drawer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid var(--color-border-primary);
  position: sticky;
  top: 0;
  background: var(--color-bg-primary);
  z-index: 1;
}

.ps-drawer-header h2 {
  margin: 0;
  font-size: 18px;
  color: var(--color-text-primary);
}

.ps-close-btn {
  width: 32px;
  height: 32px;
  border: 1px solid var(--color-border-primary);
  background: transparent;
  color: var(--color-text-secondary);
  border-radius: 8px;
  cursor: pointer;
  font-size: 16px;
  transition: all 0.12s;
}

.ps-close-btn:hover {
  border-color: var(--color-text-muted);
  color: var(--color-text-primary);
}

.ps-drawer-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 60px;
  color: var(--color-text-muted);
}

.ps-drawer-content {
  padding: 20px;
}

.ps-detail-section {
  margin-bottom: 24px;
  padding-bottom: 24px;
  border-bottom: 1px solid var(--color-border-primary);
}

.ps-detail-section:last-child {
  border-bottom: none;
}

.ps-section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.ps-detail-section h3 {
  font-size: 14px;
  font-weight: 600;
  margin: 0;
  color: var(--color-text-primary);
}

.ps-quick-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.ps-quick-stat {
  text-align: center;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-primary);
  border-radius: 8px;
  padding: 14px 8px;
}

.ps-qs-value {
  display: block;
  font-size: 22px;
  font-weight: 700;
  color: var(--color-decision);
}

.ps-qs-label {
  font-size: 11px;
  color: var(--color-text-muted);
  margin-top: 2px;
}

.ps-jd-content {
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-primary);
  border-radius: 8px;
  padding: 16px;
}

/* ─── AI 招聘项目空间 ─── */
.ps-ai-project-subtitle {
  font-size: 12px;
  color: var(--color-text-muted, #64748B);
  font-weight: 400;
}

.ps-ai-project-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-top: 12px;
}

.ps-ai-project-card {
  background: var(--color-bg-primary, #0D1328);
  border: 1px solid var(--color-border-primary, #1E293B);
  border-radius: 10px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ps-ai-project-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.ps-ai-project-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
}

.ps-ai-project-meta {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.ps-ai-project-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary, #E2E8F0);
}

.ps-ai-project-role {
  font-size: 11px;
  color: var(--color-text-muted, #64748B);
}

.ps-ai-project-tasks {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ps-ai-project-task {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--color-text-secondary, #94A3B8);
}

.ps-ai-project-task-status {
  font-size: 12px;
  width: 16px;
  text-align: center;
  flex-shrink: 0;
}

.ps-ai-done {
  color: #10B981;
}

.ps-ai-pending {
  color: var(--color-text-muted, #475569);
}

.ps-ai-progress {
  color: #F59E0B;
}

.ps-ai-project-task-label {
  color: var(--color-text-secondary, #94A3B8);
}

.ps-jd-text {
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  color: var(--color-text-primary);
}

.ps-skill-tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.ps-channel-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ps-channel-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-primary);
  border-radius: 8px;
}

.ps-channel-name {
  font-size: 13px;
  color: var(--color-text-primary);
}

.ps-candidate-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ps-candidate-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-primary);
  border-radius: 8px;
}

.ps-candidate-name {
  flex: 1;
  font-size: 13px;
  color: var(--color-text-primary);
}

.ps-score {
  font-size: 12px;
  color: var(--color-warning);
  font-weight: 600;
}

.ps-empty-text {
  font-size: 13px;
  color: var(--color-text-muted);
  text-align: center;
  padding: 20px;
}

/* ─── Modal ─── */
.ps-modal-overlay {
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

.ps-modal-panel {
  width: 600px;
  max-width: 90vw;
  max-height: 80vh;
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border-primary);
  border-radius: 12px;
  overflow-y: auto;
}

.ps-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid var(--color-border-primary);
  position: sticky;
  top: 0;
  background: var(--color-bg-primary);
  z-index: 1;
}

.ps-modal-header h2 {
  margin: 0;
  font-size: 17px;
  color: var(--color-text-primary);
}

.ps-modal-content {
  padding: 20px;
}

.ps-modal-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
}

.ps-modal-tab {
  flex: 1;
  padding: 10px;
  border: 1px solid var(--color-border-primary);
  background: transparent;
  color: var(--color-text-secondary);
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  font-family: var(--font-family);
  transition: all 0.12s;
}

.ps-modal-tab.active {
  border-color: var(--color-decision);
  color: var(--color-decision);
  background: rgba(99, 102, 241, 0.08);
}

.ps-form-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.ps-form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ps-form-group label {
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-secondary);
}

.ps-required {
  color: #EF4444;
}

.ps-form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.ps-textarea {
  width: 100%;
  padding: 10px;
  border: 1px solid var(--color-border-primary);
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  border-radius: 8px;
  font-size: 13px;
  resize: vertical;
  font-family: var(--font-family);
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.12s;
}

.ps-textarea:focus {
  border-color: var(--color-decision);
  box-shadow: 0 0 0 1px rgba(99, 102, 241, 0.2);
}

.ps-textarea::placeholder {
  color: var(--color-text-muted);
}

.ps-ai-generate-btn {
  text-align: center;
  padding: 8px 0;
}

.ps-modal-footer {
  display: flex;
  gap: 12px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--color-border-primary);
  align-items: center;
}

.ps-modal-footer > .rec-btn-secondary:first-child {
  margin-left: auto;
}

.ps-status-select {
  width: auto;
}

/* ─── Channel Select ─── */
.ps-channel-select-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ps-channel-select-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-primary);
  border-radius: 8px;
  cursor: pointer;
}

.ps-channel-select-item:hover {
  border-color: var(--color-decision);
}

.ps-channel-select-item input[type="checkbox"] {
  width: 18px;
  height: 18px;
}

.ps-channel-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ps-channel-info .ps-channel-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-primary);
}

.ps-channel-desc {
  font-size: 11px;
  color: var(--color-text-muted);
}
</style>
