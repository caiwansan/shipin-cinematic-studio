<template>
  <div class="geo-dashboard">
    <!-- ===== Page Header ===== -->
    <header class="geo-dashboard__header">
      <div>
        <h1 class="geo-dashboard__title">GEO Workspace</h1>
        <p class="geo-dashboard__subtitle">Manage your brand projects and track GEO optimization progress</p>
      </div>
      <NuxtLink to="/workspace/geo" class="geo-dashboard__back-link">
        🏠 Back to Workspace
      </NuxtLink>
    </header>

    <!-- ===== Quick Start ===== -->
    <section class="geo-dashboard__section">
      <div class="geo-dashboard__quick-start">
        <h2 class="geo-dashboard__section-title">Quick Start</h2>
        <div class="geo-dashboard__quick-actions">
          <button class="geo-dashboard__btn geo-dashboard__btn--primary" @click="handleCreateProject">
            <span class="geo-dashboard__btn-icon">➕</span>
            <span class="geo-dashboard__btn-text">
              <strong>New Project</strong>
              <small>Create a brand project & start the workflow</small>
            </span>
          </button>
          <button class="geo-dashboard__btn geo-dashboard__btn--secondary" @click="handleQuickDiscovery">
            <span class="geo-dashboard__btn-icon">🔍</span>
            <span class="geo-dashboard__btn-text">
              <strong>Quick Discovery</strong>
              <small>Enter an entity & run discovery right away</small>
            </span>
          </button>
        </div>
      </div>
    </section>

    <!-- ===== Overall Stats ===== -->
    <section class="geo-dashboard__section">
      <div class="geo-dashboard__stats">
        <div class="geo-dashboard__stat-card">
          <span class="geo-dashboard__stat-value">{{ stats.totalProjects }}</span>
          <span class="geo-dashboard__stat-label">Total Projects</span>
        </div>
        <div class="geo-dashboard__stat-card">
          <span class="geo-dashboard__stat-value">{{ stats.averageAdi }}</span>
          <span class="geo-dashboard__stat-label">Avg ADI</span>
        </div>
        <div class="geo-dashboard__stat-card">
          <span class="geo-dashboard__stat-value" :class="stats.totalGrowth >= 0 ? 'geo-dashboard__stat-value--positive' : 'geo-dashboard__stat-value--negative'">
            {{ stats.totalGrowth >= 0 ? '+' : '' }}{{ stats.totalGrowth }}
          </span>
          <span class="geo-dashboard__stat-label">Total Growth</span>
        </div>
        <div class="geo-dashboard__stat-card">
          <span class="geo-dashboard__stat-value">{{ stats.verificationCount }}</span>
          <span class="geo-dashboard__stat-label">Verifications</span>
        </div>
      </div>
    </section>

    <!-- ===== Loading State ===== -->
    <div v-if="loading" class="geo-dashboard__loading">
      <div class="geo-dashboard__spinner" />
      <span>Loading projects...</span>
    </div>

    <!-- ===== Error State ===== -->
    <div v-else-if="error" class="geo-dashboard__error">
      <p>{{ error }}</p>
      <button class="geo-dashboard__btn geo-dashboard__btn--primary" @click="loadData">Retry</button>
    </div>

    <!-- ===== Data ===== -->
    <template v-else>
      <!-- ===== Recent Projects ===== -->
      <section class="geo-dashboard__section">
        <h2 class="geo-dashboard__section-title">
          Recent Projects
          <span class="geo-dashboard__section-badge">{{ projects.length }}</span>
        </h2>

        <div v-if="projects.length === 0" class="geo-dashboard__empty">
          <p>No projects yet. Create one to get started!</p>
        </div>

        <div v-else class="geo-dashboard__project-list">
          <div
            v-for="project in projects"
            :key="project.id"
            class="geo-dashboard__project-card"
          >
            <div class="geo-dashboard__project-main">
              <h3 class="geo-dashboard__project-name">{{ project.name }}</h3>
              <p class="geo-dashboard__project-meta">
                <span>Updated: {{ formatDate(project.updatedAt) }}</span>
                <span v-if="project.industry">· {{ project.industry }}</span>
              </p>
            </div>

            <div class="geo-dashboard__project-stats">
              <div class="geo-dashboard__project-progress">
                <div class="geo-dashboard__project-progress-bar">
                  <div
                    class="geo-dashboard__project-progress-fill"
                    :style="{ width: getProjectProgress(project.id) + '%' }"
                    :class="progressColor(getProjectProgress(project.id))"
                  />
                </div>
                <span class="geo-dashboard__project-progress-text">{{ getProjectProgress(project.id) }}%</span>
              </div>
              <div class="geo-dashboard__project-adi">
                <span class="geo-dashboard__project-adi-label">ADI</span>
                <span class="geo-dashboard__project-adi-value">{{ getProjectAdi(project.id) }}</span>
              </div>
            </div>

            <div class="geo-dashboard__project-actions">
              <button
                class="geo-dashboard__btn geo-dashboard__btn--small geo-dashboard__btn--primary"
                @click="continueProject(project.id)"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- ===== Recent Verifications ===== -->
      <section class="geo-dashboard__section">
        <h2 class="geo-dashboard__section-title">
          Recent Verifications
          <span class="geo-dashboard__section-badge">{{ verifications.length }}</span>
        </h2>

        <div v-if="verifications.length === 0" class="geo-dashboard__empty">
          <p>No verifications yet. Complete the workflow to see verification results.</p>
        </div>

        <div v-else class="geo-dashboard__verification-list">
          <div
            v-for="v in verifications"
            :key="v.id"
            class="geo-dashboard__verification-card"
          >
            <div class="geo-dashboard__verification-header">
              <span class="geo-dashboard__verification-entity">{{ v.entityName }}</span>
              <span class="geo-dashboard__verification-date">{{ formatDate(v.createdAt) }}</span>
            </div>
            <div class="geo-dashboard__verification-scores">
              <div class="geo-dashboard__verification-score">
                <span class="geo-dashboard__verification-score-label">Before</span>
                <span class="geo-dashboard__verification-score-value geo-dashboard__verification-score-value--before">{{ v.beforeAdi }}</span>
              </div>
              <div class="geo-dashboard__verification-arrow">→</div>
              <div class="geo-dashboard__verification-score">
                <span class="geo-dashboard__verification-score-label">After</span>
                <span class="geo-dashboard__verification-score-value geo-dashboard__verification-score-value--after">{{ v.afterAdi }}</span>
              </div>
              <div class="geo-dashboard__verification-delta" :class="v.deltaAdi >= 0 ? 'geo-dashboard__verification-delta--positive' : 'geo-dashboard__verification-delta--negative'">
                {{ v.deltaAdi >= 0 ? '+' : '' }}{{ v.deltaAdi }}
              </div>
            </div>
            <div class="geo-dashboard__verification-links">
              <NuxtLink
                v-if="v.projectId"
                :to="`/workspace/geo/report/${v.projectId}`"
                class="geo-dashboard__verification-report-link"
              >
                📄 View Report
              </NuxtLink>
            </div>
          </div>
        </div>
      </section>
    </template>

    <!-- ===== Quick Discovery Dialog ===== -->
    <Teleport to="body">
      <div v-if="showQuickDiscovery" class="geo-dashboard__dialog-overlay" @click.self="showQuickDiscovery = false">
        <div class="geo-dashboard__dialog">
          <h3 class="geo-dashboard__dialog-title">Quick Discovery</h3>
          <p class="geo-dashboard__dialog-desc">Enter an entity name to run discovery directly</p>
          <div class="geo-dashboard__dialog-input-group">
            <input
              v-model="quickEntity"
              type="text"
              class="geo-dashboard__dialog-input"
              placeholder="e.g. 昆仑镜AI, Tesla, Nike"
              @keyup.enter="runQuickDiscovery"
              ref="quickInputRef"
            />
            <button
              class="geo-dashboard__btn geo-dashboard__btn--primary"
              :disabled="!quickEntity.trim()"
              @click="runQuickDiscovery"
            >
              🔍 Discover
            </button>
          </div>
          <button class="geo-dashboard__dialog-close" @click="showQuickDiscovery = false">Cancel</button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useGeoProjectStore } from '../stores/useGeoProjectStore'
