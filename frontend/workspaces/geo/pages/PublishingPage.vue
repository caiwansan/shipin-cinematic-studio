/**
 * PublishingPage.vue — GEO Workspace Publishing (Product Polish — Phase 8)
 *
 * All states: loading, error, empty, data
 * Features: page transition, distribution health, channel list, pending updates,
 *   publish status, history, success/error feedback, responsive layout,
 *   keyboard navigation, aria attributes
 */
<template>
  <div class="pub-page">
    <!-- ===== STATE: Loading ===== -->
    <LoadingState
      v-if="store.isLoading && !store.hasData"
      title="Checking distribution status..."
      :steps="[
        { label: 'Verifying channel connections...', active: true },
        { label: 'Checking pending updates...' },
        { label: 'Loading distribution history...' },
      ]"
    />

    <!-- ===== STATE: Error (no data) ===== -->
    <ErrorBanner
      v-else-if="store.error && !store.hasData"
      title="Unable to load publishing data"
      message="Please check your connection and retry."
    >
      <DSButton
        variant="primary"
        @click="store.fetchPublishing()"
        :disabled="store.isLoading"
      >Retry</DSButton>
    </ErrorBanner>

    <!-- ===== STATE: Empty ===== -->
    <EmptyState
      v-else-if="!store.hasData"
      icon="&#8644;"
      title="No distribution channels set up yet"
      description="Connect your first channel to make your brand visible to AI systems."
    >
      <DSButton variant="primary" @click="handleSetup">Set Up First Channel</DSButton>
    </EmptyState>

    <!-- ===== STATE: Data ===== -->
    <template v-else-if="store.distributionHealth">
      <Hero
        title="Distribution"
        subtitle="Where your brand is seen by AI systems"
      />

      <!-- Distribution Health Banner -->
      <DistributionOverview
        :active-count="store.distributionHealth.activeCount"
        :total-count="store.distributionHealth.totalCount"
      />

      <!-- Publish Success Feedback -->
      <Transition name="geo-banner">
        <SuccessBanner
          v-if="store.publishStatus.status === 'success'"
          title="Distribution updated"
          description="Your brand changes have been distributed to all channels."
          dismissible
          @dismiss="dismissStatus"
        />
      </Transition>

      <!-- Publish Error -->
      <Transition name="geo-banner">
        <ErrorBanner
          v-if="store.publishStatus.status === 'error'"
          title="Distribution failed"
          :message="store.publishStatus.errorMessage || 'An error occurred'"
          dismissible
          @dismiss="dismissStatus"
        >
          <DSButton variant="primary" @click="store.publish()">Retry</DSButton>
        </ErrorBanner>
      </Transition>

      <!-- Connected Channels -->
      <ChannelList
        title="Connected Channels"
        :channels="store.channels"
        @retry="handleRetry"
        @setup="handleSetupChannel"
      />

      <!-- Pending Updates -->
      <div v-if="store.hasPendingUpdates" class="pub-page__section">
        <h3 class="pub-page__section-title">Pending Updates</h3>
        <p class="pub-page__section-count">{{ store.pendingCount }} brand changes not yet distributed</p>
        <div class="pub-page__updates" role="list">
          <div
            v-for="(update, index) in store.pendingUpdates"
            :key="index"
            class="pub-page__update-item"
            role="listitem"
          >
            <span class="pub-page__update-desc">{{ update.description }}</span>
            <span class="pub-page__update-date">{{ update.date }}</span>
          </div>
        </div>
      </div>

      <!-- Latest Distribution -->
      <div v-if="store.latestDistribution" class="pub-page__section">
        <h3 class="pub-page__section-title">Latest Distribution</h3>
        <div class="pub-page__latest">
          <div class="pub-page__latest-info">
            <span class="pub-page__latest-date">Last distributed: {{ store.latestDistribution.date }}</span>
            <span class="pub-page__latest-impact">
              Brand Health impact: +{{ store.latestDistribution.impact }}
            </span>
          </div>
          <DSButton variant="secondary" @click="handleViewImpact" aria-label="View impact of latest distribution">
            View Impact
          </DSButton>
        </div>
      </div>

      <!-- Current Version Badge -->
      <div v-if="store.currentVersion" class="pub-page__version">
        <span class="pub-page__version-label">Current Version</span>
        <span class="pub-page__version-value">{{ store.currentVersion }}</span>
      </div>

      <!-- Publishing History -->
      <div v-if="store.history.length > 0" class="pub-page__section">
        <h3 class="pub-page__section-title">Publishing History</h3>
        <div class="pub-page__history" role="list">
          <div
            v-for="item in store.history.slice(0, 5)"
            :key="item.id"
            class="pub-page__history-item"
            role="listitem"
          >
            <span class="pub-page__history-date">{{ item.date }}</span>
            <StatusIndicator :status="statusMap(item.status)" />
            <span class="pub-page__history-impact">+{{ item.impact }}</span>
          </div>
        </div>
      </div>

      <!-- Primary CTA -->
      <NextStepPanel
        v-if="store.hasPendingUpdates"
        :action-count="store.pendingCount"
        cta-label="Update Distribution"
        @action="handleUpdate"
      />
      <div v-else class="pub-page__uptodate">
        <span class="pub-page__uptodate-icon">&#10003;</span>
        <span>All channels up to date</span>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { usePublishingStore } from '../stores/usePublishingStore'
