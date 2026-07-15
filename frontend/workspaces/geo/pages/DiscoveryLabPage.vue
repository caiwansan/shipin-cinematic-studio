<!--
  DiscoveryLabPage.vue — AI Discovery Lab (Runtime Edition)

  Phase 2 — Workflow-driven scan orchestration.
  No manual entity input. No mockScanner.
  All scan logic driven by POST /api/v1/geo/projects/:id/scan
-->
<template>
  <div class="discovery-lab">
    <!-- Page Header -->
    <header class="discovery-lab__header">
      <!-- Walkthrough GuideBar (Level 1: after brand creation, prompt discovery) -->
      <GeoWalkthroughBar
        :guide="activeGuide"
        @dismissed="activeGuide = null"
      />
      <div class="discovery-lab__header-top">
        <NuxtLink to="/workspace/geo/dashboard" class="discovery-lab__back-btn">← 返回工作台</NuxtLink>
      </div>
      <h1 class="discovery-lab__title">AI Discovery Lab</h1>
      <p class="discovery-lab__subtitle">
        Run AI-powered brand intelligence scan
      </p>
    </header>

    <!-- No Project Error -->
    <section v-if="!geoWorkspace.currentProjectId" class="discovery-lab__empty">
      <div class="discovery-lab__empty-card">
        <p class="discovery-lab__empty-icon">⚠️</p>
        <p class="discovery-lab__empty-title">未选择项目</p>
        <p class="discovery-lab__empty-desc">请先在品牌工作台中选择或创建一个品牌项目。</p>
        <NuxtLink to="/workspace/geo/dashboard" class="discovery-lab__action-btn">返回工作台</NuxtLink>
      </div>
    </section>

    <!-- Scan Control Bar -->
    <section v-else class="discovery-lab__scan-control">
      <div class="discovery-lab__scan-status">
        <div class="discovery-lab__scan-status-icon">
          <span v-if="scanStatus==='RUNNING'" class="discovery-lab__spinner-lg" style="font-size:28px">⟳</span>
          <span v-else-if="scanStatus==='COMPLETED'" style="font-size:28px">✅</span>
          <span v-else-if="scanStatus==='FAILED'" style="font-size:28px">❌</span>
          <span v-else style="font-size:28px">🔍</span>
        </div>
        <div class="discovery-lab__scan-status-info">
          <h3 class="discovery-lab__scan-status-title">{{ scanStatusLabel }}</h3>
          <p class="discovery-lab__scan-status-desc">{{ scanStatusDesc }}</p>
          <p v-if="brandName" class="discovery-lab__scan-brand-name">品牌：{{ brandName }}</p>
        </div>
      </div>
      <div class="discovery-lab__scan-actions">
        <button
          v-if="canStartScan"
          class="discovery-lab__scan-start-btn"
          :disabled="scanStarting"
          @click="handleStartScan"
        >
          <span v-if="scanStarting" class="discovery-lab__spinner">⟳</span>
          <span v-else>🚀 开始品牌发现</span>
        </button>
        <button
          v-if="scanStatus==='COMPLETED'||scanStatus==='FAILED'"
          class="discovery-lab__scan-start-btn discovery-lab__scan-start-btn--secondary"
          :disabled="scanStarting"
          @click="handleStartScan"
        >🔄 重新扫描</button>
      </div>
    </section>

    <!-- Error Banner -->
    <section v-if="scanError" class="discovery-lab__error-section">
      <p class="discovery-lab__error">{{ scanError }}</p>
    </section>

    <!-- Running State -->
    <section v-if="scanStatus==='RUNNING'" class="discovery-lab__loading">
      <div class="discovery-lab__loading-card">
        <div class="discovery-lab__spinner-lg">⟳</div>
        <p>发现扫描进行中...</p>
        <p class="discovery-lab__loading-hint">AI 模型并行扫描 → ADI 评估 → 品牌快照创建</p>
      </div>
    </section>

    <!-- IDLE / Empty State -->
    <section v-if="scanStatus==='IDLE'&&!store.hasData" class="discovery-lab__empty">
      <div class="discovery-lab__empty-card">
        <p class="discovery-lab__empty-icon">🔬</p>
        <p class="discovery-lab__empty-title">尚未运行品牌发现</p>
        <p class="discovery-lab__empty-desc">
          点击「开始品牌发现」按钮，系统将通过 AI 多模型并行扫描
          （ChatGPT / Grok / Claude / Gemini / DeepSeek）评估品牌可见度与认知覆盖，
          生成完整的品牌发现评估报告。
        </p>
      </div>
    </section>

    <!-- Report Section -->
    <template v-if="store.hasData && store.report">
      <!-- ADI Score Card -->
      <section class="discovery-lab__section">
        <div class="discovery-lab__adi-card">
          <div class="discovery-lab__adi-main">
            <div class="discovery-lab__adi-ring">
              <svg viewBox="0 0 120 120" class="discovery-lab__adi-svg">
                <circle cx="60" cy="60" r="54" fill="none" stroke="#e5e7eb" stroke-width="8" />
                <circle
                  cx="60" cy="60" r="54"
                  fill="none"
                  :stroke="adiColor"
                  stroke-width="8"
                  stroke-linecap="round"
                  :stroke-dasharray="`${scorePercent * 3.39} 339`"
                  transform="rotate(-90 60 60)"
                  class="discovery-lab__adi-arc"
                />
              </svg>
              <div class="discovery-lab__adi-value">
                <span class="discovery-lab__adi-number">{{ store.report.adi }}</span>
                <span class="discovery-lab__adi-label">ADI</span>
                <GeoExplainButton @click="openExplainDrawer" />
              </div>
            </div>
            <div class="discovery-lab__adi-info">
              <h2 class="discovery-lab__adi-entity">{{ store.report.entityName }}</h2>
              <p class="discovery-lab__adi-desc">
                {{ adiLabel }} — {{ store.report.adi >= 80 ? '品牌发现就绪度优秀' : store.report.adi >= 60 ? '发现基础良好' : store.report.adi >= 40 ? '需大幅改善' : '检测到关键差距' }}
              </p>
              <div class="discovery-lab__adi-meta">
                <span>报告 ID：{{ store.report.id.slice(0, 20) }}...</span>
                <span>生成时间：{{ formatDate(store.report.generatedAt) }}</span>
              </div>
            </div>
          </div>

          <!-- Sub-dimensions -->
          <div class="discovery-lab__dims">
            <div v-for="dim in dimensions" :key="dim.id" class="discovery-lab__dim">
              <div class="discovery-lab__dim-header">
                <span class="discovery-lab__dim-label">{{ dim.label }}</span>
                <span class="discovery-lab__dim-score" :style="{ color: dim.color }">{{ dim.value }}/100</span>
              </div>
              <div class="discovery-lab__dim-bar">
                <div
                  class="discovery-lab__dim-fill"
                  :style="{ width: dim.value + '%', backgroundColor: dim.color }"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Coverage Summary -->
      <section class="discovery-lab__section">
        <div class="discovery-lab__card">
          <h3 class="discovery-lab__card-title">覆盖概览</h3>
          <div class="discovery-lab__coverage-grid">
            <div class="discovery-lab__coverage-stat">
              <span class="discovery-lab__stat-value">{{ store.coveredScenarios.length }}</span>
              <span class="discovery-lab__stat-label">已覆盖场景</span>
            </div>
            <div class="discovery-lab__coverage-stat">
              <span class="discovery-lab__stat-value">{{ store.uncoveredScenarios.length }}</span>
              <span class="discovery-lab__stat-label">未覆盖场景</span>
            </div>
            <div class="discovery-lab__coverage-stat">
              <span class="discovery-lab__stat-value">{{ store.report.scenarios.length }}</span>
              <span class="discovery-lab__stat-label">场景总数</span>
            </div>
            <div class="discovery-lab__coverage-stat">
              <span class="discovery-lab__stat-value">{{ coveragePercent }}%</span>
              <span class="discovery-lab__stat-label">覆盖率</span>
            </div>
          </div>
        </div>
      </section>

      <!-- Scenario Coverage Table -->
      <section class="discovery-lab__section">
        <div class="discovery-lab__card">
          <h3 class="discovery-lab__card-title">场景覆盖详情</h3>
          <div class="discovery-lab__table-wrap">
            <table class="discovery-lab__table">
              <thead>
                <tr>
                  <th>场景</th>
                  <th>行业</th>
                  <th>覆盖度</th>
                  <th>置信度</th>
                  <th>趋势</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="s in sortedScenarios" :key="s.scenarioId">
                  <td class="discovery-lab__td-name">{{ s.scenarioName }}</td>
                  <td>{{ s.industryId }}</td>
                  <td>
                    <div class="discovery-lab__td-bar">
                      <div
                        class="discovery-lab__td-fill"
                        :style="{ width: s.coverageScore + '%', backgroundColor: scoreColor(s.coverageScore) }"
                      />
                    </div>
                    <span class="discovery-lab__td-score">{{ s.coverageScore }}</span>
                  </td>
                  <td>{{ (s.confidence * 100).toFixed(0) }}%</td>
                  <td>
                    <span
                      :class="['discovery-lab__trend', `discovery-lab__trend--${s.trend}`]"
                    >
                      {{ trendIcon(s.trend) }} {{ trendLabel(s.trend) }}
                    </span>
                  </td>
                  <td>
                    <span
                      :class="['discovery-lab__badge', s.entityCoverage ? 'discovery-lab__badge--covered' : 'discovery-lab__badge--gap']"
                    >
                      {{ s.entityCoverage ? '✅ Covered' : '⚠️ Gap' }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- Opportunities — 升级版展示 -->
      <section v-if="store.report.opportunities.length > 0" class="discovery-lab__section">
        <div class="discovery-lab__card">
          <h3 class="discovery-lab__card-title">
            Optimization Opportunities
            <span class="discovery-lab__card-badge">{{ store.report.opportunities.length }}</span>
          </h3>

          <!-- High Priority -->
          <div v-if="store.highPriorityOpportunities.length > 0" class="discovery-lab__opp-group">
            <h4 class="discovery-lab__opp-group-title">🔴 High Priority</h4>
            <div
              v-for="opp in store.highPriorityOpportunities"
              :key="opp.scenarioId"
              class="discovery-lab__opp-item discovery-lab__opp-item--high"
            >
              <div class="discovery-lab__opp-header">
                <span class="discovery-lab__opp-name">{{ opp.scenarioName }}</span>
                <div class="discovery-lab__opp-badges">
                  <span class="discovery-lab__opp-badge discovery-lab__opp-badge--gain">+{{ opp.expectedAdiGain }} ADI</span>
                  <span class="discovery-lab__opp-badge" :class="effortClass(opp.effort)">{{ effortLabel(opp.effort) }}</span>
                  <span class="discovery-lab__opp-gap">差距：{{ opp.gap }}/100</span>
                </div>
              </div>
              <p class="discovery-lab__opp-reason">📋 {{ opp.reason }}</p>
              <p class="discovery-lab__opp-suggestion">💡 {{ opp.suggestion }}</p>
              <div v-if="opp.tags && opp.tags.length > 0" class="discovery-lab__opp-tags">
                <span v-for="tag in opp.tags" :key="tag" class="discovery-lab__opp-tag">{{ tag }}</span>
              </div>
            </div>
          </div>

          <!-- Medium Priority -->
          <div v-if="store.mediumPriorityOpportunities.length > 0" class="discovery-lab__opp-group">
            <h4 class="discovery-lab__opp-group-title">🟡 Medium Priority</h4>
            <div
              v-for="opp in store.mediumPriorityOpportunities"
              :key="opp.scenarioId"
              class="discovery-lab__opp-item discovery-lab__opp-item--medium"
            >
              <div class="discovery-lab__opp-header">
                <span class="discovery-lab__opp-name">{{ opp.scenarioName }}</span>
                <div class="discovery-lab__opp-badges">
                  <span class="discovery-lab__opp-badge discovery-lab__opp-badge--gain">+{{ opp.expectedAdiGain }} ADI</span>
                  <span class="discovery-lab__opp-badge" :class="effortClass(opp.effort)">{{ effortLabel(opp.effort) }}</span>
                  <span class="discovery-lab__opp-gap">差距：{{ opp.gap }}/100</span>
                </div>
              </div>
              <p class="discovery-lab__opp-reason">📋 {{ opp.reason }}</p>
              <p class="discovery-lab__opp-suggestion">💡 {{ opp.suggestion }}</p>
              <div v-if="opp.tags && opp.tags.length > 0" class="discovery-lab__opp-tags">
                <span v-for="tag in opp.tags" :key="tag" class="discovery-lab__opp-tag">{{ tag }}</span>
              </div>
            </div>
          </div>

          <!-- Low Priority -->
          <div v-if="store.lowPriorityOpportunities.length > 0" class="discovery-lab__opp-group">
            <h4 class="discovery-lab__opp-group-title">⚪ Low Priority</h4>
            <div
              v-for="opp in store.lowPriorityOpportunities"
              :key="opp.scenarioId"
              class="discovery-lab__opp-item discovery-lab__opp-item--low"
            >
              <div class="discovery-lab__opp-header">
                <span class="discovery-lab__opp-name">{{ opp.scenarioName }}</span>
                <span class="discovery-lab__opp-gap">差距：{{ opp.gap }}/100</span>
              </div>
              <p class="discovery-lab__opp-suggestion">💡 {{ opp.suggestion }}</p>
            </div>
          </div>
        </div>
      </section>

      <!-- Top / Bottom Scenarios -->
      <section class="discovery-lab__section discovery-lab__section--split">
        <div class="discovery-lab__card">
          <h3 class="discovery-lab__card-title">🏆 Top 5 Scenarios</h3>
          <div v-for="s in store.topScenarios" :key="s.scenarioId" class="discovery-lab__rank-item">
            <div class="discovery-lab__rank-name">{{ s.scenarioName }}</div>
            <div class="discovery-lab__rank-bar-wrap">
              <div
                class="discovery-lab__rank-bar"
                :style="{ width: s.coverageScore + '%', backgroundColor: '#22c55e' }"
              />
            </div>
            <span class="discovery-lab__rank-score">{{ s.coverageScore }}</span>
          </div>
        </div>
        <div class="discovery-lab__card">
          <h3 class="discovery-lab__card-title">🔻 Bottom 5 Scenarios</h3>
          <div v-for="s in store.bottomScenarios" :key="s.scenarioId" class="discovery-lab__rank-item">
            <div class="discovery-lab__rank-name">{{ s.scenarioName }}</div>
            <div class="discovery-lab__rank-bar-wrap">
              <div
                class="discovery-lab__rank-bar"
                :style="{ width: s.coverageScore + '%', backgroundColor: '#ef4444' }"
              />
            </div>
            <span class="discovery-lab__rank-score">{{ s.coverageScore }}</span>
          </div>
        </div>
      </section>
    </template>

    <!-- ===== Explain Drawer (RC1-T004) ===== -->
    <GeoExplainDrawer
      :visible="explainDrawerVisible"
      :explain="explainDrawerData"
      :loading="explainDrawerLoading"
      :error="explainDrawerError"
      @close="closeExplainDrawer"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useDiscoveryStore } from '../stores/useDiscoveryStore'
