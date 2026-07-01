<template>
  <div class="geo-mission-control">
    <!-- ===== Page Header ===== -->
    <header class="geo-mission-control__header">
      <div>
        <h1 class="geo-mission-control__title">使命控制中心</h1>
        <p class="geo-mission-control__subtitle">管理品牌数字身份，提升 AI 可见度</p>
      </div>
      <div class="geo-mission-control__header-actions">
        <NuxtLink to="/" class="geo-mission-control__back-link">🏠 返回首页</NuxtLink>
      </div>
    </header>

    <!-- ===== Loading State ===== -->
    <GeoLoading v-if="loading" :steps="loadingSteps" :current-step="1" />

    <!-- ===== Error State ===== -->
    <GeoErrorState v-else-if="error" :message="error" @retry="loadMission" />

    <!-- ===== Empty State ===== -->
    <GeoEmptyState
      v-else-if="!mission || mission.prioritizedProjects.length === 0"
      icon="🏢"
      title="欢迎使用 GEO 工作台"
      description="创建第一个品牌，开始您的 AI 可见度优化之旅"
    >
      <template #actions>
        <button class="geo-mission-control__create-btn" @click="navigateCreate">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M9 3v12M3 9h12" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
          创建品牌
        </button>
      </template>
    </GeoEmptyState>

    <!-- ===== Data State ===== -->
    <div v-else class="geo-mission-control__data">
      <!-- ===== Walkthrough Welcome Card (Level 0) ===== -->
      <GeoWalkthroughWelcome
        :show="walkthroughState.showWelcomeCard"
        @create="navigateCreate"
        @skip="dismissWalkthrough"
      />

      <!-- ===== KPI Bar (3 metrics) ===== -->
      <section class="geo-mission-control__kpi-bar">
        <GeoMetricCard label="品牌" :display-value="brandCount" />
        <GeoMetricCard label="平均 ADI" :display-value="averageAdi">
          <template #suffix>
            <GeoExplainButton @click="openExplain('discovery')" />
          </template>
        </GeoMetricCard>
        <GeoMetricCard
          label="AI 可见度"
          :display-value="`${mission.systemHealth.aiPresenceCount}/${mission.systemHealth.aiPresenceTotal}`"
          subtext="可见平台/总数"
        >
          <template #suffix>
            <GeoExplainButton @click="openExplain('presence')" />
          </template>
        </GeoMetricCard>
      </section>

      <!-- ===== Section 1: Today Progress ===== -->
      <GeoCard title="今日旅程" class="geo-mission-control__section">
        <div class="geo-mission-control__progress-bar">
          <div class="geo-mission-control__progress-fill" :style="{ width: mission.todayProgress.progressPercent + '%' }" />
          <span class="geo-mission-control__progress-label">{{ mission.todayProgress.progressPercent }}%</span>
        </div>
        <div class="geo-mission-control__steps">
          <div
            v-for="step in mission.todayProgress.steps"
            :key="step.label"
            class="geo-mission-control__step"
            :class="{ 'geo-mission-control__step--done': step.done }"
          >
            <span class="geo-mission-control__step-icon">{{ step.done ? '✓' : '○' }}</span>
            <span class="geo-mission-control__step-label">{{ step.label }}</span>
          </div>
        </div>
      </GeoCard>

      <!-- ===== Section 2: Continue Journey ===== -->
      <GeoCard v-if="mission.continueJourney" title="继续旅程" class="geo-mission-control__section">
        <div class="geo-mission-control__continue">
          <h3 class="geo-mission-control__continue-brand">{{ mission.continueJourney.projectName }}</h3>
          <p class="geo-mission-control__continue-info">
            上一步：{{ mission.continueJourney.currentStep }}
            <span class="geo-mission-control__continue-check">✓</span>
          </p>
          <p class="geo-mission-control__continue-next">
            下一步：<strong>{{ mission.continueJourney.nextStep }}</strong>
          </p>
          <button class="geo-mission-control__continue-btn" @click="navigateTo(mission.continueJourney.nextStepUrl)">
            继续 →
          </button>
        </div>
      </GeoCard>

      <!-- ===== Section 3: Brand Priority ===== -->
      <GeoCard title="品牌优先级" class="geo-mission-control__section">
        <div class="geo-mission-control__brand-table">
          <div class="geo-mission-control__brand-table-header">
            <span class="geo-mission-control__brand-col-name">品牌</span>
            <span class="geo-mission-control__brand-col-adi">ADI</span>
            <span class="geo-mission-control__brand-col-status">状态</span>
            <span class="geo-mission-control__brand-col-action">操作</span>
          </div>
          <div
            v-for="project in mission.prioritizedProjects"
            :key="project.id"
            class="geo-mission-control__brand-row"
          >
            <span class="geo-mission-control__brand-col-name">{{ project.name }}</span>
            <span class="geo-mission-control__brand-col-adi">{{ project.adi > 0 ? project.adi : '—' }}</span>
            <span class="geo-mission-control__brand-col-status">
              <GeoBadge :variant="badgeVariant(project.priorityLabel)">{{ project.priorityLabel }}</GeoBadge>
            </span>
            <span class="geo-mission-control__brand-col-action">
              <button
                v-if="project.priorityLabel !== '已完成'"
                class="geo-mission-control__action-btn"
                @click="navigateTo(project.continueUrl)"
              >
                {{ actionLabel(project.priorityLabel) }} →
              </button>
              <span v-else class="geo-mission-control__action-done">—</span>
            </span>
          </div>
        </div>
      </GeoCard>

      <!-- ===== Section 4: Recent Activity ===== -->
      <GeoCard title="最近活动" class="geo-mission-control__section">
        <div class="geo-mission-control__activities">
          <div
            v-for="(activity, i) in mission.recentActivities.slice(0, 8)"
            :key="i"
            class="geo-mission-control__activity"
          >
            <span class="geo-mission-control__activity-time">{{ activity.relativeTime }}</span>
            <span class="geo-mission-control__activity-label">{{ activity.label }}</span>
          </div>
          <p v-if="mission.recentActivities.length === 0" class="geo-mission-control__activity-empty">
            暂无活动记录
          </p>
        </div>
      </GeoCard>

      <!-- ===== Section 5: System Health ===== -->
      <GeoCard title="系统健康" class="geo-mission-control__section">
        <div class="geo-mission-control__health">
          <div class="geo-mission-control__health-item">
            <span class="geo-mission-control__health-icon">📡</span>
            <span class="geo-mission-control__health-label">AI 可见度</span>
            <span class="geo-mission-control__health-value">
              {{ mission.systemHealth.aiPresenceCount }}/{{ mission.systemHealth.aiPresenceTotal }}
            </span>
          </div>
          <div class="geo-mission-control__health-item">
            <span class="geo-mission-control__health-icon">🕐</span>
            <span class="geo-mission-control__health-label">上次扫描</span>
            <span class="geo-mission-control__health-value">{{ mission.systemHealth.lastScanRelative }}</span>
          </div>
          <div class="geo-mission-control__health-item">
            <span class="geo-mission-control__health-icon">🔌</span>
            <span class="geo-mission-control__health-label">API 状态</span>
            <span class="geo-mission-control__health-value" :class="{ 'geo-mission-control__health--ok': mission.systemHealth.apiHealthy }">
              {{ mission.systemHealth.apiHealthy ? '✓ 健康' : '✗ 异常' }}
            </span>
          </div>
        </div>
      </GeoCard>
    </div>

    <!-- ===== Explain Drawer (RC1-T004) ===== -->
    <GeoExplainDrawer
      :visible="explainDrawerVisible"
      :explain="explainData"
      :loading="explainLoading"
      :error="explainError"
      @close="closeExplain"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getDashboardMission, type DashboardMission } from '../services/dashboardMissionService'
