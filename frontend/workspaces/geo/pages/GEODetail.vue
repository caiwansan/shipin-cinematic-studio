<template>
  <div class="max-w-6xl mx-auto px-4 py-6">
    <!-- ===== STATE: Loading ===== -->
    <LoadingState
      v-if="store.isLoading && !store.hasCurrentProject"
      title="加载品牌详情"
      :steps="[
        { label: '获取项目信息...', active: true },
        { label: '加载扫描数据...' },
      ]"
    />

    <!-- ===== STATE: Error (no data yet) ===== -->
    <ErrorBanner
      v-else-if="store.error && !store.hasCurrentProject"
      title="无法加载品牌详情"
      message="请检查项目是否存在或网络连接后重试"
    >
      <DSButton variant="primary" @click="handleRetry" :disabled="store.isLoading">
        重试
      </DSButton>
      <DSButton variant="secondary" @click="goBack">
        返回列表
      </DSButton>
    </ErrorBanner>

    <!-- ===== STATE: Data ===== -->
    <template v-else-if="store.hasCurrentProject">
      <!-- Navigation Buttons -->
      <div class="flex items-center gap-3 mb-4">
        <button
          class="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
          @click="goBack"
        >
          ← 返回品牌列表
        </button>
        <NuxtLink
          to="/"
          class="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
        >
          🏠 返回首页
        </NuxtLink>
      </div>

      <!-- Brand Header -->
      <div class="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <div class="flex items-start justify-between flex-wrap gap-4">
          <div class="flex-1 min-w-0">
            <h1 class="text-2xl font-bold text-gray-900">{{ store.currentProject!.name }}</h1>
            <p class="text-gray-500 mt-1">{{ store.currentProject!.website }}</p>
            <div class="mt-2 flex items-center gap-3 text-sm text-gray-400">
              <span v-if="store.currentProject!.industry">🏢 {{ store.currentProject!.industry }}</span>
              <span v-if="store.currentProject!.keywords">🏷️ {{ store.currentProject!.keywords }}</span>
            </div>
          </div>
          <!-- Overall Score Badge -->
          <div v-if="store.hasScanResult" class="flex-shrink-0 text-center">
            <div
              class="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold mx-auto"
              :class="scoreColor(store.latestScanScore)"
            >
              {{ store.latestScanScore }}
            </div>
            <p class="text-xs text-gray-400 mt-1">综合得分</p>
          </div>
          <!-- New Scan Button -->
          <DSButton
            variant="primary"
            :disabled="isScanning"
            @click="handleNewScan"
          >
            {{ isScanning ? '扫描中...' : '新扫描' }}
          </DSButton>
        </div>
      </div>

      <!-- Error Banner (recoverable) -->
      <div v-if="store.error" class="mb-4">
        <ErrorBanner
          :title="store.error"
          message=""
          dismissible
          @dismiss="store.clearError()"
        />
      </div>

      <!-- Scan Progress -->
      <div
        v-if="store.isScanning"
        class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-center gap-3"
      >
        <div class="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <span class="text-sm text-blue-700">扫描正在进行中，预计约 90 秒完成...</span>
      </div>

      <!-- Tabs (Pure CSS) -->
      <div class="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div class="flex border-b border-gray-200 bg-white">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            class="flex-1 px-4 py-3 text-sm font-medium transition-colors relative"
            :class="activeTab === tab.id ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'"
            @click="activeTab = tab.id"
          >
            {{ tab.label }}
            <span
              v-if="activeTab === tab.id"
              class="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500"
            />
          </button>
        </div>

        <!-- ===== TAB: 概览 (Overview) ===== -->
        <div v-if="activeTab === 'overview'" class="p-6">
          <!-- No Scan Yet -->
          <EmptyState
            v-if="!store.hasScanResult && !store.isScanning"
            icon="📊"
            title="暂无扫描数据"
            description="点击「新扫描」按钮开始你的第一次品牌扫描分析"
          >
            <DSButton variant="primary" @click="handleNewScan">开始扫描</DSButton>
          </EmptyState>

          <template v-if="store.hasScanResult">
            <!-- 综合评分大数字 -->
            <div class="flex flex-col items-center mb-8">
              <div
                class="w-28 h-28 rounded-full flex items-center justify-center text-4xl font-bold"
                :class="scoreColor(store.latestScanScore)"
              >
                {{ store.latestScanScore }}
              </div>
              <div class="mt-3 text-lg font-semibold" :class="gradeColor(store.latestScanScore)">
                {{ gradeLabel(store.latestScanScore) }}
              </div>
              <div class="text-sm text-gray-400 mt-1">综合评分</div>
            </div>

            <!-- 四维评分卡片 -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div
                v-for="dim in store.currentScanResult!.dimensions"
                :key="dim.id"
                class="bg-white rounded-lg border border-gray-200 p-4"
              >
                <div class="flex items-center justify-between mb-2">
                  <span class="text-sm font-medium text-gray-700">{{ store.dimensionLabels[dim.id] || dim.label }}</span>
                  <span class="text-lg font-bold" :class="dimScoreColor(dim.score)">{{ dim.score }}</span>
                </div>
                <div class="w-full bg-gray-100 rounded-full h-2">
                  <div
                    class="h-2 rounded-full transition-all duration-500"
                    :class="dimBarColor(dim.score)"
                    :style="{ width: Math.min(100, dim.score) + '%' }"
                  />
                </div>
                <p v-if="dim.description" class="text-xs text-gray-400 mt-2">{{ dim.description }}</p>
              </div>
            </div>

            <!-- 扫描状态 + 时间信息 -->
            <div class="bg-gray-50 rounded-lg border border-gray-200 p-4">
              <h3 class="text-sm font-medium text-gray-700 mb-3">扫描信息</h3>
              <div class="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span class="text-gray-400">状态：</span>
                  <span class="text-gray-700">{{ statusLabel(store.currentScanResult!.status) }}</span>
                </div>
                <div>
                  <span class="text-gray-400">开始时间：</span>
                  <span class="text-gray-700">{{ formatDate(store.currentScanResult!.startedAt) }}</span>
                </div>
                <div>
                  <span class="text-gray-400">完成时间：</span>
                  <span class="text-gray-700">{{ formatDate(store.currentScanResult!.completedAt) }}</span>
                </div>
                <div>
                  <span class="text-gray-400">综合评分：</span>
                  <span class="text-gray-700">{{ store.latestScanScore }} / 100</span>
                </div>
              </div>
            </div>
          </template>
        </div>

        <!-- ===== TAB: 报告 (Report) ===== -->
        <div v-if="activeTab === 'report'" class="p-6 space-y-6">
          <!-- No Scan Yet -->
          <EmptyState
            v-if="!store.hasScanResult && !store.isScanning"
            icon="📊"
            title="暂无扫描数据"
            description="点击「新扫描」按钮开始你的第一次品牌扫描分析"
          >
            <DSButton variant="primary" @click="handleNewScan">开始扫描</DSButton>
          </EmptyState>

          <template v-if="store.hasScanResult">
            <!-- 4 ScoreCards -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div
                v-for="dim in store.currentScanResult!.dimensions"
                :key="dim.id"
                class="bg-white rounded-lg border border-gray-200 p-4"
              >
                <ScoreCard
                  :label="store.dimensionLabels[dim.id] || dim.label"
                  :score="dim.score"
                  :max-score="dim.maxScore"
                  :description="dim.description"
                />
              </div>
            </div>

            <!-- Summary -->
            <div class="bg-white rounded-lg border border-gray-200 p-6">
              <h3 class="text-lg font-semibold text-gray-900 mb-2">综合评分说明</h3>
              <p class="text-gray-600 text-sm leading-relaxed">{{ store.currentScanResult!.summary }}</p>
            </div>

            <!-- AI Response Overview -->
            <div class="bg-white rounded-lg border border-gray-200 p-6">
              <h3 class="text-lg font-semibold text-gray-900 mb-4">AI 响应概览</h3>
              <div class="space-y-2">
                <div
                  v-for="dim in store.currentScanResult!.dimensions"
                  :key="'ai-' + dim.id"
                  class="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg"
                >
                  <span class="text-sm text-gray-700">{{ store.dimensionLabels[dim.id] || dim.label }}</span>
                  <span class="text-sm" :class="dim.score > 0 ? 'text-green-600' : 'text-red-600'">
                    {{ dim.score > 0 ? '✅ 成功' : '❌ 失败' }}
                  </span>
                </div>
              </div>
            </div>
          </template>
        </div>

        <!-- ===== TAB: 优化 (Optimization) ===== -->
        <div v-if="activeTab === 'optimization'" class="p-6">
          <!-- No Scan Yet -->
          <EmptyState
            v-if="!store.hasScanResult && !store.isScanning"
            icon="📊"
            title="暂无扫描数据"
            description="请先完成一次扫描后再查看优化建议"
          >
            <DSButton variant="primary" @click="handleNewScan">开始扫描</DSButton>
          </EmptyState>

          <template v-if="store.hasScanResult">
            <div class="bg-white rounded-lg border border-gray-200 p-6">
              <!-- Header + Counts -->
              <div class="flex items-center justify-between mb-4">
                <div>
                  <h3 class="text-lg font-semibold text-gray-900">优化建议</h3>
                  <div v-if="store.hasOptimizeSuggestions" class="flex items-center gap-3 mt-1 text-sm">
                    <span class="text-green-600">已应用：{{ appliedCount }}</span>
                    <span class="text-gray-400">/</span>
                    <span class="text-gray-600">待处理：{{ pendingCount }}</span>
                  </div>
                </div>
                <DSButton
                  variant="secondary"
                  :disabled="store.isOptimizing"
                  @click="handleOptimize"
                >
                  {{ store.isOptimizing ? '分析中...' : (store.hasOptimizeSuggestions ? '刷新建议' : '获取优化建议') }}
                </DSButton>
              </div>

              <!-- Optimize Loading -->
              <div v-if="store.isOptimizing" class="flex items-center gap-2 text-sm text-gray-500 py-4">
                <div class="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                正在分析优化建议...
              </div>

              <!-- No Suggestions Yet -->
              <p
                v-else-if="!store.hasOptimizeSuggestions"
                class="text-sm text-gray-400 py-4"
              >
                点击上方按钮获取 AI 优化建议
              </p>

              <!-- Suggestions List -->
              <div v-else class="space-y-4">
                <div
                  v-for="suggestion in store.optimizeSuggestions"
                  :key="suggestion.id"
                  class="border border-gray-100 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  :class="{ 'border-green-200 bg-green-50/30': suggestion.applied }"
                >
                  <div class="flex items-start justify-between gap-3">
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2">
                        <h4 class="text-sm font-medium text-gray-900">{{ suggestion.title }}</h4>
                        <span
                          v-if="suggestion.applied"
                          class="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded border border-green-200"
                        >
                          已应用
                        </span>
                      </div>
                      <p class="text-sm text-gray-500 mt-1">{{ suggestion.description }}</p>
                      <div class="mt-2 flex items-center gap-2">
                        <span class="text-xs font-medium text-blue-600">
                          预计影响: +{{ suggestion.expectedImpact }}
                        </span>
                      </div>
                    </div>
                    <DSButton
                      v-if="!suggestion.applied"
                      variant="primary"
                      size="sm"
                      @click="handleApply(suggestion.id)"
                    >
                      应用
                    </DSButton>
                    <span
                      v-else
                      class="text-xs text-green-600 bg-green-50 px-3 py-1.5 rounded border border-green-200"
                    >
                      ✓ 已应用
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </div>

        <!-- ===== TAB: 历史 (History) ===== -->
        <div v-if="activeTab === 'history'" class="p-6 space-y-4">
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold text-gray-900">扫描历史</h3>
            <DSButton
              variant="primary"
              :disabled="store.isScanning"
              @click="handleNewScan"
            >
              {{ store.isScanning ? '扫描中...' : '新扫描' }}
            </DSButton>
          </div>

          <!-- Scan Progress -->
          <div
            v-if="store.isScanning"
            class="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center gap-3"
          >
            <div class="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span class="text-sm text-blue-700">扫描进行中...</span>
          </div>

          <!-- Empty History -->
          <div v-if="store.scanHistory.length === 0 && !store.isScanning">
            <EmptyState
              icon="🕐"
              title="暂无扫描记录"
              description="开始第一次扫描以查看历史记录"
            >
              <DSButton variant="primary" @click="handleNewScan">开始扫描</DSButton>
            </EmptyState>
          </div>

          <!-- History List -->
          <div v-else class="space-y-3">
            <div
              v-for="scan in store.scanHistory"
              :key="scan.scanId"
              class="bg-white rounded-lg border border-gray-200 p-4 flex items-center justify-between cursor-pointer hover:border-blue-300 transition-colors"
              @click="viewScanReport(scan.scanId)"
            >
              <div class="flex items-center gap-4">
                <!-- Status Icon -->
                <div class="flex-shrink-0">
                  <span v-if="scan.status === 'completed'" class="text-green-500 text-lg">✅</span>
                  <span v-else-if="scan.status === 'failed'" class="text-red-500 text-lg">❌</span>
                  <span v-else class="text-yellow-500 text-lg">⏳</span>
                </div>
                <div>
                  <p class="text-sm font-medium text-gray-900">
                    {{ formatDate(scan.startedAt) }}
                  </p>
                  <p class="text-xs text-gray-400">
                    {{ statusLabel(scan.status) }}
                    <span v-if="scan.estimatedSeconds"> · 预计 {{ scan.estimatedSeconds }}s</span>
                  </p>
                </div>
              </div>
              <div class="flex items-center gap-3">
                <span
                  v-if="scan.overallScore !== undefined && scan.overallScore !== null"
                  class="text-lg font-bold"
                  :class="scoreColor(scan.overallScore)"
                >
                  {{ scan.overallScore }}
                </span>
                <span class="text-xs text-blue-500">查看详情 →</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useScanStore } from '../stores/useScanStore'
