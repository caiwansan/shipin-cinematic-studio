<template>
  <div class="actionplan-embedded-content">
    <!-- Loading -->
    <div v-if="loading" class="actionplan-embedded-content__state">
      <div class="actionplan-embedded-content__spinner" />
      <span>Loading action plans...</span>
    </div>

    <!-- No data -->
    <div v-else-if="!hasPlans" class="actionplan-embedded-content__state">
      <p>No action plans generated yet. Complete Discovery and Opportunity Review first.</p>
    </div>

    <!-- Action Plans -->
    <template v-else>
      <div class="actionplan-embedded-content__card">
        <h4 class="actionplan-embedded-content__card-title">
          Action Plans
          <span class="actionplan-embedded-content__badge">{{ actionPlans.length }}</span>
        </h4>

        <div
          v-for="plan in actionPlans.slice(0, 5)"
          :key="plan.id"
          class="actionplan-embedded-content__plan"
        >
          <div class="actionplan-embedded-content__plan-header">
            <span class="actionplan-embedded-content__plan-title">{{ plan.title }}</span>
            <span class="actionplan-embedded-content__plan-impact">+{{ plan.estimatedImpact }} ADI</span>
          </div>
          <p class="actionplan-embedded-content__plan-desc">{{ plan.description }}</p>
          <div class="actionplan-embedded-content__plan-meta">
            <span class="actionplan-embedded-content__plan-effort">{{ effortLabel(plan.estimatedEffort) }}</span>
            <span v-if="plan.estimatedTime" class="actionplan-embedded-content__plan-time">{{ plan.estimatedTime }}</span>
          </div>
        </div>
      </div>

      <!-- Summary -->
      <div class="actionplan-embedded-content__card">
        <h4 class="actionplan-embedded-content__card-title">Summary</h4>
        <div class="actionplan-embedded-content__summary">
          <div class="actionplan-embedded-content__summary-item">
            <span class="actionplan-embedded-content__summary-value">{{ actionPlans.length }}</span>
            <span class="actionplan-embedded-content__summary-label">Total Plans</span>
          </div>
          <div class="actionplan-embedded-content__summary-item">
            <span class="actionplan-embedded-content__summary-value">{{ totalImpact }}</span>
            <span class="actionplan-embedded-content__summary-label">Total ADI Impact</span>
          </div>
        </div>
      </div>

      <div class="actionplan-embedded-content__actions">
        <button class="actionplan-embedded-content__btn" @click="confirmActionPlan">
          ✅ Confirm & Continue
        </button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useDiscoveryStore } from '../stores/useDiscoveryStore'
import type { ActionPlanItem } from '../services/discoveryService'

const props = defineProps<{
  projectId: string
  embedded?: boolean
}>()

const emit = defineEmits<{
  (e: 'complete', data?: any): void
}>()

const store = useDiscoveryStore()
const actionPlans = ref<ActionPlanItem[]>([])
const loading = ref(false)

const hasPlans = computed(() => actionPlans.value.length > 0)
const totalImpact = computed(() => actionPlans.value.reduce((sum, p) => sum + (p.estimatedImpact || 0), 0))

onMounted(async () => {
  if (store.report?.entityName) {
    loading.value = true
    try {
      await store.loadActionPlans(store.report.entityName)
      actionPlans.value = [...store.actionPlans]
    } catch {
      // Fallback
    } finally {
      loading.value = false
    }
  }
})

function effortLabel(effort: string): string {
  if (effort === 'easy') return '🟢 Easy'
  if (effort === 'hard') return '🔴 Hard'
  return '🟡 Medium'
}

function confirmActionPlan() {
  emit('complete', {
    projectId: props.projectId,
    planData: {
      actionPlans: actionPlans.value,
      totalImpact: totalImpact.value,
      count: actionPlans.value.length,
    },
  })
}
</script>

<style scoped>
.actionplan-embedded-content__state {
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

.actionplan-embedded-content__spinner {
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

.actionplan-embedded-content__card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 16px;
  margin-bottom: 12px;
}

.actionplan-embedded-content__card-title {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
  margin: 0 0 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.actionplan-embedded-content__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 10px;
  background: #e5e7eb;
  color: #6b7280;
  font-size: 11px;
  font-weight: 600;
}

.actionplan-embedded-content__plan {
  padding: 10px 12px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  margin-bottom: 8px;
}

.actionplan-embedded-content__plan:last-child {
  margin-bottom: 0;
}

.actionplan-embedded-content__plan-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 4px;
}

.actionplan-embedded-content__plan-title {
  font-size: 13px;
  font-weight: 600;
  color: #111827;
  flex: 1;
}

.actionplan-embedded-content__plan-impact {
  font-size: 12px;
  font-weight: 700;
  color: #16a34a;
  flex-shrink: 0;
  margin-left: 8px;
}

.actionplan-embedded-content__plan-desc {
  font-size: 12px;
  color: #6b7280;
  margin: 0 0 6px;
  line-height: 1.4;
}

.actionplan-embedded-content__plan-meta {
  display: flex;
  gap: 8px;
  font-size: 11px;
  color: #9ca3af;
}

.actionplan-embedded-content__summary {
  display: flex;
  gap: 24px;
}

.actionplan-embedded-content__summary-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.actionplan-embedded-content__summary-value {
  font-size: 24px;
  font-weight: 700;
  color: #111827;
}

.actionplan-embedded-content__summary-label {
  font-size: 11px;
  color: #9ca3af;
}

.actionplan-embedded-content__actions {
  margin-top: 12px;
  text-align: center;
}

.actionplan-embedded-content__btn {
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

.actionplan-embedded-content__btn:hover {
  background: #16a34a;
}
</style>