import { walkthroughService, type WalkthroughState } from '../services/walkthroughService'
import GeoCard from '../components/GeoCard/index.vue'
import GeoBadge from '../components/GeoBadge/index.vue'
import GeoMetricCard from '../components/GeoMetricCard/index.vue'
import GeoLoading from '../components/GeoLoading/index.vue'
import GeoEmptyState from '../components/GeoEmptyState/index.vue'
import GeoErrorState from '../components/GeoErrorState/index.vue'
import GeoWalkthroughWelcome from '../components/GeoWalkthroughWelcome.vue'
import GeoExplainButton from '../components/GeoExplainButton.vue'
import GeoExplainDrawer from '../components/GeoExplainDrawer/index.vue'
import { explainService } from '../services/explainService'
import type { ExplainResult } from '../types/explain'

definePageMeta({
  title: 'Mission Control',
})

const router = useRouter()

// ── State ──
const loading = ref(true)
const error = ref<string | null>(null)
const mission = ref<DashboardMission | null>(null)

// ── Explain Drawer State (RC1-T004) ──
const explainDrawerVisible = ref(false)
const explainLoading = ref(false)
const explainError = ref<string | null>(null)
const explainData = ref<ExplainResult | null>(null)
const explainType = ref<string>('discovery')

const walkthroughState = ref<WalkthroughState>({
  showWelcomeCard: false,
  activeGuide: null,
  dismissed: false,
  completed: false,
})