import { useGeoWorkspaceStore } from '~/stores/geoWorkspace.store'
import GeoWalkthroughBar from '../components/GeoWalkthroughBar.vue'
import GeoExplainButton from '../components/GeoExplainButton.vue'
import GeoExplainDrawer from '../components/GeoExplainDrawer/index.vue'
import { explainService } from '../services/explainService'
import type { ExplainResult } from '../types/explain'
import { walkthroughService, type GuideInfo } from '../services/walkthroughService'
import { startScan, getLatestScan, getScanStatus } from '../services/scanService'
import type { ScanStatus } from '../services/scanService'

const store = useDiscoveryStore()
const geoWorkspace = useGeoWorkspaceStore()
const activeGuide = ref<GuideInfo | null>(null)

// ===== Scan State (Phase 2 — Runtime) =====
const scanStatus = ref<ScanStatus>('IDLE')
const scanStarting = ref(false)
const scanError = ref<string | null>(null)
const brandName = ref<string | null>(null)

// ===== Explain Drawer State =====
const explainDrawerVisible = ref(false)
const explainDrawerLoading = ref(false)
const explainDrawerError = ref<string | null>(null)
const explainDrawerData = ref<ExplainResult | null>(null)

async function openExplainDrawer() {
  if (!store.report?.entityName) return
  explainDrawerVisible.value = true
  explainDrawerLoading.value = true
  explainDrawerError.value = null
  explainDrawerData.value = null
  try {
    explainDrawerData.value = await explainService.getExplain('discovery', store.report.entityName)
  } catch (err: any) {
    explainDrawerError.value = err?.message || '获取 Explain 数据失败'
  } finally {
    explainDrawerLoading.value = false
  }
}

