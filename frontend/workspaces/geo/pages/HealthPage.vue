<template>
  <div class="max-w-6xl mx-auto px-4 py-6">
    <!-- ===== STATE: Loading ===== -->
    <LoadingState
      v-if="loading && !hasProjects"
      title="Loading Assessment..."
      :steps="[
        { label: 'Fetching brand projects...', active: true },
        { label: 'Calculating ADI metrics...' },
      ]"
    />

    <!-- ===== STATE: Error (no data yet) ===== -->
    <ErrorBanner
      v-else-if="error && !hasProjects"
      title="Unable to load assessment data"
      message="Please check your connection and try again"
    >
      <DSButton variant="primary" @click="loadData" :disabled="loading">Retry</DSButton>
    </ErrorBanner>

    <!-- ===== STATE: Empty (no projects) ===== -->
    <EmptyState
      v-else-if="!hasProjects && !loading"
      icon="🔍"
      title="No brand projects yet"
      description="Create a project in Brand Scan to begin assessment"
    >
      <DSButton variant="primary" @click="goToDashboard">Create Brand</DSButton>
    </EmptyState>

    <!-- ===== STATE: Data ===== -->
    <template v-else-if="hasProjects">
      <!-- Navigation -->
      <div class="flex items-center gap-3 mb-4">
        <NuxtLink to="/workspace/geo/dashboard" class="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
          📋 Brand List
        </NuxtLink>
        <NuxtLink to="/workspace/geo/knowledge" class="text-sm text-blue-600 hover:text-blue-700">
          📖 Knowledge Evaluation
        </NuxtLink>
      </div>

      <!-- Brand Selector -->
      <div class="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <label class="block text-sm font-medium text-gray-700 mb-2">Select Brand</label>
        <div class="flex items-center gap-3">
          <select
            v-model="selectedProjectId"
            class="border border-gray-300 rounded-lg px-3 py-2 text-sm flex-1 max-w-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            @change="onBrandChange"
          >
            <option value="" disabled>Select a brand</option>
            <option v-for="p in projects" :key="p.id" :value="p.id">
              {{ p.name }} ({{ p.website }})
            </option>
          </select>
          <DSButton variant="secondary" size="sm" @click="refreshAll" :disabled="refreshing">
            {{ refreshing ? 'Refreshing…' : 'Refresh' }}
          </DSButton>
        </div>
      </div>

      <!-- Error Banner (recoverable) -->
      <div v-if="error" class="mb-4">
        <ErrorBanner :title="error" message="" dismissible @dismiss="error = null">
          <DSButton variant="primary" @click="refreshAll">Retry</DSButton>
        </ErrorBanner>
      </div>

      <!-- No data state -->
      <EmptyState
        v-if="noData && !loading"
        icon="📊"
        title="No assessment data yet"
        description="This brand has not been scanned yet"
      >
        <DSButton variant="primary" @click="goToDetail">Start Scan</DSButton>
      </EmptyState>

      <!-- ====== MAIN REPORT ====== -->
      <template v-if="hasReportData">
        <!-- ===== Section 1: ADI Overall Score (Primary KPI) ===== -->
        <div class="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <div class="flex items-start justify-between flex-wrap gap-4">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <h1 class="text-2xl font-bold text-gray-900">Assessment</h1>
                <span class="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">ADI</span>
              </div>
              <p class="text-sm text-gray-500 mt-1">
                {{ currentProject?.name || 'Brand' }} — Assessment Discovery Index
              </p>
              <p v-if="store.explanation.summary" class="text-xs text-gray-400 mt-1 max-w-lg">
                {{ store.explanation.summary }}
              </p>
              <p class="text-xs text-gray-400 mt-0.5">
                Last updated: {{ formatDate(store.lastUpdated) }}
              </p>
            </div>
            <div class="text-center flex-shrink-0">
              <div class="relative w-24 h-24 mx-auto">
                <svg class="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="#e5e7eb" stroke-width="8" />
                  <circle
                    cx="50" cy="50" r="42"
                    fill="none"
                    :stroke="overallScoreColor"
                    stroke-width="8"
                    stroke-linecap="round"
                    :stroke-dasharray="`${store.adiScore / 100 * 264} 264`"
                    class="transition-all duration-1000"
                  />
                </svg>
                <div class="absolute inset-0 flex items-center justify-center">
                  <span class="text-3xl font-bold" :class="overallScoreTextColor">{{ store.adiScore }}</span>
                </div>
              </div>
              <div class="mt-2 flex items-center justify-center gap-1.5">
                <span
                  class="text-sm font-medium px-3 py-0.5 rounded-full"
                  :class="overallScoreBadgeColor"
                >
                  {{ scoreLabel(store.adiScore) }}
                </span>
                <span
                  v-if="store.scoreChange !== 0"
                  class="text-xs font-medium"
                  :class="store.scoreChange > 0 ? 'text-green-600' : 'text-red-600'"
                >
                  {{ store.scoreChange > 0 ? '↑' : '↓' }} {{ Math.abs(store.scoreChange) }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- ===== Section 2: ADI Sub-dimensions ===== -->
        <div class="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 class="text-lg font-semibold text-gray-900 mb-4">ADI Dimensions</h2>
          <div class="grid gap-6 md:grid-cols-3">
            <div
              v-for="dim in store.dimensions"
              :key="dim.id"
              class="border border-gray-100 rounded-lg p-4"
            >
              <!-- Dimension header -->
              <div class="flex items-center justify-between mb-3">
                <div>
                  <h3 class="text-base font-semibold text-gray-800">{{ dim.label }}</h3>
                  <p class="text-xs text-gray-400 mt-0.5">{{ dim.description }}</p>
                </div>
                <div class="text-center flex-shrink-0 ml-2">
                  <div class="relative w-16 h-16 mx-auto">
                    <svg class="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                      <circle cx="32" cy="32" r="26" fill="none" stroke="#e5e7eb" stroke-width="5" />
                      <circle
                        cx="32" cy="32" r="26"
                        fill="none"
                        :stroke="dimScoreColor(dim.score)"
                        stroke-width="5"
                        stroke-linecap="round"
                        :stroke-dasharray="`${dim.score / 100 * 163} 163`"
                        class="transition-all duration-700"
                      />
                    </svg>
                    <div class="absolute inset-0 flex items-center justify-center">
                      <span class="text-sm font-bold" :class="dimScoreTextColor(dim.score)">{{ dim.score }}</span>
                    </div>
                  </div>
                </div>
              </div>
              <!-- Progress bar -->
              <div class="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden mb-3">
                <div
                  class="h-full rounded-full transition-all duration-700"
                  :style="{ width: dim.score + '%', backgroundColor: dimScoreColor(dim.score) }"
                />
              </div>
              <!-- Detail items -->
              <div v-if="dim.details.length > 0" class="space-y-2">
                <div
                  v-for="item in dim.details"
                  :key="item.label"
                  class="flex items-center gap-2 text-xs"
                >
                  <span class="flex-shrink-0 w-4 text-center text-xs">
                    {{ item.status === 'good' ? '🟢' : item.status === 'neutral' ? '🟡' : '🔴' }}
                  </span>
                  <span class="text-gray-600 flex-1 min-w-0 truncate">{{ item.label }}</span>
                  <span class="text-gray-400 font-medium">{{ item.value }}</span>
                  <span class="text-gray-300 hidden sm:inline truncate max-w-[100px]" :title="item.reason">{{ item.reason }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ===== Section 3: Strengths & Improvements ===== -->
        <div v-if="store.explanation.strengths.length > 0 || store.explanation.improvements.length > 0" class="grid gap-6 md:grid-cols-2 mb-6">
          <!-- Strengths -->
          <div v-if="store.explanation.strengths.length > 0" class="bg-white rounded-lg border border-gray-200 p-6">
            <h2 class="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span>✅</span> Strengths
            </h2>
            <ul class="space-y-2">
              <li
                v-for="(item, idx) in store.explanation.strengths"
                :key="idx"
                class="flex items-start gap-2 text-sm text-gray-700"
              >
                <span class="text-green-500 mt-0.5 flex-shrink-0">•</span>
                <span>{{ item }}</span>
              </li>
            </ul>
          </div>
          <!-- Improvements -->
          <div v-if="store.explanation.improvements.length > 0" class="bg-white rounded-lg border border-gray-200 p-6">
            <h2 class="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span>💡</span> Areas to Improve
            </h2>
            <ul class="space-y-2">
              <li
                v-for="(item, idx) in store.explanation.improvements"
                :key="idx"
                class="flex items-start gap-2 text-sm text-gray-700"
              >
                <span class="text-orange-500 mt-0.5 flex-shrink-0">•</span>
                <span>{{ item }}</span>
              </li>
            </ul>
          </div>
        </div>

        <!-- ===== Section 4: Timeline ===== -->
        <div class="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-semibold text-gray-900">ADI Trend</h2>
            <div class="flex items-center gap-2">
              <button
                v-for="r in rangeOptions"
                :key="r.value"
                class="text-xs px-2.5 py-1 rounded border transition-colors"
                :class="timelineRange === r.value ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'"
                @click="setTimelineRange(r.value)"
              >
                {{ r.label }}
              </button>
            </div>
          </div>

          <div v-if="timelineData.length >= 2" class="relative h-52">
            <!-- Y axis labels -->
            <div class="absolute left-0 top-0 bottom-6 w-10 flex flex-col justify-between text-xs text-gray-400">
              <span>100</span>
              <span>75</span>
              <span>50</span>
              <span>25</span>
              <span>0</span>
            </div>
            <!-- Chart area -->
            <div class="ml-12 mr-4 h-full relative">
              <!-- Grid lines -->
              <div class="absolute inset-0 flex flex-col justify-between">
                <div v-for="i in 4" :key="i" class="border-t border-gray-100 h-0" />
              </div>
              <!-- SVG line -->
              <svg class="absolute inset-0 w-full h-full" :viewBox="`0 0 ${chartSvgWidth} 208`" preserveAspectRatio="none">
                <!-- Area fill -->
                <path
                  :d="chartAreaPath"
                  fill="rgba(59, 130, 246, 0.08)"
                />
                <!-- Polyline -->
                <polyline
                  :points="chartPoints"
                  fill="none"
                  stroke="#3b82f6"
                  stroke-width="2.5"
                  stroke-linejoin="round"
                  stroke-linecap="round"
                />
                <!-- Dots -->
                <circle
                  v-for="(pt, idx) in timelineData"
                  :key="idx"
                  :cx="chartPointX(idx)"
                  :cy="chartPointY(pt.score)"
                  r="4"
                  fill="#3b82f6"
                  stroke="white"
                  stroke-width="2"
                  class="cursor-pointer hover:r-6 transition-all"
                >
                  <title>{{ pt.date }}: {{ pt.score }}</title>
                </circle>
              </svg>
              <!-- Bottom labels -->
              <div class="absolute bottom-0 left-0 right-0 flex text-xs text-gray-400">
                <div
                  v-for="(pt, idx) in timelineData"
                  :key="idx"
                  class="flex-1 text-center truncate"
                  :title="pt.date"
                >
                  {{ shouldShowXLabel(idx) ? pt.date : '' }}
                </div>
              </div>
            </div>
          </div>
          <div v-else-if="timelineLoading" class="flex items-center justify-center py-12">
            <div class="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span class="ml-3 text-sm text-gray-400">Loading trend data...</span>
          </div>
          <div v-else class="text-center py-8 text-sm text-gray-400">
            {{ timelineData.length === 0 ? 'No trend data yet' : 'At least 2 points needed for chart' }}
          </div>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ofetch } from 'ofetch'
import { useAdiStore } from '../stores/useAdiStore'
import LoadingState from '~/design-system/components/LoadingState/index.vue'
import ErrorBanner from '~/design-system/components/ErrorBanner/index.vue'
import EmptyState from '~/design-system/components/EmptyState/index.vue'
import DSButton from '~/design-system/primitives/Button/index.vue'

definePageMeta({
  title: 'Assessment (ADI)',
})

// ── Types ──

interface Project {
  id: string
  name: string
  website: string
  industry?: string
  keywords?: string
}

interface TimelinePoint {
  date: string
  score: number
}

// ── State ──

const router = useRouter()
const store = useAdiStore()
const loading = ref(false)
const refreshing = ref(false)
const error = ref<string | null>(null)

// Projects
const projects = ref<Project[]>([])
const selectedProjectId = ref('')
const currentProject = computed(() => projects.value.find(p => p.id === selectedProjectId.value))
const hasProjects = computed(() => projects.value.length > 0)

// Report state
const overallScore = computed(() => store.adiScore)
const noData = computed(() => {
  if (!selectedProjectId.value) return false
  if (loading) return false
  return !store.hasDimensions
})
const hasReportData = computed(() => {
  if (loading && !hasProjects.value) return false
  return store.hasDimensions
})

// Timeline
const timelineRange = ref<'7d' | '30d' | '90d' | '1y'>('7d')
const timelineData = ref<TimelinePoint[]>([])
const timelineLoading = ref(false)
const rangeOptions = [
  { label: '7d', value: '7d' as const },
  { label: '30d', value: '30d' as const },
  { label: '90d', value: '90d' as const },
  { label: '1y', value: '1y' as const },
]

// ── Computed ──

const overallScoreColor = computed(() => {
  if (store.adiScore >= 80) return '#22c55e'
  if (store.adiScore >= 60) return '#eab308'
  if (store.adiScore >= 40) return '#f97316'
  return '#ef4444'
})
const overallScoreTextColor = computed(() => {
  if (store.adiScore >= 80) return 'text-green-600'
  if (store.adiScore >= 60) return 'text-yellow-600'
  if (store.adiScore >= 40) return 'text-orange-600'
  return 'text-red-600'
})
const overallScoreBadgeColor = computed(() => {
  if (store.adiScore >= 80) return 'bg-green-100 text-green-700'
  if (store.adiScore >= 60) return 'bg-yellow-100 text-yellow-700'
  if (store.adiScore >= 40) return 'bg-orange-100 text-orange-700'
  return 'bg-red-100 text-red-700'
})

// Timeline chart math
const chartSvgWidth = computed(() => Math.max(200, (timelineData.value.length - 1) * 60))

const chartPointX = (idx: number) => {
  const count = timelineData.value.length
  if (count <= 1) return 0
  return (idx / (count - 1)) * chartSvgWidth.value
}

const chartPointY = (score: number) => 208 - (score / 100 * 160) - 24

const chartPoints = computed(() => {
  if (timelineData.value.length < 2) return ''
  return timelineData.value
    .map((pt, idx) => `${chartPointX(idx)},${chartPointY(pt.score)}`)
    .join(' ')
})

const chartAreaPath = computed(() => {
  if (timelineData.value.length < 2) return ''
  const pts = timelineData.value.map((pt, idx) => `${chartPointX(idx)},${chartPointY(pt.score)}`)
  const bottomY = 208 - 24
  return `M${chartPointX(0)},${bottomY} L${pts.join(' L')} L${chartPointX(timelineData.value.length - 1)},${bottomY} Z`
})

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

function scoreLabel(score: number): string {
  if (score >= 80) return 'Excellent'
  if (score >= 60) return 'Good'
  if (score >= 40) return 'Needs Attention'
  return 'Critical'
}

function dimScoreColor(score: number): string {
  if (score >= 80) return '#22c55e'
  if (score >= 60) return '#eab308'
  return '#ef4444'
}

function dimScoreTextColor(score: number): string {
  if (score >= 80) return 'text-green-600'
  if (score >= 60) return 'text-yellow-600'
  return 'text-red-600'
}

function shouldShowXLabel(idx: number): boolean {
  const len = timelineData.value.length
  if (len <= 6) return true
  if (idx === 0 || idx === len - 1) return true
  const step = Math.ceil(len / 6)
  return idx % step === 0
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
      industry: p.industry,
      keywords: p.keywords,
    }))
    if (projects.value.length > 0 && !selectedProjectId.value) {
      selectedProjectId.value = projects.value[0].id
      await loadAllReportData()
    }
  } catch (err: any) {
    error.value = err.message || 'Load failed'
  } finally {
    loading.value = false
  }
}

async function loadReportData() {
  if (!selectedProjectId.value) return
  error.value = null
  try {
    store.setProject(selectedProjectId.value)
    await store.fetchAdi()
    await loadTimeline()
  } catch (err: any) {
    error.value = err.message || 'Failed to load ADI data'
  }
}

async function loadTimeline() {
  if (!selectedProjectId.value) return
  timelineLoading.value = true
  try {
    const token = getToken()
    const res: any = await ofetch(`/api/geo/recommendation/timeline?projectId=${selectedProjectId.value}&range=${timelineRange.value}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    timelineData.value = (res.data || []).map((p: any) => ({
      date: p.date,
      score: p.score,
    }))
  } catch {
    timelineData.value = []
  } finally {
    timelineLoading.value = false
  }
}

async function loadAllReportData() {
  await loadReportData()
}

async function onBrandChange() {
  timelineData.value = []
  await loadAllReportData()
}

async function setTimelineRange(range: '7d' | '30d' | '90d' | '1y') {
  timelineRange.value = range
  await loadTimeline()
}

async function refreshAll() {
  refreshing.value = true
  await loadAllReportData()
  refreshing.value = false
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
