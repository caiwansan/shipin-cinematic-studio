<template>
  <div class="geo-dashboard">
    <!-- ===== Page Header ===== -->
    <header class="geo-dashboard__header">
      <div>
        <h1 class="geo-dashboard__title">GEO 工作台</h1>
        <p class="geo-dashboard__subtitle">建立您的品牌数字身份，提升 AI 可见度</p>
      </div>
      <div class="geo-dashboard__header-actions">
        <button class="geo-dashboard__create-btn" @click="handleEditBrand">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
          创建品牌
        </button>
        <NuxtLink to="/" class="geo-dashboard__back-link">🏠 返回首页</NuxtLink>
      </div>
    </header>

    <!-- ===== Loading State ===== -->
    <div v-if="loading" class="geo-dashboard__loading">
      <div class="geo-dashboard__spinner" />
      <span>正在加载项目...</span>
    </div>

    <!-- ===== Error State ===== -->
    <div v-else-if="error" class="geo-dashboard__error">
      <p>{{ error }}</p>
      <button class="geo-dashboard__btn geo-dashboard__btn--primary" @click="loadData">重试</button>
    </div>

    <div v-else class="geo-dashboard__data-state">
      <!-- ===== Empty State (P0-T001) ===== -->
      <section v-if="projects.length === 0" class="geo-dashboard__empty-state">
        <div class="geo-dashboard__empty-state-content">
          <div class="geo-dashboard__empty-state-icon">
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
              <rect x="8" y="16" width="48" height="36" rx="4" stroke="#3b82f6" stroke-width="2" fill="#eff6ff" />
              <path d="M24 28h16M24 36h16M24 44h10" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" />
              <circle cx="48" cy="16" r="8" fill="#3b82f6" opacity="0.15" />
              <path d="M48 12v8M44 16h8" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" />
            </svg>
          </div>
          <h2 class="geo-dashboard__empty-state-title">欢迎使用 GEO 工作台</h2>
          <p class="geo-dashboard__empty-state-desc">三步提升品牌在 AI 平台的可见度</p>

          <!-- Three-step guide -->
          <div class="geo-dashboard__empty-state-steps">
            <div class="geo-dashboard__empty-state-step">
              <span class="geo-dashboard__empty-state-step-num">1</span>
              <div class="geo-dashboard__empty-state-step-content">
                <strong>创建品牌</strong>
                <span>输入品牌名称、官网和行业</span>
              </div>
            </div>
            <div class="geo-dashboard__empty-state-step">
              <span class="geo-dashboard__empty-state-step-num">2</span>
              <div class="geo-dashboard__empty-state-step-content">
                <strong>分析品牌</strong>
                <span>运行 AI 发现扫描，了解品牌可见度</span>
              </div>
            </div>
            <div class="geo-dashboard__empty-state-step">
              <span class="geo-dashboard__empty-state-step-num">3</span>
              <div class="geo-dashboard__empty-state-step-content">
                <strong>优化提升</strong>
                <span>根据建议优化，追踪效果</span>
              </div>
            </div>
          </div>
          <button class="geo-dashboard__empty-state-btn" @click="showCreateModal = true">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M9 3v12M3 9h12" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            </svg>
            创建品牌
          </button>
        </div>
      </section>
      <!-- ===== Data State ===== -->
      <div v-else class="geo-dashboard__data-content">
        <!-- ===== KPI Stats ===== -->
        <section class="geo-dashboard__section">
          <div class="geo-dashboard__kpi-bar">
            <span class="geo-dashboard__kpi-item">
              <strong>{{ projects.length }}</strong> 品牌
            </span>
            <span class="geo-dashboard__kpi-divider" />
            <span class="geo-dashboard__kpi-item">
              <strong>{{ analyzedCount }}</strong> 已分析
            </span>
            <span class="geo-dashboard__kpi-divider" />
            <span class="geo-dashboard__kpi-item">
              <strong>{{ analyzedCount > 0 ? avgAdi : '—' }}</strong> 平均 ADI
            </span>
            <span class="geo-dashboard__kpi-divider" />
            <span class="geo-dashboard__kpi-item">
              <strong>{{ pendingCount }}</strong> 待分析
            </span>
          </div>
          <div v-if="analyzedCount === 0" class="geo-dashboard__kpi-hint">
            等待首次分析
            <button class="geo-dashboard__kpi-btn" @click="handleFirstAnalysis">立即开始 →</button>
          </div>
        </section>

        <!-- ===== Quick Actions ===== -->
        <section class="geo-dashboard__section">
          <h2 class="geo-dashboard__section-title">快速操作</h2>
          <div class="geo-dashboard__quick-actions">
            <button class="geo-dashboard__action-card" @click="handleEditBrand">
              <span class="geo-dashboard__action-icon geo-dashboard__action-icon--brand">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </span>
              <span class="geo-dashboard__action-text">
                <strong>完善品牌资料</strong>
                <small>更新品牌信息与配置</small>
              </span>
            </button>
            <button class="geo-dashboard__action-card" @click="handleGEOAssessment">
              <span class="geo-dashboard__action-icon geo-dashboard__action-icon--geo">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" />
                  <path d="M12 6v6l4 2" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                </svg>
              </span>
              <span class="geo-dashboard__action-text">
                <strong>开始 GEO 评估</strong>
                <small>运行品牌发现与分析</small>
              </span>
            </button>
            <button class="geo-dashboard__action-card" @click="handleAddKnowledge">
              <span class="geo-dashboard__action-icon geo-dashboard__action-icon--knowledge">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke="currentColor" stroke-width="2" />
                  <path d="M8 7h8M8 11h6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                </svg>
              </span>
              <span class="geo-dashboard__action-text">
                <strong>添加知识源</strong>
                <small>导入品牌资料与文档</small>
              </span>
            </button>
          </div>
        </section>

        <!-- ===== Brand Cards / Project List (P2-2.4) ===== -->
        <section class="geo-dashboard__section">
          <h2 class="geo-dashboard__section-title">
            品牌项目
            <span class="geo-dashboard__section-badge">{{ projects.length }}</span>
          </h2>

          <div class="geo-dashboard__brand-cards">
            <div
              v-for="project in projects"
              :key="project.id"
              class="geo-dashboard__brand-card"
              @click="continueProject(project.id)"
            >
              <div class="geo-dashboard__brand-card-header">
                <div class="geo-dashboard__brand-card-avatar">
                  {{ project.name.charAt(0).toUpperCase() }}
                </div>
                <div class="geo-dashboard__brand-card-info">
                  <h3 class="geo-dashboard__brand-card-name">{{ project.name }}</h3>
                  <span v-if="project.industry" class="geo-dashboard__brand-card-industry">{{ project.industry }}</span>
                  <a
                    v-if="project.website || project.config?.website"
                    :href="project.website || project.config?.website"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="geo-dashboard__brand-card-website"
                    @click.stop
                  >
                    {{ (project.website || project.config?.website)?.replace(/^https?:\/\//, '').replace(/\/.*$/, '') }}
                  </a>
                </div>
                <div class="geo-dashboard__brand-card-actions">
                  <button
                    class="geo-dashboard__brand-card-delete"
                    title="删除品牌"
                    @click.stop="confirmDeleteBrand(project)"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                    </svg>
                  </button>
                </div>
                <span class="geo-dashboard__brand-card-status" :class="`geo-dashboard__brand-card-status--${project.status || 'draft'}`">
                  {{ statusLabel(project.status) }}
                </span>
              </div>

              <div class="geo-dashboard__brand-card-body">
                <div class="geo-dashboard__brand-card-completeness">
                  <div class="geo-dashboard__brand-card-ring">
                    <svg width="40" height="40" viewBox="0 0 40 40">
                      <circle cx="20" cy="20" r="16" fill="none" stroke="#e5e7eb" stroke-width="3" />
                      <circle
                        cx="20" cy="20" r="16"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="3"
                        stroke-linecap="round"
                        :stroke-dasharray="100.53"
                        :stroke-dashoffset="100.53 - (100.53 * brandCompleteness(project)) / 100"
                        :class="completenessRingColor(brandCompleteness(project))"
                      />
                      <text x="20" y="20" text-anchor="middle" dominant-baseline="central" class="geo-dashboard__brand-card-ring-text">
                        {{ brandCompleteness(project) }}%
                      </text>
                    </svg>
                  </div>
                  <div class="geo-dashboard__brand-card-steps">
                    <span class="geo-dashboard__brand-card-step" :class="brandCompletenessStep(project, 'identity')">
                      {{ brandCompletenessStep(project, 'identity') === 'done' ? '✓' : '○' }} 资料
                    </span>
                    <span class="geo-dashboard__brand-card-step" :class="brandCompletenessStep(project, 'knowledge')">
                      {{ brandCompletenessStep(project, 'knowledge') === 'done' ? '✓' : '○' }} 知识
                    </span>
                    <span class="geo-dashboard__brand-card-step" :class="brandCompletenessStep(project, 'analysis')">
                      {{ brandCompletenessStep(project, 'analysis') === 'done' ? '✓' : '○' }} 分析
                    </span>
                    <span class="geo-dashboard__brand-card-step" :class="brandCompletenessStep(project, 'verification')">
                      {{ brandCompletenessStep(project, 'verification') === 'done' ? '✓' : '○' }} 验真
                    </span>
                  </div>
                </div>

                <div class="geo-dashboard__brand-card-stats">
                  <div class="geo-dashboard__brand-card-stat">
                    <span class="geo-dashboard__brand-card-stat-value">{{ project.entityCount ?? 0 }}</span>
                    <span class="geo-dashboard__brand-card-stat-label">实体</span>
                  </div>
                  <div class="geo-dashboard__brand-card-stat">
                    <span class="geo-dashboard__brand-card-stat-value">{{ project.versionCount ?? 0 }}</span>
                    <span class="geo-dashboard__brand-card-stat-label">版本</span>
                  </div>
                  <div class="geo-dashboard__brand-card-stat">
                    <span class="geo-dashboard__brand-card-stat-value">{{ getLastAssessment(project) }}</span>
                    <span class="geo-dashboard__brand-card-stat-label">最后评估</span>
                  </div>
                </div>
              </div>
            </div>
                  </div>
        </section>
      </div>
    </div>

    <!-- ===== Brand Create Modal (P2-2.1) ===== -->
    <BrandCreateModal
      v-if="showCreateModal"
      :project="editingProject"
      @created="onBrandCreated"
      @cancelled="onModalCancelled"
    />

    <!-- ===== Delete Confirmation Modal (P0-T001) ===== -->
    <div v-if="showDeleteModal" class="geo-dashboard__modal-overlay" @click.self="showDeleteModal = false">
      <div class="geo-dashboard__delete-modal">
        <h3 class="geo-dashboard__delete-modal-title">确认删除品牌</h3>
        <p class="geo-dashboard__delete-modal-desc">
          确定要删除 <strong>{{ deletingProject?.name }}</strong> 吗？此操作不可撤销。
        </p>
        <div class="geo-dashboard__delete-modal-actions">
          <button class="geo-dashboard__btn" @click="showDeleteModal = false">取消</button>
          <button
            class="geo-dashboard__btn geo-dashboard__btn--danger"
            :disabled="deleting"
            @click="doDeleteBrand"
          >
            {{ deleting ? '删除中...' : '确认删除' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useGeoProjectStore } from '../stores/useGeoProjectStore'
import { useWorkflowStore } from '../stores/useWorkflowStore'
import BrandCreateModal from '../components/BrandCreateModal.vue'

definePageMeta({
  title: 'GEO Dashboard',
})

const router = useRouter()
const route = useRoute()
const projectStore = useGeoProjectStore()
const workflowStore = useWorkflowStore()

// ── State ──
const loading = ref(false)
const error = ref<string | null>(null)
const showCreateModal = ref(false)
const showDeleteModal = ref(false)
const deleting = ref(false)
const deletingProject = ref<any>(null)
const editingProject = ref<{
  id: string
  name: string
  website?: string
  industry?: string
  description?: string
} | null>(null)

// ── Dashboard Data ──
const projects = ref<any[]>([])

// ── KPI Computed (P2-T002-P0) ──

const analyzedCount = computed(() => {
  return projects.value.filter((p: any) => p.config?.adi > 0 || p.discoveryReportId).length
})

const pendingCount = computed(() => projects.value.length - analyzedCount.value)

const avgAdi = computed(() => {
  const analyzed = projects.value.filter((p: any) => p.config?.adi > 0)
  if (analyzed.length === 0) return 0
  const total = analyzed.reduce((sum: number, p: any) => sum + (p.config?.adi || 0), 0)
  return Math.round(total / analyzed.length)
})

// ── Brand Card Helpers (P2-T002-P1) ──

function brandCompleteness(project: any): number {
  // Identity: 只计算弹窗可填的字段 + 已分析状态
  // name(25) + website(25) + industry(25) + description(25) = 100
  let identityScore = 0
  if (project.name) identityScore += 25
  if (project.website || project.config?.website) identityScore += 25
  if (project.industry) identityScore += 25
  if (project.config?.description || project.brandSetting?.description) identityScore += 25
  const identityMax = 100

  // Knowledge: entity count(50) + version count(50) = 100（预留，后续知识导入后生效）
  let knowledgeScore = 0
  if ((project.entityCount ?? 0) > 0) knowledgeScore += Math.min(50, (project.entityCount ?? 0) * 5)
  if ((project.versionCount ?? 0) > 0) knowledgeScore += Math.min(50, (project.versionCount ?? 0) * 15)
  const knowledgeMax = 100

  // Analysis: adi分数已生成(80) + 已验真(20) = 100
  let analysisScore = 0
  const configAdi = project.config?.adi
  if (project.discoveryReport || project.hasDiscovery || configAdi != null) analysisScore += 80
  if (project.verificationReport || project.hasVerification) analysisScore += 20
  const analysisMax = 100

  const totalMax = identityMax + knowledgeMax + analysisMax
  const totalScore = identityScore + knowledgeScore + analysisScore
  return totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0
}

function completenessRingColor(score: number): string {
  if (score >= 80) return 'geo-dashboard__ring--high'
  if (score >= 50) return 'geo-dashboard__ring--medium'
  return 'geo-dashboard__ring--low'
}

function brandCompletenessStep(project: any, step: string): string {
  switch (step) {
    case 'identity':
      return (project.name && (project.website || project.config?.website) && project.industry) ? 'done' : 'todo';
    case 'knowledge':
      return (project.entityCount ?? 0) > 0 ? 'done' : 'todo';
    case 'analysis':
      return (project.config?.adi != null) ? 'done' : 'todo';
    case 'verification':
      return (project.verificationReport || project.hasVerification) ? 'done' : 'todo';
    default:
      return 'todo';
  }
}

function getLastAssessment(project: any): string {
  if (!project.updatedAt) return '—'
  const d = new Date(project.updatedAt)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (days === 0) return '今天'
  if (days === 1) return '昨天'
  if (days < 7) return `${days}天前`
  return formatDate(project.updatedAt)
}

function statusLabel(status: string): string {
  switch (status) {
    case 'active': return '进行中'
    case 'monitoring': return '监测中'
    case 'completed': return '已完成'
    default: return '草稿'
  }
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ── Lifecycle ──
onMounted(async () => {
  await loadData()
})

// ── Auto-refresh on route enter (P0-T002) ──
watch(() => route.path, async (newPath, oldPath) => {
  // Refresh data whenever user navigates back to dashboard
  if (newPath === '/workspace/geo/dashboard' && oldPath !== newPath) {
    await loadData()
  }
})

// ── Data Loading ──
async function loadData() {
  loading.value = true
  error.value = null

  try {
    await projectStore.listProjects()
    projects.value = [...projectStore.projects]
  } catch (err: any) {
    error.value = err?.message || '加载数据失败'
  } finally {
    loading.value = false
  }
}

// ── Actions ──

function handleEditBrand() {
  if (projects.value.length > 0) {
    // Edit mode — pass the first project
    const p = projects.value[0]
    editingProject.value = {
      id: p.id,
      name: p.name,
      website: p.config?.website || '',
      industry: p.industry || '',
      description: p.config?.description || '',
    }
  }
  showCreateModal.value = true
}

function handleGEOAssessment() {
  if (projects.value.length === 0) {
    showCreateModal.value = true
    return
  }
  const targetProject = projects.value[0]
  router.push(`/workspace/geo/brand/${targetProject.id}`)
}

function handleAddKnowledge() {
  // 留待后续 Phase — 跳转到工作台
  router.push('/workspace/geo/knowledge')
}

function handleFirstAnalysis() {
  if (projects.value.length === 0) {
    showCreateModal.value = true
    return
  }
  const targetProject = projects.value[0]
  router.push(`/workspace/geo/brand/${targetProject.id}`)
}

async function onBrandCreated(projectId: string) {
  showCreateModal.value = false
  editingProject.value = null
  await loadData()
  // Navigate to Brand Overview page
  router.push(`/workspace/geo/brand/${projectId}`)
}

function onModalCancelled() {
  showCreateModal.value = false
  editingProject.value = null
}

// ── Delete Brand (P0-T001) ──

function confirmDeleteBrand(project: any) {
  deletingProject.value = project
  showDeleteModal.value = true
}

async function doDeleteBrand() {
  if (!deletingProject.value) return
  deleting.value = true
  try {
    await projectStore.deleteBrand(deletingProject.value.id)
    showDeleteModal.value = false
    deletingProject.value = null
    await loadData()
  } catch (err: any) {
    console.error('Delete failed:', err)
  } finally {
    deleting.value = false
  }
}

function continueProject(projectId: string) {
  // Navigate to Brand Overview page
  router.push(`/workspace/geo/brand/${projectId}`)
}
</script>

<style scoped>
.geo-dashboard {
  max-width: 1100px;
  margin: 0 auto;
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  padding: 0 0 48px;
}

/* ===== Header ===== */
.geo-dashboard__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 32px;
}

.geo-dashboard__header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.geo-dashboard__title {
  font-size: 28px;
  font-weight: 700;
  color: #111827;
  margin: 0 0 4px;
  letter-spacing: -0.03em;
}

.geo-dashboard__subtitle {
  font-size: 15px;
  color: #6b7280;
  margin: 0;
}

.geo-dashboard__back-link {
  font-size: 14px;
  color: #3b82f6;
  text-decoration: none;
  white-space: nowrap;
  padding: 6px 12px;
  border-radius: 6px;
  transition: background-color 0.15s;
}

.geo-dashboard__back-link:hover {
  background-color: #eff6ff;
}

/* ===== Section ===== */
.geo-dashboard__section {
  margin-bottom: 32px;
}

.geo-dashboard__kpi-bar {
  display: flex;
  align-items: center;
  gap: 0;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 12px 0;
}

.geo-dashboard__kpi-item {
  flex: 1;
  text-align: center;
  font-size: 13px;
  color: #6b7280;
  line-height: 1.5;
}

.geo-dashboard__kpi-item strong {
  display: block;
  font-size: 22px;
  font-weight: 700;
  color: #111827;
  line-height: 1.3;
}

.geo-dashboard__kpi-divider {
  width: 1px;
  height: 36px;
  background: #e5e7eb;
  flex-shrink: 0;
}

.geo-dashboard__create-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 12px 20px;
  background: #3b82f6;
  color: #fff;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s;
  font-family: inherit;
}

.geo-dashboard__create-btn:hover {
  background: #2563eb;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.25);
}

.geo-dashboard__section-title {
  font-size: 18px;
  font-weight: 600;
  color: #111827;
  margin: 0 0 16px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.geo-dashboard__section-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 10px;
  background: #e5e7eb;
  color: #6b7280;
  font-size: 11px;
  font-weight: 600;
}

/* ===== Loading / Error ===== */
.geo-dashboard__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 48px;
  color: #6b7280;
}

.geo-dashboard__spinner {
  width: 24px;
  height: 24px;
  border: 3px solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.geo-dashboard__error {
  text-align: center;
  padding: 32px;
  color: #dc2626;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 10px;
  margin-bottom: 24px;
}

/* ===== Empty State (P0-T001) ===== */
.geo-dashboard__empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 420px;
  padding: 48px 24px;
}

.geo-dashboard__empty-state-content {
  text-align: center;
  max-width: 440px;
}

.geo-dashboard__empty-state-icon {
  margin-bottom: 24px;
  display: inline-flex;
}

.geo-dashboard__empty-state-title {
  font-size: 24px;
  font-weight: 700;
  color: #111827;
  margin: 0 0 4px;
}

.geo-dashboard__empty-state-desc {
  font-size: 15px;
  color: #6b7280;
  margin: 0 0 28px;
  line-height: 1.5;
}

.geo-dashboard__empty-state-steps {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 32px;
  text-align: left;
}

.geo-dashboard__empty-state-step {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  transition: border-color 0.15s;
}

.geo-dashboard__empty-state-step:hover {
  border-color: #bfdbfe;
}

.geo-dashboard__empty-state-step-num {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: #3b82f6;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  flex-shrink: 0;
}

.geo-dashboard__empty-state-step-content {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.geo-dashboard__empty-state-step-content strong {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}

.geo-dashboard__empty-state-step-content span {
  font-size: 13px;
  color: #6b7280;
}

.geo-dashboard__empty-state-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 28px;
  background: #3b82f6;
  color: #fff;
  border: none;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  font-family: inherit;
}

.geo-dashboard__empty-state-btn:hover {
  background: #2563eb;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.25);
}

/* ===== Brand Profile (P2-2.2) ===== */
.geo-dashboard__brand-profile {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 24px;
}

.geo-dashboard__brand-profile-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.geo-dashboard__brand-completeness {
  display: flex;
  align-items: center;
  gap: 12px;
}

.geo-dashboard__completeness-ring {
  color: #3b82f6;
  flex-shrink: 0;
}

.geo-dashboard__completeness-ring-fill {
  transition: stroke-dashoffset 0.6s ease;
}

.geo-dashboard__completeness-text {
  font-size: 11px;
  font-weight: 700;
  fill: #111827;
}

.geo-dashboard__completeness-meta {
  display: flex;
  flex-direction: column;
}

.geo-dashboard__completeness-label {
  font-size: 11px;
  color: #9ca3af;
  font-weight: 500;
}

.geo-dashboard__completeness-value {
  font-size: 18px;
  font-weight: 700;
  color: #111827;
}

.geo-dashboard__profile-dimensions {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.geo-dashboard__profile-dimension {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.geo-dashboard__dimension-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.geo-dashboard__dimension-label {
  font-size: 13px;
  font-weight: 500;
  color: #374151;
}

.geo-dashboard__dimension-score {
  font-size: 13px;
  font-weight: 600;
  color: #6b7280;
}

.geo-dashboard__dimension-bar {
  height: 6px;
  background: #e5e7eb;
  border-radius: 3px;
  overflow: hidden;
}

.geo-dashboard__dimension-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.5s ease;
}

.geo-dashboard__dimension-fill--high {
  background: #22c55e;
}

.geo-dashboard__dimension-fill--medium {
  background: #f59e0b;
}

.geo-dashboard__dimension-fill--low {
  background: #ef4444;
}

/* ===== Quick Actions (P2-2.3) ===== */
.geo-dashboard__quick-actions {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.geo-dashboard__action-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 20px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.15s ease-out;
  text-align: left;
  font-family: inherit;
}

.geo-dashboard__action-card:hover {
  border-color: #bfdbfe;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.08);
  transform: translateY(-1px);
}

.geo-dashboard__action-icon {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  flex-shrink: 0;
}

.geo-dashboard__action-icon--brand {
  background: #eff6ff;
  color: #3b82f6;
}

.geo-dashboard__action-icon--geo {
  background: #f0fdf4;
  color: #22c55e;
}

.geo-dashboard__action-icon--knowledge {
  background: #fffbeb;
  color: #f59e0b;
}

.geo-dashboard__action-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.geo-dashboard__action-text strong {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}

.geo-dashboard__action-text small {
  font-size: 12px;
  color: #6b7280;
}

/* ===== Brand Cards (P2-2.4) ===== */
.geo-dashboard__brand-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}

.geo-dashboard__brand-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 20px;
  cursor: pointer;
  transition: all 0.15s ease-out;
}

.geo-dashboard__brand-card:hover {
  border-color: #bfdbfe;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.08);
  transform: translateY(-1px);
}

.geo-dashboard__brand-card-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.geo-dashboard__brand-card-avatar {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: linear-gradient(135deg, #3b82f6, #6366f1);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 700;
  flex-shrink: 0;
}

.geo-dashboard__brand-card-info {
  flex: 1;
  min-width: 0;
}

.geo-dashboard__brand-card-name {
  font-size: 15px;
  font-weight: 600;
  color: #111827;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.geo-dashboard__brand-card-industry {
  font-size: 12px;
  color: #6b7280;
}

.geo-dashboard__brand-card-website {
  font-size: 11px;
  color: #3b82f6;
  text-decoration: none;
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 180px;
  transition: color 0.15s;
}

.geo-dashboard__brand-card-website:hover {
  color: #2563eb;
  text-decoration: underline;
}

.geo-dashboard__brand-card-status {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;
}

.geo-dashboard__brand-card-status--draft {
  background: #f3f4f6;
  color: #6b7280;
}

.geo-dashboard__brand-card-status--active {
  background: #dcfce7;
  color: #16a34a;
}

.geo-dashboard__brand-card-status--monitoring {
  background: #dbeafe;
  color: #2563eb;
}

.geo-dashboard__brand-card-status--completed {
  background: #f0fdf4;
  color: #15803d;
}

.geo-dashboard__brand-card-body {
  display: flex;
  align-items: center;
  gap: 20px;
}

.geo-dashboard__brand-card-completeness {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.geo-dashboard__brand-card-ring {
  flex-shrink: 0;
}

.geo-dashboard__brand-card-ring-text {
  font-size: 8px;
  font-weight: 700;
  fill: #111827;
}

.geo-dashboard__ring--high {
  color: #22c55e;
}

.geo-dashboard__ring--medium {
  color: #f59e0b;
}

.geo-dashboard__ring--low {
  color: #ef4444;
}

.geo-dashboard__brand-card-meta {
  display: flex;
  flex-direction: column;
}

.geo-dashboard__brand-card-meta-label {
  font-size: 10px;
  color: #9ca3af;
  font-weight: 500;
}

.geo-dashboard__brand-card-meta-value {
  font-size: 14px;
  font-weight: 700;
  color: #111827;
}

.geo-dashboard__brand-card-steps {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin-top: 2px;
}

.geo-dashboard__brand-card-step {
  font-size: 11px;
  color: #9ca3af;
  font-weight: 500;
  line-height: 1.4;
}

.geo-dashboard__brand-card-step--done {
  color: #059669;
}

.geo-dashboard__brand-card-stats {
  display: flex;
  gap: 16px;
  flex: 1;
}

.geo-dashboard__brand-card-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
}

.geo-dashboard__brand-card-stat-value {
  font-size: 14px;
  font-weight: 700;
  color: #111827;
}

.geo-dashboard__brand-card-stat-label {
  font-size: 10px;
  color: #9ca3af;
  font-weight: 500;
}

/* ===== Common Button ===== */
.geo-dashboard__btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  transition: all 0.15s;
  font-size: 14px;
  font-weight: 500;
  font-family: inherit;
}

.geo-dashboard__btn:hover:not(:disabled) {
  border-color: #3b82f6;
  box-shadow: 0 1px 4px rgba(59, 130, 246, 0.1);
}

.geo-dashboard__btn--primary {
  background: #3b82f6;
  color: #fff;
  border-color: #3b82f6;
}

.geo-dashboard__btn--primary:hover:not(:disabled) {
  background: #2563eb;
}

/* ===== Danger Button (P0-T001) ===== */
.geo-dashboard__btn--danger {
  background: #ef4444;
  color: #fff;
  border-color: #ef4444;
}

.geo-dashboard__btn--danger:hover:not(:disabled) {
  background: #dc2626;
}

.geo-dashboard__btn--danger:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* ===== Brand Card Actions (P0-T001) ===== */
.geo-dashboard__brand-card-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.geo-dashboard__brand-card-delete {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #9ca3af;
  cursor: pointer;
  transition: all 0.15s;
  opacity: 0;
}

.geo-dashboard__brand-card:hover .geo-dashboard__brand-card-delete {
  opacity: 1;
}

.geo-dashboard__brand-card-delete:hover {
  background: #fef2f2;
  color: #ef4444;
}

/* ===== Delete Modal (P0-T001) ===== */
.geo-dashboard__modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.geo-dashboard__delete-modal {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  width: 400px;
  max-width: 90vw;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
}

.geo-dashboard__delete-modal-title {
  font-size: 18px;
  font-weight: 700;
  color: #111827;
  margin: 0 0 8px;
}

.geo-dashboard__delete-modal-desc {
  font-size: 14px;
  color: #6b7280;
  margin: 0 0 24px;
  line-height: 1.5;
}

.geo-dashboard__delete-modal-desc strong {
  color: #111827;
}

.geo-dashboard__delete-modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

/* ===== Responsive ===== */
@media (max-width: 768px) {
  .geo-dashboard__header {
    flex-direction: column;
    gap: 12px;
  }

  .geo-dashboard__quick-actions {
    grid-template-columns: 1fr;
  }

  .geo-dashboard__brand-cards {
    grid-template-columns: 1fr;
  }

  .geo-dashboard__brand-profile-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
}
</style>
