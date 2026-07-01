<template>
  <div class="max-w-6xl mx-auto px-4 py-6">
    <!-- ===== STATE: Loading ===== -->
    <LoadingState
      v-if="loading && !hasProjects"
      title="加载历史数据"
      :steps="[
        { label: '获取品牌列表...', active: true },
        { label: '加载记录...' },
      ]"
    />

    <!-- ===== STATE: Error (no data yet) ===== -->
    <ErrorBanner
      v-else-if="error && !hasProjects"
      title="无法加载历史数据"
      message="请检查网络连接后重试"
    >
      <DSButton variant="primary" @click="loadData" :disabled="loading">重试</DSButton>
    </ErrorBanner>

    <!-- ===== STATE: Empty (no projects) ===== -->
    <EmptyState
      v-else-if="!hasProjects && !loading"
      icon="📊"
      title="还没有品牌项目"
      description="请先在品牌扫描页面创建项目"
    >
      <DSButton variant="primary" @click="goToDashboard">创建品牌</DSButton>
    </EmptyState>

    <!-- ===== STATE: Data ===== -->
    <template v-else-if="hasProjects">
      <!-- Navigation -->
      <div class="flex items-center gap-3 mb-4">
        <NuxtLink to="/" class="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
          🏠 返回首页
        </NuxtLink>
        <NuxtLink to="/workspace/geo/dashboard" class="text-sm text-blue-600 hover:text-blue-700">
          品牌列表
        </NuxtLink>
        <NuxtLink to="/workspace/geo/health" class="text-sm text-blue-600 hover:text-blue-700">
          健康报告
        </NuxtLink>
      </div>

      <!-- Brand Selector -->
      <div class="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <label class="block text-sm font-medium text-gray-700 mb-2">选择品牌</label>
        <select
          v-model="selectedProjectId"
          class="border border-gray-300 rounded-lg px-3 py-2 text-sm flex-1 max-w-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          @change="onBrandChange"
        >
          <option value="" disabled>请选择品牌</option>
          <option v-for="p in projects" :key="p.id" :value="p.id">
            {{ p.name }} ({{ p.website }})
          </option>
        </select>
      </div>

      <!-- Error Banner (recoverable) -->
      <div v-if="error" class="mb-4">
        <ErrorBanner :title="error" message="" dismissible @dismiss="error = null">
          <DSButton variant="primary" @click="loadScanData">重试</DSButton>
        </ErrorBanner>
      </div>

      <!-- Tabs: Scan History / Verification Results -->
      <div class="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div class="flex border-b border-gray-200 bg-white">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            class="flex-1 px-4 py-3 text-sm font-medium transition-colors relative"
            :class="activeTab === tab.id ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'"
            @click="switchTab(tab.id)"
          >
            {{ tab.label }}
            <span
              v-if="activeTab === tab.id"
              class="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500"
            />
          </button>
        </div>

        <!-- ======================== TAB: Scan History ======================== -->
        <div v-if="activeTab === 'scan'" class="p-6">
          <!-- No Scans -->
          <EmptyState
            v-if="scanList.length === 0 && !loading"
            icon="📊"
            title="暂无扫描记录"
            description="该品牌还没有完成任何扫描"
          >
            <DSButton variant="primary" @click="goToDetail">去扫描</DSButton>
          </EmptyState>

          <template v-if="scanList.length > 0">
            <!-- Score Trend Chart (same as before) -->
            <div class="mb-6">
              <h2 class="text-lg font-semibold text-gray-900 mb-4">评分趋势</h2>
              <div v-if="chartData.length >= 2" class="relative h-48">
                <div class="absolute left-0 top-0 bottom-6 w-10 flex flex-col justify-between text-xs text-gray-400">
                  <span>100</span>
                  <span>75</span>
                  <span>50</span>
                  <span>25</span>
                  <span>0</span>
                </div>
                <div class="ml-12 mr-4 h-full relative">
                  <div class="absolute inset-0 flex flex-col justify-between">
                    <div v-for="i in 4" :key="i" class="border-t border-gray-100 h-0" />
                  </div>
                  <svg class="absolute inset-0 w-full h-full" :viewBox="`0 0 ${scanChartSvgWidth} 216`" preserveAspectRatio="none">
                    <polyline
                      :points="scanChartPoints"
                      fill="none"
                      stroke="#3b82f6"
                      stroke-width="2"
                      stroke-linejoin="round"
                      stroke-linecap="round"
                    />
                  </svg>
                  <div class="absolute inset-0 flex items-end">
                    <div
                      v-for="(pt, idx) in chartData"
                      :key="idx"
                      class="flex-1 flex flex-col items-center"
                      style="height: 100%"
                    >
                      <div
                        class="w-3 h-3 rounded-full bg-blue-500 border-2 border-white shadow cursor-pointer hover:scale-150 transition-transform z-10"
                        :style="{ marginBottom: (pt.score / 100 * 168) + 'px' }"
                        :title="`${pt.date}: ${pt.score}分`"
                        @click="goToDetail()"
                      />
                    </div>
                  </div>
                </div>
                <div class="ml-12 mr-4 flex text-xs text-gray-400 mt-1">
                  <div
                    v-for="(pt, idx) in chartData"
                    :key="idx"
                    class="flex-1 text-center truncate"
                    :title="pt.date"
                  >
                    {{ idx === 0 || idx === chartData.length - 1 ? pt.date : '' }}
                  </div>
                </div>
              </div>
              <div v-else class="text-center py-8 text-sm text-gray-400">
                至少需要 2 条扫描记录才能显示趋势图
              </div>
            </div>

            <!-- Scan History List -->
            <div>
              <h2 class="text-lg font-semibold text-gray-900 mb-4">
                扫描历史
                <span class="text-sm font-normal text-gray-400 ml-2">共 {{ scanList.length }} 次</span>
              </h2>
              <div class="space-y-3">
                <div
                  v-for="(scan, idx) in scanList"
                  :key="scan.scanId"
                  class="flex items-center gap-4 p-4 rounded-lg border border-gray-100 hover:border-blue-200 hover:shadow-sm cursor-pointer transition-all"
                  @click="goToDetail()"
                >
                  <span class="text-sm font-mono text-gray-400 w-6 text-right">{{ scanList.length - idx }}</span>
                  <span class="text-lg">
                    {{ scan.status === 'completed' ? '✅' : scan.status === 'failed' ? '❌' : '⏳' }}
                  </span>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-gray-800">
                      {{ formatDate(scan.scanFinishedAt || scan.scanStartedAt) }}
                    </p>
                    <p class="text-xs text-gray-400">
                      {{ scan.status === 'completed' ? '扫描完成' : scan.status === 'failed' ? '扫描失败' : '扫描中...' }}
                      {{ scan.durationMs ? `· ${(scan.durationMs / 1000).toFixed(0)}s` : '' }}
                    </p>
                  </div>
                  <div class="text-right">
                    <span
                      v-if="scan.overallScore !== null"
                      :class="['text-lg font-bold', scanScoreColor(scan.overallScore).text]"
                    >
                      {{ scan.overallScore }}
                    </span>
                    <span v-else class="text-sm text-gray-400">—</span>
                  </div>
                  <span v-if="idx > 0 && scanList[idx - 1].overallScore !== null && scan.overallScore !== null" class="text-sm w-6 text-center">
                    <span v-if="(scan.overallScore || 0) > (scanList[idx - 1].overallScore || 0)" class="text-green-500">↑</span>
                    <span v-else-if="(scan.overallScore || 0) < (scanList[idx - 1].overallScore || 0)" class="text-red-500">↓</span>
                    <span v-else class="text-gray-400">→</span>
                  </span>
                  <span v-else class="text-sm w-6 text-center text-gray-300">—</span>
                </div>
              </div>
            </div>
          </template>
        </div>

        <!-- ======================== TAB: Verification Results ======================== -->
        <div v-if="activeTab === 'verification'" class="p-6 space-y-6">
          <!-- Run Verification Button -->
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold text-gray-900">验证结果</h2>
            <div class="flex items-center gap-2">
              <DSButton
                variant="primary"
                :disabled="verificationRunning"
                @click="runVerification"
              >
                {{ verificationRunning ? '验证中...' : '执行验证' }}
              </DSButton>
            </div>
          </div>

          <!-- Verification running indicator -->
          <div
            v-if="verificationRunning"
            class="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center gap-3"
          >
            <div class="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span class="text-sm text-blue-700">验证执行中，请稍候...</span>
          </div>

          <!-- Verification succeeded banner -->
          <SuccessBanner
            v-if="verificationSuccess"
            title="验证执行成功"
            :message="`分数变化: ${verificationDelta > 0 ? '+' : ''}${verificationDelta}`"
            dismissible
            @dismiss="verificationSuccess = false"
          />

          <!-- No verification data -->
          <EmptyState
            v-if="verificationHistory.length === 0 && !verificationLoading && !verificationRunning"
            icon="🔬"
            title="暂无验证记录"
            description="点击「执行验证」按钮开始验证优化效果"
          />

          <!-- Verification Timeline Chart -->
          <div v-if="verificationTimeline.length >= 2" class="bg-white rounded-lg border border-gray-200 p-6">
            <h3 class="text-sm font-semibold text-gray-700 mb-3">验证分数变化趋势</h3>
            <div class="relative h-40">
              <div class="absolute left-0 top-0 bottom-6 w-10 flex flex-col justify-between text-xs text-gray-400">
                <span>100</span>
                <span>50</span>
                <span>0</span>
              </div>
              <div class="ml-12 mr-4 h-full relative">
                <div class="absolute inset-0 flex flex-col justify-between">
                  <div v-for="i in 2" :key="i" class="border-t border-gray-100 h-0" />
                </div>
                <svg class="absolute inset-0 w-full h-full" :viewBox="`0 0 ${veriChartSvgWidth} 160`" preserveAspectRatio="none">
                  <polyline
                    :points="veriChartPoints"
                    fill="none"
                    stroke="#8b5cf6"
                    stroke-width="2"
                    stroke-linejoin="round"
                    stroke-linecap="round"
                  />
                </svg>
                <div class="absolute inset-0 flex items-end">
                  <div
                    v-for="(pt, idx) in verificationTimeline"
                    :key="idx"
                    class="flex-1 flex flex-col items-center"
                    style="height: 100%"
                  >
                    <div
                      class="w-3 h-3 rounded-full bg-purple-500 border-2 border-white shadow cursor-pointer hover:scale-150 transition-transform z-10"
                      :style="{ marginBottom: (pt.score / 100 * 120) + 'px' }"
                      :title="`${pt.date}: ${pt.score}分`"
                    />
                  </div>
                </div>
              </div>
              <div class="ml-12 mr-4 flex text-xs text-gray-400 mt-1">
                <div
                  v-for="(pt, idx) in verificationTimeline"
                  :key="idx"
                  class="flex-1 text-center truncate"
                  :title="pt.date"
                >
                  {{ idx === 0 || idx === verificationTimeline.length - 1 ? pt.date : '' }}
                </div>
              </div>
            </div>
          </div>

          <!-- Verification History List -->
          <div v-if="verificationHistory.length > 0" class="space-y-4">
            <div
              v-for="(veri, idx) in verificationHistory"
              :key="veri.executionId || idx"
              class="bg-white rounded-lg border border-gray-200 p-5"
            >
              <div class="flex items-start justify-between gap-4">
                <div class="flex items-center gap-3">
                  <span class="text-lg">{{ veri.isImprovement ? '✅' : '⚠️' }}</span>
                  <div>
                    <p class="text-sm font-medium text-gray-800">
                      {{ optimizationTypeLabel(veri.optimizationType || '') }}
                    </p>
                    <p class="text-xs text-gray-400">
                      {{ formatDate(veri.verifiedAt || veri.timestamp) }}
                    </p>
                  </div>
                </div>
                <div class="text-right">
                  <div class="flex items-center gap-2">
                    <span class="text-sm text-gray-500">{{ veri.beforeScore ?? '?' }}</span>
                    <span class="text-gray-400">→</span>
                    <span class="text-lg font-bold" :class="veri.delta > 0 ? 'text-green-600' : 'text-red-600'">
                      {{ veri.afterScore ?? '?' }}
                    </span>
                  </div>
                  <span
                    class="text-sm font-medium"
                    :class="veri.delta > 0 ? 'text-green-600' : veri.delta < 0 ? 'text-red-600' : 'text-gray-400'"
                  >
                    {{ veri.delta > 0 ? '+' : '' }}{{ veri.delta }}
                    {{ veri.isImprovement ? '↑' : '↓' }}
                  </span>
                </div>
              </div>

              <!-- Changed dimensions -->
              <div v-if="veri.changedDimensions && veri.changedDimensions.length > 0" class="mt-3 flex flex-wrap gap-2">
                <span
                  v-for="dim in veri.changedDimensions"
                  :key="dim"
                  class="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600"
                >
                  {{ dimLabelMap[dim] || dim }}
                </span>
              </div>

              <!-- Score breakdown columns (if available) -->
              <div v-if="veri.beforeDimensions || veri.afterDimensions" class="mt-3 grid grid-cols-2 gap-4">
                <div v-if="veri.beforeDimensions" class="text-xs space-y-1">
                  <p class="font-medium text-gray-500 mb-1">优化前</p>
                  <div v-for="(val, key) in veri.beforeDimensions" :key="'before-' + key" class="flex justify-between">
                    <span class="text-gray-400">{{ dimLabelMap[key as string] || key }}</span>
                    <span class="text-gray-600">{{ val }}</span>
                  </div>
                </div>
                <div v-if="veri.afterDimensions" class="text-xs space-y-1">
                  <p class="font-medium text-gray-500 mb-1">优化后</p>
                  <div v-for="(val, key) in veri.afterDimensions" :key="'after-' + key" class="flex justify-between">
                    <span class="text-gray-400">{{ dimLabelMap[key as string] || key }}</span>
                    <span class="text-gray-600">{{ val }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Loading state -->
          <div v-if="verificationLoading" class="flex items-center justify-center py-8">
            <div class="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            <span class="ml-3 text-sm text-gray-400">加载验证数据...</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ofetch } from 'ofetch'
import LoadingState from '~/design-system/components/LoadingState/index.vue'
import ErrorBanner from '~/design-system/components/ErrorBanner/index.vue'
import EmptyState from '~/design-system/components/EmptyState/index.vue'
import SuccessBanner from '~/design-system/components/SuccessBanner/index.vue'
import DSButton from '~/design-system/primitives/Button/index.vue'

definePageMeta({
  title: '扫描与验证历史',
})

// ── Types ──

interface Project {
  id: string
  name: string
  website: string
}

interface ScanRecord {
  scanId: string
  status: string
  overallScore: number | null
  durationMs?: number
  scanStartedAt: string | null
  scanFinishedAt: string | null
}

interface VerificationHistoryItem {
  executionId?: string
  verificationId?: string
  optimizationType?: string
  beforeScore?: number
  afterScore?: number
  delta: number
  isImprovement: boolean
  verifiedAt?: string
  timestamp?: string
  changedDimensions?: string[]
  beforeDimensions?: Record<string, number>
  afterDimensions?: Record<string, number>
}

interface VerificationPoint {
  date: string
  score: number
}

// ── Tab state ──

const tabs = [
  { id: 'scan', label: '扫描历史' },
  { id: 'verification', label: '验证结果' },
]
const activeTab = ref<'scan' | 'verification'>('scan')

// ── Common state ──

const router = useRouter()
const loading = ref(false)
const error = ref<string | null>(null)

const projects = ref<Project[]>([])
const selectedProjectId = ref('')
const hasProjects = computed(() => projects.value.length > 0)

// ── Scan history state ──

const scanList = ref<ScanRecord[]>([])
const chartData = computed(() => {
  return scanList.value
    .filter(s => s.status === 'completed' && s.overallScore !== null)
    .slice()
    .reverse()
    .map(s => ({
      score: s.overallScore || 0,
      date: formatShortDate(s.scanFinishedAt || s.scanStartedAt),
    }))
})
const scanChartSvgWidth = computed(() => Math.max(200, (chartData.value.length - 1) * 60))
const scanChartPoints = computed(() => {
  if (chartData.value.length < 2) return ''
  return chartData.value
    .map((pt, idx) => {
      const x = (idx / (chartData.value.length - 1)) * scanChartSvgWidth.value
      const y = 216 - (pt.score / 100 * 168) - 24
      return `${x},${y}`
    })
    .join(' ')
})

// ── Verification state ──

const verificationHistory = ref<VerificationHistoryItem[]>([])
const verificationTimeline = ref<VerificationPoint[]>([])
const verificationLoading = ref(false)
const verificationRunning = ref(false)
const verificationSuccess = ref(false)
const verificationDelta = ref(0)

const veriChartSvgWidth = computed(() => Math.max(200, (verificationTimeline.value.length - 1) * 60))
const veriChartPoints = computed(() => {
  if (verificationTimeline.value.length < 2) return ''
  return verificationTimeline.value
    .map((pt, idx) => {
      const x = (idx / (verificationTimeline.value.length - 1)) * veriChartSvgWidth.value
      const y = 160 - (pt.score / 100 * 120) - 16
      return `${x},${y}`
    })
    .join(' ')
})

// Label mapping
const dimLabelMap: Record<string, string> = {
  visibility: '可见度',
  authority: '权威性',
  content: '内容质量',
  website: '官网表现',
  knowledge: '知识条目',
}

// ── Helpers ──

function getToken(): string {
  try {
    const authStore = (window as any).__NUXT__?.state?.auth
    if (authStore?.token) return authStore.token
  } catch {}
  return ''
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function formatShortDate(dateStr?: string | null): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return `${String(d.getMonth() + 1)}/${String(d.getDate()).padStart(2, '0')}`
}

function scanScoreColor(score: number): { text: string } {
  if (score >= 80) return { text: 'text-green-600' }
  if (score >= 60) return { text: 'text-yellow-600' }
  if (score >= 40) return { text: 'text-orange-600' }
  return { text: 'text-red-600' }
}

function optimizationTypeLabel(type: string): string {
  const map: Record<string, string> = {
    knowledge_creation: '知识创建',
    content_optimization: '内容优化',
    entity_building: '实体构建',
    website_optimization: '官网优化',
    claim_validation: '声明验证',
  }
  return map[type] || type || '未知类型'
}

// ── Data Loading ──

async function loadData() {
  loading.value = true
  error.value = null
  try {
    const token = getToken()
    const res: any = await ofetch('/api/v1/geo/projects', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    projects.value = (res.data || res || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      website: p.website,
    }))
    if (projects.value.length > 0 && !selectedProjectId.value) {
      selectedProjectId.value = projects.value[0].id
      await loadScanData()
      await loadVerificationData()
    }
  } catch (err: any) {
    error.value = err.message || '加载失败'
  } finally {
    loading.value = false
  }
}

