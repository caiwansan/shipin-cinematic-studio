<template>
  <div class="health-page">
    <!-- Loading State -->
    <div v-if="store.isLoading && !store.hasData" class="health-page__loading">
      <div class="health-page__skeleton-score" />
      <div class="health-page__skeleton-text" />
      <div class="health-page__skeleton-text" style="width: 60%" />
      <div class="health-page__skeleton-bars">
        <div v-for="n in 4" :key="n" class="health-page__skeleton-bar" />
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="store.error && !store.hasData" class="health-page__error">
      <div class="health-page__error-banner">
        <div class="health-page__error-icon">!</div>
        <div class="health-page__error-content">
          <p class="health-page__error-title">Unable to load Brand Health</p>
          <p class="health-page__error-message">Please check your connection and retry.</p>
          <button class="health-page__retry-btn" @click="handleRetry">Retry</button>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else-if="!store.hasData" class="health-page__empty">
      <div class="health-page__empty-icon">✦</div>
      <h3 class="health-page__empty-title">Welcome to Brand Health</h3>
      <p class="health-page__empty-description">
        Connect your website to see how your brand is understood by AI systems.
      </p>
      <button class="health-page__connect-btn" @click="handleConnect">
        Connect Website
      </button>
    </div>

    <!-- Success / Data State -->
    <template v-else-if="store.brandHealth">
      <!-- Success Banner (transient) -->
      <div v-if="showSuccessBanner" class="health-page__success-banner">
        <span class="health-page__success-icon">✓</span>
        <span>Brand Health updated</span>
      </div>

      <!-- Hero -->
      <HeroBlock
        title="Brand Health"
        subtitle="Your brand's overall standing in AI systems"
      />

      <!-- Health Summary -->
      <HealthSummaryBlock
        :score="store.brandHealth.score"
        :trend="store.brandHealth.trend"
        :label="store.brandHealth.label"
        :definition="store.brandHealth.definition"
      />

      <!-- Split: ExplanationPanel + RecommendationList -->
      <div class="health-page__split">
        <div class="health-page__split-left">
          <ExplanationPanelBlock
            title="Why this score?"
            :items="explanationItems"
          />
        </div>
        <div class="health-page__split-right">
          <RecommendationListBlock
            :items="store.recommendations"
            @view-all="handleViewAll"
          />
        </div>
      </div>

      <!-- Dimensional Breakdown -->
      <div class="health-page__breakdown">
        <h3 class="health-page__breakdown-title">Dimensional Breakdown</h3>
        <div class="health-page__breakdown-list">
          <div
            v-for="dim in store.dimensions"
            :key="dim.name"
            class="health-page__breakdown-item"
          >
            <div class="health-page__breakdown-header">
              <span class="health-page__breakdown-name">
                {{ dim.name }}
                <span v-if="dim.isWarning" class="health-page__breakdown-warning" title="Needs attention">⚠</span>
              </span>
              <span class="health-page__breakdown-score" :class="{ 'health-page__breakdown-score--warning': dim.isWarning }">
                {{ dim.score }}/100
              </span>
            </div>
            <div v-if="dim.score === 0" class="health-page__breakdown-unavailable">
              --- unavailable ---
            </div>
            <template v-else>
              <div class="health-page__breakdown-bar">
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
      <NextStepPanelBlock
        :action-count="store.totalRecommendations"
        :is-up-to-date="!store.hasActionsPending"
        @action="handleAction"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useHealthStore } from '../stores/useHealthStore'
import HeroBlock from '~/design-system/product-blocks/Hero/index.vue'
import HealthSummaryBlock from '~/design-system/product-blocks/HealthSummary/index.vue'
import ExplanationPanelBlock from '~/design-system/product-blocks/ExplanationPanel/index.vue'
import RecommendationListBlock from '~/design-system/product-blocks/RecommendationList/index.vue'
import NextStepPanelBlock from '~/design-system/product-blocks/NextStepPanel/index.vue'

const store = useHealthStore()

const showSuccessBanner = ref(false)
let bannerTimer: ReturnType<typeof setTimeout> | null = null

// Build explanation items from dimensions
const explanationItems = computed(() => {
  return store.dimensions.map((dim) => ({
    text: dim.explanation,
    detail: dim.isWarning
      ? `This dimension needs attention. Score: ${dim.score}/100`
      : undefined,
    type: dim.score >= 70 ? 'positive' as const : 'negative' as const,
  }))
})

onMounted(async () => {
  await store.fetchHealth()
  showSuccessBanner.value = true
  if (bannerTimer) clearTimeout(bannerTimer)
  bannerTimer = setTimeout(() => {
    showSuccessBanner.value = false
  }, 3000)
})

function handleRetry() {
  store.refresh()
}

function handleConnect() {
  console.warn('[HealthPage] Connect Website: not yet implemented')
}

function handleViewAll() {
  console.warn('[HealthPage] View all: routing to Recommendations not yet configured')
}

function handleAction() {
  console.warn('[HealthPage] Improve Brand Health: routing to Recommendations not yet configured')
}
</script>

<style scoped>
.health-page {
  max-width: 960px;
  margin: 0 auto;
  padding: var(--space-6, 32px) var(--space-4, 16px);
  display: flex;
  flex-direction: column;
  gap: var(--space-5, 24px);
}

/* --- Loading State --- */
.health-page__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4, 16px);
  padding: var(--space-8, 64px) 0;
}

