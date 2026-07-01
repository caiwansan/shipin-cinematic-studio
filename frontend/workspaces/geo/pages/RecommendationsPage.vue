/**
 * RecommendationsPage.vue — GEO Workspace Recommendations (Product Polish — Phase 8)
 *
 * All states: loading, error, empty, data
 * Features: page transition, impact preview, action execution, success/error feedback,
 *   responsive layout, keyboard navigation, aria attributes
 */
<template>
  <div class="recs-page">
    <!-- ===== STATE: Loading ===== -->
    <LoadingState
      v-if="store.isLoading && !store.hasRecs"
      title="Analyzing your brand..."
      :steps="[
        { label: 'Identifying improvement opportunities...', active: true },
        { label: 'Calculating impact projections...' },
        { label: 'Preparing one-click actions...' },
      ]"
    />

    <!-- ===== STATE: Error (no data) ===== -->
    <ErrorBanner
      v-else-if="store.error && !store.hasRecs"
      title="Unable to load recommendations"
      message="Please check your connection and retry."
    >
      <DSButton
        variant="primary"
        @click="store.fetchRecs()"
        :disabled="store.isLoading"
      >Retry</DSButton>
    </ErrorBanner>

    <!-- ===== STATE: Empty ===== -->
    <EmptyState
      v-else-if="!store.hasRecs"
      icon="&#9733;"
      title="No recommendations available"
      description="Your Brand Health is already optimized."
    />

    <!-- ===== STATE: Data ===== -->
    <template v-else>
      <Hero
        title="Recommendations"
        :subtitle="`${store.pendingRecommendations.length} actions to improve Brand Health`"
      />

      <!-- Impact Preview -->
      <ImpactPreview
        :current-score="store.currentScore"
        :expected-score="store.expectedScore"
        description="Improving all pending recommendations will increase your Brand Health."
      />

      <!-- Success Feedback after execution -->
      <Transition name="geo-banner">
        <SuccessBanner
          v-if="store.execution.status === 'success'"
          :title="`Brand Health improved: +${store.execution.lastImpact}`"
          description="Actions completed successfully."
          dismissible
          @dismiss="resetExecution"
        />
      </Transition>

      <!-- Error on execution -->
      <Transition name="geo-banner">
        <ErrorBanner
          v-if="store.execution.status === 'error'"
          title="Execution failed"
          :message="store.execution.errorMessage || 'An error occurred'"
          dismissible
          @dismiss="resetExecution"
        />
      </Transition>

      <!-- Action Cards -->
      <div class="recs-page__section">
        <h3 class="recs-page__section-title">Priority Actions</h3>
        <ActionPanel
          :actions="store.recommendations.map(r => ({
            id: r.id,
            title: r.title,
            expectedImpact: r.impact.value,
            effort: r.difficulty,
            reason: r.description,
            status: r.status || 'pending',
          }))"
          @execute="handleExecute"
          @retry="handleRetry"
        />
      </div>

      <!-- Explanation Panel -->
      <ExplanationPanel
        title="Why these actions?"
        :items="explanationItems"
      />

      <!-- History (if available) -->
      <div v-if="store.history.length > 0" class="recs-page__section">
        <h3 class="recs-page__section-title">Recommendation History</h3>
        <div class="recs-page__history" role="list">
          <div
            v-for="item in store.history.slice(0, 5)"
            :key="item.id"
            class="recs-page__history-item"
            role="listitem"
          >
            <span class="recs-page__history-title">{{ item.title }}</span>
            <span class="recs-page__history-impact">+{{ item.impact }}</span>
            <span class="recs-page__history-date">{{ item.executedAt }}</span>
          </div>
        </div>
      </div>

      <!-- Primary CTA -->
      <NextStepPanel
        v-if="store.pendingRecommendations.length > 0"
        :action-count="store.pendingRecommendations.length"
        cta-label="Improve All"
        @action="handleImproveAll"
      />
      <div v-else class="recs-page__uptodate">
        <span class="recs-page__uptodate-icon">&#10003;</span>
        <span>Brand Health up to date</span>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRecommendationsStore } from '../stores/useRecommendationsStore'
import Hero from '~/design-system/product-blocks/Hero/index.vue'
import ImpactPreview from '~/design-system/product-blocks/ImpactPreview/index.vue'
import ActionPanel from '~/design-system/product-blocks/ActionPanel/index.vue'
import ExplanationPanel from '~/design-system/product-blocks/ExplanationPanel/index.vue'
import NextStepPanel from '~/design-system/product-blocks/NextStepPanel/index.vue'
import LoadingState from '~/design-system/components/LoadingState/index.vue'
import ErrorBanner from '~/design-system/components/ErrorBanner/index.vue'
import EmptyState from '~/design-system/components/EmptyState/index.vue'
import SuccessBanner from '~/design-system/components/SuccessBanner/index.vue'
import DSButton from '~/design-system/primitives/Button/index.vue'

const store = useRecommendationsStore()

const explanationItems = computed(() => {
  const reasons = store.recommendations.filter(r => r.description && (!r.status || r.status === 'pending'))
  return reasons.slice(0, 5).map(r => ({
    text: r.description!,
    type: 'negative' as const,
  }))
})

onMounted(async () => {
  await store.fetchRecs()
})

async function handleExecute(id: string) {
  await store.execute([id])
}

async function handleRetry(id: string) {
  await store.execute([id])
}

async function handleImproveAll() {
  const ids = store.recommendations
    .filter(r => !r.status || r.status === 'pending')
    .map(r => r.id)
  if (ids.length > 0) {
    await store.execute(ids)
  }
}

function resetExecution() {
  store.execution.status = 'idle'
  store.execution.errorMessage = null
  store.fetchRecs()
}
</script>

<style scoped>
.recs-page {
  max-width: 960px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-5, 24px);
}

.recs-page__section {
  display: flex;
  flex-direction: column;
  gap: var(--space-4, 16px);
}

.recs-page__section-title {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-heading-3-size, 20px);
  font-weight: var(--text-heading-3-weight, 500);
  color: var(--color-text-primary, #111111);
  margin: 0;
}

.recs-page__history {
  display: flex;
  flex-direction: column;
  gap: var(--space-2, 8px);
}

.recs-page__history-item {
  display: flex;
  align-items: center;
  gap: var(--space-3, 12px);
  padding: var(--space-3, 12px);
  border-radius: var(--radius-md, 8px);
  background-color: var(--color-surface, #ffffff);
  border: 1px solid var(--color-border, #e5e7eb);
  transition: border-color var(--motion-fast-duration, 100ms) ease-out;
}

.recs-page__history-item:hover {
  border-color: var(--color-text-tertiary, #9ca3af);
}

.recs-page__history-title {
  flex: 1;
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-sm-size, 14px);
  font-weight: 500;
  color: var(--color-text-primary, #111111);
}

.recs-page__history-impact {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-sm-size, 14px);
  font-weight: 600;
  color: var(--color-success, #22c55e);
}

.recs-page__history-date {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-caption-size, 12px);
  color: var(--color-text-tertiary, #9ca3af);
}

.recs-page__uptodate {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2, 8px);
  padding: var(--space-4, 16px);
  border-radius: var(--radius-md, 8px);
  background-color: #f0fdf4;
  border: 1px solid #bbf7d0;
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-size, 16px);
  font-weight: 500;
  color: var(--color-success, #22c55e);
}

.recs-page__uptodate-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: var(--radius-full, 9999px);
  background-color: var(--color-success, #22c55e);
  color: #ffffff;
  font-size: 14px;
  font-weight: 700;
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