function closeExplainDrawer() {
  explainDrawerVisible.value = false
  explainDrawerData.value = null
  explainDrawerError.value = null
}

// ===== Computed: Scan Status Labels =====
const scanStatusLabel = computed(() => {
  switch (scanStatus.value) {
    case 'IDLE': return '待扫描'
    case 'RUNNING': return '发现扫描进行中'
    case 'COMPLETED': return '发现扫描已完成'
    case 'FAILED': return '发现扫描失败'
    default: return '未知状态'
  }
})

const scanStatusDesc = computed(() => {
  if (scanStatus.value === 'IDLE' && geoWorkspace.workflowStage === 'CREATED') {
    return '品牌已创建，等待执行首次发现扫描'
  }
  if (scanStatus.value === 'IDLE') return '点击下方按钮开始发现扫描'
  if (scanStatus.value === 'RUNNING') return '系统正在执行 AI 发现扫描，请稍候...'
  if (scanStatus.value === 'COMPLETED') return '品牌发现评估已完成，以下为详细报告'
  if (scanStatus.value === 'FAILED') return scanError.value || '扫描过程中发生错误'
  return ''
})

const canStartScan = computed(() => {
  return geoWorkspace.availableActions.includes('START_SCAN') && scanStatus.value !== 'RUNNING'
})