.health-page__skeleton-score {
  width: 96px;
  height: 96px;
  border-radius: var(--radius-md, 8px);
  background: linear-gradient(90deg, var(--color-surface-dim, #f9fafb) 25%, var(--color-border, #e5e7eb) 50%, var(--color-surface-dim, #f9fafb) 75%);
  background-size: 200% 100%;
  animation: health-shimmer 1.5s ease-in-out infinite;
}

.health-page__skeleton-text {
  width: 280px;
  height: 16px;
  border-radius: var(--radius-sm, 4px);
  background: linear-gradient(90deg, var(--color-surface-dim, #f9fafb) 25%, var(--color-border, #e5e7eb) 50%, var(--color-surface-dim, #f9fafb) 75%);
  background-size: 200% 100%;
  animation: health-shimmer 1.5s ease-in-out infinite;
}

.health-page__skeleton-bars {
  width: 100%;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  gap: var(--space-3, 12px);
  margin-top: var(--space-4, 16px);
}

.health-page__skeleton-bar {
  height: 24px;
  border-radius: var(--radius-sm, 4px);
  background: linear-gradient(90deg, var(--color-surface-dim, #f9fafb) 25%, var(--color-border, #e5e7eb) 50%, var(--color-surface-dim, #f9fafb) 75%);
  background-size: 200% 100%;
  animation: health-shimmer 1.5s ease-in-out infinite;
}

@keyframes health-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* --- Error State --- */
.health-page__error {
  display: flex;
  justify-content: center;
  padding: var(--space-8, 64px) 0;
}

.health-page__error-banner {
  display: flex;
  gap: var(--space-3, 12px);
  padding: var(--space-4, 16px);
  border-radius: var(--radius-md, 8px);
  background-color: #fef2f2;
  border: 1px solid #fecaca;
  max-width: 480px;
  width: 100%;
}

.health-page__error-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: var(--radius-full, 9999px);
  background-color: var(--color-error, #ef4444);
  color: #ffffff;
  font-size: 16px;
  font-weight: 700;
  flex-shrink: 0;
}

.health-page__error-content {
  flex: 1;
}

.health-page__error-title {
  margin: 0 0 var(--space-1, 4px);
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-size, 16px);
  font-weight: 600;
  color: #991b1b;
}

.health-page__error-message {
  margin: 0 0 var(--space-3, 12px);
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-sm-size, 14px);
  color: #b91c1c;
}

.health-page__retry-btn {
  padding: var(--space-2, 8px) var(--space-4, 16px);
  border: 1px solid var(--color-error, #ef4444);
  border-radius: var(--radius-sm, 4px);
  background-color: transparent;
  color: var(--color-error, #ef4444);
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-sm-size, 14px);
  font-weight: 500;
  cursor: pointer;
  transition: all var(--motion-fast-duration, 100ms) var(--motion-fast-easing, ease-out);
}

.health-page__retry-btn:hover {
  background-color: var(--color-error, #ef4444);
  color: #ffffff;
}

/* --- Empty State --- */
.health-page__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-8, 64px) var(--space-4, 16px);
  text-align: center;
}

.health-page__empty-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  margin-bottom: var(--space-4, 16px);
  border-radius: var(--radius-full, 9999px);
  background-color: var(--color-surface-dim, #f9fafb);
  color: var(--color-text-tertiary, #9ca3af);
  font-size: 28px;
}

.health-page__empty-title {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-heading-3-size, 20px);
  font-weight: var(--text-heading-3-weight, 500);
  color: var(--color-text-primary, #111111);
  margin: 0 0 var(--space-2, 8px);
}

.health-page__empty-description {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-size, 16px);
  color: var(--color-text-secondary, #6b7280);
  margin: 0 0 var(--space-4, 16px);
  max-width: 360px;
  line-height: 1.5;
}

.health-page__connect-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-3, 12px) var(--space-5, 24px);
  border: none;
  border-radius: var(--radius-md, 8px);
  background-color: var(--color-info, #3b82f6);
  color: #ffffff;
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-size, 16px);
  font-weight: 600;
  cursor: pointer;
  transition: all var(--motion-fast-duration, 100ms) var(--motion-fast-easing, ease-out);
}

.health-page__connect-btn:hover {
  background-color: #2563eb;
}

/* --- Success Banner --- */
.health-page__success-banner {
  display: flex;
  align-items: center;
  gap: var(--space-2, 8px);
  padding: var(--space-3, 12px) var(--space-4, 16px);
  border-radius: var(--radius-md, 8px);
  background-color: #f0fdf4;
  border: 1px solid #bbf7d0;
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-sm-size, 14px);
  font-weight: 500;
  color: #15803d;
  animation: health-fade-in 0.3s ease-out;
}

.health-page__success-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: var(--radius-full, 9999px);
  background-color: var(--color-success, #22c55e);
  color: #ffffff;
  font-size: 12px;
  font-weight: 700;
}

@keyframes health-fade-in {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

/* --- Split Layout --- */
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

/* --- Dimensional Breakdown --- */
.health-page__breakdown {
  display: flex;
  flex-direction: column;
  gap: var(--space-4, 16px);
}

.health-page__breakdown-title {
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
  transition: width var(--motion-slow-duration, 400ms) var(--motion-slow-easing, ease-in-out);
}

.health-page__breakdown-explanation {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-sm-size, 14px);
  color: var(--color-text-secondary, #6b7280);
  margin: 0;
  line-height: var(--text-body-sm-line, 1.5);
}
</style>