async function loadScanData() {
  if (!selectedProjectId.value) return
  try {
    const token = getToken()
    const res: any = await ofetch(`/api/v1/geo/projects/${selectedProjectId.value}/scans`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    scanList.value = (res.data || []).map((s: any) => ({
      scanId: s.scanId,
      status: s.status,
      overallScore: s.overallScore,
      durationMs: s.durationMs,
      scanStartedAt: s.scanStartedAt,
      scanFinishedAt: s.scanFinishedAt,
    }))
  } catch (err: any) {
    error.value = err.message || '加载扫描数据失败'
  }
}

async function loadVerificationData() {
  if (!selectedProjectId.value) return
  verificationLoading.value = true
  try {
    const token = getToken()
    const headers = token ? { Authorization: `Bearer ${token}` } : {}

    // Load timeline
    try {
      const tlRes: any = await ofetch(`/api/geo/verification/timeline/${selectedProjectId.value}`, { headers })
      verificationTimeline.value = (tlRes.data || []).map((e: any) => ({
        date: formatShortDate(e.timestamp),
        score: e.detail?.afterScore || e.detail?.delta || 0,
      }))
    } catch {
      verificationTimeline.value = []
    }

    // Load history
    try {
      const histRes: any = await ofetch(`/api/geo/verification/history/${selectedProjectId.value}`, { headers })
      verificationHistory.value = (histRes.data || []).map((h: any) => {
        const exec = h.execution || {}
        return {
          executionId: exec.id,
          verificationId: h.id,
          optimizationType: exec.optimizationType,
          beforeScore: exec.beforeScore,
          afterScore: exec.afterScore,
          delta: h.delta ?? exec.scoreDelta ?? 0,
          isImprovement: h.isImprovement ?? false,
          verifiedAt: h.verifiedAt,
          timestamp: h.verifiedAt || exec.completedAt || exec.startedAt,
          changedDimensions: exec.changedDimensions,
          beforeDimensions: exec.beforeDimensions,
          afterDimensions: exec.afterDimensions,
        }
      })
    } catch {
      verificationHistory.value = []
    }
  } catch {
    // Silently fail for verification data
  } finally {
    verificationLoading.value = false
  }
}

async function runVerification() {
  if (!selectedProjectId.value) return
  verificationRunning.value = true
  verificationSuccess.value = false
  try {
    const token = getToken()
    const res: any = await ofetch('/api/geo/verification/run', {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : {},
      body: {
        projectId: selectedProjectId.value,
        optimizationType: 'general',
      },
    })
    verificationDelta.value = 0
    verificationSuccess.value = true
    // Refresh verification data
    await loadVerificationData()
  } catch (err: any) {
    error.value = err.message || '验证执行失败'
  } finally {
    verificationRunning.value = false
  }
}

async function onBrandChange() {
  error.value = null
  scanList.value = []
  verificationHistory.value = []
  verificationTimeline.value = []
  await Promise.all([loadScanData(), loadVerificationData()])
}

function switchTab(tabId: 'scan' | 'verification') {
  activeTab.value = tabId
}

function goToDashboard() {
  router.push('/workspace/geo/dashboard')
}

function goToDetail() {
  if (selectedProjectId.value) {
    router.push(`/workspace/geo/detail/${selectedProjectId.value}`)
  }
}

onMounted(loadData)
</script>