// ===== Scan Handlers =====
async function handleStartScan() {
  const projectId = geoWorkspace.currentProjectId
  if (!projectId) {
    scanError.value = '未选择项目，无法启动扫描'
    return
  }

  scanStarting.value = true
  scanError.value = null
  scanStatus.value = 'RUNNING'

  try {
    const result = await startScan(projectId)
    await pollScanResult(projectId, result.scanId)
  } catch (err: any) {
    scanStatus.value = 'FAILED'
    scanError.value = err?.message || '启动扫描失败'
  } finally {
    scanStarting.value = false
    await geoWorkspace.refreshWorkflow()
  }
}

async function pollScanResult(projectId: string, scanId: string) {
  let attempts = 0
  const maxAttempts = 60 // 60 * 5s = 5 min

  while (attempts < maxAttempts) {
    await new Promise((r) => setTimeout(r, 5000))
    attempts++

    try {
      const detail = await getScanStatus(projectId, scanId)
      if (detail.status === 'COMPLETED') {
        scanStatus.value = 'COMPLETED'
        return
      }
      if (detail.status === 'FAILED') {
        scanStatus.value = 'FAILED'
        scanError.value = detail.error || '扫描失败'
        return
      }
      // Still RUNNING — continue
    } catch {
      // Status API not yet available
    }
  }

  scanStatus.value = 'FAILED'
  scanError.value = '扫描超时，请稍后重试'
}

