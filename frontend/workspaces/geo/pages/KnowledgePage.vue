/**
 * KnowledgePage.vue — GEO Workspace Knowledge (Product Polish — Phase 8)
 *
 * All states: loading, error, data
 * Features: page transition, brand description, coverage, sources, freshness,
 *   missing knowledge, knowledge statements with search, editing toggle,
 *   responsive layout, keyboard navigation, aria attributes
 */
<template>
  <div class="knowledge-page">
    <!-- ===== STATE: Loading ===== -->
    <LoadingState
      v-if="store.isLoading && !store.hasData"
      title="Loading brand knowledge..."
      :steps="[
        { label: 'Retrieving brand description...', active: true },
        { label: 'Analyzing knowledge structure...' },
        { label: 'Checking freshness...' },
      ]"
    />

    <!-- ===== STATE: Error (no data) ===== -->
    <ErrorBanner
      v-else-if="store.error && !store.hasData"
      title="Unable to load knowledge data"
      message="Please check your connection and retry."
    >
      <DSButton
        variant="primary"
        @click="store.fetchKnowledge()"
        :disabled="store.isLoading"
      >重试</DSButton>
    </ErrorBanner>

    <!-- ===== STATE: Empty (no data) ===== -->
    <div v-else-if="!store.isLoading" class="knowledge-page__empty">
      <div class="knowledge-page__empty-icon">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="1.5" stroke-linecap="round">
          <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
          <path d="M8 7h8M8 11h6" />
        </svg>
      </div>
      <h3 class="knowledge-page__empty-title">暂无知识数据</h3>
      <p class="knowledge-page__empty-desc">该品牌尚未建立知识库，点击下方按钮扫描发现内容</p>
      <DSButton variant="primary" @click="store.fetchKnowledge()">重新加载</DSButton>
    </div>

    <!-- ===== STATE: Data (with content) ===== -->
    <template v-else-if="store.hasData">
      <div class="knowledge-page__header">
        <Hero
          title="Knowledge"
          subtitle="Your brand knowledge assets"
        />
        <DSButton
          :variant="store.isEditing ? 'primary' : 'secondary'"
          @click="store.toggleEditing()"
          :aria-label="store.isEditing ? 'Save knowledge changes' : 'Edit knowledge'"
        >
          {{ store.isEditing ? 'Save Changes' : 'Edit Knowledge' }}
        </DSButton>
      </div>

      <!-- Error Banner (recoverable) -->
      <Transition name="geo-banner">
        <ErrorBanner
          v-if="store.error"
          title="Knowledge error"
          :message="store.error"
          dismissible
          @dismiss="store.error = null"
        >
          <DSButton variant="primary" @click="store.fetchKnowledge()">重试</DSButton>
        </ErrorBanner>
      </Transition>

      <!-- Search Box -->
      <SearchBox
        :model-value="store.searchQuery"
        placeholder="Search knowledge statements..."
        @update:model-value="store.setSearchQuery($event)"
      />

      <!-- ===== Knowledge Evaluation (BII) ===== -->
      <div class="knowledge-page__section knowledge-evaluation">
        <h3 class="knowledge-page__section-title flex items-center gap-2">
          <span>📊</span> Knowledge Evaluation
          <span class="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded font-mono">BII</span>
        </h3>
        <p class="text-xs text-gray-400 -mt-3 mb-2">
          Brand Health Index — Evaluation of brand knowledge quality
        </p>

        <div v-if="healthLoading" class="flex items-center justify-center py-4">
          <div class="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span class="ml-2 text-sm text-gray-400">正在加载品牌健康数据...</span>
        </div>

        <div v-else-if="healthError" class="text-sm text-red-500 py-2">
          {{ healthError }}
        </div>

        <div v-else-if="brandHealth.hasData" class="knowledge-evaluation__content">
          <!-- Overall Score -->
          <div class="bg-white rounded-lg border border-gray-200 p-4 mb-3">
            <div class="flex items-center justify-between">
              <div>
                <span class="text-sm font-medium text-gray-700">品牌健康评分</span>
                <div class="flex items-center gap-2 mt-1">
                  <span class="text-3xl font-bold" :class="overallScoreTextColor">{{ brandHealth.brandHealth }}</span>
                  <span
                    class="text-xs font-medium px-2 py-0.5 rounded-full"
                    :class="overallScoreBadgeColor"
                  >
                    {{ brandHealth.healthLabel }}
                  </span>
                </div>
              </div>
              <div class="text-right">
                <span
                  v-if="brandHealth.scoreChange !== 0"
                  class="text-sm font-medium"
                  :class="brandHealth.scoreChange > 0 ? 'text-green-600' : 'text-red-600'"
                >
                  {{ brandHealth.scoreChange > 0 ? '↑' : '↓' }} {{ Math.abs(brandHealth.scoreChange) }}
                </span>
                <p class="text-xs text-gray-400 mt-0.5">vs. previous period</p>
              </div>
            </div>
          </div>

          <!-- Dimension Scores -->
          <div class="grid gap-2">
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

          <!-- Coverage details -->
          <div v-if="brandHealth.coverage" class="mt-3 pt-3 border-t border-gray-100">
            <div class="flex items-center gap-4 text-xs text-gray-500">
              <span>证据：{{ brandHealth.coverage.evidenceCount }}</span>
              <span>实体：{{ brandHealth.coverage.entityCount }}</span>
              <span>声明：{{ brandHealth.coverage.claimCount }}</span>
            </div>
          </div>
        </div>

        <div v-else class="text-sm text-gray-400 py-3 text-center">
          No BII data available for this project.
        </div>
      </div>

      <!-- Knowledge Overview -->
      <KnowledgeOverview
        :brand-description="store.brandDescription"
        :coverage="store.coverage.percentage"
        :categories="store.categories.map(c => c.name)"
      />

      <!-- Knowledge Sources -->
      <div class="knowledge-page__section">
        <h3 class="knowledge-page__section-title">知识源</h3>
        <div class="knowledge-page__sources" role="list">
          <div
            v-for="source in store.sources"
            :key="source.name"
            class="knowledge-page__source-item"
            role="listitem"
          >
            <div class="knowledge-page__source-info">
              <span class="knowledge-page__source-name">{{ source.name }}</span>
              <span class="knowledge-page__source-type">{{ source.type }}</span>
            </div>
            <span class="knowledge-page__source-freshness">{{ source.freshness }}</span>
          </div>
        </div>
      </div>

      <!-- Freshness Score -->
      <div v-if="store.freshness" class="knowledge-page__freshness">
        <div class="knowledge-page__freshness-header">
          <h3 class="knowledge-page__section-title">新鲜度</h3>
          <span class="knowledge-page__freshness-score">{{ store.freshness.overall }}/100</span>
        </div>
        <div
          class="knowledge-page__freshness-bar"
          role="progressbar"
          :aria-valuenow="store.freshness.overall"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-label="Knowledge freshness score"
        >
          <div
            class="knowledge-page__freshness-fill"
            :style="{ width: store.freshness.overall + '%' }"
          />
        </div>
        <p class="knowledge-page__freshness-date">最后更新：{{ store.freshness.lastUpdated }}</p>
      </div>

      <!-- Missing Knowledge -->
      <div v-if="store.hasMissingKnowledge" class="knowledge-page__missing">
        <h3 class="knowledge-page__section-title">缺少的知识</h3>
        <div class="knowledge-page__missing-list" role="list">
          <div
            v-for="(missing, index) in store.missingKnowledge"
            :key="index"
            class="knowledge-page__missing-item"
            role="listitem"
          >
            <span class="knowledge-page__missing-icon" role="img" aria-label="Warning">&#9888;</span>
            <span class="knowledge-page__missing-text">{{ missing.suggestion }}</span>
          </div>
        </div>
      </div>

      <!-- Knowledge Statements -->
      <div class="knowledge-page__section">
        <h3 class="knowledge-page__section-title">
          Knowledge Statements
          <span class="knowledge-page__statement-count">({{ store.verifiedStatements.length }} verified)</span>
        </h3>
        <div class="knowledge-page__statements" role="list">
          <div
            v-for="stmt in store.filteredStatements"
            :key="stmt.id"
            class="knowledge-page__statement-item"
            role="listitem"
            :tabindex="0"
            @click="handleStatementClick(stmt.id)"
            @keydown.enter="handleStatementClick(stmt.id)"
            @keydown.space.prevent="handleStatementClick(stmt.id)"
          >
            <div class="knowledge-page__statement-content">
              <p class="knowledge-page__statement-text">{{ stmt.content }}</p>
              <div class="knowledge-page__statement-meta">
                <span class="knowledge-page__statement-category">{{ stmt.category }}</span>
                <StatusIndicator
                  :status="stmt.status === 'verified' ? 'connected' : stmt.status === 'pending' ? 'pending' : 'error'"
                  :label="stmt.status"
                />
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
import { useKnowledgeStore } from '../stores/useKnowledgeStore'
import { useHealthStore } from '../stores/useHealthStore'
import Hero from '~/design-system/product-blocks/Hero/index.vue'
import KnowledgeOverview from '~/design-system/product-blocks/KnowledgeOverview/index.vue'
import LoadingState from '~/design-system/components/LoadingState/index.vue'
import ErrorBanner from '~/design-system/components/ErrorBanner/index.vue'
import SearchBox from '~/design-system/components/SearchBox/index.vue'
import StatusIndicator from '~/design-system/components/StatusIndicator/index.vue'
import DSButton from '~/design-system/primitives/Button/index.vue'