import type { PublishingStatus } from '../stores/usePublishingStore'
import Hero from '~/design-system/product-blocks/Hero/index.vue'
import DistributionOverview from '~/design-system/product-blocks/DistributionOverview/index.vue'
import ChannelList from '~/design-system/product-blocks/ChannelList/index.vue'
import NextStepPanel from '~/design-system/product-blocks/NextStepPanel/index.vue'
import LoadingState from '~/design-system/components/LoadingState/index.vue'
import ErrorBanner from '~/design-system/components/ErrorBanner/index.vue'
import EmptyState from '~/design-system/components/EmptyState/index.vue'
import SuccessBanner from '~/design-system/components/SuccessBanner/index.vue'
import StatusIndicator from '~/design-system/components/StatusIndicator/index.vue'
import DSButton from '~/design-system/primitives/Button/index.vue'

const router = useRouter()
const store = usePublishingStore()

onMounted(async () => {
  await store.fetchPublishing()
})

function statusMap(status: string): 'connected' | 'pending' | 'error' | 'not-set-up' {
  switch (status) {
    case 'success': return 'connected'
    case 'pending': return 'pending'
    case 'failed': return 'error'
    default: return 'pending'
  }
}

async function handleUpdate() {
  await store.publish()
}

function handleSetup() {
  // Integration point: setup first channel flow
  console.warn('[PublishingPage] Set Up First Channel: not yet implemented')
}

function handleRetry(channelName: string) {
  console.warn(`[PublishingPage] Retry channel: ${channelName}`)
}

function handleSetupChannel(channelName: string) {
  console.warn(`[PublishingPage] Setup channel: ${channelName}`)
}

function handleViewImpact() {
  router.push('/workspace/geo/verification')
}

function dismissStatus() {
  store.publishStatus.status = 'idle'
  store.publishStatus.errorMessage = null
}
</script>

<style scoped>
.pub-page {
  max-width: 960px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-5, 24px);
}

.pub-page__section {
  display: flex;
  flex-direction: column;
  gap: var(--space-4, 16px);
}

.pub-page__section-title {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-heading-3-size, 20px);
  font-weight: var(--text-heading-3-weight, 500);
  color: var(--color-text-primary, #111111);
  margin: 0;
}

.pub-page__section-count {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-sm-size, 14px);
  font-weight: 500;
  color: var(--color-warning, #eab308);
  margin: 0;
}

.pub-page__updates {
  display: flex;
  flex-direction: column;
  gap: var(--space-2, 8px);
}

.pub-page__update-item {
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

.pub-page__update-item:hover {
  border-color: var(--color-text-tertiary, #9ca3af);
}

.pub-page__update-desc {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-sm-size, 14px);
  font-weight: 500;
  color: var(--color-text-primary, #111111);
}

.pub-page__update-date {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-caption-size, 12px);
  color: var(--color-text-tertiary, #9ca3af);
}

.pub-page__latest {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3, 12px);
  padding: var(--space-4, 16px);
  border-radius: var(--radius-md, 8px);
  background-color: var(--color-surface, #ffffff);
  border: 1px solid var(--color-border, #e5e7eb);
  transition: border-color var(--motion-fast-duration, 100ms) ease-out;
}

.pub-page__latest:hover {
  border-color: var(--color-text-tertiary, #9ca3af);
}

.pub-page__latest-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-1, 4px);
}

.pub-page__latest-date {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-sm-size, 14px);
  color: var(--color-text-secondary, #6b7280);
}

.pub-page__latest-impact {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-sm-size, 14px);
  font-weight: 600;
  color: var(--color-success, #22c55e);
}

.pub-page__version {
  display: flex;
  align-items: center;
  gap: var(--space-2, 8px);
  padding: var(--space-2, 8px) var(--space-4, 16px);
  border-radius: var(--radius-md, 8px);
  background-color: var(--color-surface-dim, #f9fafb);
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-sm-size, 14px);
}

.pub-page__version-label {
  color: var(--color-text-secondary, #6b7280);
}

.pub-page__version-value {
  font-weight: 600;
  color: var(--color-text-primary, #111111);
}

.pub-page__history {
  display: flex;
  flex-direction: column;
  gap: var(--space-2, 8px);
}

.pub-page__history-item {
  display: flex;
  align-items: center;
  gap: var(--space-3, 12px);
  padding: var(--space-3, 12px);
  border-radius: var(--radius-md, 8px);
  background-color: var(--color-surface, #ffffff);
  border: 1px solid var(--color-border, #e5e7eb);
  transition: border-color var(--motion-fast-duration, 100ms) ease-out;
}

.pub-page__history-item:hover {
  border-color: var(--color-text-tertiary, #9ca3af);
}

.pub-page__history-date {
  flex: 1;
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-sm-size, 14px);
  color: var(--color-text-secondary, #6b7280);
}

.pub-page__history-impact {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-sm-size, 14px);
  font-weight: 600;
  color: var(--color-success, #22c55e);
}

.pub-page__uptodate {
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

.pub-page__uptodate-icon {
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