// ===== Lifecycle =====
onMounted(async () => {
  try {
    const state = await walkthroughService.getState()
    if (state.activeGuide && state.activeGuide.step === 'discovery') {
      activeGuide.value = state.activeGuide
    }
  } catch {
    // Silent fail
  }

  if (geoWorkspace.currentProjectId) {
    const latest = await getLatestScan(geoWorkspace.currentProjectId)
    if (latest) {
      if (latest.status === 'COMPLETED') scanStatus.value = 'COMPLETED'
      else if (latest.status === 'FAILED') {
        scanStatus.value = 'FAILED'
        scanError.value = latest.error || null
      } else if (['RUNNING', 'PENDING'].includes(latest.status)) {
        scanStatus.value = 'RUNNING'
        await pollScanResult(geoWorkspace.currentProjectId!, latest.scanId)
      }
    }
    if (geoWorkspace.currentProject?.name) {
      brandName.value = geoWorkspace.currentProject.name
    }
  }
})

// ===== Computed: Report Helpers (preserved from previous) =====
const sortedScenarios = computed(() => {
  if (!store.report) return []
  return [...store.report.scenarios].sort((a, b) => b.coverageScore - a.coverageScore)
})

const scorePercent = computed(() => (store.report?.adi ?? 0) / 100 * 100)

const coveragePercent = computed(() => {
  if (!store.report) return 0
  const total = store.report.scenarios.length
  const covered = store.report.scenarios.filter((s) => s.entityCoverage).length
  return Math.round((covered / total) * 100)
})

const adiColor = computed(() => {
  const score = store.report?.adi ?? 0
  if (score >= 80) return '#22c55e'
  if (score >= 60) return '#3b82f6'
  if (score >= 40) return '#f59e0b'
  return '#ef4444'
})