import LoadingState from '~/design-system/components/LoadingState/index.vue'
import ErrorBanner from '~/design-system/components/ErrorBanner/index.vue'
import EmptyState from '~/design-system/components/EmptyState/index.vue'
import ScoreCard from '~/design-system/components/ScoreCard/index.vue'
import DSButton from '~/design-system/primitives/Button/index.vue'

definePageMeta({
  title: '品牌详情',
})

const router = useRouter()
const route = useRoute()
const store = useScanStore()

const tabs = [
  { id: 'overview', label: '概览' },
  { id: 'report', label: '报告' },
  { id: 'optimization', label: '优化' },
  { id: 'history', label: '历史' },
]
const activeTab = ref<'overview' | 'report' | 'optimization' | 'history'>('overview')
const latestScanId = ref<string | null>(null)
const isScanning = ref(false)
const scanPollCount = ref(0)

const projectId = computed(() => route.params.id as string)

const appliedCount = computed(() => store.optimizeSuggestions.filter(s => s.applied).length)
const pendingCount = computed(() => store.optimizeSuggestions.filter(s => !s.applied).length)

onMounted(async () => {
  await store.loadProject(projectId.value)
})

async function handleRetry() {
  store.clearError()
  await store.loadProject(projectId.value)
}

function goBack() {
  router.push('/workspace/geo/dashboard')
}

