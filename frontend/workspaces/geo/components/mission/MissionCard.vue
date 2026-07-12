<!--
MissionCard.vue — Individual Mission Card

BEM class names: __card, __badge, __title, __reason, __impact, __action
Priority Badge (● P0/P1/P2/P3), Title (max 2 lines), Why (max 3 lines), Impact, Action Button.
Action button always at bottom. Cards have uniform min-height.
P0: 4px left accent bar (#ef4444), border-radius 8px.
P1/P2/P3: standard card, no accent bar.
-->
<template>
  <div
    :class="['mc__card', { 'mc__card--p0': isP0 }]"
    :style="cardStyle"
  >
    <div class="mc__content">
      <!-- Priority Badge -->
      <div class="mc__badge" :style="badgeStyle">
        ● {{ mission.priority }}
      </div>

      <!-- Title: max 2 lines -->
      <h3 class="mc__title">{{ mission.title }}</h3>

      <!-- Reason: max 3 lines -->
      <p class="mc__reason">
        Why: {{ mission.reason }}
      </p>

      <!-- Impact -->
      <p class="mc__impact">Impact: {{ mission.impact.text }}</p>
    </div>

    <!-- Action Button: always at bottom -->
    <div class="mc__action">
      <button
        v-if="hasAction"
        class="mc__action-btn"
        @click="$emit('action', mission)"
      >
        {{ actionLabel }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Mission } from '../../types/mission'
console.log('[MissionCard:mission/setup] initializing')

const props = defineProps<{
  mission: Mission
}>()

defineEmits<{
  (e: 'action', mission: Mission): void
}>()

const isP0 = computed(() => props.mission.priority === 'P0')

const hasAction = computed(() => props.mission.actions.length > 0)

const actionLabel = computed(() => {
  return props.mission.actions[0]?.label || 'Open'
})

const badgeStyle = computed(() => {
  const colors: Record<string, string> = {
    P0: '#ef4444',
    P1: '#f97316',
    P2: '#eab308',
    P3: '#6b7280',
  }
  return { color: colors[props.mission.priority] || '#6b7280' }
})

const cardStyle = computed(() => {
  if (isP0.value) {
    return { borderLeft: '4px solid #ef4444' }
  }
  return {}
})
</script>

<style scoped>
.mc__card {
  display: flex;
  flex-direction: column;
  min-height: 240px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 20px;
  transition: box-shadow 0.15s ease, border-color 0.15s ease;
  position: relative;
}

.mc__card:hover {
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
  border-color: #d1d5db;
}

.mc__card--p0 {
  border-left: 4px solid #ef4444;
}

.mc__content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
}

.mc__badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  padding: 2px 0;
}

.mc__title {
  font-size: 16px;
  font-weight: 700;
  line-height: 1.4;
  color: #111827;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  word-break: break-word;
}

.mc__reason {
  font-size: 14px;
  line-height: 1.5;
  color: #6b7280;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  word-break: break-word;
}

.mc__impact {
  font-size: 14px;
  font-weight: 600;
  color: #059669;
  margin: 0;
}

.mc__action {
  padding-top: 16px;
  margin-top: auto;
  flex-shrink: 0;
}

.mc__action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 10px 20px;
  background-color: #f9fafb;
  color: #374151;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  font-family: inherit;
}

.mc__action-btn:hover {
  background-color: #f3f4f6;
  border-color: #9ca3af;
  color: #111827;
}

.mc__action-btn:active {
  background-color: #e5e7eb;
}
</style>