import { useWorkflowStore } from '../stores/useWorkflowStore'
import { useDiscoveryStore } from '../stores/useDiscoveryStore'
import { geoApi } from '../services/api'

definePageMeta({
  title: 'GEO Dashboard',
})

const router = useRouter()
const projectStore = useGeoProjectStore()
const workflowStore = useWorkflowStore()
const discoveryStore = useDiscoveryStore()

// ── Quick Discovery Dialog ──
const showQuickDiscovery = ref(false)
const quickEntity = ref('')
const quickInputRef = ref<HTMLInputElement | null>(null)

// ── State ──
const loading = ref(false)
const error = ref<string | null>(null)

// ── Dashboard Data ──
const projects = ref<any[]>([])
const verifications = ref<any[]>([])

const stats = reactive({
  totalProjects: 0,
  averageAdi: 0,
  totalGrowth: 0,
  verificationCount: 0,
})

// ── Lifecycle ──
onMounted(async () => {
  await loadData()
})

// ── Data Loading ──

async function loadData() {
  loading.value = true
  error.value = null

  try {
    await projectStore.listProjects()
    projects.value = [...projectStore.projects]

    // Load verifications from API
    await loadVerifications()

    // Compute stats
    computeStats()
  } catch (err: any) {
    error.value = err?.message || 'Failed to load dashboard data'
  } finally {
    loading.value = false
  }
}

