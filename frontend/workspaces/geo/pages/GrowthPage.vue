/**
 * GrowthPage.vue — GEO Workspace Growth (Product Polish — Phase 8)
 *
 * All states: loading, error, empty, data
 * Features: page transition, direction overview, trend chart, proof panel,
 *   learning summary, opportunity block, milestones, time period selector,
 *   responsive layout, keyboard navigation, aria attributes
 */
<template>
  <div class="growth-page">
    <!-- ===== STATE: Loading ===== -->
    <LoadingState
      v-if="store.isLoading && !store.hasData"
      title="Loading brand progress..."
      :steps="[
        { label: 'Analyzing improvement trends...', active: true },
        { label: 'Calculating growth metrics...' },
        { label: 'Identifying milestones...' },
      ]"
    />

    <!-- ===== STATE: Error (no data) ===== -->
    <ErrorBanner
      v-else-if="store.error && !store.hasData"
      title="Unable to load growth data"
      message="Please check your connection and retry."
    >
      <DSButton
        variant="primary"
        @click="store.fetchGrowth()"
        :disabled="store.isLoading"
      >Retry</DSButton>
    </ErrorBanner>

    <!-- ===== STATE: Empty ===== -->
    <EmptyState
      v-else-if="!store.hasData"
      icon="&#8599;"
      title="Not enough data yet"
      description="Complete your first optimization cycle to see brand progress."
    />

    <!-- ===== STATE: Data ===== -->
    <template v-else-if="store.direction">
      <Hero
        title="Growth"
        :subtitle="`Brand Progress — ${store.direction.period}`"
      />

      <!-- Error Banner (recoverable) -->
      <Transition name="geo-banner">
        <ErrorBanner
          v-if="store.error"
          title="Growth data error"
          :message="store.error"
          dismissible
          @dismiss="store.error = null"
        >
          <DSButton variant="primary" @click="store.fetchGrowth()">Retry</DSButton>
        </ErrorBanner>
      </Transition>

      <!-- Layer 1: Direction Overview -->
      <GrowthOverview
        :before-score="store.direction.beforeScore"
        :after-score="store.direction.afterScore"
        :period="store.direction.period"
      />

      <!-- Trend Chart -->
      <div v-if="store.trendPoints.length > 1" class="growth-page__chart">
        <h3 class="growth-page__section-title">Brand Health Trend</h3>
        <TrendChart
          :points="store.trendPoints"
          title="Brand Health Trend"
          :height="160"
          :show-labels="true"
          color="var(--color-health, #22c55e)"
        />
      </div>

      <!-- Layer 2: Source — What improved -->
      <ProofPanel
        title="What improved"
        :items="sourceItems"
      />

      <!-- Layer 3: Learning — Most effective actions -->
      <LearningSummary
        :items="store.learnings"
        @view-detail="handleViewDetail"
      />

      <!-- Layer 4: Opportunity — Next opportunity -->
      <OpportunityBlock
        v-if="store.opportunity"
        :opportunity-title="store.opportunity.title"
        :expected-impact="store.opportunity.expectedImpact"
        @take-action="handleTakeAction"
      />

      <!-- Layer 5: Milestones -->
      <MilestoneBanner
        v-if="store.hasMilestones"
        :milestones="store.milestones"
      />

      <!-- Time Period Selector -->
      <div class="growth-page__period" role="group" aria-label="Time period selector">
        <span class="growth-page__period-label">Time period:</span>
        <div class="growth-page__period-options">
          <button
            v-for="p in periods"
            :key="p.value"
            :class="['growth-page__period-btn', { 'growth-page__period-btn--active': selectedPeriod === p.value }]"
            :aria-pressed="selectedPeriod === p.value"
            @click="selectPeriod(p.value)"
          >
            {{ p.label }}
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useGrowthStore } from '../stores/useGrowthStore'
import type { ProofItem } from '~/design-system/product-blocks/ProofPanel/index.vue'
import Hero from '~/design-system/product-blocks/Hero/index.vue'
import GrowthOverview from '~/design-system/product-blocks/GrowthOverview/index.vue'
import ProofPanel from '~/design-system/product-blocks/ProofPanel/index.vue'
import LearningSummary from '~/design-system/product-blocks/LearningSummary/index.vue'
import OpportunityBlock from '~/design-system/product-blocks/OpportunityBlock/index.vue'
import MilestoneBanner from '~/design-system/product-blocks/MilestoneBanner/index.vue'
import TrendChart from '~/design-system/components/TrendChart/index.vue'
import LoadingState from '~/design-system/components/LoadingState/index.vue'
import ErrorBanner from '~/design-system/components/ErrorBanner/index.vue'
import EmptyState from '~/design-system/components/EmptyState/index.vue'
import DSButton from '~/design-system/primitives/Button/index.vue'

const router = useRouter()
const store = useGrowthStore()
const selectedPeriod = ref('30d')

const periods = [
  { label: '7 days', value: '7d' },
  { label: '30 days', value: '30d' },
  { label: '90 days', value: '90d' },
]

const sourceItems = computed<ProofItem[]>(() => {
  return store.sources.slice(0, 4).map(s => ({
    name: s.name,
    before: s.before,
    after: s.after,
    delta: typeof s.delta === 'string' ? 0 : s.delta,
    suffix: s.suffix,
    learnContent: s.learnContent,
  }))
})

onMounted(async () => {
  await store.fetchGrowth()
})

function handleTakeAction() {
  router.push('/workspace/geo/recommendations')
}

function handleViewDetail(_action: string) {
  router.push('/workspace/geo/verification')
}

async function selectPeriod(period: string) {
  selectedPeriod.value = period
  await store.fetchGrowth()
}
</script>

<style scoped>
.growth-page {
  max-width: 960px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-5, 24px);
}

.growth-page__section-title {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-heading-3-size, 20px);
  font-weight: var(--text-heading-3-weight, 500);
  color: var(--color-text-primary, #111111);
  margin: 0 0 var(--space-3, 12px);
}

.growth-page__chart {
  display: flex;
  flex-direction: column;
  gap: var(--space-2, 8px);
}

.growth-page__period {
  display: flex;
  align-items: center;
  gap: var(--space-3, 12px);
  padding: var(--space-3, 12px);
  border-top: 1px solid var(--color-border, #e5e7eb);
}

.growth-page__period-label {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-sm-size, 14px);
  color: var(--color-text-secondary, #6b7280);
}

.growth-page__period-options {
  display: flex;
  gap: var(--space-2, 8px);
}

.growth-page__period-btn {
  padding: var(--space-1, 4px) var(--space-3, 12px);
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: var(--radius-sm, 4px);
  background-color: var(--color-surface, #ffffff);
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-caption-size, 12px);
  font-weight: 500;
  color: var(--color-text-secondary, #6b7280);
  cursor: pointer;
  transition: all var(--motion-fast-duration, 100ms) ease-out;
  outline: none;
}

.growth-page__period-btn:hover {
  border-color: var(--color-text-tertiary, #9ca3af);
}

.growth-page__period-btn:focus-visible {
  outline: 2px solid var(--color-info, #3b82f6);
  outline-offset: 2px;
}

.growth-page__period-btn--active {
  background-color: var(--color-info, #3b82f6);
  border-color: var(--color-info, #3b82f6);
  color: #ffffff;
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
