/**
 * VerificationPage.vue — GEO Workspace Verification (Product Polish — Phase 8)
 *
 * All states: loading, error, empty, data
 * Features: page transition, outcome summary, confidence checklist, proof panel,
 *   trust message, history, responsive layout, keyboard navigation, aria attributes
 */
<template>
  <div class="ver-page">
    <!-- ===== STATE: Loading ===== -->
    <LoadingState
      v-if="store.isLoading && !store.hasData"
      title="Verifying your brand..."
      :steps="[
        { label: 'Checking AI visibility...', active: true },
        { label: 'Analyzing knowledge coverage...' },
        { label: 'Comparing before and after...' },
        { label: 'Generating trust report...' },
      ]"
    />

    <!-- ===== STATE: Error (no data) ===== -->
    <ErrorBanner
      v-else-if="store.error && !store.hasData"
      title="Unable to load verification data"
      message="Please check your connection and retry."
    >
      <DSButton
        variant="primary"
        @click="store.fetchVerification()"
        :disabled="store.isLoading"
      >Retry</DSButton>
    </ErrorBanner>

    <!-- ===== STATE: Empty ===== -->
    <EmptyState
      v-else-if="!store.hasData"
      icon="&#10003;"
      title="No verifications yet"
      description="Run your first recommendation to see how your brand improves."
    />

    <!-- ===== STATE: Data ===== -->
    <template v-else-if="store.outcome && store.trust">
      <Hero
        title="Verification"
        subtitle="Did your brand really improve?"
      />

      <!-- Error Banner (recoverable) -->
      <Transition name="geo-banner">
        <ErrorBanner
          v-if="store.error"
          title="Verification error"
          :message="store.error"
          dismissible
          @dismiss="store.error = null"
        >
          <DSButton variant="primary" @click="store.fetchVerification()">Retry</DSButton>
        </ErrorBanner>
      </Transition>

      <!-- Layer 1: Outcome Summary -->
      <VerificationSummary
        title="Brand Health"
        :before-score="store.outcome.beforeScore"
        :after-score="store.outcome.afterScore"
      />

      <!-- Layer 2: Confidence Score -->
      <div class="ver-page__layer">
        <h3 class="ver-page__section-title">Why we believe this</h3>
        <div class="ver-page__confidence" role="list">
          <div
            v-for="(item, index) in store.confidence"
            :key="index"
            class="ver-page__confidence-item"
            role="listitem"
          >
            <span
              :class="['ver-page__confidence-icon', { 'ver-page__confidence-icon--complete': item.complete }]"
              role="img"
              :aria-label="item.complete ? 'Complete' : 'Incomplete'"
            >
              {{ item.complete ? '&#10003;' : '&#10007;' }}
            </span>
            <div class="ver-page__confidence-content">
              <p class="ver-page__confidence-label">{{ item.item }}</p>
              <p v-if="!item.complete" class="ver-page__confidence-pending">Pending</p>
            </div>
          </div>
        </div>
        <p v-if="store.allComplete" class="ver-page__confidence-all">
          All complete — no pending items
        </p>
        <p v-else class="ver-page__confidence-count">
          {{ store.completedConfidenceItems }} of {{ store.totalConfidenceItems }} complete
        </p>
      </div>

      <!-- Layer 3: Proof — Before vs After -->
      <ProofPanel
        title="Before vs After"
        :items="proofItems"
      />

      <!-- Layer 4: Trust Message -->
      <div class="ver-page__trust">
        <p class="ver-page__trust-message">{{ store.trust.message }}</p>
        <DSButton variant="secondary" @click="handleGrowth" aria-label="View Growth Trends">
          View Growth Trends
        </DSButton>
      </div>

      <!-- Verification History -->
      <div v-if="store.history.length > 0" class="ver-page__section">
        <h3 class="ver-page__section-title">Verification History</h3>
        <div class="ver-page__history" role="list">
          <div
            v-for="item in store.history.slice(0, 5)"
            :key="item.id"
            class="ver-page__history-item"
            role="listitem"
          >
            <span class="ver-page__history-date">{{ item.date }}</span>
            <span class="ver-page__history-scores">{{ item.beforeScore }} → {{ item.afterScore }}</span>
            <span
              :class="['ver-page__history-delta', deltaClass(item.delta)]"
            >
              {{ item.delta > 0 ? '+' : '' }}{{ item.delta }}
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
import { useVerificationStore } from '../stores/useVerificationStore'
import type { ProofItem } from '~/design-system/product-blocks/ProofPanel/index.vue'
import Hero from '~/design-system/product-blocks/Hero/index.vue'
import VerificationSummary from '~/design-system/product-blocks/VerificationSummary/index.vue'
import ProofPanel from '~/design-system/product-blocks/ProofPanel/index.vue'
import LoadingState from '~/design-system/components/LoadingState/index.vue'
import ErrorBanner from '~/design-system/components/ErrorBanner/index.vue'
import EmptyState from '~/design-system/components/EmptyState/index.vue'
import DSButton from '~/design-system/primitives/Button/index.vue'

