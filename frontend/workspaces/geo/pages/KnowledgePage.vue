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
      >Retry</DSButton>
    </ErrorBanner>

    <!-- ===== STATE: Data ===== -->
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
          <DSButton variant="primary" @click="store.fetchKnowledge()">Retry</DSButton>
        </ErrorBanner>
      </Transition>

      <!-- Search Box -->
      <SearchBox
        :model-value="store.searchQuery"
        placeholder="Search knowledge statements..."
        @update:model-value="store.setSearchQuery($event)"
      />

      <!-- Knowledge Overview -->
      <KnowledgeOverview
        :brand-description="store.brandDescription"
        :coverage="store.coverage"
        :categories="store.categories"
      />

      <!-- Knowledge Sources -->
      <div class="knowledge-page__section">
        <h3 class="knowledge-page__section-title">Knowledge Sources</h3>
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
          <h3 class="knowledge-page__section-title">Freshness</h3>
          <span class="knowledge-page__freshness-score">{{ store.freshness.score }}/100</span>
        </div>
        <div
          class="knowledge-page__freshness-bar"
          role="progressbar"
          :aria-valuenow="store.freshness.score"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-label="Knowledge freshness score"
        >
          <div
            class="knowledge-page__freshness-fill"
            :style="{ width: store.freshness.score + '%' }"
          />
        </div>
        <p class="knowledge-page__freshness-date">Last updated: {{ store.freshness.lastUpdated }}</p>
      </div>

      <!-- Missing Knowledge -->
      <div v-if="store.hasMissingKnowledge" class="knowledge-page__missing">
        <h3 class="knowledge-page__section-title">Missing Knowledge</h3>
        <div class="knowledge-page__missing-list" role="list">
          <div
            v-for="(missing, index) in store.missingKnowledge"
            :key="index"
            class="knowledge-page__missing-item"
            role="listitem"
          >
            <span class="knowledge-page__missing-icon" role="img" aria-label="Warning">&#9888;</span>
            <span class="knowledge-page__missing-text">{{ missing }}</span>
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
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useKnowledgeStore } from '../stores/useKnowledgeStore'
import Hero from '~/design-system/product-blocks/Hero/index.vue'
import KnowledgeOverview from '~/design-system/product-blocks/KnowledgeOverview/index.vue'
import LoadingState from '~/design-system/components/LoadingState/index.vue'
import ErrorBanner from '~/design-system/components/ErrorBanner/index.vue'
import SearchBox from '~/design-system/components/SearchBox/index.vue'
import StatusIndicator from '~/design-system/components/StatusIndicator/index.vue'
import DSButton from '~/design-system/primitives/Button/index.vue'

const router = useRouter()
const store = useKnowledgeStore()

onMounted(async () => {
  await store.fetchKnowledge()
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
