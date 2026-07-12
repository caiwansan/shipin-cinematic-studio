<template>
  <!--
    KnowledgePage.page-shell.vue — 将 KnowledgePage.vue 迁移到 PageShell

    与原始文件的差异：
    1. 页面结构由 PageShell 编排，移除了手动 layout（.knowledge-page 容器的手动排版）
    2. PageHeader（title="知识库" description="品牌知识资产管理"）由 PageShell 管理
    3. GeoPageHeader 不再在 content 中重复（已由 PageShell 的 PageHeader 接管）
    4. Summary slot 不需要（没有核心指标摘要）
    5. Content slot → 知识卡片列表 + 错误横幅
    6. Next slot → 下一步操作
    7. 状态管理（loading/error/empty）委托给 PageShell 的 displayState

    迁移后验证四种状态：
    - loading: 展示 LoadingState skeleton
    - error: 展示 ErrorState 卡片
    - empty: 展示 EmptyState（无知识数据）
    - default: 正常展示所有 slots
  -->
  <PageShell
    title="知识库"
    description="品牌知识资产管理"
    :loading="store.isLoading && !store.hasData"
    :error="errorObj"
    :empty="emptyConfig"
    :breadcrumbs="breadcrumbs"
  >
    <!-- Content: 知识卡片列表 -->
    <template #content>
      <!-- 编辑按钮（独立于 PageHeader，保留原有逻辑） -->
      <div class="knowledge-page__toolbar">
        <button
          class="geo-btn"
          :class="store.isEditing ? 'geo-btn--primary' : 'geo-btn--secondary'"
          @click="store.toggleEditing()"
        >
          {{ store.isEditing ? '保存修改' : '编辑知识库' }}
        </button>
      </div>

      <!-- Error Banner (recoverable) -->
      <GeoErrorState
        v-if="store.error"
        :message="store.error"
        compact
        @retry="store.fetchKnowledge()"
        @dismiss="store.error = null"
      />

      <!-- ===== Knowledge Evaluation ===== -->
      <GeoCard title="知识评分">
        <div v-if="healthLoading" class="knowledge-page__loading-inline">
          <span class="text-sm text-gray-400">加载品牌健康数据...</span>
        </div>
        <div v-else-if="healthError" class="text-sm text-red-500 py-2">{{ healthError }}</div>
        <div v-else-if="brandHealth.hasData" class="knowledge-evaluation__content">
          <GeoScoreCard
            :label="'品牌健康评分'"
            :display-value="brandHealth.brandHealth"
            :badge="brandHealth.healthLabel"
            :progress="brandHealth.brandHealth"
            subtext="vs. previous period"
          >
            <template #suffix>
              <span
                v-if="brandHealth.scoreChange !== 0"
                class="text-sm font-medium"
                :class="brandHealth.scoreChange > 0 ? 'text-green-600' : 'text-red-600'"
              >
                {{ brandHealth.scoreChange > 0 ? '↑' : '↓' }} {{ Math.abs(brandHealth.scoreChange) }}
              </span>
            </template>
          </GeoScoreCard>

          <!-- Dimension Scores -->
          <div class="grid gap-2 mt-4">
            <div
              v-for="dim in brandHealth.dimensions"
              :key="dim.id"
              class="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2"
            >
              <div class="flex items-center gap-2">
                <span class="text-xs w-2 h-2 rounded-full" :style="{ backgroundColor: dimScoreBarColor(dim.score) }" />
                <span class="text-sm text-gray-700">{{ dim.label }}</span>
              </div>
              <div class="flex items-center gap-2">
                <div class="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden hidden sm:block">
                  <div
                    class="h-full rounded-full"
                    :style="{ width: (dim.score / dim.maxScore * 100) + '%', backgroundColor: dimScoreBarColor(dim.score) }"
                  />
                </div>
                <span class="text-sm font-medium text-gray-600 w-10 text-right">{{ dim.score }}/{{ dim.maxScore }}</span>
              </div>
            </div>
          </div>

          <div v-if="brandHealth.coverage" class="mt-3 pt-3 border-t border-gray-100">
            <div class="flex items-center gap-4 text-xs text-gray-500">
              <span>证据：{{ brandHealth.coverage.evidenceCount }}</span>
              <span>实体：{{ brandHealth.coverage.entityCount }}</span>
              <span>声明：{{ brandHealth.coverage.claimCount }}</span>
            </div>
          </div>
        </div>
        <div v-else class="text-sm text-gray-400 py-3 text-center">
          暂无可用评分数据
        </div>
      </GeoCard>

      <!-- Knowledge Sources -->
      <GeoCard title="知识源">
        <div class="knowledge-page__sources">
          <div
            v-for="source in store.sources"
            :key="source.name"
            class="knowledge-page__source-item"
          >
            <div class="knowledge-page__source-info">
              <span class="knowledge-page__source-name">{{ source.name }}</span>
              <span class="knowledge-page__source-type">{{ source.type }}</span>
            </div>
            <GeoBadge>{{ source.freshness }}</GeoBadge>
          </div>
          <div v-if="store.sources.length === 0" class="text-sm text-gray-400 py-2">
            暂无知识源
          </div>
        </div>
      </GeoCard>

      <!-- Freshness -->
      <GeoCard v-if="store.freshness" title="新鲜度">
        <div class="knowledge-page__freshness-header">
          <span class="text-sm text-gray-500">整体新鲜度</span>
          <span class="text-2xl font-bold" :class="freshnessColor">{{ store.freshness.overall }}</span>
        </div>
        <div class="geo-progress-bar">
          <div
            class="geo-progress-bar__fill"
            :style="{ width: store.freshness.overall + '%' }"
            :class="freshnessBarColor"
          />
        </div>
        <p v-if="store.freshness.lastUpdated" class="text-xs text-gray-400 mt-2">
          最后更新：{{ store.freshness.lastUpdated }}
        </p>
      </GeoCard>

      <!-- Missing Knowledge -->
      <GeoCard v-if="store.hasMissingKnowledge" title="缺少的知识">
        <div class="knowledge-page__missing-list">
          <div
            v-for="(missing, index) in store.missingKnowledge"
            :key="index"
            class="knowledge-page__missing-item"
          >
            <span class="knowledge-page__missing-icon">⚠️</span>
            <span class="text-sm font-medium text-gray-700">{{ missing.suggestion }}</span>
          </div>
        </div>
      </GeoCard>

      <!-- Knowledge Statements -->
      <GeoCard title="知识声明">
        <template #header-actions>
          <span class="text-xs text-gray-400">{{ store.verifiedStatements.length }} 已验证</span>
        </template>
        <div class="knowledge-page__statements">
          <div
            v-for="stmt in store.filteredStatements"
            :key="stmt.id"
            class="knowledge-page__statement-item"
            tabindex="0"
            @click="handleStatementClick(stmt.id)"
            @keydown.enter="handleStatementClick(stmt.id)"
          >
            <p class="knowledge-page__statement-text">{{ stmt.content }}</p>
            <div class="knowledge-page__statement-meta">
              <span class="knowledge-page__statement-category">{{ stmt.category }}</span>
              <GeoBadge :variant="stmt.status === 'verified' ? 'success' : stmt.status === 'pending' ? 'warning' : 'neutral'">
                {{ stmt.status }}
              </GeoBadge>
            </div>
          </div>
          <div v-if="store.filteredStatements.length === 0" class="text-sm text-gray-400 py-3 text-center">
            暂无知识声明
          </div>
        </div>
      </GeoCard>
    </template>

    <!-- Next: 下一步操作 -->
    <template #next>
      <div class="flex items-center gap-3">
        <NuxtLink
          to="/workspace/geo/dashboard"
          class="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          返回品牌列表
        </NuxtLink>
      </div>
    </template>
  </PageShell>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useKnowledgeStore } from '../stores/useKnowledgeStore'