const router = useRouter()
const route = useRoute()
const store = useKnowledgeStore()
const brandHealth = useHealthStore()

const healthLoading = ref(false)
const healthError = ref<string | null>(null)

const overallScoreTextColor = computed(() => {
  const s = brandHealth.brandHealth
  if (s >= 80) return 'text-green-600'
  if (s >= 60) return 'text-yellow-600'
  if (s >= 40) return 'text-orange-600'
  return 'text-red-600'
})
const overallScoreBadgeColor = computed(() => {
  const s = brandHealth.brandHealth
  if (s >= 80) return 'bg-green-100 text-green-700'
  if (s >= 60) return 'bg-yellow-100 text-yellow-700'
  if (s >= 40) return 'bg-orange-100 text-orange-700'
  return 'bg-red-100 text-red-700'
})

function dimScoreBarColor(score: number): string {
  if (score >= 80) return '#22c55e'
  if (score >= 60) return '#eab308'
  return '#ef4444'
}

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
  // Set project ID from route query if available
  const projectId = route.query.projectId as string
  if (projectId) {
    store.setProject(projectId)
    brandHealth.setProject(projectId)
  }
  await store.fetchKnowledge()
  await loadBrandHealth()
})

function handleStatementClick(id: string) {
  // Integration point: navigate to statement detail
  console.warn(`[KnowledgePage] Statement detail view: ${id}`)
}
</script>

