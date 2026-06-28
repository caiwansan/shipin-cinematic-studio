<template>
  <div class="subscription-manager">
    <h3>📋 Plan & Subscription</h3>

    <div v-if="loading" class="sm-loading">Loading plans...</div>

    <div v-if="currentSub" class="sm-current">
      <h4>Current Plan: <strong>{{ currentSub.plan?.name || 'N/A' }}</strong></h4>
      <p>Status: <span :class="['gc-badge', currentSub.status]">{{ currentSub.status }}</span></p>
      <p v-if="currentSub.endDate">Expires: {{ formatDate(currentSub.endDate) }}</p>
    </div>

    <div class="sm-plans" v-if="plans.length">
      <div v-for="plan in plans" :key="plan.id" class="sm-plan-card" :class="{ 'sm-active': currentSub?.planId === plan.id }">
        <div class="sm-plan-name">{{ plan.name }}</div>
        <div class="sm-plan-price" v-if="plan.price">${{ plan.price }} / {{ plan.billingCycle }}</div>
        <div class="sm-plan-free" v-else>Free</div>
        <p class="sm-plan-desc">{{ plan.description }}</p>
        <button
          class="sm-btn"
          :disabled="currentSub?.planId === plan.id"
          @click="$emit('select', plan.id)"
        >
          {{ currentSub?.planId === plan.id ? 'Current' : 'Select' }}
        </button>
      </div>
    </div>
    <p v-else class="sm-empty">No plans available.</p>
  </div>
</template>

<script setup lang="ts">
import type { SubscriptionPlanDTO, SubscriptionDTO } from '../types/index.js'

defineProps<{
  plans: SubscriptionPlanDTO[]
  currentSub?: SubscriptionDTO | null
  loading?: boolean
}>()

defineEmits<{
  select: [planId: string]
}>()

function formatDate(dateStr?: string): string {
  if (!dateStr) return 'N/A'
  return new Date(dateStr).toLocaleDateString()
}
</script>

<style scoped>
.subscription-manager { padding: 16px; }
.sm-loading, .sm-empty { color: #888; padding: 20px; text-align: center; }
.sm-current { background: #f0f8ff; border: 1px solid #b3d9ff; border-radius: 8px; padding: 12px; margin-bottom: 16px; }
.sm-current h4 { margin: 0 0 8px; }
.sm-plans { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; }
.sm-plan-card { border: 1px solid #e0e0e0; border-radius: 8px; padding: 16px; text-align: center; transition: all 0.2s; }
.sm-plan-card:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
.sm-active { border-color: #4fc3f7; background: #f0f8ff; }
.sm-plan-name { font-weight: 600; font-size: 1.1em; }
.sm-plan-price { color: #4fc3f7; font-size: 1.3em; font-weight: 700; margin: 8px 0; }
.sm-plan-free { color: #81c784; font-size: 1.1em; margin: 8px 0; }
.sm-plan-desc { color: #888; font-size: 0.85em; }
.sm-btn { margin-top: 12px; padding: 6px 16px; border: none; border-radius: 6px; background: #4fc3f7; color: #fff; cursor: pointer; }
.sm-btn:disabled { background: #ccc; cursor: not-allowed; }
.gc-badge { padding: 2px 8px; border-radius: 12px; font-size: 0.8em; font-weight: 600; }
.gc-badge.active { background: #e8f5e9; color: #2e7d32; }
</style>