const loadingSteps = [
  { label: '加载 Mission Control...', icon: '🎯' },
  { label: '解析品牌数据...', icon: '🔍' },
  { label: '准备显示...', icon: '📊' },
]

// ── Computed ──
const brandCount = computed(() => mission.value?.prioritizedProjects.length ?? 0)

const averageAdi = computed(() => {
  if (!mission.value || mission.value.prioritizedProjects.length === 0) return '—'
  const withAdi = mission.value.prioritizedProjects.filter((p) => p.adi > 0)
  if (withAdi.length === 0) return '—'
  const total = withAdi.reduce((sum, p) => sum + p.adi, 0)
  return Math.round(total / withAdi.length)
})

// ── Lifecycle ──
onMounted(async () => {
  await Promise.all([loadMission(), loadWalkthrough()])
})

// ── Data Loading ──
async function loadMission() {
  loading.value = true
  error.value = null
  try {
    mission.value = await getDashboardMission()
  } catch (err: any) {
    error.value = err?.message || '加载数据失败'
  } finally {
    loading.value = false
  }
}

// ── Walkthrough ──
async function loadWalkthrough() {
  try {
    const state = await walkthroughService.getState()
    walkthroughState.value = state || {
      showWelcomeCard: false,
      activeGuide: null,
      dismissed: true,
      completed: false,
    }
  } catch {
    // Silent fail — walkthrough is non-critical
  }
}

async function dismissWalkthrough() {
  try {
    await walkthroughService.dismiss()
    walkthroughState.value = { showWelcomeCard: false, activeGuide: null, dismissed: true, completed: false }
  } catch {
    // Silent fail
  }
}

// ── Helpers ──

// ── Explain Drawer (RC1-T004) ──
async function openExplain(type: string) {
  explainType.value = type
  explainDrawerVisible.value = true
  explainLoading.value = true
  explainError.value = null
  explainData.value = null

  try {
    // Use the first project ID for explain, or a placeholder
    const projectId = mission.value?.prioritizedProjects?.[0]?.id || ''
    if (!projectId) {
      explainError.value = '暂无品牌数据'
      return
    }
    explainData.value = await explainService.getExplain(type, projectId)
  } catch (err: any) {
    explainError.value = err?.message || '获取 Explain 数据失败'
  } finally {
    explainLoading.value = false
  }
}

function closeExplain() {
  explainDrawerVisible.value = false
  explainData.value = null
  explainError.value = null
}

function badgeVariant(priorityLabel: string): 'error' | 'warning' | 'info' | 'success' | 'neutral' {
  switch (priorityLabel) {
    case '需验证': return 'error'
    case '需优化': return 'warning'
    case '需行动': return 'info'
    case '需分析': return 'info'
    default: return 'success'
  }
}

function actionLabel(priorityLabel: string): string {
  switch (priorityLabel) {
    case '需验证': return '验证'
    case '需优化': return '优化'
    case '需行动': return '继续'
    case '需分析': return '分析'
    default: return '查看'
  }
}

function navigateTo(url: string) {
  router.push(url)
}

function navigateCreate() {
  router.push('/workspace/geo/create')
}
</script>

<style scoped>
@import url('../assets/geo-design-system.css');

.geo-mission-control {
  max-width: 1100px;
  margin: 0 auto;
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  padding: 0 0 48px;
}

/* ===== Header ===== */
.geo-mission-control__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 32px;
}

.geo-mission-control__header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.geo-mission-control__title {
  font-size: 28px;
  font-weight: 700;
  color: #111827;
  margin: 0 0 4px;
  letter-spacing: -0.03em;
}

.geo-mission-control__subtitle {
  font-size: 15px;
  color: #6b7280;
  margin: 0;
}

.geo-mission-control__back-link {
  font-size: 14px;
  color: #3b82f6;
  text-decoration: none;
  white-space: nowrap;
  padding: 6px 12px;
  border-radius: 6px;
  transition: background-color 0.15s;
}

.geo-mission-control__back-link:hover {
  background-color: #eff6ff;
}

/* ===== KPI Bar ===== */
.geo-mission-control__kpi-bar {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 24px;
}

/* ===== Section ===== */
.geo-mission-control__section {
  margin-bottom: 24px;
}