import { useHealthStore } from '../stores/useHealthStore'
import type { ErrorState, EmptyStateConfig } from '~/workspaces/geo/types/foundation'
import GeoCard from '../components/GeoCard/index.vue'
import GeoScoreCard from '../components/GeoScoreCard/index.vue'
import GeoBadge from '../components/GeoBadge/index.vue'
import GeoErrorState from '../components/GeoErrorState/index.vue'
import { useGeoProjectContext } from '../composables/useGeoProjectContext'
import PageShell from '../components/foundation/PageShell.vue'

const route = useRoute()
const store = useKnowledgeStore()
const brandHealth = useHealthStore()

const healthLoading = ref(false)
const healthError = ref<string | null>(null)

// ── PageShell State Bindings ──

const breadcrumbs = computed(() => [
  { label: '品牌列表', path: '/workspace/geo/dashboard' },
  { label: '知识库' },
])

const errorObj = computed<ErrorState | null>(() => {
  if (!store.error) return null
  return {
    title: '加载失败',
    reason: store.error,
    suggestion: '请检查网络连接后重试',
    onRetry: () => store.fetchKnowledge(),
  }
})

const emptyConfig = computed<EmptyStateConfig | null>(() => {
  if (store.isLoading) return null
  if (store.hasData) return null
  return {
    type: 'no-results',
    title: '暂无知识数据',
    description: '该品牌尚未建立知识库，创建品牌后运行发现扫描即可建立知识库',
    actionLabel: '重新加载',
    onAction: () => store.fetchKnowledge(),
  }
})

