<template>
  <div class="opportunity-embedded-content">
    <!-- Loading -->
    <div v-if="store.isLoading" class="opportunity-embedded-content__state">
      <div class="opportunity-embedded-content__spinner" />
      <span>Loading opportunity data...</span>
    </div>

    <!-- No Data -->
    <div v-else-if="!store.hasData" class="opportunity-embedded-content__state">
      <p>No discovery data found. Please complete the Discovery step first.</p>
    </div>

    <!-- Opportunity Summary -->
    <template v-else-if="store.report">
      <div class="opportunity-embedded-content__card">
        <h4 class="opportunity-embedded-content__card-title">Opportunity Overview</h4>
        <div class="opportunity-embedded-content__stats">
          <div class="opportunity-embedded-content__stat">
            <span class="opportunity-embedded-content__stat-value">{{ store.highPriorityOpportunities.length }}</span>
            <span class="opportunity-embedded-content__stat-label">High Priority</span>
          </div>
          <div class="opportunity-embedded-content__stat">
            <span class="opportunity-embedded-content__stat-value">{{ store.mediumPriorityOpportunities.length }}</span>
            <span class="opportunity-embedded-content__stat-label">Medium Priority</span>
          </div>
          <div class="opportunity-embedded-content__stat">
            <span class="opportunity-embedded-content__stat-value">{{ store.report.opportunities.length }}</span>
            <span class="opportunity-embedded-content__stat-label">Total</span>
          </div>
        </div>
      </div>

      <!-- High Priority Opportunities -->
      <div v-if="store.highPriorityOpportunities.length > 0" class="opportunity-embedded-content__card">
        <h4 class="opportunity-embedded-content__card-title">🔴 High Priority</h4>
        <div class="opportunity-embedded-content__list">
          <div
            v-for="opp in store.highPriorityOpportunities.slice(0, 3)"
            :key="opp.scenarioId"
            class="opportunity-embedded-content__item"
          >
            <div class="opportunity-embedded-content__item-header">
              <span class="opportunity-embedded-content__item-name">{{ opp.scenarioName }}</span>
              <span class="opportunity-embedded-content__item-gain">+{{ opp.expectedAdiGain }} ADI</span>
            </div>
            <p class="opportunity-embedded-content__item-reason">{{ opp.reason }}</p>
          </div>
        </div>
      </div>

      <!-- Confirm button -->
      <div class="opportunity-embedded-content__actions">
        <button class="opportunity-embedded-content__btn" @click="confirmOpportunities">
          ✅ Confirm & Continue
        </button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { useDiscoveryStore } from '../stores/useDiscoveryStore'

const props = defineProps<{
  projectId: string
  embedded?: boolean
}>()

const emit = defineEmits<{
  (e: 'complete', data?: any): void
}>()

const store = useDiscoveryStore()

function confirmOpportunities() {
  emit('complete', {
    projectId: props.projectId,
    opportunities: store.report?.opportunities || [],
    highPriorityCount: store.highPriorityOpportunities.length,
    mediumPriorityCount: store.mediumPriorityOpportunities.length,
  })
}
</script>

<style scoped>
.opportunity-embedded-content__state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 32px;
  color: #6b7280;
  background: #f9fafb;
  border: 1px dashed #e5e7eb;
  border-radius: 10px;
}

.opportunity-embedded-content__spinner {
  width: 20px;
  height: 20px;
  border: 2px solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.opportunity-embedded-content__card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 16px;
  margin-bottom: 12px;
}

.opportunity-embedded-content__card-title {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
  margin: 0 0 12px;
}

.opportunity-embedded-content__stats {
  display: flex;
  gap: 16px;
}

.opportunity-embedded-content__stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.opportunity-embedded-content__stat-value {
  font-size: 24px;
  font-weight: 700;
  color: #111827;
}

.opportunity-embedded-content__stat-label {
  font-size: 11px;
  color: #9ca3af;
}

.opportunity-embedded-content__list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.opportunity-embedded-content__item {
  padding: 10px 12px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
}

.opportunity-embedded-content__item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.opportunity-embedded-content__item-name {
  font-size: 13px;
  font-weight: 600;
  color: #111827;
}

.opportunity-embedded-content__item-gain {
  font-size: 12px;
  font-weight: 700;
  color: #16a34a;
}

.opportunity-embedded-content__item-reason {
  font-size: 12px;
  color: #6b7280;
  margin: 0;
  line-height: 1.4;
}

.opportunity-embedded-content__actions {
  margin-top: 12px;
  text-align: center;
}

.opportunity-embedded-content__btn {
  padding: 8px 24px;
  background: #22c55e;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}

.opportunity-embedded-content__btn:hover {
  background: #16a34a;
}
</style>