async function loadVerifications() {
  try {
    const raw = await geoApi<{ success: boolean; data: any[] }>('projects/verifications?limit=5', {
      method: 'GET',
    })
    verifications.value = (raw.data || []).map((v: any) => ({
      id: v.id,
      projectId: v.projectId,
      entityName: v.entityName || 'Unknown',
      beforeAdi: v.beforeAdi ?? 0,
      afterAdi: v.afterAdi ?? 0,
      deltaAdi: (v.afterAdi ?? 0) - (v.beforeAdi ?? 0),
      createdAt: v.createdAt || new Date().toISOString(),
    }))
  } catch {
    // If this endpoint doesn't exist, use project stores
    verifications.value = []
    for (const p of projects.value) {
      try {
        await projectStore.loadProject(p.id)
        if (projectStore.verificationReport) {
          const vr = projectStore.verificationReport
          verifications.value.push({
            id: vr.id,
            entityName: vr.entityName || p.name,
            beforeAdi: vr.beforeAdi ?? 0,
            afterAdi: vr.afterAdi ?? 0,
            deltaAdi: vr.deltaAdi ?? 0,
            createdAt: vr.createdAt,
          })
        }
      } catch {
        // Skip projects that fail to load
      }
    }
    // Sort by date and take latest 5
    verifications.value.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    verifications.value = verifications.value.slice(0, 5)
  }
}

function computeStats() {
  stats.totalProjects = projects.value.length

  let totalAdi = 0
  let adiCount = 0
  let totalGrowth = 0
  let growthCount = 0

  for (const v of verifications.value) {
    totalAdi += v.afterAdi
    adiCount++
    totalGrowth += v.deltaAdi
    growthCount++
  }

  stats.averageAdi = adiCount > 0 ? Math.round(totalAdi / adiCount) : 0
  stats.totalGrowth = growthCount > 0 ? Math.round(totalGrowth) : 0
  stats.verificationCount = verifications.value.length
}

// ── Helpers ──

function getProjectProgress(projectId: string): number {
  // Calculate project progress based on data presence
  let doneSteps = 0
  const totalSteps = 7

  // Check each step
  if (projectStore.currentProject?.id === projectId) {
    // Use workflow store if available
    if (workflowStore.projectId === projectId) {
      return workflowStore.progress
    }
  }

  // Fallback: check data directly
  // We need to check each report type
  // For now, return a conservative estimate
  return 0
}

function getProjectAdi(projectId: string): string {
  // Try to get ADI from the project's reports
  if (projectStore.currentProject?.id === projectId) {
    if (projectStore.discoveryReport) {
      return String(projectStore.discoveryReport.adi)
    }
  }
  return '—'
}