<style scoped>
.knowledge-page {
  max-width: 960px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-5, 24px);
}

.knowledge-page__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4, 16px);
}

.knowledge-page__section {
  display: flex;
  flex-direction: column;
  gap: var(--space-4, 16px);
}

.knowledge-page__section-title {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-heading-3-size, 20px);
  font-weight: var(--text-heading-3-weight, 500);
  color: var(--color-text-primary, #111111);
  margin: 0;
  display: flex;
  align-items: center;
  gap: var(--space-2, 8px);
}

.knowledge-page__statement-count {
  font-size: var(--text-body-sm-size, 14px);
  font-weight: 400;
  color: var(--color-text-secondary, #6b7280);
}

.knowledge-page__sources {
  display: flex;
  flex-direction: column;
  gap: var(--space-2, 8px);
}

.knowledge-page__source-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3, 12px);
  padding: var(--space-3, 12px);
  border-radius: var(--radius-md, 8px);
  background-color: var(--color-surface, #ffffff);
  border: 1px solid var(--color-border, #e5e7eb);
  transition: border-color var(--motion-fast-duration, 100ms) ease-out;
}

.knowledge-page__source-item:hover {
  border-color: var(--color-text-tertiary, #9ca3af);
}

.knowledge-page__source-info {
  display: flex;
  align-items: center;
  gap: var(--space-3, 12px);
}

.knowledge-page__source-name {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-sm-size, 14px);
  font-weight: 500;
  color: var(--color-text-primary, #111111);
}

.knowledge-page__source-type {
  padding: var(--space-1, 4px) var(--space-2, 8px);
  border-radius: var(--radius-sm, 4px);
  background-color: var(--color-surface-dim, #f9fafb);
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-caption-size, 12px);
  color: var(--color-text-secondary, #6b7280);
}

.knowledge-page__source-freshness {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-caption-size, 12px);
  color: var(--color-text-tertiary, #9ca3af);
}

.knowledge-page__freshness {
  display: flex;
  flex-direction: column;
  gap: var(--space-2, 8px);
  padding: var(--space-4, 16px);
  border-radius: var(--radius-md, 8px);
  background-color: var(--color-surface, #ffffff);
  border: 1px solid var(--color-border, #e5e7eb);
  transition: border-color var(--motion-fast-duration, 100ms) ease-out;
}

.knowledge-page__freshness:hover {
  border-color: var(--color-text-tertiary, #9ca3af);
}

.knowledge-page__freshness-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.knowledge-page__freshness-score {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-metric-sm-size, 32px);
  font-weight: var(--text-metric-sm-weight, 700);
  color: var(--color-text-primary, #111111);
}

.knowledge-page__freshness-bar {
  width: 100%;
  height: 8px;
  border-radius: var(--radius-full, 9999px);
  background-color: var(--color-surface-dim, #f9fafb);
  overflow: hidden;
}

.knowledge-page__freshness-fill {
  height: 100%;
  border-radius: var(--radius-full, 9999px);
  background: linear-gradient(90deg, var(--color-warning, #eab308) 0%, var(--color-health, #22c55e) 100%);
  transition: width var(--motion-slow-duration, 400ms) ease-in-out;
}

.knowledge-page__freshness-date {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-caption-size, 12px);
  color: var(--color-text-tertiary, #9ca3af);
  margin: 0;
}

.knowledge-page__missing {
  display: flex;
  flex-direction: column;
  gap: var(--space-4, 16px);
}

.knowledge-page__missing-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2, 8px);
}

.knowledge-page__missing-item {
  display: flex;
  align-items: center;
  gap: var(--space-3, 12px);
  padding: var(--space-3, 12px);
  border-radius: var(--radius-md, 8px);
  background-color: #fefce8;
  border: 1px solid #fde68a;
  transition: border-color var(--motion-fast-duration, 100ms) ease-out;
}

.knowledge-page__missing-item:hover {
  border-color: #facc15;
}

.knowledge-page__missing-icon {
  color: var(--color-warning, #eab308);
  font-size: 14px;
}

.knowledge-page__missing-text {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-sm-size, 14px);
  font-weight: 500;
  color: var(--color-text-primary, #111111);
}

.knowledge-page__statements {
  display: flex;
  flex-direction: column;
  gap: var(--space-2, 8px);
}

.knowledge-page__statement-item {
  padding: var(--space-4, 16px);
  border-radius: var(--radius-md, 8px);
  background-color: var(--color-surface, #ffffff);
  border: 1px solid var(--color-border, #e5e7eb);
  cursor: pointer;
  transition: all var(--motion-fast-duration, 100ms) ease-out;
  outline: none;
}

.knowledge-page__statement-item:hover {
  border-color: var(--color-text-tertiary, #9ca3af);
}

/* Empty state */
.knowledge-page__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  text-align: center;
}

.knowledge-page__empty-icon {
  margin-bottom: 16px;
  opacity: 0.5;
}

.knowledge-page__empty-title {
  font-size: 18px;
  font-weight: 600;
  color: #374151;
  margin: 0 0 8px;
}

.knowledge-page__empty-desc {
  font-size: 14px;
  color: #6b7280;
  margin: 0 0 24px;
  max-width: 360px;
}

.knowledge-page__statement-item:focus-visible {
  outline: 2px solid var(--color-info, #3b82f6);
  outline-offset: 2px;
}

.knowledge-page__statement-text {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-sm-size, 14px);
  color: var(--color-text-primary, #111111);
  margin: 0 0 var(--space-2, 8px);
  line-height: 1.5;
}

.knowledge-page__statement-meta {
  display: flex;
  align-items: center;
  gap: var(--space-2, 8px);
}

.knowledge-evaluation__content {
  background-color: var(--color-surface, #ffffff);
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: var(--radius-md, 8px);
  padding: var(--space-4, 16px);
}

.knowledge-page__section.knowledge-evaluation {
  background-color: #fafbfc;
  padding: var(--space-4, 16px);
  border-radius: var(--radius-md, 8px);
  border: 1px solid var(--color-border, #e5e7eb);
}

.knowledge-page__section.knowledge-evaluation .knowledge-page__section-title {
  font-size: var(--text-heading-4-size, 18px);
}

.knowledge-evaluation .grid {
  display: flex;
  flex-direction: column;
}

.knowledge-evaluation .knowledge-page__section-title span:last-child {
  font-family: monospace;
  font-size: 11px;
}

.knowledge-page__statement-category {
  padding: var(--space-1, 4px) var(--space-2, 8px);
  border-radius: var(--radius-sm, 4px);
  background-color: var(--color-surface-dim, #f9fafb);
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-caption-size, 12px);
  color: var(--color-text-secondary, #6b7280);
}

/* ===== Banner Transitions ===== */
.geo-banner-enter-active,
.geo-banner-leave-active {
  transition: all var(--motion-normal-duration, 200ms) ease-out;
}

.geo-banner-enter-from,
.geo-banner-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
