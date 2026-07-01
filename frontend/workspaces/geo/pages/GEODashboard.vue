<template>
  <div class="max-w-6xl mx-auto px-4 py-6">
    <!-- ===== STATE: Loading ===== -->
    <LoadingState
      v-if="store.isLoading && !store.hasProjects"
      title="加载品牌列表"
      :steps="[
        { label: '获取品牌项目...', active: true },
        { label: '加载扫描数据...' },
      ]"
    />

    <!-- ===== STATE: Error (no data yet) ===== -->
    <ErrorBanner
      v-else-if="store.error && !store.hasProjects"
      title="无法加载品牌列表"
      message="请检查网络连接后重试"
    >
      <DSButton variant="primary" @click="handleRetry" :disabled="store.isLoading">
        重试
      </DSButton>
    </ErrorBanner>

    <!-- ===== STATE: Empty ===== -->
    <EmptyState
      v-else-if="!store.hasProjects && !store.isLoading"
      icon="🔍"
      title="欢迎使用品牌扫描"
      description="创建第一个品牌项目，开始 AI 品牌扫描分析"
    >
      <DSButton variant="primary" @click="handleCreate">
        创建品牌
      </DSButton>
    </EmptyState>

    <!-- ===== STATE: Data ===== -->
    <template v-else-if="store.hasProjects || store.isLoading">
      <!-- Hero Section -->
      <div class="flex items-center justify-between mb-6">
        <Hero title="品牌扫描" subtitle="查看和管理你的品牌扫描项目">
          <template #actions>
            <DSButton variant="primary" @click="handleCreate">创建品牌</DSButton>
          </template>
        </Hero>
        <NuxtLink to="/" class="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1 ml-4 whitespace-nowrap">
          🏠 返回首页
        </NuxtLink>
      </div>

      <!-- Stats Cards Row -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <!-- 总品牌数 -->
        <div class="bg-white rounded-lg border border-gray-200 p-4 text-center">
          <div class="text-3xl font-bold text-gray-900">{{ store.projects.length }}</div>
          <div class="text-sm text-gray-500 mt-1">总品牌数</div>
        </div>
        <!-- 最近扫描 -->
        <div class="bg-white rounded-lg border border-gray-200 p-4 text-center">
          <div class="text-3xl font-bold text-gray-900">{{ scannedCount }}</div>
          <div class="text-sm text-gray-500 mt-1">最近扫描</div>
        </div>
        <!-- 平均分数 -->
        <div class="bg-white rounded-lg border border-gray-200 p-4 text-center">
          <div class="text-3xl font-bold" :class="avgScore >= 60 ? 'text-green-600' : 'text-red-600'">{{ avgScore }}</div>
          <div class="text-sm text-gray-500 mt-1">平均分数</div>
        </div>
        <!-- 需关注品牌 -->
        <div class="bg-white rounded-lg border border-gray-200 p-4 text-center">
          <div class="text-3xl font-bold" :class="attentionCount > 0 ? 'text-red-600' : 'text-gray-900'">{{ attentionCount }}</div>
          <div class="text-sm text-gray-500 mt-1">需关注品牌</div>
        </div>
      </div>

      <!-- Error Banner (recoverable) -->
      <div v-if="store.error" class="mb-4">
        <ErrorBanner
          :title="store.error"
          message=""
          dismissible
          @dismiss="store.clearError()"
        >
          <DSButton variant="primary" @click="handleRetry">重试</DSButton>
        </ErrorBanner>
      </div>

      <!-- Project List -->
      <div class="mt-6 grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        <div
          v-for="project in store.projects"
          :key="project.id"
          class="bg-white rounded-lg border border-gray-200 p-5 cursor-pointer hover:border-blue-400 hover:shadow-md transition-all duration-200"
          @click="goToDetail(project.id)"
          role="button"
          :tabindex="0"
          @keydown.enter="goToDetail(project.id)"
        >
          <div class="flex items-start justify-between">
            <div class="flex-1 min-w-0">
              <h3 class="text-lg font-semibold text-gray-900 truncate">{{ project.name }}</h3>
              <p class="text-sm text-gray-500 mt-1 truncate">{{ project.website }}</p>
            </div>
            <!-- Score Badge -->
            <div
              v-if="project.overallScore !== undefined && project.overallScore !== null"
              class="flex-shrink-0 ml-3 w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold"
              :class="scoreColor(project.overallScore)"
            >
              {{ project.overallScore }}
            </div>
            <div
              v-else
              class="flex-shrink-0 ml-3 w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-xs text-gray-400"
            >
              暂无
            </div>
          </div>

          <div class="mt-3 flex items-center gap-3 text-xs text-gray-400">
            <span v-if="project.industry" class="inline-flex items-center gap-1">
              <span>🏢</span> {{ project.industry }}
            </span>
            <span v-if="project.lastScanAt" class="inline-flex items-center gap-1">
              <span>🕐</span> {{ formatDate(project.lastScanAt) }}
            </span>
            <span v-else class="inline-flex items-center gap-1">
              <span>🕐</span> 未扫描
            </span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useScanStore } from '../stores/useScanStore'
import Hero from '~/design-system/product-blocks/Hero/index.vue'
import LoadingState from '~/design-system/components/LoadingState/index.vue'
import ErrorBanner from '~/design-system/components/ErrorBanner/index.vue'
import EmptyState from '~/design-system/components/EmptyState/index.vue'
import DSButton from '~/design-system/primitives/Button/index.vue'

definePageMeta({
  title: '品牌扫描',
})

const router = useRouter()
const store = useScanStore()

const scannedCount = computed(() => store.projects.filter(p => p.lastScanAt).length)
const avgScore = computed(() => {
  const scores = store.projects.filter(p => p.overallScore !== undefined && p.overallScore !== null).map(p => p.overallScore!)
  if (scores.length === 0) return 0
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
})
const attentionCount = computed(() => store.projects.filter(p => p.overallScore !== undefined && p.overallScore !== null && p.overallScore < 60).length)

onMounted(async () => {
  await store.loadProjects()
})

async function handleRetry() {
  store.clearError()
  await store.loadProjects()
}

function handleCreate() {
  router.push('/workspace/geo/create')
}

function goToDetail(id: string) {
  router.push(`/workspace/geo/detail/${id}`)
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function scoreColor(score: number): string {
  if (score >= 80) return 'bg-green-100 text-green-700'
  if (score >= 60) return 'bg-yellow-100 text-yellow-700'
  return 'bg-red-100 text-red-700'
}
</script>