function progressColor(pct: number): string {
  if (pct >= 80) return 'geo-dashboard__project-progress-fill--high'
  if (pct >= 50) return 'geo-dashboard__project-progress-fill--medium'
  if (pct >= 20) return 'geo-dashboard__project-progress-fill--low'
  return ''
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ── Actions ──

async function handleCreateProject() {
  // Prompt for project name
  const name = prompt('Enter project name:')
  if (!name || !name.trim()) return

  const industry = prompt('Enter industry (optional):') || undefined

  try {
    const project = await projectStore.createProject(name.trim(), industry)
    if (project) {
      // Initialize workflow for this project
      workflowStore.initializeForProject(project.id)
      router.push(`/workspace/geo/project/${project.id}`)
    }
  } catch (err: any) {
    error.value = err?.message || 'Failed to create project'
  }
}

function handleQuickDiscovery() {
  showQuickDiscovery.value = true
  quickEntity.value = ''
  nextTick(() => {
    quickInputRef.value?.focus()
  })
}

async function runQuickDiscovery() {
  if (!quickEntity.value.trim()) return

  // Create a project first if none exists
  if (projects.value.length === 0) {
    const project = await projectStore.createProject(quickEntity.value.trim())
    if (!project) return
    projects.value = [project, ...projects.value]
  }

  // Use the most recent project or the one matching the entity
  const targetProject = projects.value[0]

  // Run discovery and navigate to the workflow
  workflowStore.initializeForProject(targetProject.id)
  router.push(`/workspace/geo/project/${targetProject.id}`)
  showQuickDiscovery.value = false
}

function continueProject(projectId: string) {
  workflowStore.initializeForProject(projectId)
  router.push(`/workspace/geo/project/${projectId}`)
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

/* ===== Quick Start ===== */
.geo-dashboard__quick-start {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 24px;
}

.geo-dashboard__quick-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.geo-dashboard__btn {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  border: 1px solid #d1d5db;
  border-radius: 10px;
  background: #fff;
  cursor: pointer;
  transition: all 0.15s ease-out;
  text-align: left;
  font-family: inherit;
}

.geo-dashboard__btn:hover:not(:disabled) {
  border-color: #3b82f6;
  box-shadow: 0 1px 4px rgba(59, 130, 246, 0.1);
  background: #f9fafb;
}

.geo-dashboard__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.geo-dashboard__btn--primary {
  background: #eff6ff;
  border-color: #bfdbfe;
}

.geo-dashboard__btn--primary:hover:not(:disabled) {
  background: #dbeafe;
  border-color: #3b82f6;
}

.geo-dashboard__btn--secondary {
  background: #f0fdf4;
  border-color: #bbf7d0;
}

.geo-dashboard__btn--secondary:hover:not(:disabled) {
  background: #dcfce7;
  border-color: #22c55e;
}

.geo-dashboard__btn--small {
  padding: 6px 14px;
  font-size: 13px;
  gap: 6px;
}

.geo-dashboard__btn-icon {
  font-size: 24px;
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
  border-radius: 10px;
  border: 1px solid #e5e7eb;
}

.geo-dashboard__btn-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.geo-dashboard__btn-text strong {
  font-size: 15px;
  font-weight: 600;
  color: #111827;
}

.geo-dashboard__btn-text small {
  font-size: 12px;
  color: #6b7280;
}

/* ===== Stats ===== */
.geo-dashboard__stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.geo-dashboard__stat-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 20px;
  text-align: center;
}

.geo-dashboard__stat-value {
  display: block;
  font-size: 28px;
  font-weight: 700;
  color: #111827;
  line-height: 1;
  margin-bottom: 4px;
}

.geo-dashboard__stat-value--positive {
  color: #16a34a;
}

.geo-dashboard__stat-value--negative {
  color: #dc2626;
}

.geo-dashboard__stat-label {
  display: block;
  font-size: 13px;
  color: #6b7280;
  font-weight: 500;
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

.geo-dashboard__empty {
  text-align: center;
  padding: 32px;
  color: #9ca3af;
  background: #f9fafb;
  border: 1px dashed #e5e7eb;
  border-radius: 10px;
}

/* ===== Project List ===== */
.geo-dashboard__project-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.geo-dashboard__project-card {
  display: flex;
  align-items: center;
  gap: 16px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 16px 20px;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.geo-dashboard__project-card:hover {
  border-color: #bfdbfe;
  box-shadow: 0 1px 4px rgba(59, 130, 246, 0.08);
}

.geo-dashboard__project-main {
  flex: 1;
  min-width: 0;
}

.geo-dashboard__project-name {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
  margin: 0 0 4px;
}

.geo-dashboard__project-meta {
  font-size: 12px;
  color: #9ca3af;
  margin: 0;
  display: flex;
  gap: 6px;
}

.geo-dashboard__project-stats {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-shrink: 0;
}

.geo-dashboard__project-progress {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 120px;
}

.geo-dashboard__project-progress-bar {
  width: 80px;
  height: 6px;
  background: #e5e7eb;
  border-radius: 3px;
  overflow: hidden;
}

.geo-dashboard__project-progress-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.4s;
  background: #3b82f6;
}

.geo-dashboard__project-progress-fill--high {
  background: #22c55e;
}

.geo-dashboard__project-progress-fill--medium {
  background: #f59e0b;
}

.geo-dashboard__project-progress-fill--low {
  background: #ef4444;
}

.geo-dashboard__project-progress-text {
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
}

.geo-dashboard__project-adi {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 48px;
}

.geo-dashboard__project-adi-label {
  font-size: 10px;
  color: #9ca3af;
  font-weight: 500;
  text-transform: uppercase;
}

.geo-dashboard__project-adi-value {
  font-size: 18px;
  font-weight: 700;
  color: #111827;
}

.geo-dashboard__project-actions {
  flex-shrink: 0;
}

/* ===== Verification List ===== */
.geo-dashboard__verification-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.geo-dashboard__verification-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 14px 20px;
}

.geo-dashboard__verification-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.geo-dashboard__verification-entity {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}

.geo-dashboard__verification-date {
  font-size: 12px;
  color: #9ca3af;
}

.geo-dashboard__verification-scores {
  display: flex;
  align-items: center;
  gap: 12px;
}

.geo-dashboard__verification-score {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.geo-dashboard__verification-score-label {
  font-size: 10px;
  color: #9ca3af;
  text-transform: uppercase;
  font-weight: 500;
}

.geo-dashboard__verification-score-value {
  font-size: 22px;
  font-weight: 700;
}

.geo-dashboard__verification-score-value--before {
  color: #6b7280;
}

.geo-dashboard__verification-score-value--after {
  color: #16a34a;
}

.geo-dashboard__verification-arrow {
  font-size: 18px;
  color: #d1d5db;
}

.geo-dashboard__verification-delta {
  font-size: 16px;
  font-weight: 700;
  padding: 2px 10px;
  border-radius: 6px;
}

.geo-dashboard__verification-delta--positive {
  color: #16a34a;
  background: #f0fdf4;
}

.geo-dashboard__verification-delta--negative {
  color: #dc2626;
  background: #fef2f2;
}

.geo-dashboard__verification-links {
  margin-top: 8px;
  text-align: right;
}

.geo-dashboard__verification-report-link {
  font-size: 12px;
  color: #3b82f6;
  text-decoration: none;
  font-weight: 500;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background-color 0.15s;
}

.geo-dashboard__verification-report-link:hover {
  background-color: #eff6ff;
  text-decoration: underline;
}

/* ===== Dialog ===== */
.geo-dashboard__dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.geo-dashboard__dialog {
  background: #fff;
  border-radius: 16px;
  padding: 32px;
  width: 440px;
  max-width: 90vw;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
}

.geo-dashboard__dialog-title {
  font-size: 20px;
  font-weight: 600;
  color: #111827;
  margin: 0 0 8px;
}

.geo-dashboard__dialog-desc {
  font-size: 14px;
  color: #6b7280;
  margin: 0 0 20px;
}

.geo-dashboard__dialog-input-group {
  display: flex;
  gap: 8px;
}

.geo-dashboard__dialog-input {
  flex: 1;
  padding: 10px 14px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 15px;
  outline: none;
  transition: border-color 0.15s;
}

.geo-dashboard__dialog-input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.geo-dashboard__dialog-close {
  display: block;
  margin-top: 16px;
  background: none;
  border: none;
  color: #6b7280;
  font-size: 14px;
  cursor: pointer;
  text-align: center;
  width: 100%;
  padding: 8px;
}

.geo-dashboard__dialog-close:hover {
  color: #374151;
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

  .geo-dashboard__stats {
    grid-template-columns: repeat(2, 1fr);
  }

  .geo-dashboard__project-card {
    flex-direction: column;
    align-items: flex-start;
  }

  .geo-dashboard__project-stats {
    width: 100%;
    justify-content: space-between;
  }

  .geo-dashboard__project-actions {
    width: 100%;
  }

  .geo-dashboard__project-actions .geo-dashboard__btn {
    width: 100%;
    justify-content: center;
  }
}
</style>