const adiLabel = computed(() => {
  const score = store.report?.adi ?? 0
  if (score >= 80) return 'Excellent'
  if (score >= 60) return 'Good'
  if (score >= 40) return 'Moderate'
  return 'Critical'
})

const dimensions = computed(() => {
  if (!store.report) return []
  const d = store.report.dimensions
  return [
    { id: 'coverage', label: 'Discovery Coverage', value: d.coverage, color: '#3b82f6' },
    { id: 'share', label: 'Recommendation Share', value: d.share, color: '#8b5cf6' },
    { id: 'position', label: 'Position Score', value: d.position, color: '#f59e0b' },
  ]
})

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

function scoreColor(score: number): string {
  if (score >= 80) return '#22c55e'
  if (score >= 60) return '#3b82f6'
  if (score >= 40) return '#f59e0b'
  return '#ef4444'
}

function trendIcon(trend: string): string {
  if (trend === 'up') return '📈'
  if (trend === 'down') return '📉'
  return '📊'
}

function trendLabel(trend: string): string {
  if (trend === 'up') return 'Improving'
  if (trend === 'down') return 'Declining'
  return 'Stable'
}

function effortLabel(effort: string): string {
  if (effort === 'easy') return '🟢 Easy'
  if (effort === 'hard') return '🔴 Hard'
  return '🟡 Medium'
}

function effortClass(effort: string): string {
  return `discovery-lab__opp-badge--${effort}`
}
</script>

<style scoped>
.discovery-lab {
  width: 100%;
  margin: 0 auto;
  font-family: Inter, -apple-system, sans-serif;
}

/* ===== Header ===== */
.discovery-lab__header {
  margin-bottom: 32px;
}

.discovery-lab__header-top {
  margin-bottom: 16px;
}

.discovery-lab__back-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
  color: #6b7280;
  text-decoration: none;
  padding: 4px 8px;
  border-radius: 6px;
  transition: all 0.15s;
}

.discovery-lab__back-btn:hover {
  color: #374151;
  background: #f3f4f6;
}

.discovery-lab__title {
  font-size: 28px;
  font-weight: 700;
  color: #111827;
  margin: 0 0 4px;
  letter-spacing: -0.03em;
}

.discovery-lab__subtitle {
  font-size: 15px;
  color: #6b7280;
  margin: 0;
}

/* ===== Scan Control ===== */
.discovery-lab__scan-control {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 20px 24px;
  margin-bottom: 24px;
  gap: 16px;
}

.discovery-lab__scan-status {
  display: flex;
  align-items: center;
  gap: 16px;
}

.discovery-lab__scan-status-icon { flex-shrink: 0; }
.discovery-lab__scan-status-info { flex: 1; }

.discovery-lab__scan-status-title {
  font-size: 18px;
  font-weight: 700;
  color: #111827;
  margin: 0 0 4px;
}

.discovery-lab__scan-status-desc {
  font-size: 14px;
  color: #6b7280;
  margin: 0;
}

.discovery-lab__scan-brand-name {
  font-size: 13px;
  color: #3b82f6;
  margin: 4px 0 0;
  font-weight: 500;
}

.discovery-lab__scan-actions {
  display: flex;
  gap: 12px;
  flex-shrink: 0;
}