// ── Computed ──

function dimScoreBarColor(score: number): string {
  if (score >= 80) return '#22c55e'
  if (score >= 60) return '#eab308'
  return '#ef4444'
}

const freshnessColor = computed(() => {
  const f = store.freshness?.overall ?? 0
  if (f >= 70) return 'text-green-600'
  if (f >= 40) return 'text-yellow-600'
  return 'text-red-600'
})

const freshnessBarColor = computed(() => {
  const f = store.freshness?.overall ?? 0
  if (f >= 70) return 'geo-progress-bar__fill--success'
  if (f >= 40) return 'geo-progress-bar__fill--warning'
  return 'geo-progress-bar__fill--danger'
})

// ── Data Loading ──

async function loadBrandHealth() {
  healthLoading.value = true
  healthError.value = null
  try {
    await brandHealth.fetchHealth()
  } catch (err: any) {
    healthError.value = err?.message || 'Failed to load brand health data'
  } finally {
    healthLoading.value = false
  }
}

onMounted(async () => {
  const { projectId } = useGeoProjectContext()
  if (projectId.value) {
    store.setProject(projectId.value)
    brandHealth.setProject(projectId.value)
  }
  await store.fetchKnowledge()
  await loadBrandHealth()
})

function handleStatementClick(id: string) {
  void id // @beta-stub: 跳转到声明详情 — 待集成
}
</script>

<style scoped>
.knowledge-page__toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 16px;
}
.knowledge-page__loading-inline {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.knowledge-page__sources {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.knowledge-page__source-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px;
  border-radius: 8px;
  background: #fff;
  border: 1px solid #e5e7eb;
}
.knowledge-page__source-info {
  display: flex;
  align-items: center;
  gap: 12px;
}
.knowledge-page__source-name {
  font-size: 14px;
  font-weight: 500;
  color: #111;
}
.knowledge-page__source-type {
  padding: 2px 8px;
  border-radius: 4px;
  background: #f9fafb;
  font-size: 12px;
  color: #6b7280;
}
.knowledge-page__freshness-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.knowledge-page__missing-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.knowledge-page__missing-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 8px;
  background: #fefce8;
  border: 1px solid #fde68a;
}
.knowledge-page__missing-icon {
  font-size: 14px;
}
.knowledge-page__statements {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.knowledge-page__statement-item {
  padding: 16px;
  border-radius: 8px;
  background: #fff;
  border: 1px solid #e5e7eb;
  cursor: pointer;
  outline: none;
  transition: border-color 100ms;
}
.knowledge-page__statement-item:hover {
  border-color: #9ca3af;
}
.knowledge-page__statement-item:focus-visible {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}
.knowledge-page__statement-text {
  font-size: 14px;
  color: #111;
  margin: 0 0 8px;
  line-height: 1.5;
}
.knowledge-page__statement-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}
.knowledge-page__statement-category {
  padding: 2px 8px;
  border-radius: 4px;
  background: #f9fafb;
  font-size: 12px;
  color: #6b7280;
}
.knowledge-evaluation__content {
  padding: 4px 0;
}

/* Progress bar (shared utility) */
.geo-progress-bar {
  height: 8px;
  border-radius: 9999px;
  background: #e5e7eb;
  overflow: hidden;
}
.geo-progress-bar__fill {
  height: 100%;
  border-radius: 9999px;
  transition: width 0.4s ease;
}
.geo-progress-bar__fill--success { background: #22c55e; }
.geo-progress-bar__fill--warning { background: #eab308; }
.geo-progress-bar__fill--danger { background: #ef4444; }

/* ── Responsive ── */
@media (max-width: 768px) {
  .knowledge-page__source-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  .knowledge-page__source-info {
    flex-wrap: wrap;
  }
}
</style>