const router = useRouter()
const store = useVerificationStore()

const proofItems = computed<ProofItem[]>(() => {
  return store.proof.slice(0, 4).map(p => ({
    name: p.name,
    before: p.before,
    after: p.after,
    delta: p.delta,
    suffix: p.suffix,
    isUnavailable: p.isUnavailable,
    learnContent: p.learnContent,
  }))
})

onMounted(async () => {
  await store.fetchVerification()
})

function handleGrowth() {
  router.push('/workspace/geo/growth')
}

function deltaClass(delta: number): string {
  if (delta > 0) return 'ver-page__history-delta--positive'
  if (delta < 0) return 'ver-page__history-delta--negative'
  return 'ver-page__history-delta--neutral'
}
</script>

<style scoped>
.ver-page {
  max-width: 960px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-5, 24px);
}

.ver-page__layer {
  display: flex;
  flex-direction: column;
  gap: var(--space-4, 16px);
}

.ver-page__section-title {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-heading-3-size, 20px);
  font-weight: var(--text-heading-3-weight, 500);
  color: var(--color-text-primary, #111111);
  margin: 0;
}

.ver-page__confidence {
  display: flex;
  flex-direction: column;
  gap: var(--space-2, 8px);
}

.ver-page__confidence-item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3, 12px);
  padding: var(--space-3, 12px);
  border-radius: var(--radius-md, 8px);
  background-color: var(--color-surface, #ffffff);
  border: 1px solid var(--color-border, #e5e7eb);
  transition: border-color var(--motion-fast-duration, 100ms) ease-out;
}

.ver-page__confidence-item:hover {
  border-color: var(--color-text-tertiary, #9ca3af);
}

.ver-page__confidence-icon {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: var(--color-text-tertiary, #9ca3af);
}

.ver-page__confidence-icon--complete {
  color: var(--color-success, #22c55e);
}

.ver-page__confidence-content {
  flex: 1;
}

.ver-page__confidence-label {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-sm-size, 14px);
  font-weight: 500;
  color: var(--color-text-primary, #111111);
  margin: 0;
}

.ver-page__confidence-pending {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-caption-size, 12px);
  color: var(--color-warning, #eab308);
  margin: var(--space-1, 4px) 0 0;
}

.ver-page__confidence-all,
.ver-page__confidence-count {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-sm-size, 14px);
  color: var(--color-text-secondary, #6b7280);
  margin: 0;
  font-style: italic;
  text-align: center;
}

.ver-page__confidence-all {
  color: var(--color-success, #22c55e);
}

.ver-page__trust {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4, 16px);
  padding: var(--space-5, 24px);
  border-radius: var(--radius-lg, 12px);
  background: linear-gradient(135deg, var(--color-surface-dim, #f9fafb) 0%, var(--color-surface, #ffffff) 100%);
  border: 1px solid var(--color-border, #e5e7eb);
  text-align: center;
  transition: border-color var(--motion-fast-duration, 100ms) ease-out;
}

.ver-page__trust:hover {
  border-color: var(--color-text-tertiary, #9ca3af);
}

.ver-page__trust-message {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-size, 16px);
  color: var(--color-text-secondary, #6b7280);
  margin: 0;
  max-width: 480px;
  line-height: 1.5;
}

.ver-page__section {
  display: flex;
  flex-direction: column;
  gap: var(--space-4, 16px);
}

.ver-page__history {
  display: flex;
  flex-direction: column;
  gap: var(--space-2, 8px);
}

.ver-page__history-item {
  display: flex;
  align-items: center;
  gap: var(--space-3, 12px);
  padding: var(--space-3, 12px);
  border-radius: var(--radius-md, 8px);
  background-color: var(--color-surface, #ffffff);
  border: 1px solid var(--color-border, #e5e7eb);
  transition: border-color var(--motion-fast-duration, 100ms) ease-out;
}

.ver-page__history-item:hover {
  border-color: var(--color-text-tertiary, #9ca3af);
}

.ver-page__history-date {
  flex: 1;
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-sm-size, 14px);
  color: var(--color-text-secondary, #6b7280);
}

.ver-page__history-scores {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-sm-size, 14px);
  font-weight: 600;
  color: var(--color-text-primary, #111111);
}

.ver-page__history-delta {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-sm-size, 14px);
  font-weight: 600;
  min-width: 40px;
  text-align: right;
}

.ver-page__history-delta--positive { color: var(--color-success, #22c55e); }
.ver-page__history-delta--negative { color: var(--color-error, #ef4444); }
.ver-page__history-delta--neutral { color: var(--color-text-tertiary, #9ca3af); }

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