async function handleNewScan() {
  const result = await store.startScan(projectId.value)
  if (!result) return

  latestScanId.value = result.scanId
  store.addScanHistory(projectId.value, {
    scanId: result.scanId,
    status: 'pending',
    startedAt: new Date().toISOString(),
  })

  // Start polling
  isScanning.value = true
  scanPollCount.value = 0

  const poll = async () => {
    if (scanPollCount.value >= 60) { // 5 min max
      isScanning.value = false
      scanPollCount.value = 0
      const idx = store.scanHistory.findIndex((s) => s.scanId === result.scanId)
      if (idx >= 0) store.scanHistory[idx].status = 'failed'
      return
    }
    scanPollCount.value++
    await store.loadScanResult(projectId.value, result.scanId)
    if (store.currentScanResult) {
      const status = store.currentScanResult.status
      const idx = store.scanHistory.findIndex((s) => s.scanId === result.scanId)
      if (idx >= 0) {
        store.scanHistory[idx].status = status
        if (status === 'completed' || status === 'failed') {
          store.scanHistory[idx].overallScore = store.currentScanResult.overallScore || 0
          store.scanHistory[idx].completedAt = store.currentScanResult.completedAt
          isScanning.value = false
          scanPollCount.value = 0
          // Auto switch to overview tab
          activeTab.value = 'overview'
          return // done
        }
      }
    }
    setTimeout(poll, 5000)
  }
  setTimeout(poll, 3000) // start after 3s delay
}

