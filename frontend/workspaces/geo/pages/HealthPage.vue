/**
 * HealthPage.vue — GEO Workspace Health (Product Polish — Phase 8)
 *
 * All states: loading, error, empty, data
 * Features: page transition, loading skeleton, error/retry, success banner auto-dismiss,
 *   responsive layout, keyboard navigation, aria attributes
 */
<template>
  <div class="health-page">
    <!-- ===== STATE: Loading ===== -->
    <LoadingState
      v-if="store.isLoading && !store.hasData"
      title="Loading Brand Health"
      :steps="[
        { label: 'Checking AI visibility...', active: true },
        { label: 'Analyzing knowledge coverage...' },
        { label: 'Generating recommendations...' },
      ]"
    />

    <!-- ===== STATE: Error (no data yet) ===== -->
    <ErrorBanner
      v-else-if="store.error && !store.hasData"
      title="Unable to load Brand Health"
      message="Please check your connection and retry."
    >
      <DSButton
        variant="primary"
        @click="handleRetry"
        :disabled="store.isLoading"
        aria-label="Retry loading Brand Health"
      >Retry</DSButton>
    </ErrorBanner>

    <!-- ===== STATE: Empty (no data yet) ===== -->
    <EmptyState
      v-else-if="!store.hasData"
      icon="&#10024;"
      title="Welcome to Brand Health"
      description="Connect your website to see how your brand is understood by AI systems."
    >
      <DSButton
        variant="primary"
        @click="handleConnect"
        aria-label="Connect your website to Brand Health"
      >Connect Website</DSButton>
    </EmptyState>

    <!-- ===== STATE: Data ===== -->
    <template v-else-if="store.brandHealth">
      <!-- Success Banner (auto-dismisses) -->
      <Transition name="geo-banner">
        <SuccessBanner
          v-if="showSuccessBanner"
          title="Brand Health updated"
          description="Latest data loaded successfully"
          @dismiss="showSuccessBanner = false"
        />
      </Transition>

      <!-- Error Banner (recoverable) -->
      <Transition name="geo-banner">
        <ErrorBanner
          v-if="store.error"
          title="Update failed"
          :message="store.error"
          dismissible
          @dismiss="store.error = null"
        >
          <DSButton variant="primary" @click="handleRetry">Retry</DSButton>
        </ErrorBanner>
      </Transition>

      <!-- Hero Section -->
      <Hero
        title="Brand Health"
        subtitle="Your brand's overall standing in AI systems"
        :meta="`${store.dailyChange >= 0 ? '+' : ''}${store.dailyChange} this ${getPeriodLabel()}`"
      />

      <!-- Health Score Summary -->
      <HealthSummary
        :score="store.brandHealth.score"
        :trend="store.brandHealth.trend"
        :label="store.brandHealth.label"
        :definition="store.brandHealth.definition"
      />

      <!-- Split: Explanation + Actions -->
      <div class="health-page__split">
        <div class="health-page__split-left">
          <ExplanationPanel
            title="Why this score?"
            :items="explanationItems"
          />
        </div>
        <div class="health-page__split-right">
          <RecommendationList
            title="Today's Actions"
            :items="store.recommendations"
            :total-count="store.totalRecommendations"
            @view-all="handleViewAll"
          />
        </div>
      </div>

      <!-- Dimensional Breakdown -->
      <div class="health-page__breakdown">
        <h3 class="health-page__section-title">Dimensional Breakdown</h3>
        <div class="health-page__breakdown-list" role="list">
          <div
            v-for="dim in store.dimensions"
            :key="dim.name"
            class="health-page__breakdown-item"
            role="listitem"
          >
            <div class="health-page__breakdown-header">
              <span class="health-page__breakdown-name">
                {{ dim.name }}
                <span
                  v-if="dim.isWarning"
                  class="health-page__breakdown-warning"
                  :title="`${dim.name} needs attention`"
                  role="img"
                  aria-label="Warning"
                >&#9888;</span>
              </span>
              <span
                :class="['health-page__breakdown-score', { 'health-page__breakdown-score--warning': dim.isWarning }]"
              >
                {{ dim.score }}/100
              </span>
            </div>
            <div v-if="dim.score === 0 && !dim.explanation" class="health-page__breakdown-unavailable">
              --- unavailable ---
            </div>
            <template v-else>
              <div
                class="health-page__breakdown-bar"
                role="progressbar"
                :aria-valuenow="dim.score"
                aria-valuemin="0"
                aria-valuemax="100"
                :aria-label="`${dim.name}: ${dim.score}%`"
              >
                <div
                  class="health-page__breakdown-bar-fill"
                  :style="{
                    width: dim.score + '%',
                    backgroundColor: dim.isWarning ? 'var(--color-warning, #eab308)' : 'var(--color-health, #22c55e)',
                  }"
                />
              </div>
              <p class="health-page__breakdown-explanation">{{ dim.explanation }}</p>
            </template>
          </div>
        </div>
      </div>

      <!-- Next Step CTA -->
      <NextStepPanel
        :action-count="store.totalRecommendations"
        :is-up-to-date="!store.hasActionsPending"
        @action="handleAction"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useHealthStore } from '../stores/useHealthStore'