.discovery-lab__scan-start-btn {
  height: 44px;
  padding: 0 24px;
  border: none;
  border-radius: 10px;
  background: #3b82f6;
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
  white-space: nowrap;
}
.discovery-lab__scan-start-btn:hover:not(:disabled) { background: #2563eb; }
.discovery-lab__scan-start-btn:disabled { background: #93c5fd; cursor: not-allowed; }
.discovery-lab__scan-start-btn--secondary {
  background: #fff;
  color: #374151;
  border: 1px solid #d1d5db;
}
.discovery-lab__scan-start-btn--secondary:hover:not(:disabled) {
  background: #f9fafb;
  border-color: #9ca3af;
}

.discovery-lab__error-section { margin-bottom: 16px; }
.discovery-lab__error {
  margin: 0;
  font-size: 14px;
  color: #ef4444;
  padding: 12px 16px;
  background: #fef2f2;
  border-radius: 8px;
  border: 1px solid #fecaca;
}

.discovery-lab__spinner {
  display: inline-block;
  animation: spin 1s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

/* ===== Action button (for no-project redirect) ===== */
.discovery-lab__action-btn {
  display: inline-block;
  margin-top: 16px;
  padding: 10px 24px;
  border-radius: 10px;
  background: #3b82f6;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  transition: background 0.15s;
}
.discovery-lab__action-btn:hover { background: #2563eb; }

/* ===== Loading ===== */
.discovery-lab__loading {
  display: flex;
  justify-content: center;
  padding: 60px 0;
}

.discovery-lab__loading-card {
  text-align: center;
  padding: 48px;
  background: #f9fafb;
  border-radius: 16px;
  border: 1px solid #e5e7eb;
}

.discovery-lab__spinner-lg {
  font-size: 48px;
  color: #3b82f6;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

.discovery-lab__loading-hint {
  font-size: 13px;
  color: #9ca3af;
  margin: 8px 0 0;
}

/* ===== Empty State ===== */
.discovery-lab__empty {
  display: flex;
  justify-content: center;
  padding: 60px 0;
}

.discovery-lab__empty-card {
  text-align: center;
  padding: 48px;
  background: #f9fafb;
  border-radius: 16px;
  border: 1px solid #e5e7eb;
  max-width: 480px;
}

.discovery-lab__empty-icon {
  font-size: 48px;
  margin: 0 0 12px;
}

.discovery-lab__empty-title {
  font-size: 18px;
  font-weight: 600;
  color: #111827;
  margin: 0 0 8px;
}

.discovery-lab__empty-desc {
  font-size: 14px;
  color: #6b7280;
  margin: 0;
  line-height: 1.6;
}

/* ===== Sections ===== */
.discovery-lab__section {
  margin-bottom: 24px;
}

.discovery-lab__section--split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

/* ===== ADI Card ===== */
.discovery-lab__adi-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  padding: 32px;
}

.discovery-lab__adi-main {
  display: flex;
  gap: 32px;
  align-items: center;
  margin-bottom: 28px;
}

.discovery-lab__adi-ring {
  position: relative;
  width: 120px;
  height: 120px;
  flex-shrink: 0;
}

.discovery-lab__adi-svg {
  width: 100%;
  height: 100%;
}

.discovery-lab__adi-arc {
  transition: stroke-dasharray 0.6s ease-out;
}

.discovery-lab__adi-value {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.discovery-lab__adi-number {
  font-size: 36px;
  font-weight: 800;
  color: #111827;
  line-height: 1;
}

.discovery-lab__adi-label {
  font-size: 11px;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.discovery-lab__adi-info {
  flex: 1;
}

.discovery-lab__adi-entity {
  font-size: 22px;
  font-weight: 700;
  color: #111827;
  margin: 0 0 4px;
}

.discovery-lab__adi-desc {
  font-size: 14px;
  color: #6b7280;
  margin: 0 0 12px;
}

.discovery-lab__adi-meta {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: #9ca3af;
}

/* ===== Sub-dimensions ===== */
.discovery-lab__dims {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  padding-top: 20px;
  border-top: 1px solid #f3f4f6;
}

.discovery-lab__dim-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.discovery-lab__dim-label {
  font-size: 13px;
  font-weight: 500;
  color: #374151;
}

.discovery-lab__dim-score {
  font-size: 14px;
  font-weight: 700;
}

.discovery-lab__dim-bar {
  height: 8px;
  background: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
}

.discovery-lab__dim-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.4s ease-out;
}

/* ===== Coverage Grid ===== */
.discovery-lab__coverage-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.discovery-lab__coverage-stat {
  text-align: center;
  padding: 16px;
  background: #f9fafb;
  border-radius: 10px;
}

.discovery-lab__stat-value {
  display: block;
  font-size: 28px;
  font-weight: 700;
  color: #111827;
}

.discovery-lab__stat-label {
  display: block;
  font-size: 12px;
  color: #6b7280;
  margin-top: 4px;
}

/* ===== Cards ===== */
.discovery-lab__card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 24px;
}

.discovery-lab__card-title {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
  margin: 0 0 16px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.discovery-lab__card-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 10px;
  background: #3b82f6;
  color: #fff;
  font-size: 11px;
  font-weight: 600;
}

/* ===== Table ===== */
.discovery-lab__table-wrap {
  overflow-x: auto;
}

.discovery-lab__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.discovery-lab__table th {
  text-align: left;
  padding: 10px 12px;
  font-weight: 600;
  color: #6b7280;
  border-bottom: 2px solid #e5e7eb;
  white-space: nowrap;
}

.discovery-lab__table td {
  padding: 10px 12px;
  border-bottom: 1px solid #f3f4f6;
  color: #374151;
  vertical-align: middle;
}

.discovery-lab__table tbody tr:hover {
  background: #f9fafb;
}

.discovery-lab__td-name {
  font-weight: 500;
  white-space: nowrap;
}

.discovery-lab__td-bar {
  display: inline-block;
  width: 60px;
  height: 6px;
  background: #e5e7eb;
  border-radius: 3px;
  vertical-align: middle;
  margin-right: 8px;
}

.discovery-lab__td-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s;
}

.discovery-lab__td-score {
  font-size: 12px;
  font-weight: 600;
  vertical-align: middle;
}

/* ===== Trend ===== */
.discovery-lab__trend {
  font-size: 12px;
  font-weight: 500;
}

.discovery-lab__trend--up { color: #22c55e; }
.discovery-lab__trend--stable { color: #6b7280; }
.discovery-lab__trend--down { color: #ef4444; }

/* ===== Badge ===== */
.discovery-lab__badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
}

.discovery-lab__badge--covered {
  background: #dcfce7;
  color: #166534;
}

.discovery-lab__badge--gap {
  background: #fef3c7;
  color: #92400e;
}

/* ===== Opportunities — 升级版 ===== */
.discovery-lab__opp-group {
  margin-bottom: 20px;
}

.discovery-lab__opp-group:last-child {
  margin-bottom: 0;
}

.discovery-lab__opp-group-title {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 12px;
  color: #374151;
}

.discovery-lab__opp-item {
  padding: 14px 16px;
  border-radius: 10px;
  margin-bottom: 10px;
}

.discovery-lab__opp-item--high {
  background: #fef2f2;
  border: 1px solid #fecaca;
}

.discovery-lab__opp-item--medium {
  background: #fffbeb;
  border: 1px solid #fde68a;
}

.discovery-lab__opp-item--low {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
}

.discovery-lab__opp-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  flex-wrap: wrap;
  gap: 8px;
}

.discovery-lab__opp-name {
  font-weight: 600;
  font-size: 14px;
  color: #111827;
}

.discovery-lab__opp-badges {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.discovery-lab__opp-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
}

.discovery-lab__opp-badge--gain {
  background: #dcfce7;
  color: #166534;
}

.discovery-lab__opp-badge--easy {
  background: #dcfce7;
  color: #166534;
}

.discovery-lab__opp-badge--medium {
  background: #fef3c7;
  color: #92400e;
}

.discovery-lab__opp-badge--hard {
  background: #fef2f2;
  color: #991b1b;
}

.discovery-lab__opp-gap {
  font-size: 12px;
  font-weight: 700;
  color: #dc2626;
}

.discovery-lab__opp-reason {
  font-size: 13px;
  color: #374151;
  margin: 0 0 6px;
  line-height: 1.5;
}

.discovery-lab__opp-suggestion {
  font-size: 13px;
  color: #6b7280;
  margin: 0;
  line-height: 1.5;
}

.discovery-lab__opp-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.discovery-lab__opp-tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 10px;
  background: #f3f4f6;
  color: #6b7280;
  font-size: 11px;
  font-weight: 500;
}

/* ===== Rank Items ===== */
.discovery-lab__rank-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid #f3f4f6;
}

.discovery-lab__rank-item:last-child {
  border-bottom: none;
}

.discovery-lab__rank-name {
  width: 140px;
  font-size: 13px;
  font-weight: 500;
  color: #374151;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.discovery-lab__rank-bar-wrap {
  flex: 1;
  height: 8px;
  background: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
}

.discovery-lab__rank-bar {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s;
}

.discovery-lab__rank-score {
  width: 32px;
  text-align: right;
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
}

/* ===== Responsive ===== */
@media (max-width: 768px) {
  .discovery-lab__section--split {
    grid-template-columns: 1fr;
  }

  .discovery-lab__adi-main {
    flex-direction: column;
    text-align: center;
  }

  .discovery-lab__dims {
    grid-template-columns: 1fr;
  }

  .discovery-lab__coverage-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .discovery-lab__scan-control {
    flex-direction: column;
    align-items: stretch;
  }
  .discovery-lab__scan-actions {
    justify-content: center;
  }
}
</style>