async function handleOptimize() {
  if (!latestScanId.value) return
  await store.loadOptimizeSuggestions(projectId.value, latestScanId.value)
}

async function handleApply(suggestionId: string) {
  if (!latestScanId.value) return
  await store.markOptimizationApplied(projectId.value, latestScanId.value, suggestionId)
}

async function viewScanReport(scanId: string) {
  latestScanId.value = scanId
  await store.loadScanResult(projectId.value, scanId)
  activeTab.value = 'overview'
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: '等待中',
    running: '运行中',
    completed: '已完成',
    failed: '失败',
  }
  return labels[status] || status
}

function scoreColor(score: number): string {
  if (score >= 80) return 'text-green-600'
  if (score >= 60) return 'text-yellow-600'
  return 'text-red-600'
}

function dimScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600'
  if (score >= 60) return 'text-yellow-600'
  if (score >= 40) return 'text-orange-500'
  return 'text-red-600'
}

function dimBarColor(score: number): string {
  if (score >= 80) return 'bg-green-500'
  if (score >= 60) return 'bg-yellow-500'
  if (score >= 40) return 'bg-orange-400'
  return 'bg-red-500'
}

function gradeLabel(score: number): string {
  if (score >= 80) return '优秀'
  if (score >= 60) return '良好'
  if (score >= 40) return '需优化'
  return '危险'
}

function gradeColor(score: number): string {
  if (score >= 80) return 'text-green-600'
  if (score >= 60) return 'text-yellow-600'
  if (score >= 40) return 'text-orange-500'
  return 'text-red-600'
}
</script>