import Hero from '~/design-system/product-blocks/Hero/index.vue'
import HealthSummary from '~/design-system/product-blocks/HealthSummary/index.vue'
import ExplanationPanel from '~/design-system/product-blocks/ExplanationPanel/index.vue'
import RecommendationList from '~/design-system/product-blocks/RecommendationList/index.vue'
import NextStepPanel from '~/design-system/product-blocks/NextStepPanel/index.vue'
import LoadingState from '~/design-system/components/LoadingState/index.vue'
import ErrorBanner from '~/design-system/components/ErrorBanner/index.vue'
import EmptyState from '~/design-system/components/EmptyState/index.vue'
import SuccessBanner from '~/design-system/components/SuccessBanner/index.vue'
import DSButton from '~/design-system/primitives/Button/index.vue'

const router = useRouter()
const store = useHealthStore()
const showSuccessBanner = ref(false)
let bannerTimer: ReturnType<typeof setTimeout> | null = null

const explanationItems = computed(() => {
  return store.dimensions.map((dim) => ({
    text: dim.explanation,
    detail: dim.isWarning
      ? `This dimension needs attention. Score: ${dim.score}/100`
      : undefined,
    type: dim.score >= 70 ? 'positive' as const : 'negative' as const,
  }))
})

function getPeriodLabel(): string {
  return 'week'
}

onMounted(async () => {
  await store.fetchHealth()
  showSuccessBanner.value = true
  if (bannerTimer) clearTimeout(bannerTimer)
  bannerTimer = setTimeout(() => {
    showSuccessBanner.value = false
  }, 3000)
})

onBeforeUnmount(() => {
  if (bannerTimer) clearTimeout(bannerTimer)
})

async function handleRetry() {
  store.error = null
  await store.refresh()
  if (store.hasData) {
    showSuccessBanner.value = true
    if (bannerTimer) clearTimeout(bannerTimer)
    bannerTimer = setTimeout(() => {
      showSuccessBanner.value = false
    }, 3000)
  }
}

function handleConnect() {
  // Integration point: connect website flow
  console.warn('[HealthPage] Connect Website: not yet implemented')
}

function handleViewAll() {
  router.push('/workspace/geo/recommendations')
}

function handleAction() {
  router.push('/workspace/geo/recommendations')
}
</script>

<style scoped>
.health-page {
  max-width: 960px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-5, 24px);
}

.health-page__split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-5, 24px);
}

@media (max-width: 768px) {
  .health-page__split {
    grid-template-columns: 1fr;
  }
}

.health-page__split-left,
.health-page__split-right {
  min-width: 0;
}

.health-page__breakdown {
  display: flex;
  flex-direction: column;
  gap: var(--space-4, 16px);
}

.health-page__section-title {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-heading-3-size, 20px);
  font-weight: var(--text-heading-3-weight, 500);
  color: var(--color-text-primary, #111111);
  margin: 0;
}

.health-page__breakdown-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-4, 16px);
}

.health-page__breakdown-item {
  display: flex;
  flex-direction: column;
  gap: var(--space-2, 8px);
  padding: var(--space-3, 12px);
  border-radius: var(--radius-md, 8px);
  background-color: var(--color-surface, #ffffff);
  border: 1px solid var(--color-border, #e5e7eb);
  transition: border-color var(--motion-fast-duration, 100ms) ease-out;
}

.health-page__breakdown-item:hover {
  border-color: var(--color-text-tertiary, #9ca3af);
}

.health-page__breakdown-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.health-page__breakdown-name {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-sm-size, 14px);
  font-weight: 500;
  color: var(--color-text-primary, #111111);
}

.health-page__breakdown-warning {
  margin-left: var(--space-1, 4px);
  font-size: 12px;
  cursor: help;
}

.health-page__breakdown-score {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-sm-size, 14px);
  font-weight: 600;
  color: var(--color-text-primary, #111111);
}

.health-page__breakdown-score--warning {
  color: var(--color-warning, #eab308);
}

.health-page__breakdown-unavailable {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-sm-size, 14px);
  font-style: italic;
  color: var(--color-text-tertiary, #9ca3af);
}

.health-page__breakdown-bar {
  width: 100%;
  height: 8px;
  border-radius: var(--radius-full, 9999px);
  background-color: var(--color-surface-dim, #f9fafb);
  overflow: hidden;
}

.health-page__breakdown-bar-fill {
  height: 100%;
  border-radius: var(--radius-full, 9999px);
  transition: width var(--motion-slow-duration, 400ms) ease-in-out;
}

.health-page__breakdown-explanation {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-sm-size, 14px);
  color: var(--color-text-secondary, #6b7280);
  margin: 0;
  line-height: 1.5;
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