/* ===== Today Progress ===== */
.geo-mission-control__progress-bar {
  height: 8px;
  background: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 16px;
  position: relative;
}

.geo-mission-control__progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #22c55e);
  border-radius: 4px;
  transition: width 0.5s ease;
}

.geo-mission-control__progress-label {
  position: absolute;
  right: 0;
  top: -18px;
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
}

.geo-mission-control__steps {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}

.geo-mission-control__step {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: 8px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  font-size: 13px;
  color: #9ca3af;
  flex: 1;
  justify-content: center;
  transition: all 0.15s;
}

.geo-mission-control__step--done {
  background: #f0fdf4;
  border-color: #bbf7d0;
  color: #16a34a;
}

.geo-mission-control__step-icon {
  font-size: 14px;
  font-weight: 700;
}

.geo-mission-control__step-label {
  font-weight: 500;
}

/* ===== Continue Journey ===== */
.geo-mission-control__continue {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.geo-mission-control__continue-brand {
  font-size: 18px;
  font-weight: 700;
  color: #111827;
  margin: 0;
}

.geo-mission-control__continue-info {
  font-size: 14px;
  color: #6b7280;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 4px;
}

.geo-mission-control__continue-check {
  color: #22c55e;
  font-weight: 700;
}

.geo-mission-control__continue-next {
  font-size: 14px;
  color: #374151;
  margin: 0;
}

.geo-mission-control__continue-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 24px;
  background: #3b82f6;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  align-self: flex-start;
  transition: all 0.15s;
  font-family: inherit;
}

.geo-mission-control__continue-btn:hover {
  background: #2563eb;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.25);
}

/* ===== Brand Priority Table ===== */
.geo-mission-control__brand-table {
  display: flex;
  flex-direction: column;
}

.geo-mission-control__brand-table-header {
  display: flex;
  padding: 10px 12px;
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid #e5e7eb;
}

.geo-mission-control__brand-row {
  display: flex;
  align-items: center;
  padding: 12px;
  border-bottom: 1px solid #f3f4f6;
  transition: background-color 0.1s;
}

.geo-mission-control__brand-row:hover {
  background: #f9fafb;
}

.geo-mission-control__brand-row:last-child {
  border-bottom: none;
}

.geo-mission-control__brand-col-name {
  flex: 1;
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}

.geo-mission-control__brand-col-adi {
  width: 60px;
  font-size: 14px;
  color: #374151;
  text-align: center;
}

.geo-mission-control__brand-col-status {
  width: 80px;
  text-align: center;
}

.geo-mission-control__brand-col-action {
  width: 100px;
  text-align: right;
}

.geo-mission-control__action-btn {
  padding: 6px 14px;
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  color: #374151;
  cursor: pointer;
  transition: all 0.15s;
  font-family: inherit;
}

.geo-mission-control__action-btn:hover {
  background: #3b82f6;
  color: #fff;
  border-color: #3b82f6;
}

.geo-mission-control__action-done {
  color: #9ca3af;
  font-size: 14px;
}

/* ===== Recent Activities ===== */
.geo-mission-control__activities {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.geo-mission-control__activity {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 13px;
  transition: background-color 0.1s;
}

.geo-mission-control__activity:hover {
  background: #f9fafb;
}

.geo-mission-control__activity-time {
  color: #9ca3af;
  font-size: 12px;
  white-space: nowrap;
  min-width: 70px;
}

.geo-mission-control__activity-label {
  color: #374151;
}

.geo-mission-control__activity-empty {
  color: #9ca3af;
  font-size: 13px;
  text-align: center;
  padding: 16px;
  margin: 0;
}

/* ===== System Health ===== */
.geo-mission-control__health {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.geo-mission-control__health-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 6px;
  background: #f9fafb;
}

.geo-mission-control__health-icon {
  font-size: 16px;
}

.geo-mission-control__health-label {
  flex: 1;
  font-size: 14px;
  color: #6b7280;
}

.geo-mission-control__health-value {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}

.geo-mission-control__health--ok {
  color: #16a34a;
}

/* ===== Create Button ===== */
.geo-mission-control__create-btn {
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

.geo-mission-control__create-btn:hover {
  background: #2563eb;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.25);
}

/* ===== Responsive ===== */
@media (max-width: 768px) {
  .geo-mission-control__header {
    flex-direction: column;
    gap: 12px;
  }

  .geo-mission-control__steps {
    flex-wrap: wrap;
  }

  .geo-mission-control__step {
    flex: 1 1 40%;
  }
}
</style>
